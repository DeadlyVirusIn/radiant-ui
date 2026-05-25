/**
 * NOW / NEXT / RISK — operator decision rail (C6 — 2026-04-24).
 *
 * Pure reducers. No React. No fetching. Given the unified verdict +
 * pool-aware balance + recovery labels + PPM/worker/error inputs, returns
 * three compact lines the rail component renders.
 *
 * Source contracts — DO NOT invent alternative fields:
 *   unifiedVerdict     — output of huntConstants.mergeHealthVerdicts()
 *   balanceStatus      — output of utils/balance.computeBalanceByPools()
 *                        i.e. { balanced, pools: [{name, groups, target,
 *                          balanced, counts, reasons, imbalance}] }
 *   suggestWithinPool  — imported lazily by computeNext() (callers pass
 *                        its result as `suggestion`)
 *   recoveryLabels     — output of huntConstants.formatRecoveryLabels()
 *   metrics            — { currentLivePpm, unhealthyWorkers,
 *                          totalWorkers, errorRate, errorThreshold }
 *
 * Every function MUST return a non-empty line so the rail never blanks.
 */

import { suggestWithinPool, formatBalanceReason } from './balance'

// ── severity helper ──────────────────────────────────────────────────
//
// Colors for green/yellow/red per user spec. `tier` strings match the
// ones used by C1 (mergeHealthVerdicts) so callers can pass them
// through without a second mapping layer.
export const NNR_TIER = Object.freeze({
  OK:       'ok',       // green
  WARN:     'warn',     // yellow
  ERR:      'err',      // red
  INFO:     'info',     // yellow-ish blue
})

function friendlyPoolName(name) {
  if (name === 'standard') return 'Standard pool'
  if (name === 'legacy')   return 'Legacy pool'
  return name ? `${name} pool` : 'pool'
}

// ── NOW ──────────────────────────────────────────────────────────────
//
// Priority (first match wins):
//   1. Any pool not balanced         → Degraded
//   2. Unhealthy containers           → Degraded
//   3. Recovery not optimal (off/assist/unknown/inactive) → Stable
//   4. Everything green               → Healthy
export function computeNow({ unifiedVerdict, balanceStatus, recoveryLabels }) {
  // 1. pool imbalance
  const imbalancedPool = (balanceStatus?.pools || []).find(p => !p.balanced)
  if (imbalancedPool) {
    const reasonText = (imbalancedPool.reasons || [])
      .map(r => `${r.container} ${r.delta > 0 ? `+${r.delta}` : r.delta}`)
      .join(', ') || 'outside ±1 of target'
    return {
      text: `System Degraded — ${friendlyPoolName(imbalancedPool.name)} not balanced (${reasonText})`,
      tier: NNR_TIER.WARN,
    }
  }
  // 2. unhealthy containers (from unified verdict)
  const uh = unifiedVerdict?.unhealthyCount ?? 0
  if (uh > 0) {
    return {
      text: `System Degraded — ${uh} container${uh > 1 ? 's' : ''} unhealthy (recovery engine)`,
      tier: NNR_TIER.WARN,
    }
  }
  // 3. recovery not optimal — INACTIVE / UNKNOWN / OFF / ASSIST / AUDIT
  const modeLabel = recoveryLabels?.modeLabel || 'UNKNOWN'
  if (modeLabel === 'SAFE') {
    return {
      text: 'System Healthy — All systems nominal',
      tier: NNR_TIER.OK,
    }
  }
  if (modeLabel === 'INACTIVE' || modeLabel === 'UNKNOWN') {
    return {
      text: `System Degraded — Recovery Mode ${modeLabel}`,
      tier: NNR_TIER.ERR,
    }
  }
  // ASSIST / AUDIT / OFF — system is stable but not fully autonomous
  return {
    text: `System Stable — Recovery Mode ${modeLabel}`,
    tier: NNR_TIER.INFO,
  }
}

// ── NEXT ─────────────────────────────────────────────────────────────
//
// Priority:
//   1. Pool imbalance → suggest within-pool move (or "blocked" if none)
//   2. Unhealthy containers → "Investigate"
//   3. Otherwise "No action needed"
//
// NEVER suggests cross-pool — we route through suggestWithinPool()
// whose contract is in-pool only.
export function computeNext({ balanceStatus, unifiedVerdict, blockers = [], counts = null, pools = null }) {
  const imbalancedPool = (balanceStatus?.pools || []).find(p => !p.balanced)
  if (imbalancedPool) {
    // Try a within-pool move suggestion.
    let suggestion = null
    if (counts && pools) {
      suggestion = suggestWithinPool({ counts, pools })
    }
    if (suggestion && suggestion.from != null && suggestion.to != null) {
      // Magnitude — moves required to reach pool BALANCE, not just
      // to drop under the +1 tolerance ceiling. Operators want "how
      // many to move to make this fully right" not "how many to
      // technically exit the red state".
      //
      // For a 2-container pool, moves = |from.delta|:
      //   C3=10, C4=6, target=8 → from.delta=+2 → 2 moves
      //   (After 2 moves: C3=8, C4=8, balanced.)
      // For multi-container pools it's still max(|from.delta|, |to.delta|)
      // since each move reduces both by exactly 1.
      const from = imbalancedPool.counts.find(c => c.group === suggestion.from)
      const to   = imbalancedPool.counts.find(c => c.group === suggestion.to)
      const fromDelta = from ? Math.abs(from.delta || 0) : 0
      const toDelta   = to   ? Math.abs(to.delta   || 0) : 0
      const n = Math.max(1, fromDelta, toDelta)
      return {
        text: `Rebalance ${n} user${n > 1 ? 's' : ''} from C${suggestion.from} → C${suggestion.to}`,
        tier: NNR_TIER.WARN,
      }
    }
    // Imbalance exists but no movable candidate (cooldown / pinned / manual)
    const reason = blockers.length ? blockers.join(', ') : 'cooldown/lock'
    return {
      text: `Rebalance blocked — no movable users (${reason})`,
      tier: NNR_TIER.ERR,
    }
  }
  const uh = unifiedVerdict?.unhealthyCount ?? 0
  if (uh > 0) {
    const offList = (unifiedVerdict?.offContainers || []).map(c => `C${c.group}`).join(', ')
    return {
      text: offList
        ? `Investigate ${offList} — recovery retries active`
        : `Investigate ${uh} unhealthy container${uh > 1 ? 's' : ''} — recovery retries active`,
      tier: NNR_TIER.WARN,
    }
  }
  return { text: 'No action needed', tier: NNR_TIER.OK }
}

// ── RISK ─────────────────────────────────────────────────────────────
//
// Three candidate formulas per user spec. Pick the highest ppm_loss.
// Round PPM to nearest integer. No vague / placeholder text allowed —
// if none of the three formulas yields a positive risk, emit the
// explicit "Low risk" line.
export function computeRisk({ metrics = {}, balanceStatus = null }) {
  const ppm   = Number(metrics.currentLivePpm) || 0
  const uh    = Number(metrics.unhealthyWorkers) || 0
  const tot   = Number(metrics.totalWorkers) || 0
  const er    = Number(metrics.errorRate) || 0
  const thr   = Number(metrics.errorThreshold ?? 0.03)

  const candidates = []

  // 1. Worker-loss risk
  if (tot > 0 && uh > 0 && ppm > 0) {
    const lostPct = uh / tot
    const loss = ppm * lostPct
    candidates.push({
      kind: 'worker-loss',
      ppmLoss: loss,
      text: `~${Math.round(loss)} PPM at risk from ${uh}/${tot} unhealthy workers`,
      tier: NNR_TIER.WARN,
    })
  }

  // 2. Pool imbalance risk — highest across pools
  if (balanceStatus && Array.isArray(balanceStatus.pools) && ppm > 0) {
    let worst = null
    for (const p of balanceStatus.pools) {
      const target = p.target ?? 0
      const excess = (p.counts || []).reduce((s, row) => {
        return s + Math.max(0, (row.count || 0) - (target + 1))
      }, 0)
      const poolTotal = p.total ?? 0
      if (excess === 0 || poolTotal === 0) continue
      const imbalancePct = excess / poolTotal
      const loss = ppm * imbalancePct * 0.5 // conservative penalty
      const entry = {
        poolName: p.name,
        excess,
        ppmLoss: loss,
      }
      if (!worst || entry.ppmLoss > worst.ppmLoss) worst = entry
    }
    if (worst) {
      candidates.push({
        kind: 'pool-imbalance',
        ppmLoss: worst.ppmLoss,
        text: `~${Math.round(worst.ppmLoss)} PPM efficiency risk from ${worst.excess} excess assignment${worst.excess > 1 ? 's' : ''} (${friendlyPoolName(worst.poolName).toLowerCase()})`,
        tier: NNR_TIER.WARN,
      })
    }
  }

  // 3. Error-rate risk
  if (er > thr && ppm > 0) {
    const loss = ppm * er
    candidates.push({
      kind: 'error-rate',
      ppmLoss: loss,
      text: `~${Math.round(loss)} PPM impacted by ${(er * 100).toFixed(1)}% error rate`,
      tier: NNR_TIER.WARN,
    })
  }

  if (candidates.length === 0) {
    return {
      text: 'Low risk — no material PPM impact detected',
      tier: NNR_TIER.OK,
    }
  }

  candidates.sort((a, b) => b.ppmLoss - a.ppmLoss)
  const top = candidates[0]
  // Bump tier to err when the loss is more than 25% of current PPM.
  if (ppm > 0 && top.ppmLoss / ppm >= 0.25) top.tier = NNR_TIER.ERR
  return top
}

// ── Convenience aggregator ───────────────────────────────────────────
//
// Single call returns { now, next, risk } — each `{text, tier}`. The
// rail component destructures and renders three cells.
export function computeNowNextRisk(args) {
  return {
    now:  computeNow(args),
    next: computeNext(args),
    risk: computeRisk(args),
  }
}
