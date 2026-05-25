import { useState, useEffect } from 'react'
import { friendlyLog, friendlyError } from '../utils/errorMessages'
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  CircularProgress,
  useTheme,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Timeline as TimelineIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  FiberManualRecord as DotIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material'
import { bots } from '../services/api'
import { onBotStatus, onBotLog, offBotStatus, offBotLog } from '../services/socket'
import { formatTime } from '../utils/dateFormat'
import { useLanguage } from '../contexts/LanguageContext'
import { useAccount } from '../contexts/AccountContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { BotControlSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

function Bot({ user }) {
  const theme = useTheme()
  const { t } = useLanguage()
  const { accounts: linkedAccounts, selectedAccountId, selectAccount } = useAccount()
  const selectedAccount = selectedAccountId?.toString() || ''
  const [botStatus, setBotStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  // Status timeline - persisted to localStorage
  const [statusHistory, setStatusHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('botStatusHistory')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  // Save status history to localStorage
  useEffect(() => {
    localStorage.setItem('botStatusHistory', JSON.stringify(statusHistory))
  }, [statusHistory])

  // Track status changes
  const addStatusEvent = (status, message = '') => {
    const event = {
      id: Date.now(),
      status,
      message: message || getStatusMessage(status),
      timestamp: new Date().toISOString(),
      accountId: selectedAccount,
    }
    setStatusHistory(prev => [event, ...prev].slice(0, 50))
  }

  const getStatusMessage = (status) => {
    switch (status) {
      case 'starting': return 'Bot starting...'
      case 'running': return 'Bot is now running'
      case 'stopped': return 'Bot stopped'
      case 'error': return 'Bot encountered an error'
      default: return `Status changed to ${status}`
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <SuccessIcon sx={{ fontSize: 14, color: theme.palette.success.main }} />
      case 'error': return <ErrorIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />
      case 'starting': return <WarningIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
      case 'stopped': return <InfoIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
      default: return <DotIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
    }
  }

  useEffect(() => {
    // Set loading to false once we have accounts data
    if (linkedAccounts.length >= 0) {
      setLoading(false)
    }

    // Socket event listeners (via botSocket — initialized at App level)
    const handleBotStatus = (data) => {
      if (data.accountId === parseInt(selectedAccount)) {
        setBotStatus((prev) => {
          // Track status change in timeline
          if (prev?.status !== data.status) {
            addStatusEvent(data.status)
          }
          return { ...prev, status: data.status }
        })
      }
    }

    const handleBotLog = (data) => {
      if (data.accountId === parseInt(selectedAccount)) {
        setLogs((prev) => [data, ...prev].slice(0, 100))
      }
    }

    onBotStatus(handleBotStatus)
    onBotLog(handleBotLog)

    return () => {
      offBotStatus(handleBotStatus)
      offBotLog(handleBotLog)
    }
  }, [selectedAccount])

  useEffect(() => {
    if (selectedAccount) {
      loadBotStatus()
      loadLogs()
    }
  }, [selectedAccount])

  const loadBotStatus = async () => {
    try {
      const data = await bots.getStatus(selectedAccount)
      setBotStatus(data)
    } catch (err) {
      console.error('Failed to load bot status:', err)
    }
  }

  const loadLogs = async () => {
    try {
      const data = await bots.getLogs(selectedAccount, 50)
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
  }

  const handleStart = async () => {
    setError('')
    setActionLoading(true)
    try {
      const data = await bots.start(selectedAccount)
      if (data.error) {
        setError(friendlyError(data.error))
        addStatusEvent('error', friendlyError(data.error))
      } else {
        setBotStatus((prev) => ({ ...prev, status: 'starting' }))
        addStatusEvent('starting', 'Bot start requested')
      }
    } catch (err) {
      setError(friendlyError(err.message || 'Failed to start bot'))
      addStatusEvent('error', friendlyError(err.message || 'Failed to start bot'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleStop = async () => {
    setError('')
    setActionLoading(true)
    try {
      const data = await bots.stop(selectedAccount)
      if (data.error) {
        // "Bot is not running" means it already stopped (crashed or was stopped) - treat as success
        if (data.error === 'Bot is not running') {
          setBotStatus((prev) => ({ ...prev, status: 'stopped' }))
          addStatusEvent('stopped', 'Bot was already stopped')
        } else {
          setError(friendlyError(data.error))
          addStatusEvent('error', friendlyError(data.error))
        }
      } else {
        setBotStatus((prev) => ({ ...prev, status: 'stopped' }))
        addStatusEvent('stopped', 'Bot stop requested')
      }
    } catch (err) {
      // "Bot is not running" means it already stopped - treat as success, not error
      if (err.message === 'Bot is not running') {
        setBotStatus((prev) => ({ ...prev, status: 'stopped' }))
        addStatusEvent('stopped', 'Bot was already stopped')
      } else {
        setError(friendlyError(err.message || 'Failed to stop bot'))
        addStatusEvent('error', friendlyError(err.message || 'Failed to stop bot'))
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Clear status history
  const clearStatusHistory = () => {
    setStatusHistory([])
    localStorage.removeItem('botStatusHistory')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'success'
      case 'starting': return 'warning'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'running': return theme.palette.success.main
      case 'starting': return theme.palette.warning.main
      case 'error': return theme.palette.error.main
      default: return theme.palette.text.disabled
    }
  }

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return theme.palette.error.main
      case 'warn': return theme.palette.warning.main
      case 'info': return theme.palette.success.main
      default: return theme.palette.text.secondary
    }
  }

  const isDark = theme.palette.mode === 'dark'

  const { sectionBox } = useSectionStyles()

  if (loading) {
    return <BotControlSkeleton />
  }

  return (
    <Box>
      <PageHeader
        icon={<BotIcon />}
        title="Friend Acceptor Bot"
        subtitle="Manage and monitor your bot instance"
      />

      {linkedAccounts.length === 0 ? (
        <Box sx={sectionBox}>
          <EmptyState
            icon={<BotIcon sx={{ fontSize: 56 }} />}
            title="No Accounts Linked"
            description="Go to Link Account to add an account first."
          />
        </Box>
      ) : (
        <>
          {/* Controls */}
          <FadeIn>
            <Box sx={{ ...sectionBox, mb: 2 }}>
              {/* Section label */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BotIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                <Typography variant="caption" fontWeight={600} color="primary.main" textTransform="uppercase" letterSpacing={0.8}>
                  Bot Controls
                </Typography>
              </Box>

              {/* Controls row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 200 }} size="small">
                  <InputLabel>Select Account</InputLabel>
                  <Select
                    value={selectedAccount}
                    onChange={(e) => selectAccount(parseInt(e.target.value))}
                    label="Select Account"
                  >
                    {linkedAccounts.map((account) => (
                      <MenuItem key={account.id} value={account.id.toString()}>
                        {account.nickname || `Account ${account.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Status dot + chip */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: getStatusDotColor(botStatus?.status),
                      boxShadow: botStatus?.status === 'running'
                        ? `0 0 0 3px ${theme.palette.success.main}22`
                        : 'none',
                    }}
                  />
                  <Chip
                    label={botStatus?.status || 'Unknown'}
                    color={getStatusColor(botStatus?.status)}
                    size="small"
                    sx={{ textTransform: 'capitalize', height: 22, fontSize: '0.72rem' }}
                  />
                </Box>

                {botStatus?.status === 'running' || botStatus?.status === 'starting' ? (
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    startIcon={actionLoading ? <CircularProgress size={16} /> : <StopIcon />}
                    onClick={handleStop}
                    disabled={actionLoading}
                    sx={{ borderRadius: '8px' }}
                  >
                    Stop Bot
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={actionLoading ? <CircularProgress size={16} /> : <PlayIcon />}
                    onClick={handleStart}
                    disabled={actionLoading}
                    sx={{ borderRadius: '8px' }}
                  >
                    Start Bot
                  </Button>
                )}
              </Box>

              {error && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: '10px' }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              {/* Stats inline strip */}
              {botStatus?.stats && (
                <Box
                  sx={{
                    mt: 2, pt: 2,
                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    display: 'flex', gap: 3, flexWrap: 'wrap',
                  }}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={700} lineHeight={1}>
                      {botStatus.stats.friendRequestsAccepted || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Accepted</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} lineHeight={1} color="error.main">
                      {botStatus.stats.errors || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Errors</Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </FadeIn>

          {/* Status Timeline */}
          <FadeIn delay={0.05}>
            <Box sx={{ ...sectionBox, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon sx={{ fontSize: 16, color: theme.palette.info.main }} />
                  <Typography variant="caption" fontWeight={600} color="info.main" textTransform="uppercase" letterSpacing={0.8}>
                    Status Timeline
                  </Typography>
                  <Chip label={statusHistory.length} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.68rem' }} />
                </Box>
                <Button
                  size="small"
                  onClick={clearStatusHistory}
                  disabled={statusHistory.length === 0}
                  sx={{ fontSize: '0.72rem', py: 0.25 }}
                >
                  Clear
                </Button>
              </Box>

              {statusHistory.length === 0 ? (
                <EmptyState
                  icon={<TimelineIcon sx={{ fontSize: 40 }} />}
                  title="No status events yet"
                  description="Start or stop the bot to see status changes."
                  minHeight={100}
                />
              ) : (
                <Box sx={{ maxHeight: 200, overflow: 'auto', pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
                  {statusHistory.slice(0, 20).map((event) => (
                    <Box
                      key={event.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.5,
                        py: 0.75,
                        position: 'relative',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: -14,
                          top: 11,
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          bgcolor: event.status === 'running' ? theme.palette.success.main :
                                  event.status === 'error' ? theme.palette.error.main :
                                  event.status === 'starting' ? theme.palette.warning.main : theme.palette.text.secondary,
                        },
                      }}
                    >
                      {getStatusIcon(event.status)}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} fontSize="0.8rem">
                          {friendlyLog(event.message)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                          {formatTime(event.timestamp)}
                        </Typography>
                      </Box>
                      <Chip
                        label={event.status}
                        size="small"
                        color={event.status === 'running' ? 'success' :
                               event.status === 'error' ? 'error' :
                               event.status === 'starting' ? 'warning' : 'default'}
                        sx={{ textTransform: 'capitalize', height: 18, fontSize: '0.65rem', flexShrink: 0 }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </FadeIn>

          {/* Log Console */}
          <FadeIn delay={0.1}>
            <Box sx={sectionBox}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BotIcon sx={{ fontSize: 16, color: theme.palette.secondary.main }} />
                <Typography variant="caption" fontWeight={600} color="secondary.main" textTransform="uppercase" letterSpacing={0.8}>
                  Bot Logs
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                  borderRadius: '10px',
                  p: 1.5,
                  maxHeight: 400,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 11.5,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {logs.length === 0 ? (
                  <Typography color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                    No logs yet. Start the bot to see activity.
                  </Typography>
                ) : (
                  logs.map((log, index) => (
                    <Box
                      key={index}
                      sx={{
                        mb: 0.4,
                        color: getLogColor(log.level),
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.5,
                      }}
                    >
                      [{formatTime(log.timestamp || log.created_at)}] [{log.level?.toUpperCase()}] {friendlyLog(log.message)}
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </FadeIn>
        </>
      )}
    </Box>
  )
}

export default Bot
