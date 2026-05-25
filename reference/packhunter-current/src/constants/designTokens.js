/**
 * Design Tokens — single source of truth for UI spacing, typography, colors, motion.
 *
 * All values in MUI spacing units (1 unit = 8px) unless noted.
 * Components should import from here instead of using arbitrary values.
 */

// Spacing (MUI units: 0.5=4px, 1=8px, 2=16px, 3=24px, 4=32px)
export const SPACING = {
  xs: 0.5,   // 4px — tight internal gaps
  sm: 1,     // 8px — between related elements
  md: 2,     // 16px — card padding, section gaps
  lg: 3,     // 24px — between sections
  xl: 4,     // 32px — page-level spacing
}

// Font sizes (rem)
export const FONT = {
  metric: '1.3rem',     // Large numbers/values
  metricWeight: 800,
  title: '0.8rem',      // Section headers
  titleWeight: 700,
  body: '0.78rem',      // Body text, descriptions
  label: '0.65rem',     // Labels, captions
  labelWeight: 600,
  meta: '0.6rem',       // Timestamps, IDs, micro text
  sectionHeader: '0.75rem',
}

// Status colors (consistent across all components)
export const STATUS = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  neutral: '#6b7280',
}

// Card styling
export const CARD = {
  padding: 2,
  borderRadius: '12px',
  gap: 1,
}

// Chip sizing — three tiers for consistent sizing across all pages
export const CHIP = {
  xs: { height: 18, fontSize: '0.55rem', fontWeight: 600 },
  sm: { height: 20, fontSize: '0.6rem', fontWeight: 600 },
  md: { height: 24, fontSize: '0.68rem', fontWeight: 600 },
  // Legacy (default = sm)
  height: 20,
  fontSize: '0.6rem',
  fontWeight: 600,
}

// Animation timing
export const MOTION = {
  hover: '120ms ease-out',
  expand: '200ms ease-out',
  pulse: '800ms ease-in-out',
  fadeIn: '150ms ease-out',
}

// Table
export const TABLE = {
  rowHeight: 42,
  headerFontSize: '0.7rem',
  cellFontSize: '0.72rem',
}

// Layer backgrounds (for dark/light mode)
export const LAYER = {
  dark: {
    base: 'transparent',
    card: 'rgba(255,255,255,0.03)',
    elevated: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.06)',
  },
  light: {
    base: 'transparent',
    card: 'rgba(0,0,0,0.02)',
    elevated: 'rgba(0,0,0,0.04)',
    border: 'rgba(0,0,0,0.06)',
  },
}

// Helper: get layer colors based on theme mode
export function getLayer(isDark) {
  return isDark ? LAYER.dark : LAYER.light
}
