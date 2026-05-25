/**
 * Phase 4.6 (Apr 2026) — global style overrides.
 *
 * Returns a MUI <GlobalStyles> styles object usable like:
 *
 *   import GlobalStyles from '@mui/material/GlobalStyles';
 *   import { buildGlobalStyles } from '../theme/globalStyles';
 *   ...
 *   <GlobalStyles styles={buildGlobalStyles(theme)} />
 *
 * Scope (intentionally narrow — does NOT touch body background, which
 * is set imperatively in ThemeContext to avoid theme-toggle flash):
 *
 *   * Custom scrollbar styling for desktop (touch devices keep native).
 *   * Visible keyboard focus ring honoring the active theme.
 *   * Themed text-selection highlight.
 *   * `.text-mono` utility for the shared mono font family.
 *
 * Why these and not more: each rule above is purely additive and has
 * zero collision risk with existing inline `sx={...}` overrides. Body
 * background, layout heights, and mobile-nav offsets are owned by
 * cssBaselineOverrides in ThemeContext.jsx — see comments there.
 */

import { designTokens } from './designTokens';

/**
 * @param {import('@mui/material/styles').Theme} theme
 * @returns {object} MUI <GlobalStyles> styles
 */
export function buildGlobalStyles(theme) {
  const isDark        = theme.palette.mode === 'dark';
  const focusRing     = isDark ? 'rgba(124, 138, 255, 0.55)' : 'rgba(92, 106, 196, 0.55)';
  const selectionBg   = isDark ? 'rgba(124, 138, 255, 0.30)' : 'rgba(92, 106, 196, 0.20)';
  const selectionFg   = isDark ? '#ffffff' : '#1E293B';
  const scrollThumb   = isDark ? 'rgba(124, 138, 255, 0.25)' : 'rgba(92, 106, 196, 0.25)';
  const scrollHover   = isDark ? 'rgba(124, 138, 255, 0.40)' : 'rgba(92, 106, 196, 0.40)';

  return {
    // Desktop scrollbars only — keep iOS / touch native to avoid the
    // 6px-thumb-on-mobile look that competitors have but feels off in
    // a content-dense WebUI.
    '@media (hover: hover)': {
      '*::-webkit-scrollbar': {
        width:  '10px',
        height: '10px',
      },
      '*::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '*::-webkit-scrollbar-thumb': {
        background: scrollThumb,
        borderRadius: `${designTokens.radius.xs}px`,
        transition: designTokens.transitions.fast,
      },
      '*::-webkit-scrollbar-thumb:hover': {
        background: scrollHover,
      },
    },

    // Keyboard focus — only for keyboard navigation (a11y best practice).
    // MUI handles the FocusRing for inputs/buttons; this catches the rest.
    '*:focus-visible': {
      outline: `2px solid ${focusRing}`,
      outlineOffset: '2px',
      borderRadius: `${designTokens.radius.sm}px`,
    },

    // Themed selection highlight.
    '::selection': {
      backgroundColor: selectionBg,
      color: selectionFg,
    },

    // Utility class for inline mono text — saves dragging
    // `theme.custom.monoFontFamily` through every `sx` prop.
    '.text-mono': {
      fontFamily: theme.custom?.monoFontFamily,
      letterSpacing: '0.01em',
    },

    // Phase 4.8 — interactive-card hover/press contract. Apply via
    // className="interactive-card" on any clickable card surface
    // (Godpack, Dashboard tiles, Wonderpick rows). Tokens come from
    // theme.custom.motion.{cardLift,cardPress}.
    '.interactive-card': {
      transition:
        `transform ${theme.custom?.motion?.cardLift || '180ms ease-out'}, ` +
        `box-shadow ${theme.custom?.motion?.cardLift || '180ms ease-out'}`,
      willChange: 'transform',
    },
    '.interactive-card:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.custom?.shadows?.md
        || '0 2px 12px rgba(0, 0, 0, 0.06)',
    },
    '.interactive-card:active': {
      transform: 'translateY(0)',
      transition: `transform ${theme.custom?.motion?.cardPress || '80ms ease-out'}`,
    },

    // Phase 4.8 — image-fade-in on first paint so card art doesn't
    // pop in jarringly when proxied through cards.js handler.
    '@keyframes b3-fade-in': {
      from: { opacity: 0 },
      to:   { opacity: 1 },
    },
    '.image-fade-in': {
      animation: `b3-fade-in ${theme.custom?.motion?.imageFadeIn || '120ms ease-out'}`,
    },

    // Phase 4.8 — accessibility. Honor prefers-reduced-motion: kill
    // ALL transitions/animations app-wide. This single rule trumps any
    // inline `sx={{ transition: ... }}` because `* !important` wins
    // CSS specificity. Loading spinners still spin (we don't touch
    // the MUI CircularProgress keyframe inside this scope) — only
    // decorative motion is suppressed.
    '@media (prefers-reduced-motion: reduce)': {
      '*, *::before, *::after': {
        animationDuration: '0.001ms !important',
        animationIterationCount: '1 !important',
        transitionDuration: '0.001ms !important',
        scrollBehavior: 'auto !important',
      },
    },
  };
}

export default buildGlobalStyles;
