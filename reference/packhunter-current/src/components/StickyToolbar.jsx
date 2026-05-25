import { Box, useTheme } from '@mui/material'

/**
 * StickyToolbar — Page-level sticky control bar below TopBar.
 * Use StickyToolbar.Left / StickyToolbar.Right for layout.
 */
const StickyToolbar = ({ children, sx = {} }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 64,
        zIndex: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2.5,
        py: 1.5,
        mb: 3,
        mx: { xs: -2, sm: -3 },
        borderRadius: '12px',
        backgroundColor: isDark ? 'rgba(15, 20, 35, 0.85)' : 'rgba(248, 249, 252, 0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'}`,
        boxShadow: isDark
          ? '0 4px 20px rgba(0, 0, 0, 0.3)'
          : '0 2px 12px rgba(0, 0, 0, 0.06)',
        flexWrap: 'wrap',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

StickyToolbar.Left = ({ children, sx = {} }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1, ...sx }}>
    {children}
  </Box>
)

StickyToolbar.Right = ({ children, sx = {} }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap', ...sx }}>
    {children}
  </Box>
)

export default StickyToolbar
