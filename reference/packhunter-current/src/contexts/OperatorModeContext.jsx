/**
 * OperatorModeContext — 2026-04-20 Phase 4B.
 *
 * UI-ONLY toggle that lets an admin hide the "Platform" tier of the
 * sidebar (Users / Observability / Audit Log / Activity Logs) so the
 * dense admin surface collapses to just "Operations" + "Integrity"
 * for day-to-day incident triage.
 *
 * No auth change, no role change, no server call. Everything lives
 * in localStorage under the key `operator-mode` (`'1'` | `'0'`).
 * Flipping the toggle is instant + reversible.
 *
 * Usage:
 *   // wrap once at app root (main.jsx):
 *   <OperatorModeProvider>{children}</OperatorModeProvider>
 *
 *   // anywhere in the tree:
 *   const { operatorMode, toggleOperatorMode } = useOperatorMode();
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'operator-mode';

// Safe localStorage read — returns `false` in environments without
// a window (SSR / tests) and on any parse failure.
function readInitial() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch { return false; }
}

const OperatorModeContext = createContext({
  operatorMode: false,
  toggleOperatorMode: () => {},
  setOperatorMode: () => {},
});

export function OperatorModeProvider({ children }) {
  const [operatorMode, setMode] = useState(readInitial);

  const setOperatorMode = useCallback((next) => {
    const v = !!next;
    setMode(v);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
      }
    } catch { /* swallow — UI still updates via setState */ }
  }, []);

  const toggleOperatorMode = useCallback(() => {
    setOperatorMode(!operatorMode);
  }, [operatorMode, setOperatorMode]);

  // Cross-tab sync: listen for storage events so flipping the toggle
  // in one tab flips it in all of them. Pure UI nicety; optional.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY) return;
      setMode(e.newValue === '1');
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return undefined;
  }, []);

  return (
    <OperatorModeContext.Provider value={{ operatorMode, toggleOperatorMode, setOperatorMode }}>
      {children}
    </OperatorModeContext.Provider>
  );
}

export function useOperatorMode() {
  return useContext(OperatorModeContext);
}

export default OperatorModeContext;
