/**
 * Phase 4.6 (Apr 2026) — extracted design tokens.
 *
 * Single source of truth for radius, shadows, transitions, spacing,
 * status colors, motion timings, font sizes, chip/table dimensions.
 *
 * Imported by:
 *   - webui/client/src/contexts/ThemeContext.jsx (injects into MUI
 *     theme.custom.* for both light + dark themes)
 *   - components that want raw token access without going through
 *     the MUI theme (e.g. plain CSS-in-JS, ad-hoc overlays)
 *
 * History: previously inline in ThemeContext.jsx. Extracted so that
 * (a) tests can import tokens directly, (b) non-React utilities can
 * reuse the same values, (c) we have one file to grep when adjusting
 * the design language. The orphan webui/client/src/theme/index.js
 * (deleted Apr 19 2026) was a CAUTIONARY tale — verify imports after
 * adding new files in this folder.
 */

export const monoFontFamily = '"Fira Code", "Roboto Mono", "Courier New", monospace';

export const typographyScale = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1:       { fontWeight: 800, fontSize: '3rem',     lineHeight: 1.1,  letterSpacing: '-0.025em' },
  h2:       { fontWeight: 800, fontSize: '2.25rem',  lineHeight: 1.15, letterSpacing: '-0.02em' },
  h3:       { fontWeight: 700, fontSize: '1.75rem',  lineHeight: 1.2,  letterSpacing: '-0.015em' },
  h4:       { fontWeight: 700, fontSize: '1.5rem',   lineHeight: 1.25, letterSpacing: '-0.01em' },
  h5:       { fontWeight: 700, fontSize: '1.25rem',  lineHeight: 1.3,  letterSpacing: '-0.01em' },
  h6:       { fontWeight: 600, fontSize: '1rem',     lineHeight: 1.4 },
  subtitle1:{ fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '0.01em' },
  subtitle2:{ fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '0.06em', textTransform: 'uppercase' },
  body1:    { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2:    { fontSize: '0.8125rem', lineHeight: 1.5 },
  caption:  { fontSize: '0.75rem',   lineHeight: 1.4, fontWeight: 500 },
  caption2: { fontSize: '0.6875rem', lineHeight: 1.5, fontWeight: 500 },
  micro:    { fontSize: '0.625rem',  lineHeight: 1.4, fontWeight: 500, letterSpacing: '0.02em' },
  overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.6 },
};

export const designTokens = {
  radius: {
    xs:   4,    // pills, scrollbar thumbs
    sm:   8,    // chips, tooltips, small buttons
    md:   12,   // default shape (Paper, Alert, cards, inputs)
    lg:   16,   // GlassCard, prominent cards, section containers
    xl:   24,   // large pill shapes
    full: 9999, // circles, avatar badges
  },
  shadows: {
    sm:    '0 1px 3px rgba(0, 0, 0, 0.08)',
    md:    '0 2px 12px rgba(0, 0, 0, 0.06)',
    lg:    '0 4px 24px rgba(0, 0, 0, 0.2)',
    xl:    '0 8px 32px rgba(0, 0, 0, 0.3)',
    glow:  (color, alpha = '33') => `0 4px 14px ${color}${alpha}`,
    inset: '0 1px 0 rgba(255, 255, 255, 0.03)',
    up:    '0 -4px 20px rgba(0, 0, 0, 0.1)',
  },
  blur: { sm: 8, md: 12, lg: 16 },
  transitions: {
    fast:   '0.15s ease',
    normal: '0.2s ease',
    medium: '0.25s ease',
    slow:   '0.3s ease',
    pageIn: '0.35s ease',
  },
  spacing: {
    section: 3,    // between major page sections (24px)
    card:    2.5,  // card internal padding (20px)
    element: 2,    // between related elements (16px)
    tight:   1.5,  // compact spacing (12px)
    inline:  1,    // inline element gap (8px)
    micro:   0.5,  // minimal gap (4px)
  },
  // Phase 1-9 tokens (status, motion, typography, table)
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error:   '#ef4444',
    info:    '#3b82f6',
    neutral: '#6b7280',
  },
  motion: {
    hover:  '120ms ease-out',
    expand: '200ms ease-out',
    pulse:  '800ms ease-in-out',
    fadeIn: '150ms ease-out',
    // Phase 4.8 — modal/card motion tokens. Hold under 200ms per
    // delight-pack contract so even back-to-back interactions never
    // feel laggy. Card lift uses a 2px translate; image fade-in is
    // 120ms so cards feel "alive" but not popcorn.
    cardLift:    '180ms ease-out',
    cardPress:   '80ms ease-out',
    modalIn:     '180ms cubic-bezier(0.2, 0, 0, 1)',
    modalOut:    '140ms cubic-bezier(0.4, 0, 1, 1)',
    imageFadeIn: '120ms ease-out',
  },
  font: {
    metric:        '1.3rem',
    metricWeight:  800,
    title:         '0.8rem',
    titleWeight:   700,
    body:          '0.78rem',
    label:         '0.65rem',
    labelWeight:   600,
    meta:          '0.6rem',
    sectionHeader: '0.75rem',
  },
  chip:  { height: 20, fontSize: '0.6rem',  fontWeight: 600 },
  table: { rowHeight: 42, headerFontSize: '0.7rem', cellFontSize: '0.72rem' },
  // Phase 4.6 — brand accents that aren't part of the MUI palette but
  // appear repeatedly in feature-specific surfaces (godpack = gold).
  // Anything touching these should import from designTokens, not
  // hardcode the hex inline.
  brand: {
    gold:     '#ffd700',                                                // godpack premium accent
    goldDeep: '#ff8c00',                                                // godpack gradient companion (orange end)
    goldGlow: (alpha = 0.33) => `rgba(255, 215, 0, ${alpha})`,          // shadows / overlays
    goldGradient: 'linear-gradient(90deg, #ffd700 0%, #ff8c00 100%)',   // header strip / pills
  },
};

// ── Theme-specific glass/glow tokens ─────────────────────────────────
// Stay in this file too so dark/light surface treatments live next to
// the tokens that compose with them.

export const lightGlass = {
  bg:     'rgba(255, 255, 255, 0.8)',
  border: 'rgba(0, 0, 0, 0.06)',
  cardBg: 'rgba(0, 0, 0, 0.01)',
  glow: {
    '06': 'rgba(92, 106, 196, 0.06)',
    '08': 'rgba(92, 106, 196, 0.08)',
    '10': 'rgba(92, 106, 196, 0.10)',
    '12': 'rgba(92, 106, 196, 0.12)',
    '15': 'rgba(92, 106, 196, 0.15)',
    '20': 'rgba(92, 106, 196, 0.20)',
    '30': 'rgba(92, 106, 196, 0.30)',
  },
  tableHead: 'rgba(0, 0, 0, 0.04)',
  rowHover:  'rgba(0, 0, 0, 0.03)',
};

export const darkGlass = {
  bg:     'rgba(26, 32, 53, 0.7)',
  border: 'rgba(124, 138, 255, 0.08)',
  cardBg: 'rgba(255, 255, 255, 0.02)',
  glow: {
    '06': 'rgba(124, 138, 255, 0.06)',
    '08': 'rgba(124, 138, 255, 0.08)',
    '10': 'rgba(124, 138, 255, 0.10)',
    '12': 'rgba(124, 138, 255, 0.12)',
    '15': 'rgba(124, 138, 255, 0.15)',
    '20': 'rgba(124, 138, 255, 0.20)',
    '30': 'rgba(124, 138, 255, 0.30)',
  },
  tableHead: 'rgba(124, 138, 255, 0.06)',
  rowHover:  'rgba(255, 255, 255, 0.04)',
};

export default designTokens;
