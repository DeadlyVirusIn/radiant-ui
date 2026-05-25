import { memo, isValidElement } from 'react'
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material'
import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { CountUp } from './Animations'
import TrendBadge from './TrendBadge'
import { tabularNumStyle } from '../utils/formatNumber'

const resolveColor = (color, theme) => {
  if (!color) return theme.palette.primary.main
  if (color.startsWith('#') || color.startsWith('rgb')) return color
  const palette = theme.palette[color]
  return palette?.main || color
}

const sizeConfig = {
  lg: { fontSize: '2.8rem', labelSize: '0.85rem', sparkHeight: 44, padding: 2.5 },
  md: { fontSize: '2rem', labelSize: '0.8rem', sparkHeight: 36, padding: 2 },
  sm: { fontSize: '1.5rem', labelSize: '0.75rem', sparkHeight: 0, padding: 1.5 },
}

const MetricCard = memo(({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection,
  sparklineData,
  color = 'primary',
  size = 'md',
  onClick,
  subValue,
}) => {
  const theme = useTheme()
  const resolved = resolveColor(color, theme)
  const isDark = theme.palette.mode === 'dark'
  const cfg = sizeConfig[size] || sizeConfig.md

  const renderIcon = () => {
    if (!Icon) return null
    if (isValidElement(Icon)) {
      return <Box sx={{ color: '#fff', '& svg': { fontSize: 20 } }}>{Icon}</Box>
    }
    return <Icon sx={{ fontSize: 20, color: '#fff' }} />
  }

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02, y: -3 } : { y: -2 }}
      transition={{ duration: 0.2 }}
      style={{ height: '100%' }}
    >
      <Card
        onClick={onClick}
        {...(onClick ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': `${label}: ${value}`,
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } },
        } : {})}
        sx={{
          height: '100%',
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'box-shadow 0.3s ease',
          '&:hover': onClick ? { boxShadow: `0 8px 32px ${resolved}30` } : {},
        }}
      >
        <CardContent sx={{ p: cfg.padding, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header: icon + label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: size === 'sm' ? 0.5 : 1 }}>
            {Icon && (
              <Box
                sx={{
                  width: size === 'sm' ? 32 : 40,
                  height: size === 'sm' ? 32 : 40,
                  borderRadius: size === 'sm' ? '8px' : '10px',
                  background: `linear-gradient(135deg, ${resolved}, ${resolved}cc)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 3px 10px ${resolved}40`,
                }}
              >
                {renderIcon()}
              </Box>
            )}
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: cfg.labelSize,
                fontWeight: 500,
                lineHeight: 1.2,
              }}
              noWrap
            >
              {label}
            </Typography>
          </Box>

          {/* Value + trend */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: cfg.fontSize,
                color: resolved,
                lineHeight: 1.1,
                ...tabularNumStyle,
              }}
            >
              {typeof value === 'number' ? <CountUp value={value} duration={0.8} /> : value}
            </Typography>
            {trend != null && <TrendBadge value={trend} direction={trendDirection} />}
          </Box>

          {subValue && (
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {subValue}
            </Typography>
          )}

          {/* Sparkline */}
          {sparklineData && sparklineData.length > 1 && size !== 'sm' && (
            <Box sx={{ mt: 'auto', mx: -1, mb: -0.5 }}>
              <ResponsiveContainer width="100%" height={cfg.sparkHeight}>
                <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${label?.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={resolved} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={resolved} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={resolved}
                    strokeWidth={1.5}
                    fill={`url(#spark-${label?.replace(/\s/g, '')})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
})

MetricCard.displayName = 'MetricCard'

export default MetricCard
