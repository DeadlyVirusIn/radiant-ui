/**
 * Phase 24 Part 2 — Physical mobile-device detection.
 *
 * Problem: relying on `useMediaQuery(theme.breakpoints.down('md'))`
 * alone breaks for:
 *   - tablets that report lg viewports
 *   - phones in "Request Desktop Site" mode (viewport lies)
 *   - PWAs with desktop-like internal viewports
 *
 * Solution: combine THREE signals so any one of them can prove the
 * device is physically mobile:
 *   1. narrow physical viewport      — `(max-width: 900px)` (absolute
 *                                      pixel check, independent of MUI
 *                                      theme breakpoints)
 *   2. coarse pointer                — `(pointer: coarse)` → finger
 *                                      (not mouse) is the primary input
 *   3. touch capability              — `navigator.maxTouchPoints > 0`
 *                                      OR 'ontouchstart' in window
 *
 * ANY truthy signal = mobile. This is deliberately aggressive: a user
 * with a touchscreen laptop in a desktop browser gets mobile nav, which
 * is the correct call (touch ergonomics > mouse ergonomics for touch
 * input). Desktop-mouse users with hover:hover + fine pointer + wide
 * viewport still get the desktop sidebar.
 *
 * Returns: boolean. Stable across re-renders (MUI's useMediaQuery
 * subscribes to the media query list; touch capability is stable per
 * device).
 */

import { useMediaQuery } from '@mui/material';

export default function useIsMobileDevice() {
  // CSS media queries — MUI subscribes to changes automatically.
  const narrowPhysical = useMediaQuery('(max-width: 900px)');
  const coarsePointer  = useMediaQuery('(pointer: coarse)');

  // Touch capability — static per device, safe to read once.
  const hasTouch =
    typeof window !== 'undefined' &&
    (
      (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0) ||
      ('ontouchstart' in window)
    );

  return narrowPhysical || coarsePointer || hasTouch;
}
