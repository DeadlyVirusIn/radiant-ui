import { memo, isValidElement } from 'react'
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material'
import { motion } from 'framer-motion'
import { CountUp } from './Animations'

// Resolve color string: supports MUI keys ('primary', 'success') and hex strings ('#ff0000')
const resolveColor = (color, theme) => {
  if (!color) return theme.palette.primary.main
  if (color.startsWith('#') || color.startsWith('rgb')) return color
  // Try MUI palette key (e.g., 'primary', 'success', 'error')
  const palette = theme.palette[color]
  return palette?.main || color
}

const StatCardV2 = memo(({ icon: Icon, label, value, color = 'primary', subValue, subtitle, onClick }) => {
  const theme = useTheme()
  const resolved = resolveColor(color, theme)
  const displaySub = subValue || subtitle

  // Determine how to render the icon
  const renderIcon = () => {
    if (!Icon) return null
    // If icon is a JSX element (already instantiated), render it directly
    if (isValidElement(Icon)) {
      return <Box sx={{ color: '#fff', '& svg': { fontSize: 24 } }}>{Icon}</Box>
    }
    // Icon is a component reference, instantiate it
    return <Icon sx={{ fontSize: 24, color: '#fff' }} />
  }

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02, y: -2 } : { y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        onClick={onClick}
        {...(onClick ? {
          role: 'button',
          tabIndex: 0,
          'aria-label': label,
          onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } },
        } : {})}
        sx={{
          height: '100%',
          cursor: onClick ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.3s ease',
          '&:hover': onClick ? {
            boxShadow: `0 8px 32px ${resolved}30`,
          } : {},
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${resolved}, ${resolved}cc)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 4px 12px ${resolved}40`,
              }}
            >
              {renderIcon()}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: resolved, lineHeight: 1.2 }}
              >
                {typeof value === 'number' ? (
                  <CountUp value={value} duration={0.8} />
                ) : value}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {label}
              </Typography>
            </Box>
          </Box>
          {displaySub && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {displaySub}
            </Typography>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
})

StatCardV2.displayName = 'StatCardV2'

export default StatCardV2
