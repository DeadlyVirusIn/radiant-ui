/**
 * useSocketEventGuard — Socket event integrity layer.
 *
 * Wraps socket event consumption with four protections:
 *   1. AccountId filtering — discard events for wrong account
 *   2. Timestamp monotonic guard — reject events older than last-seen per request
 *   3. State transition validation — warn on invalid transitions, reject if older
 *   4. Reconnect resync — trigger full API sync after socket reconnect
 *
 * Also feeds debugBridge for the DebugStrip.
 *
 * Usage:
 *   const guard = useSocketEventGuard({
 *     selectedAccountId,
 *     eventNames: ['gift_request_created', ...],
 *     onEvent: (data, meta) => { ... },
 *     onReconnect: () => { loadRequests() },
 *   });
 */

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import { logEvent, logRejection, logError, trackLifecycle } from '../utils/debugBridge';

// Valid state transitions for trade requests
const TRADE_TRANSITIONS = {
  PENDING:              ['QUEUED', 'MATCHING', 'FAILED', 'CANCELLED'],
  QUEUED:               ['MATCHING', 'FAILED', 'CANCELLED'],
  MATCHING:             ['FRIEND_REQUEST_SENT', 'FAILED', 'CANCELLED'],
  FRIEND_REQUEST_SENT:  ['FRIEND_ACCEPTED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  FRIEND_ACCEPTED:      ['TRADE_PROPOSAL_SENT', 'EXECUTING_TRADE', 'FAILED', 'CANCELLED'],
  TRADE_PROPOSAL_SENT:  ['PICK_CARD', 'TRADE_ACCEPTED', 'FAILED', 'CANCELLED'],
  PICK_CARD:            ['TRADE_ACCEPTED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  TRADE_ACCEPTED:       ['CONFIRMING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  CONFIRMING:           ['COMPLETED', 'FAILED', 'CANCELLED'],
  EXECUTING_TRADE:      ['COMPLETED', 'FAILED', 'CANCELLED'],
  // Terminal states — no transitions out
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

// Valid state transitions for gift requests
const GIFT_TRANSITIONS = {
  PENDING:              ['QUEUED', 'MATCHING', 'FAILED', 'CANCELLED'],
  QUEUED:               ['MATCHING', 'FAILED', 'CANCELLED'],
  MATCHING:             ['FRIEND_REQUEST_SENT', 'FAILED', 'CANCELLED'],
  FRIEND_REQUEST_SENT:  ['FRIEND_ACCEPTED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  FRIEND_ACCEPTED:      ['EXECUTING_GIFT', 'FAILED', 'CANCELLED'],
  EXECUTING_GIFT:       ['COMPLETED', 'FAILED', 'CANCELLED'],
  // Terminal states
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

/**
 * Determine which transition map to use based on event name.
 */
function getTransitionMap(eventName) {
  if (eventName.startsWith('gift_') || eventName === 'gift_executing') {
    return GIFT_TRANSITIONS;
  }
  return TRADE_TRANSITIONS;
}

/**
 * Extract the new status from a socket event payload.
 * Backend always includes `status` field in event data.
 */
function extractStatus(data) {
  return data?.status || null;
}

export function useSocketEventGuard({
  selectedAccountId,
  eventNames = [],
  onEvent,
  onReconnect,
}) {
  // Refs for latest values — avoids stale closures
  const selectedAccountIdRef = useRef(selectedAccountId);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  // Per-request state: { [requestId]: { maxTimestamp, lastStatus } }
  // maxTimestamp = high-water mark (highest timestamp seen), not last event's timestamp.
  // This handles out-of-order events from backend (polling vs executor race).
  const requestStateRef = useRef(new Map());

  // Track whether we've connected at least once (to distinguish initial connect from reconnect)
  const hasConnectedRef = useRef(false);

  // Keep refs current
  useEffect(() => { selectedAccountIdRef.current = selectedAccountId; }, [selectedAccountId]);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onReconnectRef.current = onReconnect; }, [onReconnect]);

  // Core event handler — stable reference, reads from refs
  const handleEvent = useCallback((eventName, data) => {
    const accountId = selectedAccountIdRef.current;
    const newStatus = extractStatus(data);
    const requestId = data?.requestId;
    const eventTimestamp = data?.timestamp || new Date().toISOString();

    // --- Guard 1: AccountId filtering ---
    if (accountId && data?.accountId && String(data.accountId) !== String(accountId)) {
      logRejection(eventName, 'account_mismatch', data);
      return;
    }

    // --- Guard 2: Same-status dedup ---
    // Only reject if SAME status with same or older timestamp (true duplicate).
    // Different statuses are never rejected here — even with older timestamps —
    // because backend does NOT guarantee monotonic timestamps per request
    // (polling loop and executor can race).
    if (requestId) {
      const state = requestStateRef.current.get(requestId);
      if (state && newStatus === state.lastStatus) {
        // Same status arriving again — reject if not newer than high-water mark
        if (eventTimestamp <= state.maxTimestamp) {
          logRejection(eventName, 'duplicate_same_status', data);
          return;
        }
        // Same status but newer timestamp — allow (could be a legitimate re-emission)
      }
    }

    // --- Guard 3: State transition validation ---
    if (requestId && newStatus) {
      const state = requestStateRef.current.get(requestId);
      const currentStatus = state?.lastStatus;

      if (currentStatus) {
        const transitionMap = getTransitionMap(eventName);
        const validNext = transitionMap[currentStatus];

        if (validNext && !validNext.includes(newStatus)) {
          // Invalid transition detected.
          // Compare against high-water mark timestamp (not event timestamp,
          // since backend timestamps can be out of order).
          const isNewerThanHighWater = eventTimestamp > (state?.maxTimestamp || '');

          if (!isNewerThanHighWater) {
            // Invalid AND not newer than anything we've seen → reject (stale late-arriving event)
            logRejection(eventName, `invalid_transition_stale: ${currentStatus}->${newStatus}`, data);
            logError('guard', `Rejected stale invalid transition: ${currentStatus} -> ${newStatus}`, {
              requestId, eventName,
            });
            return;
          }

          // Invalid AND newer than high-water → accept but log critical error.
          // This means backend emitted a state we don't expect — could be a new
          // status added to backend that client doesn't know about yet.
          logError('guard', `CRITICAL: Invalid transition accepted (newer than high-water): ${currentStatus} -> ${newStatus}`, {
            requestId, eventName, severity: 'critical',
          });
        }
      }
    }

    // --- All guards passed — update tracking state ---
    if (requestId) {
      const prevState = requestStateRef.current.get(requestId);
      const prevMax = prevState?.maxTimestamp || '';
      requestStateRef.current.set(requestId, {
        maxTimestamp: eventTimestamp > prevMax ? eventTimestamp : prevMax,
        lastStatus: newStatus,
      });

      // Prune old entries (keep last 200 requests)
      if (requestStateRef.current.size > 200) {
        const firstKey = requestStateRef.current.keys().next().value;
        requestStateRef.current.delete(firstKey);
      }
    }

    // --- Log to debug bridge ---
    logEvent(eventName, data, 'socket');
    if (requestId && newStatus) {
      trackLifecycle(requestId, newStatus, 'socket');
    }

    // --- Deliver to consumer ---
    const meta = {
      source: 'socket',
      lastUpdatedAt: eventTimestamp,
      eventName,
    };

    if (onEventRef.current) {
      onEventRef.current(data, meta);
    }
  }, []); // Stable — reads from refs

  // Register socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Create stable per-event wrappers
    const wrappers = eventNames.map(eventName => {
      const wrapper = (data) => handleEvent(eventName, data);
      return { eventName, wrapper };
    });

    // Subscribe
    wrappers.forEach(({ eventName, wrapper }) => {
      socket.on(eventName, wrapper);
    });

    // --- Reconnect resync ---
    const handleConnect = () => {
      if (hasConnectedRef.current) {
        // This is a REconnect (not first connect)
        logEvent('_socket_reconnect', { message: 'Socket reconnected — triggering full resync' }, 'socket');
        if (onReconnectRef.current) {
          onReconnectRef.current();
        }
      }
      hasConnectedRef.current = true;
    };
    socket.on('connect', handleConnect);

    // Cleanup
    return () => {
      wrappers.forEach(({ eventName, wrapper }) => {
        socket.off(eventName, wrapper);
      });
      socket.off('connect', handleConnect);
    };
  }, [eventNames.join(','), handleEvent]); // Re-register only if event list changes

  // --- Public API for pages to seed request state from API data ---
  const seedRequestState = useCallback((requests) => {
    if (!Array.isArray(requests)) return;
    for (const req of requests) {
      if (req.id && req.status) {
        const ts = req.updated_at || req.requested_at || new Date().toISOString();
        const existing = requestStateRef.current.get(String(req.id));
        const prevMax = existing?.maxTimestamp || '';
        requestStateRef.current.set(String(req.id), {
          maxTimestamp: ts > prevMax ? ts : prevMax,
          lastStatus: req.status,
        });
        trackLifecycle(String(req.id), req.status, 'api');
      }
    }
  }, []);

  // Clear tracking state (e.g., on account switch)
  const clearState = useCallback(() => {
    requestStateRef.current.clear();
  }, []);

  return { seedRequestState, clearState };
}

export default useSocketEventGuard;
