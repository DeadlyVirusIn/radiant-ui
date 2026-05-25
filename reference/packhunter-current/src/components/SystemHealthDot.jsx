/**
 * SystemHealthDot — green/yellow/red indicator in the header.
 * Polls /api/activity/health every 30s.
 */
import { useState, useEffect, useCallback } from 'react'
import { Tooltip, Box, Typography, IconButton } from '@mui/material'
import { useNavigate } from 'react-router-dom'

const STATUS_CONFIG = {
  healthy:  { color: '#4caf50', label: 'All systems healthy' },
  degraded: { color: '#ff9800', label: 'Some operations stuck' },
  issues:   { color: '#f44336', label: 'System issues detected' },
  unknown:  { color: '#9e9e9e', label: 'Checking...' },
}

export default function SystemHealthDot() {
  const [health, setHealth] = useState(null)
  const navigate = useNavigate()

  const fetchHealth = useCallback(() => {
    fetch('/api/activity/health', { credentials: 'include' })
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unknown' }))
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  const status = health?.status || 'unknown'
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown
  const hasIssues = health && (health.stuckTotal > 0 || health.failedTotal > 5)

  const tooltipContent = (
    <Box sx={{ maxWidth: 220 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.3 }}>{config.label}</Typography>
      {health?.stuckTrades > 0 && <Typography variant="caption" display="block">{health.stuckTrades} stuck trade{health.stuckTrades > 1 ? 's' : ''}</Typography>}
      {health?.stuckGifts > 0 && <Typography variant="caption" display="block">{health.stuckGifts} stuck gift{health.stuckGifts > 1 ? 's' : ''}</Typography>}
      {health?.failedTrades > 0 && <Typography variant="caption" display="block">{health.failedTrades} failed trade{health.failedTrades > 1 ? 's' : ''} (24h)</Typography>}
      {health?.failedGifts > 0 && <Typography variant="caption" display="block">{health.failedGifts} failed gift{health.failedGifts > 1 ? 's' : ''} (24h)</Typography>}
      {hasIssues && (
        <Typography
          variant="caption"
          sx={{ color: 'primary.main', cursor: 'pointer', display: 'block', mt: 0.5, fontWeight: 600 }}
          onClick={() => navigate('/')}
        >
          View activity →
        </Typography>
      )}
    </Box>
  )

  return (
    <Tooltip title={tooltipContent} arrow>
      <Box
        onClick={fetchHealth}
        sx={{
          width: 10, height: 10, borderRadius: '50%',
          bgcolor: config.color,
          boxShadow: `0 0 6px ${config.color}60`,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'transform 0.15s',
          '&:hover': { transform: 'scale(1.3)' },
        }}
      />
    </Tooltip>
  )
}
