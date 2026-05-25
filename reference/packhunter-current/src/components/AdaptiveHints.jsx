/**
 * AdaptiveHints — personalized proactive hints based on user's recent request history.
 *
 * Analyzes the requests array already loaded by the page.
 * Max 1 hint visible. Dismissible (localStorage per hint key).
 * No API calls — pure frontend derivation.
 */
import { useState, useMemo } from 'react'
import { Alert, IconButton, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { getErrorDisplay } from '../utils/errorDisplay'

const DISMISS_KEY = 'vudoo_dismissed_hints'

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') } catch { return {} }
}
function dismiss(key) {
  const d = getDismissed()
  d[key] = Date.now()
  localStorage.setItem(DISMISS_KEY, JSON.stringify(d))
}
function isDismissed(key) {
  const d = getDismissed()
  // Re-show after 24h
  return d[key] && (Date.now() - d[key]) < 24 * 60 * 60 * 1000
}

const HINT_RULES = [
  // Anomaly: failure spike — >50% of last 10 requests failed
  {
    key: 'failure_spike',
    check: (requests) => {
      const recent = requests.slice(0, 10)
      if (recent.length < 5) return false
      const failRate = recent.filter(r => r.status === 'FAILED').length / recent.length
      return failRate >= 0.5
    },
    severity: 'warning',
    icon: '📈',
    message: 'Failure rate spiked — over 50% of your last 10 requests failed. Check if the card is still available or if there are server issues.',
  },
  // Anomaly: network errors dominating
  {
    key: 'network_errors_dominant',
    check: (requests) => {
      const recentFailed = requests.filter(r => r.status === 'FAILED').slice(0, 10)
      if (recentFailed.length < 3) return false
      const networkErrors = recentFailed.filter(r => {
        const info = getErrorDisplay(r.error_message, r.status)
        return info.group === 'network'
      })
      return networkErrors.length >= Math.ceil(recentFailed.length * 0.6)
    },
    severity: 'warning',
    icon: '🌐',
    message: 'Most recent failures are network-related. This usually resolves on its own — the system retries automatically.',
  },
  // Anomaly: timeout pattern — requests consistently timing out
  {
    key: 'timeout_pattern',
    check: (requests) => {
      const recentFailed = requests.filter(r => r.status === 'FAILED').slice(0, 8)
      if (recentFailed.length < 3) return false
      const timeouts = recentFailed.filter(r => {
        const info = getErrorDisplay(r.error_message, r.status)
        return info.group === 'timeout'
      })
      return timeouts.length >= Math.ceil(recentFailed.length * 0.5)
    },
    severity: 'info',
    icon: '⏱️',
    message: 'Several recent requests timed out. The server auto-cancelled them — retrying usually succeeds.',
  },
  {
    key: 'friend_step_failures',
    check: (requests) => {
      const recent = requests.filter(r => r.status === 'FAILED').slice(0, 10)
      const friendFails = recent.filter(r =>
        r.error_message?.toLowerCase().includes('friend') ||
        (r.friend_request_sent_at && !r.trade_sent_at && !r.gift_sent_at)
      )
      return recent.length >= 3 && friendFails.length >= Math.ceil(recent.length * 0.5)
    },
    severity: 'info',
    icon: '👥',
    message: 'Most of your recent failures happen at the friend step. Keep your game open to accept friend requests within 10 minutes.',
  },
  {
    key: 'rapid_retries',
    check: (requests) => {
      const recent = requests.slice(0, 5)
      if (recent.length < 3) return false
      const times = recent.map(r => new Date(r.requested_at).getTime()).filter(Boolean)
      for (let i = 0; i < times.length - 2; i++) {
        if (times[i] - times[i + 2] < 3 * 60 * 1000) return true // 3 requests within 3 min
      }
      return false
    },
    severity: 'info',
    icon: '⏳',
    message: 'Spacing out your requests can help avoid queue buildup. Consider waiting a few minutes between requests.',
  },
  {
    key: 'high_success',
    check: (requests) => {
      const recent = requests.slice(0, 20)
      if (recent.length < 5) return false
      const successRate = recent.filter(r => r.status === 'COMPLETED').length / recent.length
      return successRate >= 0.9
    },
    severity: 'success',
    icon: '🎉',
    message: 'Great success rate! Your recent requests are completing reliably.',
  },
]

export default function AdaptiveHints({ requests = [], type = 'trade' }) {
  const [dismissedLocal, setDismissedLocal] = useState(0) // force re-render on dismiss

  const activeHint = useMemo(() => {
    if (requests.length < 3) return null
    for (const rule of HINT_RULES) {
      if (isDismissed(`${type}_${rule.key}`)) continue
      if (rule.check(requests)) return rule
    }
    return null
  }, [requests, type, dismissedLocal])

  if (!activeHint) return null

  return (
    <Alert
      severity={activeHint.severity}
      sx={{ mb: 1.5, borderRadius: '10px', py: 0.5, alignItems: 'center' }}
      action={
        <IconButton size="small" onClick={() => { dismiss(`${type}_${activeHint.key}`); setDismissedLocal(v => v + 1) }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      }
    >
      <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
        {activeHint.icon} {activeHint.message}
      </Typography>
    </Alert>
  )
}
