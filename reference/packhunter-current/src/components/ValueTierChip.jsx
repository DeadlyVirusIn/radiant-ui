import { Chip, Tooltip, useTheme } from '@mui/material'
import { computeValueTier, tierPalette, tierDisplay } from '../utils/valueTier'

/**
 * Phase 5.10 — Compact tier chip used on Dashboard godpack rows,
 * Smart Clear friend rows, and any future surface that wants the
 * same value signal Discord embeds emit.
 *
 * Props:
 *   - cards: card array (preferred) — chip computes tier itself.
 *   - tier  / label: pre-computed (skip when caller already has them).
 *   - size:    'small' (default) | 'tiny'  ('tiny' = h: 18, smaller font)
 *   - showLabel: when false renders `[Ultra]`-only badge (Dashboard
 *                density mode); default true emits `[Ultra] 5/5 High-Tier Pack`.
 *
 * Visual rules (Phase 5.10 spec):
 *   ultra  → gold     (warning palette)
 *   high   → purple   (secondary palette)
 *   strong → blue     (info palette)
 *   normal → gray     (text.disabled)
 *
 * Returns null when cards is empty AND no pre-computed tier — the
 * chip should never render a misleading "Strong Pull" label on a
 * row that has no card data yet.
 */
export default function ValueTierChip({
  cards = null,
  tier  = null,
  label = null,
  size  = 'small',
  showLabel = true,
  sx,
  ...props
}) {
  const theme = useTheme()

  let resolvedTier  = tier
  let resolvedLabel = label
  if ((!resolvedTier || !resolvedLabel) && Array.isArray(cards) && cards.length > 0) {
    const r = computeValueTier(cards)
    resolvedTier  = resolvedTier  || r.tier
    resolvedLabel = resolvedLabel || r.label
  }
  if (!resolvedTier || !resolvedLabel) return null

  const palette = tierPalette(resolvedTier)
  const display = tierDisplay(resolvedTier)
  const paletteColor = palette === 'default'
    ? theme.palette.text.disabled
    : (theme.palette[palette]?.main || theme.palette.text.disabled)

  const text = showLabel ? `${display} · ${resolvedLabel}` : display
  const tooltip = showLabel ? null : resolvedLabel

  const heightToken = size === 'tiny' ? 18 : 22
  const fontSize   = size === 'tiny' ? '0.6rem' : '0.65rem'

  const chipTokens   = theme.custom?.chip   || { fontWeight: 700, fontSize }
  const radiusTokens = theme.custom?.radius || { sm: 8 }

  const chip = (
    <Chip
      label={text}
      size="small"
      sx={{
        height: heightToken,
        fontSize: chipTokens.fontSize || fontSize,
        fontWeight: chipTokens.fontWeight || 700,
        textTransform: 'none',
        borderRadius: `${radiusTokens.sm}px`,
        bgcolor: `${paletteColor}18`,
        color: paletteColor,
        border: `1px solid ${paletteColor}40`,
        ...sx,
      }}
      {...props}
    />
  )

  return tooltip ? <Tooltip title={tooltip} arrow>{chip}</Tooltip> : chip
}
