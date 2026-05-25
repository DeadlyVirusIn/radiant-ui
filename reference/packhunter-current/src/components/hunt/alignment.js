/**
 * Pure alignment math for Hunt Monitor. Given per-container runtime pack
 * execution (what workers are opening) and user demand (who voted for
 * what in Bot Hub), produce:
 *
 *   alignment  ∈ [0..1]   fraction of runtime "opens" on packs that have
 *                          at least one user voting for them in that container
 *   status     'aligned' | 'partial' | 'mismatch'
 *   reason     short human string describing the top drag, or null
 *
 * No backend work. No IO. Same input → same output.
 */

export const ALIGNMENT_GREEN_MIN  = 0.90;
export const ALIGNMENT_YELLOW_MIN = 0.60;

// Normalize pack identifiers the same way RuntimePackExecution does —
// packLabel in stats files may be the display label or the identifier.
function normalize(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, '_').toUpperCase();
}

/**
 * Compute alignment for ONE container.
 *
 * @param {object} input
 * @param {Array<{isActive: bool, containerGroup, packLabel}>} input.instances
 * @param {number} input.group                                 container_group (1..4)
 * @param {{userCountByPack: Object}} [input.demand]           per-container demand row
 * @param {{mode: string, packs: string[]}} [input.cfg]        per-container pack config
 *
 * @returns {{
 *   group: number,
 *   alignment: number,             // 0..1
 *   status: 'aligned'|'partial'|'mismatch'|'no_data',
 *   activeWorkers: number,
 *   alignedWorkers: number,
 *   topDragPack: string|null,      // pack name wasting the most capacity
 *   topDragCount: number,
 *   reason: string|null,
 *   intentional: boolean,          // when cfg.intentional, alignment check skipped
 * }}
 */
export function computeContainerAlignment({ instances, group, demand, cfg } = {}) {
  const g = Number(group) || 0;
  const active = (instances || []).filter(i => i.isActive && Number(i.containerGroup) === g);
  const totalActive = active.length;

  if (totalActive === 0) {
    return {
      group: g, alignment: 1, status: 'no_data',
      activeWorkers: 0, alignedWorkers: 0,
      topDragPack: null, topDragCount: 0,
      reason: null, intentional: false,
    };
  }

  // Build the demand set — packs with ≥1 voting user in THIS container.
  const userCount = demand?.userCountByPack || {};
  const demandedSet = new Set(
    Object.entries(userCount)
      .filter(([, n]) => Number(n) > 0)
      .map(([name]) => normalize(name))
  );
  // When we have no demand data (e.g. zero users in the container), fall
  // back to the configured pack set — a worker opening a configured pack
  // with no voters is still "doing what the admin asked", so we don't
  // penalize it as mismatch. Configured set is the safety net.
  const configSet = new Set((cfg?.packs || []).map(normalize));
  const hasDemandSignal = demandedSet.size > 0;

  // Aggregate runtime open counts per normalized pack label.
  const runtimeCounts = new Map();
  for (const inst of active) {
    const label = normalize(inst.packLabel) || 'UNKNOWN';
    runtimeCounts.set(label, (runtimeCounts.get(label) || 0) + 1);
  }

  // Count aligned vs drag.
  let alignedWorkers = 0;
  let topDragPack = null, topDragCount = 0;
  for (const [label, count] of runtimeCounts) {
    const matchedByDemand = hasDemandSignal && demandedSet.has(label);
    const matchedByConfig = configSet.has(label);
    const aligned = hasDemandSignal ? matchedByDemand : matchedByConfig;
    if (aligned) {
      alignedWorkers += count;
    } else if (count > topDragCount) {
      topDragCount = count;
      topDragPack = label;
    }
  }

  const alignment = totalActive > 0 ? alignedWorkers / totalActive : 1;
  let status = 'aligned';
  if (alignment < ALIGNMENT_YELLOW_MIN) status = 'mismatch';
  else if (alignment < ALIGNMENT_GREEN_MIN) status = 'partial';

  // Short reason for yellow/red. When hasDemandSignal=false, the drag
  // is against config (which admin explicitly set), so reason shifts.
  let reason = null;
  if (status !== 'aligned' && topDragPack) {
    const wastedPct = Math.round((topDragCount / totalActive) * 100);
    if (hasDemandSignal) {
      reason = `${wastedPct}% of workers opening ${topDragPack.replace(/_/g, ' ')} — no user demand in C${g}`;
    } else {
      reason = `${wastedPct}% of workers opening ${topDragPack.replace(/_/g, ' ')} — not in C${g} config`;
    }
  }

  return {
    group: g, alignment, status,
    activeWorkers: totalActive,
    alignedWorkers,
    topDragPack, topDragCount,
    reason,
    intentional: false,
  };
}

/**
 * Fleet rollup: array of per-container alignment rows → { aligned, total,
 * wastedPct, averageAlignment }.
 *
 * wastedPct is a WORKER-WEIGHTED estimate so a 30-worker container with
 * 50% alignment weighs more than a 2-worker one with 100% alignment.
 */
export function rollupFleetAlignment(rows) {
  const rendered = (rows || []).filter(r => r.status !== 'no_data');
  if (rendered.length === 0) {
    return { aligned: 0, total: 0, wastedPct: 0, averageAlignment: 1 };
  }
  const aligned = rendered.filter(r => r.status === 'aligned').length;
  const total = rendered.length;
  const weightedActive = rendered.reduce((s, r) => s + r.activeWorkers, 0);
  const weightedAligned = rendered.reduce((s, r) => s + r.alignedWorkers, 0);
  const wastedPct = weightedActive > 0
    ? Math.round(((weightedActive - weightedAligned) / weightedActive) * 100)
    : 0;
  const averageAlignment = weightedActive > 0
    ? weightedAligned / weightedActive
    : 1;
  return { aligned, total, wastedPct, averageAlignment };
}

export function statusColor(status, theme) {
  if (status === 'aligned')  return '#4caf50'; // green
  if (status === 'partial')  return '#fbbf24'; // yellow
  if (status === 'mismatch') return '#ef5350'; // red
  return theme?.palette?.text?.secondary || '#94a3b8';
}

export function statusLabel(status) {
  if (status === 'aligned')  return 'Aligned';
  if (status === 'partial')  return 'Partial';
  if (status === 'mismatch') return 'Mismatch';
  return 'No data';
}

/**
 * Suggest swaps for a container based on runtime + demand + current cfg.
 *
 * Pure: same input → same output. Caller decides whether to render the
 * suggestion or apply it via PUT /api/admin/container-pack-config/:group.
 *
 * Strategy:
 *   1. Drags = configured packs that workers ARE opening but have ZERO
 *      voting users in this container. These waste capacity.
 *   2. Candidates = packs with the most voting users in this container
 *      that AREN'T already in the configured list.
 *   3. Pair: each drag → highest-user candidate, sorted by impact
 *      (drag's runtime count desc, then candidate users desc).
 *
 * Returns: Array<{
 *   from: string,        // pack to drop (in current config, no users)
 *   to: string,          // pack to add (top demand, not in config)
 *   users: number,       // how many users want `to`
 *   runtimeCount: number // how many workers are wasting capacity on `from`
 * }>
 *
 * Empty array when:
 *   - cfg is null (legacy fallback — nothing to swap)
 *   - no drag packs (all configured packs have demand)
 *   - no candidate packs (all demanded packs already in config)
 */
export function suggestReplacements({ instances, group, demand, cfg } = {}) {
  const g = Number(group) || 0;
  if (!cfg || !cfg.mode) return [];

  const userCount = demand?.userCountByPack || {};
  // Demand sorted desc by user count, with normalized names.
  const demandSorted = Object.entries(userCount)
    .map(([name, n]) => ({ name: normalize(name), users: Number(n) || 0 }))
    .filter(d => d.users > 0)
    .sort((a, b) => b.users - a.users);

  const configuredSet = new Set((cfg.packs || []).map(normalize));

  // Aggregate runtime opens per pack for THIS container.
  const active = (instances || []).filter(i => i.isActive && Number(i.containerGroup) === g);
  const runtimeCounts = new Map();
  for (const inst of active) {
    const label = normalize(inst.packLabel) || 'UNKNOWN';
    runtimeCounts.set(label, (runtimeCounts.get(label) || 0) + 1);
  }

  // Drags: configured + currently opened + zero users.
  const drags = [];
  for (const [label, count] of runtimeCounts) {
    if (configuredSet.has(label) && (Number(userCount[label]) || 0) === 0) {
      drags.push({ pack: label, runtimeCount: count });
    }
  }
  drags.sort((a, b) => b.runtimeCount - a.runtimeCount);

  // Candidates: top-demand packs not yet in config.
  const candidates = demandSorted.filter(d => !configuredSet.has(d.name));

  // Pair until we run out of either side. For fixed-mode containers,
  // there's at most 1 configured pack and 1 swap.
  const swaps = [];
  const maxSwaps = cfg.mode === 'fixed' ? 1 : Math.min(drags.length, candidates.length);
  for (let i = 0; i < maxSwaps && i < drags.length && i < candidates.length; i++) {
    swaps.push({
      from: drags[i].pack,
      to: candidates[i].name,
      users: candidates[i].users,
      runtimeCount: drags[i].runtimeCount,
    });
  }
  return swaps;
}

/**
 * Project what container alignment WILL be if a set of swaps is applied.
 *
 * Model: each active worker currently opening a `from` pack would, after
 * the swap, be opening the `to` pack instead. This is the exact naive
 * operator mental model ("replace BLAZIKEN with ALTARIA → those rolls
 * become ALTARIA rolls") and matches what actually happens on the next
 * batch for fixed mode. For pool mode it's a conservative approximation —
 * actual runtime redistributes uniformly across the new pool, but for
 * impact-preview purposes swapping 1-for-1 gives a tight bound.
 *
 * Returns a FULL alignment row (same shape as computeContainerAlignment)
 * so callers can diff current vs projected:
 *   { alignment, status, wastedCapacity, activeWorkers, … }
 *
 * Pure. No IO.
 */
export function simulateAlignmentAfterSwaps({ instances, group, demand, cfg, swaps } = {}) {
  if (!Array.isArray(swaps) || swaps.length === 0) {
    return computeContainerAlignment({ instances, group, demand, cfg });
  }
  const g = Number(group) || 0;
  const swapMap = new Map();
  for (const s of swaps) swapMap.set(normalize(s.from), s.to);

  // Rewrite packLabel for active workers in THIS container whose current
  // pack matches a swap's `from`. Non-matching instances pass through.
  const simulatedInstances = (instances || []).map(inst => {
    if (Number(inst.containerGroup) !== g || !inst.isActive) return inst;
    const label = normalize(inst.packLabel);
    if (swapMap.has(label)) return { ...inst, packLabel: swapMap.get(label) };
    return inst;
  });

  // Config with swaps baked in so the "fallback to config" path inside
  // computeContainerAlignment (used when there's no demand signal) also
  // sees the post-swap state.
  const simulatedCfg = cfg ? { ...cfg, packs: applySwapsToPacks(cfg.packs || [], swaps) } : cfg;

  return computeContainerAlignment({
    instances: simulatedInstances,
    group: g,
    demand,
    cfg: simulatedCfg,
  });
}

/**
 * Convenience projection: given the current + simulated alignment rows,
 * return a compact impact-preview object ready for UI rendering.
 * Both alignment and wastedPct are 0..100 INTEGERS for display.
 */
export function projectImpact(current, simulated) {
  const curA = Math.round((current?.alignment ?? 0) * 100);
  const simA = Math.round((simulated?.alignment ?? 0) * 100);
  return {
    currentAlignmentPct:  curA,
    expectedAlignmentPct: simA,
    alignmentDelta:       simA - curA,
    currentWastedPct:     Math.max(0, 100 - curA),
    expectedWastedPct:    Math.max(0, 100 - simA),
    wastedDelta:          Math.max(0, 100 - curA) - Math.max(0, 100 - simA),
  };
}

/**
 * Apply a list of swaps to a config's pack list. Pure — returns the new
 * pack array. Caller does the PUT. Preserves order: replaces in-place.
 */
export function applySwapsToPacks(packs, swaps) {
  if (!Array.isArray(packs) || !Array.isArray(swaps) || swaps.length === 0) {
    return Array.isArray(packs) ? packs.slice() : [];
  }
  const next = packs.slice();
  for (const s of swaps) {
    const fromN = normalize(s.from);
    const idx = next.findIndex(p => normalize(p) === fromN);
    if (idx >= 0) next[idx] = s.to;
  }
  // Dedupe (in case a swap target was already in the list)
  const seen = new Set();
  return next.filter(p => {
    const n = normalize(p);
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}
