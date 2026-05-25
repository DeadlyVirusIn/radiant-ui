/**
 * Debug Bridge — connects socket guard layer to debug store.
 * Lightweight pub/sub: guard publishes events, DebugStrip subscribes.
 *
 * Ring buffer stores last 50 events, 20 errors, 30 guard rejections.
 * No React dependency — pure JS module usable from hooks and services.
 */

const MAX_EVENTS = 50;
const MAX_ERRORS = 20;
const MAX_REJECTIONS = 30;
const MAX_LIFECYCLE = 100; // per-request lifecycle entries

// Ring buffers
const _events = [];
const _errors = [];
const _rejections = [];
const _lifecycle = new Map(); // requestId -> [{ status, timestamp, source }]
const _listeners = new Set();

function _notify() {
  for (const fn of _listeners) {
    try { fn(); } catch { /* swallow */ }
  }
}

function _pushRing(arr, item, max) {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

// --- Public API ---

/**
 * Log a socket or API event.
 * @param {string} eventName - e.g. 'trade_request_matching'
 * @param {object} data - event payload
 * @param {'socket'|'api'} source - where the update came from
 */
export function logEvent(eventName, data, source = 'socket') {
  _pushRing(_events, {
    eventName,
    requestId: data?.requestId || null,
    accountId: data?.accountId || null,
    status: data?.status || null,
    source,
    receivedAt: new Date().toISOString(),
    serverTimestamp: data?.timestamp || null,
  }, MAX_EVENTS);
  _notify();
}

/**
 * Log a guard rejection (dedup, account mismatch, stale timestamp).
 */
export function logRejection(eventName, reason, data) {
  _pushRing(_rejections, {
    eventName,
    reason,
    requestId: data?.requestId || null,
    accountId: data?.accountId || null,
    status: data?.status || null,
    timestamp: new Date().toISOString(),
  }, MAX_REJECTIONS);
  _notify();
}

/**
 * Log an error (API failure, unexpected state).
 */
export function logError(source, message, data = {}) {
  _pushRing(_errors, {
    source,
    message,
    ...data,
    timestamp: new Date().toISOString(),
  }, MAX_ERRORS);
  _notify();
}

/**
 * Track request lifecycle step.
 * @param {string} requestId
 * @param {string} status
 * @param {'socket'|'api'} source
 */
export function trackLifecycle(requestId, status, source) {
  if (!requestId) return;
  if (!_lifecycle.has(requestId)) {
    _lifecycle.set(requestId, []);
  }
  const steps = _lifecycle.get(requestId);
  _pushRing(steps, {
    status,
    source,
    timestamp: new Date().toISOString(),
  }, 20); // max 20 steps per request

  // Prune old requests (keep last MAX_LIFECYCLE entries)
  if (_lifecycle.size > MAX_LIFECYCLE) {
    const oldest = _lifecycle.keys().next().value;
    _lifecycle.delete(oldest);
  }
  _notify();
}

/**
 * Subscribe to debug store changes. Returns unsubscribe function.
 */
export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Get current debug state snapshot (read-only).
 */
export function getSnapshot() {
  return {
    events: _events,
    errors: _errors,
    rejections: _rejections,
    lifecycle: _lifecycle,
  };
}

/**
 * Clear all debug data.
 */
export function clearAll() {
  _events.length = 0;
  _errors.length = 0;
  _rejections.length = 0;
  _lifecycle.clear();
  _notify();
}
