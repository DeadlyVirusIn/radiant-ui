import { Box, Typography, Chip, useTheme } from '@mui/material'
import { motion } from 'framer-motion'

/**
 * PageHeader - Consistent page-level header component.
 *
 * @param {object}  props
 * @param {React.ReactNode}  props.icon     - Icon element (e.g. <BotIcon />)
 * @param {string}           props.title    - Page title
 * @param {string}           [props.subtitle] - Short description below title
 * @param {Array<{label:string, color?:string}>} [props.chips] - Inline stat chips
 * @param {React.ReactNode}  [props.action]  - Right-aligned action slot (buttons, selects)
 * @param {string}           [props.accent]  - Override gradient accent color
 * @param {'default'|'hero'} [props.variant] - 'hero' for dashboard-style large header
 * @param {React.ReactNode}  [props.children] - Additional content below header
 */
const PageHeader = ({
  icon,
  title,
  subtitle,
  chips = [],
  action,
  accent,
  variant = 'default',
  children,
}) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isHero = variant === 'hero'

  const gradFrom = accent || theme.palette.primary.main
  const gradTo = accent ? `${accent}cc` : theme.palette.secondary.main

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Box sx={{ mb: isHero ? 4 : 3 }}>
        {/* Main row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Left: icon + text + chips */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, minWidth: 0, flex: 1 }}>
            {/* Icon badge */}
            {icon && (
              <Box
                sx={{
                  width: isHero ? 52 : 44,
                  height: isHero ? 52 : 44,
                  borderRadius: isHero ? '14px' : '12px',
                  background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
                  boxShadow: `0 4px 14px ${gradFrom}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#fff',
                  '& svg': { fontSize: isHero ? 28 : 24 },
                }}
              >
                {icon}
              </Box>
            )}

            {/* Text block */}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant={isHero ? 'h2' : 'h5'}
                sx={{
                  fontWeight: isHero ? 800 : 700,
                  letterSpacing: isHero ? '-0.02em' : '-0.01em',
                  lineHeight: isHero ? 1.15 : 1.3,
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>

              {subtitle && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                    maxWidth: 480,
                    lineHeight: 1.5,
                  }}
                >
                  {subtitle}
                </Typography>
              )}

              {/* Chips row */}
              {chips.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                  {chips.map((chip, i) => {
                    const chipColor = chip.color || theme.palette.primary.main
                    return (
                      <Chip
                        key={i}
                        label={chip.label}
                        size="small"
                        sx={{
                          backgroundColor: `${chipColor}18`,
                          color: chipColor,
                          border: `1px solid ${chipColor}30`,
                          fontWeight: 600,
                          fontSize: '0.6875rem',
                        }}
                      />
                    )
                  })}
                </Box>
              )}
            </Box>
          </Box>

          {/* Right: action slot */}
          {action && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, pt: 0.5 }}>
              {action}
            </Box>
          )}
        </Box>

        {/* Hero separator line */}
        {isHero && (
          <Box
            sx={{
              mt: 2.5,
              height: 2,
              borderRadius: 1,
              background: `linear-gradient(90deg, ${gradFrom}, ${gradTo}, transparent)`,
              opacity: isDark ? 0.4 : 0.25,
            }}
          />
        )}

        {/* Optional children content below header */}
        {children}
      </Box>
    </motion.div>
  )
}

export default PageHeader
