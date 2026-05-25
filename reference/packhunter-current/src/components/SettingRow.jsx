import { memo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'

/**
 * SettingRow — Card-based settings row with label, description, and control.
 * Control appears on the right side (Switch, Select, Slider, Button).
 */
const SettingRow = memo(({ label, description, icon, control, disabled, sx = {} }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: '12px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        transition: 'border-color 0.2s, background-color 0.2s',
        opacity: disabled ? 0.5 : 1,
        '&:hover': {
          borderColor: isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
        },
        '& + &': { mt: 1 },
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
        {icon && (
          <Box
            sx={{
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              '& svg': { fontSize: 20 },
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3 }}>
            {label}
          </Typography>
          {description && (
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.3, display: 'block', mt: 0.15 }}>
              {description}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ flexShrink: 0, ml: 1 }}>
        {control}
      </Box>
    </Box>
  )
})

SettingRow.displayName = 'SettingRow'

export default SettingRow
