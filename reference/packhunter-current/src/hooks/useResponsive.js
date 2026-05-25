/**
 * useResponsive — Wave 10 canonical breakpoint hook.
 *
 * Replaces the per-page mix of:
 *   useMediaQuery(theme.breakpoints.down('sm'))   // some pages
 *   useMediaQuery(theme.breakpoints.down('md'))   // other pages
 *   useMediaQuery(theme.breakpoints.between(...)) // App.jsx only
 *
 * with one consistent 3-tier model that matches the design intent:
 *
 *   isPhone   — viewport < 600px           (MUI 'sm' boundary)
 *   isTablet  — 600px ≤ viewport < 960px   (between 'sm' and 'md')
 *   isDesktop — viewport ≥ 960px           (MUI 'md' and up)
 *
 * Convenience flags layered on top:
 *   isCompact = isPhone || isTablet  (anything that should NOT show
 *                                     the desktop sidebar / 3-col layout)
 *   isWide    = !isCompact           (everything ≥ md)
 *
 * Why these specific cuts:
 *   - 600px (sm) is where MUI considers it "small" — phones in landscape,
 *     small tablets in portrait. Single-column layouts are required.
 *   - 960px (md) is where the persistent sidebar fits comfortably. Below
 *     it, the sidebar collapses to a Drawer.
 *
 * Pages should ALWAYS prefer this hook over raw useMediaQuery so the
 * breakpoint definition lives in exactly one place. If the design system
 * decides to move the boundary later, only this file changes.
 */

import { useMediaQuery, useTheme } from '@mui/material';

export function useResponsive() {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));        // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600-959px
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));        // >= 960px

  return {
    isPhone,
    isTablet,
    isDesktop,
    isCompact: isPhone || isTablet,
    isWide: isDesktop,
  };
}

// Pure helpers (no React) for tests + non-component callers
export const BREAKPOINTS = {
  PHONE_MAX: 599,    // < 600px is phone
  TABLET_MAX: 959,   // 600-959 is tablet
  DESKTOP_MIN: 960,  // ≥ 960 is desktop
};

export function classifyWidth(widthPx) {
  if (widthPx <= BREAKPOINTS.PHONE_MAX) return 'phone';
  if (widthPx <= BREAKPOINTS.TABLET_MAX) return 'tablet';
  return 'desktop';
}

export default useResponsive;
