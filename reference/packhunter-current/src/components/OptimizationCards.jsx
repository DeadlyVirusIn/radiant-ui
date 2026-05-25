/**
 * OptimizationCards — per-card success rate, avg completion time, best action suggestions.
 * Pure frontend aggregation from loaded request history. No API calls.
 */
import { useMemo } from 'react'
import { Box, Typography, Chip, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

export default function OptimizationCards({ requests = [] }) {
  const theme = useTheme()

  const stats = useMemo(() => {
    if (requests.length < 5) return null

    // Per-card aggregation (last 100 requests)
    const recent = requests.slice(0, 100)
    const byCard = {}
    let totalCompletionMs = 0
    let completionCount = 0

    for (const r of recent) {
      const card = r.card_name || r.card_id || 'Unknown'
      if (!byCard[card]) byCard[card] = { total: 0, completed: 0, failed: 0 }
      byCard[card].total++
      if (r.status === 'COMPLETED') {
        byCard[card].completed++
        if (r.requested_at && r.completed_at) {
          const ms = new Date(r.completed_at) - new Date(r.requested_at)
          if (ms > 0 && ms < 30 * 60 * 1000) { // ignore outliers >30min
            totalCompletionMs += ms
            completionCount++
          }
        }
      }
      if (r.status === 'FAILED') byCard[card].failed++
    }

    // Overall
    const totalCompleted = recent.filter(r => r.status === 'COMPLETED').length
    const totalFailed = recent.filter(r => r.status === 'FAILED').length
    const overallRate = recent.length > 0 ? Math.round((totalCompleted / recent.length) * 100) : 0
    const avgCompletionSec = completionCount > 0 ? Math.round(totalCompletionMs / completionCount / 1000) : null
    const retriesPerSuccess = totalCompleted > 0 ? Math.round(((totalCompleted + totalFailed) / totalCompleted) * 10) / 10 : null

    // Best/worst cards (min 2 attempts)
    const cardEntries = Object.entries(byCard).filter(([, v]) => v.total >= 2)
    cardEntries.sort((a, b) => (b[1].completed / b[1].total) - (a[1].completed / a[1].total))
    const bestCard = cardEntries.length > 0 ? { name: cardEntries[0][0], rate: Math.round((cardEntries[0][1].completed / cardEntries[0][1].total) * 100) } : null
    const worstCard = cardEntries.length > 1 ? { name: cardEntries[cardEntries.length - 1][0], rate: Math.round((cardEntries[cardEntries.length - 1][1].completed / cardEntries[cardEntries.length - 1][1].total) * 100) } : null

    return { overallRate, avgCompletionSec, retriesPerSuccess, bestCard, worstCard, totalCompleted, totalFailed }
  }, [requests])

  if (!stats) return null

  const metrics = [
    { label: 'Your Success Rate', value: `${stats.overallRate}%`, color: stats.overallRate >= 80 ? theme.palette.success.main : stats.overallRate >= 50 ? theme.palette.warning.main : theme.palette.error.main },
    ...(stats.avgCompletionSec ? [{ label: 'Avg Completion', value: stats.avgCompletionSec < 60 ? `${stats.avgCompletionSec}s` : `${Math.round(stats.avgCompletionSec / 60)}m`, color: theme.palette.info.main }] : []),
    ...(stats.retriesPerSuccess ? [{ label: 'Attempts / Success', value: `${stats.retriesPerSuccess}x`, color: stats.retriesPerSuccess <= 1.2 ? theme.palette.success.main : theme.palette.warning.main }] : []),
    ...(stats.bestCard ? [{ label: 'Best Card', value: stats.bestCard.name, sub: `${stats.bestCard.rate}%`, color: theme.palette.success.main }] : []),
  ]

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
      {metrics.map((m, i) => (
        <Tooltip key={i} title={m.sub || m.value} arrow>
          <Chip
            label={`${m.label}: ${m.value}`}
            size="small"
            sx={{
              height: 24, fontSize: '0.65rem', fontWeight: 600,
              bgcolor: `${m.color}15`, color: m.color,
              border: `1px solid ${m.color}30`,
            }}
          />
        </Tooltip>
      ))}
      {stats.worstCard && stats.worstCard.rate < 50 && (
        <Chip
          label={`Consider alternatives to ${stats.worstCard.name} (${stats.worstCard.rate}% success)`}
          size="small"
          sx={{ height: 24, fontSize: '0.6rem', fontWeight: 500, bgcolor: `${theme.palette.warning.main}10`, color: theme.palette.warning.main, fontStyle: 'italic' }}
        />
      )}
    </Box>
  )
}
