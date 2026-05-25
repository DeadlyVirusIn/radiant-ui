import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Chip,
  Avatar,
  Paper,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  useTheme,
} from '@mui/material'
import {
  Link as LinkIcon,
  SmartToy as BotIcon,
  CheckCircle as TaskIcon,
  CatchingPokemon as PokeballIcon,
  ChevronRight as ArrowIcon,
  Schedule as ScheduleIcon,
  AccountCircle as AccountIcon,
  Groups as FriendsIcon,
  CardGiftcard as RewardsIcon,
  SportsEsports as BattleIcon,
  Inventory as PackIcon,
  AutoAwesome as WonderIcon,
  EmojiEvents as MissionIcon,
  Cloud as ProxyIcon,
  Warning as WarningIcon,
  PlayCircle as RunningIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Message as MessageIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  FiberManualRecord as DotIcon,
  Star as StarIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { accounts, tasks, profile, collection, autoTrade, autoGift } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useAccount } from '../contexts/AccountContext'
import { OnboardingChecklist } from '../components/OnboardingChecklist'
import { BentoGrid, BentoItem } from '../components/BentoGrid'
import MetricCard from '../components/MetricCard'
import MetricStrip from '../components/MetricStrip'
import RequestFunnel from '../components/RequestFunnel'
import SystemHealthMini from '../components/SystemHealthMini'
import GlassCard from '../components/GlassCard'
import ActivityFeed from '../components/ActivityFeed'
import InsightCards from '../components/InsightCards'
import PageHeader from '../components/PageHeader'
import SyncStatusChip from '../components/SyncStatusChip'
// Phase 5.10 — shared value-tier chip on recent godpack rows.
import ValueTierChip from '../components/ValueTierChip'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import RecommendationCard, { useRecommendations } from '../components/RecommendationCard'
import { useHuntStats } from '../contexts/HuntStatsContext'
import { useRecentGodPacks } from '../hooks/useRecentGodPacks'
// Phase 4 (Apr 2026) — NOW / NEXT / RISK intelligence strip
import IntelligenceStrip from '../components/IntelligenceStrip'
import HuntIntelligence from '../components/HuntIntelligence'
import GodPackIntelligence from '../components/GodPackIntelligence'
import InsightStrip2 from '../components/InsightStrip2'
import InstallAppButton from '../components/InstallAppButton'
import { EmptyState } from '../components/EmptyState'
import { DashboardSkeleton } from '../components/skeletons/PageSkeletons'
import { formatNumber, formatCompact, tabularNumStyle } from '../utils/formatNumber'

// ── Animation variants ─────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

// ── Quick Action Button (compact) ─────────────────────────────────────
const QuickActionBtn = ({ icon, title, color, onClick }) => (
  <Tooltip title={title} arrow>
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        transition: 'transform 0.15s ease',
        '&:hover': { transform: 'translateY(-2px)' },
        '&:active': { transform: 'scale(0.96)' },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${color}, ${color}bb)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 3px 12px ${color}30`,
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', fontSize: '0.6875rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.1 }}
        noWrap
      >
        {title}
      </Typography>
    </Box>
  </Tooltip>
)

// ── Activity Timeline Item (vertical timeline with dots + connecting line) ──
const ActivityTimelineItem = ({ date, time, text, color, isDark, isLast, relativeTime, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex',
      gap: 1.5,
      position: 'relative',
      pb: isLast ? 0 : 2,
      cursor: onClick ? 'pointer' : 'default',
      borderRadius: '8px',
      px: 1,
      mx: -1,
      transition: 'background-color 0.2s ease',
      '&:hover': onClick ? {
        bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
      } : {},
    }}
  >
    {/* Timeline stem */}
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
      {/* Dot */}
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
          mt: 0.5,
          boxShadow: `0 0 6px ${color}50`,
        }}
      />
      {/* Connecting line */}
      {!isLast && (
        <Box
          sx={{
            width: 2,
            flex: 1,
            mt: 0.5,
            bgcolor: isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            borderRadius: 1,
          }}
        />
      )}
    </Box>
    {/* Content */}
    <Box sx={{ flex: 1, minWidth: 0, pb: 0.5 }}>
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.3, mb: 0.25 }}>
        {text}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
        {relativeTime || `${date} at ${time}`}
      </Typography>
    </Box>
  </Box>
)

// ── Greeting helper ────────────────────────────────────────────────────
// Generate a simple sparkline from current value (visual placeholder until real historical data)
const generateSparkline = (currentValue, points = 7) => {
  if (!currentValue || currentValue === 0) return null
  const base = currentValue * 0.7
  const range = currentValue * 0.6
  return Array.from({ length: points }, (_, i) =>
    ({ v: i === points - 1 ? currentValue : Math.round(base + Math.random() * range) })
  )
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const getFormattedDate = () => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getRelativeTime = (dateStr) => {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
}

// ── Time ago helper (compact) ─────────────────────────────────────────
const timeAgo = (ts) => {
  if (!ts) return ''
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.floor(h / 24) + 'd ago'
}

// ════════════════════════════════════════════════════════════════════════
//  Dashboard Component
// ════════════════════════════════════════════════════════════════════════
export default function Dashboard({ user }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const { t } = useLanguage()
  const { accounts: linkedAccounts, selectedAccount, selectAccount, refreshAccounts } = useAccount()
  const [taskHistory, setTaskHistory] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [collectionSummary, setCollectionSummary] = useState(null) // canonical source (same as Tracker)
  const [requestAnalytics, setRequestAnalytics] = useState(null) // computed from trade+gift requests
  const [allRequests, setAllRequests] = useState([]) // raw trade+gift requests for funnel
  const prevAnalyticsRef = useRef(null) // previous values for trend calculation
  const [loading, setLoading] = useState(true)

  // Profile Manager state
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileIcons, setProfileIcons] = useState([])
  const [profileMessages, setProfileMessages] = useState([])
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [editNickname, setEditNickname] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  // ── Recommendations ─────────────────────────────────────────────────
  const { recommendations, dismiss: dismissRec } = useRecommendations()

  // ── Hunt Status (from shared context — NO independent polling) ──────
  const { data: huntStatsCtx } = useHuntStats()
  const huntStats = huntStatsCtx?._raw || null // Dashboard uses raw summary shape
  const ppmHistoryRef = useRef([])
  const aliveHistoryRef = useRef([])

  // Update local history refs when context data changes
  useEffect(() => {
    if (!huntStatsCtx) return
    ppmHistoryRef.current = [...ppmHistoryRef.current.slice(-9), { v: huntStatsCtx.ppm || 0 }]
    aliveHistoryRef.current = [...aliveHistoryRef.current.slice(-9), { v: huntStatsCtx.activeWorkers || 0 }]
  }, [huntStatsCtx])

  // Wave 4.1: recent-godpacks polling + circuit breaker moved to a
  // module-level singleton (hooks/useRecentGodPacks.js). Reason: when
  // Dashboard was mounted more than once (e.g., due to StrictMode or
  // accidental remount via route Suspense), each mount used to spawn
  // its own setInterval + its own breaker. Result: N pollers and N
  // independent pause-log emissions. Now: one timer, one breaker,
  // N subscribers — exactly one pause log per failure streak regardless
  // of mount count.
  const recentGodpacks = useRecentGodPacks()

  useEffect(() => {
    loadData()
    // Auto-refresh KPIs every 60s so counts stay current
    const refreshInterval = setInterval(loadData, 60000)
    return () => clearInterval(refreshInterval)
  }, [selectedAccount?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load profile when selectedAccount changes (e.g., restored from localStorage)
  useEffect(() => {
    if (selectedAccount?.id) {
      loadProfile(selectedAccount.id)
    }
  }, [selectedAccount?.id])

  const loadData = async () => {
    try {
      const accountId = selectedAccount?.id || null;
      const [historyData, statsData, activityData, collectionData, tradeReqs, giftReqs] = await Promise.all([
        tasks.getHistory(10, accountId),
        accounts.getStats(accountId).catch(() => ({ stats: null })),
        accounts.getActivity(20).catch(() => ({ activities: [] })),
        collection.getSummary(accountId).catch(() => null),
        autoTrade.getRequests().catch(() => ({ requests: [] })),
        autoGift.getRequests().catch(() => ({ requests: [] })),
      ])
      setTaskHistory(historyData.history || [])
      setDashboardStats(statsData.stats)
      setActivityLog(activityData.activities || [])
      setCollectionSummary(collectionData)

      // Compute request analytics from trade + gift data
      const allReqs = [...(tradeReqs.requests || []), ...(giftReqs.requests || [])];
      setAllRequests(allReqs);
      const terminal = allReqs.filter(r => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status));
      const completed = terminal.filter(r => r.status === 'COMPLETED');
      const failed = terminal.filter(r => r.status === 'FAILED');
      const successRate = terminal.length > 0 ? Math.round((completed.length / terminal.length) * 100) : null;
      // Avg completion time (exclude outliers > 30 min)
      const completionTimes = completed
        .filter(r => r.requested_at && r.completed_at)
        .map(r => new Date(r.completed_at).getTime() - new Date(r.requested_at).getTime())
        .filter(ms => ms > 0 && ms < 30 * 60 * 1000);
      const avgTimeMs = completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : null;
      const avgTimeText = avgTimeMs
        ? (avgTimeMs < 60000 ? `${Math.round(avgTimeMs / 1000)}s` : `${Math.round(avgTimeMs / 60000)}m`)
        : null;
      const newAnalytics = {
        total: allReqs.length,
        active: allReqs.filter(r => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status)).length,
        completedCount: completed.length,
        terminalCount: terminal.length,
        successRate,
        avgTime: avgTimeText,
        avgTimeMs: avgTimeMs,
        failedCount: failed.length,
      };
      // Store previous for trend calculation before updating
      setRequestAnalytics(prev => {
        prevAnalyticsRef.current = prev;
        return newAnalytics;
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load profile icons and messages on mount
  useEffect(() => {
    const loadProfileOptions = async () => {
      try {
        const [iconsData, messagesData] = await Promise.all([
          profile.getIcons(),
          profile.getMessages(),
        ])
        setProfileIcons(iconsData.icons || [])
        setProfileMessages(messagesData.messages || [])
      } catch (error) {
        console.error('Failed to load profile options:', error)
      }
    }
    loadProfileOptions()
  }, [])

  // Load profile when account is selected
  const loadProfile = async (accountId) => {
    if (!accountId) return
    setProfileLoading(true)
    try {
      const data = await profile.get(accountId)
      setProfileData(data.profile)
      setEditNickname(data.profile?.nickname || '')
      setEditIcon(data.profile?.iconId || '')
      setEditMessage(data.profile?.messageId || '')
    } catch (error) {
      console.error('Failed to load profile:', error)
      setSnackbar({ open: true, message: 'Failed to load profile', severity: 'error' })
    } finally {
      setProfileLoading(false)
    }
  }

  // Handle account selection for profile manager
  const handleAccountSelect = async (account) => {
    selectAccount(account)
    await loadProfile(account.id)
  }

  // Save profile changes
  const saveProfile = async () => {
    if (!selectedAccount) return
    setSaving(true)
    try {
      await profile.update(selectedAccount.id, {
        nickname: editNickname,
        iconId: editIcon,
        messageId: editMessage,
      })
      setSnackbar({ open: true, message: 'Profile updated successfully!', severity: 'success' })
      // Reload profile to confirm changes
      await loadProfile(selectedAccount.id)
      // Refresh accounts list to show updated nickname
      refreshAccounts()
    } catch (error) {
      console.error('Failed to save profile:', error)
      setSnackbar({ open: true, message: error.message || 'Failed to save profile', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Get icon display name from icon ID
  const getIconName = (iconId) => {
    const icon = profileIcons.find(i => i.id === iconId)
    return icon?.name || iconId?.split('_').slice(-1)[0] || 'Unknown'
  }

  // Get message text from message ID
  const getMessageText = (messageId) => {
    const msg = profileMessages.find(m => m.id === messageId)
    return msg?.text || messageId || 'No message'
  }

  // Format action type for display
  const formatActionType = (type) => {
    const labels = {
      'PACK_OPEN': 'Pack Opened',
      'WONDER_PICK': 'Wonder Pick',
      'FRIEND_ACCEPT': 'Friend Accepted',
      'BATTLE': 'Battle Completed',
      'MISSION_CLAIM': 'Mission Claimed',
      'SYNC': 'Account Synced',
      'LOGIN': 'Login',
    }
    return labels[type] || type?.replace('_', ' ') || 'Action'
  }

  // Get icon color for activity type
  const getActivityColor = (type) => {
    const colors = {
      'PACK_OPEN': theme.palette.primary.main,
      'WONDER_PICK': theme.palette.warning.main,
      'FRIEND_ACCEPT': theme.palette.success.main,
      'BATTLE': theme.palette.secondary.main,
      'MISSION_CLAIM': theme.palette.info.main,
      'SYNC': theme.palette.info.main,
      'LOGIN': theme.palette.text.secondary,
    }
    return colors[type] || theme.palette.text.secondary
  }

  const features = [
    {
      icon: <LinkIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.linkAccount'),
      description: t('dashboard.linkAccountDesc'),
      color: theme.palette.secondary.main,
      path: '/accounts',
    },
    {
      icon: <BotIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.friendBot'),
      description: t('dashboard.friendBotDesc'),
      color: theme.palette.success.main,
      path: '/bot',
    },
    {
      icon: <PackIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.openPacks'),
      description: t('dashboard.openPacksDesc'),
      color: theme.palette.primary.main,
      path: '/tasks',
    },
    {
      icon: <WonderIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.wonderPick'),
      description: t('dashboard.wonderPickDesc'),
      color: theme.palette.warning.main,
      path: '/tasks',
    },
    {
      icon: <MissionIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.missions'),
      description: t('dashboard.missionsDesc'),
      color: theme.palette.info.main,
      path: '/tasks',
    },
    {
      icon: <BattleIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.autoBattle'),
      description: t('dashboard.autoBattleDesc'),
      color: theme.palette.error.main,
      path: '/tasks',
    },
    {
      icon: <BattleIcon sx={{ fontSize: 24, color: '#fff' }} />,
      title: t('dashboard.soloBattle'),
      description: t('dashboard.soloBattleDesc'),
      color: theme.palette.secondary.main,
      path: '/solo-battle',
    },
  ]

  const todaysTasks = taskHistory.filter(t => {
    const today = new Date().toDateString()
    return new Date(t.created_at).toDateString() === today
  }).length

  // Transform activity log for display
  const formatActivityText = (activity) => {
    const actionTexts = {
      PACK_OPEN: 'Opened a pack',
      WONDER_PICK: 'Used Wonder Pick',
      FRIEND_ACCEPT: 'Accepted a friend request',
      BATTLE: 'Completed a battle',
      MISSION_CLAIM: 'Claimed a mission reward',
      SYNC: 'Synced account data',
      LOGIN: 'Logged in',
      OTHER: 'Performed an action',
    }
    let text = actionTexts[activity.action_type] || activity.action_type
    if (activity.account_nickname) {
      text += ` (${activity.account_nickname})`
    }
    if (activity.action_details?.pack_name) {
      text = `Opened ${activity.action_details.pack_name} pack`
    }
    if (activity.action_details?.friend_name) {
      text = `Accepted friend request from ${activity.action_details.friend_name}`
    }
    if (activity.action_details?.result) {
      text += ` - ${activity.action_details.result}`
    }
    return text
  }

  const recentActivity = activityLog.slice(0, 5).map(activity => {
    const createdAt = new Date(activity.created_at)
    return {
      date: createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      text: formatActivityText(activity),
      color: getActivityColor(activity.action_type),
      relativeTime: getRelativeTime(activity.created_at),
    }
  })

  // Generate mock sparkline for Rolling PPM (stable per dashboardStats change)
  const ppmSparkline = useMemo(() => {
    const ppm = dashboardStats?.ppm?.rolling
    return typeof ppm === 'number' ? generateSparkline(ppm) : null
  }, [dashboardStats?.ppm?.rolling])

  // Build sparkline data from activity log (pack opens per day, last 7 days)
  const activitySparkline = useMemo(() => {
    if (!activityLog.length) return []
    const days = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days[d.toDateString()] = 0
    }
    activityLog.forEach(a => {
      const key = new Date(a.created_at).toDateString()
      if (key in days) days[key]++
    })
    return Object.values(days).map(v => ({ v }))
  }, [activityLog])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <Box>

      {/* ── Hero Section: Greeting + Date ────────────────────────────── */}
      <PageHeader
        variant="hero"
        icon={<PokeballIcon />}
        title={
          <>
            {getGreeting()},{' '}
            <Box
              component="span"
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {user?.username || 'Trainer'}
            </Box>
          </>
        }
        subtitle={getFormattedDate()}
        chips={[
          { label: `${linkedAccounts.length} ${t('dashboard.linkedAccounts')}`, color: theme.palette.primary.main },
          { label: `${todaysTasks} ${t('dashboard.tasksToday')}`, color: theme.palette.success.main },
        ]}
        action={
          /* Phase 25E — sync freshness for the currently-selected
             account. Mirrors the chip shown on Tracker + Missions,
             reading from the backend /sync-status endpoint. */
          selectedAccount && selectedAccount.id
            ? <SyncStatusChip accountId={selectedAccount.id} showLabel={false} />
            : null
        }
      />

      {/* ── Recommendations (max 2, rule-based) ─────────────────────── */}
      {recommendations.length > 0 && (
        <FadeIn>
          <Box sx={{ mb: 2 }}>
            {recommendations.map(rec => (
              <RecommendationCard key={rec.id} recommendation={rec} onDismiss={dismissRec} />
            ))}
          </Box>
        </FadeIn>
      )}

      {/* ── Install App CTA (only shown if not already installed) ── */}
      <Box sx={{ mb: 2 }}>
        <InstallAppButton variant="card" />
      </Box>

      {/* Phase 4 (Apr 2026) — NOW / NEXT / RISK intelligence strip.
          Built from already-loaded huntStats + recentGodpacks + ppmHistory.
          Each section auto-hides if its underlying signal is null. */}
      {(() => {
        // NOW — live operational state
        const ppm          = huntStatsCtx?.ppm ?? huntStats?.summary?.rollingPPM ?? null;
        const activeHunts  = huntStatsCtx?.activeWorkers ?? huntStats?.summary?.activeAccounts ?? null;
        const liveGp       = Array.isArray(recentGodpacks)
          ? recentGodpacks.filter(g => (g.status || '').toUpperCase() === 'ALIVE' || (g.status || '').toUpperCase() === 'LIVE').length
          : null;
        const lastUpd      = huntStatsCtx?.lastUpdated || huntStatsCtx?.lastFetchedAt || null;
        const nowBlock = (ppm != null || activeHunts != null || liveGp != null)
          ? { ppm, activeHunts, liveGodpacks: liveGp, lastUpdatedAt: lastUpd }
          : null;

        // NEXT — trend direction from ppm history (already maintained above)
        const ppmHistory = ppmHistoryRef.current || [];
        let nextBlock = null;
        if (ppmHistory.length >= 4) {
          const recent = ppmHistory.slice(-3).reduce((s, p) => s + (p.v || 0), 0) / 3;
          const older  = ppmHistory.slice(-6, -3).reduce((s, p) => s + (p.v || 0), 0) / 3;
          let dir = 'flat', label = 'PPM steady';
          if (older > 0 && recent > older * 1.1)      { dir = 'up';   label = `PPM trending up (+${Math.round(((recent / older) - 1) * 100)}%)`; }
          else if (older > 0 && recent < older * 0.9) { dir = 'down'; label = `PPM trending down (-${Math.round((1 - (recent / older)) * 100)}%)`; }
          const forecastHourly = ppm != null ? Math.round(ppm * 60) : null;
          nextBlock = { trendDir: dir, label, forecastHourly };
        }

        // RISK — pull from huntStats summary if it carries error/failure counts
        const summary = huntStats?.summary || {};
        const risks = [];
        if ((summary.errorCount   || 0) > 0)  risks.push({ severity: 'high', text: `${summary.errorCount} hunt error${summary.errorCount !== 1 ? 's' : ''}`, kind: 'errorCount' });
        if ((summary.staleWorkers || 0) > 0)  risks.push({ severity: 'med',  text: `${summary.staleWorkers} stale container${summary.staleWorkers !== 1 ? 's' : ''}`, kind: 'staleWorkers' });
        // PPM dropped >25% in trend → risk chip
        if (ppmHistory.length >= 4) {
          const recent = ppmHistory.slice(-3).reduce((s, p) => s + (p.v || 0), 0) / 3;
          const older  = ppmHistory.slice(-6, -3).reduce((s, p) => s + (p.v || 0), 0) / 3;
          if (older > 0 && recent < older * 0.75) {
            risks.push({ severity: 'high', text: `PPM dropped ${Math.round((1 - (recent / older)) * 100)}%`, kind: 'ppmDrop' });
          }
        }

        return <IntelligenceStrip now={nowBlock} next={nextBlock} risk={risks} />;
      })()}

      {/* Phase 4.7 — InsightStrip2 demoted to "More insights" so the new
          NOW/NEXT/RISK rail above is visually authoritative. The legacy
          narrative still renders for users who relied on it; muted
          heading above signals secondary status without removing data. */}
      <Box sx={{ mt: 1, mb: 0.5 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontWeight: 700, letterSpacing: 0.8, fontSize: '0.65rem' }}
        >
          More insights
        </Typography>
      </Box>
      <InsightStrip2 showNarrative={true} />

      {/* ── Bento Grid: Primary Metrics ──────────────────────────────── */}
      <FadeIn>
        <BentoGrid columns={12} gap={2} rowHeight={80} sx={{ mb: 3 }}>
          {/* Row 1: Big cards with sparklines */}
          <BentoItem span={4} rowSpan={2}>
            <MetricCard
              icon={PackIcon}
              label="Total Packs"
              value={formatNumber(huntStats?.summary?.totalPacks || 0)}
              color="secondary"
              size="lg"
              sparklineData={activitySparkline}
              subValue="Hunt session total"
            />
          </BentoItem>
          <BentoItem span={4} rowSpan={2}>
            <MetricCard
              icon={SpeedIcon}
              label="Rolling PPM"
              value={huntStats?.summary?.rollingPPM ?? huntStats?.summary?.packsPerMinute ?? '--'}
              color="primary"
              size="lg"
              sparklineData={ppmHistoryRef.current.length > 1 ? ppmHistoryRef.current : ppmSparkline}
              subValue="Packs per minute"
            />
          </BentoItem>
          <BentoItem span={4} rowSpan={2}>
            <MetricCard
              icon={TrendingUpIcon}
              label={t('dashboard.successRate')}
              value={`${dashboardStats?.tasks?.successRate || 0}%`}
              color="success"
              size="lg"
              sparklineData={activitySparkline}
              subValue={`${formatNumber(dashboardStats?.tasks?.total || taskHistory.length)} total tasks`}
            />
          </BentoItem>

          {/* Row 2: Connected metric strip — uses shared MetricStrip component */}
          <BentoItem span={12}>
            <MetricStrip
              items={(() => {
                const prev = prevAnalyticsRef.current;
                const rateDelta = (prev?.successRate != null && requestAnalytics?.successRate != null)
                  ? requestAnalytics.successRate - prev.successRate : null;
                const rateTrend = rateDelta != null && rateDelta !== 0
                  ? { direction: rateDelta > 0 ? 'up' : 'down', delta: `${rateDelta > 0 ? '+' : ''}${rateDelta}%` }
                  : null;
                return [
                  {
                    label: t('dashboard.cards'),
                    value: collectionSummary ? `${formatNumber(collectionSummary.ownedCards || 0)} / ${formatNumber(collectionSummary.totalCards || 0)}` : (loading ? '...' : '— / —'),
                    color: !collectionSummary && !loading ? 'text.disabled' : 'success.main',
                    tooltip: collectionSummary ? `${collectionSummary.ownedCards || 0} unique cards collected out of ${collectionSummary.totalCards || 0} total` : (!loading ? 'Unable to load collection counts' : null),
                  },
                  { label: t('dashboard.botsRunning'), value: dashboardStats?.bots?.running || 0, color: 'info.main' },
                  {
                    label: t('dashboard.friends24h'),
                    value: formatNumber(dashboardStats?.activity24h?.friendAccepts || 0),
                    color: 'warning.main',
                    tooltip: 'Friend requests accepted in the last 24 hours',
                  },
                  { label: t('dashboard.accounts'), value: dashboardStats?.accounts?.total || linkedAccounts.length, color: 'primary.main' },
                  // Phase 4.7 — duplicate Success Rate removed from MetricStrip.
                  // The Bento card (line ~738) already shows tasks.successRate
                  // prominently; rendering it again here with a different data
                  // source (requestAnalytics.successRate) created the
                  // "which is the real number?" trust gap noted in the audit.
                  // Authoritative display = Bento card.
                  {
                    label: 'Avg Time',
                    value: requestAnalytics?.avgTime || '—',
                    color: 'info.main',
                    tooltip: requestAnalytics?.avgTime
                      ? `Average time from request to completion (excluding outliers > 30 min)`
                      : 'No completed requests yet',
                  },
                ];
              })()}
            />
          </BentoItem>
        </BentoGrid>
      </FadeIn>

      {/* ── Request Funnel (collapsed by default) ── */}
      {allRequests.length >= 3 && (
        <RequestFunnel requests={allRequests} />
      )}

      {/* ── System Health Indicator ── */}
      <SystemHealthMini sx={{ mb: 2 }} />

      {/* ── Hunt Status Mini-Widget ──────────────────────────────────── */}
      {(() => {
        const summary = huntStats?.summary || {}
        const isHuntActive = (summary.activeInstances || 0) > 0
        const huntPpm = summary.rollingPPM ?? summary.packsPerMinute ?? 0
        const totalGP = summary.totalGodPacks || 0
        const aliveCount = summary.activeInstances || 0
        const totalInstances = summary.totalInstances || 0

        // Semantic color: green = healthy (>80% alive), amber = degraded (>30%), red = critical/offline
        const aliveRatio = totalInstances > 0 ? aliveCount / totalInstances : 0
        const huntHealthColor = !isHuntActive
          ? theme.palette.error.main
          : aliveRatio >= 0.8
            ? theme.palette.success.main
            : aliveRatio >= 0.3
              ? theme.palette.warning.main
              : theme.palette.error.main
        const huntStatusLabel = !isHuntActive
          ? 'Offline'
          : aliveRatio >= 0.8
            ? 'Healthy'
            : aliveRatio >= 0.3
              ? 'Degraded'
              : 'Critical'

        return (
          <FadeIn>
            <Box
              onClick={() => navigate('/hunt')}
              sx={{
                mb: 3,
                borderRadius: `${theme.custom.radius.md}px`,
                overflow: 'hidden',
                backgroundColor: theme.custom.glass.bg,
                border: `1px solid ${theme.custom.glass.border}`,
                backdropFilter: `blur(${theme.custom.blur.md}px)`,
                cursor: 'pointer',
                transition: `border-color ${theme.custom.transitions.medium}, box-shadow ${theme.custom.transitions.medium}`,
                '&:hover': {
                  borderColor: `${huntHealthColor}40`,
                  boxShadow: `0 4px 16px ${huntHealthColor}15`,
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  px: 2.5,
                  py: 1.5,
                  gap: 2,
                }}
              >
                {/* Left: Hunt status indicator */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                  <DotIcon
                    sx={{
                      fontSize: 14,
                      color: huntHealthColor,
                      animation: isHuntActive ? 'pulse 2s ease-in-out infinite' : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.4 },
                      },
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Hunt
                  </Typography>
                  <Chip
                    label={huntStatusLabel}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      bgcolor: `${huntHealthColor}15`,
                      color: huntHealthColor,
                      border: 'none',
                    }}
                  />
                </Box>

                {/* Center: Key metrics */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem', display: 'block', lineHeight: 1 }}>
                      Live PPM
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.info.main, ...tabularNumStyle }}>
                      {isHuntActive ? (typeof huntPpm === 'number' ? huntPpm.toFixed(1) : huntPpm) : '--'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem', display: 'block', lineHeight: 1 }}>
                      God Packs
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#FFD700', ...tabularNumStyle }}>
                      {totalGP}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem', display: 'block', lineHeight: 1 }}>
                      Alive
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: huntHealthColor, ...tabularNumStyle }}>
                      {aliveCount}/{totalInstances}
                    </Typography>
                  </Box>
                </Box>

                {/* Right: View link */}
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexShrink: 0,
                    '&:hover': { opacity: 0.8 },
                  }}
                >
                  <ViewIcon sx={{ fontSize: 14 }} />
                  View Hunt Monitor
                </Typography>
              </Box>
            </Box>
          </FadeIn>
        )
      })()}

      {/* ── Hunt + GP Intelligence ─────────────────────────────────── */}
      <FadeIn>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={5}>
            <Box sx={{
              p: 2,
              borderRadius: `${theme.custom.radius.md}px`,
              backgroundColor: theme.custom.glass.bg,
              border: `1px solid ${theme.custom.glass.border}`,
              backdropFilter: `blur(${theme.custom.blur.md}px)`,
              height: '100%',
            }}>
              <HuntIntelligence />
            </Box>
          </Grid>
          <Grid item xs={12} md={7}>
            <Box sx={{
              p: 2,
              borderRadius: `${theme.custom.radius.md}px`,
              backgroundColor: theme.custom.glass.bg,
              border: `1px solid ${theme.custom.glass.border}`,
              backdropFilter: `blur(${theme.custom.blur.md}px)`,
              height: '100%',
            }}>
              <GodPackIntelligence />
            </Box>
          </Grid>
        </Grid>
      </FadeIn>

      {/* ── Onboarding Checklist ─────────────────────────────────────── */}
      <OnboardingChecklist
        isNewUser={linkedAccounts.length === 0}
        userData={{
          accountsLinked: linkedAccounts.length,
          collectionSynced: dashboardStats?.collection?.uniqueCards > 0,
          huntsStarted: dashboardStats?.hunts?.total > 0,
          cardsRequested: dashboardStats?.trades?.requested > 0,
          notificationsEnabled: typeof Notification !== 'undefined' && Notification.permission === 'granted',
        }}
      />

      {/* ── Main Content: Split Panel ────────────────────────────────── */}
      <Grid container spacing={3}>

        {/* ── Trade/Gift Activity Feed ────────────────────────────── */}
        <Grid item xs={12}>
          <FadeIn>
            <GlassCard
              title="Trade & Gift Activity"
              icon={<ScheduleIcon />}
              accent={theme.palette.info.main}
            >
              <InsightCards />
              <ActivityFeed />
            </GlassCard>
          </FadeIn>
        </Grid>

        {/* ── Left Column (8/12): Activity Timeline ──────────────────── */}
        <Grid item xs={12} lg={8}>
          <FadeIn>
            <GlassCard
              title={t('dashboard.recentActivity') || 'Recent Activity'}
              icon={<ScheduleIcon />}
              accent={theme.palette.primary.main}
              action={
                recentActivity.length > 0 ? (
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.primary.main, cursor: 'pointer', fontWeight: 600, '&:hover': { opacity: 0.8 } }}
                    onClick={() => navigate('/audit-log')}
                  >
                    View All &rarr;
                  </Typography>
                ) : null
              }
            >
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, i) => (
                  <ActivityTimelineItem
                    key={i}
                    {...activity}
                    isDark={isDark}
                    isLast={i === recentActivity.length - 1}
                    onClick={() => navigate('/audit-log')}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<ScheduleIcon sx={{ fontSize: 48 }} />}
                  title={t('dashboard.noRecentActivity') || 'No recent activity'}
                  description="Activity will appear here as you use the app."
                  minHeight={160}
                />
              )}
            </GlassCard>
          </FadeIn>
        </Grid>

        {/* ── Right Column (4/12): God Pack Feed + Quick Actions + Account Preview ── */}
        <Grid item xs={12} lg={4}>

          {/* Recent God Pack Activity */}
          <FadeIn>
            <GlassCard
              title="Recent God Packs"
              icon={<StarIcon sx={{ color: '#FFD700' }} />}
              accent="#FFD700"
              sx={{ mb: 3 }}
              action={
                recentGodpacks.length > 0 ? (
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.primary.main, cursor: 'pointer', fontWeight: 600, '&:hover': { opacity: 0.8 } }}
                    onClick={() => navigate('/godpacks')}
                  >
                    View All &rarr;
                  </Typography>
                ) : null
              }
            >
              {recentGodpacks.length > 0 ? (
                recentGodpacks.map((gp, i) => (
                  <Box
                    key={gp.id}
                    onClick={() => navigate('/godpacks')}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      borderRadius: '8px',
                      px: 1,
                      mx: -1,
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(255, 215, 0, 0.06)' : 'rgba(255, 215, 0, 0.08)',
                      },
                      '&:not(:last-child)': {
                        borderBottom: isDark ? '1px solid rgba(124, 138, 255, 0.06)' : '1px solid rgba(0,0,0,0.04)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
                      }}
                    >
                      <StarIcon sx={{ fontSize: 16, color: '#fff' }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', lineHeight: 1.3, fontSize: '0.8rem' }} noWrap>
                        God Pack found
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>
                        {timeAgo(gp.discoveredAt)}
                      </Typography>
                    </Box>
                    {/* Phase 5.10 — Value Tier signal chip. Rendered
                        only when the recent godpack row carries cards
                        (the chip itself returns null otherwise — no
                        misleading "Strong Pull" on incomplete rows). */}
                    {Array.isArray(gp.cards) && gp.cards.length > 0 && (
                      <ValueTierChip cards={gp.cards} size="tiny" showLabel={false} />
                    )}
                    {gp.containerGroup && (
                      <Chip
                        label={`C${gp.containerGroup}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: isDark ? 'rgba(255, 215, 0, 0.12)' : 'rgba(255, 215, 0, 0.15)',
                          color: '#FFD700',
                          border: 'none',
                          ...tabularNumStyle,
                        }}
                      />
                    )}
                  </Box>
                ))
              ) : (
                <EmptyState
                  icon={<StarIcon sx={{ fontSize: 36, color: '#FFD700' }} />}
                  title="No recent activity"
                  description="God packs will appear here when found."
                  minHeight={100}
                />
              )}
            </GlassCard>
          </FadeIn>

          {/* Quick Actions - horizontal scroll pills */}
          <FadeIn>
            <GlassCard title="Quick Actions" icon={<ArrowIcon />} sx={{ mb: 3 }} noPadding>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  overflowX: 'auto',
                  px: 2.5,
                  pb: 2.5,
                  pt: 0.5,
                  '&::-webkit-scrollbar': { height: 4 },
                  '&::-webkit-scrollbar-thumb': { borderRadius: 2, bgcolor: 'rgba(124,138,255,0.15)' },
                }}
              >
                {features.map((feature, i) => (
                  <Box
                    key={i}
                    onClick={() => navigate(feature.path)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      border: isDark ? '1px solid rgba(124, 138, 255, 0.08)' : '1px solid rgba(0,0,0,0.06)',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: `${feature.color}40`,
                        boxShadow: `0 4px 12px ${feature.color}20`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${feature.color}, ${feature.color}bb)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 2px 8px ${feature.color}30`,
                        flexShrink: 0,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                      {feature.title}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </GlassCard>
          </FadeIn>

          {/* Account Preview (compact mini list) */}
          {linkedAccounts.length === 0 && (
            <FadeIn>
              <GlassCard
                title={t('dashboard.yourAccounts')}
                icon={<AccountIcon />}
                accent={theme.palette.secondary.main}
              >
                <EmptyState
                  icon={<LinkIcon sx={{ fontSize: 40 }} />}
                  title="No accounts linked"
                  description="Link a game account to get started with automation."
                  action={
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/accounts')}
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                      Link Account
                    </Button>
                  }
                  minHeight={120}
                />
              </GlassCard>
            </FadeIn>
          )}
          {linkedAccounts.length > 0 && (
            <FadeIn>
              <GlassCard
                title={t('dashboard.yourAccounts')}
                icon={<AccountIcon />}
                accent={theme.palette.secondary.main}
              >
                {linkedAccounts.slice(0, 4).map((acc, i) => (
                  <Box
                    key={i}
                    onClick={() => handleAccountSelect(acc)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      px: 1,
                      mx: -1,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s ease',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
                      },
                      '&:not(:last-child)': {
                        borderBottom: isDark ? '1px solid rgba(124, 138, 255, 0.06)' : '1px solid rgba(0,0,0,0.04)',
                      },
                      ...(selectedAccount?.id === acc.id ? {
                        bgcolor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)',
                        borderColor: isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(92, 106, 196, 0.12)',
                      } : {}),
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {(acc.nickname || acc.device_account || '?').charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, minWidth: 0 }}>
                      {acc.nickname || `Account ${acc.id}`}
                    </Typography>
                    <Chip
                      label={acc.is_active ? t('dashboard.active') : t('dashboard.inactive')}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        bgcolor: acc.is_active ? `${theme.palette.success.main}15` : `${theme.palette.text.secondary}15`,
                        color: acc.is_active ? theme.palette.success.main : theme.palette.text.secondary,
                        border: 'none',
                      }}
                    />
                  </Box>
                ))}
                {linkedAccounts.length > 4 && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      textAlign: 'center',
                      mt: 1.5,
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      '&:hover': { opacity: 0.8 },
                    }}
                    onClick={() => navigate('/accounts')}
                  >
                    +{linkedAccounts.length - 4} more &rarr;
                  </Typography>
                )}
              </GlassCard>
            </FadeIn>
          )}
        </Grid>

        {/* ── Profile Manager ────────────────────────────────────────── */}
        <Grid item xs={12} lg={7}>
          {/* Profile Manager Section */}
          {linkedAccounts.length > 0 && (
            <FadeIn>
              <GlassCard
                title={t('dashboard.profileManager')}
                icon={<PersonIcon />}
                accent={theme.palette.primary.main}
              >
                {/* Account Selector */}
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>{t('dashboard.selectAccount')}</InputLabel>
                  <Select
                    value={selectedAccount?.id || ''}
                    label={t('dashboard.selectAccount')}
                    onChange={(e) => {
                      const acc = linkedAccounts.find(a => a.id === e.target.value)
                      if (acc) handleAccountSelect(acc)
                    }}
                  >
                    {linkedAccounts.filter(a => a.is_active).map((acc) => (
                      <MenuItem key={acc.id} value={acc.id}>
                        {acc.nickname || `Account ${acc.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Profile Content */}
                {profileLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: 'action.hover' }} />
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ width: '60%', height: 20, borderRadius: 1, bgcolor: 'action.hover', mb: 0.5 }} />
                        <Box sx={{ width: '40%', height: 14, borderRadius: 1, bgcolor: 'action.hover' }} />
                      </Box>
                    </Box>
                    <Box sx={{ width: '100%', height: 40, borderRadius: 1, bgcolor: 'action.hover' }} />
                    <Box sx={{ width: '100%', height: 40, borderRadius: 1, bgcolor: 'action.hover' }} />
                  </Box>
                ) : selectedAccount && profileData ? (
                  <Box>
                    {/* Current Profile Preview */}
                    <Paper
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        mb: 2.5,
                        borderRadius: '12px',
                        ...(isDark ? {
                          background: 'rgba(124, 138, 255, 0.06)',
                          border: '1px solid rgba(124, 138, 255, 0.12)',
                        } : {
                          background: 'linear-gradient(135deg, #fef7ff 0%, #fff0f5 100%)',
                          border: '1px solid rgba(124, 138, 255, 0.1)',
                        }),
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 52,
                          height: 52,
                          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                          fontSize: 22,
                          fontWeight: 700,
                        }}
                      >
                        {(profileData.nickname || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {profileData.nickname}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('dashboard.level')} {profileData.playerLevel || '?'} -- {getIconName(profileData.iconId)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, fontStyle: 'italic', fontSize: '0.8rem' }}>
                          "{getMessageText(profileData.messageId)}"
                        </Typography>
                      </Box>
                    </Paper>

                    {/* Edit Fields */}
                    <TextField
                      fullWidth
                      size="small"
                      label={t('dashboard.nickname')}
                      value={editNickname}
                      onChange={(e) => setEditNickname(e.target.value)}
                      inputProps={{ maxLength: 12 }}
                      helperText={`${editNickname.length}/12 ${t('dashboard.characters')}`}
                      sx={{ mb: 2 }}
                    />

                    {/* Icon Picker */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                        {t('dashboard.profileIcon')}
                      </Typography>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => setIconPickerOpen(true)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: 'text.primary',
                          borderColor: isDark ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)',
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                          },
                        }}
                        startIcon={<PersonIcon />}
                      >
                        {getIconName(editIcon)}
                      </Button>
                    </Box>

                    {/* Message Selector */}
                    <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                      <InputLabel>{t('dashboard.statusMessage')}</InputLabel>
                      <Select
                        value={editMessage}
                        label={t('dashboard.statusMessage')}
                        onChange={(e) => setEditMessage(e.target.value)}
                      >
                        {profileMessages.map((msg) => (
                          <MenuItem key={msg.id} value={msg.id}>
                            {msg.text}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Save Button */}
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={saveProfile}
                      disabled={saving || !editNickname}
                      sx={{
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '10px',
                        py: 1.2,
                        '&:hover': {
                          background: `linear-gradient(135deg, ${theme.palette.primary.main}dd, ${theme.palette.secondary.main}dd)`,
                          boxShadow: `0 4px 20px ${theme.palette.primary.main}40`,
                        },
                        '&.Mui-disabled': {
                          background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                        },
                      }}
                      startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    >
                      {saving ? t('dashboard.saving') : t('dashboard.saveProfile')}
                    </Button>
                  </Box>
                ) : (
                  <EmptyState
                    icon={<PersonIcon sx={{ fontSize: 48 }} />}
                    title={t('dashboard.selectAccountPrompt') || 'Select an account'}
                    description="Choose an account above to manage its profile."
                    minHeight={140}
                  />
                )}
              </GlassCard>
            </FadeIn>
          )}
        </Grid>
      </Grid>

      {/* ── Icon Picker Dialog ───────────────────────────────────────── */}
      <Dialog
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            ...(isDark ? {
              background: theme.palette.background.paper,
              border: '1px solid rgba(124, 138, 255, 0.12)',
            } : {}),
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={600}>{t('dashboard.chooseIcon')}</Typography>
          <IconButton onClick={() => setIconPickerOpen(false)} size="small" aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {/* Pokeball Icons */}
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
            {t('dashboard.pokemon')}
          </Typography>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {profileIcons.filter(i => i.category === 'pokemon').map((icon) => (
              <Grid item xs={3} sm={2} key={icon.id}>
                <Tooltip title={icon.name} arrow>
                  <Box
                    onClick={() => {
                      setEditIcon(icon.id)
                      setIconPickerOpen(false)
                    }}
                    sx={{
                      aspectRatio: '1',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: editIcon === icon.id
                        ? `2px solid ${theme.palette.primary.main}`
                        : isDark ? '1px solid rgba(124, 138, 255, 0.1)' : '1px solid rgba(0,0,0,0.1)',
                      background: editIcon === icon.id
                        ? `${theme.palette.primary.main}15`
                        : isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <Typography variant="caption" sx={{ textAlign: 'center', px: 0.5, fontSize: '0.6875rem' }}>
                      {icon.name}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
            ))}
          </Grid>

          {/* Trainer Icons */}
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
            {t('dashboard.trainers')}
          </Typography>
          <Grid container spacing={1}>
            {profileIcons.filter(i => i.category === 'trainer').map((icon) => (
              <Grid item xs={3} sm={2} key={icon.id}>
                <Tooltip title={icon.name} arrow>
                  <Box
                    onClick={() => {
                      setEditIcon(icon.id)
                      setIconPickerOpen(false)
                    }}
                    sx={{
                      aspectRatio: '1',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: editIcon === icon.id
                        ? `2px solid ${theme.palette.primary.main}`
                        : isDark ? '1px solid rgba(124, 138, 255, 0.1)' : '1px solid rgba(0,0,0,0.1)',
                      background: editIcon === icon.id
                        ? `${theme.palette.primary.main}15`
                        : isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        transform: 'scale(1.05)',
                      },
                    }}
                  >
                    <Typography variant="caption" sx={{ textAlign: 'center', px: 0.5, fontSize: '0.6875rem' }}>
                      {icon.name}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIconPickerOpen(false)} sx={{ color: 'text.secondary' }}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar for notifications ───────────────────────────────── */}
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
}
