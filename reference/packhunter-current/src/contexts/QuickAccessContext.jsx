/**
 * QuickAccessContext — 2026-04-20 Phase 5 → Phase 5.13 (Favorites).
 *
 * Tracks user-controlled pinned navigation paths in localStorage so
 * the sidebar can surface a "Favorites" section. Phase 5.13 dropped
 * the auto-tracked "Recent" section per the user-controlled design;
 * recent / visit are kept as backwards-compatible no-ops so any older
 * caller that imported the API doesn't crash.
 *
 *   pinned[] — user-controlled favourites (★ icon promotes, ✕ demotes)
 *              Max 5 entries (was 10; lowered in 5.13 for clarity).
 *
 * CONSERVATIVE SCOPE:
 *   - NEVER reorders the main sidebar
 *   - NEVER hides existing nav items
 *   - UI-only; zero backend touch
 *   - Entries persist in localStorage; Operator Mode hides Platform
 *     paths at render time but storage is untouched so flipping the
 *     toggle back restores the entries instantly
 *
 * Usage:
 *   <QuickAccessProvider>{children}</QuickAccessProvider>
 *   const { pinned, tryPin, pin, unpin, isPinned, MAX_PINNED } = useQuickAccess();
 *
 *   const result = tryPin(path, label);
 *   if (!result.ok && result.reason === 'max-cap') {
 *     // surface "You can pin up to 5 favorites…" snackbar
 *   }
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PINNED_KEY  = 'quick-access.pinned';
const MAX_PINNED  = 5;

// Phase 5.13 — kept for backward compatibility with any caller that
// still references the old constant. Recent tracking is removed from
// the UI; the storage key is no longer written but a stale value left
// over from a prior release is harmless (just unused).
const RECENT_KEY  = 'quick-access.recent';
const MAX_RECENT  = 0;

function readJSON(key) {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage && window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeJSON(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota / disabled — keep UI state only */ }
}

const QuickAccessContext = createContext({
  pinned: [],
  recent: [],
  tryPin: () => ({ ok: false, reason: 'no-provider' }),
  pin: () => {},
  unpin: () => {},
  isPinned: () => false,
  visit: () => {},
  MAX_PINNED,
  MAX_RECENT,
});

export function QuickAccessProvider({ children }) {
  const [pinned, setPinned] = useState(() => readJSON(PINNED_KEY).slice(0, MAX_PINNED));

  /**
   * Try to pin a path. Returns {ok: true} on success, or
   * {ok: false, reason: 'max-cap'|'invalid'|'duplicate'} on rejection
   * so the caller can surface a friendly message.
   */
  const tryPin = useCallback((path, label) => {
    if (!path || typeof path !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    let result = { ok: true };
    setPinned(prev => {
      if (prev.some(e => e.path === path)) {
        result = { ok: false, reason: 'duplicate' };
        return prev;
      }
      if (prev.length >= MAX_PINNED) {
        result = { ok: false, reason: 'max-cap' };
        return prev;
      }
      const next = [
        ...prev,
        { path, label: label || path, pinnedAt: Date.now() },
      ];
      writeJSON(PINNED_KEY, next);
      return next;
    });
    return result;
  }, []);

  // Backwards-compatible pin() — silently swallows max-cap so older
  // call sites don't break. Prefer tryPin() in new code.
  const pin = useCallback((path, label) => {
    tryPin(path, label);
  }, [tryPin]);

  const unpin = useCallback((path) => {
    if (!path) return;
    setPinned(prev => {
      const next = prev.filter(e => e.path !== path);
      writeJSON(PINNED_KEY, next);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (path) => !!path && pinned.some(e => e.path === path),
    [pinned]
  );

  // Phase 5.13 — recent / visit removed from the UI. visit() stays as
  // a no-op so any older caller (or third-party plugin we don't
  // control) doesn't throw.
  const visit = useCallback(() => {}, []);

  // Cross-tab sync — if another tab pins/unpins, stay consistent.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === PINNED_KEY) setPinned(readJSON(PINNED_KEY).slice(0, MAX_PINNED));
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return undefined;
  }, []);

  return (
    <QuickAccessContext.Provider
      value={{
        pinned,
        recent: [],          // Phase 5.13 — always empty; UI no longer surfaces Recent
        tryPin,
        pin,
        unpin,
        isPinned,
        visit,
        MAX_PINNED,
        MAX_RECENT,
      }}
    >
      {children}
    </QuickAccessContext.Provider>
  );
}

export function useQuickAccess() {
  return useContext(QuickAccessContext);
}

export default QuickAccessContext;
