import { useState, useCallback, useId } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Collapse,
  useTheme,
} from '@mui/material'
import { ExpandMore, ExpandLess } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * GlassCard - Reusable glassmorphism wrapper component.
 *
 * @param {object}  props
 * @param {string}  [props.title]        - Section header text
 * @param {string}  [props.subtitle]     - Smaller text below the title
 * @param {React.ReactNode} [props.icon] - Icon element rendered before the title
 * @param {React.ReactNode} [props.action] - Element rendered on the right side of the header
 * @param {string}  [props.accent]       - Gradient top-border color (hex or CSS color)
 * @param {boolean} [props.collapsible]  - Whether the card body can be collapsed
 * @param {boolean} [props.defaultOpen]  - Initial open state when collapsible (default true)
 * @param {object}  [props.sx]           - Additional MUI sx overrides merged onto the root Card
 * @param {boolean} [props.noPadding]    - Remove padding from the content area
 * @param {React.ReactNode} props.children
 */
const GlassCard = ({
  title,
  subtitle,
  icon,
  action,
  accent,
  collapsible = false,
  defaultOpen = true,
  sx = {},
  noPadding = false,
  children,
}) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [open, setOpen] = useState(defaultOpen)
  const titleId = useId()

  const toggleOpen = useCallback(() => setOpen((prev) => !prev), [])

  const hasHeader = title || icon || action || collapsible

  // --- Theme-aware tokens (aligned with SectionCard via theme.custom.glass) ---
  const g = theme.custom?.glass || {}
  const bgColor = g.bg || (isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.8)')
  const borderColor = g.border || (isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
  const hoverBorderColor = g.glow?.['20'] || (isDark ? 'rgba(124, 138, 255, 0.2)' : 'rgba(92, 106, 196, 0.2)')
  const shadowDefault = isDark
    ? '0 4px 24px rgba(0, 0, 0, 0.2)'
    : '0 2px 12px rgba(0, 0, 0, 0.06)'
  const shadowHover = isDark
    ? '0 8px 32px rgba(0, 0, 0, 0.3)'
    : '0 4px 20px rgba(0, 0, 0, 0.1)'

  // Build the gradient top border if an accent color is provided
  const accentBorder = accent
    ? {
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: `${theme.custom?.radius?.lg || 16}px ${theme.custom?.radius?.lg || 16}px 0 0`,
          background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
          zIndex: 1,
        },
      }
    : {}

  return (
    <Card
      component={motion.div}
      initial={false}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${theme.custom?.radius?.lg || 16}px`,
        backgroundColor: bgColor,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor}`,
        boxShadow: shadowDefault,
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        '&:hover': {
          borderColor: hoverBorderColor,
          boxShadow: shadowHover,
        },
        // Glass reflection highlight
        '&::after': accent ? {} : {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: isDark
            ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
          borderRadius: `${theme.custom?.radius?.lg || 16}px ${theme.custom?.radius?.lg || 16}px 0 0`,
          zIndex: 1,
          pointerEvents: 'none',
        },
        ...accentBorder,
        ...sx,
      }}
    >
      {/* ---- Header ---- */}
      {hasHeader && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            pt: 2,
            pb: children ? 0 : 2,
            gap: 1.5,
          }}
        >
          {/* Left side: icon + title/subtitle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minWidth: 0,
              flex: 1,
              cursor: collapsible ? 'pointer' : 'default',
            }}
            onClick={collapsible ? toggleOpen : undefined}
            role={collapsible ? 'button' : undefined}
            tabIndex={collapsible ? 0 : undefined}
            onKeyDown={
              collapsible
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleOpen()
                    }
                  }
                : undefined
            }
            aria-expanded={collapsible ? open : undefined}
          >
            {icon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: accent || theme.palette.primary.main,
                  '& svg': { fontSize: 22 },
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
            )}

            {(title || subtitle) && (
              <Box sx={{ minWidth: 0 }}>
                {title && (
                  <Typography
                    id={collapsible ? titleId : undefined}
                    variant="h6"
                    sx={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      lineHeight: 1.3,
                      color: 'text.primary',
                    }}
                    noWrap
                  >
                    {title}
                  </Typography>
                )}
                {subtitle && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', lineHeight: 1.3 }}
                    noWrap
                  >
                    {subtitle}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          {/* Right side: action + collapse toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {action}
            {collapsible && (
              <IconButton
                size="small"
                onClick={toggleOpen}
                aria-label={open ? 'Collapse' : 'Expand'}
                sx={{
                  color: 'text.secondary',
                  transition: 'transform 0.2s ease',
                }}
              >
                <motion.div
                  animate={{ rotate: open ? 0 : -180 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ display: 'flex' }}
                >
                  {open ? <ExpandLess /> : <ExpandMore />}
                </motion.div>
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      {/* ---- Content ---- */}
      {collapsible ? (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="glass-card-content"
              role="region"
              aria-labelledby={title ? titleId : undefined}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <CardContent
                sx={{
                  p: noPadding ? 0 : 2.5,
                  pt: noPadding ? 0 : hasHeader ? 1.5 : 2.5,
                  '&:last-child': { pb: noPadding ? 0 : 2.5 },
                }}
              >
                {children}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        children != null && (
          <CardContent
            sx={{
              p: noPadding ? 0 : 2.5,
              pt: noPadding ? 0 : hasHeader ? 1.5 : 2.5,
              '&:last-child': { pb: noPadding ? 0 : 2.5 },
            }}
          >
            {children}
          </CardContent>
        )
      )}
    </Card>
  )
}

export default GlassCard
