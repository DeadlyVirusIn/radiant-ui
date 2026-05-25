/**
 * BotHub - Merged Bot Manager + Hunt Settings page
 * Combines friend acceptor bot controls with hunt pack selection and settings.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Divider,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  TextField,
  ListItemText,
  Slider,
  Autocomplete,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Speed as HuntIcon,
  Star as StarIcon,
  Style as RareIcon,
  SelectAll as JoinAllIcon,
  DeleteSweep as LeaveAllIcon,
  SmartToy as BotIcon,
  FilterAlt as FilterIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Tune as TuneIcon,
} from '@mui/icons-material'
import { useTheme } from '@mui/material'
import { bots, hunt, premiumHunt } from '../services/api'
import { onBotStatus, onBotLog, offBotStatus, offBotLog, onBotStats, offBotStats } from '../services/socket'
import { formatTime } from '../utils/dateFormat'
import { useLanguage } from '../contexts/LanguageContext'
import { useAccount } from '../contexts/AccountContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import AccountSelector from '../components/AccountSelector'
import { useSectionStyles } from '../components/SectionCard'
// Phase 24 Part 1 — weighted pack distribution editor. Additive — the
// existing multi-select Autocomplete still works and is unchanged.
import PackDistributionEditor from '../components/PackDistributionEditor'

// --- Pack grouping helpers (from HuntSettings) ---
function parseExpansion(exp) {
  const match = exp.match(/^([A-Z])(\d+)([a-z]?)$/i)
  if (!match) return { series: 'Z', major: 0, sub: '' }
  return { series: match[1].toUpperCase(), major: parseInt(match[2]), sub: match[3] || '' }
}

function compareExpansions(a, b) {
  const pa = parseExpansion(a)
  const pb = parseExpansion(b)
  if (pa.series !== pb.series) return pb.series.localeCompare(pa.series)
  if (pa.major !== pb.major) return pb.major - pa.major
  if (pa.sub && !pb.sub) return -1
  if (!pa.sub && pb.sub) return 1
  return pb.sub.localeCompare(pa.sub)
}

function groupPacksByExpansion(packs) {
  const groups = {}
  for (const pack of packs) {
    const exp = pack.expansion || 'Other'
    if (!groups[exp]) groups[exp] = []
    groups[exp].push(pack)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => compareExpansions(a, b))
    .map(([expansion, items]) => ({ expansion, packs: items }))
}

export default function BotHub() {
  const theme = useTheme()
  const { t } = useLanguage()
  const { accounts: linkedAccounts, selectedAccountId, selectAccount } = useAccount()
  const selectedAccount = selectedAccountId?.toString() || ''

  // --- Bot state ---
  const [botStatus, setBotStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [botLoading, setBotLoading] = useState(false)
  const [botError, setBotError] = useState('')
  // --- Hunt state ---
  const [huntAccounts, setHuntAccounts] = useState([])
  const [packs, setPacks] = useState([])
  const [joinedPacks, setJoinedPacks] = useState([])
  const [godPackEnabled, setGodPackEnabled] = useState(true)
  const [pseudoEnabled, setPseudoEnabled] = useState(false)
  const [minRareCards, setMinRareCards] = useState(1)
  const [keepAsFriend, setKeepAsFriend] = useState(false)
  const [selectedTiers, setSelectedTiers] = useState([0, 1, 2, 3, 4, 5])
  const [huntLoading, setHuntLoading] = useState(true)
  const [huntStatusLoading, setHuntStatusLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  // --- Shared state ---
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null })

  // Premium hunt filter settings
  const [premiumSettings, setPremiumSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Logs panel open
  // Tab-based section navigation (replaced 4 accordion toggles)
  const [activeSection, setActiveSection] = useState(0) // 0=Packs, 1=Settings, 2=Filters, 3=Logs
  // Backward-compat: sections that need to check visibility
  const packsOpen = activeSection === 0
  const settingsOpen = activeSection === 1
  const premiumOpen = activeSection === 2
  const logsOpen = activeSection === 3

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  // --- Derive hunt account_type from selected device account ---
  const selectedHuntAccount = (() => {
    if (!selectedAccount || linkedAccounts.length === 0) return 'main'
    const acct = linkedAccounts.find(a => a.id.toString() === selectedAccount)
    return acct?.account_type || 'main'
  })()

  // --- Load hunt data on mount ---
  useEffect(() => {
    async function init() {
      try {
        const [accountsRes, packsRes] = await Promise.all([
          hunt.getAccounts(),
          hunt.getPacks(),
        ])
        setHuntAccounts(accountsRes.accounts || [])
        setPacks(packsRes.packs || [])
      } catch (err) {
        console.error('Failed to load hunt data:', err)
      } finally {
        setHuntLoading(false)
      }
    }
    init()
    // Load premium hunt filter settings
    premiumHunt.getSettings().then(setPremiumSettings).catch(() => {})
  }, [])

  // --- Load hunt status when account changes ---
  const loadHuntStatus = useCallback(async (accountType) => {
    // Clear stale data immediately so UI doesn't show wrong account's packs
    setJoinedPacks([])
    setHuntStatusLoading(true)
    try {
      const status = await hunt.getMyStatus(accountType)
      const joinedNames = (status.joinedPacks || []).map(p => p.pack_name)
      setJoinedPacks(joinedNames)
      setGodPackEnabled(joinedNames.length > 0)
      setPseudoEnabled(status.pseudoEnabled || false)
      setMinRareCards(status.minRareCards || 1)
      setKeepAsFriend(status.keepAsFriend || false)
      setSelectedTiers(status.selectedTiers || [0, 1, 2, 3, 4, 5])
    } catch (err) {
      // Hunt account may not exist for this device account
      setJoinedPacks([])
    } finally {
      setHuntStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!huntLoading && huntAccounts.length > 0) {
      loadHuntStatus(selectedHuntAccount)
    }
  }, [selectedHuntAccount, huntLoading, huntAccounts.length, loadHuntStatus])

  // --- Bot status & logs ---
  const loadBotStatus = useCallback(async () => {
    if (!selectedAccount) return
    try {
      const data = await bots.getStatus(selectedAccount)
      setBotStatus(data)
    } catch (err) {
      console.error('Failed to load bot status:', err)
    }
  }, [selectedAccount])

  const loadLogs = useCallback(async () => {
    if (!selectedAccount) return
    try {
      const data = await bots.getLogs(selectedAccount, 50)
      setLogs(data.logs || [])
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
  }, [selectedAccount])

  useEffect(() => {
    if (selectedAccount) {
      loadBotStatus()
      loadLogs()
    }
  }, [selectedAccount, loadBotStatus, loadLogs])

  // Socket listeners (via botSocket — initialized at App level)
  useEffect(() => {
    const handleBotStatus = (data) => {
      if (data.accountId === parseInt(selectedAccount)) {
        setBotStatus((prev) => ({ ...prev, status: data.status }))
      }
    }
    const handleBotLog = (data) => {
      if (data.accountId === parseInt(selectedAccount)) {
        setLogs((prev) => [data, ...prev].slice(0, 100))
      }
    }
    const handleBotStats = (data) => {
      if (data.accountId === parseInt(selectedAccount)) {
        setBotStatus((prev) => ({ ...prev, stats: data.stats }))
      }
    }
    onBotStatus(handleBotStatus)
    onBotLog(handleBotLog)
    onBotStats(handleBotStats)
    return () => {
      offBotStatus(handleBotStatus)
      offBotLog(handleBotLog)
      offBotStats(handleBotStats)
    }
  }, [selectedAccount])

  // --- Bot actions ---
  const handleStartBot = async () => {
    setBotError('')
    setBotLoading(true)
    try {
      const data = await bots.start(selectedAccount)
      if (data.error) {
        setBotError(friendlyError(data.error))
      } else {
        setBotStatus((prev) => ({ ...prev, status: 'starting' }))
        showSnackbar('Bot starting...')
      }
    } catch (err) {
      setBotError(friendlyError(err.message || 'Failed to start bot'))
    } finally {
      setBotLoading(false)
    }
  }

  const handleStopBot = async () => {
    setBotError('')
    setBotLoading(true)
    try {
      const data = await bots.stop(selectedAccount)
      if (data.error && data.error !== 'Bot is not running') {
        setBotError(friendlyError(data.error))
      } else {
        setBotStatus((prev) => ({ ...prev, status: 'stopped' }))
        showSnackbar('Bot stopped — pack selection cleared')
        // Refresh hunt status to reflect cleared pack selection
        await loadHuntStatus(selectedHuntAccount)
      }
    } catch (err) {
      if (err.message === 'Bot is not running') {
        setBotStatus((prev) => ({ ...prev, status: 'stopped' }))
      } else {
        setBotError(friendlyError(err.message || 'Failed to stop bot'))
      }
    } finally {
      setBotLoading(false)
    }
  }

  // Wave 9: current era from user's existing selection (null when empty)
  // Derived from the packs array returned by GET /hunt/packs, which
  // carries the canonical 'era' field annotated by lib/containerPolicy.
  const currentPackEra = useMemo(() => {
    if (!joinedPacks.length || !packs.length) return null
    // Check all joined packs — by invariant they should all share an era.
    // If we ever see mixed locally, prefer the first seen era (server rejects
    // mixed on next write).
    for (const name of joinedPacks) {
      const p = packs.find(x => x.name === name)
      if (p?.era) return p.era
    }
    return null
  }, [joinedPacks, packs])

  // --- Hunt actions ---
  const handlePackToggle = async (packName, packLabel) => {
    // Guard: don't toggle packs while switching accounts (prevents race condition)
    if (huntStatusLoading) return
    // Phase 5.16 — block selection of packs that are still gated by
    // launch verification. Surface a clear message instead of letting
    // the request hit the server (where it would also be blocked).
    const targetForGate = packs.find(p => p.name === packName)
    if (targetForGate?.pending === true || targetForGate?.launch_blocker_until_verified === true) {
      showSnackbar(
        `${packLabel} is staged but waiting for live pack ID verification. ` +
        `It will become selectable once the launch is verified.`,
        'warning'
      )
      return
    }
    const joined = joinedPacks.includes(packName)

    // Wave 9: era-lock. If the user is about to add a pack from a different
    // era, show the switch dialog instead of silently firing the request.
    if (!joined && currentPackEra) {
      const targetPack = packs.find(p => p.name === packName)
      if (targetPack?.era && targetPack.era !== currentPackEra) {
        setConfirmDialog({
          open: true,
          title: `Switch to ${targetPack.era}-era?`,
          message:
            `You currently have ${currentPackEra}-era packs selected. ` +
            `Joining "${packLabel}" requires leaving all ${currentPackEra}-era packs first. ` +
            `Leave them and switch?`,
          confirmLabel: `Leave all ${currentPackEra}-era & switch`,
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, open: false }))
            setActionLoading(packName)
            try {
              // Two-phase: leave all then join the new pack
              await hunt.leaveAllPacks(selectedHuntAccount)
              await hunt.joinPack(selectedHuntAccount, packName)
              showSnackbar(`Switched to ${targetPack.era}-era — joined ${packLabel}`)
              await loadHuntStatus(selectedHuntAccount)
            } catch (err) {
              await loadHuntStatus(selectedHuntAccount)
              showSnackbar(err.message, 'error')
            } finally {
              setActionLoading(null)
            }
          },
        })
        return
      }
    }

    setActionLoading(packName)
    // Optimistic update
    if (joined) {
      setJoinedPacks(prev => prev.filter(n => n !== packName))
    } else {
      setJoinedPacks(prev => [...prev, packName])
    }
    try {
      if (joined) {
        await hunt.leavePack(selectedHuntAccount, packName)
        showSnackbar(`Left ${packLabel}`)
      } else {
        await hunt.joinPack(selectedHuntAccount, packName)
        showSnackbar(`Joined ${packLabel}`)
      }
    } catch (err) {
      await loadHuntStatus(selectedHuntAccount)
      // Wave 9: surface server-side era conflicts with an actionable message
      const msg = err?.message || 'Request failed'
      if (/era/i.test(msg) || err?.response?.data?.error === 'era_conflict') {
        showSnackbar(msg, 'warning')
      } else {
        showSnackbar(msg, 'error')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleJoinAll = () => {
    setConfirmDialog({
      open: true,
      title: 'Join All Hunts?',
      message: `This will add your ${selectedHuntAccount} account to ALL available pack hunts.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }))
        setActionLoading('__all__')
        try {
          const result = await hunt.joinAllPacks(selectedHuntAccount)
          showSnackbar(`Joined ${result.count || 'all'} packs`)
          await loadHuntStatus(selectedHuntAccount)
        } catch (err) {
          showSnackbar(err.message, 'error')
        } finally {
          setActionLoading(null)
        }
      },
    })
  }

  const handleLeaveAll = () => {
    setConfirmDialog({
      open: true,
      title: 'Leave All Hunts?',
      message: `This will remove your ${selectedHuntAccount} account from ALL pack hunts.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }))
        setActionLoading('__all__')
        try {
          await hunt.leaveAllPacks(selectedHuntAccount)
          showSnackbar('Left all hunts')
          await loadHuntStatus(selectedHuntAccount)
        } catch (err) {
          showSnackbar(err.message, 'error')
        } finally {
          setActionLoading(null)
        }
      },
    })
  }

  const handleGodPackToggle = async (event) => {
    const enabled = event.target.checked
    setGodPackEnabled(enabled)
    try {
      await hunt.updateMinStars(selectedHuntAccount, enabled ? 5 : 8)
      showSnackbar(`God pack notifications ${enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      setGodPackEnabled(!enabled)
      showSnackbar(err.message, 'error')
    }
  }

  const handlePseudoToggle = async (event) => {
    const enabled = event.target.checked
    setPseudoEnabled(enabled)
    try {
      await hunt.togglePseudo(selectedHuntAccount, enabled)
      showSnackbar(`Pseudo god packs ${enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      setPseudoEnabled(!enabled)
      showSnackbar(err.message, 'error')
    }
  }

  const handleMinRareCardsChange = async (_event, value) => {
    if (value === null) return
    const v = parseInt(value)
    setMinRareCards(v)
    try {
      await hunt.updateMinRareCards(selectedHuntAccount, v)
      showSnackbar(`Min rare cards set to ${v}+`)
    } catch (err) {
      showSnackbar(err.message, 'error')
    }
  }

  const handleKeepAsFriendToggle = async (event) => {
    const enabled = event.target.checked
    setKeepAsFriend(enabled)
    try {
      await hunt.toggleKeepAsFriend(selectedHuntAccount, enabled)
      showSnackbar(`Keep as friend ${enabled ? 'enabled' : 'disabled'}`)
    } catch (err) {
      setKeepAsFriend(!enabled)
      showSnackbar(err.message, 'error')
    }
  }

  const handleTierToggle = async (tier) => {
    const prev = selectedTiers
    const newTiers = prev.includes(tier)
      ? prev.filter(t => t !== tier)
      : [...prev, tier].sort((a, b) => a - b)

    if (newTiers.length === 0) {
      showSnackbar('Must select at least one tier', 'warning')
      return
    }

    setSelectedTiers(newTiers)
    try {
      await hunt.updateSelectedTiers(selectedHuntAccount, newTiers)
      showSnackbar(`God pack tiers: ${newTiers.map(t => `${t}/5`).join(', ')}`)
    } catch (err) {
      setSelectedTiers(prev)
      showSnackbar(err.message || 'Failed to update tiers', 'error')
    }
  }

  const handleSavePremiumSettings = async () => {
    if (!premiumSettings) return
    setSavingSettings(true)
    try {
      await premiumHunt.updateSettings(premiumSettings)
      showSnackbar('Premium hunt filters saved')
    } catch (err) {
      showSnackbar(err.message || 'Failed to save premium settings', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  // --- Helpers ---
  const isBotRunning = botStatus?.status === 'running' || botStatus?.status === 'starting'

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
      case 'info': case 'success': return theme.palette.success.main
      default: return theme.palette.text.secondary
    }
  }

  // Build autocomplete options grouped by expansion
  const packOptions = (() => {
    const groups = groupPacksByExpansion(packs)
    const options = []
    for (const group of groups) {
      for (const pack of group.packs) {
        options.push({ ...pack, group: group.expansion })
      }
    }
    return options
  })()

  const selectedPackObjects = packOptions.filter(p => joinedPacks.includes(p.name))

  const isDark = theme.palette.mode === 'dark'

  const tabularNums = { fontVariantNumeric: 'tabular-nums' }

  const { sectionBox } = useSectionStyles()

  if (linkedAccounts.length === 0 && !huntLoading) {
    return (
      // Wave 10.1: responsive maxWidth — full viewport on phone, capped on desktop
      <Box sx={{ maxWidth: { xs: '100%', md: 900 }, mx: 'auto', mt: 4 }}>
        <Box sx={sectionBox}>
          <EmptyState
            icon={<BotIcon sx={{ fontSize: 56 }} />}
            title="No Accounts Linked"
            description="Go to Link Account to add an account first."
          />
        </Box>
      </Box>
    )
  }

  return (
    // Wave 10.1: responsive maxWidth — phones get full width, desktop capped at 900px
    <Box sx={{ maxWidth: { xs: '100%', md: 900 }, mx: 'auto' }}>
      <PageHeader
        icon={<BotIcon />}
        title="Bot Hub"
        subtitle="Bot controls, pack selection and hunt settings"
      />

      {/* === Section 1: Account + Bot Controls === */}
      <FadeIn>
        <Box sx={{ ...sectionBox, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BotIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
            <Typography variant="caption" fontWeight={600} color="primary.main" textTransform="uppercase" letterSpacing={0.8}>
              Bot Controls
            </Typography>
          </Box>

          {/* Account selector + status badge row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <AccountSelector minWidth={200} sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }} hideIfSingle={false} />

            {/* Prominent status indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: '10px',
                bgcolor: isDark
                  ? `${getStatusDotColor(botStatus?.status)}14`
                  : `${getStatusDotColor(botStatus?.status)}0A`,
                border: `1px solid ${getStatusDotColor(botStatus?.status)}33`,
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: getStatusDotColor(botStatus?.status),
                  boxShadow: botStatus?.status === 'running'
                    ? `0 0 0 4px ${theme.palette.success.main}30, 0 0 8px ${theme.palette.success.main}40`
                    : botStatus?.status === 'starting'
                    ? `0 0 0 4px ${theme.palette.warning.main}30`
                    : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  textTransform: 'capitalize',
                  color: getStatusDotColor(botStatus?.status),
                  letterSpacing: 0.3,
                }}
              >
                {botStatus?.status || 'Unknown'}
              </Typography>
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {isBotRunning ? (
              <Button
                variant="contained"
                color="error"
                startIcon={botLoading ? <CircularProgress size={16} color="inherit" /> : <StopIcon />}
                onClick={handleStopBot}
                disabled={botLoading}
                sx={{
                  borderRadius: '10px',
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  flex: { xs: '1 1 100%', sm: '0 0 auto' },
                  boxShadow: `0 4px 14px ${theme.palette.error.main}40`,
                  '&:hover': { boxShadow: `0 6px 20px ${theme.palette.error.main}50` },
                }}
              >
                {botLoading ? 'Stopping...' : 'Stop Bot'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={botLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                onClick={handleStartBot}
                disabled={botLoading}
                sx={{
                  borderRadius: '10px',
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  flex: { xs: '1 1 100%', sm: '0 0 auto' },
                  boxShadow: `0 4px 14px ${theme.palette.success.main}40`,
                  '&:hover': { boxShadow: `0 6px 20px ${theme.palette.success.main}50` },
                }}
              >
                {botLoading ? 'Starting...' : 'Start Bot'}
              </Button>
            )}
          </Box>

          {botError && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: '10px' }} onClose={() => setBotError('')}>
              {botError}
            </Alert>
          )}

          {/* Cleanup state indicator */}
          {botStatus?.stats?.cleanupState && botStatus.stats.cleanupState !== 'idle' && (
            <Alert severity="info" sx={{ mt: 1.5, borderRadius: '10px' }} icon={<CircularProgress size={16} />}>
              {botStatus.stats.cleanupState === 'building_protection'
                ? 'Building protected friends list...'
                : botStatus.stats.cleanupState === 'deleting'
                ? 'Cleaning friend list...'
                : 'Cleanup cooldown...'}
            </Alert>
          )}

          {/* Offline warning */}
          {!isBotRunning && joinedPacks.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '10px' }}>
              Bot is offline. Friend requests from hunts are paused until you start your bot.
            </Alert>
          )}

          {/* Inline stats strip */}
          {botStatus?.stats && (
            <Box
              sx={{
                mt: 2, pt: 2,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(auto-fit, minmax(90px, auto))' },
                gap: { xs: 2, sm: 3 },
              }}
            >
              {[
                { label: 'Accepted', value: botStatus.stats.friendRequestsAccepted || 0, color: theme.palette.success.main },
                ...(botStatus.stats.currentFriendCount != null ? [{
                  label: 'Friends', value: `${botStatus.stats.currentFriendCount}/100`, color: theme.palette.primary.main,
                }] : []),
                { label: 'Errors', value: botStatus.stats.errors || 0, color: theme.palette.error.main },
                ...(botStatus.stats.cleanupStats?.totalFriendsRemoved > 0 ? [{
                  label: 'Cleaned', value: botStatus.stats.cleanupStats.totalFriendsRemoved, color: theme.palette.info.main,
                }] : []),
              ].map((stat) => (
                <Box key={stat.label} sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography variant="h5" fontWeight={700} lineHeight={1} sx={{ ...tabularNums, color: stat.color }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </FadeIn>

      {/* === Active Filter Summary Strip === */}
      {premiumSettings && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap',
          px: 1.5, py: 0.75, borderRadius: '8px',
          bgcolor: isDark ? 'rgba(124,138,255,0.06)' : 'rgba(92,106,196,0.04)',
          border: `1px solid ${isDark ? 'rgba(124,138,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mr: 0.5 }}>
            Active Filters:
          </Typography>
          {/*
           * Phase 24 bug-fix: the tier chip used to read from
           * `premiumSettings.selectedTiers`, but that object belongs to
           * the premium-hunt filters API (pattern/wishlist/GP toggles)
           * and does NOT carry tier state. The canonical source for
           * selected tiers is `selectedTiers` (seeded from
           * hunt.getMyStatus at mount, updated optimistically by
           * handleTierToggle and persisted via hunt.updateSelectedTiers).
           * Binding to the state variable makes the chip always match
           * the toggle group below (and the server).
           */}
          <Chip
            label={`Tier ${selectedTiers.length > 0 ? selectedTiers.join(',') + '/5' : 'none'}`}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
          {premiumSettings.pattern3plus1Enabled === 1 && (
            <Chip label="3+1" size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
          {premiumSettings.pattern2x2Enabled === 1 && (
            <Chip label="2x2" size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
          {premiumSettings.wishlistFilterEnabled === 1 ? (
            <Chip label="Wishlist ON" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          ) : (
            <Chip label="Wishlist OFF" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', opacity: 0.5 }} />
          )}
          {premiumSettings.godPackEnabled === 1 && (
            <Chip label="GP Alerts" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
          {premiumSettings.keepAsFriend === 1 && (
            <Chip label="Keep Friend" size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
          )}
        </Box>
      )}

      {/* === Section Navigation Tabs === */}
      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeSection}
          onChange={(_, v) => setActiveSection(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', minHeight: 40, py: 0.5 },
          }}
        >
          <Tab label={`Packs${selectedPackObjects.length > 0 ? ` (${selectedPackObjects.length})` : ''}`} icon={<HuntIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label="Settings" icon={<SettingsIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label="Hunt Filters" icon={<FilterIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label={`Logs${logs.length > 0 ? ` (${logs.length})` : ''}`} icon={<BotIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* === Section 2: Pack Selection === */}
      {packsOpen && <FadeIn delay={0.05}>
        <Box sx={{ ...sectionBox, mb: 2 }}>
          <Autocomplete
            multiple
            disabled={huntStatusLoading || !!actionLoading}
            loading={huntStatusLoading}
            options={packOptions}
            groupBy={(option) => option.group}
            getOptionLabel={(option) => option.label || option.name}
            value={selectedPackObjects}
            onChange={(_event, newValue, reason, details) => {
              if (huntStatusLoading) return // Guard against race during account switch
              if (reason === 'selectOption' && details?.option) {
                handlePackToggle(details.option.name, details.option.label)
              } else if (reason === 'removeOption' && details?.option) {
                handlePackToggle(details.option.name, details.option.label)
              }
            }}
            disableCloseOnSelect
            renderOption={(props, option, { selected }) => {
              const { key, ...restProps } = props
              // Wave 9: visual era-lock. Incompatible packs get dimmed +
              // a subtitle; they remain clickable so the user can trigger
              // the "switch era" dialog (handled in handlePackToggle).
              const isIncompatible = currentPackEra && option.era && option.era !== currentPackEra
              // Phase 5.16 — pending packs (e.g. B3 pre-verification) get
              // a "Pending verification" badge + dimmed style; the
              // checkbox stays uncheckable because handlePackToggle
              // refuses pending names with a snackbar warning.
              const isPending = option.pending === true || option.launch_blocker_until_verified === true
              const dimOpacity = isPending ? 0.45 : (isIncompatible ? 0.55 : 1)
              return (
                <li key={key} {...restProps} style={{ ...(restProps.style || {}), opacity: dimOpacity }}>
                  <Checkbox
                    checked={joinedPacks.includes(option.name)}
                    disabled={isPending}
                    sx={{ mr: 1 }}
                    size="small"
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <ListItemText
                      primary={option.label || option.name}
                      secondary={isPending
                        ? `Pending verification — staged but waiting for live pack ID`
                        : (isIncompatible
                            ? `${option.era}-era — click to switch from ${currentPackEra}-era`
                            : (option.era && joinedPacks.length === 0 ? `${option.era}-era` : null))}
                      primaryTypographyProps={{ sx: { fontSize: '0.85rem' } }}
                      secondaryTypographyProps={{ sx: { fontSize: '0.7rem', color: isPending ? 'info.main' : (isIncompatible ? 'warning.main' : 'text.disabled') } }}
                    />
                  </Box>
                  {isPending && (
                    <Chip
                      label="Coming soon"
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.6rem', ml: 1, flexShrink: 0 }}
                    />
                  )}
                </li>
              )
            }}
            renderTags={(value) => (
              <Chip
                label={`${value.length} pack${value.length !== 1 ? 's' : ''} selected`}
                color="success"
                size="small"
                variant="outlined"
              />
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Selected Packs"
                placeholder={joinedPacks.length === 0 ? 'Click to select packs...' : ''}
                size="small"
              />
            )}
            sx={{ mb: 1.5 }}
          />

          {/* Phase 24 Part 1 — weighted distribution editor.
           *
           * Default Bot Hub UX is the simple checkbox selection above —
           * picking packs there is all a normal user needs. When they
           * have 2+ packs selected the existing dispatch path treats
           * them as equally weighted (legacy behavior, unchanged).
           *
           * The weighted editor below is now opt-in, collapsed into an
           * "Advanced distribution" accordion, so it no longer intrudes
           * on the primary flow. Power users who want percentage
           * control can expand it; everyone else sees a single-line
           * row they can ignore.
           *
           * The accordion only renders when an account is selected —
           * the editor needs a containerId to know which distribution
           * to load/save.
           */}
          {selectedAccountId && (
            <Accordion
              disableGutters
              elevation={0}
              defaultExpanded={false}
              sx={{
                mb: 1.5,
                bgcolor: 'transparent',
                border: (t) => `1px dashed ${t.palette.divider}`,
                borderRadius: '10px',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon fontSize="small" />}
                sx={{ minHeight: 40, px: 1.5, '& .MuiAccordionSummary-content': { my: 0.75 } }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TuneIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>
                    Advanced distribution
                  </Typography>
                  <Chip
                    size="small"
                    label="Optional"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    — weight packs by %. Selected packs default to equal weighting.
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
                <PackDistributionEditor
                  containerId={`user_${selectedAccountId}_main`}
                  availablePacks={packOptions}
                  title="Pack Distribution (Weighted)"
                />
              </AccordionDetails>
            </Accordion>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={actionLoading === '__all__' ? <CircularProgress size={14} /> : <LeaveAllIcon />}
              onClick={handleLeaveAll}
              disabled={!!actionLoading || huntStatusLoading || joinedPacks.length === 0}
              sx={{ borderRadius: '8px', flex: { xs: '1 1 calc(50% - 4px)', sm: '0 0 auto' }, textTransform: 'none', fontWeight: 600 }}
            >
              Leave All
            </Button>
          </Box>
        </Box>
      </FadeIn>}

      {/* === Section 3: Hunt Settings === */}
      {settingsOpen && <FadeIn delay={0.1}>
        <Box sx={{ ...sectionBox, mb: 2 }}>
          {/* Toggle row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: godPackEnabled || pseudoEnabled ? 2 : 0 }}>
            <FormControlLabel
              control={<Switch checked={godPackEnabled} onChange={handleGodPackToggle} color="success" size="small" />}
              label={<Typography variant="body2">God Pack Alerts</Typography>}
            />
            <FormControlLabel
              control={<Switch checked={pseudoEnabled} onChange={handlePseudoToggle} color="secondary" size="small" />}
              label={<Typography variant="body2">Pseudo Packs</Typography>}
            />
            <FormControlLabel
              control={<Switch checked={keepAsFriend} onChange={handleKeepAsFriendToggle} color="primary" size="small" />}
              label={<Typography variant="body2">Keep as Friend</Typography>}
            />
          </Box>

          {pseudoEnabled && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Tooltip title="Minimum rare cards to trigger pseudo notification">
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <RareIcon fontSize="small" /> Min rare:
                </Typography>
              </Tooltip>
              <ToggleButtonGroup
                value={String(minRareCards)}
                exclusive
                onChange={handleMinRareCardsChange}
                size="small"
              >
                <ToggleButton value="1">1/5</ToggleButton>
                <ToggleButton value="2">2/5</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {godPackEnabled && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Tooltip title="Select which god pack tiers you want notifications for. Unselected tiers will be skipped.">
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarIcon fontSize="small" sx={{ color: '#ffd700' }} /> Tiers:
                </Typography>
              </Tooltip>
              <ToggleButtonGroup
                value={selectedTiers}
                size="small"
                onChange={(e, newVal) => {
                  // MUI ToggleButtonGroup with non-exclusive returns the full new array
                  // Find which tier was toggled
                  const added = newVal.find(t => !selectedTiers.includes(t))
                  const removed = selectedTiers.find(t => !newVal.includes(t))
                  handleTierToggle(added !== undefined ? added : removed)
                }}
              >
                {[0, 1, 2, 3, 4, 5].map(tier => (
                  <ToggleButton key={tier} value={tier} sx={{
                    px: 1.5, py: 0.5,
                    '&.Mui-selected': { bgcolor: 'success.main', color: 'white', '&:hover': { bgcolor: 'success.dark' } },
                  }}>
                    {tier}/5
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>
      </FadeIn>}

      {/* === Section 3b: Premium Hunt Filters === */}
      {premiumOpen && premiumSettings && (
        <FadeIn delay={0.15}>
          <Box sx={{ ...sectionBox, mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Pattern filters bypass your star threshold — keep packs with special duplicate patterns
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              All cards (1-star + 2-star)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={premiumSettings.pattern3plus1Enabled === 1}
                    onChange={(e) => setPremiumSettings(prev => ({ ...prev, pattern3plus1Enabled: e.target.checked ? 1 : 0 }))}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Keep 3+1 packs (3+ copies of same card)</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={premiumSettings.pattern2x2Enabled === 1}
                    onChange={(e) => setPremiumSettings(prev => ({ ...prev, pattern2x2Enabled: e.target.checked ? 1 : 0 }))}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Keep 2x2 packs (2+ pairs of duplicates)</Typography>}
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              2-star only (SR / SAR)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={premiumSettings.pattern3plus12starEnabled === 1}
                    onChange={(e) => setPremiumSettings(prev => ({ ...prev, pattern3plus12starEnabled: e.target.checked ? 1 : 0 }))}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Keep 3+1 packs (3+ copies of same 2-star card)</Typography>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={premiumSettings.pattern2x22starEnabled === 1}
                    onChange={(e) => setPremiumSettings(prev => ({ ...prev, pattern2x22starEnabled: e.target.checked ? 1 : 0 }))}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Keep 2x2 packs (2+ pairs of 2-star duplicates)</Typography>}
              />
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Wishlist filter — only notify if enough wishlisted card copies are in the god pack
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={premiumSettings.wishlistFilterEnabled === 1}
                  onChange={(e) => setPremiumSettings(prev => ({ ...prev, wishlistFilterEnabled: e.target.checked ? 1 : 0 }))}
                  size="small"
                />
              }
              label={<Typography variant="body2">Only notify if wishlisted cards found</Typography>}
            />

            {premiumSettings.wishlistFilterEnabled === 1 && (
              <Box sx={{ mt: 1, px: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  At least {premiumSettings.wishlistThreshold || 3} of 5 cards in pack must be on your wishlist
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Copies count — 3x of the same wishlisted card = 3 matches
                </Typography>
                <Slider
                  value={premiumSettings.wishlistThreshold || 3}
                  onChange={(e, val) => setPremiumSettings(prev => ({ ...prev, wishlistThreshold: val }))}
                  min={1}
                  max={5}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  // Wave 10.1: full-width on phone, capped on tablet+ for usability
                  sx={{ maxWidth: { xs: '100%', sm: 300 } }}
                />
              </Box>
            )}

            <Box sx={{ mt: 1.5 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleSavePremiumSettings}
                disabled={savingSettings}
                startIcon={savingSettings ? <CircularProgress size={14} color="inherit" /> : <SettingsIcon />}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
              >
                {savingSettings ? 'Saving...' : 'Save Filters'}
              </Button>
            </Box>
          </Box>
        </FadeIn>
      )}

      {/* === Section 4: Live Logs === */}
      {logsOpen && <FadeIn delay={0.2}>
        <Box sx={sectionBox}>
          {(
            <Box
              sx={{
                mt: 1.5,
                bgcolor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
                borderRadius: '10px',
                p: 1.5,
                maxHeight: 300,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: 11,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              {logs.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                  No logs yet. Start the bot to see activity.
                </Typography>
              ) : (
                logs.map((log, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 0.3,
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
          )}
        </Box>
      </FadeIn>}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
          <Button onClick={confirmDialog.onConfirm} variant="contained" autoFocus>
            {confirmDialog.confirmLabel || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
