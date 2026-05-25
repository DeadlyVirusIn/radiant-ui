/**
 * TradeProgress - Visual stepper with countdown for trade status
 *
 * Usage:
 *   <TradeProgress
 *     status="PENDING"
 *     createdAt={trade.createdAt}
 *     expiresAt={trade.expiresAt}
 *   />
 */

import { useState, useEffect } from 'react'
import { useTicker } from '../hooks/useTicker'
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  Typography,
  Chip,
  LinearProgress,
  Paper,
  Tooltip,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import {
  Send as SendIcon,
  HourglassEmpty as PendingIcon,
  Handshake as AcceptedIcon,
  CheckCircle as CompletedIcon,
  Cancel as CancelledIcon,
  Timer as TimerIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'

// Trade status steps
const TRADE_STEPS = [
  { key: 'INITIATED', label: 'Initiated', icon: SendIcon },
  { key: 'PENDING', label: 'Pending', icon: PendingIcon },
  { key: 'ACCEPTED', label: 'Accepted', icon: AcceptedIcon },
  { key: 'COMPLETED', label: 'Completed', icon: CompletedIcon },
]

const FAILED_STATUSES = ['CANCELLED', 'FAILED', 'EXPIRED', 'REJECTED']

// Custom connector with animation
const AnimatedConnector = styled(StepConnector)(({ theme }) => ({
  [`& .MuiStepConnector-line`]: {
    borderColor: theme.palette.divider,
    borderTopWidth: 3,
    borderRadius: 1,
  },
  [`&.Mui-active .MuiStepConnector-line`]: {
    borderColor: theme.palette.primary.main,
  },
  [`&.Mui-completed .MuiStepConnector-line`]: {
    borderColor: theme.palette.success.main,
  },
}))

// Custom step icon
function StepIcon({ icon: Icon, active, completed, error }) {
  const bgColor = error
    ? 'error.main'
    : completed
    ? 'success.main'
    : active
    ? 'primary.main'
    : 'grey.400'

  return (
    <motion.div
      initial={active ? { scale: 0.8 } : false}
      animate={active ? { scale: [0.8, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: active ? 3 : 0,
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
    </motion.div>
  )
}

// Countdown timer hook
// Wave 3: subscribes to the shared 1s ticker instead of opening its own
// setInterval. Multiple TradeProgress components share one timer.
function useCountdown(targetDate) {
  useTicker({ enabled: !!targetDate })
  return calculateTimeLeft(targetDate)
}

function calculateTimeLeft(targetDate) {
  if (!targetDate) return null

  const now = new Date()
  const target = new Date(targetDate)
  const diff = target - now

  if (diff <= 0) return { expired: true, total: 0 }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return {
    expired: false,
    total: diff,
    hours,
    minutes,
    seconds,
    formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
  }
}

// Get step index from status
function getStepIndex(status) {
  const index = TRADE_STEPS.findIndex(s => s.key === status)
  return index === -1 ? 0 : index
}

// Main component
export function TradeProgress({
  status = 'PENDING',
  createdAt,
  expiresAt,
  variant = 'default', // 'default', 'compact', 'minimal'
  showCountdown = true,
}) {
  const countdown = useCountdown(expiresAt)
  const currentStep = getStepIndex(status)
  const isFailed = FAILED_STATUSES.includes(status)
  const isCompleted = status === 'COMPLETED'

  // Calculate progress percentage
  const totalSteps = TRADE_STEPS.length - 1
  const progressPercent = isFailed ? 0 : isCompleted ? 100 : (currentStep / totalSteps) * 100

  // Urgency level based on time remaining
  const getUrgencyLevel = () => {
    if (!countdown || countdown.expired) return 'expired'
    if (countdown.hours < 1) return 'critical'
    if (countdown.hours < 6) return 'warning'
    return 'normal'
  }

  const urgency = getUrgencyLevel()

  if (variant === 'minimal') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          size="small"
          label={status}
          color={isFailed ? 'error' : isCompleted ? 'success' : 'primary'}
          variant={isCompleted || isFailed ? 'filled' : 'outlined'}
        />
        {showCountdown && countdown && !countdown.expired && !isCompleted && !isFailed && (
          <Tooltip title="Time remaining">
            <Chip
              size="small"
              icon={<TimerIcon />}
              label={countdown.formatted}
              color={urgency === 'critical' ? 'error' : urgency === 'warning' ? 'warning' : 'default'}
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>
    )
  }

  if (variant === 'compact') {
    return (
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {status}
          </Typography>
          {showCountdown && countdown && !countdown.expired && !isCompleted && !isFailed && (
            <Typography
              variant="caption"
              color={urgency === 'critical' ? 'error.main' : urgency === 'warning' ? 'warning.main' : 'text.secondary'}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <TimerIcon sx={{ fontSize: 12 }} />
              {countdown.formatted}
            </Typography>
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          color={isFailed ? 'error' : isCompleted ? 'success' : 'primary'}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>
    )
  }

  // Default variant with full stepper
  return (
    <Paper sx={{ p: 2 }}>
      {/* Header with status and countdown */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Trade Status
        </Typography>
        {showCountdown && countdown && !countdown.expired && !isCompleted && !isFailed && (
          <Box
            component={motion.div}
            animate={urgency === 'critical' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              bgcolor: urgency === 'critical' ? 'error.lighter' : urgency === 'warning' ? 'warning.lighter' : 'grey.100',
            }}
          >
            <TimerIcon
              sx={{
                fontSize: 18,
                color: urgency === 'critical' ? 'error.main' : urgency === 'warning' ? 'warning.main' : 'text.secondary',
              }}
            />
            <Typography
              variant="body2"
              fontWeight={600}
              color={urgency === 'critical' ? 'error.main' : urgency === 'warning' ? 'warning.main' : 'text.primary'}
            >
              {countdown.formatted}
            </Typography>
          </Box>
        )}
        {countdown?.expired && !isCompleted && !isFailed && (
          <Chip
            icon={<WarningIcon />}
            label="Expired"
            color="error"
            size="small"
          />
        )}
      </Box>

      {/* Stepper */}
      <Stepper
        activeStep={currentStep}
        alternativeLabel
        connector={<AnimatedConnector />}
      >
        {TRADE_STEPS.map((step, index) => {
          const isActive = index === currentStep
          const isComplete = index < currentStep || isCompleted

          return (
            <Step key={step.key} completed={isComplete}>
              <StepLabel
                StepIconComponent={() => (
                  <StepIcon
                    icon={step.icon}
                    active={isActive && !isFailed}
                    completed={isComplete}
                    error={isFailed && isActive}
                  />
                )}
              >
                <Typography
                  variant="caption"
                  color={isActive ? 'primary.main' : isComplete ? 'success.main' : 'text.secondary'}
                  fontWeight={isActive ? 600 : 400}
                >
                  {step.label}
                </Typography>
              </StepLabel>
            </Step>
          )
        })}
      </Stepper>

      {/* Failed status message */}
      {isFailed && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'error.lighter',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CancelledIcon color="error" />
          <Typography variant="body2" color="error.main">
            Trade {status.toLowerCase()}
          </Typography>
        </Box>
      )}

      {/* Completed message */}
      {isCompleted && (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'success.lighter',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CompletedIcon color="success" />
          <Typography variant="body2" color="success.main">
            Trade completed successfully!
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

// Trade progress bar for lists
export function TradeProgressBar({ status, expiresAt }) {
  const countdown = useCountdown(expiresAt)
  const isFailed = FAILED_STATUSES.includes(status)
  const isCompleted = status === 'COMPLETED'

  const progressPercent =
    isFailed ? 0 :
    isCompleted ? 100 :
    status === 'ACCEPTED' ? 75 :
    status === 'PENDING' ? 50 :
    25

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          color={isFailed ? 'error' : isCompleted ? 'success' : 'primary'}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Box>
      {countdown && !countdown.expired && !isCompleted && !isFailed && (
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>
          {countdown.formatted}
        </Typography>
      )}
    </Box>
  )
}

export default TradeProgress
