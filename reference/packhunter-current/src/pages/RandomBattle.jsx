import { useState, useEffect } from 'react'
import { friendlyError } from '../utils/errorMessages'
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
  Snackbar,
  useTheme,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Casino as RandomIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as StreakIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { accounts, randomBattle } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { getSocket } from '../services/socket'
import GlassCard from '../components/GlassCard'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function RandomBattle({ user, embedded = false, externalAccount, externalAccounts }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()

  const DIFFICULTY_COLORS = {
    BEGINNER: theme.palette.success.main,
    INTERMEDIATE: theme.palette.warning.main,
    ADVANCED: theme.palette.error.main,
    EXPERT: theme.palette.secondary.main,
  }

  const [_linkedAccounts, setLinkedAccounts] = useState([])
  const [_selectedAccount, setSelectedAccount] = useState('')
  const linkedAccounts = (embedded && externalAccounts) ? externalAccounts : _linkedAccounts
  const selectedAccount = (embedded && externalAccount) ? externalAccount : _selectedAccount
  const [loading, setLoading] = useState(embedded ? false : true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')

  // Battle data
  const [battleConfig, setBattleConfig] = useState(null)
  const [battleStatus, setBattleStatus] = useState({})

  // Batch mode
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    if (!embedded) loadAccounts()
    loadConfig()
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      loadStatus()
    }
  }, [selectedAccount])

  // Socket.io progress tracking
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleProgress = (data) => {
      if (data.accountId === parseInt(selectedAccount)) {
        setBatchProgress(data)
        if (data.phase === 'complete') {
          setBatchRunning(false)
          loadStatus()
        }
      }
    }

    socket.on('random_battle_progress', handleProgress)
    return () => socket.off('random_battle_progress', handleProgress)
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

  const loadConfig = async () => {
    try {
      const data = await randomBattle.getConfig()
      setBattleConfig(data)
    } catch (err) {
      console.error('Failed to load random battle config:', err)
    }
  }

  const loadStatus = async () => {
    if (!selectedAccount) return
    setLoading(true)
    try {
      const data = await randomBattle.getStatus(selectedAccount)
      setBattleStatus(data.completionMap || {})
    } catch (err) {
      setError(friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  const runBattle = async (battleId) => {
    setActionLoading(battleId)
    try {
      const result = await randomBattle.runBattle(selectedAccount, battleId)
      setSnackbar({ open: true, message: result.message || 'Battle completed!', severity: 'success' })
      await loadStatus()
    } catch (err) {
      setSnackbar({ open: true, message: friendlyError(err.message || 'Battle failed'), severity: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  const runAllBattles = async () => {
    if (!battleConfig) return
    const unclearedIds = battleConfig.battles
      .filter(b => !battleStatus[b.battleId]?.isCleared)
      .map(b => b.battleId)

    if (unclearedIds.length === 0) {
      setSnackbar({ open: true, message: 'All battles already cleared!', severity: 'info' })
      return
    }

    setBatchRunning(true)
    setBatchProgress({ current: 0, total: unclearedIds.length, phase: 'starting', message: 'Starting batch...' })
    try {
      const result = await randomBattle.runBatch(selectedAccount, unclearedIds)
      const { summary } = result
      setSnackbar({
        open: true,
        message: `Batch complete: ${summary.successful}/${summary.total} battles won!`,
        severity: summary.failed === 0 ? 'success' : 'warning'
      })
      await loadStatus()
    } catch (err) {
      setSnackbar({ open: true, message: friendlyError(err.message || 'Batch failed'), severity: 'error' })
    } finally {
      setBatchRunning(false)
    }
  }

  if (loading && linkedAccounts.length === 0) {
    return (
      <Box sx={embedded ? {} : { p: 3, maxWidth: 900, mx: 'auto' }}>
        {!embedded && <PageHeader icon={<RandomIcon />} title="Random Battles" subtitle="Battle random opponents across difficulty levels" />}
        <StatsCardsSkeleton count={4} />
      </Box>
    )
  }

  const battles = battleConfig?.battles || []
  const completedCount = battles.filter(b => battleStatus[b.battleId]?.isCleared).length

  const content = (
    <Box sx={embedded ? {} : { maxWidth: 900, mx: 'auto' }}>

      {/* Header (standalone only) */}
      {!embedded && (
        <PageHeader
          icon={<RandomIcon />}
          title="Random Battles"
          subtitle="Battle random opponents across difficulty levels"
        />
      )}

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Account Selector — compact inline row */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, mb: 3,
        flexWrap: 'wrap',
        p: 2, borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
      }}>
        {!embedded && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Account</InputLabel>
            <Select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              label="Account"
            >
              {linkedAccounts.filter(a => a.is_active).map((acc) => (
                <MenuItem key={acc.id} value={acc.id}>
                  {acc.nickname || acc.device_account?.substring(0, 8) || `Account ${acc.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <IconButton onClick={loadStatus} disabled={loading || !selectedAccount} aria-label="Refresh status" size="small">
          <RefreshIcon fontSize="small" />
        </IconButton>

        <Chip
          label={`${completedCount}/${battles.length} Cleared`}
          color={completedCount === battles.length ? 'success' : 'default'}
          variant={completedCount === battles.length ? 'filled' : 'outlined'}
          size="small"
        />

        <Box sx={{ ml: 'auto' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={batchRunning ? <CircularProgress size={14} color="inherit" /> : <PlayIcon />}
            onClick={runAllBattles}
            disabled={batchRunning || actionLoading !== null || !selectedAccount || completedCount === battles.length}
            sx={{
              textTransform: 'none',
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
              whiteSpace: 'nowrap',
            }}
          >
            {batchRunning ? 'Running...' : 'Run All Uncleared'}
          </Button>
        </Box>
      </Box>

      {/* Batch Progress */}
      {batchProgress && batchRunning && (
        <Box sx={{
          mb: 3, p: 2, borderRadius: '14px',
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>{batchProgress.message}</Typography>
          <LinearProgress
            variant="determinate"
            value={batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}
            sx={{
              height: 8, borderRadius: 4,
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              '& .MuiLinearProgress-bar': {
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                borderRadius: 4,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {batchProgress.current}/{batchProgress.total} battles
          </Typography>
        </Box>
      )}

      {/* Battle Cards */}
      <Grid container spacing={2} component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
        {battles.map((battle) => {
          const status = battleStatus[battle.battleId] || {}
          const isCleared = status.isCleared
          const currentStreak = status.currentWinStreak || 0
          const maxStreak = status.maxWinStreak || 0
          const color = DIFFICULTY_COLORS[battle.difficulty] || '#666'

          return (
            <Grid item xs={12} sm={6} key={battle.battleId} component={motion.div} variants={itemVariants}>
              <Box
                sx={{
                  p: 2.5, borderRadius: '14px',
                  borderLeft: `4px solid ${color}`,
                  border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                  borderLeftColor: color,
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  opacity: isCleared ? 0.85 : 1,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 24px ${color}30`,
                    borderLeftColor: color,
                  },
                }}
              >
                {/* Title row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isCleared ? (
                      <CheckIcon sx={{ color: '#4caf50' }} />
                    ) : (
                      <UncheckedIcon sx={{ color: '#999' }} />
                    )}
                    <Typography variant="h6" fontWeight={600}>
                      {battle.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={battle.difficulty}
                    size="small"
                    sx={{
                      backgroundColor: `${color}20`,
                      color: color,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </Box>

                {/* Win Streak */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Tooltip title="Current Win Streak">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StreakIcon sx={{ fontSize: 18, color: '#ff9800' }} />
                      <Typography variant="body2" color="text.secondary">
                        Current: <b>{currentStreak}</b>
                      </Typography>
                    </Box>
                  </Tooltip>
                  <Tooltip title="Max Win Streak">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrophyIcon sx={{ fontSize: 18, color: '#ffd700' }} />
                      <Typography variant="body2" color="text.secondary">
                        Max: <b>{maxStreak}</b>
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>

                {/* Battle Try Progress */}
                {status.battleTriesList && status.battleTriesList.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    {status.battleTriesList.map((tryItem, idx) => {
                      const configTry = battle.battleTryProgress?.[idx]
                      const target = configTry?.completeCount || 1
                      const current = tryItem.currentCount || 0
                      const percent = Math.min(100, (current / target) * 100)
                      return (
                        <Box key={idx} sx={{ mb: 0.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">
                              Try {idx + 1}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {current}/{target}
                              {tryItem.isReceivedReward && ' (Rewarded)'}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={percent}
                            sx={{
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
                              '& .MuiLinearProgress-bar': {
                                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                                borderRadius: 2,
                              },
                            }}
                          />
                        </Box>
                      )
                    })}
                  </Box>
                )}

                <Button
                  variant={isCleared ? 'outlined' : 'contained'}
                  size="small"
                  fullWidth
                  startIcon={actionLoading === battle.battleId ? <CircularProgress size={14} color="inherit" /> : <PlayIcon />}
                  onClick={() => runBattle(battle.battleId)}
                  disabled={actionLoading !== null || batchRunning || !selectedAccount}
                  sx={{
                    textTransform: 'none',
                    ...(isCleared ? {} : {
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                    }),
                  }}
                >
                  {isCleared ? 'Play Again' : 'Start Battle'}
                </Button>
              </Box>
            </Grid>
          )
        })}
      </Grid>

      {battles.length === 0 && !loading && (
        <GlassCard>
          <EmptyState
            icon={<RandomIcon sx={{ fontSize: 64 }} />}
            title="No Random Battles"
            description="No random battles configured. Check data/SoloRandomBattle.json."
            minHeight={200}
          />
        </GlassCard>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
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

export default RandomBattle
