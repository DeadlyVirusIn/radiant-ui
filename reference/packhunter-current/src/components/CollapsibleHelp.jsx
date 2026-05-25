import { useState } from 'react'
import { Box, Collapse, Typography, useTheme, useMediaQuery } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

/**
 * Collapsible "How to use" help section.
 * Collapsed by default on mobile, expanded on desktop (first visit).
 *
 * @param {string} title - Header text (default: "How to use")
 * @param {React.ReactNode} children - Content to show when expanded (typically a <ul>)
 * @param {object} icon - Optional override icon component
 * @param {boolean} defaultOpen - Force initial state (overrides responsive default)
 * @param {object} sx - Additional sx props for the outer Box
 */
export default function CollapsibleHelp({
  title = 'How to use',
  children,
  icon,
  defaultOpen,
  sx = {},
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const [open, setOpen] = useState(defaultOpen ?? !isMobile)

  const Icon = icon || InfoOutlinedIcon

  return (
    <Box sx={{ mb: 2, ...sx }}>
      <Box
        onClick={() => setOpen(v => !v)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          color: 'text.secondary',
          userSelect: 'none',
          transition: 'color 0.15s ease',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <Icon sx={{ fontSize: 16 }} />
        <Typography variant="caption" fontWeight={500}>{title}</Typography>
        {open
          ? <ExpandLessIcon sx={{ fontSize: 16 }} />
          : <ExpandMoreIcon sx={{ fontSize: 16 }} />
        }
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            mt: 1,
            px: 2,
            py: 1.5,
            borderRadius: '10px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(25, 118, 210, 0.1)',
            bgcolor: isDark ? 'rgba(124, 138, 255, 0.04)' : 'rgba(25, 118, 210, 0.03)',
            '& ul, & ol': { m: 0, pl: 2.5 },
            '& li': { mb: 0.5 },
            '& li:last-child': { mb: 0 },
          }}
        >
          <Typography variant="body2" color="text.secondary" component="div">
            {children}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  )
}
