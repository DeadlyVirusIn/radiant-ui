/**
 * Phase 25D — OverlayContext.
 *
 * Coordinates which overlay (hamburger sidebar drawer, notifications
 * drawer, future ones) is currently open so two side-drawers can't
 * sit visible simultaneously on a narrow mobile viewport.
 *
 * Contract:
 *   - At most ONE named overlay is open at a time.
 *   - Opening overlay B while A is open auto-closes A.
 *   - Closing propagates through the context so subscribers update.
 *
 * Consumers call `useOverlay(name)` to get { isOpen, open, close }
 * — the `name` is an arbitrary string identifier ('sidebar',
 * 'notifications', …). Component-local state remains the same shape
 * as before; only the source-of-truth moved to this context.
 *
 * For components that already own a local useState toggle (like
 * App.jsx's `mobileOpen`), wrap them with <OverlayBridge/> rather
 * than refactor the component — it syncs in both directions.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const OverlayCtx = createContext({
  activeOverlay: null,
  openOverlay: () => {},
  closeOverlay: () => {},
});

export function OverlayProvider({ children }) {
  const [activeOverlay, setActiveOverlay] = useState(null);

  const openOverlay = useCallback((name) => {
    if (!name) return;
    setActiveOverlay(name);
  }, []);

  const closeOverlay = useCallback((name) => {
    // If `name` is passed, only close if it's the one currently open
    // (defensive — prevents a component that already transitioned
    // from stomping a sibling's newly-opened overlay).
    setActiveOverlay(prev => (!name || prev === name ? null : prev));
  }, []);

  const value = useMemo(
    () => ({ activeOverlay, openOverlay, closeOverlay }),
    [activeOverlay, openOverlay, closeOverlay]
  );

  return <OverlayCtx.Provider value={value}>{children}</OverlayCtx.Provider>;
}

/**
 * Hook for consumers. Returns `isOpen` (true iff this overlay is the
 * active one), `open()` and `close()` bound to the named overlay.
 */
export function useOverlay(name) {
  const ctx = useContext(OverlayCtx);
  const isOpen = ctx.activeOverlay === name;
  const open = useCallback(() => ctx.openOverlay(name), [ctx, name]);
  const close = useCallback(() => ctx.closeOverlay(name), [ctx, name]);
  return { isOpen, open, close, activeOverlay: ctx.activeOverlay };
}

/**
 * Bridges an existing boolean state to an overlay name. Use when a
 * component owns a useState-based drawer toggle (like App.jsx's
 * `mobileOpen` for the Sidebar) and you want OverlayContext to stay
 * in lockstep without refactoring the component.
 *
 * Usage:
 *   <OverlayBridge name="sidebar"
 *                  isOpen={mobileOpen}
 *                  onClose={() => setMobileOpen(false)} />
 *
 * Behavior:
 *   - Local → context: local open/close flips the named active overlay.
 *   - Context → local: if a DIFFERENT overlay becomes active while
 *     this one was locally open, call onClose() so the local state
 *     also closes — the two drawers can never coexist visibly.
 */
export function OverlayBridge({ name, isOpen, onClose }) {
  const ctx = useContext(OverlayCtx);
  const lastLocalRef = useRef(isOpen);

  // Local → context.
  useEffect(() => {
    if (isOpen && ctx.activeOverlay !== name) {
      ctx.openOverlay(name);
    } else if (!isOpen && ctx.activeOverlay === name) {
      ctx.closeOverlay(name);
    }
  }, [isOpen, ctx, name]);

  // Context → local.
  useEffect(() => {
    if (lastLocalRef.current && ctx.activeOverlay && ctx.activeOverlay !== name && typeof onClose === 'function') {
      onClose();
    }
    lastLocalRef.current = isOpen;
  }, [ctx.activeOverlay, name, onClose, isOpen]);

  return null;
}
