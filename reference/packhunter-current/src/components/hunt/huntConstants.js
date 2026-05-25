/**
 * Hunt Monitor — shared constants, colors, and health logic.
 * Single source of truth for all hunt dashboard components.
 */

// ── Container colors (used everywhere) ────────────────────────────────
export const CONTAINER_COLORS = {
  '1': '#4caf50',
  '2': '#ff9800',
  '3': '#2196f3',
  '4': '#9c27b0',
}

export const CONTAINER_LABELS = {
  '1': 'C1',
  '2': 'C2',
  '3': 'C3',
  '4': 'C4',
}

// ── Status / health palette ───────────────────────────────────────────
export const STATUS = {
  HEALTHY:  '#34d399',
  WARNING:  '#fbbf24',
  DEGRADED: '#fb923c',
  CRITICAL: '#ff5252',
  OFF:      '#64748b',
  MUTED:    '#94a3b8',
}

// ── God-pack status colors ────────────────────────────────────────────
export const GP_STATUS_COLORS = {
  ALIVE:    '#34d399',
  DEAD:     '#ff5252',
  PENDING:  '#fbbf24',
  'NO SHOW': '#94a3b8',
  MISS:     '#94a3b8',
  EXPIRED:  '#94a3b8',
}

// ── Typography scale (consolidated from 7 sizes → 3) ─────────────────
export const FONT = {
  label:   '0.7rem',   // metric labels, captions
  value:   '0.8rem',   // data values in cards/tables
  section: '0.9rem',   // section titles
}

// ── Container health tiers (normalized by PPM per worker) ─────────────
// errorRate should be errors/accounts (per-attempt), matching system verdict thresholds.
//
// `opts` (Phase: container-OFF detection):
//   huntActive   — boolean, true when fleet-wide hunt is running. Required to
//                  distinguish "intentional OFF (no hunt)" from "unexpected OFF
//                  (hunt active but workers down)".
//   intentional  — boolean override from backend. When true (e.g. backend
//                  determined no users assigned, or barrier-wait pause), the
//                  container is OFF for legitimate reasons and is NOT critical.
//   reason       — string from backend describing why activeCount=0.
export function getContainerHealthTier(ppm, activeWorkers, totalWorkers, errorRate, opts = {}) {
  // Canonical health from backend evaluator (split-brain incident fix).
  // When opts.health.state is present, prefer it over the
  // worker-count heuristic — the evaluator has access to the manager
  // beat which the FE doesn't, and it can distinguish IDLE-no-accounts
  // from WORKERS_ZERO_UNEXPECTED that the worker-count check alone
  // cannot. Falls back to legacy logic if health is absent (older
  // backend, evaluator error, etc.).
  if (opts.health && opts.health.state) {
    const h = opts.health
    switch (h.state) {
      case 'RUNNING_HEALTHY': {
        // Don't short-circuit — fall through to PPM/error-rate
        // tiering for the green/warning/degraded gradient.
        break
      }
      case 'RUNNING_DEGRADED':
        return { color: STATUS.DEGRADED, label: 'Degraded', tier: 'degraded',
                 reason: h.reason || 'Running with degraded performance', intentional: false }
      case 'IDLE':
        return { color: STATUS.OFF, label: 'Idle', tier: 'off',
                 reason: h.reason || 'Idle', intentional: true }
      case 'STOPPED':
        return { color: STATUS.OFF, label: 'Stopped', tier: 'off',
                 reason: h.reason || 'Container is stopped', intentional: true }
      case 'FAILED_START':
        return { color: STATUS.CRITICAL, label: 'Failed Start', tier: 'critical',
                 reason: h.reason || 'Container alive but never produced a heartbeat', intentional: false }
      case 'WORKERS_ZERO_UNEXPECTED':
        return { color: STATUS.CRITICAL, label: 'Workers Down', tier: 'critical',
                 reason: h.reason || 'Running but workers not attached', intentional: false }
      case 'BOOTSTRAP_FAILED':
        return { color: STATUS.CRITICAL, label: 'Bootstrap Failed', tier: 'critical',
                 reason: h.reason || 'Bootstrap failed', intentional: false }
      case 'STALE_RUNTIME':
        return { color: STATUS.WARNING, label: 'Stale', tier: 'warning',
                 reason: h.reason || 'Stale runtime state', intentional: false }
      default:
        // Unknown state — fall through to legacy heuristic.
        break
    }
  }

  if (!activeWorkers || activeWorkers === 0) {
    // No workers configured at all → empty container, not a failure.
    if (!totalWorkers || totalWorkers === 0) {
      return { color: STATUS.OFF, label: 'Empty', tier: 'off',
               reason: opts.reason || 'No workers configured', intentional: true }
    }
    // Workers were spawned (totalWorkers > 0) but none are reporting fresh
    // stats. If hunt is active and backend has not flagged this as
    // intentional, this is an UNEXPECTED outage → critical.
    if (opts.huntActive && !opts.intentional) {
      return { color: STATUS.CRITICAL, label: 'Down', tier: 'critical',
               reason: opts.reason || `${totalWorkers} workers stale (>60s)`,
               intentional: false }
    }
    // Hunt not active, or backend marked this as intentional (barrier-wait,
    // no users, etc.) — show as OFF without alarming.
    return { color: STATUS.OFF, label: 'OFF', tier: 'off',
             reason: opts.reason || (opts.huntActive ? 'Paused' : 'Hunt not active'),
             intentional: true }
  }
  const ppmPerWorker = ppm / activeWorkers

  if (errorRate > 0.15) return { color: STATUS.CRITICAL, label: 'Critical', tier: 'critical' }
  if (errorRate > 0.08) return { color: STATUS.DEGRADED, label: 'Degraded', tier: 'degraded' }
  if (ppmPerWorker >= 2.0 && errorRate <= 0.03) return { color: STATUS.HEALTHY, label: 'Healthy', tier: 'healthy' }
  if (ppmPerWorker >= 1.0) return { color: STATUS.WARNING, label: 'Warning', tier: 'warning' }
  if (ppmPerWorker >= 0.3) return { color: STATUS.DEGRADED, label: 'Degraded', tier: 'degraded' }
  return { color: STATUS.CRITICAL, label: 'Critical', tier: 'critical' }
}

// ── System-wide health verdict ────────────────────────────────────────
// Error rate thresholds use errors/accounts (per-attempt rate), not errors/packs.
// PPM imbalance uses numeric ppmPerWorker (parseFloat to handle string inputs).
//
// `opts.huntActive` — when true, per-container "down" detection runs FIRST.
// If any container has totalWorkers > 0 but activeWorkers = 0 and the
// container is not flagged intentional, the verdict is degraded/critical
// regardless of aggregate PPM. This closes the silent-half-fleet-down bug
// where C1+C2 healthy could mask C3+C4 dead because aggregate stayed green.
export function getSystemHealthVerdict(containers, totalPPM, totalActive, totalWorkers, totalErrors, totalAccounts, opts = {}) {
  if (totalActive === 0) return { color: STATUS.OFF, label: 'Offline', reason: 'No active workers', tier: 'off' }

  // ── Per-container down-detection (priority over aggregate signals) ──
  // Only fires while a hunt is active — quiet runs are expected to have
  // OFF containers. Filters intentional OFF (no users / barrier-wait) so
  // legitimate pauses don't trigger false alarms.
  if (opts.huntActive) {
    const downContainers = []
    for (const c of containers) {
      const total = parseInt(c.total ?? c.totalWorkers ?? 0, 10) || 0
      const active = parseInt(c.active ?? c.activeWorkers ?? 0, 10) || 0
      if (total === 0) continue                 // no workers configured = empty
      if (active > 0) continue                  // healthy / degraded handled below
      if (c.intentional === true) continue      // backend says this is fine
      downContainers.push({
        group: c.group, total, active,
        reason: c.reason || `${total} workers stale`,
      })
    }
    if (downContainers.length > 0) {
      const names = downContainers.map(d => `C${d.group}`).join(', ')
      const totalContainers = containers.filter(c => (parseInt(c.total ?? c.totalWorkers ?? 0, 10) || 0) > 0).length
      // Critical at ≥ half (rounded up). For an even fleet (4) this means
      // 2-of-4 is critical. For an odd fleet (3) it means 2-of-3 is
      // critical, but 1-of-3 stays Degraded — single-container outage in
      // a 3-container fleet doesn't justify maximum severity.
      const isCritical = downContainers.length >= Math.ceil(totalContainers / 2)
      return {
        color: isCritical ? STATUS.CRITICAL : STATUS.DEGRADED,
        label: isCritical ? 'Critical' : 'Degraded',
        tier: isCritical ? 'critical' : 'degraded',
        reason: `${downContainers.length}/${totalContainers} container${downContainers.length > 1 ? 's' : ''} down: ${names}`,
        offContainers: downContainers,
      }
    }
  }

  const errorRate = totalAccounts > 0 ? totalErrors / totalAccounts : 0
  const ppmPerWorker = totalActive > 0 ? totalPPM / totalActive : 0

  // Critical: system error rate >15% of attempts
  if (errorRate > 0.15) return { color: STATUS.CRITICAL, label: 'Critical', reason: `Error rate ${(errorRate * 100).toFixed(1)}% of accounts`, tier: 'critical' }

  // Check for container imbalance — parseFloat to handle string ppmPerWorker from containerMetrics.
  // Only includes containers that are EXPECTED to be active (workers > 0) and not intentionally off,
  // so a legitimately-empty C4 doesn't drag the balance check, but a silently-dead C4 does.
  const containerPPMs = containers
    .filter(c => {
      const total = parseInt(c.total ?? c.totalWorkers ?? 0, 10) || 0
      return total > 0 && c.intentional !== true
    })
    .map(c => parseFloat(c.ppmPerWorker) || 0)
    .filter(p => p > 0)
  if (containerPPMs.length >= 2) {
    const sorted = [...containerPPMs].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const worst = sorted[0]
    if (median > 0 && worst / median < 0.5) {
      const worstContainer = containers.find(c => (parseFloat(c.ppmPerWorker) || 0) === worst)
      return {
        color: STATUS.WARNING, label: 'Imbalanced', tier: 'warning',
        reason: `Container ${worstContainer?.group || '?'} at ${worst.toFixed(1)} PPM/worker vs ${median.toFixed(1)} median`,
      }
    }
  }

  // Degraded: moderate error rate or low PPM/worker
  if (errorRate > 0.08) return { color: STATUS.DEGRADED, label: 'Degraded', reason: `Error rate ${(errorRate * 100).toFixed(1)}% of accounts`, tier: 'degraded' }
  if (ppmPerWorker < 1.0 && totalActive > 5) return { color: STATUS.DEGRADED, label: 'Degraded', reason: `Low throughput: ${ppmPerWorker.toFixed(1)} PPM/worker`, tier: 'degraded' }

  // Warning: elevated error rate or workers below target
  if (errorRate > 0.03) return { color: STATUS.WARNING, label: 'Warning', reason: `Error rate ${(errorRate * 100).toFixed(1)}% of accounts`, tier: 'warning' }
  if (ppmPerWorker < 2.0 && totalActive > 5) return { color: STATUS.WARNING, label: 'Warning', reason: `Below target: ${ppmPerWorker.toFixed(1)} PPM/worker`, tier: 'warning' }

  return { color: STATUS.HEALTHY, label: 'Healthy', reason: 'All systems nominal', tier: 'healthy' }
}

// ── Unified health SSoT (2026-04-24 — C1) ─────────────────────────────
//
// Problem context: HuntMonitor's top pill used getSystemHealthVerdict()
// (worker activity + PPM + error rate). The OpsHealthSummary sub-pill
// independently derived a chip label from recovery.currentUnhealthyCount.
// These could disagree: all workers active → top says Healthy; one
// container's ErrorRecoveryEngine flagged degraded → sub says "1
// unhealthy". Operators can't tell which is "the truth".
//
// Fix: ONE merge function. Every consumer calls it with the same inputs
// and renders the same unified verdict. Severity takes the WORST of
// (workerVerdict, recoveryVerdict). All contributing causes surfaced on
// the `reasons[]` array so every state is explained.
//
// Severity rank (low → high): healthy < off < warning < degraded < critical
// Note: 'off' is its own tier (fleet not running) and is NEVER rolled up
// into a fleet "worst" — an OFF fleet should read Offline, not Critical.
// `unhealthy` is the user-facing bucket for degraded+critical.

export const SEVERITY_RANK = Object.freeze({
  healthy:  0,
  off:      1,   // distinct tier — handled specially below
  warning:  2,
  degraded: 3,
  critical: 4,
})

/**
 * Pure reducer: given a worker-activity verdict (from getSystemHealthVerdict)
 * plus optional backend recovery state (from /admin/recovery/container-status),
 * return the single unified verdict that every UI surface should render.
 *
 * @param {object} workerVerdict  — output of getSystemHealthVerdict()
 * @param {object|null} recovery  — { currentUnhealthyCount, recoveryMode,
 *                                    recoveryModeLabel, engine: {active,...} }
 * @returns {object} unified verdict — same shape as workerVerdict plus
 *                   `reasons: string[]` (all contributing causes) and
 *                   `unhealthyCount: number` (canonical sub-pill source).
 */
export function mergeHealthVerdicts(workerVerdict, recovery) {
  if (!workerVerdict) {
    // Defensive: never render without a base verdict.
    return { color: STATUS.OFF, label: 'Unknown', tier: 'off',
             reason: 'No verdict available', reasons: [], unhealthyCount: 0 }
  }

  const unhealthy = recovery?.currentUnhealthyCount ?? 0
  const engineActive = recovery?.engine?.active !== false // undefined = assume active

  // Worker-side reasons first — they describe why the fleet-level PPM /
  // error picture is whatever it is.
  const reasons = []
  if (workerVerdict.reason) reasons.push(workerVerdict.reason)

  // Recovery-engine tier: mirrors what OpsHealthSummary's chip used to
  // derive locally, now computed ONCE here so top + sub agree.
  let recoveryTier = 'healthy'
  let recoveryReason = null
  if (recovery) {
    if (!engineActive) {
      recoveryTier = 'degraded'
      recoveryReason = 'Recovery engine inactive'
    } else if (recovery.recoveryMode === 'unknown') {
      recoveryTier = 'warning'
      recoveryReason = 'Recovery mode unknown'
    } else if (unhealthy > 0) {
      // Per-container recovery-engine flags. ≥1 unhealthy = warning
      // (matches prior sub-pill color). Keeps healthy if engine is
      // actively resolving an issue transparently.
      recoveryTier = 'warning'
      recoveryReason = `${unhealthy} container${unhealthy > 1 ? 's' : ''} unhealthy (recovery engine)`
    }
  }
  if (recoveryReason) reasons.push(recoveryReason)

  // Worst-of rank. 'off' is never "worse" than anything except the
  // baseline — if worker says Offline and recovery has issues, the
  // recovery issues dominate.
  const workerRank   = SEVERITY_RANK[workerVerdict.tier] ?? 0
  const recoveryRank = SEVERITY_RANK[recoveryTier] ?? 0
  const winner = recoveryRank > workerRank ? 'recovery' : 'worker'

  // Take tier/color/label from whichever won. Reason becomes the joined
  // reasons[] so consumers can render "Degraded · workers imbalanced ·
  // 1 container unhealthy (recovery engine)".
  const base = winner === 'recovery'
    ? tierDescriptor(recoveryTier)
    : { tier: workerVerdict.tier, color: workerVerdict.color, label: workerVerdict.label }

  return {
    ...base,
    reason: reasons.length ? reasons.join(' · ') : (workerVerdict.reason || ''),
    reasons,
    unhealthyCount: unhealthy,
    // Preserve workerVerdict extras so existing consumers (e.g. offContainers)
    // still work without reaching into raw objects.
    offContainers: workerVerdict.offContainers,
    // Debug: which input "won" the severity race. Useful for audit UI.
    source: winner,
  }
}

/**
 * Minimal tier → label/color map used when recovery supersedes the
 * worker verdict. Labels here are admin-facing; HealthVerdict.jsx's
 * USER_SAFE_LABELS softens them for non-admins.
 */
function tierDescriptor(tier) {
  switch (tier) {
    case 'critical': return { tier: 'critical', color: STATUS.CRITICAL, label: 'Critical' }
    case 'degraded': return { tier: 'degraded', color: STATUS.DEGRADED, label: 'Degraded' }
    case 'warning':  return { tier: 'warning',  color: STATUS.WARNING,  label: 'Warning' }
    case 'off':      return { tier: 'off',      color: STATUS.OFF,      label: 'Offline' }
    default:         return { tier: 'healthy',  color: STATUS.HEALTHY,  label: 'Healthy' }
  }
}

// ── Recovery label formatter (C5 — 2026-04-24) ────────────────────────
//
// Replaces the old single-line "Recovery: Live (safe) · N unhealthy"
// format that operators found unclear. Canonical two-field wording:
//   Recovery Mode: <MODE>
//   Impact:        <impact phrase>
// optionally followed by "N unhealthy" when currentUnhealthyCount > 0.
//
// Pure function. Single source of truth for all three surfaces
// (OpsHealthSummary, RecoveryStatusPanel, RecoveryStrip) so labels
// cannot drift between surfaces. Backend fields untouched — this is
// frontend-only wording.
//
// Mode → impact mapping (stable contract consumers can rely on):
//   live_safe → Minimal        (resolver acts, safety rails on)
//   assist    → Moderate       (acts only on operator confirmation)
//   audit     → None (observe only)
//   off       → None (not running)
//   unknown   → Unknown
//
// Returns `{ modeLabel, impactLabel, unhealthyLine, summaryLine, tier }`.
// `tier` is a loose severity hint: 'ok' | 'info' | 'warn' | 'err'.
export function formatRecoveryLabels(recovery) {
  if (!recovery) {
    return { modeLabel: 'UNKNOWN', impactLabel: 'Unknown', unhealthyLine: '',
             summaryLine: 'Recovery Mode: UNKNOWN · Impact: Unknown', tier: 'warn' }
  }
  const unhealthy = recovery.currentUnhealthyCount ?? 0
  if (!recovery.engine?.active) {
    return { modeLabel: 'INACTIVE', impactLabel: 'None (engine stopped)',
             unhealthyLine: unhealthy > 0 ? `${unhealthy} unhealthy container${unhealthy > 1 ? 's' : ''}` : '',
             summaryLine: `Recovery Mode: INACTIVE · Impact: None (engine stopped)${unhealthy > 0 ? ` · ${unhealthy} unhealthy` : ''}`,
             tier: 'err' }
  }
  const mode = recovery.recoveryMode || 'unknown'
  // Canonical Mode label mapping. Ignore recoveryModeLabel from the
  // backend ("Live (safe)") because its parenthetical form is what we
  // are replacing — derive from the mode key directly so wording is
  // predictable and drift-resistant.
  const modeLabel = (() => {
    switch (mode) {
      case 'live_safe': return 'SAFE'
      case 'assist':    return 'ASSIST'
      case 'audit':     return 'AUDIT'
      case 'off':       return 'OFF'
      default:          return 'UNKNOWN'
    }
  })()
  const impactLabel = (() => {
    switch (mode) {
      case 'live_safe': return 'Minimal'
      case 'assist':    return 'Moderate'
      case 'audit':     return 'None (observe only)'
      case 'off':       return 'None (not running)'
      default:          return 'Unknown'
    }
  })()
  const tier = (() => {
    if (unhealthy > 0) return 'warn'
    if (mode === 'unknown' || mode === 'off') return 'warn'
    if (mode === 'assist' || mode === 'audit') return 'info'
    return 'ok'
  })()
  const unhealthyLine = unhealthy > 0
    ? `${unhealthy} unhealthy container${unhealthy > 1 ? 's' : ''}`
    : ''
  const summaryLine = `Recovery Mode: ${modeLabel} · Impact: ${impactLabel}`
    + (unhealthyLine ? ` · ${unhealthyLine}` : '')
  return { modeLabel, impactLabel, unhealthyLine, summaryLine, tier }
}

// ── Helpers ───────────────────────────────────────────────────────────

export const formatDuration = (ms) => {
  if (!ms || ms < 0) return '0s'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export const timeAgo = (timestamp) => {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Get container color with fallback
export function getContainerColor(group) {
  return CONTAINER_COLORS[group] || '#888'
}

// ── Data freshness tiers ──────────────────────────────────────────────
// Based on age of last successful data fetch (ms since last update).
export const FRESHNESS = {
  FRESH:   { maxAge: 6000,  color: STATUS.HEALTHY, label: 'Live' },
  STALE:   { maxAge: 15000, color: STATUS.WARNING, label: 'Stale' },
  DELAYED: { maxAge: 30000, color: STATUS.DEGRADED, label: 'Delayed' },
  LOST:    { maxAge: Infinity, color: STATUS.CRITICAL, label: 'No data' },
}

export function getFreshnessTier(ageMs) {
  if (ageMs == null || ageMs < 0) return FRESHNESS.LOST
  if (ageMs <= FRESHNESS.FRESH.maxAge) return FRESHNESS.FRESH
  if (ageMs <= FRESHNESS.STALE.maxAge) return FRESHNESS.STALE
  if (ageMs <= FRESHNESS.DELAYED.maxAge) return FRESHNESS.DELAYED
  return FRESHNESS.LOST
}

// ── Container activity tiers ──────────────────────────────────────────
// Based on whether packs are being produced (pack delta tracking).
// "lastPackAge" = seconds since last observed pack increase for this container.
export function getActivityTier(lastPackAgeSec) {
  if (lastPackAgeSec == null) return { color: STATUS.MUTED, label: '—' }
  if (lastPackAgeSec <= 10) return { color: STATUS.HEALTHY, label: 'Producing' }
  if (lastPackAgeSec <= 30) return { color: STATUS.WARNING, label: `${lastPackAgeSec}s idle` }
  if (lastPackAgeSec <= 60) return { color: STATUS.DEGRADED, label: `${lastPackAgeSec}s idle` }
  return { color: STATUS.CRITICAL, label: `${lastPackAgeSec}s idle` }
}
