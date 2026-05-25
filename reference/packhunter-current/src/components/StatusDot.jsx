import { memo } from 'react'
import { Box, Typography } from '@mui/material'

const statusConfig = {
  active: { color: '#10B981', pulse: true },
  idle: { color: '#94A3B8', pulse: false },
  error: { color: '#EF4444', pulse: true },
  gold: { color: '#F59E0B', pulse: true, shimmer: true },
}

// CSS keyframes injected once via style tag
const styleId = 'status-dot-keyframes'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    @keyframes statusPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.6); }
    }
    @keyframes statusShimmer {
      0%, 100% { box-shadow: 0 0 4px 1px rgba(245, 158, 11, 0.4); }
      50% { box-shadow: 0 0 10px 3px rgba(245, 158, 11, 0.7); }
    }
  `
  document.head.appendChild(style)
}

/**
 * StatusDot — Animated status indicator.
 * Pure CSS animation (no framer-motion) for GPU performance.
 */
const StatusDot = memo(({ status = 'idle', size = 10, label }) => {
  const cfg = statusConfig[status] || statusConfig.idle

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        {/* Pulse ring */}
        {cfg.pulse && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              bgcolor: cfg.color,
              animation: 'statusPulse 2s ease-in-out infinite',
              opacity: 0.4,
            }}
          />
        )}
        {/* Core dot */}
        <Box
          sx={{
            position: 'relative',
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: cfg.color,
            ...(cfg.shimmer && {
              animation: 'statusShimmer 2s ease-in-out infinite',
            }),
          }}
        />
      </Box>
      {label && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: cfg.color,
            fontSize: '0.75rem',
            lineHeight: 1,
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  )
})

StatusDot.displayName = 'StatusDot'

export default StatusDot
