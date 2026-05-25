/**
 * ExecutionLogView — renders execution_log JSONB from trade/gift requests.
 * Shows: Progress checklist, Attempt history, Detailed timeline.
 */
import { useState } from 'react'
import { Box, Typography, Chip, Collapse, Divider } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { formatRelativeTime } from '../utils/errorDisplay'

const STEP_LABELS = {
  account_selected: 'Account selected',
  friend_requested: 'Friend requested',
  friend_accepted: 'Friend accepted',
  trade_started: 'Trade started',
  trade_confirmed: 'Trade confirmed',
  trade_completed: 'Trade completed',
  gift_executed: 'Gift executed',
  gift_completed: 'Gift completed',
  cleanup_done: 'Cleanup done',
}

export default function ExecutionLogView({ executionLog }) {
  const theme = useTheme()
  const [showTimeline, setShowTimeline] = useState(false)

  if (!executionLog) {
    return <Typography variant="caption" color="text.disabled">No execution log available (pre-observability request)</Typography>
  }

  const { attempts = [], timeline = [], progress = {} } = executionLog

  return (
    <Box>
      {/* Progress Checklist */}
      {Object.keys(progress).length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem', textTransform: 'uppercase' }}>
            Progress
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {Object.entries(STEP_LABELS).map(([key, label]) => {
              if (!(key in progress)) return null
              const done = progress[key]
              return (
                <Chip
                  key={key}
                  label={`${done ? '✓' : '✗'} ${label}`}
                  size="small"
                  sx={{
                    height: 20, fontSize: '0.58rem', fontWeight: 600,
                    bgcolor: done ? `${theme.palette.success.main}15` : `${theme.palette.error.main}15`,
                    color: done ? theme.palette.success.main : theme.palette.error.main,
                    border: `1px solid ${done ? theme.palette.success.main : theme.palette.error.main}30`,
                  }}
                />
              )
            })}
          </Box>
        </Box>
      )}

      {/* Attempt History */}
      {attempts.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem', textTransform: 'uppercase' }}>
            Attempts ({attempts.length})
          </Typography>
          {attempts.map((a, i) => (
            <Box key={i} sx={{
              p: 1, mb: 0.5, borderRadius: '8px', fontSize: '0.7rem',
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${a.final_attempt ? theme.palette.error.main + '40' : theme.palette.divider}`,
            }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip label={`#${a.attempt}`} size="small" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700 }} />
                {a.step && <Chip label={a.step} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />}
                <Chip label={a.error_source || '?'} size="small" color={a.error_source === 'grpc' ? 'warning' : a.error_source === 'proxy' ? 'info' : 'default'} variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
                {a.final_attempt && <Chip label="FINAL" size="small" color="error" sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700 }} />}
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'error.main' }}>
                {a.error_message}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.58rem' }}>
                Bot: {a.account_id || '?'} · Proxy: #{a.proxy_slot ?? '?'} ({a.proxy_region || '?'})
                {a.duration_ms ? ` · ${a.duration_ms < 60000 ? `${(a.duration_ms / 1000).toFixed(1)}s` : `${Math.round(a.duration_ms / 60000)}m`}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Timeline (collapsed by default) */}
      {timeline.length > 0 && (
        <Box>
          <Typography
            variant="caption" fontWeight={600} color="text.secondary"
            sx={{ cursor: 'pointer', fontSize: '0.65rem', '&:hover': { color: 'text.primary' } }}
            onClick={() => setShowTimeline(!showTimeline)}
          >
            {showTimeline ? '▾' : '▸'} Timeline ({timeline.length} events)
          </Typography>
          <Collapse in={showTimeline}>
            <Box sx={{ mt: 0.5, pl: 1, borderLeft: `2px solid ${theme.palette.divider}` }}>
              {timeline.map((ev, i) => (
                <Box key={i} sx={{ py: 0.25 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled', fontFamily: 'monospace' }}>
                    {new Date(ev.ts).toLocaleTimeString()}
                  </Typography>
                  <Typography variant="caption" sx={{ ml: 1, fontSize: '0.62rem', fontWeight: ev.event.includes('FAILED') ? 700 : 400, color: ev.event.includes('FAILED') ? 'error.main' : 'text.secondary' }}>
                    {ev.event}
                    {ev.reason ? ` — ${ev.reason}` : ''}
                    {ev.account ? ` (${ev.account})` : ''}
                    {ev.proxy ? ` [proxy #${ev.proxy}]` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  )
}
