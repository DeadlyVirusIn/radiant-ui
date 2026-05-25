/**
 * Phase 4.8 (Apr 2026) — Snackbar styling/timing/position contract.
 *
 * Option-B approach: NO new global toast system. Pages keep their
 * existing local <Snackbar> + setSnack({message, severity}) pattern.
 * This file just hands them a uniform set of props so every snackbar
 * across the app feels like the same product:
 *
 *   - mobile (xs):  anchored top-center to avoid the fixed
 *                   MobileBottomNav (--mobile-nav-offset).
 *   - desktop:      bottom-left to stay out of the way of right-rail
 *                   panels.
 *   - duration:     1400ms for success/info, 2400ms for error/warning
 *                   (per Phase 4.8 spec: 1200-1600ms quick feedback).
 *   - severity sx:  subtle border + shadow tinted to the severity
 *                   color so the toast feels weighted, not popcorn.
 *
 * Usage at call site:
 *
 *     import { getSnackbarProps, getAlertSx } from '../utils/snackbarConfig';
 *     ...
 *     <Snackbar
 *       open={!!snack}
 *       onClose={() => setSnack(null)}
 *       {...getSnackbarProps({ severity: snack?.severity, isMobile })}
 *     >
 *       <Alert severity={snack?.severity || 'info'} sx={getAlertSx(theme)}>
 *         {snack?.message}
 *       </Alert>
 *     </Snackbar>
 *
 * Pages that need a different position/duration can override individual
 * props after the spread — this is a config helper, not a constraint.
 *
 * Identical-message debounce is a per-call-site concern (each page
 * already has its own setSnack); we don't centralize it here because
 * different surfaces have different opinions about whether re-fired
 * messages should show again (e.g. a re-clicked Copy IS a new event
 * in the gallery, but a duplicate "save failed" SHOULD be suppressed
 * in the admin form). Keep it local.
 */

// Phase 4.8 — duration tokens. All within the 1200-1600ms target for
// "instant" feedback, with errors held a bit longer so the operator can
// read what went wrong before it disappears.
const DURATION_QUICK = 1400;   // success / info — short ack
const DURATION_LONG  = 2400;   // warning / error — needs a beat to read

/**
 * @param {object} options
 * @param {'success'|'info'|'warning'|'error'} [options.severity]
 * @param {boolean} [options.isMobile]
 * @returns {object} props to spread onto MUI <Snackbar>
 */
export function getSnackbarProps({ severity = 'info', isMobile = false } = {}) {
  const isCritical = severity === 'warning' || severity === 'error';
  return {
    autoHideDuration: isCritical ? DURATION_LONG : DURATION_QUICK,
    anchorOrigin: {
      vertical:   isMobile ? 'top'    : 'bottom',
      horizontal: isMobile ? 'center' : 'left',
    },
    // Lift toast above the bottom-nav offset on mobile (top-anchored
    // already, but if a future page uses bottom on mobile they should
    // honor the safe area). Desktop keeps default 24px gutter.
    sx: {
      // CSS variable defined by the app shell (see ThemeContext.jsx).
      // Falls back to 0px if the nav isn't mounted.
      bottom: isMobile ? undefined : 'calc(var(--mobile-nav-offset, 0px) + 24px) !important',
    },
  };
}

/**
 * Themed Alert sx. Subtle severity-tinted border + soft shadow so the
 * toast reads as "system-quality" rather than browser-default plain.
 *
 * @param {import('@mui/material/styles').Theme} theme
 * @returns {object} sx prop for MUI <Alert>
 */
export function getAlertSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    width: '100%',
    minWidth: { xs: 'auto', sm: 280 },
    maxWidth: 420,
    borderRadius: theme.custom?.radius?.md
      ? `${theme.custom.radius.md}px`
      : 12,
    fontWeight: 500,
    fontSize: '0.85rem',
    lineHeight: 1.4,
    boxShadow: isDark
      ? '0 8px 24px rgba(0, 0, 0, 0.5)'
      : '0 8px 24px rgba(0, 0, 0, 0.12)',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.18)' : 'rgba(0, 0, 0, 0.06)'}`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    // Severity color is set by MUI <Alert severity={…}> automatically;
    // we only nudge the icon/border weight here.
    '& .MuiAlert-icon': { fontSize: '1.1rem' },
  };
}

// Exposed for tests + future per-page overrides that want named values.
export const SNACKBAR_DURATIONS = {
  quick: DURATION_QUICK,
  long:  DURATION_LONG,
};

export default getSnackbarProps;
