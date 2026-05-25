/**
 * RequestTimeline — compact horizontal milestone timeline for trade/gift requests.
 *
 * Derives step states from existing timestamps on the request object.
 * No API calls. Pure render.
 */
import { Box, Typography, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { formatRelativeTime, getErrorDisplay } from '../utils/errorDisplay'

const TRADE_STEPS = [
  { key: 'requested_at', label: 'Requested', short: 'Req' },
  { key: 'matched_at', label: 'Matched', short: 'Match' },
  { key: 'friend_request_sent_at', label: 'Friend Added', short: 'Friend' },
  { key: 'trade_sent_at', label: 'Trade Sent', short: 'Trade' },
  { key: 'completed_at', label: 'Done', short: 'Done' },
]

const GIFT_STEPS = [
  { key: 'requested_at', label: 'Requested', short: 'Req' },
  { key: 'matched_at', label: 'Matched', short: 'Match' },
  { key: 'friend_request_sent_at', label: 'Friend Added', short: 'Friend' },
  { key: 'gift_sent_at', label: 'Gift Sent', short: 'Gift' },
  { key: 'completed_at', label: 'Done', short: 'Done' },
]

// Status → which step index is "current" (for the pulse indicator)
const TRADE_STATUS_STEP = {
  PENDING: 0, QUEUED: 0, MATCHING: 1,
  FRIEND_REQUEST_SENT: 2, FRIEND_ACCEPTED: 2,
  TRADE_PROPOSAL_SENT: 3, WAITING_TRADE_RESPONSE: 3, PICK_CARD: 3, CONFIRMING_TRADE: 3,
  COMPLETED: 4, FAILED: -1, CANCELLED: -1,
}

const GIFT_STATUS_STEP = {
  PENDING: 0, QUEUED: 0, MATCHING: 1,
  FRIEND_REQUEST_SENT: 2,
  EXECUTING_GIFT: 3,
  COMPLETED: 4, FAILED: -1, CANCELLED: -1,
}

function getStepState(step, stepIndex, request, currentStepIndex, isFailed) {
  const ts = request[step.key]
  const isLast = step.key === 'completed_at'

  // Terminal step
  if (isLast) {
    if (request.status === 'COMPLETED') return 'completed'
    if (isFailed) return 'failed'
    return 'pending'
  }

  // Has timestamp → completed
  if (ts) {
    // But if failed and this is the furthest step with a timestamp, mark as failed
    if (isFailed && stepIndex === currentStepIndex) return 'failed'
    return 'completed'
  }

  // Current step (status maps to this index, but no timestamp yet)
  if (stepIndex === currentStepIndex && !isFailed) return 'current'

  return 'pending'
}

function findLastTimestampStep(steps, request) {
  let last = 0
  for (let i = steps.length - 1; i >= 0; i--) {
    if (request[steps[i].key]) { last = i; break }
  }
  return last
}

export default function RequestTimeline({ request, type = 'trade' }) {
  const theme = useTheme()
  const steps = type === 'gift' ? GIFT_STEPS : TRADE_STEPS
  const statusMap = type === 'gift' ? GIFT_STATUS_STEP : TRADE_STATUS_STEP
  const isFailed = request.status === 'FAILED' || request.status === 'CANCELLED'
  const currentStepIndex = isFailed
    ? findLastTimestampStep(steps, request)
    : (statusMap[request.status] ?? 0)

  // Pass request.status so the mapper suppresses misleading
  // "system is retrying..." copy on terminal FAILED/CANCELLED rows.
  const errorInfo = isFailed && request.error_message ? getErrorDisplay(request.error_message, request.status) : null

  const colors = {
    completed: theme.palette.success.main,
    current: theme.palette.info.main,
    failed: theme.palette.error.main,
    pending: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    line: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  }

  return (
    <Box sx={{ overflowX: 'auto', py: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 320, gap: 0 }}>
        {steps.map((step, i) => {
          const state = getStepState(step, i, request, currentStepIndex, isFailed)
          const ts = request[step.key]
          const dotColor = colors[state]
          const isLastStep = i === steps.length - 1

          return (
            <Box key={step.key} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 56 }}>
              {/* Connecting line (before dot, except first) */}
              {i > 0 && (
                <Box sx={{
                  position: 'absolute', top: 5, right: '50%', width: '100%', height: 2,
                  bgcolor: state === 'completed' || state === 'current' ? colors.completed : colors.line,
                  zIndex: 0,
                }} />
              )}

              {/* Dot */}
              <Tooltip title={ts ? formatRelativeTime(ts) : (state === 'failed' && errorInfo ? errorInfo.message : step.label)} arrow>
                <Box sx={{
                  width: 12, height: 12, borderRadius: '50%', zIndex: 1,
                  bgcolor: dotColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: state === 'current' ? `0 0 8px ${dotColor}80` : 'none',
                  ...(state === 'current' && {
                    animation: 'timelinePulse 1.5s ease-in-out infinite',
                    '@keyframes timelinePulse': {
                      '0%,100%': { boxShadow: `0 0 4px ${dotColor}40` },
                      '50%': { boxShadow: `0 0 10px ${dotColor}90` },
                    },
                  }),
                }}>
                  {state === 'completed' && (
                    <Typography sx={{ fontSize: 9, color: 'white', fontWeight: 700, lineHeight: 1 }}>✓</Typography>
                  )}
                  {state === 'failed' && (
                    <Typography sx={{ fontSize: 9, color: 'white', fontWeight: 700, lineHeight: 1 }}>✗</Typography>
                  )}
                </Box>
              </Tooltip>

              {/* Label */}
              <Typography variant="caption" sx={{
                mt: 0.5, fontSize: '0.55rem', fontWeight: state === 'current' ? 700 : 500,
                color: state === 'pending' ? 'text.disabled' : state === 'failed' ? 'error.main' : 'text.secondary',
                textAlign: 'center', lineHeight: 1.2,
              }}>
                {step.short}
              </Typography>

              {/* Time */}
              {ts && (
                <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.disabled', textAlign: 'center' }}>
                  {formatRelativeTime(ts)}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Failure reason below timeline */}
      {errorInfo && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'error.main', fontSize: '0.65rem', textAlign: 'center' }}>
          {errorInfo.icon} {errorInfo.message}
        </Typography>
      )}
    </Box>
  )
}
