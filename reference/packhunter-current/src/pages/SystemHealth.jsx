/**
 * System Health Dashboard — Elite Operator-Grade
 *
 * Features:
 *   - Per-account Healthy/Warning/Critical status badges
 *   - Top-level filter bar (All, Issues, Critical, Stuck, Orphaned, Failed, by system)
 *   - Detail drawer on row click (orphan IDs, stuck states, drift, session info)
 *   - Confirmation modal before destructive actions
 *   - Stale data warning + refresh error state
 *   - Trend indicators (stuck/failed/orphan deltas vs previous poll)
 *   - Recommended action hints per account
 *   - Bulk reconcile (selected / all issues)
 *   - Recent activity log (reconciles, failures, recoveries)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Chip, Button, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Snackbar, Skeleton, useTheme,
  Drawer, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox,
  Divider, LinearProgress,
} from '@mui/material'
import {
  MonitorHeart as HealthIcon, Refresh as RefreshIcon,
  Warning as WarningIcon, CheckCircle as CheckIcon, Error as ErrorIcon,
  Build as ReconcileIcon, SwapHoriz as TradeIcon,
  CardGiftcard as GiftIcon, SportsEsports as BattleIcon,
  Schedule as TimeIcon, TrendingUp as UpIcon, TrendingDown as DownIcon,
  TrendingFlat as FlatIcon, Close as CloseIcon,
  PlaylistAddCheck as BulkIcon, Info as InfoIcon,
  ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material'
import { FadeIn } from '../components/Animations'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'
import { accounts as accountsApi, systemHealth } from '../services/api'
import { CHIP } from '../constants/designTokens'

// ── Constants ────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30000
const STALE_THRESHOLD_MS = 90000 // data older than 90s = stale warning
const STUCK_THRESHOLD = 1
const FAILURE_THRESHOLD = 3
const CRITICAL_STUCK = 3
const CRITICAL_FAILURE = 10

// ── Status computation ──────────────────────────────────────────────
function computeStatus(stuck, orphaned, failed) {
  if (stuck >= CRITICAL_STUCK || orphaned >= 2 || failed >= CRITICAL_FAILURE) return 'critical'
  if (stuck >= STUCK_THRESHOLD || orphaned > 0 || failed >= FAILURE_THRESHOLD) return 'warning'
  return 'healthy'
}
const STATUS_CONFIG = {
  healthy:  { label: 'Healthy',  color: '#22c55e', bg: '#22c55e18' },
  warning:  { label: 'Warning',  color: '#f59e0b', bg: '#f59e0b18' },
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444418' },
}

// ── Filter definitions ──────────────────────────────────────────────
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'issues', label: 'Issues' },
  { key: 'critical', label: 'Critical' },
  { key: 'stuck', label: 'Stuck' },
  { key: 'orphaned', label: 'Orphaned' },
  { key: 'failed', label: 'Failed' },
  { key: 'trade', label: 'Trade' },
  { key: 'gift', label: 'Gift' },
  { key: 'battle', label: 'Battle' },
]

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  const ms = Date.now() - d.getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
const fmtUp = (s) => {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
const acctName = (acct) => acct?.nickname || acct?.player_name || `Account ${acct?.id}`

// Compute per-account enriched row data
function enrichAccount(acctId, data) {
  const t = data?.trade?.account || {}
  const g = data?.gift?.account || {}
  const b = data?.battle?.account || {}
  const stuck = (t.stuck || 0) + (g.stuck || 0)
  const orphaned = (data?.trade?.drift?.orphanedDbRecords || 0) + (data?.gift?.drift?.orphanedDbRecords || 0) + (data?.battle?.drift?.orphanedDbRecords || 0)
  const failed = (t.failed_24h || 0) + (g.failed_24h || 0)
  const status = computeStatus(stuck, orphaned, failed)
  const times = [t.last_completed_at, g.last_completed_at, b?.latestRecordTime].filter(Boolean)
  const lastActivity = times.length > 0 ? new Date(Math.max(...times.map(x => new Date(x).getTime()))) : null
  const hasTrade = (t.active || 0) > 0 || (t.failed_24h || 0) > 0 || (t.completed_24h || 0) > 0
  const hasGift = (g.active || 0) > 0 || (g.failed_24h || 0) > 0 || (g.completed_24h || 0) > 0
  const hasBattle = b.totalRecords !== undefined

  // Recommended action
  let hint = null
  if (orphaned > 0) hint = 'Reconcile orphaned requests'
  else if (stuck > 0) hint = 'Check stuck requests — may need reconcile'
  else if (failed >= CRITICAL_FAILURE) hint = 'High failure rate — investigate logs'
  else if (data?.battle?.account?.driftDetected) hint = 'Battle stats drifted — reconcile'

  return { acctId, t, g, b, stuck, orphaned, failed, status, lastActivity, hasTrade, hasGift, hasBattle, hint, data }
}

// ── MetricCard ───────────────────────────────────────────────────────
function MetricCard({ label, value, color, icon: Icon, alert, trend }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  return (
    <Box sx={{
      flex: 1, minWidth: 130, px: 2, py: 1.75, borderRadius: '14px',
      bgcolor: isDark ? 'rgba(124,138,255,0.04)' : 'rgba(92,106,196,0.03)',
      border: `1px solid ${alert ? theme.palette.error.main + '40' : isDark ? 'rgba(124,138,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
      ...(alert && { boxShadow: `0 0 12px ${theme.palette.error.main}20` }),
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        {Icon && <Icon sx={{ fontSize: 13, color: color || 'text.secondary' }} />}
        <Typography variant="caption" sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </Typography>
        {trend !== undefined && trend !== 0 && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            {trend > 0
              ? <ArrowUpIcon sx={{ fontSize: 12, color: theme.palette.error.main }} />
              : <ArrowDownIcon sx={{ fontSize: 12, color: theme.palette.success.main }} />}
            <Typography variant="caption" sx={{ fontSize: '0.5rem', fontWeight: 700, color: trend > 0 ? theme.palette.error.main : theme.palette.success.main }}>
              {Math.abs(trend)}
            </Typography>
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: color || 'text.primary', lineHeight: 1 }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── SystemChip ───────────────────────────────────────────────────────
function SystemChip({ active, failed, completed }) {
  const theme = useTheme()
  if (active === undefined && failed === undefined) return <Typography variant="caption" color="text.disabled">—</Typography>
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {(active || 0) > 0 && <Chip label={`${active}`} size="small" sx={{ ...CHIP.xs, bgcolor: theme.palette.primary.main + '20', color: theme.palette.primary.main }} />}
      {(completed || 0) > 0 && <Chip label={`${completed}`} size="small" sx={{ ...CHIP.xs, bgcolor: theme.palette.success.main + '20', color: theme.palette.success.main }} />}
      {(failed || 0) > 0 && <Chip label={`${failed}F`} size="small" sx={{ ...CHIP.xs, fontWeight: 700, bgcolor: theme.palette.error.main + '20', color: theme.palette.error.main }} />}
      {!active && !failed && !completed && <Typography variant="caption" sx={{ fontSize: CHIP.xs.fontSize, color: 'text.disabled' }}>idle</Typography>}
    </Box>
  )
}

// ── StatusBadge ──────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.healthy
  return (
    <Chip label={cfg.label} size="small" sx={{
      ...CHIP.sm, fontWeight: 800, letterSpacing: '0.04em',
      bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
    }} />
  )
}

// ═══════════════════════════════════════════════════════════════════════
// ── Main Component ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function SystemHealth({ user }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { sectionBox } = useSectionStyles()

  // Core state
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState(null)
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [healthData, setHealthData] = useState({})
  const [prevTotals, setPrevTotals] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const pollRef = useRef(null)

  // UI state
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [drawerAcctId, setDrawerAcctId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { accountId, system, label }
  const [reconciling, setReconciling] = useState({})
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [activityLog, setActivityLog] = useState([]) // { time, message, severity }

  useEffect(() => { if (!user?.isAdmin) navigate('/') }, [user, navigate])

  // ── Refresh ────────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    try {
      setRefreshError(null)
      // Fleet-wide listing — admin-only endpoint. Do NOT fall back to
      // the user-scoped accountsApi.list(); that would re-introduce the
      // original bug where admins saw only their own linked accounts.
      // The page itself is gated to admins via the route guard, so a
      // 403 here means our caller is in an unexpected state — surface
      // the error instead of silently degrading.
      const acctData = await accountsApi.listAllFleet()
      const accts = acctData.accounts || acctData || []
      setLinkedAccounts(accts)

      const healthMap = {}
      const activeAccts = accts.filter(a => a.is_active)
      await Promise.all(activeAccts.map(async (acct) => {
        healthMap[acct.id] = { trade: null, gift: null, battle: null }
        const [trade, gift, battle] = await Promise.allSettled([
          systemHealth.getTradeHealth(acct.id),
          systemHealth.getGiftHealth(acct.id),
          systemHealth.getBattleHealth(acct.id),
        ])
        healthMap[acct.id].trade = trade.status === 'fulfilled' ? trade.value : null
        healthMap[acct.id].gift = gift.status === 'fulfilled' ? gift.value : null
        healthMap[acct.id].battle = battle.status === 'fulfilled' ? battle.value : null
      }))

      setHealthData(healthMap)
      setLastRefresh(new Date())
    } catch (err) {
      setRefreshError(err.message)
      console.error('[SystemHealth] Refresh error:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshAll()
    pollRef.current = setInterval(refreshAll, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [refreshAll])

  // ── Reconcile with confirmation ────────────────────────────────────
  const executeReconcile = async (accountId, system) => {
    const key = `${accountId}:${system}`
    setReconciling(prev => ({ ...prev, [key]: true }))
    try {
      let result
      if (system === 'trade') result = await systemHealth.reconcileTrades(accountId)
      else if (system === 'gift') result = await systemHealth.reconcileGifts(accountId)
      else result = await systemHealth.reconcileBattles(accountId)

      const cancelled = result.cancelledRequests?.length || result.cancelledRequestIds?.length || 0
      const unlocked = result.unlockedAccounts?.length || 0
      const fixed = result.fixed
      const acted = cancelled + unlocked > 0 || fixed
      const msg = acted
        ? `${system}: ${cancelled} cancelled, ${unlocked} unlocked`
        : `${system}: no drift`

      setSnackbar({ open: true, message: msg, severity: acted ? 'warning' : 'success' })
      addActivity(msg, acted ? 'warning' : 'success')
      await refreshAll()
    } catch (err) {
      const msg = `Reconcile ${system} failed: ${err.message}`
      setSnackbar({ open: true, message: msg, severity: 'error' })
      addActivity(msg, 'error')
    }
    setReconciling(prev => ({ ...prev, [key]: false }))
    setConfirmAction(null)
  }

  const handleReconcileClick = (accountId, system) => {
    const acct = linkedAccounts.find(a => String(a.id) === String(accountId))
    setConfirmAction({ accountId, system, label: `Reconcile ${system} for ${acctName(acct)}` })
  }

  // ── Bulk reconcile ─────────────────────────────────────────────────
  const handleBulkReconcile = async (targetIds) => {
    for (const acctId of targetIds) {
      const row = enrichAccount(acctId, healthData[acctId])
      if ((row.data?.trade?.drift?.orphanedDbRecords || 0) > 0 || (row.t.stuck || 0) > 0) {
        await executeReconcile(acctId, 'trade')
      }
      if ((row.data?.gift?.drift?.orphanedDbRecords || 0) > 0 || (row.g.stuck || 0) > 0) {
        await executeReconcile(acctId, 'gift')
      }
      if (row.data?.battle?.account?.driftDetected) {
        await executeReconcile(acctId, 'battle')
      }
    }
    setSelected(new Set())
  }

  const addActivity = (message, severity) => {
    setActivityLog(prev => [{ time: new Date(), message, severity }, ...prev.slice(0, 19)])
  }

  // ── Compute enriched rows + totals ─────────────────────────────────
  const activeAccounts = linkedAccounts.filter(a => a.is_active)
  const rows = activeAccounts.map(acct => ({ acct, ...enrichAccount(acct.id, healthData[acct.id]) }))

  const totals = { active: 0, stuck: 0, failed24h: 0, orphaned: 0 }
  rows.forEach(r => { totals.active += (r.t.active || 0) + (r.g.active || 0); totals.stuck += r.stuck; totals.failed24h += r.failed; totals.orphaned += r.orphaned })

  // Trends (compare with previous)
  const trends = prevTotals ? {
    stuck: totals.stuck - prevTotals.stuck,
    failed: totals.failed24h - prevTotals.failed24h,
    orphaned: totals.orphaned - prevTotals.orphaned,
  } : { stuck: 0, failed: 0, orphaned: 0 }

  // Update previous totals on refresh
  useEffect(() => {
    if (!loading && lastRefresh) {
      const t = setTimeout(() => setPrevTotals({ ...totals }), 100)
      return () => clearTimeout(t)
    }
  }, [lastRefresh])

  // ── Filtering ──────────────────────────────────────────────────────
  const filteredRows = rows.filter(r => {
    if (filter === 'all') return true
    if (filter === 'issues') return r.status !== 'healthy'
    if (filter === 'critical') return r.status === 'critical'
    if (filter === 'stuck') return r.stuck > 0
    if (filter === 'orphaned') return r.orphaned > 0
    if (filter === 'failed') return r.failed > 0
    if (filter === 'trade') return r.hasTrade
    if (filter === 'gift') return r.hasGift
    if (filter === 'battle') return r.hasBattle
    return true
  })

  const issueCount = rows.filter(r => r.status !== 'healthy').length
  const isStale = lastRefresh && (Date.now() - lastRefresh.getTime() > STALE_THRESHOLD_MS)

  // ── Select helpers ─────────────────────────────────────────────────
  const toggleSelect = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => {
    if (selected.size === filteredRows.length) setSelected(new Set())
    else setSelected(new Set(filteredRows.map(r => r.acctId)))
  }

  // Drawer data
  const drawerRow = drawerAcctId ? rows.find(r => String(r.acctId) === String(drawerAcctId)) : null

  if (!user?.isAdmin) return null

  // Global executor metrics
  const firstData = Object.values(healthData).find(d => d.trade?.global || d.gift?.global || d.battle?.global)
  const tg = firstData?.trade?.global || {}, gg = firstData?.gift?.global || {}, bg = firstData?.battle?.global || {}

  return (
    <FadeIn>
      <Box>
        <PageHeader
          icon={<HealthIcon />}
          title="Account Health"
          subtitle="Platform-wide trade, gift & battle executor health for every linked device account across all users. Admin only."
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isStale && <Chip label="STALE" size="small" color="warning" sx={{ height: 18, fontSize: '0.5rem', fontWeight: 800 }} />}
              {refreshError && <Chip label="ERR" size="small" color="error" sx={{ height: 18, fontSize: '0.5rem', fontWeight: 800 }} />}
              {lastRefresh && !isStale && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.58rem' }}>
                  {fmt(lastRefresh)}
                </Typography>
              )}
              <Tooltip title={refreshError ? `Last error: ${refreshError}` : 'Refresh all'}>
                <IconButton onClick={() => { setLoading(true); refreshAll() }} size="small">
                  <RefreshIcon sx={{ fontSize: 18, ...(loading && { animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }) }} />
                </IconButton>
              </Tooltip>
            </Box>
          }
        />

        {/* Fleet-wide scope confirmation. This page is now admin-only
         * and fleet-scoped (was previously user-scoped and
         * accidentally surfacing only the admin's own accounts). The
         * sibling "System Health (Platform)" page at /admin/health
         * covers data-layer findings (delete failures, nav integrity,
         * validation drift) — complementary, not duplicative.
         */}
        <Alert
          severity="info"
          variant="outlined"
          sx={{ mb: 2, py: 0.5 }}
          action={
            <Button size="small" onClick={() => navigate('/admin/health')}>
              Open System Health (Platform)
            </Button>
          }
        >
          <Typography variant="caption">
            Showing <strong>every user&apos;s linked accounts</strong> (trade / gift / battle executor health).
            For data-layer findings (delete failures, validation drift, nav integrity), see the sibling page.
          </Typography>
        </Alert>

        {/* ── Summary Cards ── */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <MetricCard label="Active" value={loading ? '—' : totals.active} color={theme.palette.primary.main} icon={TimeIcon} />
          <MetricCard label="Stuck" value={loading ? '—' : totals.stuck} color={totals.stuck > 0 ? theme.palette.error.main : theme.palette.success.main} icon={WarningIcon} alert={totals.stuck > 0} trend={trends.stuck} />
          <MetricCard label="Failed 24h" value={loading ? '—' : totals.failed24h} color={totals.failed24h >= FAILURE_THRESHOLD ? theme.palette.error.main : theme.palette.warning.main} icon={ErrorIcon} trend={trends.failed} />
          <MetricCard label="Orphaned" value={loading ? '—' : totals.orphaned} color={totals.orphaned > 0 ? theme.palette.error.main : theme.palette.success.main} icon={ReconcileIcon} alert={totals.orphaned > 0} trend={trends.orphaned} />
        </Box>

        {/* ── Filter Bar ── */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTERS.map(f => {
            const isActive = filter === f.key
            let count = null
            if (f.key === 'issues') count = issueCount
            else if (f.key === 'critical') count = rows.filter(r => r.status === 'critical').length
            else if (f.key === 'stuck') count = rows.filter(r => r.stuck > 0).length
            else if (f.key === 'orphaned') count = rows.filter(r => r.orphaned > 0).length
            else if (f.key === 'failed') count = rows.filter(r => r.failed > 0).length
            return (
              <Chip key={f.key}
                label={count !== null && count > 0 ? `${f.label} (${count})` : f.label}
                size="small"
                onClick={() => setFilter(f.key)}
                sx={{
                  cursor: 'pointer', height: 26, fontSize: '0.65rem', fontWeight: isActive ? 700 : 500,
                  bgcolor: isActive ? theme.palette.primary.main : 'transparent',
                  color: isActive ? '#fff' : 'text.secondary',
                  border: `1px solid ${isActive ? theme.palette.primary.main : isDark ? 'rgba(124,138,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                  '&:hover': { bgcolor: isActive ? theme.palette.primary.dark : (isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.04)') },
                }}
              />
            )
          })}
          {/* Bulk actions */}
          {selected.size > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Button size="small" startIcon={<BulkIcon sx={{ fontSize: 14 }} />}
                onClick={() => handleBulkReconcile([...selected])}
                sx={{ fontSize: '0.65rem', textTransform: 'none', fontWeight: 700 }}>
                Reconcile {selected.size} selected
              </Button>
            </>
          )}
          {issueCount > 0 && selected.size === 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Button size="small" color="warning" startIcon={<ReconcileIcon sx={{ fontSize: 14 }} />}
                onClick={() => handleBulkReconcile(rows.filter(r => r.status !== 'healthy').map(r => r.acctId))}
                sx={{ fontSize: '0.65rem', textTransform: 'none', fontWeight: 700 }}>
                Reconcile all issues ({issueCount})
              </Button>
            </>
          )}
        </Box>

        {/* ── Per-Account Table ── */}
        <Box sx={{ ...sectionBox, overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ p: 2 }}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={44} sx={{ borderRadius: '8px', mb: 0.5 }} />)}
            </Box>
          ) : filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <CheckIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
              <Typography variant="body2">
                {filter === 'all' ? 'No accounts to display' : `No accounts matching "${filter}" filter`}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ width: 36 }}>
                      <Checkbox size="small" checked={selected.size === filteredRows.length && filteredRows.length > 0}
                        indeterminate={selected.size > 0 && selected.size < filteredRows.length}
                        onChange={toggleAll} sx={{ p: 0.5 }} />
                    </TableCell>
                    {['Account', 'Status', 'Trade', 'Gift', 'Battle', 'Stuck', 'Orphans', 'Hint', 'Actions'].map((h, i) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.62rem', py: 1 }}
                        align={[2,3,4,5,6].includes(i) ? 'center' : i === 8 ? 'right' : 'left'}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map(({ acct, acctId, t, g, b, stuck, orphaned, failed, status, lastActivity, hint, data }) => {
                    const hasIssue = status !== 'healthy'
                    return (
                      <TableRow key={acctId} hover
                        onClick={() => setDrawerAcctId(acctId)}
                        sx={{
                          cursor: 'pointer',
                          ...(hasIssue && { bgcolor: isDark ? 'rgba(244,67,54,0.03)' : 'rgba(244,67,54,0.015)' }),
                        }}>
                        <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                          <Checkbox size="small" checked={selected.has(acctId)} onChange={() => toggleSelect(acctId)} sx={{ p: 0.5 }} />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.73rem', lineHeight: 1.2 }}>
                              {acctName(acct)}
                            </Typography>
                            {/* Fleet-view addition — show which user owns this
                             * device account so admins can disambiguate rows
                             * across users. Only rendered when owner_username
                             * is present (i.e., data came from
                             * /accounts/admin/all). Legacy user-scoped rows
                             * omit this field and fall through gracefully. */}
                            {acct?.owner_username && (
                              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', display: 'block', lineHeight: 1.1 }}>
                                @{acct.owner_username}
                              </Typography>
                            )}
                            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
                              {lastActivity ? fmt(lastActivity) : 'no activity'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center"><StatusBadge status={status} /></TableCell>
                        <TableCell align="center"><SystemChip active={t.active} failed={t.failed_24h} completed={t.completed_24h} /></TableCell>
                        <TableCell align="center"><SystemChip active={g.active} failed={g.failed_24h} completed={g.completed_24h} /></TableCell>
                        <TableCell align="center">
                          {b.totalRecords !== undefined
                            ? <Chip label={b.totalRecords} size="small" color={b.driftDetected ? 'error' : 'default'} sx={{ height: 18, fontSize: '0.58rem', fontWeight: 600 }} />
                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell align="center">
                          {stuck > 0 ? <Chip label={stuck} size="small" color="error" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 800 }} />
                            : <CheckIcon sx={{ fontSize: 13, color: theme.palette.success.main }} />}
                        </TableCell>
                        <TableCell align="center">
                          {orphaned > 0 ? <Chip label={orphaned} size="small" color="warning" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 800 }} />
                            : <CheckIcon sx={{ fontSize: 13, color: theme.palette.success.main }} />}
                        </TableCell>
                        <TableCell>
                          {hint && <Typography variant="caption" sx={{ fontSize: '0.55rem', color: theme.palette.warning.main, fontStyle: 'italic' }}>{hint}</Typography>}
                        </TableCell>
                        <TableCell align="right" onClick={e => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            {[
                              { key: 'trade', icon: <TradeIcon sx={{ fontSize: 14 }} />, show: (t.stuck || 0) > 0 || (data?.trade?.drift?.orphanedDbRecords || 0) > 0 },
                              { key: 'gift', icon: <GiftIcon sx={{ fontSize: 14 }} />, show: (g.stuck || 0) > 0 || (data?.gift?.drift?.orphanedDbRecords || 0) > 0 },
                              { key: 'battle', icon: <BattleIcon sx={{ fontSize: 14 }} />, show: data?.battle?.account?.driftDetected },
                            ].filter(s => s.show).map(s => (
                              <Tooltip key={s.key} title={`Reconcile ${s.key}`}>
                                <IconButton size="small" onClick={() => handleReconcileClick(acctId, s.key)}
                                  disabled={!!reconciling[`${acctId}:${s.key}`]}
                                  sx={{ bgcolor: isDark ? 'rgba(124,138,255,0.08)' : 'rgba(92,106,196,0.06)', width: 26, height: 26 }}>
                                  {reconciling[`${acctId}:${s.key}`] ? <CircularProgress size={11} /> : s.icon}
                                </IconButton>
                              </Tooltip>
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* ── Executor Metrics + Activity Log (side by side) ── */}
        {!loading && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            {/* Executor Metrics */}
            {firstData && (
              <Box sx={{ ...sectionBox, flex: 2, minWidth: 300, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>Executors</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2.5, p: 1.5, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: theme.palette.primary.main, fontWeight: 700 }}>TRADE</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.72rem' }}>Sessions: {tg.activeMemorySessions ?? '—'}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.55rem' }}>{fmtUp(tg.uptime)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: theme.palette.warning.main, fontWeight: 700 }}>GIFT</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.72rem' }}>Sessions: {gg.activeMemorySessions ?? '—'}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.55rem' }}>{fmtUp(gg.uptime)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: theme.palette.success.main, fontWeight: 700 }}>BATTLE</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.72rem' }}>{bg.totalInserts ?? '—'}W {bg.failedInserts ?? '—'}F {bg.retryCount ?? '—'}R</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.55rem' }}>{fmtUp(bg.uptimeSec)}</Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Activity Log */}
            <Box sx={{ ...sectionBox, flex: 1, minWidth: 250, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>Recent Activity</Typography>
              </Box>
              <Box sx={{ maxHeight: 140, overflowY: 'auto', px: 1.5, py: 0.75 }}>
                {activityLog.length === 0 ? (
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', display: 'block', py: 1.5, textAlign: 'center' }}>
                    No actions yet this session
                  </Typography>
                ) : activityLog.map((entry, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 0.75, py: 0.4, alignItems: 'flex-start', borderBottom: i < activityLog.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` : 'none' }}>
                    <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.disabled', whiteSpace: 'nowrap', mt: 0.2 }}>
                      {entry.time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    <Typography variant="caption" sx={{
                      fontSize: '0.55rem', wordBreak: 'break-word',
                      color: entry.severity === 'error' ? theme.palette.error.main : entry.severity === 'warning' ? theme.palette.warning.main : theme.palette.success.main,
                    }}>
                      {entry.message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {/* ── Confirmation Modal ── */}
        <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '14px' } }}>
          <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>Confirm Action</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ borderRadius: '10px', mb: 1 }}>
              {confirmAction?.label}
            </Alert>
            <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>
              This will cancel orphaned requests and release stuck account locks. Completed requests are not affected.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmAction(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button variant="contained" color="warning"
              onClick={() => executeReconcile(confirmAction.accountId, confirmAction.system)}
              disabled={!!reconciling[`${confirmAction?.accountId}:${confirmAction?.system}`]}
              startIcon={reconciling[`${confirmAction?.accountId}:${confirmAction?.system}`] ? <CircularProgress size={14} color="inherit" /> : <ReconcileIcon />}
              sx={{ textTransform: 'none', fontWeight: 700 }}>
              Reconcile
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Detail Drawer ── */}
        <Drawer anchor="right" open={!!drawerAcctId} onClose={() => setDrawerAcctId(null)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 380 }, bgcolor: isDark ? '#1a2035' : '#fafbfc' } }}>
          {drawerRow && (
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1rem' }}>{acctName(drawerRow.acct)}</Typography>
                  <StatusBadge status={drawerRow.status} />
                </Box>
                <IconButton onClick={() => setDrawerAcctId(null)} size="small"><CloseIcon /></IconButton>
              </Box>

              {/* Hint */}
              {drawerRow.hint && (
                <Alert severity="info" sx={{ mb: 2, borderRadius: '10px', py: 0.5 }} icon={<InfoIcon sx={{ fontSize: 16 }} />}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{drawerRow.hint}</Typography>
                </Alert>
              )}

              {/* Summary Stats */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {[
                  { label: 'Stuck', value: drawerRow.stuck, color: drawerRow.stuck > 0 ? theme.palette.error.main : theme.palette.success.main },
                  { label: 'Orphaned', value: drawerRow.orphaned, color: drawerRow.orphaned > 0 ? theme.palette.warning.main : theme.palette.success.main },
                  { label: 'Failed', value: drawerRow.failed, color: drawerRow.failed > 0 ? theme.palette.error.main : 'text.secondary' },
                ].map(s => (
                  <Box key={s.label} sx={{ flex: 1, textAlign: 'center', py: 1, borderRadius: '10px', bgcolor: isDark ? 'rgba(124,138,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>{s.label}</Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Trade Details */}
              <DrawerSection title="Trade" data={drawerRow.data?.trade} system="trade" acctId={drawerRow.acctId}
                reconciling={reconciling} onReconcile={handleReconcileClick} theme={theme} isDark={isDark} />

              {/* Gift Details */}
              <DrawerSection title="Gift" data={drawerRow.data?.gift} system="gift" acctId={drawerRow.acctId}
                reconciling={reconciling} onReconcile={handleReconcileClick} theme={theme} isDark={isDark} />

              {/* Battle Details */}
              {drawerRow.data?.battle?.account && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', color: theme.palette.success.main, textTransform: 'uppercase' }}>Battle</Typography>
                  <Box sx={{ mt: 0.5, pl: 1 }}>
                    <DetailLine label="Records" value={drawerRow.b.totalRecords} />
                    <DetailLine label="Stats total" value={drawerRow.b.statisticsTotalBattles} />
                    <DetailLine label="Drift" value={drawerRow.b.drift} alert={drawerRow.b.driftDetected} />
                    <DetailLine label="Latest" value={fmt(drawerRow.b.latestRecordTime)} />
                  </Box>
                  {drawerRow.data?.battle?.account?.driftDetected && (
                    <Button size="small" variant="outlined" color="warning" startIcon={<ReconcileIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleReconcileClick(drawerRow.acctId, 'battle')}
                      disabled={!!reconciling[`${drawerRow.acctId}:battle`]}
                      sx={{ mt: 1, fontSize: '0.65rem', textTransform: 'none' }}>
                      Reconcile Battle
                    </Button>
                  )}
                </Box>
              )}

              {/* Active Sessions */}
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase' }}>
                Executor Sessions
              </Typography>
              <Box sx={{ mt: 0.5, pl: 1 }}>
                <DetailLine label="Trade mem" value={drawerRow.data?.trade?.global?.activeMemorySessions ?? '—'} />
                <DetailLine label="Gift mem" value={drawerRow.data?.gift?.global?.activeMemorySessions ?? '—'} />
              </Box>
            </Box>
          )}
        </Drawer>

        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(p => ({ ...p, open: false }))} sx={{ borderRadius: '10px' }}>{snackbar.message}</Alert>
        </Snackbar>
      </Box>
    </FadeIn>
  )
}

// ── Drawer sub-components ────────────────────────────────────────────
function DrawerSection({ title, data, system, acctId, reconciling, onReconcile, theme, isDark }) {
  if (!data) return null
  const a = data.account || {}
  const drift = data.drift || {}
  const hasIssue = (a.stuck || 0) > 0 || (drift.orphanedDbRecords || 0) > 0
  const color = system === 'trade' ? theme.palette.primary.main : theme.palette.warning.main

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', color, textTransform: 'uppercase' }}>{title}</Typography>
      <Box sx={{ mt: 0.5, pl: 1 }}>
        <DetailLine label="Active" value={a.active || 0} />
        <DetailLine label="Stuck" value={a.stuck || 0} alert={(a.stuck || 0) > 0} />
        <DetailLine label="Failed 24h" value={a.failed_24h || 0} alert={(a.failed_24h || 0) >= FAILURE_THRESHOLD} />
        <DetailLine label="Completed 24h" value={a.completed_24h || 0} />
        <DetailLine label="Last completed" value={fmt(a.last_completed_at)} />
        <DetailLine label="Last failed" value={fmt(a.last_failed_at)} />
        <DetailLine label="Orphaned" value={drift.orphanedDbRecords || 0} alert={(drift.orphanedDbRecords || 0) > 0} />
        {drift.orphanedIds?.length > 0 && (
          <DetailLine label="Orphan IDs" value={drift.orphanedIds.join(', ')} alert />
        )}
      </Box>
      {hasIssue && (
        <Button size="small" variant="outlined" color="warning" startIcon={<ReconcileIcon sx={{ fontSize: 14 }} />}
          onClick={() => onReconcile(acctId, system)}
          disabled={!!reconciling[`${acctId}:${system}`]}
          sx={{ mt: 1, fontSize: '0.65rem', textTransform: 'none' }}>
          Reconcile {title}
        </Button>
      )}
    </Box>
  )
}

function DetailLine({ label, value, alert }) {
  const theme = useTheme()
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: alert ? theme.palette.error.main : 'text.primary' }}>{value}</Typography>
    </Box>
  )
}
