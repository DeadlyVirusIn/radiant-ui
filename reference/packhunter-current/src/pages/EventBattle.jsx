import { useState, useEffect, useCallback } from 'react'
import { friendlyError, friendlyLog } from '../utils/errorMessages'
import {
  Box,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Menu,
  ListItemIcon,
  ListItemText,
  Collapse,
  useTheme,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Event as EventIcon,
  BatteryChargingFull as PowerIcon,
  Timer as TimerIcon,
  Lock as LockIcon,
  Repeat as RepeatIcon,
  Healing as HealIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  InfoOutlined as InfoIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { accounts, eventBattle } from '../services/api'
import useHealAction from '../hooks/useHealAction'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { getSocket, onEventBattleProgress, offEventBattleProgress } from '../services/socket'
import GlassCard from '../components/GlassCard'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import LoadingButton from '../components/LoadingButton'

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const BATTLE_DIFFICULTY_NAMES = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

// Difficulty accent colors by index
const DIFFICULTY_COLORS = ['#4caf50', '#2196f3', '#ff9800', '#f44336']

function EventBattle({ user, embedded = false, externalAccount, externalAccounts }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const { t } = useLanguage()

  // Themed container style (replaces glassStyle)
  const containerStyle = {
    p: 2.5,
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  }

  const [_linkedAccounts, setLinkedAccounts] = useState([])
  const [_selectedAccount, setSelectedAccount] = useState('')
  const linkedAccounts = (embedded && externalAccounts) ? externalAccounts : _linkedAccounts
  const selectedAccount = (embedded && externalAccount) ? externalAccount : _selectedAccount
  const [loading, setLoading] = useState(embedded ? false : true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  // Event data
  const [events, setEvents] = useState([])
  const [battleStatus, setBattleStatus] = useState({})
  const [eventPower, setEventPower] = useState(null)
  const [useRentalDeck, setUseRentalDeck] = useState(false)

  // Batch mode
  const [batchMode, setBatchMode] = useState(false)
  const [selectedBattles, setSelectedBattles] = useState([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)

  // Real-time progress tracking
  const [progressLogs, setProgressLogs] = useState([])
  const [currentBattleName, setCurrentBattleName] = useState('')
  const [startTime, setStartTime] = useState(null)
  const BATTLE_TIME_MS = 12000 // ~12s per battle

  // Repeat battle menu
  const [repeatMenuAnchor, setRepeatMenuAnchor] = useState(null)
  const [repeatBattleId, setRepeatBattleId] = useState(null)
  const [repeatBattleName, setRepeatBattleName] = useState('')
  const [repeatRunning, setRepeatRunning] = useState(false)

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  // Tips section collapsed state
  const [tipsOpen, setTipsOpen] = useState(false)

  // Shared heal action hook
  const healApi = useCallback(
    (chargersAmount, vcAmount) =>
      eventBattle.healPower(selectedAccount, eventPower?.eventId || null, chargersAmount, vcAmount),
    [selectedAccount, eventPower]
  )
  const { healLoading: healActionLoading, handleHeal } = useHealAction(healApi, () => loadEventPower(), 1000)

  useEffect(() => {
    if (!embedded) loadAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      loadEventData()
    }
  }, [selectedAccount])

  // Auto-refresh power every 30 seconds (pauses when tab is hidden)
  useEffect(() => {
    if (!selectedAccount) return
    let interval = null

    const start = () => {
      if (!interval) interval = setInterval(() => loadEventPower(), 30000)
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }
    const onVisChange = () => document.hidden ? stop() : start()

    start()
    document.addEventListener('visibilitychange', onVisChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [selectedAccount])

  // Listen for real-time battle progress events
  useEffect(() => {
    const handleProgress = (data) => {
      // Only handle events for this account (compare as numbers)
      if (data.accountId !== parseInt(selectedAccount)) return

      // Update progress
      setBatchProgress({
        current: data.current,
        total: data.total,
        phase: data.phase || 'battle',
      })

      // Update current battle name
      if (data.battleName) {
        setCurrentBattleName(data.battleName)
      }

      // Add to log
      if (data.message) {
        setProgressLogs(prev => [
          { time: new Date().toLocaleTimeString(), message: friendlyLog(data.message), type: data.type || 'info' },
          ...prev.slice(0, 19), // Keep last 20 logs
        ])
      }

      // Handle completion
      if (data.phase === 'complete') {
        setBatchRunning(false)
        setCurrentBattleName('')
        loadEventData() // Refresh status
      }
    }

    onEventBattleProgress(handleProgress)
    return () => offEventBattleProgress(handleProgress)
  }, [selectedAccount])

  const loadAccounts = async () => {
    try {
      const data = await accounts.list()
      setLinkedAccounts(data.accounts || [])
      if (data.accounts?.length > 0) {
        const activeAccounts = data.accounts.filter(a => a.is_active)
        if (activeAccounts.length > 0) {
          setSelectedAccount(activeAccounts[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load accounts:', err)
      setError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const loadEventData = async () => {
    if (!selectedAccount) return
    setLoading(true)
    setError('')

    try {
      // Load events — pass accountId for auto-discovery of active events
      const eventsData = await eventBattle.getEvents(selectedAccount)
      setEvents(eventsData.events || [])

      // Load status and power separately — don't let failures hide the events
      const [statusData, powerData] = await Promise.allSettled([
        eventBattle.getStatus(selectedAccount),
        eventBattle.getPower(selectedAccount),
      ])

      if (statusData.status === 'fulfilled') {
        setBattleStatus(statusData.value.completionMap || {})
      } else {
        console.warn('Failed to load event status:', statusData.reason?.message)
      }

      if (powerData.status === 'fulfilled') {
        setEventPower(powerData.value)
      } else {
        console.warn('Failed to load event power:', powerData.reason?.message)
      }
    } catch (err) {
      console.error('Failed to load event data:', err)
      setError(friendlyError(err.message || 'Failed to load event data'))
    } finally {
      setLoading(false)
    }
  }

  const loadEventPower = async () => {
    if (!selectedAccount) return
    try {
      const powerData = await eventBattle.getPower(selectedAccount)
      setEventPower(powerData)
    } catch (err) {
      console.error('Failed to refresh power:', err)
    }
  }

  const runSingleBattle = async (battleId, battleTryId = null) => {
    setActionLoading(true)
    setError('')

    try {
      const result = await eventBattle.runBattle(selectedAccount, battleId, battleTryId, useRentalDeck)

      if (result.success) {
        setSnackbar({
          open: true,
          message: `Battle completed! ${result.firstClear ? 'First clear bonus!' : ''}`,
          severity: 'success',
        })
        await loadEventData()
      } else {
        setError(friendlyError(result.error || 'Battle failed'))
      }
    } catch (err) {
      console.error('Battle error:', err)
      setError(friendlyError(err.message || 'Battle failed'))
    } finally {
      setActionLoading(false)
    }
  }

  // Repeat battle menu handlers
  const openRepeatMenu = (event, battleId, battleName) => {
    event.stopPropagation()
    setRepeatMenuAnchor(event.currentTarget)
    setRepeatBattleId(battleId)
    setRepeatBattleName(battleName || 'Battle')
  }

  const closeRepeatMenu = () => {
    setRepeatMenuAnchor(null)
    setRepeatBattleId(null)
    setRepeatBattleName('')
  }

  const runRepeatBattle = async (count) => {
    closeRepeatMenu()

    if (!repeatBattleId || count < 1) return

    // Check if we have enough power
    if (eventPower && eventPower.current < count) {
      setError(`Not enough event power. Need ${count}, have ${eventPower.current}`)
      return
    }

    setRepeatRunning(true)
    setError('')
    setProgressLogs([])
    setStartTime(Date.now())
    setCurrentBattleName('')
    setBatchProgress({ current: 0, total: count, phase: 'starting' })

    // Add initial log
    setProgressLogs([{
      time: new Date().toLocaleTimeString(),
      message: `Running ${repeatBattleName} ${count}x...`,
      type: 'info'
    }])

    try {
      // Create array with same battleId repeated 'count' times
      const battleIds = Array(count).fill(repeatBattleId)

      const result = await eventBattle.runBatch(
        selectedAccount,
        battleIds,
        false,
        useRentalDeck
      )

      if (result.success) {
        setSnackbar({
          open: true,
          message: `${repeatBattleName} completed ${count}x!`,
          severity: 'success',
        })
        await loadEventData()
      }

      setBatchProgress(null)
    } catch (err) {
      console.error('Repeat battle error:', err)
      setError(friendlyError(err.message || 'Repeat battle failed'))
    } finally {
      setRepeatRunning(false)
    }
  }

  // Calculate ETA based on progress
  const calculateETA = () => {
    if (!batchProgress || batchProgress.current === 0) {
      return batchProgress ? `~${Math.ceil((batchProgress.total * BATTLE_TIME_MS) / 60000)} min` : '--'
    }
    const remaining = batchProgress.total - batchProgress.current
    const estimatedMs = remaining * BATTLE_TIME_MS
    const minutes = Math.ceil(estimatedMs / 60000)
    const seconds = Math.ceil((estimatedMs % 60000) / 1000)
    if (minutes > 0) return `~${minutes}m ${seconds}s`
    return `~${seconds}s`
  }

  const runBatchBattles = async () => {
    if (selectedBattles.length === 0) {
      setError('No battles selected')
      return
    }

    setBatchRunning(true)
    setError('')
    setProgressLogs([]) // Clear logs
    setStartTime(Date.now())
    setCurrentBattleName('')
    setBatchProgress({ current: 0, total: selectedBattles.length, phase: 'starting' })

    // Add initial log
    setProgressLogs([{
      time: new Date().toLocaleTimeString(),
      message: `Starting batch of ${selectedBattles.length} battles...`,
      type: 'info'
    }])

    try {
      const result = await eventBattle.runBatch(
        selectedAccount,
        selectedBattles,
        false,  // No auto-complete tries - just run each battle once
        useRentalDeck
      )

      if (result.success) {
        setSnackbar({
          open: true,
          message: `Batch complete: ${result.summary?.successful || 0}/${result.summary?.total || 0} battles won!`,
          severity: 'success',
        })
        setSelectedBattles([])
        setBatchMode(false)
        await loadEventData()
      }

      setBatchProgress(null)
    } catch (err) {
      console.error('Batch error:', err)
      setError(friendlyError(err.message || 'Batch failed'))
    } finally {
      setBatchRunning(false)
    }
  }

  const toggleBattleSelection = (battleId) => {
    setSelectedBattles(prev =>
      prev.includes(battleId)
        ? prev.filter(id => id !== battleId)
        : [...prev, battleId]
    )
  }

  const selectAllUncleared = () => {
    const uncleared = []
    events.forEach(event => {
      event.soloEventBattles?.forEach(battle => {
        const status = battleStatus[battle.battleId]
        if (!status?.isCleared) {
          uncleared.push(battle.battleId)
        }
      })
    })
    setSelectedBattles(uncleared.slice(0, 10))
  }

  const clearSelection = () => {
    setSelectedBattles([])
  }

  // Format time remaining
  const formatTimeRemaining = (endAt) => {
    if (!endAt) return 'Active (auto-discovered)'
    const now = Date.now()
    const remaining = endAt - now
    if (remaining <= 0) return 'Ended'

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h remaining`
    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
  }

  // Format power regen time
  const formatRegenTime = (ms) => {
    if (!ms || ms <= 0) return 'Full'
    const minutes = Math.floor(ms / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate completion stats
  const getEventStats = (event) => {
    let total = 0
    let completed = 0
    event.soloEventBattles?.forEach(battle => {
      total++
      if (battleStatus[battle.battleId]?.isCleared) completed++
    })
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  // Shared progress panel renderer
  const renderProgressPanel = (isRunning) => {
    if (!isRunning && !batchProgress) return null
    const pct = batchProgress ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0
    return (
      <Box sx={{ mt: 2 }}>
        {/* Progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 10,
                borderRadius: 6,
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
                '& .MuiLinearProgress-bar': {
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                  borderRadius: 6,
                },
              }}
            />
          </Box>
          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 72, textAlign: 'right' }}>
            {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '0/0'}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              ({pct}%)
            </Typography>
          </Typography>
        </Box>

        {/* Status + ETA row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: progressLogs.length > 0 ? 1 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isRunning && <CircularProgress size={13} sx={{ color: theme.palette.primary.main }} />}
            <Typography variant="body2" color="text.secondary">
              {currentBattleName
                ? `Running: ${currentBattleName}`
                : batchProgress?.phase === 'complete'
                  ? 'Complete!'
                  : 'Preparing...'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimerIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              ETA: {calculateETA()}
            </Typography>
          </Box>
        </Box>

        {/* Log panel */}
        {progressLogs.length > 0 && (
          <Box
            sx={{
              p: 1,
              borderRadius: '8px',
              maxHeight: 110,
              overflowY: 'auto',
              bgcolor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {progressLogs.map((log, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, py: 0.2 }}>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', flexShrink: 0 }}>
                  {log.time}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    color: log.type === 'success'
                      ? '#4caf50'
                      : log.type === 'error'
                        ? '#f44336'
                        : log.type === 'warning'
                          ? '#ff9800'
                          : 'text.secondary',
                  }}
                >
                  {log.message}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  }

  if (loading && linkedAccounts.length === 0) {
    return (
      <Box sx={embedded ? {} : { p: 3 }}>
        {!embedded && <PageHeader icon={<EventIcon />} title="Event Battles" subtitle="Run event battles and track completion" />}
        <StatsCardsSkeleton count={4} />
      </Box>
    )
  }

  const content = (
    <Box>

      {!embedded && (
        <PageHeader
          icon={<EventIcon />}
          title="Event Battles"
          subtitle="Run event battles and track completion"
        />
      )}

      {/* Warning shown in parent Battles.jsx when embedded — only show standalone */}
      {!embedded && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }} icon={<WarningIcon />}>
          Running battles will trigger "another login detected" on mobile. Re-open the app after WebUI battles finish.
        </Alert>
      )}

      {/* Collapsible Tips */}
      <Box sx={{ mb: 2 }}>
        <Box
          onClick={() => setTipsOpen(v => !v)}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <InfoIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" fontWeight={500}>How to use</Typography>
          {tipsOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </Box>
        <Collapse in={tipsOpen}>
          <Box
            sx={{
              ...containerStyle,
              mt: 1,
              borderColor: isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(25, 118, 210, 0.1)',
              bgcolor: isDark ? 'rgba(124, 138, 255, 0.04)' : 'rgba(25, 118, 210, 0.03)',
            }}
          >
            <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.5 } }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <Typography component="span" variant="body2" fontWeight={600} color="text.primary">Single battle (1-5x): </Typography>
                  Click the play button on any battle, then select how many times to run.
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <Typography component="span" variant="body2" fontWeight={600} color="text.primary">Multiple battles: </Typography>
                  Enable Batch Mode, select battles, then click Run.
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  <Typography component="span" variant="body2" fontWeight={600} color="text.primary">Progress and logs </Typography>
                  appear below while battles are running.
                </Typography>
              </li>
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Controls row: account selector + rental deck + batch + refresh */}
      <Box
        sx={{
          ...containerStyle,
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {!embedded && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Select Account</InputLabel>
            <Select
              value={selectedAccount}
              label="Select Account"
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {linkedAccounts.filter(a => a.is_active).map(acc => (
                <MenuItem key={acc.id} value={acc.id}>
                  {acc.nickname || `Account ${acc.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControlLabel
          control={
            <Checkbox
              checked={useRentalDeck}
              onChange={(e) => setUseRentalDeck(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Rental Deck</Typography>}
          sx={{ mr: 0 }}
        />

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh Status">
            <IconButton
              size="small"
              onClick={loadEventData}
              disabled={loading}
              aria-label="Refresh status"
              sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '8px' }}
            >
              {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant={batchMode ? 'contained' : 'outlined'}
            onClick={() => {
              setBatchMode(!batchMode)
              if (batchMode) clearSelection()
            }}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, px: 1.5 }}
          >
            {batchMode ? 'Exit Batch' : 'Batch Mode'}
          </Button>
        </Box>
      </Box>

      {/* Event Power — prominent metric panel */}
      {eventPower && (
        <Box
          sx={{
            ...containerStyle,
            mb: 2,
            borderLeft: `3px solid ${theme.palette.secondary.main}`,
            borderRadius: '14px',
          }}
        >
          {/* Top row: icon + big number + regen info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                bgcolor: isDark ? 'rgba(255, 152, 0, 0.12)' : 'rgba(255, 152, 0, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PowerIcon sx={{ color: theme.palette.secondary.main, fontSize: 22 }} />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ display: 'block', mb: 0.2 }}>
                Event Power
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h4" fontWeight={800} lineHeight={1} color={eventPower.current === 0 ? 'error.main' : 'text.primary'}>
                  {eventPower.current}
                </Typography>
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                  / {eventPower.max}
                </Typography>
              </Box>
            </Box>

            {eventPower.current < eventPower.max && (
              <Box sx={{ ml: { xs: 0, sm: 'auto' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimerIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.secondary">
                    Next in {formatRegenTime(eventPower.nextRegenMs)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.disabled">
                  Full in {formatRegenTime(eventPower.fullRegenMs)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Progress bar */}
          <LinearProgress
            variant="determinate"
            value={(eventPower.current / eventPower.max) * 100}
            sx={{
              mt: 1.5,
              height: 6,
              borderRadius: 4,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
              '& .MuiLinearProgress-bar': {
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                borderRadius: 4,
              },
            }}
          />

          {/* Heal buttons */}
          {eventPower.current < eventPower.max && (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { label: '+1 Hourglass', chargers: 1, vc: 0, color: '#4caf50', hover: 'rgba(76, 175, 80, 0.08)' },
                { label: '+5 Hourglass', chargers: 5, vc: 0, color: '#ff9800', hover: 'rgba(255, 152, 0, 0.08)' },
                { label: '+1 Gold', chargers: 0, vc: 1, color: '#daa520', hover: 'rgba(255, 215, 0, 0.08)' },
              ].map(({ label, chargers, vc, color, hover }) => (
                <Button
                  key={label}
                  variant="outlined"
                  size="small"
                  startIcon={healActionLoading ? <CircularProgress size={13} /> : <HealIcon />}
                  disabled={healActionLoading}
                  onClick={async () => {
                    const result = await handleHeal(chargers, vc)
                    setSnackbar({
                      open: true,
                      message: result.success ? `Power healed (${label})! Refreshing...` : `Heal failed: ${result.error}`,
                      severity: result.success ? 'success' : 'error',
                    })
                  }}
                  sx={{
                    textTransform: 'none', borderRadius: '8px', fontSize: '0.75rem',
                    borderColor: color, color,
                    '&:hover': { borderColor: color, backgroundColor: hover },
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>
          )}

          {eventPower.current === 0 && (
            <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '8px', py: 0.5 }}>
              No event power remaining. Wait for regeneration or use power items.
            </Alert>
          )}
        </Box>
      )}

      {/* Batch Mode Controls */}
      {batchMode && (
        <Box
          sx={{
            ...containerStyle,
            mb: 2,
            border: `1px solid ${theme.palette.primary.main}`,
            borderRadius: '14px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Batch Mode
                <Chip
                  label={`${selectedBattles.length} selected`}
                  size="small"
                  color={selectedBattles.length > 0 ? 'primary' : 'default'}
                  sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click battles to select, then run all at once
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                size="small"
                variant="text"
                onClick={selectAllUncleared}
                disabled={batchRunning}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                Select Uncleared
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={clearSelection}
                disabled={batchRunning}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                Clear
              </Button>
              <LoadingButton
                loading={batchRunning}
                size="small"
                startIcon={<PlayIcon />}
                onClick={runBatchBattles}
                disabled={selectedBattles.length === 0}
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                {batchRunning ? 'Running...' : `Run ${selectedBattles.length} Battles`}
              </LoadingButton>
            </Box>
          </Box>

          {renderProgressPanel(batchRunning)}
        </Box>
      )}

      {/* Events List */}
      {loading ? (
        <StatsCardsSkeleton count={4} />
      ) : events.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<EventIcon sx={{ fontSize: 64 }} />}
            title="No Active Events"
            description="No active events found. Check back later!"
            minHeight={200}
          />
        </GlassCard>
      ) : (
        <Box>
          {events.map((event, eventIndex) => {
            const stats = getEventStats(event)
            const isActive = event.discovered ? true : (Date.now() >= event.startAt && Date.now() <= event.endAt)
            const hasEnded = event.discovered ? false : (event.endAt ? Date.now() > event.endAt : false)

            return (
              <Box
                key={eventIndex}
                sx={{
                  ...containerStyle,
                  mb: 2,
                  opacity: hasEnded ? 0.6 : 1,
                  borderRadius: '14px',
                }}
              >
                {/* Event header row */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36, height: 36, borderRadius: '9px', flexShrink: 0,
                        bgcolor: isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(124, 138, 255, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <EventIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                        {event.name || `Event ${event.id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimeRemaining(event.endAt)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      {stats.completed}/{stats.total}
                    </Typography>
                    <Chip
                      label={hasEnded ? 'Ended' : isActive ? 'Active' : 'Coming Soon'}
                      size="small"
                      color={hasEnded ? 'default' : isActive ? 'success' : 'warning'}
                      sx={{ height: 20, fontSize: '0.65rem' }}
                    />
                  </Box>
                </Box>

                {/* Completion progress bar */}
                <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={stats.percentage}
                      sx={{
                        height: 7,
                        borderRadius: 4,
                        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
                        '& .MuiLinearProgress-bar': {
                          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ minWidth: 32 }}>
                    {stats.percentage}%
                  </Typography>
                </Box>

                {/* Battle grid */}
                <Grid
                  container
                  spacing={1.5}
                  sx={{ mt: 1 }}
                  component={motion.div}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {event.soloEventBattles?.map((battle, battleIndex) => {
                    const status = battleStatus[battle.battleId]
                    const isCleared = status?.isCleared
                    const isSelected = selectedBattles.includes(battle.battleId)

                    const prevBattle = event.soloEventBattles?.[battleIndex - 1]
                    const isUnlocked = battleIndex === 0 || battleStatus[prevBattle?.battleId]?.isCleared

                    const diffColor = DIFFICULTY_COLORS[battleIndex % DIFFICULTY_COLORS.length]

                    return (
                      <Grid item xs={6} sm={4} md={3} lg={2} key={battle.battleId} component={motion.div} variants={itemVariants}>
                        <Box
                          onClick={() => batchMode && isUnlocked && !hasEnded && toggleBattleSelection(battle.battleId)}
                          sx={{
                            p: 1.25,
                            borderRadius: '10px',
                            border: isSelected
                              ? `2px solid ${theme.palette.primary.main}`
                              : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                            borderLeft: `3px solid ${isCleared ? '#4caf50' : isUnlocked ? diffColor : '#555'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: batchMode && isUnlocked && !hasEnded ? 'pointer' : 'default',
                            bgcolor: isCleared
                              ? (isDark ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.05)')
                              : isSelected
                                ? 'rgba(124, 138, 255, 0.08)'
                                : !isUnlocked
                                  ? (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)')
                                  : 'transparent',
                            opacity: !isUnlocked ? 0.65 : 1,
                            transition: 'all 0.15s ease',
                            '&:hover': batchMode && isUnlocked && !hasEnded
                              ? {
                                  borderColor: theme.palette.primary.main,
                                  boxShadow: `0 0 0 1px ${theme.palette.primary.main}30`,
                                }
                              : !batchMode && isUnlocked && !hasEnded
                                ? {
                                    boxShadow: isDark
                                      ? `0 2px 8px rgba(0,0,0,0.4)`
                                      : `0 2px 8px rgba(0,0,0,0.1)`,
                                    transform: 'translateY(-1px)',
                                  }
                                : {},
                          }}
                        >
                          {/* Status icon / checkbox */}
                          <Box sx={{ flexShrink: 0 }}>
                            {batchMode && isUnlocked ? (
                              <Checkbox
                                size="small"
                                checked={isSelected}
                                disabled={hasEnded}
                                sx={{ p: 0 }}
                              />
                            ) : isCleared ? (
                              <CheckIcon sx={{ color: '#4caf50', fontSize: 18 }} />
                            ) : isUnlocked ? (
                              <UncheckedIcon sx={{ color: diffColor, fontSize: 18 }} />
                            ) : (
                              <LockIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                            )}
                          </Box>

                          {/* Battle name */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight={500}
                              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }}
                            >
                              {battle.name || BATTLE_DIFFICULTY_NAMES[battleIndex] || `Battle ${battleIndex + 1}`}
                            </Typography>
                          </Box>

                          {/* Play button (single mode only) */}
                          {!batchMode && isUnlocked && !hasEnded && (
                            <Tooltip title={isCleared ? 'Replay (1-5x)' : 'Run Battle (1-5x)'}>
                              <IconButton
                                size="small"
                                aria-label={isCleared ? 'Replay battle' : 'Run battle'}
                                onClick={(e) => openRepeatMenu(e, battle.battleId, battle.name || BATTLE_DIFFICULTY_NAMES[battleIndex] || `Battle ${battleIndex + 1}`)}
                                disabled={actionLoading || repeatRunning || eventPower?.current === 0}
                                sx={{
                                  p: 0.4,
                                  color: isCleared ? '#4caf50' : theme.palette.primary.main,
                                  bgcolor: isCleared
                                    ? 'rgba(76, 175, 80, 0.08)'
                                    : `${theme.palette.primary.main}14`,
                                  borderRadius: '6px',
                                  flexShrink: 0,
                                  '&:hover': {
                                    bgcolor: isCleared
                                      ? 'rgba(76, 175, 80, 0.16)'
                                      : `${theme.palette.primary.main}28`,
                                  },
                                }}
                              >
                                <PlayIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Grid>
                    )
                  })}
                </Grid>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Repeat battle menu */}
      <Menu
        anchorEl={repeatMenuAnchor}
        open={Boolean(repeatMenuAnchor)}
        onClose={closeRepeatMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: 140 } }}
      >
        <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, color: 'text.secondary', display: 'block', fontWeight: 600 }}>
          Run {repeatBattleName}
        </Typography>
        {[1, 2, 3, 4, 5].map(count => (
          <MenuItem
            key={count}
            onClick={() => runRepeatBattle(count)}
            disabled={eventPower && eventPower.current < count}
            sx={{ gap: 1, minWidth: 130, borderRadius: '8px', mx: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 24 }}>
              <RepeatIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
            </ListItemIcon>
            <ListItemText primary={`Run ${count}x`} primaryTypographyProps={{ variant: 'body2' }} />
            {eventPower && eventPower.current < count && (
              <Typography variant="caption" color="error">
                Need {count}
              </Typography>
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* Repeat Mode Progress Panel (outside batch mode) */}
      {!batchMode && (repeatRunning || (batchProgress && !batchMode)) && (
        <Box
          sx={{
            ...containerStyle,
            mt: 2,
            border: `1px solid ${theme.palette.primary.main}`,
            borderRadius: '14px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 30, height: 30, borderRadius: '8px',
                bgcolor: `${theme.palette.primary.main}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RepeatIcon sx={{ color: theme.palette.primary.main, fontSize: 16 }} />
            </Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Running: {currentBattleName || repeatBattleName}
            </Typography>
          </Box>
          {renderProgressPanel(repeatRunning)}
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )

  if (embedded) return content
  return <FadeIn><Box sx={{ p: 3 }}>{content}</Box></FadeIn>
}

export default EventBattle
