import { Box, Typography, Divider, Tooltip, useTheme } from '@mui/material'

/**
 * MetricStrip — horizontal row of labeled metrics with dividers.
 *
 * Each item supports:
 *   - label: string (required)
 *   - value: string|number (required)
 *   - color: MUI color token (optional, e.g. 'success.main')
 *   - trend: { direction: 'up'|'down'|'flat', delta: string } (optional)
 *   - tooltip: string (optional — detail text shown on hover)
 *
 * Usage:
 *   <MetricStrip
 *     items={[
 *       { label: 'Total', value: '1,234', color: 'primary.main' },
 *       { label: 'Rate', value: '78%', color: 'success.main', trend: { direction: 'up', delta: '+3%' }, tooltip: '62/80 completed' },
 *     ]}
 *   />
 */

const TREND_CONFIG = {
  up:   { arrow: '↑', color: 'success.main' },
  down: { arrow: '↓', color: 'error.main' },
  flat: { arrow: '', color: 'text.disabled' },
}

export default function MetricStrip({ items = [], sx }) {
  const theme = useTheme()
  const g = theme.custom.glass

  if (!items.length) return null

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: { xs: 1.5, sm: 0 },
        p: { xs: 1.5, sm: 2 },
        borderRadius: `${theme.custom.radius.lg}px`,
        border: `1px solid ${g.border}`,
        bgcolor: g.cardBg,
        ...sx,
      }}
    >
      {items.map((item, i) => {
        const trend = item.trend && TREND_CONFIG[item.trend.direction]

        const valueContent = (
          <Box sx={{ textAlign: 'center', px: { xs: 1, sm: 2 } }}>
            <Typography
              variant="caption2"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                mb: 0.25,
                fontSize: theme.typography.caption2?.fontSize || '0.6875rem',
              }}
            >
              {item.label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: item.color || 'text.primary',
                  fontFamily: theme.custom.monoFontFamily,
                  lineHeight: 1.2,
                }}
              >
                {item.value}
              </Typography>
              {trend && trend.arrow && (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '1px',
                    bgcolor: `${trend.color}`,
                    color: '#fff',
                    borderRadius: '4px',
                    px: 0.5,
                    py: '1px',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    opacity: 0.9,
                  }}
                >
                  {trend.arrow}{item.trend.delta || ''}
                </Box>
              )}
            </Box>
          </Box>
        )

        return (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <Divider
                orientation="vertical"
                flexItem
                sx={{
                  mx: { xs: 0, sm: 2 },
                  display: { xs: 'none', sm: 'block' },
                  borderColor: g.border,
                }}
              />
            )}
            {item.tooltip ? (
              <Tooltip title={item.tooltip} arrow placement="top">
                {valueContent}
              </Tooltip>
            ) : (
              valueContent
            )}
          </Box>
        )
      })}
    </Box>
  )
}
