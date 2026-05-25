/**
 * AdminSystemSnapshot — 4 system-wide metric cards for admin dashboard.
 * Data from /api/activity/insights (cached 60s).
 */
import { useState, useEffect } from 'react'
import { Box, Typography, Skeleton } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const TrendArrow = ({ value, suffix = '%', invert = false }) => {
  if (value === 0 || value == null) return <span style={{ fontSize: '0.65rem', color: 'gray' }}>—</span>
  const up = value > 0
  const good = invert ? !up : up
  return (
    <span style={{ color: good ? '#4caf50' : '#f44336', fontSize: '0.7rem', fontWeight: 700 }}>
      {up ? '↑' : '↓'} {Math.abs(value)}{suffix}
    </span>
  )
}

export default function AdminSystemSnapshot() {
  const theme = useTheme()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/activity/insights', { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(() => null)
  }, [])

  const cards = data ? [
    {
      label: 'Requests (24h)',
      value: data.total,
      trend: <TrendArrow value={data.volumeTrend} />,
      color: theme.palette.info.main,
      icon: '📦',
    },
    {
      label: 'Success Rate',
      value: `${data.successRate}%`,
      trend: <TrendArrow value={data.successTrend} />,
      color: data.successRate >= 80 ? theme.palette.success.main : data.successRate >= 50 ? theme.palette.warning.main : theme.palette.error.main,
      icon: '✅',
    },
    {
      label: 'Failures (24h)',
      value: data.failed,
      trend: <TrendArrow value={data.failedPrev ? Math.round(((data.failed - data.failedPrev) / Math.max(data.failedPrev, 1)) * 100) : 0} invert />,
      color: data.failed > 10 ? theme.palette.error.main : data.failed > 0 ? theme.palette.warning.main : theme.palette.success.main,
      icon: '❌',
    },
    {
      label: 'Top Fail Step',
      value: data.topFailStep?.step || 'None',
      trend: data.topFailStep ? <span style={{ fontSize: '0.65rem' }}>{data.topFailStep.pct}% ({data.topFailStep.count})</span> : null,
      color: theme.palette.warning.main,
      icon: '⚠️',
    },
  ] : null

  if (!cards) {
    return (
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        {[1,2,3,4].map(i => <Skeleton key={i} variant="rounded" width="25%" height={80} sx={{ borderRadius: '12px' }} />)}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      {cards.map((card, i) => (
        <Box key={i} sx={{
          flex: '1 1 160px', p: 2, borderRadius: '12px',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <span style={{ fontSize: '1rem' }}>{card.icon}</span>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {card.label}
            </Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: card.color, lineHeight: 1 }}>
            {card.value}
          </Typography>
          {card.trend && <Box sx={{ mt: 0.5 }}>{card.trend}</Box>}
        </Box>
      ))}
    </Box>
  )
}
