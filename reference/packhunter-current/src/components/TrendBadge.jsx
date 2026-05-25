import { memo } from 'react'
import { Box, Typography } from '@mui/material'
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material'

/**
 * TrendBadge — Small colored chip showing "+12%" or "-3%" with arrow.
 */
const TrendBadge = memo(({ value, direction }) => {
  const dir = direction || (value > 0 ? 'up' : value < 0 ? 'down' : 'flat')
  const color = dir === 'up' ? '#10B981' : dir === 'down' ? '#EF4444' : '#94A3B8'
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : TrendingFlat
  const sign = value > 0 ? '+' : ''

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        px: 0.75,
        py: 0.15,
        borderRadius: '6px',
        bgcolor: `${color}18`,
      }}
    >
      <Icon sx={{ fontSize: 13, color }} />
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color, lineHeight: 1 }}>
        {sign}{Math.abs(value ?? 0)}%
      </Typography>
    </Box>
  )
})

TrendBadge.displayName = 'TrendBadge'

export default TrendBadge
