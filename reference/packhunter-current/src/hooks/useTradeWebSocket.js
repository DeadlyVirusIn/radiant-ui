/**
 * useTradeWebSocket Hook
 *
 * Handles WebSocket events for trade requests via useSocketEventGuard.
 * All events flow through the guard layer (accountId filter, dedup,
 * timestamp monotonic guard, transition validation, debug logging).
 *
 * Fixes from original:
 *   - `onAny` was missing from useEffect deps → stale closure
 *   - Handlers recreated per-render → listener accumulation on account switch
 *   - No dedup/transition validation
 *   - No reconnect resync
 *
 * Now: single stable registration via guard hook. All handlers via useRef.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSocketEventGuard } from './useSocketEventGuard';

// Trade socket event names (map to handler keys).
// Phase 26 — added trade_request_stuck + trade_request_awaiting_user_confirm
// so the FE can render TRUTHFUL "stuck" / "action required" states
// instead of falling back to the generic "completed" / "failed" labels.
const TRADE_EVENT_MAP = {
  trade_request_created: 'onCreated',
  trade_request_matching: 'onMatching',
  trade_request_friend_sent: 'onFriendSent',
  trade_request_friend_accepted: 'onFriendAccepted',
  trade_proposal_sent: 'onProposalSent',
  trade_pick_card: 'onPickCard',
  trade_request_accepted: 'onAccepted',
  trade_request_awaiting_user_confirm: 'onAwaitingUserConfirm',
  trade_request_completed: 'onCompleted',
  trade_request_failed: 'onFailed',
  trade_request_stuck: 'onStuck',
  // Phase 2.7 — auto-recovery outcomes
  trade_request_auto_recovery_succeeded: 'onAutoRecoverySucceeded',
  trade_request_auto_recovery_exhausted: 'onAutoRecoveryExhausted',
  trade_request_expired: 'onExpired',
  trade_request_cancelled: 'onCancelled',
  trade_request_progress: 'onProgress',
};

const TRADE_EVENT_NAMES = Object.keys(TRADE_EVENT_MAP);

// Friendly type names for onAny callback
const EVENT_TYPE_MAP = {
  trade_request_created: 'created',
  trade_request_matching: 'matching',
  trade_request_friend_sent: 'friend_sent',
  trade_request_friend_accepted: 'friend_accepted',
  trade_proposal_sent: 'proposal_sent',
  trade_pick_card: 'pick_card',
  trade_request_accepted: 'accepted',
  trade_request_awaiting_user_confirm: 'awaiting_user_confirm',
  trade_request_completed: 'completed',
  trade_request_failed: 'failed',
  trade_request_stuck: 'stuck',
  trade_request_auto_recovery_succeeded: 'auto_recovery_succeeded',
  trade_request_auto_recovery_exhausted: 'auto_recovery_exhausted',
  trade_request_expired: 'expired',
  trade_request_cancelled: 'cancelled',
  trade_request_progress: 'progress',
};

/**
 * Hook to listen for trade request WebSocket events.
 *
 * @param {Object} handlers - Event handler callbacks
 * @param {Function} handlers.onCreated
 * @param {Function} handlers.onMatching
 * @param {Function} handlers.onFriendSent
 * @param {Function} handlers.onFriendAccepted
 * @param {Function} handlers.onProposalSent
 * @param {Function} handlers.onPickCard
 * @param {Function} handlers.onAccepted
 * @param {Function} handlers.onCompleted
 * @param {Function} handlers.onFailed
 * @param {Function} handlers.onExpired
 * @param {Function} handlers.onCancelled
 * @param {Function} handlers.onProgress
 * @param {Function} handlers.onAny - Called for any trade event (generic handler)
 * @param {string|null} accountId - Filter events to this account
 * @param {Function} onReconnect - Called on socket reconnect for full API resync
 */
export function useTradeWebSocket(handlers = {}, accountId = null, onReconnect = null) {
  // Store all handlers in a ref to avoid stale closures
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  // Guard hook handles all socket registration, dedup, filtering
  const { seedRequestState, clearState } = useSocketEventGuard({
    selectedAccountId: accountId,
    eventNames: TRADE_EVENT_NAMES,
    onEvent: useCallback((data, meta) => {
      const eventName = meta.eventName;
      const handlerKey = TRADE_EVENT_MAP[eventName];
      const h = handlersRef.current;

      // Call specific handler
      if (handlerKey && h[handlerKey]) {
        h[handlerKey](data);
      }

      // Call onAny with friendly type
      if (h.onAny) {
        const type = EVENT_TYPE_MAP[eventName] || eventName;
        h.onAny({ type, ...data });
      }
    }, []),
    onReconnect: onReconnect,
  });

  // Clear guard state on account switch
  useEffect(() => {
    clearState();
  }, [accountId, clearState]);

  return { seedRequestState, clearState };
}

export default useTradeWebSocket;
