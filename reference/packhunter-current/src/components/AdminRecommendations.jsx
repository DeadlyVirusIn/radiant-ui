/**
 * AdminRecommendations — rule-based recommendations from insights data.
 * Pure frontend logic, no API. Reads insights and generates 2-3 actionable tips.
 */
import { useState, useEffect } from 'react'
import { Box, Typography, Alert } from '@mui/material'

const RULES = [
  {
    check: (d) => d.topFailStep?.step === 'Friend' && d.topFailStep.pct > 40,
    severity: 'warning',
    message: (d) => `Friend step failures are high (${d.topFailStep.pct}%) — users may not be accepting friend requests in time.`,
    action: 'Consider notifying users to accept requests promptly.',
  },
  {
    check: (d) => d.topFailStep?.step === 'Queue/Matching' && d.topFailStep.pct > 50,
    severity: 'info',
    message: (d) => `Most failures occur at matching (${d.topFailStep.pct}%) — cards may be out of stock on bot accounts.`,
    action: 'Check bot card inventories and restock if possible.',
  },
  {
    check: (d) => d.repeatedCards?.length > 0 && d.repeatedCards[0].count >= 4,
    severity: 'error',
    message: (d) => `"${d.repeatedCards[0].card}" has failed ${d.repeatedCards[0].count}x today — may indicate a persistent issue.`,
    action: 'Investigate card availability or account locks for this card.',
  },
  {
    check: (d) => d.successTrend < -10,
    severity: 'warning',
    message: (d) => `Success rate dropped ${Math.abs(d.successTrend)}% vs yesterday — potential systemic issue.`,
    action: 'Check proxy health, bot account status, and server logs.',
  },
  {
    check: (d) => d.successRate >= 90 && d.total > 10,
    severity: 'success',
    message: () => 'System is performing well — success rate above 90%.',
    action: null,
  },
]

export default function AdminRecommendations() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('/api/activity/insights', { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(() => null)
  }, [])

  if (!data) return null

  const triggered = RULES.filter(r => r.check(data)).slice(0, 3)
  if (triggered.length === 0) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
        Recommendations
      </Typography>
      {triggered.map((r, i) => (
        <Alert key={i} severity={r.severity} sx={{ mb: 1, borderRadius: '10px', py: 0.5, fontSize: '0.78rem' }}>
          <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
            {typeof r.message === 'function' ? r.message(data) : r.message}
          </Typography>
          {r.action && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.secondary', fontStyle: 'italic' }}>
              → {r.action}
            </Typography>
          )}
        </Alert>
      ))}
    </Box>
  )
}
