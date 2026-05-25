import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Redeem as RedeemIcon,
  CardGiftcard as GiftIcon,
  HourglassEmpty as HourglassIcon,
  AutoAwesome as ShinedustIcon,
  LocalActivity as TicketIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  CloudDownload as CloudDownloadIcon,
  Paid as CoinIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material'
import { tasks, missions as missionsApi } from '../services/api'
import { useAccount } from '../contexts/AccountContext'
import { onTaskStatus, onTaskLog, offTaskStatus, offTaskLog } from '../services/socket'
import { useLanguage } from '../contexts/LanguageContext'
import { FadeIn } from '../components/Animations'
import SyncStatusChip from '../components/SyncStatusChip'
import { EmptyState } from '../components/EmptyState'
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import AccountSelector from '../components/AccountSelector'
import CollapsibleHelp from '../components/CollapsibleHelp'
import LoadingButton from '../components/LoadingButton'
import TasksPanel from '../components/TasksPanel'
import { useSectionStyles } from '../components/SectionCard'

// Task type to mission code mapping
const TASK_TO_MISSION = {
  'CLAIM_MISSIONS': null, // This completes multiple missions
  'OPEN_PACKS': ['open_1_pack', 'open_2_pack'],
  'WONDER_PICK': ['wonder_pick_1'],
  'BATTLE': ['battle_1', 'battle_3'],
}

const TAB_NAMES = { daily: 0, weekly: 1, quickactions: 2, tasks: 3 }

function Missions({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { sectionBox: glassCardSx } = useSectionStyles()
  const [searchParams] = useSearchParams()
  const initialTab = useMemo(() => TAB_NAMES[searchParams.get('tab')] ?? 0, [])

  const REWARD_ICONS = {
    hourglass: <HourglassIcon sx={{ color: '#ff9800', fontSize: 16 }} />,
    shinedust: <ShinedustIcon sx={{ color: theme.palette.secondary.light, fontSize: 16 }} />,
    pack_ticket: <TicketIcon sx={{ color: theme.palette.primary.main, fontSize: 16 }} />,
  }

  const { accounts: linkedAccounts, selectedAccountId, selectAccount, loading: accountsLoading } = useAccount()
  const selectedAccount = selectedAccountId ? String(selectedAccountId) : ''
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [taskLogs, setTaskLogs] = useState([])

  // Missions data
  const [dailyMissions, setDailyMissions] = useState([])
  const [weeklyMissions, setWeeklyMissions] = useState([])
  const [stats, setStats] = useState(null)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [claimSummary, setClaimSummary] = useState(null) // { claimed: {...} } for summary dialog
  const [syncResult, setSyncResult] = useState(null)
  // Phase 22.a — "Last synced X ago" indicator. Stores ms-since-epoch of
  // the last successful sync for the currently-selected account. Hydrated
  // from localStorage so the indicator survives tab switches.
  const [lastSyncAt, setLastSyncAt] = useState(() => {
    try {
      const raw = localStorage.getItem('missions:lastSyncAt')
      return raw ? JSON.parse(raw) : {}  // { [accountId]: ms }
    } catch { return {} }
  })
  // Re-render the "X ago" label every 30s so it doesn't go stale.
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    const h = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(h)
  }, [])

  // Resources state
  const [resources, setResources] = useState(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)

  // Tab state (supports ?tab=tasks deep link)
  const [tab, setTab] = useState(initialTab)

  // Socket event listeners on mount
  useEffect(() => {
    const handleTaskStatus = (data) => {
      if (data.status === 'completed') {
        setSuccess(`Task completed!`)
        loadMissions()
      } else if (data.status === 'failed') {
        setError(`Task failed: ${data.error}`)
      }
    }

    const handleTaskLog = (data) => {
      setTaskLogs((prev) => [data, ...prev].slice(0, 50))
    }

    onTaskStatus(handleTaskStatus)
    onTaskLog(handleTaskLog)

    return () => {
      offTaskStatus(handleTaskStatus)
      offTaskLog(handleTaskLog)
    }
  }, [])

  // Reload missions when selected account changes
  useEffect(() => {
    if (selectedAccount) {
      loadMissions()
    }
  }, [selectedAccount])

  const loadMissions = async () => {
    try {
      const acctId = selectedAccount || null
      const [dailyData, weeklyData] = await Promise.all([
        missionsApi.getDaily(acctId),
        missionsApi.getWeekly(acctId),
      ])
      setDailyMissions(dailyData.missions || [])
      setStats(dailyData.stats)
      setWeeklyMissions(weeklyData.missions || [])
    } catch (err) {
      console.error('Failed to load missions:', err)
    }
  }

  // Load resources (hourglasses, etc.) from game
  const loadResources = async () => {
    if (!selectedAccount) return

    setResourcesLoading(true)
    try {
      const data = await missionsApi.getResources(selectedAccount)
      if (data.success) {
        setResources(data.resources)
      }
    } catch (err) {
      console.error('Failed to load resources:', err)
    } finally {
      setResourcesLoading(false)
    }
  }

  // Load resources when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadResources()
    }
  }, [selectedAccount])

  // Run a game task that may complete missions
  const handleRunTask = async (taskType) => {
    if (!selectedAccount) {
      setError(t('common.selectAccountFirst'))
      return
    }

    setError('')
    setSuccess('')
    setActionLoading(true)
    setTaskLogs([])

    try {
      let result
      switch (taskType) {
        case 'CLAIM_MISSIONS':
          result = await tasks.claimMissions(selectedAccount)
          break
        case 'OPEN_PACKS':
          result = await tasks.openPacks(selectedAccount)
          break
        case 'WONDER_PICK':
          result = await tasks.wonderPick(selectedAccount)
          break
        case 'BATTLE':
          result = await tasks.battle(selectedAccount)
          break
        default:
          throw new Error(`Unknown task: ${taskType}`)
      }

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(t('missions.taskCompletedSuccess'))
        // Mark related missions as complete in UI
        const relatedMissions = TASK_TO_MISSION[taskType]
        if (relatedMissions) {
          for (const code of relatedMissions) {
            const mission = dailyMissions.find(m => m.code === code)
            if (mission && !mission.completed) {
              await missionsApi.completeMission(mission.id, selectedAccount || null)
            }
          }
        }
        loadMissions()
      }
    } catch (err) {
      setError(err.message || t('missions.taskFailed'))
    } finally {
      setActionLoading(false)
    }
  }

  // Mark mission as manually complete (for tracking only)
  const handleCompleteMission = async (mission) => {
    try {
      await missionsApi.completeMission(mission.id, selectedAccount || null)
      loadMissions()
    } catch (err) {
      setError(t('missions.failedToComplete'))
    }
  }

  // Redeem a single mission
  const handleRedeemMission = async (mission) => {
    try {
      await missionsApi.redeemMission(mission.id, selectedAccount || null)
      loadMissions()
      setSuccess(`Redeemed: ${mission.reward_amount} ${mission.reward_type}!`)
    } catch (err) {
      setError(t('missions.failedToRedeem'))
    }
  }

  // Redeem all completed missions
  const handleRedeemAll = async () => {
    try {
      const result = await missionsApi.redeemAll(selectedAccount || null)
      loadMissions()
      setSuccess(`Redeemed ${result.redeemedCount} missions!`)
    } catch (err) {
      setError(t('missions.failedToRedeemAll'))
    }
  }

  // Sync missions from real game API.
  //
  // Phase 22.a — two entrypoints now:
  //   handleSyncFromGame()  — user-triggered; shows toast on success/error.
  //   backgroundSync()      — auto-fired on mount + account change; silent
  //                           on success (the indicator is the feedback),
  //                           silent on error to avoid startup noise.
  const runSync = async ({ silent = false } = {}) => {
    if (!selectedAccount) {
      if (!silent) setError(t('common.selectAccountFirst'))
      return
    }
    if (!silent) {
      setError('')
      setSuccess('')
    }
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await missionsApi.syncFromGame(selectedAccount)

      // Wave C — distinguish success from upstream failure. The backend
      // now returns 502 + { needsReauth, detail, succeeded:false } when
      // IsCompletedV1 fails. The old silent-failure path used to return
      // { completedMissions:0, pendingMissions:0 } which looked identical
      // to "user has no completions" — we no longer accept that as
      // success. `succeeded` is set explicitly by the api layer.
      if (!result.ok || result.succeeded === false) {
        if (!silent) {
          if (result.needsReauth) {
            setError('Connection issue — please try again')
          } else {
            setError(result.detail || result.error || t('missions.failedToSync'))
          }
        }
        // Do NOT render syncResult on failure — we don't want the 0/0
        // regression to reappear in a new skin.
        return
      }
      setSyncResult(result)
      if (!silent) setSuccess(result.message || `Synced ${result.completedMissions} missions!`)
      // Stamp the last-sync time for this account + persist.
      setLastSyncAt((prev) => {
        const next = { ...prev, [selectedAccount]: Date.now() }
        try { localStorage.setItem('missions:lastSyncAt', JSON.stringify(next)) } catch {}
        return next
      })
      loadMissions()
    } catch (err) {
      if (!silent) setError(err.message || t('missions.failedToSync'))
    } finally {
      setSyncing(false)
    }
  }
  const handleSyncFromGame = () => runSync({ silent: false })

  // Phase 22.a — auto background sync on first render per account, but
  // only if the last sync is stale (>5 min) or missing. Avoids hitting the
  // game API on every tab switch.
  useEffect(() => {
    if (!selectedAccount) return
    const last = lastSyncAt[selectedAccount] || 0
    if (Date.now() - last < 5 * 60_000) return
    // Defer one tick so loadMissions()'s initial state settles first.
    const h = setTimeout(() => { runSync({ silent: true }) }, 300)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount])

  // Human-readable "X ago" for the indicator. Returns null if never synced.
  const lastSyncLabel = (() => {
    const ts = lastSyncAt[selectedAccount]
    if (!ts) return null
    const ageSec = Math.max(0, Math.floor((nowTick - ts) / 1000))
    if (ageSec < 60) return 'just now'
    const mins = Math.floor(ageSec / 60)
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} hr ago`
    return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) === 1 ? '' : 's'} ago`
  })()

  // Claim all rewards from game
  const handleClaimAllRewards = async () => {
    if (!selectedAccount) {
      setError(t('common.selectAccountFirst'))
      return
    }

    setError('')
    setSuccess('')
    setSyncing(true)

    try {
      const result = await missionsApi.claimAllRewards(selectedAccount)
      if (result.error) {
        setError(result.error)
      } else {
        setClaimSummary(result.claimed || {})
        loadMissions()
      }
    } catch (err) {
      setError(err.message || t('missions.failedToClaim'))
    } finally {
      setSyncing(false)
    }
  }

  // Run all daily tasks and redeem
  const handleAutoComplete = async () => {
    if (!selectedAccount) {
      setError(t('common.selectAccountFirst'))
      return
    }

    setError('')
    setSuccess('')
    setActionLoading(true)
    setTaskLogs([])

    try {
      // Auto Complete: Use the same claim-all API as the "Claim All" button
      // This handles everything in one call: hourglass missions, battles, daily rewards,
      // daily free gift, and present box — with proper retry logic
      const result = await missionsApi.claimAllRewards(selectedAccount)

      if (result.error) {
        setError(result.error)
      } else {
        setClaimSummary(result.claimed || {})
        loadMissions()
      }
    } catch (err) {
      setError(err.message || t('missions.failedToRunTasks'))
    } finally {
      setActionLoading(false)
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  // Mission Card Component
  const MissionCard = ({ mission, showActions = true }) => {
    const isRedeemed = mission.redeemed
    const isCompleted = mission.completed

    return (
      <Box
        sx={{
          p: 2,
          borderRadius: '14px',
          border: isRedeemed
            ? `1px solid ${isDark ? 'rgba(52,211,153,0.3)' : 'rgba(52,211,153,0.4)'}`
            : isCompleted
              ? `1px solid ${isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.35)'}`
              : `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isRedeemed
            ? isDark ? 'rgba(52,211,153,0.06)' : 'rgba(52,211,153,0.04)'
            : isCompleted
              ? isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)'
              : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          borderLeft: `3px solid ${isRedeemed ? '#34D399' : isCompleted ? '#F59E0B' : isDark ? 'rgba(124,138,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
          backdropFilter: 'blur(12px)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.3)' : '0 6px 20px rgba(0,0,0,0.08)',
            borderColor: isRedeemed ? 'rgba(52,211,153,0.5)' : isCompleted ? 'rgba(245,158,11,0.5)' : isDark ? 'rgba(124,138,255,0.2)' : 'rgba(0,0,0,0.12)',
          },
        }}
      >
        {/* Status Icon */}
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {isRedeemed ? (
            <CheckIcon sx={{ color: '#34D399', fontSize: 24 }} />
          ) : isCompleted ? (
            <CheckIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
          ) : (
            <UncheckedIcon sx={{ color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', fontSize: 24 }} />
          )}
        </Box>

        {/* Mission Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={500} sx={{ fontSize: '0.9rem' }}>
            {mission.description}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
            {REWARD_ICONS[mission.reward_type] || <GiftIcon sx={{ fontSize: 16 }} />}
            <Typography variant="body2" color="text.secondary">
              {mission.reward_amount} {mission.reward_type}
            </Typography>
            {/* Status chip */}
            {isRedeemed && (
              <Chip
                label="Claimed"
                size="small"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #34D399, #10B981)',
                  color: '#fff',
                }}
              />
            )}
            {isCompleted && !isRedeemed && (
              <Chip
                label="Ready"
                size="small"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: '#fff',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Actions */}
        {showActions && (
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, ...(isMobile && { width: '100%' }) }}>
            {!isCompleted && (
              <Tooltip title={t('missions.markComplete')}>
                <IconButton
                  size="small"
                  aria-label="Mark mission complete"
                  onClick={() => handleCompleteMission(mission)}
                >
                  <CheckIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            {isCompleted && !isRedeemed && (
              <LoadingButton
                size="small"
                color="success"
                startIcon={<RedeemIcon sx={{ fontSize: 16 }} />}
                onClick={() => handleRedeemMission(mission)}
                fullWidth={isMobile}
                sx={{ borderRadius: '8px', fontSize: '0.75rem' }}
              >
                {t('missions.redeem')}
              </LoadingButton>
            )}
            {isRedeemed && !isMobile && (
              <Chip label={t('missions.redeemed')} color="success" size="small" />
            )}
          </Box>
        )}
      </Box>
    )
  }

  if (loading) {
    return <TablePageSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      <PageHeader
        icon={<AssignmentIcon />}
        title={t('nav.missions')}
        subtitle={t('missions.subtitle')}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Phase 25E — surfaces missions sync freshness so users
                don't wonder whether a "default" mission state means
                stale data. Reads from the backend /sync-status
                endpoint (primary) with localStorage fallback. */}
            <SyncStatusChip accountId={selectedAccount} showLabel={false} />
            <IconButton onClick={loadMissions} aria-label="Refresh missions" size="small">
              <RefreshIcon />
            </IconButton>
          </Box>
        }
      />

      {/* Help Info */}
      <CollapsibleHelp>
        <ul>
          <li><strong>Auto Complete:</strong> Primary action — runs all game tasks (battles, packs, wonder pick) and claims the rewards automatically.</li>
          <li><strong>Sync:</strong> Fallback — pulls the current mission state from the game API. Runs automatically when the page loads.</li>
          <li><strong>Redeem All:</strong> Redeems tracked missions locally in the dashboard.</li>
          <li><strong>Reset:</strong> Daily missions reset at midnight UTC; weekly reset on Monday.</li>
        </ul>
      </CollapsibleHelp>

      {linkedAccounts.length === 0 ? (
        <EmptyState
          icon={<AssignmentIcon sx={{ fontSize: 64 }} />}
          title="No Accounts Linked"
          description={t('common.noAccountsLinked')}
        />
      ) : (
        <>
          {/* Account Selection & Game Sync
              Phase 22.a:
                - Auto-Complete is now the primary full-width CTA.
                - Claim-All button REMOVED (Auto-Complete subsumes it).
                - Sync demoted to an icon button + "Last synced X ago" label.
                - handleClaimAllRewards() is preserved for any callers; the
                  button JSX is gone.
          */}
          <Box sx={{ ...glassCardSx, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <AccountSelector label={t('missions.selectAccount')} fullWidth hideIfSingle={false} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <LoadingButton
                  fullWidth
                  loading={actionLoading}
                  startIcon={<PlayIcon />}
                  onClick={handleAutoComplete}
                  disabled={actionLoading || syncing}
                  sx={{
                    background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                    color: '#fff',
                    borderRadius: '8px',
                    py: 1.25,
                    fontSize: '1rem',
                    fontWeight: 600,
                    '&:hover': { background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.secondary.dark})` },
                  }}
                >
                  {t('missions.autoComplete')}
                </LoadingButton>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
                  <Tooltip title={lastSyncLabel ? `Last synced ${lastSyncLabel} — click to re-sync` : 'Sync missions from game'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={handleSyncFromGame}
                        disabled={syncing || actionLoading}
                        aria-label="Sync missions"
                        sx={{ color: 'info.main' }}
                      >
                        {syncing ? <CircularProgress size={18} /> : <SyncIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1, display: 'block' }}>
                      Last synced
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                      {lastSyncLabel || '—'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              {/* Redeem All — secondary, kept on the same card */}
              <Grid item xs={12}>
                <LoadingButton
                  fullWidth
                  variant="outlined"
                  color="success"
                  startIcon={<RedeemIcon />}
                  onClick={handleRedeemAll}
                  disabled={!stats?.completed || stats?.allRedeemed}
                  sx={{ borderRadius: '8px' }}
                >
                  {t('missions.redeemAll')}
                </LoadingButton>
              </Grid>
            </Grid>
          </Box>

          {/* Task Progress — shown directly below buttons */}
          {taskLogs.length > 0 && (
            <Box sx={{ ...glassCardSx, mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('missions.taskProgress')}
              </Typography>
              <Box
                sx={{
                  bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: '8px',
                  p: 2,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              >
                {taskLogs.map((log, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 0.5,
                      color: log.level === 'error' ? 'error.main' : log.level === 'info' ? 'success.main' : 'text.secondary',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Sync Result */}
          {/* Wave C — render ONLY when the sync actually succeeded.
              Prevents the old 0/0 silent-failure panel from reappearing. */}
          {syncResult && syncResult.succeeded && (
            <Box sx={{ ...glassCardSx, mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SyncIcon sx={{ fontSize: 16 }} />
                {t('missions.gameSyncResult')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">{t('missions.completed')}</Typography>
                  <Typography variant="h6" fontWeight={600} color="success.main">
                    {syncResult.completedMissions || 0}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">{t('missions.pending')}</Typography>
                  <Typography variant="h6" fontWeight={600} color="warning.main">
                    {syncResult.pendingMissions || 0}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">{t('missions.hourglasses')}</Typography>
                  <Typography variant="h6" fontWeight={600} color="info.main">
                    +{syncResult.claimedRewards?.hourglasses || 0}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Resources Panel */}
          {resources && (
            <Box sx={{ ...glassCardSx, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('missions.resources')}
                </Typography>
                <IconButton size="small" onClick={loadResources} disabled={resourcesLoading} aria-label="Refresh resources">
                  {resourcesLoading ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Box>
              <Grid container spacing={2}>
                {[
                  {
                    icon: <HourglassIcon sx={{ color: 'warning.main', fontSize: 26 }} />,
                    value: resources.hourglasses || 0,
                    label: t('missions.hourglasses'),
                    subLabel: `(${resources.packsAvailable || 0} packs)`,
                    color: [255, 152, 0],
                    valueColor: 'warning.main',
                  },
                  {
                    icon: <ShinedustIcon sx={{ color: theme.palette.secondary.light, fontSize: 26 }} />,
                    value: resources.shinedust || 0,
                    label: t('missions.shinedust'),
                    color: [156, 39, 176],
                    valueColor: 'secondary.main',
                  },
                  {
                    icon: <CoinIcon sx={{ color: '#ffc107', fontSize: 26 }} />,
                    value: resources.gold || 0,
                    label: t('missions.gold'),
                    subLabel: `(${resources.goldPacksAvailable || 0} gold packs)`,
                    color: [255, 193, 7],
                    valueColor: 'warning.main',
                  },
                  {
                    icon: <TicketIcon sx={{ color: theme.palette.primary.main, fontSize: 26 }} />,
                    value: resources.shopTickets || 0,
                    label: t('missions.shopTickets'),
                    color: [233, 30, 99],
                    valueColor: 'primary.main',
                  },
                ].map((item, idx) => (
                  <Grid item xs={6} sm={3} key={idx}>
                    <Box
                      sx={{
                        p: 1.5,
                        textAlign: 'center',
                        borderRadius: '10px',
                        bgcolor: isDark ? `rgba(${item.color.join(',')}, 0.08)` : `rgba(${item.color.join(',')}, 0.06)`,
                        border: `1px solid ${isDark ? `rgba(${item.color.join(',')}, 0.2)` : `rgba(${item.color.join(',')}, 0.25)`}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.3)' : '0 6px 20px rgba(0,0,0,0.08)',
                          borderColor: `rgba(${item.color.join(',')}, 0.4)`,
                        },
                      }}
                    >
                      {item.icon}
                      <Typography variant="h5" fontWeight={700} color={item.valueColor}>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.label}
                      </Typography>
                      {item.subLabel && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {item.subLabel}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {/* Progress Bar */}
          {stats && (
            <Box sx={{ ...glassCardSx, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography fontWeight={500} sx={{ fontSize: '0.9rem' }}>{t('missions.todaysProgress')}</Typography>
                <Typography color="primary" fontWeight={600} sx={{ fontSize: '0.9rem' }}>
                  {stats.completed}/{stats.total} {t('missions.complete')}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: (t) => stats.allComplete
                      ? `linear-gradient(90deg, ${t.palette.success.main}, ${t.palette.success.light})`
                      : stats.completed > 0 && stats.completed >= stats.total / 2
                        ? `linear-gradient(90deg, ${t.palette.warning.main}, ${t.palette.primary.main})`
                        : `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.secondary.light})`,
                  },
                }}
              />
            </Box>
          )}

          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons={isMobile ? 'auto' : false}
            allowScrollButtonsMobile
            sx={{
              mb: 2.5,
              '& .MuiTab-root': { fontSize: '0.85rem', fontWeight: 500 },
            }}
          >
            <Tab label={`${t('missions.daily')} (${dailyMissions.length})`} />
            <Tab label={`${t('missions.weekly')} (${weeklyMissions.length})`} />
            <Tab label={t('missions.quickActions')} />
            <Tab label="Tasks" />
          </Tabs>

          {/* Daily Missions */}
          {tab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {dailyMissions.length === 0 ? (
                <EmptyState
                  icon={<AssignmentIcon sx={{ fontSize: 64 }} />}
                  title="No Daily Missions"
                  description="Sync from game to load today's missions, or check back after daily reset."
                  action={
                    <LoadingButton
                      loading={syncing}
                      startIcon={<SyncIcon />}
                      onClick={handleSyncFromGame}
                      disabled={!selectedAccount}
                      color="info"
                    >
                      Sync Missions
                    </LoadingButton>
                  }
                  minHeight={200}
                />
              ) : (
                dailyMissions.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))
              )}
            </Box>
          )}

          {/* Weekly Missions */}
          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {weeklyMissions.length === 0 ? (
                <EmptyState
                  icon={<AssignmentIcon sx={{ fontSize: 64 }} />}
                  title="No Weekly Missions"
                  description={t('missions.noWeeklyMissions')}
                  minHeight={200}
                />
              ) : (
                weeklyMissions.map((mission) => (
                  <MissionCard key={mission.id} mission={mission} />
                ))
              )}
            </Box>
          )}

          {/* Quick Actions */}
          {tab === 2 && (
            <Grid container spacing={2}>
              {[
                { label: t('missions.openPacksAction'), desc: t('missions.openPacksDesc'), task: 'OPEN_PACKS', color: 'primary' },
                { label: t('nav.wonderPick'), desc: t('missions.wonderPickDesc'), task: 'WONDER_PICK', color: 'secondary' },
                { label: t('missions.battle'), desc: t('missions.battleDesc'), task: 'BATTLE', color: 'warning' },
                { label: t('missions.claimMissions'), desc: t('missions.claimMissionsDesc'), task: 'CLAIM_MISSIONS', btnLabel: t('missions.claim'), color: 'success' },
              ].map(({ label, desc, task, btnLabel, color }) => (
                <Grid item xs={12} sm={6} md={3} key={task}>
                  <Box
                    sx={{
                      ...glassCardSx,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)',
                        borderColor: isDark ? 'rgba(124, 138, 255, 0.2)' : 'rgba(0,0,0,0.12)',
                      },
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>{label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex: 1 }}>
                      {desc}
                    </Typography>
                    <LoadingButton
                      fullWidth
                      loading={actionLoading}
                      onClick={() => handleRunTask(task)}
                      disabled={actionLoading}
                      color={color}
                      sx={{
                        background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                        color: '#fff',
                        borderRadius: '8px',
                        '&:hover': { background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.secondary.dark})` },
                      }}
                    >
                      {btnLabel || label}
                    </LoadingButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Tasks (full task management with checkboxes, redeem all, history) */}
          {tab === 3 && (
            <TasksPanel
              selectedAccount={selectedAccount}
              linkedAccounts={linkedAccounts}
            />
          )}

          {/* Task logs now rendered above (after buttons) */}
        </>
      )}
    </Box>

    {/* Claim Summary Dialog */}
    <Dialog
      open={!!claimSummary}
      onClose={() => setClaimSummary(null)}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Claim Summary
      </DialogTitle>
      <DialogContent>
        {claimSummary && (
          <List dense disablePadding>
            {claimSummary.hourglasses > 0 && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography>⏳</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={`${claimSummary.hourglasses} Hourglass${claimSummary.hourglasses > 1 ? 'es' : ''}`}
                  secondary="From hourglass missions"
                />
              </ListItem>
            )}
            {claimSummary.shinedust > 0 && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography>✨</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={`${claimSummary.shinedust} Shinedust`}
                  secondary="From hourglass missions"
                />
              </ListItem>
            )}
            {claimSummary.dailyBattles > 0 && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography>⚔️</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={`${claimSummary.dailyBattles} Battle${claimSummary.dailyBattles > 1 ? 's' : ''} Completed`}
                  secondary="For daily mission progress"
                />
              </ListItem>
            )}
            {claimSummary.dailyRewards > 0 && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography>🎁</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={`${claimSummary.dailyRewards} Daily Reward${claimSummary.dailyRewards > 1 ? 's' : ''}`}
                  secondary="Daily mission group rewards"
                />
              </ListItem>
            )}
            {claimSummary.dailyGift && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography>🛒</Typography>
                </ListItemIcon>
                <ListItemText
                  primary="Daily Free Gift"
                  secondary="1 Stamina Charger + 1 Shop Ticket from Item Shop"
                />
              </ListItem>
            )}
            {claimSummary.presents > 0 && (
              <ListItem disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Typography>📦</Typography>
                </ListItemIcon>
                <ListItemText
                  primary={`${claimSummary.presents} Present${claimSummary.presents > 1 ? 's' : ''}`}
                  secondary="From Present Box"
                />
              </ListItem>
            )}
            {!claimSummary.hourglasses && !claimSummary.shinedust && !claimSummary.dailyBattles &&
             !claimSummary.dailyRewards && !claimSummary.dailyGift && !claimSummary.presents && (
              <ListItem disableGutters>
                <ListItemText
                  primary="Everything already claimed!"
                  secondary="All rewards were already collected for today"
                />
              </ListItem>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setClaimSummary(null)} variant="contained" size="small">
          OK
        </Button>
      </DialogActions>
    </Dialog>

    </FadeIn>
  )
}

export default Missions
