import { useState, useEffect, useCallback } from 'react'
import PageHeader from '../components/PageHeader'
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Tooltip,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material'
import {
  Schedule as ScheduleIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Timer as TimerIcon,
  Security as SecurityIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  InfoOutlined as InfoIcon,
  People as PeopleIcon,
  PlaylistPlay as StartAllIcon,
  StopCircle as StopAllIcon,
} from '@mui/icons-material'
import { automation, fetchWithAuth } from '../services/api'
import ContainerPackConfigPanel from '../components/admin/ContainerPackConfigPanel'
import { formatDateTime } from '../utils/dateFormat'
import DataTable from '../components/DataTable'
import { FadeIn } from '../components/Animations'
import { FormPageSkeleton } from '../components/skeletons/PageSkeletons'
import { useSectionStyles } from '../components/SectionCard'

const CONTAINER_COLORS = {
  1: '#4caf50', // green
  2: '#ff9800', // orange
  3: '#2196f3', // blue
  4: '#9c27b0', // purple
}

const CONTAINER_LABELS = {
  1: 'C1',
  2: 'C2',
  3: 'C3',
  4: 'C4',
}

function AutomationScheduler() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [config, setConfig] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startingIds, setStartingIds] = useState(new Set())
  const [stoppingIds, setStoppingIds] = useState(new Set())
  const [startingAll, setStartingAll] = useState(false)
  const [stoppingAll, setStoppingAll] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null) // 'start-all' | 'stop-all' | null
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const [packMode, setPackMode] = useState('DYNAMIC')
  const [instances, setInstances] = useState(30)
  const [timeLimit, setTimeLimit] = useState(0)

  const [runHistory, setRunHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Per-container pack config — used to override the Pack column in the
  // Run History table. The legacy "packMode" field on each history row
  // reflects what the scheduler PASSED at startup (the legacy single
  // dropdown), but workers now resolve packs FIRST from container_pack_config.
  // When a row's container has a saved config, show that instead of the
  // misleading legacy startup label.
  const [containerPackConfigs, setContainerPackConfigs] = useState([])
  const loadContainerPackConfigs = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/container-pack-config')
      if (!r.ok) return
      const data = await r.json()
      setContainerPackConfigs(data.containers || [])
    } catch { /* non-fatal — fall back to legacy display */ }
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const [configData, statusData] = await Promise.all([
        automation.getConfig(),
        automation.getStatus(),
      ])
      setConfig(configData)
      setStatus(statusData)

      // Default pack to the newest pack from backend
      if (configData.defaultPack) {
        setPackMode(prev => prev === 'DYNAMIC' ? configData.defaultPack : prev)
      }

      try {
        const historyData = await automation.getHistory()
        setRunHistory(historyData.history || [])
        await automation.syncHistory()
      } catch (historyError) {
        setRunHistory([])
      }
    } catch (error) {
      console.error('Failed to load config:', error)
      setSnackbar({ open: true, message: `Failed to load config: ${error.message}`, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadContainerPackConfigs()
    const interval = setInterval(async () => {
      try {
        const statusData = await automation.getStatus()
        setStatus(statusData)

        const syncResult = await automation.syncHistory()
        if (syncResult.synced > 0) {
          const historyData = await automation.getHistory()
          setRunHistory(historyData.history || [])
        }
      } catch (e) {
        // Ignore errors during refresh
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [loadConfig])

  const huntTypes = config?.huntTypes || []
  const runningHunts = status?.hunts?.filter(h => h.status === 'running') || []
  const anyRunning = runningHunts.length > 0
  const allRunning = huntTypes.length > 0 && runningHunts.length === huntTypes.length

  const getHuntStatus = (huntId) => {
    return status?.hunts?.find(h => h.id === huntId) || null
  }

  const handleStartSingle = async (huntType) => {
    if (startingIds.has(huntType)) return

    setStartingIds(prev => new Set([...prev, huntType]))
    const run = {
      id: `run_${Date.now()}_${huntType}`,
      huntType,
      packMode,
      instances,
      timeLimit,
      status: 'running',
      startedAt: new Date().toISOString(),
    }

    try {
      const result = await automation.start({
        huntType,
        packMode,
        instances,
        timeLimit,
      })

      if (result.success) {
        run.huntId = result.huntId
        await automation.saveHistory(run)
        const historyData = await automation.getHistory()
        setRunHistory(historyData.history || [])
        setSnackbar({ open: true, message: result.message || `${huntType} started`, severity: 'success' })
        const statusData = await automation.getStatus()
        setStatus(statusData)
      } else {
        throw new Error(result.error || 'Failed to start hunt')
      }
    } catch (error) {
      run.status = 'failed'
      run.error = error.message
      try {
        await automation.saveHistory(run)
        const historyData = await automation.getHistory()
        setRunHistory(historyData.history || [])
      } catch (saveError) { /* ignore */ }
      setSnackbar({ open: true, message: `Failed to start: ${error.message}`, severity: 'error' })
    } finally {
      setStartingIds(prev => {
        const next = new Set(prev)
        next.delete(huntType)
        return next
      })
    }
  }

  const handleStopSingle = async (huntId) => {
    if (stoppingIds.has(huntId)) return

    setStoppingIds(prev => new Set([...prev, huntId]))
    try {
      const result = await automation.stop(huntId)
      if (result.success) {
        setSnackbar({ open: true, message: `${huntId} stopped`, severity: 'success' })

        const runEntry = runHistory.find(r => r.huntType === huntId && r.status === 'running')
        if (runEntry) {
          await automation.updateHistory(runEntry.id, {
            status: 'stopped',
            stoppedAt: new Date().toISOString(),
          })
          const historyData = await automation.getHistory()
          setRunHistory(historyData.history || [])
        }

        const statusData = await automation.getStatus()
        setStatus(statusData)
      } else {
        throw new Error(result.error || 'Failed to stop hunt')
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to stop: ${error.message}`, severity: 'error' })
    } finally {
      setStoppingIds(prev => {
        const next = new Set(prev)
        next.delete(huntId)
        return next
      })
    }
  }

  const handleStartAll = async () => {
    if (startingAll) return
    setStartingAll(true)

    const stoppedHunts = huntTypes.filter(h => {
      const s = getHuntStatus(h.id)
      return !s || s.status !== 'running'
    })

    let started = 0
    let failed = 0

    for (const hunt of stoppedHunts) {
      try {
        const result = await automation.start({
          huntType: hunt.id,
          packMode,
          instances,
          timeLimit,
        })
        if (result.success) {
          started++
          const run = {
            id: `run_${Date.now()}_${hunt.id}`,
            huntType: hunt.id,
            packMode,
            instances,
            timeLimit,
            status: 'running',
            startedAt: new Date().toISOString(),
            huntId: result.huntId,
          }
          try { await automation.saveHistory(run) } catch (e) { /* ignore */ }
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }

    try {
      const [statusData, historyData] = await Promise.all([
        automation.getStatus(),
        automation.getHistory(),
      ])
      setStatus(statusData)
      setRunHistory(historyData.history || [])
    } catch (e) { /* ignore */ }

    if (failed === 0) {
      setSnackbar({ open: true, message: `All ${started} containers started`, severity: 'success' })
    } else {
      setSnackbar({ open: true, message: `${started} started, ${failed} failed`, severity: 'warning' })
    }

    setStartingAll(false)
  }

  const handleStopAll = async () => {
    if (stoppingAll) return
    setStoppingAll(true)

    let stopped = 0
    let failed = 0

    for (const hunt of runningHunts) {
      try {
        const result = await automation.stop(hunt.id)
        if (result.success) {
          stopped++
          const runEntry = runHistory.find(r => r.huntType === hunt.id && r.status === 'running')
          if (runEntry) {
            try {
              await automation.updateHistory(runEntry.id, {
                status: 'stopped',
                stoppedAt: new Date().toISOString(),
              })
            } catch (e) { /* ignore */ }
          }
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }

    try {
      const [statusData, historyData] = await Promise.all([
        automation.getStatus(),
        automation.getHistory(),
      ])
      setStatus(statusData)
      setRunHistory(historyData.history || [])
    } catch (e) { /* ignore */ }

    if (failed === 0) {
      setSnackbar({ open: true, message: `All ${stopped} containers stopped`, severity: 'success' })
    } else {
      setSnackbar({ open: true, message: `${stopped} stopped, ${failed} failed`, severity: 'warning' })
    }

    setStoppingAll(false)
  }

  const handleStartJwt = async () => {
    try {
      const result = await automation.startJwt()
      setSnackbar({ open: true, message: result.message || 'JWT server started', severity: 'success' })
      const configData = await automation.getConfig()
      setConfig(configData)
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to start JWT server: ${error.message}`, severity: 'error' })
    }
  }

  const clearHistory = async () => {
    try {
      setHistoryLoading(true)
      await automation.clearHistory()
      setRunHistory([])
      setSnackbar({ open: true, message: 'History cleared', severity: 'info' })
    } catch (error) {
      setSnackbar({ open: true, message: `Failed to clear history: ${error.message}`, severity: 'error' })
    } finally {
      setHistoryLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <PendingIcon sx={{ color: theme.palette.warning.main }} />
      case 'completed': return <SuccessIcon sx={{ color: theme.palette.success.main }} />
      case 'stopped': return <StopIcon sx={{ color: theme.palette.text.secondary }} />
      case 'failed': return <ErrorIcon sx={{ color: theme.palette.error.main }} />
      default: return <PendingIcon sx={{ color: theme.palette.text.secondary }} />
    }
  }

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'running': return theme.palette.warning.main
      case 'completed': return theme.palette.success.main
      case 'stopped': return theme.palette.text.secondary
      case 'failed': return theme.palette.error.main
      default: return theme.palette.text.secondary
    }
  }

  const getPackLabel = (packId) => {
    if (!config) return packId
    const pack = config.packs?.find(p => p.id === packId)
    if (pack) return `${pack.name} (${pack.expansion})`
    const random = config.randomModes?.find(r => r.id === packId)
    if (random) return random.name
    return packId
  }

  const getTimeLimitLabel = (minutes) => {
    if (!minutes || minutes === 0) return 'Unlimited'
    if (minutes < 60) return `${minutes} min`
    if (minutes === 60) return '1 hour'
    if (minutes < 1440) return `${Math.round(minutes / 60)} hours`
    return `${Math.round(minutes / 1440)} days`
  }

  const { sectionBox } = useSectionStyles()

  if (loading) {
    return <FormPageSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      <PageHeader
        icon={<ScheduleIcon />}
        title="Automation Scheduler"
        subtitle="Configure and run headless reroll hunts across 3 containers"
        action={
          <IconButton onClick={loadConfig} disabled={loading} aria-label="Refresh configuration">
            <RefreshIcon />
          </IconButton>
        }
      />

      {/* Top Status Row */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Box sx={{ ...sectionBox, textAlign: 'center' }}>
            <SecurityIcon sx={{ fontSize: 32, color: (config?.system?.jwtServerRunning && config?.system?.postgresRunning) ? theme.palette.success.main : theme.palette.error.main, mb: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Docker Services
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap', mt: 1 }}>
              <Chip
                icon={config?.system?.jwtServerRunning ? <CheckIcon /> : <CloseIcon />}
                label="JWT"
                color={config?.system?.jwtServerRunning ? 'success' : 'error'}
                size="small"
              />
              <Chip
                icon={config?.system?.postgresRunning ? <CheckIcon /> : <CloseIcon />}
                label="Postgres"
                color={config?.system?.postgresRunning ? 'success' : 'error'}
                size="small"
              />
            </Box>
            {!config?.system?.jwtServerRunning && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleStartJwt}
                sx={{ mt: 1, display: 'block', mx: 'auto' }}
              >
                Start JWT
              </Button>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Box sx={{ ...sectionBox, textAlign: 'center' }}>
            <PeopleIcon sx={{ fontSize: 32, color: theme.palette.warning.main, mb: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Eligible Accounts
            </Typography>
            <Typography variant="h4" color="warning.main" fontWeight={700}>
              {config?.system?.eligibleAccounts || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              95+ packs, ready to hunt
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Box sx={{ ...sectionBox, textAlign: 'center' }}>
            <SettingsIcon sx={{ fontSize: 32, color: anyRunning ? theme.palette.success.main : theme.palette.text.secondary, mb: 1 }} />
            <Typography variant="h6" fontWeight={600}>
              Containers Active
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ color: anyRunning ? theme.palette.success.main : theme.palette.text.secondary }}>
              {runningHunts.length} / {huntTypes.length}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Warnings */}
      {(!config?.system?.jwtServerRunning || !config?.system?.postgresRunning) && (
        <Alert severity="warning" sx={{ mb: 3 }} action={
          !config?.system?.jwtServerRunning && (
            <Button color="inherit" size="small" onClick={handleStartJwt}>Start JWT</Button>
          )
        }>
          {!config?.system?.jwtServerRunning && !config?.system?.postgresRunning
            ? 'Docker services not running. Start JWT and Postgres containers first.'
            : !config?.system?.jwtServerRunning
              ? 'JWT Server not running. Click "Start JWT" to launch the container.'
              : 'Postgres not running. Start the postgres container via docker-compose.'}
        </Alert>
      )}

      {config?.system?.eligibleAccounts === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No eligible accounts found. Headless reroll needs accounts with 95+ packs opened.
        </Alert>
      )}

      {/* Per-container pack configuration — primary control surface.
          Workers consult this FIRST. The legacy single-pack dropdown
          below is used only for containers with NO per-container row.
          onChange refreshes our local copy so the Run History pack
          column reflects the new config without a page reload. */}
      <ContainerPackConfigPanel onChange={loadContainerPackConfigs} />

      {/* Hunt Settings */}
      <Box sx={{ ...sectionBox, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <ScheduleIcon sx={{ color: theme.palette.secondary.main }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Hunt Settings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              These settings apply to all containers when starting.
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem', py: 0.5 }}>
          <strong>Pack Selection</strong> below is the legacy global default. Containers configured in
          <strong>&nbsp;Per-Container Pack Configuration</strong> above ignore this value and use their own pack list.
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Pack Selection (legacy fallback)</InputLabel>
              <Select
                value={packMode}
                onChange={(e) => setPackMode(e.target.value)}
                label="Pack Selection (legacy fallback)"
              >
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary">--- SPECIFIC PACKS ---</Typography>
                </MenuItem>
                {config?.packs?.map((pack) => (
                  <MenuItem key={pack.id} value={pack.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {pack.isNewest && <Chip label="NEW" size="small" color="secondary" sx={{ height: 18, fontSize: 10 }} />}
                      <span>{pack.name}</span>
                      <Typography variant="caption" color="text.secondary">({pack.expansion})</Typography>
                    </Box>
                  </MenuItem>
                ))}
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary">--- RANDOM MODES ---</Typography>
                </MenuItem>
                {config?.randomModes?.map((mode) => (
                  <MenuItem key={mode.id} value={mode.id}>
                    <Box>
                      <Typography>{mode.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{mode.description}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography gutterBottom>
              Instance Count: <strong>{instances}</strong>
              <Tooltip title="Number of parallel Docker workers per container. Each worker uses a dedicated proxy slot.">
                <IconButton size="small" aria-label="Instance count info"><InfoIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Typography>
            <Slider
              value={instances}
              onChange={(e, val) => setInstances(val)}
              min={1}
              max={35}
              step={1}
              marks={[
                { value: 5, label: '5' },
                { value: 10, label: '10' },
                { value: 20, label: '20' },
                { value: 30, label: '30' },
                { value: 35, label: '35' },
              ]}
              valueLabelDisplay="auto"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Time Limit</InputLabel>
              <Select
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                label="Time Limit"
              >
                {config?.timeLimits?.map((limit) => (
                  <MenuItem key={limit.value} value={limit.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TimerIcon fontSize="small" color="action" />
                      <span>{limit.label}</span>
                      {limit.default && <Chip label="Default" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Start All / Stop All buttons */}
        <Box sx={{ borderTop: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`, mt: 3, pt: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {!allRunning && (
              <Button
                variant="contained"
                size="large"
                startIcon={startingAll ? <CircularProgress size={20} color="inherit" /> : <StartAllIcon />}
                onClick={() => setConfirmDialog('start-all')}
                disabled={startingAll || stoppingAll || config?.system?.eligibleAccounts === 0}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  '&:disabled': { background: 'grey.400' },
                }}
              >
                {startingAll ? 'Starting All...' : anyRunning ? 'Start Remaining' : 'Start All Containers'}
              </Button>
            )}

            {anyRunning && (
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={stoppingAll ? <CircularProgress size={20} color="inherit" /> : <StopAllIcon />}
                onClick={() => setConfirmDialog('stop-all')}
                disabled={startingAll || stoppingAll}
                sx={{ px: 4, py: 1.5 }}
              >
                {stoppingAll ? 'Stopping All...' : 'Stop All Containers'}
              </Button>
            )}

            <Box sx={{ ml: 'auto' }}>
              <Typography variant="body2" color="text.secondary">
                <strong>{getPackLabel(packMode)}</strong> |
                <strong> {instances}</strong> instances |
                <strong> {getTimeLimitLabel(timeLimit)}</strong>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Per-Container Status Cards */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon /> Container Status
      </Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {huntTypes.map((hunt) => {
          const huntStatus = getHuntStatus(hunt.id)
          const isRunning = huntStatus?.status === 'running'
          const isStarting = startingIds.has(hunt.id)
          const isStopping = stoppingIds.has(hunt.id)
          const groupNum = parseInt(hunt.containerGroup) || 1
          const color = CONTAINER_COLORS[groupNum] || theme.palette.text.secondary
          const label = CONTAINER_LABELS[groupNum] || `C${groupNum}`

          return (
            <Grid item xs={12} md={4} key={hunt.id}>
              <Box sx={{
                ...sectionBox,
                borderColor: isRunning ? `${color}60` : undefined,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {isRunning && (
                  <LinearProgress
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      '& .MuiLinearProgress-bar': { bgcolor: color },
                      bgcolor: `${color}20`,
                    }}
                  />
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: `${color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color }}>
                      {label}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {hunt.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hunt.description}
                    </Typography>
                  </Box>
                  {(() => {
                    // Prefer canonical health.state from backend evaluator.
                    // Falls back to docker status when health is absent
                    // (older backend / evaluator error). Maps each
                    // closed-set state to a chip label + color so the
                    // operator sees "Workers Down" instead of an
                    // ambiguous "Running" while the hunt monitor says OFF.
                    const h = huntStatus?.health
                    let chipLabel = isRunning ? 'Running' : huntStatus?.status === 'exited' ? 'Stopped' : 'Idle'
                    let chipColor = isRunning ? color : theme.palette.text.secondary
                    let chipBg    = isRunning ? `${color}20` : undefined
                    let reasonText = null
                    if (h && h.state) {
                      reasonText = h.reason || null
                      switch (h.state) {
                        case 'RUNNING_HEALTHY':         chipLabel = 'Running'; break
                        case 'RUNNING_DEGRADED':        chipLabel = 'Degraded';        chipColor = theme.palette.warning.main; chipBg = `${theme.palette.warning.main}20`; break
                        case 'IDLE':                    chipLabel = 'Idle';            chipColor = theme.palette.text.secondary; chipBg = undefined; break
                        case 'STOPPED':                 chipLabel = 'Stopped';         chipColor = theme.palette.text.secondary; chipBg = undefined; break
                        case 'FAILED_START':            chipLabel = 'Failed Start';    chipColor = theme.palette.error.main; chipBg = `${theme.palette.error.main}20`; break
                        case 'WORKERS_ZERO_UNEXPECTED': chipLabel = 'Workers Down';    chipColor = theme.palette.error.main; chipBg = `${theme.palette.error.main}20`; break
                        case 'BOOTSTRAP_FAILED':        chipLabel = 'Bootstrap Failed';chipColor = theme.palette.error.main; chipBg = `${theme.palette.error.main}20`; break
                        case 'STALE_RUNTIME':           chipLabel = 'Stale';           chipColor = theme.palette.warning.main; chipBg = `${theme.palette.warning.main}20`; break
                        default: break
                      }
                    }
                    return (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                        <Chip
                          label={chipLabel}
                          size="small"
                          sx={{ bgcolor: chipBg, color: chipColor, fontWeight: 600 }}
                        />
                        {reasonText && reasonText !== 'Running with active workers' && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, maxWidth: 220, textAlign: 'right' }}>
                            {reasonText}
                          </Typography>
                        )}
                      </Box>
                    )
                  })()}
                </Box>

                {/* Container stats when running */}
                {isRunning && huntStatus?.stats && (
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      CPU: <strong>{huntStatus.stats.cpu}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Memory: <strong>{huntStatus.stats.memory}</strong>
                    </Typography>
                  </Box>
                )}

                {isRunning && huntStatus?.packMode && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    {getPackLabel(huntStatus.packMode)} | {huntStatus.instances} instances
                    {huntStatus.startedAt && <> | Started {formatDateTime(huntStatus.startedAt)}</>}
                  </Typography>
                )}

                {/* Scheduled stop info */}
                {huntStatus?.scheduledStop && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 2, color: theme.palette.warning.main }}>
                    Auto-stop in {Math.round((huntStatus.timeRemaining || 0) / 60000)} min
                  </Typography>
                )}

                {/* Start / Stop button */}
                {isRunning ? (
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={isStopping ? <CircularProgress size={16} color="inherit" /> : <StopIcon />}
                    onClick={() => handleStopSingle(hunt.id)}
                    disabled={isStopping || stoppingAll}
                    size="small"
                  >
                    {isStopping ? 'Stopping...' : `Stop ${label}`}
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={isStarting ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                    onClick={() => handleStartSingle(hunt.id)}
                    disabled={isStarting || startingAll || config?.system?.eligibleAccounts === 0}
                    size="small"
                    sx={{
                      borderColor: `${color}60`,
                      color,
                      '&:hover': { borderColor: color, bgcolor: `${color}10` },
                    }}
                  >
                    {isStarting ? 'Starting...' : `Start ${label}`}
                  </Button>
                )}
              </Box>
            </Grid>
          )
        })}
      </Grid>

      {/* Run History */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon /> Run History
        </Typography>
        {runHistory.length > 0 && (
          <Button size="small" color="error" onClick={clearHistory} disabled={historyLoading}>
            {historyLoading ? 'Clearing...' : 'Clear History'}
          </Button>
        )}
      </Box>

      <DataTable
        columns={[
          {
            id: 'huntType',
            label: 'Container',
            sortable: true,
            render: (row) => {
              const hunt = huntTypes.find(h => h.id === row.huntType)
              const groupNum = hunt ? parseInt(hunt.containerGroup) : 0
              const color = CONTAINER_COLORS[groupNum] || theme.palette.text.secondary
              const label = CONTAINER_LABELS[groupNum] || (groupNum ? `C${groupNum}` : row.huntType)
              return (
                <Chip
                  label={label}
                  size="small"
                  sx={{ bgcolor: `${color}20`, color, fontWeight: 700 }}
                />
              )
            },
          },
          {
            id: 'packMode',
            label: 'Pack',
            sortable: true,
            // Display rule: if the row's container has a saved per-container
            // pack config, render that (it's the source of truth that
            // workers actually consult). Otherwise fall back to the
            // legacy startup packMode label. This fixes the "all rows
            // show Mega Shine" display bug — runtime was already correct,
            // only the display was reading the stale legacy startup field.
            render: (row) => {
              const hunt = huntTypes.find(h => h.id === row.huntType)
              const groupNum = hunt ? parseInt(hunt.containerGroup) : 0
              const cfg = containerPackConfigs.find(c => c.containerGroup === groupNum)
              if (cfg && cfg.mode && Array.isArray(cfg.packs) && cfg.packs.length > 0) {
                const labels = cfg.packs.map(name => getPackLabel(name))
                if (cfg.mode === 'fixed') {
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2">{labels[0]}</Typography>
                      <Chip label="fixed" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50', fontWeight: 700 }} />
                    </Box>
                  )
                }
                // pool — show all packs as chips, with mode badge
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {labels.map((lbl, i) => (
                      <Chip key={i} label={lbl} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                    ))}
                    <Chip label={`pool · ${labels.length}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(33,150,243,0.15)', color: '#2196f3', fontWeight: 700 }} />
                  </Box>
                )
              }
              // No per-container config — show legacy startup pack with explicit "(legacy)" badge
              // so it's never ambiguous which path the worker took.
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="body2">{getPackLabel(row.packMode)}</Typography>
                  <Chip label="legacy" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(158,158,158,0.15)', color: 'text.secondary' }} />
                </Box>
              )
            },
          },
          {
            id: 'instances',
            label: 'Instances',
            sortable: true,
            align: 'center',
          },
          {
            id: 'status',
            label: 'Status',
            sortable: true,
            render: (row) => (
              <Chip
                icon={getStatusIcon(row.status)}
                label={row.status}
                size="small"
                sx={{
                  bgcolor: `${getStatusChipColor(row.status)}20`,
                  color: getStatusChipColor(row.status),
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              />
            ),
          },
          {
            id: 'startedAt',
            label: 'Started',
            sortable: true,
            format: (val) => formatDateTime(val),
          },
          {
            id: 'duration',
            label: 'Duration',
            render: (row) => (
              <Typography variant="body2">
                {row.stoppedAt || row.completedAt
                  ? `${Math.round((new Date(row.stoppedAt || row.completedAt) - new Date(row.startedAt)) / 60000)} min`
                  : row.status === 'running' ? 'Running...' : '-'}
              </Typography>
            ),
          },
        ]}
        rows={runHistory}
        loading={historyLoading}
        searchable={false}
        pageSize={20}
        emptyMessage="No hunt history yet. Start a hunt to see results here."
        emptyIcon={<HistoryIcon sx={{ fontSize: 56 }} />}
        rowKey="id"
      />

      {/* Confirmation Dialog for Start All / Stop All */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {confirmDialog === 'start-all' ? 'Start All Containers?' : 'Stop All Containers?'}
        </DialogTitle>
        <DialogContent>
          <Alert severity={confirmDialog === 'stop-all' ? 'error' : 'warning'} sx={{ borderRadius: '10px', mb: 1 }}>
            {confirmDialog === 'start-all'
              ? `This will start all stopped hunt containers. Running hunts will trigger "another login detected" on mobile.`
              : `This will stop all running hunt containers immediately. Active hunts will be interrupted.`
            }
          </Alert>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {confirmDialog === 'start-all'
              ? `${huntTypes.filter(h => { const s = getHuntStatus(h.id); return !s || s.status !== 'running' }).length} container(s) will be started.`
              : `${runningHunts.length} container(s) will be stopped.`
            }
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDialog(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmDialog === 'stop-all' ? 'error' : 'primary'}
            onClick={() => { setConfirmDialog(null); confirmDialog === 'start-all' ? handleStartAll() : handleStopAll() }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {confirmDialog === 'start-all' ? 'Start All' : 'Stop All'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  )
}

export default AutomationScheduler
