/**
 * StatusIndicator — 4-state visual indicator for request lifecycle.
 * Queued (gray) → Action Needed (yellow) → Processing (blue) → Done/Failed (green/red)
 */
import { Box, Chip, LinearProgress, Typography, Tooltip } from '@mui/material'
import { getDisplayStatus, getErrorDisplay } from '../utils/errorDisplay'

const STATE_CONFIG = {
  queued:        { progress: 10, color: 'default' },
  action_needed: { progress: 40, color: 'warning' },
  processing:    { progress: 70, color: 'info' },
  done:          { progress: 100, color: 'success' },
  failed:        { progress: 100, color: 'error' },
}

export default function StatusIndicator({ status, type = 'trade', errorMessage, compact = false }) {
  const display = getDisplayStatus(status, type)
  const config = STATE_CONFIG[display.state] || STATE_CONFIG.processing
  // Pass `status` so the mapper can suppress retry-style copy on
  // terminal FAILED/CANCELLED requests (Apr 2026 trade-reason fix).
  const errorInfo = display.state === 'failed' && errorMessage ? getErrorDisplay(errorMessage, status) : null

  if (compact) {
    return (
      <Tooltip title={errorInfo ? errorInfo.message : display.label} arrow>
        <Chip
          label={display.label}
          size="small"
          color={display.color}
          variant={display.state === 'done' ? 'filled' : 'outlined'}
          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }}
        />
      </Tooltip>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Chip
          label={display.label}
          size="small"
          color={display.color}
          variant={display.state === 'done' ? 'filled' : 'outlined'}
          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }}
        />
      </Box>
      {display.state !== 'done' && display.state !== 'failed' && (
        <LinearProgress
          variant={display.state === 'processing' ? 'indeterminate' : 'determinate'}
          value={config.progress}
          color={config.color === 'default' ? 'inherit' : config.color}
          sx={{ height: 3, borderRadius: 2 }}
        />
      )}
      {errorInfo && (
        <Typography variant="caption" sx={{ color: 'error.main', fontSize: '0.65rem', mt: 0.5, display: 'block' }}>
          {errorInfo.icon} {errorInfo.message}
        </Typography>
      )}
      {errorInfo?.recommendation && (
        <Typography variant="caption" sx={{ color: 'info.main', fontSize: '0.6rem', mt: 0.25, display: 'block', fontStyle: 'italic' }}>
          💡 {errorInfo.recommendation}
        </Typography>
      )}
    </Box>
  )
}
