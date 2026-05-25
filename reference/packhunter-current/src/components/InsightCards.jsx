/**
 * InsightCards — compact insight cards showing patterns over last 24h.
 * Fetches from /api/activity/insights (cached 60s server-side).
 */
import { useState, useEffect } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const TrendArrow = ({ value, suffix = '%' }) => {
  if (value === 0 || value == null) return <span style={{ color: 'gray', fontSize: '0.65rem' }}>—</span>
  const up = value > 0
  return (
    <span style={{ color: up ? '#4caf50' : '#f44336', fontSize: '0.7rem', fontWeight: 700 }}>
      {up ? '↑' : '↓'} {Math.abs(value)}{suffix}
    </span>
  )
}

export default function InsightCards({ isAdmin = false }) {
  const theme = useTheme()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/activity/insights', { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return null

  const cards = [
    {
      icon: '📊',
      label: 'Success Rate',
      value: `${data.successRate}%`,
      sub: <TrendArrow value={data.successTrend} />,
      color: data.successRate >= 80 ? theme.palette.success.main : data.successRate >= 50 ? theme.palette.warning.main : theme.palette.error.main,
    },
    {
      icon: '📦',
      label: 'Requests (24h)',
      value: data.total,
      sub: <TrendArrow value={data.volumeTrend} />,
      color: theme.palette.info.main,
    },
    ...(data.topFailStep ? [{
      icon: '⚠️',
      label: 'Top Failure',
      value: `${data.topFailStep.step}`,
      sub: <span style={{ fontSize: '0.65rem' }}>{data.topFailStep.pct}% of failures ({data.topFailStep.count})</span>,
      color: theme.palette.warning.main,
    }] : []),
    ...(isAdmin && data.repeatedCards?.length > 0 ? [{
      icon: '🔁',
      label: 'Repeated Failures',
      value: data.repeatedCards[0].card,
      sub: <span style={{ fontSize: '0.65rem' }}>{data.repeatedCards[0].count}x failed today</span>,
      color: theme.palette.error.main,
    }] : []),
  ]

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      {cards.map((card, i) => (
        <Box key={i} sx={{
          flex: '1 1 140px', maxWidth: 200, p: 2, borderRadius: '12px',
          border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          transition: 'box-shadow 120ms ease-out',
          '&:hover': { boxShadow: `0 2px 8px ${card.color}15` },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <span style={{ fontSize: '0.9rem' }}>{card.icon}</span>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.02em' }}>{card.label}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: card.color, lineHeight: 1.1 }}>{card.value}</Typography>
          <Box sx={{ mt: 0.5 }}>{card.sub}</Box>
        </Box>
      ))}
    </Box>
  )
}
