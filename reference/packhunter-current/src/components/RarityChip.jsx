import { Box, Chip, useTheme } from '@mui/material'
import { RARITY_ICONS, RARITY_ICON_CDN, RARITY_DISPLAY, RARITY_COLORS_ACCESSIBLE } from '../constants/rarityConfig'
import { RARITY_COLORS } from '../constants/gameData'

/**
 * RarityIcon — renders rarity diamond/star/crown icons from CDN.
 *
 * Usage:
 *   <RarityIcon rarityCode="SR" size={16} />
 *   <RarityIcon rarityCode="UR" size={20} showLabel />
 */
export function RarityIcon({ rarityCode, size = 16, showLabel = false }) {
  const config = RARITY_ICONS[rarityCode]
  if (!config || !config.image) {
    return <span>{config?.label || rarityCode}</span>
  }

  const icons = []
  for (let i = 0; i < config.count; i++) {
    icons.push(
      <img
        key={i}
        src={`${RARITY_ICON_CDN}${config.image}`}
        alt=""
        style={{
          width: size,
          height: size,
          marginRight: i < config.count - 1 ? 2 : 0,
          verticalAlign: 'middle',
          filter: config.special ? 'hue-rotate(30deg) saturate(1.5)' : undefined,
        }}
      />
    )
  }

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {icons}
      {showLabel && <span style={{ marginLeft: 4 }}>{config.label}</span>}
    </Box>
  )
}

/**
 * RarityChip — compact chip showing rarity icon(s) + label with color coding.
 *
 * Usage:
 *   <RarityChip rarityCode="SR" />
 *   <RarityChip rarityCode="UR" size="small" showLabel />
 */
export default function RarityChip({ rarityCode, size = 'small', showLabel = true, sx, ...props }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const baseColor = RARITY_COLORS[rarityCode] || '#888'
  const accessibleColors = RARITY_COLORS_ACCESSIBLE[rarityCode]
  // Use accessible variant for text color (passes WCAG 4.5:1 on both themes)
  const textColor = accessibleColors ? (isDark ? accessibleColors.dark : accessibleColors.light) : baseColor
  const label = RARITY_DISPLAY[rarityCode] || rarityCode

  return (
    <Chip
      size={size}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RarityIcon rarityCode={rarityCode} size={12} />
          {showLabel && <span>{label}</span>}
        </Box>
      }
      sx={{
        bgcolor: `${baseColor}18`,
        color: textColor,
        border: `1px solid ${baseColor}30`,
        fontWeight: 600,
        fontSize: '0.6875rem',
        ...sx,
      }}
      {...props}
    />
  )
}
