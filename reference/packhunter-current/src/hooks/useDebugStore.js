/**
 * useDebugStore — React hook to subscribe to debugBridge state changes.
 *
 * Triggers re-render when debug events arrive. Provides filtered views.
 * Activation: Ctrl+Shift+D or ?debug=1 URL param. Persists to sessionStorage.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, clearAll } from '../utils/debugBridge';

const DEBUG_KEY = 'vudoo_debug';

// Stable empty snapshot — same reference every time to prevent re-renders
const EMPTY_SNAPSHOT = Object.freeze({
  events: [],
  errors: [],
  rejections: [],
  lifecycle: new Map(),
});

// No-op subscribe for inactive mode — never triggers re-render
const NOOP_SUBSCRIBE = () => () => {};
const EMPTY_GET = () => EMPTY_SNAPSHOT;

/**
 * Check if debug mode is active.
 */
function isDebugActive() {
  try {
    if (sessionStorage.getItem(DEBUG_KEY) === '1') return true;
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      sessionStorage.setItem(DEBUG_KEY, '1');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Hook to manage debug mode toggle.
 */
export function useDebugMode() {
  const [active, setActive] = useState(isDebugActive);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setActive(prev => {
          const next = !prev;
          try {
            if (next) {
              sessionStorage.setItem(DEBUG_KEY, '1');
            } else {
              sessionStorage.removeItem(DEBUG_KEY);
            }
          } catch { /* ignore */ }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { active, setActive };
}

/**
 * Hook to subscribe to debug bridge data.
 * When inactive: uses no-op subscriber + frozen empty snapshot.
 * Zero re-renders, zero GC pressure when debug is off.
 */
export function useDebugData(active) {
  return useSyncExternalStore(
    active ? subscribe : NOOP_SUBSCRIBE,
    active ? getSnapshot : EMPTY_GET,
    active ? getSnapshot : EMPTY_GET,
  );
}

/**
 * Filter events by selectedAccountId.
 */
export function filterByAccount(events, accountId) {
  if (!accountId) return events;
  const id = String(accountId);
  return events.filter(e => !e.accountId || String(e.accountId) === id);
}

export { clearAll };
