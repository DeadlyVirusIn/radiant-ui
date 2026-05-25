/**
 * Frontend mirror of lib/balance.js — same algorithm, ESM import
 * surface so React components can consume it without a backend proxy.
 *
 * 2026-04-24 (admin-ui-coherence C3) — both files enforce the strict
 * balance rule:
 *   target  = floor(total_users / participating_containers)
 *   balanced iff |count - target| <= 1 for EVERY participating container
 *
 * tests/balanceStrict.test.js pins the contract: any input yields
 * identical output from both modules. Do NOT change the algorithm in
 * only one place — sync the other.
 */

/**
 * @param {object} opts
 * @param {object} opts.counts  — { [group]: number }
 * @param {Array<number|string>} opts.groups — participating container IDs
 * @returns {{
 *   balanced: boolean,
 *   target: number, total: number, n: number,
 *   counts: Array<{group, count, delta}>,
 *   reasons: Array<{container, count, target, delta}>,
 * }}
 */
export function computeBalance({ counts, groups }) {
  const participating = Array.isArray(groups) ? groups : []
  const rows = participating.map(g => ({
    group:  g,
    count:  Number(counts?.[g] ?? counts?.[String(g)] ?? 0) || 0,
  }))
  const n = rows.length
  if (n === 0) {
    return { balanced: true, target: 0, total: 0, n: 0, counts: [], reasons: [] }
  }
  const total = rows.reduce((s, r) => s + r.count, 0)
  const target = Math.floor(total / n)
  const withDelta = rows.map(r => ({ ...r, delta: r.count - target }))
  const reasons = []
  for (const r of withDelta) {
    if (Math.abs(r.delta) > 1) {
      reasons.push({
        container: `C${r.group}`,
        count: r.count,
        target,
        delta: r.delta,
      })
    }
  }
  return {
    balanced: reasons.length === 0,
    target,
    total,
    n,
    counts: withDelta,
    reasons,
  }
}

/** Same reason phrase as backend (must stay in sync with lib/balance.js). */
export function formatBalanceReason(r) {
  if (!r) return ''
  const sign = r.delta > 0 ? `+${r.delta}` : `${r.delta}`
  const verb = r.delta > 0 ? 'exceeds target by' : 'under target by'
  return `${r.container} ${verb} ${sign}`
}

// C3 follow-up (2026-04-24) — pool-aware aggregate. Pools carry their
// own balance decision; overall balanced iff every pool is balanced.
// See lib/balance.js for the authoritative doc.
export function computeBalanceByPools({ counts, pools }) {
  const poolList = Array.isArray(pools) ? pools : []
  const poolResults = poolList.map(p => {
    const r = computeBalance({ counts, groups: p.groups })
    const row = r.counts
    const imbalance = row.length > 0
      ? Math.max(...row.map(x => x.count)) - Math.min(...row.map(x => x.count))
      : 0
    return {
      name: p.name,
      groups: p.groups.slice(),
      balanced: r.balanced,
      target: r.target,
      total: r.total,
      n: r.n,
      counts: r.counts,
      reasons: r.reasons,
      imbalance,
    }
  })
  const allBalanced = poolResults.every(p => p.balanced)
  const allReasons = poolResults.flatMap(p =>
    p.reasons.map(rr => ({ ...rr, pool: p.name }))
  )
  const maxPoolImbalance = poolResults.reduce((m, p) => Math.max(m, p.imbalance), 0)
  return {
    balanced: allBalanced,
    pools: poolResults,
    reasons: allReasons,
    imbalance: maxPoolImbalance,
  }
}

export function suggestWithinPool({ counts, pools }) {
  const byPools = computeBalanceByPools({ counts, pools })
  const unbalanced = byPools.pools.filter(p => !p.balanced)
  if (unbalanced.length === 0) return null
  unbalanced.sort((a, b) => {
    const aMax = Math.max(...a.counts.map(c => Math.abs(c.delta || 0)))
    const bMax = Math.max(...b.counts.map(c => Math.abs(c.delta || 0)))
    return bMax - aMax
  })
  const target = unbalanced[0]
  const sorted = target.counts.slice().sort((a, b) => b.count - a.count)
  const from = sorted[0]
  const to = sorted[sorted.length - 1]
  if (from.count - to.count <= 0) return null
  const projected = Math.max(from.count - 1, to.count + 1)
                  - Math.min(from.count - 1, to.count + 1)
  return {
    pool: target.name,
    from: from.group,
    to:   to.group,
    fromCount: from.count,
    toCount:   to.count,
    currentImbalance:   target.imbalance,
    projectedImbalance: projected,
  }
}
