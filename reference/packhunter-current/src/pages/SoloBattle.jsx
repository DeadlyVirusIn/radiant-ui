import { useState, useEffect } from 'react'
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
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  SportsEsports as BattleIcon,
  ExpandMore as ExpandIcon,
  EmojiEvents as TrophyIcon,
  Speed as SpeedIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  School as BeginnerIcon,
  TrendingUp as IntermediateIcon,
  Whatshot as AdvancedIcon,
  MilitaryTech as EliteIcon,
  Repeat as RepeatIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { accounts, soloBattle } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { getSocket, onBattleProgress, offBattleProgress } from '../services/socket'
import { Timer as TimerIcon } from '@mui/icons-material'
import PageHeader from '../components/PageHeader'
import CollapsibleHelp from '../components/CollapsibleHelp'
import LoadingButton from '../components/LoadingButton'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import { useSectionStyles } from '../components/SectionCard'

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// Difficulty icon mapping (colors are set dynamically via theme in component)
const DIFFICULTY_ICONS_STATIC = {
  Beginner: BeginnerIcon,
  Intermediate: IntermediateIcon,
  Advanced: AdvancedIcon,
  Elite: EliteIcon,
}

// Difficulty gradient backgrounds for chips
const DIFFICULTY_GRADIENTS = {
  Beginner: 'linear-gradient(135deg, #43a047, #66bb6a)',
  Intermediate: 'linear-gradient(135deg, #1e88e5, #42a5f5)',
  Advanced: 'linear-gradient(135deg, #ef6c00, #ffa726)',
  Elite: 'linear-gradient(135deg, #c62828, #ef5350)',
}

function SoloBattle({ user, embedded = false, externalAccount, externalAccounts }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const { t } = useLanguage()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { sectionBox: glassCardSx } = useSectionStyles()

  const DIFFICULTY_COLORS = {
    Beginner: theme.palette.success.main,
    Intermediate: theme.palette.info.main,
    Advanced: theme.palette.warning.main,
    Elite: theme.palette.error.main,
  }

  const DIFFICULTY_ICONS = {
    Beginner: <BeginnerIcon sx={{ color: theme.palette.success.main }} />,
    Intermediate: <IntermediateIcon sx={{ color: theme.palette.info.main }} />,
    Advanced: <AdvancedIcon sx={{ color: theme.palette.warning.main }} />,
    Elite: <EliteIcon sx={{ color: theme.palette.error.main }} />,
  }

  const [_linkedAccounts, setLinkedAccounts] = useState([])
  const [_selectedAccount, setSelectedAccount] = useState('')
  // When embedded with external account, use parent's state
  const linkedAccounts = (embedded && externalAccounts) ? externalAccounts : _linkedAccounts
  const selectedAccount = (embedded && externalAccount) ? externalAccount : _selectedAccount
  const [loading, setLoading] = useState(embedded ? false : true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Battle data
  const [stages, setStages] = useState([])
  const [completionMap, setCompletionMap] = useState({})
  const [completionStats, setCompletionStats] = useState({ completed: 0, total: 0 })
  const [selectedDifficulty, setSelectedDifficulty] = useState('Beginner')
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

  // Quick run mode
  const [quickRunDifficulties, setQuickRunDifficulties] = useState([])
  const [quickRunning, setQuickRunning] = useState(false)

  // Repeat battle menu
  const [repeatMenuAnchor, setRepeatMenuAnchor] = useState(null)
  const [repeatBattleId, setRepeatBattleId] = useState(null)
  const [repeatBattleName, setRepeatBattleName] = useState('')
  const [repeatRunning, setRepeatRunning] = useState(false)

  // Accordion open state per stage (legacy, kept for batch mode)
  const [openStages, setOpenStages] = useState({})

  // Selected pack for detail view
  const [selectedPackIndex, setSelectedPackIndex] = useState(null)

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    if (!embedded) loadAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      loadBattleData()
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
        setQuickRunning(false)
        setCurrentBattleName('')
        loadBattleData() // Refresh status
      }
    }

    onBattleProgress(handleProgress)
    return () => offBattleProgress(handleProgress)
  }, [selectedAccount])

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

  const loadBattleData = async () => {
    if (!selectedAccount) return
    setLoading(true)
    setError('')

    try {
      // Load stages and status in parallel
      const [stagesData, statusData] = await Promise.all([
        soloBattle.getStages(),
        soloBattle.getStatus(selectedAccount),
      ])

      setStages(stagesData.stages || [])
      setCompletionMap(statusData.completionMap || {})
      setCompletionStats({
        completed: statusData.completed || 0,
        total: statusData.total || 0,
        percentage: statusData.percentage || 0,
      })
    } catch (err) {
      console.error('Failed to load battle data:', err)
      setError('Failed to load battle data')
    } finally {
      setLoading(false)
    }
  }

  const runSingleBattle = async (battleId) => {
    setActionLoading(true)
    setError('')

    try {
      const result = await soloBattle.runBattle(selectedAccount, battleId, useRentalDeck)

      if (result.success) {
        setSnackbar({
          open: true,
          message: result.isFirstClear
            ? `Battle ${battleId} completed! First clear bonus!`
            : `Battle ${battleId} completed!`,
          severity: 'success',
        })
        // Refresh status
        await loadBattleData()
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

      const result = await soloBattle.runBatch(
        selectedAccount,
        battleIds,
        useRentalDeck,
        count
      )

      if (result.success) {
        setSnackbar({
          open: true,
          message: `${repeatBattleName} completed ${count}x! ${result.summary?.firstClears || 0} first clears`,
          severity: 'success',
        })
        await loadBattleData()
      }

      setBatchProgress(null)
    } catch (err) {
      console.error('Repeat battle error:', err)
      setError(friendlyError(err.message || 'Repeat battle failed'))
    } finally {
      setRepeatRunning(false)
    }
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
      const result = await soloBattle.runBatch(
        selectedAccount,
        selectedBattles,
        useRentalDeck,
        selectedBattles.length
      )

      if (result.success) {
        setSnackbar({
          open: true,
          message: `Batch complete: ${result.summary.successful}/${result.summary.total} battles won, ${result.summary.firstClears} first clears!`,
          severity: 'success',
        })
        setSelectedBattles([])
        setBatchMode(false)
        await loadBattleData()
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

  const selectAllUncompleted = (difficulty = null) => {
    const uncompleted = []
    stages.forEach(stage => {
      if (!difficulty || stage.difficulty === difficulty) {
        stage.battles.forEach(battle => {
          if (!completionMap[battle.id]?.isCleared) {
            uncompleted.push(battle.id)
          }
        })
      }
    })
    setSelectedBattles(uncompleted)
  }

  const selectAllBattles = (difficulty = null) => {
    const allBattles = []
    stages.forEach(stage => {
      if (!difficulty || stage.difficulty === difficulty) {
        stage.battles.forEach(battle => {
          allBattles.push(battle.id)
        })
      }
    })
    setSelectedBattles(allBattles)
  }

  const clearSelection = () => {
    setSelectedBattles([])
  }

  // Quick Run - toggle difficulty selection
  const toggleQuickRunDifficulty = (diff) => {
    setQuickRunDifficulties(prev =>
      prev.includes(diff) ? prev.filter(d => d !== diff) : [...prev, diff]
    )
  }

  // Quick Run - get total battle count for selected difficulties (includes completed)
  const getQuickRunBattleCount = () => {
    let count = 0
    stages.forEach(stage => {
      if (quickRunDifficulties.includes(stage.difficulty)) {
        count += stage.battles.length
      }
    })
    return count
  }

  // Quick Run - run all battles for selected difficulties (including completed ones)
  const runQuickBatch = async () => {
    const battleIds = []
    stages.forEach(stage => {
      if (quickRunDifficulties.includes(stage.difficulty)) {
        stage.battles.forEach(battle => {
          battleIds.push(battle.id)
        })
      }
    })

    if (battleIds.length === 0) {
      setSnackbar({ open: true, message: 'No battles found for selected difficulties!', severity: 'info' })
      return
    }

    setQuickRunning(true)
    setError('')
    setProgressLogs([])
    setStartTime(Date.now())
    setCurrentBattleName('')
    setBatchProgress({ current: 0, total: battleIds.length, phase: 'starting' })

    setProgressLogs([{
      time: new Date().toLocaleTimeString(),
      message: `Quick Run: ${battleIds.length} battles (${quickRunDifficulties.join(', ')})`,
      type: 'info'
    }])

    try {
      const result = await soloBattle.runBatch(
        selectedAccount,
        battleIds,
        useRentalDeck,
        battleIds.length
      )

      if (result.success) {
        setSnackbar({
          open: true,
          message: `Quick Run complete: ${result.summary.successful}/${result.summary.total} battles won, ${result.summary.firstClears} first clears!`,
          severity: 'success',
        })
        await loadBattleData()
      }

      setBatchProgress(null)
    } catch (err) {
      console.error('Quick run error:', err)
      setError(friendlyError(err.message || 'Quick run failed'))
    } finally {
      setQuickRunning(false)
    }
  }

  // Filter stages by selected difficulty (always one difficulty at a time)
  const filteredStages = stages.filter(s => s.difficulty === selectedDifficulty)

  // Calculate stats per difficulty
  const getStatsForDifficulty = (difficulty) => {
    const diffStages = stages.filter(s => s.difficulty === difficulty)
    let total = 0
    let completed = 0
    diffStages.forEach(stage => {
      stage.battles.forEach(battle => {
        total++
        if (completionMap[battle.id]?.isCleared) completed++
      })
    })
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  // Toggle stage accordion open state
  const toggleStage = (index) => {
    setOpenStages(prev => ({ ...prev, [index]: !prev[index] }))
  }

  // Initialize open stages when filteredStages changes (open incomplete by default)
  useEffect(() => {
    if (filteredStages.length > 0) {
      const initial = {}
      filteredStages.forEach((stage, i) => {
        const completedCount = stage.battles.filter(b => completionMap[b.id]?.isCleared).length
        const allCompleted = completedCount === stage.battles.length
        initial[i] = !allCompleted
      })
      setOpenStages(initial)
    }
  }, [stages, selectedDifficulty])

  // Shared progress panel renderer
  const renderProgressPanel = (isRunning, progressColor) => (
    <Box
      sx={{
        mt: 2,
        p: 2,
        borderRadius: '10px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
      }}
    >
      {/* Progress bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={batchProgress ? (batchProgress.current / batchProgress.total) * 100 : 0}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              '& .MuiLinearProgress-bar': {
                background: batchProgress && batchProgress.current === batchProgress.total
                  ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                  : `linear-gradient(90deg, ${progressColor}, ${theme.palette.primary.main})`,
                borderRadius: 4,
              },
            }}
          />
        </Box>
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 56, textAlign: 'right', fontSize: 13 }}>
          {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : '0/0'}
        </Typography>
      </Box>

      {/* Status + ETA row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: progressLogs.length > 0 ? 1 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isRunning && <CircularProgress size={12} sx={{ color: progressColor }} />}
          <Typography variant="caption" color="text.secondary">
            {currentBattleName ? `Running: ${currentBattleName}` : batchProgress?.phase === 'complete' ? 'Complete!' : 'Preparing...'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TimerIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">
            ETA: {calculateETA()}
          </Typography>
        </Box>
      </Box>

      {/* Activity log */}
      {progressLogs.length > 0 && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            maxHeight: 130,
            overflowY: 'auto',
            borderRadius: '8px',
            bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            fontFamily: 'monospace',
          }}
        >
          {progressLogs.map((log, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1.5, py: 0.2 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', flexShrink: 0 }}>
                {log.time}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  color: log.type === 'success' ? '#4caf50' : log.type === 'error' ? '#f44336' : log.type === 'warning' ? '#ff9800' : 'text.secondary',
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

  if (loading && linkedAccounts.length === 0) {
    return (
      <Box sx={embedded ? {} : { p: 3 }}>
        {!embedded && <PageHeader icon={<BattleIcon />} title={t('nav.soloBattle')} subtitle="Automate solo battles across all difficulties" />}
        <StatsCardsSkeleton count={4} />
      </Box>
    )
  }

  const content = (
    <Box>

      {/* -- Header (standalone only) -- */}
      {!embedded && (
        <PageHeader
          icon={<BattleIcon />}
          title={t('nav.soloBattle')}
          subtitle="Automate solo battles across all difficulties"
          chips={completionStats.total > 0 ? [{
            label: `${completionStats.completed}/${completionStats.total} (${completionStats.percentage}%)`,
            color: completionStats.percentage === 100 ? theme.palette.success.main : theme.palette.primary.main,
          }] : []}
        />
      )}

      {/* -- Alerts -- */}
      <CollapsibleHelp>
        <ul>
          <li><strong>Single battle (1-5x):</strong> Click the play button on any battle card to choose run count</li>
          <li><strong>Multiple battles:</strong> Enable Batch Mode, select battles, then click Run</li>
          <li><strong>Progress &amp; Logs:</strong> Appear inline when battles are running</li>
        </ul>
      </CollapsibleHelp>

      {/* Warning shown in parent Battles.jsx when embedded — only show standalone */}
      {!embedded && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
          <Typography variant="body2">
            <strong>Warning:</strong> Running battles triggers "another login detected" and kicks you out of the mobile app. You can re-open the app after WebUI battles finish.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* -- Controls row (compact) -- */}
      <Box sx={{
        mb: 2,
        p: 1.5,
        ...glassCardSx,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5,
      }}>
        {/* Account select (hidden when parent provides account) */}
        {!embedded && (
          <FormControl size="small" sx={{ minWidth: 160, ...(isMobile && { width: '100%' }) }}>
            <InputLabel>{t('solobattle.selectAccount')}</InputLabel>
            <Select
              value={selectedAccount}
              label={t('solobattle.selectAccount')}
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
          control={<Checkbox checked={useRentalDeck} onChange={(e) => setUseRentalDeck(e.target.checked)} size="small" />}
          label={<Typography variant="body2">{t('solobattle.useRentalDeck')}</Typography>}
          sx={{ m: 0 }}
        />

        {!isMobile && <Box sx={{ flex: 1 }} />}

        <Button
          variant={batchMode ? 'contained' : 'outlined'}
          size="small"
          onClick={() => { setBatchMode(!batchMode); if (batchMode) clearSelection(); }}
          sx={{ textTransform: 'none', borderRadius: '8px', ...(isMobile && { width: '100%' }) }}
        >
          {batchMode ? t('solobattle.exitBatch') : t('solobattle.batchMode')}
        </Button>

        <Tooltip title={t('solobattle.refreshStatus')}>
          <IconButton onClick={loadBattleData} disabled={loading} size="small" aria-label="Refresh status">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* -- Difficulty Tabs (primary selector — only one difficulty visible at a time) -- */}
      <Tabs
        value={Math.max(0, ['Beginner', 'Intermediate', 'Advanced', 'Elite'].indexOf(selectedDifficulty))}
        onChange={(e, v) => {
          const diffs = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];
          setSelectedDifficulty(diffs[v]);
          setSelectedPackIndex(null); // reset pack selection on difficulty switch
        }}
        variant={isMobile ? 'scrollable' : 'standard'}
        scrollButtons={isMobile ? 'auto' : false}
        allowScrollButtonsMobile
        sx={{ mb: 2 }}
      >
        {['Beginner', 'Intermediate', 'Advanced', 'Elite'].map(diff => {
          const stats = getStatsForDifficulty(diff);
          const DiffIcon = DIFFICULTY_ICONS_STATIC[diff];
          return (
            <Tab key={diff} label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {DiffIcon && <DiffIcon sx={{ fontSize: 16, color: DIFFICULTY_COLORS[diff] }} />}
                <span>{diff}</span>
                <Chip
                  label={stats.percentage === 100 ? '✓' : `${stats.completed}/${stats.total}`}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.65rem', fontWeight: 600,
                    bgcolor: stats.percentage === 100 ? `${theme.palette.success.main}22` : 'transparent',
                    color: stats.percentage === 100 ? theme.palette.success.main : 'text.secondary',
                  }}
                />
              </Box>
            } sx={{ textTransform: 'none', fontWeight: 600, minHeight: 42 }} />
          );
        })}
      </Tabs>

      {/* -- Batch mode action bar -- */}
      {batchMode && (
        <Box sx={{
          mb: 2,
          px: 2, py: 1.5,
          borderRadius: '14px',
          border: `2px solid ${theme.palette.primary.main}`,
          bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(99, 102, 241, 0.04)',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1,
        }}>
          <Box sx={{ mr: 1 }}>
            <Typography variant="body2" fontWeight={700}>
              {t('solobattle.batchMode')}: {selectedBattles.length} {t('solobattle.battlesSelected')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('solobattle.selectBattlesHint')}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => selectAllUncompleted()} disabled={batchRunning} sx={{ textTransform: 'none', fontSize: 12 }}>
            {t('solobattle.selectAllUncompleted')}
          </Button>
          <Button size="small" onClick={() => selectAllBattles()} disabled={batchRunning} sx={{ textTransform: 'none', fontSize: 12, color: '#4caf50' }}>
            {t('solobattle.selectAllReplay')}
          </Button>
          <Button size="small" onClick={clearSelection} disabled={batchRunning} sx={{ textTransform: 'none', fontSize: 12 }}>
            {t('solobattle.clearSelection')}
          </Button>
          <LoadingButton
            loading={batchRunning}
            size="small"
            startIcon={<PlayIcon />}
            onClick={runBatchBattles}
            disabled={selectedBattles.length === 0}
            fullWidth={isMobile}
            sx={{
              bgcolor: 'accent.main', color: '#fff',
              '&:hover': { bgcolor: 'accent.dark' },
              textTransform: 'none', borderRadius: '8px',
            }}
          >
            {batchRunning ? t('solobattle.running') : `${t('solobattle.run')} ${selectedBattles.length} ${t('solobattle.battles')}`}
          </LoadingButton>

          {/* Batch progress panel */}
          {(batchRunning || batchProgress) && (
            <Box sx={{ width: '100%' }}>
              {renderProgressPanel(batchRunning, theme.palette.primary.main)}
            </Box>
          )}
        </Box>
      )}

      {/* -- Repeat mode progress panel (outside batch mode) -- */}
      {!batchMode && repeatRunning && (
        <Box sx={{
          mb: 2,
          p: 2,
          borderRadius: '14px',
          border: `2px solid ${theme.palette.primary.main}`,
          bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(99, 102, 241, 0.04)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <RepeatIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Running: {currentBattleName || repeatBattleName}
            </Typography>
          </Box>
          {renderProgressPanel(repeatRunning, theme.palette.primary.main)}
        </Box>
      )}

      {/* -- Compact overall progress bar -- */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TrophyIcon sx={{ color: theme.palette.primary.main, fontSize: 18, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={completionStats.percentage}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              '& .MuiLinearProgress-bar': {
                background: completionStats.percentage === 100
                  ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                  : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
              },
            }}
          />
        </Box>
        <Typography variant="caption" fontWeight={700} sx={{ color: theme.palette.primary.main, flexShrink: 0 }}>
          {completionStats.completed}/{completionStats.total} ({completionStats.percentage}%)
        </Typography>
      </Box>

      {/* -- Quick Run (chip row) -- */}
      <Box sx={{
        mb: 2.5,
        p: 2,
        ...glassCardSx,
        borderColor: isDark ? `${theme.palette.secondary.light}20` : `${theme.palette.secondary.light}40`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <SpeedIcon sx={{ color: theme.palette.secondary.light, fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700}>Quick Run</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            -- select difficulties and run all battles (including completed)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {['Beginner', 'Intermediate', 'Advanced', 'Elite'].map(diff => {
            const stats = getStatsForDifficulty(diff)
            const isSelected = quickRunDifficulties.includes(diff)
            return (
              <Chip
                key={diff}
                icon={DIFFICULTY_ICONS[diff]}
                label={`${diff} (${stats.total}${stats.completed === stats.total ? ' cleared' : `, ${stats.total - stats.completed} left`})`}
                onClick={() => toggleQuickRunDifficulty(diff)}
                variant={isSelected ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  borderColor: DIFFICULTY_COLORS[diff],
                  bgcolor: isSelected ? `${DIFFICULTY_COLORS[diff]}20` : 'transparent',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: `${DIFFICULTY_COLORS[diff]}30` },
                  transition: 'all 0.15s',
                }}
              />
            )
          })}

          <Button
            size="small"
            onClick={() => setQuickRunDifficulties(['Beginner', 'Intermediate', 'Advanced', 'Elite'])}
            disabled={quickRunning || batchRunning || repeatRunning}
            sx={{ textTransform: 'none', fontSize: 12, minWidth: 'auto' }}
          >
            All
          </Button>

          {!isMobile && <Box sx={{ flex: 1 }} />}

          <LoadingButton
            loading={quickRunning}
            size="small"
            startIcon={<PlayIcon />}
            onClick={runQuickBatch}
            disabled={quickRunDifficulties.length === 0 || quickRunning || batchRunning || repeatRunning || !selectedAccount}
            fullWidth={isMobile}
            color="primary"
            sx={{
              bgcolor: 'accent.main', color: '#fff',
              '&:hover': { bgcolor: 'accent.dark' },
              textTransform: 'none', borderRadius: '8px',
            }}
          >
            {quickRunning ? 'Running...' : `Run ${getQuickRunBattleCount()} Battles`}
          </LoadingButton>
        </Box>

        {/* Quick run progress */}
        {(quickRunning || (batchProgress && !batchRunning && !repeatRunning)) && (
          renderProgressPanel(quickRunning, theme.palette.secondary.light)
        )}
      </Box>

      {/* -- Pack Grid + Selected Pack Detail -- */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredStages.length === 0 && !loading ? (
        <EmptyState
          icon={<BattleIcon sx={{ fontSize: 64 }} />}
          title="No Battles Available"
          description={selectedAccount ? "No battles found for the selected difficulty. Try selecting a different filter." : "Select an account to load battle data."}
          action={selectedAccount && (
            <Button variant="outlined" onClick={loadBattleData} startIcon={<RefreshIcon />}>
              Refresh
            </Button>
          )}
        />
      ) : (
        <>
          {/* Pack Selection Grid */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {filteredStages.map((stage, index) => {
              const completedCount = stage.battles.filter(b => completionMap[b.id]?.isCleared).length
              const allCompleted = completedCount === stage.battles.length
              const diffColor = DIFFICULTY_COLORS[stage.difficulty] || theme.palette.primary.main
              const stageProgress = stage.totalBattles > 0 ? (completedCount / stage.totalBattles) * 100 : 0
              const isActive = selectedPackIndex === index

              return (
                <Grid item xs={6} sm={4} md={3} lg={2} key={index}>
                  <Box
                    onClick={() => setSelectedPackIndex(isActive ? null : index)}
                    sx={{
                      p: 1.5,
                      borderRadius: '12px',
                      border: `2px solid ${isActive ? diffColor : 'transparent'}`,
                      borderLeft: `4px solid ${diffColor}`,
                      bgcolor: isActive
                        ? (isDark ? `${diffColor}18` : `${diffColor}0C`)
                        : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: isDark ? `0 4px 16px ${diffColor}30` : `0 4px 16px ${diffColor}20`,
                        borderColor: diffColor,
                      },
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} noWrap title={stage.pack} sx={{ mb: 0.75, lineHeight: 1.2 }}>
                      {stage.pack}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={stageProgress}
                      sx={{
                        height: 4, borderRadius: 2, mb: 0.75,
                        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                          background: allCompleted ? theme.palette.success.main : (DIFFICULTY_GRADIENTS[stage.difficulty] || diffColor),
                        },
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {completedCount}/{stage.totalBattles}
                      </Typography>
                      {allCompleted ? (
                        <CheckIcon sx={{ color: theme.palette.success.main, fontSize: 14 }} />
                      ) : (
                        <Typography variant="caption" sx={{ color: diffColor, fontWeight: 700, fontSize: '0.65rem' }}>
                          {Math.round(stageProgress)}%
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              )
            })}
          </Grid>

          {/* Selected Pack Detail Panel */}
          {selectedPackIndex !== null && filteredStages[selectedPackIndex] && (() => {
            const stage = filteredStages[selectedPackIndex]
            const completedCount = stage.battles.filter(b => completionMap[b.id]?.isCleared).length
            const allCompleted = completedCount === stage.battles.length
            const diffColor = DIFFICULTY_COLORS[stage.difficulty] || theme.palette.primary.main
            const stageProgress = stage.totalBattles > 0 ? (completedCount / stage.totalBattles) * 100 : 0

            return (
              <Box sx={{
                ...glassCardSx,
                overflow: 'hidden',
                borderLeft: `4px solid ${diffColor}`,
                mb: 2,
              }}>
                {/* Pack header */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2, py: 1.5,
                  borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
                }}>
                  <Chip
                    icon={DIFFICULTY_ICONS[stage.difficulty]}
                    label={stage.difficulty}
                    size="small"
                    sx={{
                      background: DIFFICULTY_GRADIENTS[stage.difficulty] || diffColor,
                      color: '#fff', fontWeight: 600, fontSize: '0.68rem', height: 24,
                      '& .MuiChip-icon': { color: '#fff !important', fontSize: '14px !important' },
                    }}
                  />
                  <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
                    {stage.pack}
                  </Typography>
                  <Chip
                    label={allCompleted ? 'Complete' : `${completedCount}/${stage.totalBattles}`}
                    size="small"
                    icon={allCompleted ? <CheckIcon sx={{ fontSize: '14px !important', color: 'inherit !important' }} /> : undefined}
                    color={allCompleted ? 'success' : 'default'}
                    sx={{ fontWeight: 600, fontSize: 11 }}
                  />
                  <IconButton size="small" onClick={() => setSelectedPackIndex(null)} aria-label="Close pack detail">
                    <ArrowUpIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Progress bar */}
                <Box sx={{ px: 2, pt: 1 }}>
                  <LinearProgress variant="determinate" value={stageProgress} sx={{
                    height: 3, borderRadius: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    '& .MuiLinearProgress-bar': {
                      background: allCompleted
                        ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                        : `linear-gradient(90deg, ${diffColor}, ${diffColor}99)`,
                    },
                  }} />
                </Box>

                {/* Battle cards grid */}
                <Box sx={{ p: 1.5, pt: 1 }}>
                  <Grid container spacing={1}>
                    {stage.battles.map((battle) => {
                      const isCleared = completionMap[battle.id]?.isCleared
                      const isSelected = selectedBattles.includes(battle.id)
                      return (
                        <Grid item xs={12} sm={6} md={4} lg={2} key={battle.id}>
                          <Box
                            onClick={() => batchMode && toggleBattleSelection(battle.id)}
                            sx={{
                              p: 1.25, display: 'flex', alignItems: 'center', gap: 0.75,
                              cursor: 'pointer', borderRadius: '10px',
                              borderLeft: `3px solid ${isCleared ? '#4caf50' : diffColor}`,
                              border: `1px solid ${isSelected ? theme.palette.primary.main : isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.07)'}`,
                              borderLeftColor: isSelected ? theme.palette.primary.main : isCleared ? '#4caf50' : diffColor,
                              bgcolor: isCleared
                                ? (isDark ? 'rgba(76, 175, 80, 0.12)' : 'rgba(76, 175, 80, 0.06)')
                                : isSelected
                                  ? (isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(99, 102, 241, 0.06)')
                                  : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.08)',
                              },
                            }}
                          >
                            {batchMode ? (
                              <Checkbox size="small" checked={isSelected} sx={{ p: 0 }} />
                            ) : isCleared ? (
                              <CheckIcon sx={{ color: '#4caf50', fontSize: 18, flexShrink: 0 }} />
                            ) : (
                              <UncheckedIcon sx={{ color: 'text.disabled', fontSize: 18, flexShrink: 0 }} />
                            )}
                            <Typography variant="body2" fontWeight={500} sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                              {battle.id.replace('_', ' ')}
                            </Typography>
                            {!batchMode && (
                              <Tooltip title={isCleared ? 'Replay (1-5x)' : 'Run Battle (1-5x)'}>
                                <IconButton size="small" aria-label={isCleared ? 'Replay battle' : 'Run battle'}
                                  onClick={(e) => openRepeatMenu(e, battle.id, battle.id.replace('_', ' '))}
                                  disabled={actionLoading || repeatRunning}
                                  sx={{ color: isCleared ? '#4caf50' : theme.palette.primary.main, p: 0.25, flexShrink: 0 }}
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
              </Box>
            )
          })()}

          {/* Prompt to select a pack */}
          {selectedPackIndex === null && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              Select a pack above to view and run its battles
            </Typography>
          )}
        </>
      )}

      {/* -- Repeat battle menu -- */}
      <Menu
        anchorEl={repeatMenuAnchor}
        open={Boolean(repeatMenuAnchor)}
        onClose={closeRepeatMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, color: 'text.secondary', display: 'block' }}>
          Run {repeatBattleName}
        </Typography>
        {[1, 2, 3, 4, 5].map(count => (
          <MenuItem
            key={count}
            onClick={() => runRepeatBattle(count)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <RepeatIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            </ListItemIcon>
            <ListItemText primary={`Run ${count}x`} />
          </MenuItem>
        ))}
      </Menu>

      {/* -- Snackbar -- */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )

  if (embedded) return content
  return <FadeIn><Box sx={{ p: 3 }}>{content}</Box></FadeIn>
}

export default SoloBattle
