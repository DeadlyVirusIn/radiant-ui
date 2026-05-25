import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useHuntStats } from '../contexts/HuntStatsContext'
import { formatNumber, tabularNumStyle } from '../utils/formatNumber'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Collapse,
  Button,
  useTheme,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  CatchingPokemon as PokeballIcon,
  Star as StarIcon,
  HourglassEmpty as HourglassIcon,
  TrendingUp as TrendingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeMode } from '../contexts/ThemeContext'
import { hunt, fetchWithAuth } from '../services/api'
import MetricCard from '../components/MetricCard'
import PageHeader from '../components/PageHeader'
import StickyToolbar from '../components/StickyToolbar'
import StatusDot from '../components/StatusDot'
import GlassCard from '../components/GlassCard'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { HuntMonitorSkeleton } from '../components/skeletons/PageSkeletons'

// ── Hunt sub-components ───────────────────────────────────────────────
import {
  HealthVerdict,
  PPMSparkline,
  ContainerCard,
  AttentionPanel,
  UserSafeStatusSummary,
  WorkerTable,
  GodPackTimeline,
  PackDistribution,
  RuntimePackExecution,
  getSystemHealthVerdict,
  mergeHealthVerdicts,
  formatDuration,
  getContainerColor,
  FONT,
  STATUS,
} from '../components/hunt'
import useRecoveryStatus from '../hooks/useRecoveryStatus'
import ContainerAlignmentSummary from '../components/hunt/ContainerAlignmentSummary'
// Apr 2026 — Recovery + Live Pack Retention panels moved off Hunt
// Monitor into the dedicated Hunt Ops admin page (/admin/hunt-ops).
// A compact OpsHealthSummary strip stays here so admins still get
// at-a-glance signal without the panel clutter.
import OpsHealthSummary from '../components/hunt/OpsHealthSummary'
import NowNextRiskRail from '../components/admin/NowNextRiskRail'
import { formatRecoveryLabels } from '../components/hunt/huntConstants'
import { computeBalanceByPools } from '../utils/balance'

// C6 (2026-04-24) — pools mirror lib/containerPolicy canonical sets.
const HUNT_POOLS = [
  { name: 'standard', groups: [1, 2] },
  { name: 'legacy',   groups: [3, 4] },
]
import { computeContainerAlignment, suggestReplacements, applySwapsToPacks, simulateAlignmentAfterSwaps, projectImpact } from '../components/hunt/alignment'

// ── Main Hunt Monitor ─────────────────────────────────────────────────

function HuntMonitor({ user }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const navigate = useNavigate()
  const isAdmin = user?.isAdmin || false

  // ── Shared Hunt Stats (from context — single source of truth) ──────
  const {
    data: huntStatsCtx,
    loading: ctxLoading,
    error: ctxError,
    fetchedAt: ctxFetchedAt,
    ageMs: ctxAgeMs,
    requestFastPolling,
    releaseFastPolling,
    refetch,
  } = useHuntStats()

  // Request fast polling (3s) while HuntMonitor is mounted
  useEffect(() => {
    requestFastPolling()
    return () => releaseFastPolling()
  }, [requestFastPolling, releaseFastPolling])

  // ── Local state (UI-only, not data fetching) ──────────────────────
  const stats = huntStatsCtx?._raw || null
  const loading = ctxLoading
  const error = ctxError || ''
  const lastFetchTime = ctxFetchedAt
  const dataAgeMs = ctxAgeMs
  // autoRefresh removed — polling is now controlled by HuntStatsContext
  const [distributionStats, setDistributionStats] = useState(null)
  const [containerPackConfigs, setContainerPackConfigs] = useState([])
  const [refreshSpin, setRefreshSpin] = useState(false)
  // Advanced section (user votes + worker table) collapsed by default.
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Wave 7: container tab in URL (?container=all|1|2|3|4 etc.). Lets
  // operators deep-link to a specific container view and keep tab
  // selection across back-button navigation.
  const [searchParams, setSearchParams] = useSearchParams()
  const initialContainerTab = useMemo(() => {
    const fromUrl = searchParams.get('container')
    return fromUrl || 'all'
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [containerTab, setContainerTabState] = useState(initialContainerTab)
  const setContainerTab = (next) => {
    setContainerTabState(next)
    const sp = new URLSearchParams(searchParams)
    if (next === 'all') sp.delete('container')
    else sp.set('container', String(next))
    setSearchParams(sp, { replace: true })
  }
  const [opsOpen, setOpsOpen] = useState(false)
  const [workerFilterOverride, setWorkerFilterOverride] = useState(null)
  const ppmHistory = useRef([])
  const distFetchCount = useRef(0)
  const deltaSnapshots = useRef([])

  // Update local history/delta refs when context data changes
  useEffect(() => {
    if (!huntStatsCtx) return
    const ppm = huntStatsCtx.ppm || 0
    ppmHistory.current = [...ppmHistory.current.slice(-59), { v: ppm }]

    const instances = stats?.instances
    if (instances) {
      const packsByGroup = {}
      const errorsByGroup = {}
      for (const inst of instances) {
        const g = inst.containerGroup || '0'
        packsByGroup[g] = (packsByGroup[g] || 0) + (inst.packsOpened || 0)
        errorsByGroup[g] = (errorsByGroup[g] || 0) + (inst.errors || 0)
      }
      deltaSnapshots.current = [
        ...deltaSnapshots.current.slice(-19),
        { timestamp: Date.now(), packsByGroup, errorsByGroup },
      ]
    }
  }, [huntStatsCtx, stats])

  const fetchDistribution = useCallback(async () => {
    try {
      // Fetch global + per-container (C1..C4) in parallel. The backend
      // route /api/hunt/distribution?containerGroup=N scopes Discord-user
      // weighted distribution to a single container — same code path
      // workers consume at runtime, so the UI reflects the actual
      // per-container pack selection signal.
      const [globalData, c1, c2, c3, c4] = await Promise.all([
        hunt.getDistribution(),
        hunt.getDistribution(1).catch(() => null),
        hunt.getDistribution(2).catch(() => null),
        hunt.getDistribution(3).catch(() => null),
        hunt.getDistribution(4).catch(() => null),
      ])
      setDistributionStats({
        ...globalData,
        perContainer: { 1: c1, 2: c2, 3: c3, 4: c4 },
      })
    } catch { /* Silent fail */ }
  }, [])

  // Distribution fetch on mount + periodic
  useEffect(() => {
    fetchDistribution()
    const interval = setInterval(fetchDistribution, 15000)
    return () => clearInterval(interval)
  }, [fetchDistribution])

  // Container pack config fetch — powers the Runtime Pack Execution card.
  // Slower poll than /stats (30s) because admins rarely flip config mid-batch.
  const fetchContainerPackConfig = useCallback(async () => {
    try {
      const data = await hunt.getContainerPackConfig()
      setContainerPackConfigs(data?.containers || [])
    } catch { /* non-fatal — runtime card falls back to legacy rendering */ }
  }, [])
  useEffect(() => {
    fetchContainerPackConfig()
    const interval = setInterval(fetchContainerPackConfig, 30000)
    return () => clearInterval(interval)
  }, [fetchContainerPackConfig])

  const handleManualRefresh = useCallback(() => {
    setRefreshSpin(true)
    refetch()
    fetchDistribution()
    setTimeout(() => setRefreshSpin(false), 700)
  }, [refetch, fetchDistribution])

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      switch (e.key.toLowerCase()) {
        case 'r': handleManualRefresh(); break
        case 'a': setContainerTab('all'); break
        case '1': setContainerTab('1'); break
        case '2': setContainerTab('2'); break
        case '3': setContainerTab('3'); break
        case '4': setContainerTab('4'); break
        default: break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleManualRefresh])

  // Data age timer removed — now provided by HuntStatsContext (ctxAgeMs)

  // ── Derived data ───────────────────────────────────────────────────
  // NOTE: All hooks (useMemo/useEffect/etc.) MUST be above the early return.
  // React requires identical hook order on every render.
  const summary = stats?.summary || {}
  const allInstances = stats?.instances || []
  const isHuntActive = (summary.activeInstances || 0) > 0
  // Backend data freshness: age of newest stats file on the server (null if field not available)
  const backendAgeMs = stats?.newestInstanceMtime ? Date.now() - stats.newestInstanceMtime : null
  const availableGroups = [...new Set(allInstances.map(i => i.containerGroup).filter(Boolean))].sort()
  const hasMultipleContainers = availableGroups.length > 1
  const perGroupBaseline = stats?.perGroupBaseline || {}

  // Filtered instances by selected container tab
  const instances = containerTab === 'all'
    ? allInstances
    : allInstances.filter(i => i.containerGroup === containerTab)

  // Per-group computed metrics
  const containerMetrics = useMemo(() => {
    return availableGroups.map(g => {
      const gInst = allInstances.filter(i => i.containerGroup === g)
      const gBase = perGroupBaseline[g] || {}
      const gActive = gInst.filter(i => i.isActive).length
      const gPacks = gInst.reduce((s, i) => s + (i.packsOpened || 0), 0) + (gBase.totalPacks || 0)
      const gAccounts = gInst.reduce((s, i) => s + (i.accountsProcessed || 0), 0) + (gBase.accountsProcessed || 0)
      const gGodPacks = gInst.reduce((s, i) => s + (i.godPacksFound || 0), 0) + (gBase.godPacksFound || 0)
      const gErrors = gInst.reduce((s, i) => s + (i.errors || 0), 0)
      const liveByContainer = summary.liveGodPacksByContainer || {}
      const gAlive = liveByContainer[g] || 0
      const gInstEarliest = gInst.reduce((e, i) => i.startTime && (e === null || i.startTime < e) ? i.startTime : e, null)
      const gEarliest = gBase.huntStartTime && (!gInstEarliest || gBase.huntStartTime < gInstEarliest) ? gBase.huntStartTime : gInstEarliest
      const gRunMin = gEarliest ? (Date.now() - gEarliest) / 60000 : 0
      const gPPM = gRunMin > 1 ? gPacks / gRunMin : 0
      const gAcctsTotal = gInst.reduce((s, i) => s + (i.accountsTotal || 0), 0)
      const gAcctsProcessed = gInst.reduce((s, i) => s + (i.accountsProcessed || 0), 0)
      const gAcctsPct = gAcctsTotal > 0 ? Math.round((gAcctsProcessed / gAcctsTotal) * 100) : 0
      const ppmPerWorker = gActive > 0 ? gPPM / gActive : 0

      // Per-container last pack age from real backend timestamps (null if no worker has produced packs)
      const gLastPackTs = gInst.reduce((best, i) => {
        const ts = i.lastPackTimestamp
        return ts && (best === null || ts > best) ? ts : best
      }, null)
      const gLastPackAgeSec = gLastPackTs ? Math.round((Date.now() - gLastPackTs) / 1000) : null

      // Aggregate recentWindow across workers in this container.
      // Phase 1-A2 (May 2026) — read both .packs (current StatsLogger) and
      // .packCount (legacy aggregator field) for forward compatibility.
      let rwAccounts = 0, rwErrors = 0, rwPacks = 0, rwHasData = false
      for (const inst of gInst) {
        const rw = inst.recentWindow
        if (rw && rw.accounts > 0) {
          rwAccounts += rw.accounts
          rwErrors += rw.errors
          rwPacks += (rw.packs ?? rw.packCount ?? 0)
          rwHasData = true
        }
      }
      const recentErrorRate = rwHasData && rwAccounts > 0 ? rwErrors / rwAccounts : null
      const recentPPM = rwHasData ? rwPacks : null // 60s window → packs == PPM

      // Phase 1-A3 (May 2026) — primary metric is rolling/live PPM when
      // available; lifetime average is shown as a secondary label so the
      // operator can never confuse "this container is actually slow right
      // now" with "this container has a low long-run average due to an
      // earlier warmup or ban storm". When recentWindow has no data
      // (worker just started, or pipeline regression) we fall back to
      // lifetime so the card never goes blank.
      // Phase: One-PPM UX (May 2026). When the hunt PPM governor is
      // enabled on this container (rpc.enabled), use the AUTHORITATIVE
      // outbound Pack/OpenV1 rate as the primary Live PPM — it's the
      // metric the throttle actually controls. Otherwise fall back to
      // the cycle-aggregated rollingPPM (rwPacks/windowSec*60) which
      // can run high due to cycle-end timestamping bias but is the
      // best available signal when the governor is off.
      const rpcInfo = gBase.rpc && gBase.rpc.enabled ? gBase.rpc : null
      const ppmIsRolling = !!rpcInfo || (rwHasData && recentPPM != null)
      const livePPM = rpcInfo && Number.isFinite(rpcInfo.actualRpcPpm)
        ? rpcInfo.actualRpcPpm
        : (rwHasData && recentPPM != null ? recentPPM : gPPM)

      return {
        group: g,
        ppm: livePPM.toFixed(1),
        ppmIsRolling,
        lifetimePPM: gPPM.toFixed(1),
        ppmPerWorker: ppmPerWorker.toFixed(1),
        active: gActive,
        total: gInst.length,
        packs: gPacks,
        accounts: gAccounts,
        godPacks: gGodPacks,
        alive: gAlive,
        errors: gErrors,
        acctsPct: gAcctsPct,
        acctsProcessed: gAcctsProcessed,
        lastPackAgeSec: gLastPackAgeSec,
        recentErrorRate, // null if no recentWindow data
        recentPPM,       // null if no recentWindow data
        // Container OFF classification fields surfaced from backend
        // (perGroupBaseline). Default to safe values so older response
        // shapes don't break the verdict.
        intentional: gBase.intentional === true,
        reason: gBase.reason || null,
        expectedActive: gBase.expectedActive ?? gInst.length,
        // RPC PPM throttle telemetry (May 2026). When governor is
        // disabled or beat lacks ppm extras, gBase.rpc is { enabled: false }
        // and ContainerCard hides the field. Otherwise shows the
        // authoritative outbound-RPC PPM the governor controls.
        rpc: gBase.rpc || null,
      }
    })
  }, [allInstances, availableGroups, perGroupBaseline, summary.liveGodPacksByContainer])

  // Combined PPM
  const combinedPPM = containerMetrics.reduce((t, c) => t + parseFloat(c.ppm), 0)

  // Alignment per container (decision layer). Pure derivation from data
  // already loaded (instances + containerPackConfigs + distribution).
  // Stored as a map { [group]: {status, alignment, reason, ...} } so
  // ContainerCard can render a compact badge per card without re-running
  // the math inline.
  const alignmentByGroup = useMemo(() => {
    const cfgByGroup = new Map(containerPackConfigs.map(c => [Number(c.containerGroup), c]))
    const perContainer = distributionStats?.perContainer || {}
    const out = {}
    for (let g = 1; g <= 4; g++) {
      out[g] = computeContainerAlignment({
        instances: allInstances, group: g,
        demand: perContainer[g], cfg: cfgByGroup.get(g),
      })
    }
    return out
  }, [allInstances, containerPackConfigs, distributionStats])

  // Suggestions per container — computed from same inputs as alignment.
  // Empty array per group when no swap pairs exist (already aligned, no
  // demand signal, or no candidates outside the current config).
  const suggestionsByGroup = useMemo(() => {
    const cfgByGroup = new Map(containerPackConfigs.map(c => [Number(c.containerGroup), c]))
    const perContainer = distributionStats?.perContainer || {}
    const out = {}
    for (let g = 1; g <= 4; g++) {
      out[g] = suggestReplacements({
        instances: allInstances, group: g,
        demand: perContainer[g], cfg: cfgByGroup.get(g),
      })
    }
    return out
  }, [allInstances, containerPackConfigs, distributionStats])

  // Impact preview per container — current vs simulated-after-swap
  // alignment + wasted capacity. Feeds ContainerCard's suggestion box
  // so operators see the expected improvement BEFORE clicking Apply.
  // Skipped (null) when there are no suggestions for that container.
  const projectionByGroup = useMemo(() => {
    const cfgByGroup = new Map(containerPackConfigs.map(c => [Number(c.containerGroup), c]))
    const perContainer = distributionStats?.perContainer || {}
    const out = {}
    for (let g = 1; g <= 4; g++) {
      const swaps = suggestionsByGroup[g]
      if (!swaps || swaps.length === 0) { out[g] = null; continue }
      const current = alignmentByGroup[g]
      const simulated = simulateAlignmentAfterSwaps({
        instances: allInstances, group: g,
        demand: perContainer[g], cfg: cfgByGroup.get(g), swaps,
      })
      out[g] = projectImpact(current, simulated)
    }
    return out
  }, [allInstances, containerPackConfigs, distributionStats, suggestionsByGroup, alignmentByGroup])

  // Apply-suggestion handler. Calls the admin endpoint to PUT a new pack
  // list for the container with the swap pre-applied. Refreshes the
  // local config + suggestions on success. NEVER moves users — the
  // PUT only touches container_pack_config rows. Admin-gated by the
  // backend route; non-admin users will see an error toast.
  const applySuggestion = useCallback(async (group, swaps) => {
    const cfg = containerPackConfigs.find(c => Number(c.containerGroup) === Number(group))
    if (!cfg || !cfg.mode || !Array.isArray(cfg.packs)) return
    const nextPacks = applySwapsToPacks(cfg.packs, swaps)
    if (nextPacks.length === 0 || nextPacks.join('|') === cfg.packs.join('|')) return
    try {
      const r = await fetchWithAuth(`/admin/container-pack-config/${group}`, {
        method: 'PUT',
        body: JSON.stringify({ mode: cfg.mode, packs: nextPacks }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || data.error || `save failed (${r.status})`)
      }
      await fetchContainerPackConfig()  // refresh so the badge + suggestion update
    } catch (e) {
      // Surface to the existing error channel; non-fatal otherwise.
      console.error('[HuntMonitor] applySuggestion failed:', e)
    }
  }, [containerPackConfigs, fetchContainerPackConfig])

  // ── Delta-derived metrics (pack freshness + recent errors per container) ──
  // Uses deltaSnapshots sliding window to compute:
  //   lastPackAgeSec: seconds since last observed pack count increase for each container
  //   recentErrors: error delta in the last ~60s for each container
  const deltaMetrics = useMemo(() => {
    const snaps = deltaSnapshots.current
    if (snaps.length < 2) return { lastPackAge: {}, recentErrors: {}, systemRecentErrors: 0 }

    const now = Date.now()
    const latest = snaps[snaps.length - 1]
    // Find oldest snapshot within ~60s window
    const windowStart = snaps.find(s => (now - s.timestamp) <= 65000) || snaps[0]

    const lastPackAge = {}
    const recentErrors = {}
    let systemRecentErrors = 0

    for (const g of availableGroups) {
      // Recent errors: delta between oldest-in-window and latest
      const errNow = latest.errorsByGroup[g] || 0
      const errThen = windowStart.errorsByGroup[g] || 0
      const errDelta = Math.max(0, errNow - errThen)
      recentErrors[g] = errDelta
      systemRecentErrors += errDelta

      // Last pack age: walk backwards from latest to find when pack count last changed
      const currentPacks = latest.packsByGroup[g] || 0
      let lastChangeTimestamp = null
      for (let i = snaps.length - 2; i >= 0; i--) {
        const prevPacks = snaps[i].packsByGroup[g] || 0
        if (prevPacks < currentPacks) {
          // Pack count increased between snap[i] and snap[i+1]
          lastChangeTimestamp = snaps[i + 1].timestamp
          break
        }
      }
      if (lastChangeTimestamp) {
        lastPackAge[g] = Math.round((now - lastChangeTimestamp) / 1000)
      } else if (snaps.length >= 5) {
        // No pack change observed in entire window — report full window age
        lastPackAge[g] = Math.round((now - snaps[0].timestamp) / 1000)
      }
      // else: not enough data yet, leave as undefined (will show as null)
    }

    return { lastPackAge, recentErrors, systemRecentErrors }
  }, [stats, availableGroups]) // eslint-disable-line react-hooks/exhaustive-deps

  // Container health map for AttentionPanel ranking
  const containerHealthMap = useMemo(() => {
    const map = {}
    for (const c of containerMetrics) {
      const errorRate = c.accounts > 0 ? c.errors / c.accounts : 0
      const ppm = parseFloat(c.ppm) || 0
      if (errorRate > 0.15 || (ppm === 0 && c.active > 0)) map[c.group] = 'critical'
      else if (errorRate > 0.08 || (parseFloat(c.ppmPerWorker) || 0) < 0.3) map[c.group] = 'degraded'
      else map[c.group] = 'healthy'
    }
    return map
  }, [containerMetrics])

  // Per-container filtered summary
  const groupBase = containerTab !== 'all' ? (perGroupBaseline[containerTab] || {}) : {}
  const displaySummary = containerTab === 'all' ? summary : {
    ...summary,
    totalPacks: instances.reduce((sum, i) => sum + (i.packsOpened || 0), 0) + (groupBase.totalPacks || 0),
    totalGodPacks: instances.reduce((sum, i) => sum + (i.godPacksFound || 0), 0) + (groupBase.godPacksFound || 0),
    activeInstances: instances.filter(i => i.isActive).length,
    totalInstances: instances.length,
  }

  // Total errors and error rate (errors per account processed, not per pack)
  const totalErrors = allInstances.reduce((s, i) => s + (i.errors || 0), 0)
  const totalPacks = summary.totalPacks || 0
  const totalAccounts = summary.totalAccounts || allInstances.reduce((s, i) => s + (i.accountsProcessed || 0), 0)
  const errorRate = totalAccounts > 0 ? totalErrors / totalAccounts : 0

  // System-level recent metrics from recentWindow (aggregated across all workers)
  const systemRecent = useMemo(() => {
    let acc = 0, err = 0, packs = 0, hasData = false
    for (const inst of allInstances) {
      const rw = inst.recentWindow
      if (rw && rw.accounts > 0) { acc += rw.accounts; err += rw.errors; packs += rw.packs; hasData = true }
    }
    return {
      errorRate: hasData && acc > 0 ? err / acc : null,
      errors: hasData ? err : null,
      accounts: hasData ? acc : null,
      ppm: hasData ? packs : null, // packs in 60s = PPM
    }
  }, [allInstances])

  // Healthy vs active workers
  const totalActive = displaySummary.activeInstances || 0
  const totalWorkers = displaySummary.totalInstances || 0

  // C1 (2026-04-24) — unified health SSoT. Fetch recovery once at this
  // level so top pill (HealthVerdict) and sub-pill (OpsHealthSummary)
  // render from the SAME data + same merge function. Only polls while
  // admin (hook returns recovery=null for non-admins, merger then just
  // renders the worker-side verdict unchanged — backward compatible).
  const { recovery: recoveryStatus } = useRecoveryStatus({ enabled: isAdmin })

  // System health verdict — passes huntActive so per-container OFF detection
  // fires (Down containers are critical/degraded instead of being silently
  // dropped from the imbalance calc). Then merged with recovery-engine
  // state so a recovery-flagged container can't be silently masked by a
  // green worker-PPM picture.
  const verdict = useMemo(() => {
    const workerVerdict = getSystemHealthVerdict(
      containerMetrics,
      combinedPPM,
      summary.activeInstances || 0,
      allInstances.length,
      totalErrors,
      totalAccounts,
      { huntActive: isHuntActive },
    )
    return mergeHealthVerdicts(workerVerdict, recoveryStatus)
  }, [containerMetrics, combinedPPM, summary.activeInstances, allInstances.length, totalErrors, totalAccounts, isHuntActive, recoveryStatus])

  // PPM trend (compare current to 30s ago)
  const ppmTrend = useMemo(() => {
    const hist = ppmHistory.current
    if (hist.length < 10) return null
    const current = hist[hist.length - 1]?.v || 0
    const past = hist[Math.max(0, hist.length - 10)]?.v || 0
    if (past === 0) return null
    const delta = ((current - past) / past) * 100
    if (Math.abs(delta) < 1) return { direction: 'flat', value: 0 }
    return { direction: delta > 0 ? 'up' : 'down', value: Math.round(Math.abs(delta)) }
  }, [stats]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading state (must be AFTER all hooks to preserve hook order) ──
  if (loading && !stats) return <HuntMonitorSkeleton />

  // Hunt type label — normalize raw types like "reroll-G1" → "reroll", then deduplicate
  const rawHuntTypes = instances.map(i => i.huntType).filter(Boolean)
  const normalizedTypes = [...new Set(rawHuntTypes.map(t => t.replace(/-G\d+$/, '')))]
  const huntTypeLabel = normalizedTypes.length > 0
    ? (() => {
        const names = normalizedTypes.map(t => t === 'godpack' ? 'God Pack' : t === 'maxpack' ? 'Max Pack' : t === 'reroll' ? 'Reroll' : t)
        const label = names.join(' / ')
        return hasMultipleContainers ? `${label} · ${availableGroups.length} groups` : label
      })()
    : null

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ════════════ PAGE HEADER ════════════ */}
      <PageHeader
        icon={<PokeballIcon />}
        title="Hunt Monitor"
        subtitle="Live operational dashboard"
      />

      {/* ════════════ GOD PACK ALERT (conditional) ════════════ */}
      <AnimatePresence>
        {summary.totalGodPacks > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Box
              onClick={() => navigate('/godpacks')}
              sx={{
                position: 'sticky', top: 64, zIndex: 10,
                mb: 1, mx: { xs: -2, sm: -3 }, px: 2.5, py: 1.25,
                borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 140, 0, 0.08) 100%)',
                border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 215, 0, 0.25)'}`,
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                overflow: 'hidden',
                transition: 'box-shadow 0.3s ease',
                '&:hover': { boxShadow: '0 0 24px rgba(255, 215, 0, 0.15)' },
                // Single shimmer — runs once, not infinite
                '&::after': {
                  content: '""', position: 'absolute', top: 0, left: '-100%', width: '200%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.06), transparent)',
                  animation: 'shimmerSweep 2.5s ease-in-out 1',
                },
                '@keyframes shimmerSweep': { '0%': { transform: 'translateX(-50%)' }, '100%': { transform: 'translateX(50%)' } },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ color: '#FFD700', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#FFD700', ...tabularNumStyle }}>
                  {summary.totalGodPacks} GOD PACK{summary.totalGodPacks > 1 ? 'S' : ''} FOUND
                </Typography>
                {summary.liveGodPacks > 0 && (
                  <Chip
                    label={`${summary.liveGodPacks} Live`}
                    size="small"
                    sx={{
                      height: 20, fontSize: '0.6rem', fontWeight: 700,
                      bgcolor: 'rgba(52, 211, 153, 0.15)', color: STATUS.HEALTHY,
                      border: `1px solid rgba(52, 211, 153, 0.25)`,
                    }}
                  />
                )}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════ STICKY TOOLBAR ════════════ */}
      <StickyToolbar sx={{ top: summary.totalGodPacks > 0 ? 120 : 64 }}>
        <StickyToolbar.Left>
          <StatusDot status={isHuntActive ? 'active' : 'idle'} size={12} label={isHuntActive ? 'Hunt Active' : 'Hunt Idle'} />
          {isHuntActive && (
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5, fontSize: FONT.label }}>
              {formatDuration(summary.runningTimeMs)} elapsed
            </Typography>
          )}
          {huntTypeLabel && (
            <Chip label={huntTypeLabel} size="small"
              sx={{ fontSize: '0.65rem', height: 20, fontWeight: 600, bgcolor: `${theme.palette.primary.main}12`, color: theme.palette.primary.main }} />
          )}
        </StickyToolbar.Left>
        <StickyToolbar.Right>
          <Chip
            icon={<Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#34d399', display: 'inline-block', ml: 0.5 }} />}
            label="Live"
            size="small"
            sx={{
              fontWeight: 600,
              bgcolor: 'rgba(52, 211, 153, 0.1)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.2)',
            }}
          />
          <Tooltip title="Refresh now (R)">
            <IconButton onClick={handleManualRefresh} aria-label="Refresh now" size="small"
              sx={{ bgcolor: 'rgba(124, 138, 255, 0.08)', border: '1px solid rgba(124, 138, 255, 0.15)', color: theme.palette.primary.main }}>
              <motion.div animate={{ rotate: refreshSpin ? 360 : 0 }} transition={{ duration: 0.6, ease: 'easeInOut' }} style={{ display: 'flex' }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </motion.div>
            </IconButton>
          </Tooltip>
        </StickyToolbar.Right>
      </StickyToolbar>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}

      {/* ═══════════════════════════════════════════════════════════════
           LEVEL 1 — GLOBAL STATUS
         ═══════════════════════════════════════════════════════════════ */}

      {/* C6 (2026-04-24) — NOW / NEXT / RISK rail sits above the
          health verdict banner. Synthesizes unified verdict (C1),
          recovery labels (C5), and PPM + error metrics to give admins
          instant "what / what to do / what it costs" signal. Admin-only.
          Pool-aware balance is a HybridControl concern (that page owns
          user-count data); HuntMonitor intentionally passes
          balanceStatus=null so the rail falls through to
          health/recovery/metrics signals without fabricating pool data. */}
      {isAdmin && (
        <FadeIn>
          <NowNextRiskRail
            inputs={{
              unifiedVerdict: verdict,
              balanceStatus: null,
              recoveryLabels: formatRecoveryLabels(recoveryStatus),
              metrics: {
                currentLivePpm: combinedPPM,
                unhealthyWorkers: Math.max(0, totalWorkers - totalActive),
                totalWorkers,
                errorRate,
                errorThreshold: 0.03,
              },
            }}
          />
        </FadeIn>
      )}

      {/* Health Verdict Banner */}
      <FadeIn>
        <HealthVerdict verdict={verdict} dataAgeMs={dataAgeMs} backendAgeMs={backendAgeMs} isAdmin={isAdmin} />
      </FadeIn>

      {/* Apr 2026 — compact admin-only summary strip. Replaces the
          previously-inline Recovery + Live Pack Retention panels,
          which now live on /admin/hunt-ops. Operators get at-a-glance
          status + click-through to the full panels. */}
      <OpsHealthSummary
        isAdmin={isAdmin}
        recovery={recoveryStatus}
        unifiedVerdict={verdict}
      />

      {/* ═══ HERO PPM CARD — Dominant visual anchor ═══ */}
      {/* 2026-04-20 Phase 6B — compact on narrow viewports. Hero still owns
          PPM but no longer dominates above-the-fold on mobile, leaving room
          for the AttentionPanel that now renders directly below it. */}
      {isHuntActive && (
        <FadeIn>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 3 },
            mb: 2, px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 },
            borderRadius: '16px',
            bgcolor: isDark ? 'rgba(124,138,255,0.04)' : 'rgba(92,106,196,0.03)',
            border: `1px solid ${isDark ? 'rgba(124,138,255,0.12)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Box>
              <Typography sx={{
                fontSize: { xs: '1.9rem', sm: '2.2rem', md: '2.5rem' },
                fontWeight: 800, lineHeight: 1,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                color: combinedPPM > 200 ? theme.palette.success.main
                  : combinedPPM > 50 ? theme.palette.warning.main
                  : theme.palette.error.main,
              }}>
                {Math.round(huntStatsCtx?.ppm || combinedPPM)}
              </Typography>
              {/*
                2026-04-19 metric-trust fix: this number is the
                60-second rolling system-wide PPM (huntStatsCtx.ppm,
                fed from summary.rollingPPM). Container cards below
                show lifetime averages (gPacks / gRunMin), so they
                will not sum to this value. Label clarifies the
                difference; tooltip explains the why.
              */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Live System PPM
                </Typography>
                <Tooltip title="60-second rolling throughput across all containers. Container cards show lifetime averages — these will not match the live number.">
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
                </Tooltip>
              </Box>
            </Box>
            {ppmHistory.current.length > 4 && (
              <Box sx={{ flex: 1, maxWidth: 280, height: 48 }}>
                <PPMSparkline data={ppmHistory.current} height={48} />
              </Box>
            )}
            {/* PPM trend delta — shows change since page load */}
            {ppmTrend && ppmTrend.value !== 0 && (
              <Chip
                label={`${ppmTrend.direction === 'up' ? '+' : ''}${ppmTrend.value}%`}
                size="small"
                sx={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700,
                  bgcolor: ppmTrend.direction === 'up' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: ppmTrend.direction === 'up' ? theme.palette.success.main : theme.palette.error.main,
                  border: `1px solid ${ppmTrend.direction === 'up' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}
              />
            )}
          </Box>
        </FadeIn>
      )}

      {/* 2026-04-20 Phase 6B — AttentionPanel promoted to Level 1.
          Rationale: problems > stats. Operators see what needs fixing
          BEFORE drilling into KPI cards. Non-admins still get the
          calmer UserSafeStatusSummary. */}
      {instances.length > 0 && (
        <FadeIn>
          <Box sx={{ mb: 2 }}>
          {isAdmin ? (
            <AttentionPanel
              instances={instances}
              containerHealthMap={containerHealthMap}
              onFilterErrors={() => {
                setWorkerFilterOverride('errors')
                setTimeout(() => {
                  document.getElementById('hunt-workers-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
              }}
            />
          ) : (
            <UserSafeStatusSummary
              issueCount={instances.filter(i => i.isActive && i.errors > 5).length}
              criticalCount={instances.filter(i => i.isActive && i.errors > 20).length}
              hasBackendLag={backendAgeMs != null && backendAgeMs > 30000}
              hasFetchStale={dataAgeMs != null && dataAgeMs > 15000}
            />
          )}
          </Box>
        </FadeIn>
      )}

      {/* KPI Strip — no PPM card (hero owns PPM), unique metrics only */}
      <FadeIn>
        <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2 }, mb: 3, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 0 } }}>
          {[
            {
              icon: HourglassIcon, label: 'Runtime', color: 'primary',
              value: formatDuration(summary.runningTimeMs),
              subValue: `${totalActive}/${totalWorkers} workers`,
            },
            {
              icon: PokeballIcon, label: 'Total Packs', color: 'primary',
              value: displaySummary.totalPacks || 0,
            },
            {
              icon: StarIcon, label: 'God Packs', color: 'warning',
              value: displaySummary.totalGodPacks || 0,
              onClick: displaySummary.totalGodPacks > 0 ? () => navigate('/godpacks') : undefined,
              subValue: displaySummary.totalGodPacks > 0 && displaySummary.totalPacks > 0
                ? `1 in ${Math.round(displaySummary.totalPacks / displaySummary.totalGodPacks).toLocaleString()}`
                : null,
            },
            {
              icon: CheckIcon, label: 'Live GPs', color: 'success',
              value: summary.liveGodPacks || 0,
              subValue: summary.totalGodPacks > 0
                ? `${summary.liveGodPacks || 0}/${summary.totalGodPacks}`
                : null,
            },
            // Workers merged into Runtime card above — no separate card needed
            {
              icon: ErrorIcon, label: 'Error Rate',
              color: (systemRecent.errorRate != null && systemRecent.errorRate > 0.05) ? 'error'
                : (systemRecent.errorRate != null && systemRecent.errorRate > 0.03) ? 'warning'
                : errorRate > 0.05 ? 'error' : 'primary',
              value: totalAccounts > 0 ? `${(errorRate * 100).toFixed(1)}%` : '0%',
              subValue: isAdmin
                ? (systemRecent.errorRate != null
                    ? `Recent: ${(systemRecent.errorRate * 100).toFixed(1)}% (${systemRecent.errors}/${systemRecent.accounts})`
                    : deltaMetrics.systemRecentErrors > 0
                      ? `${deltaMetrics.systemRecentErrors} in last 1m`
                      : totalErrors > 0 ? `${formatNumber(totalErrors)} total` : null)
                : (totalErrors > 0 ? `${formatNumber(totalErrors)} total` : null),
            },
          ].map((m, i) => (
            <Box key={i} sx={{ minWidth: 130, flex: '1 0 auto' }}>
              <MetricCard icon={m.icon} label={m.label} value={m.value} color={m.color} size="sm"
                onClick={m.onClick} subValue={m.subValue} />
            </Box>
          ))}
        </Box>
      </FadeIn>

      {/* ═══════════════════════════════════════════════════════════════
           LEVEL 2 — CONTAINER OVERVIEW
         ═══════════════════════════════════════════════════════════════ */}

      {/* Container Cards */}
      {hasMultipleContainers && containerTab === 'all' && (
        <FadeIn>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {containerMetrics.map(c => (
              <ContainerCard
                key={c.group}
                group={c.group}
                ppm={c.ppm}
                ppmIsRolling={c.ppmIsRolling}
                lifetimePPM={c.lifetimePPM}
                ppmPerWorker={c.ppmPerWorker}
                active={c.active}
                total={c.total}
                packs={c.packs}
                accounts={c.accounts}
                godPacks={c.godPacks}
                alive={c.alive}
                errors={c.errors}
                acctsPct={c.acctsPct}
                acctsProcessed={c.acctsProcessed}
                lastPackAgeSec={c.lastPackAgeSec ?? deltaMetrics.lastPackAge[c.group] ?? null}
                recentErrorRate={c.recentErrorRate}
                recentErrors={c.recentErrorRate == null ? (deltaMetrics.recentErrors[c.group] ?? null) : null}
                isSelected={false}
                isAdmin={isAdmin}
                onClick={() => setContainerTab(c.group)}
                huntActive={isHuntActive}
                intentional={c.intentional}
                offReason={c.reason}
                rpc={c.rpc}
                alignment={alignmentByGroup[c.group]}
                suggestions={suggestionsByGroup[c.group]}
                suggestionProjection={projectionByGroup[c.group]}
                onApplySuggestion={isAdmin ? applySuggestion : undefined}
              />
            ))}
          </Box>
        </FadeIn>
      )}

      {/* Container Tabs — immediately below container cards */}
      {hasMultipleContainers && (
        <FadeIn>
          <Box sx={{ mb: 2 }}>
            <Tabs
              value={containerTab}
              onChange={(_, val) => setContainerTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 36,
                '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: FONT.value, fontWeight: 600, px: 2 },
                '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
              }}
            >
              <Tab value="all" label={`All (${allInstances.length})`} />
              {availableGroups.map(g => {
                const gInst = allInstances.filter(i => i.containerGroup === g)
                const gActive = gInst.filter(i => i.isActive).length
                const gBase = perGroupBaseline[g] || {}
                const gGPs = gInst.reduce((s, i) => s + (i.godPacksFound || 0), 0) + (gBase.godPacksFound || 0)
                return (
                  <Tab
                    key={g}
                    value={g}
                    label={`Container ${g} (${gActive}/${gInst.length})${gGPs > 0 ? ` ⭐${gGPs}` : ''}`}
                    sx={{
                      '&.Mui-selected': { color: getContainerColor(g) },
                    }}
                  />
                )
              })}
            </Tabs>
          </Box>
        </FadeIn>
      )}

      {/* Cumulative totals banner */}
      {containerTab !== 'all' && (perGroupBaseline[containerTab]?.totalPacks > 0) && (
        <FadeIn>
          <Box sx={{
            mb: 1.5, px: 2, py: 1, borderRadius: '8px',
            bgcolor: isDark ? 'rgba(124,138,255,0.04)' : 'rgba(25,118,210,0.03)',
            border: `1px solid ${isDark ? 'rgba(124,138,255,0.1)' : 'rgba(25,118,210,0.08)'}`,
            display: 'flex', gap: 3, alignItems: 'center', fontSize: FONT.label,
          }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Previous cycles:</Typography>
            <Typography variant="caption" sx={{ color: 'text.primary', ...tabularNumStyle }}>
              {formatNumber(perGroupBaseline[containerTab]?.totalPacks || 0)} packs
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.primary', ...tabularNumStyle }}>
              {formatNumber(perGroupBaseline[containerTab]?.accountsProcessed || 0)} accts
            </Typography>
            {(perGroupBaseline[containerTab]?.godPacksFound || 0) > 0 && (
              <Typography variant="caption" sx={{ color: '#FFD700', fontWeight: 700 }}>
                ⭐ {perGroupBaseline[containerTab].godPacksFound} GP
              </Typography>
            )}
          </Box>
        </FadeIn>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           LEVEL 3 — DIAGNOSTIC DRILL-DOWN
         ═══════════════════════════════════════════════════════════════ */}

      {/* 2026-04-20 Phase 6B — AttentionPanel moved to Level 1 (above KPI strip).
          Operators see problems before stats; no sticky duplicate here. */}

      {/* Recent God Packs Timeline */}
      {stats?.recentGodPacks?.length > 0 && (
        <FadeIn>
          <GodPackTimeline
            godPacks={containerTab === 'all'
              ? stats.recentGodPacks
              : stats.recentGodPacks.filter(gp => gp.containerGroup === containerTab)
            }
          />
        </FadeIn>
      )}

      {/* Decision layer — alignment between demand and runtime. Renders
          FIRST so operators see the at-a-glance verdict before any raw
          data. */}
      {(instances.length > 0) && (
        <FadeIn>
          <ContainerAlignmentSummary
            instances={instances}
            containers={containerPackConfigs}
            perContainer={distributionStats?.perContainer}
          />
        </FadeIn>
      )}

      {/* What Workers Are Opening — runtime truth per container. */}
      {(instances.length > 0 || containerPackConfigs.length > 0) && (
        <FadeIn>
          <RuntimePackExecution
            containers={containerPackConfigs}
            instances={instances}
          />
        </FadeIn>
      )}

      {/* Advanced — collapsed by default. Contains: What Users Want
          (vote distribution + per-container vote breakdown) and the raw
          Worker Table. Users who need the fine-grained demand data or
          per-worker inspection expand this section; default render is
          clean. */}
      <Box sx={{ mb: 1 }}>
        <Button
          size="small"
          startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAdvanced(v => !v)}
          sx={{
            fontSize: '0.7rem', textTransform: 'none', fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          {showAdvanced ? 'Hide Advanced' : 'Show Advanced (votes, worker table)'}
        </Button>
      </Box>
      <Collapse in={showAdvanced} timeout="auto" unmountOnExit>
      {(instances.length > 0 || distributionStats) && (
        <FadeIn>
          <PackDistribution
            distribution={distributionStats?.distribution}
            totalUsers={distributionStats?.totalUsers}
            userCountByPack={distributionStats?.userCountByPack}
            perContainer={distributionStats?.perContainer}
            instances={instances}
            packTypeBreakdown={stats?.packTypeBreakdown}
          />
        </FadeIn>
      )}

      {/* Worker Table (inside Advanced collapse) / Empty State */}
      {instances.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={<HourglassIcon sx={{ fontSize: 56 }} />}
            title="No active hunt workers detected"
            description="Start a hunt using the launcher scripts to see real-time progress here"
          />
        </GlassCard>
      ) : (
        <FadeIn>
          <Box id="hunt-workers-section">
            <WorkerTable instances={instances} containerTab={containerTab} externalFilter={workerFilterOverride} />
          </Box>
        </FadeIn>
      )}
      </Collapse>
      {/* End Advanced collapse */}

      {/* ═══════════════════════════════════════════════════════════════
           LEVEL 4 — OPERATIONAL DETAIL (collapsed)
         ═══════════════════════════════════════════════════════════════ */}

      {isAdmin && stats?.operationalMetrics && stats.operationalMetrics.mode !== 'b2b_only' && stats.operationalMetrics.mode !== 'standard_only' && (
        <FadeIn>
          <Box sx={{ mt: 3 }}>
            <Box
              onClick={() => setOpsOpen(!opsOpen)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25,
                borderRadius: opsOpen ? '12px 12px 0 0' : '12px', cursor: 'pointer',
                bgcolor: isDark ? 'rgba(255,152,0,0.04)' : 'rgba(255,152,0,0.025)',
                border: `1px solid ${isDark ? 'rgba(255,152,0,0.12)' : 'rgba(255,152,0,0.1)'}`,
                borderBottom: opsOpen ? 'none' : undefined,
                transition: 'background-color 0.2s',
                '&:hover': { bgcolor: isDark ? 'rgba(255,152,0,0.06)' : 'rgba(255,152,0,0.04)' },
              }}
            >
              <Typography sx={{ fontSize: FONT.section, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
                Operational Status
              </Typography>
              {(() => {
                const om = stats.operationalMetrics
                const modeColors = { standard_only: '#4CAF50', b2b_only: '#4CAF50', hybrid: '#FF9800', custom_enabled: '#F44336' }
                return (
                  <Chip label={om.mode.replace(/_/g, ' ')} size="small"
                    sx={{ bgcolor: modeColors[om.mode] || '#999', color: '#fff', fontWeight: 600, fontSize: '0.65rem' }} />
                )
              })()}
              <IconButton size="small" sx={{ color: 'text.secondary' }}>
                {opsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>

            <Collapse in={opsOpen}>
              <Box sx={{
                p: 2, borderRadius: '0 0 12px 12px',
                bgcolor: isDark ? 'rgba(255,152,0,0.04)' : 'rgba(255,152,0,0.025)',
                border: `1px solid ${isDark ? 'rgba(255,152,0,0.12)' : 'rgba(255,152,0,0.1)'}`,
                borderTop: 'none',
              }}>
                {(() => {
                  const om = stats.operationalMetrics
                  const ALL_GROUPS = [1, 2, 3, 4]
                  const customGrps = om.customContainers || []
                  const standardGrps = ALL_GROUPS.filter(g => !customGrps.includes(g))
                  const fmtGrps = (grps) => grps.length > 0 ? grps.map(g => `C${g}`).join('+') : 'none'

                  const stdPpms = standardGrps.map(g => om.perGroup[g]?.ppm || 0).filter(p => p > 0)
                  const stdAvgPpm = stdPpms.length > 0 ? stdPpms.reduce((a, b) => a + b, 0) / stdPpms.length : 0
                  const customPpms = customGrps.map(g => om.perGroup[g]?.ppm || 0).filter(p => p > 0)
                  const customAvgPpm = customPpms.length > 0 ? customPpms.reduce((a, b) => a + b, 0) / customPpms.length : 0
                  const customMaxErr = customGrps.reduce((mx, g) => Math.max(mx, om.perGroup[g]?.errorRate || 0), 0)
                  const customPpmRatio = stdAvgPpm > 0 ? customAvgPpm / stdAvgPpm : 1

                  return (
                    <>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
                        <Box sx={{ minWidth: 100 }}>
                          <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>Standard ({fmtGrps(standardGrps)})</Typography>
                          <Typography variant="h6" fontWeight={700} sx={{ ...tabularNumStyle }}>{om.standardInstances ?? om.b2bInstances ?? 0}</Typography>
                          <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>workers</Typography>
                        </Box>
                        <Box sx={{ minWidth: 100 }}>
                          <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>Custom ({fmtGrps(customGrps)})</Typography>
                          <Typography variant="h6" fontWeight={700} sx={{ ...tabularNumStyle }} color="warning.main">{om.customInstances}</Typography>
                          <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>{om.customPct}% of total</Typography>
                        </Box>
                        <Box sx={{ minWidth: 100 }}>
                          <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>Fallback</Typography>
                          <Typography variant="h6" fontWeight={700} sx={{ ...tabularNumStyle }}>{om.fallbackInstances}</Typography>
                          <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>{om.fallbackPct}% of custom</Typography>
                        </Box>
                        {customGrps.length > 0 && (
                          <Box sx={{ minWidth: 140 }}>
                            <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>Custom Health</Typography>
                            <Typography variant="h6" fontWeight={700} sx={{ ...tabularNumStyle }}
                              color={customPpmRatio < 0.5 ? 'error.main' : customPpmRatio < 0.75 ? 'warning.main' : 'success.main'}>
                              {customAvgPpm.toFixed(1)} PPM
                            </Typography>
                            <Typography sx={{ fontSize: FONT.label, color: 'text.secondary' }}>
                              {stdAvgPpm > 0 ? `${(customPpmRatio * 100).toFixed(0)}% of standard avg` : '—'}
                              {customMaxErr > 5 ? ` | ${customMaxErr}% err` : ''}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {ALL_GROUPS.map(g => {
                          const pg = om.perGroup[g]
                          if (!pg || pg.instances === 0) return null
                          const isCustom = customGrps.includes(g)
                          const participants = om.participantsPerGroup?.[g] || 0
                          return (
                            <Box key={g} sx={{
                              px: 1.5, py: 0.5, borderRadius: '8px', fontSize: FONT.label,
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              border: isCustom ? `1px solid ${isDark ? 'rgba(255,152,0,0.2)' : 'rgba(255,152,0,0.15)'}` : 'none',
                              fontFamily: 'monospace',
                            }}>
                              <strong>C{g}</strong>{isCustom ? ' ⚡' : ''}
                              {' '}{pg.active}/{pg.instances} workers
                              {' | '}{pg.ppm} PPM
                              {pg.custom > 0 && <span style={{ color: '#FF9800' }}> | {pg.custom} custom</span>}
                              {' | '}{participants}p
                              {pg.errorRate > 5 && <span style={{ color: STATUS.CRITICAL }}> | {pg.errorRate}% err</span>}
                            </Box>
                          )
                        })}
                      </Box>

                      {customPpmRatio < 0.5 && stdAvgPpm > 0 && (
                        <Typography sx={{ fontSize: FONT.label, color: 'error.main', mt: 1 }}>
                          ⚠ Custom group PPM is below 50% of standard average
                        </Typography>
                      )}
                      {om.fallbackPct > 80 && om.mode === 'hybrid' && (
                        <Typography sx={{ fontSize: FONT.label, color: 'text.secondary', mt: 0.5 }}>
                          ℹ {om.fallbackPct}% of custom workers falling back to default pack
                        </Typography>
                      )}
                    </>
                  )
                })()}
              </Box>
            </Collapse>
          </Box>
        </FadeIn>
      )}
    </Box>
  )
}

export default HuntMonitor
