/**
 * Phase 34 — Normalized Mission Schema layer.
 *
 * Translates raw mission.json entries (with evaluation_mode +
 * operator labels) into a uniform internal shape that every
 * downstream consumer (evaluator, UI, debug panel, drift detector)
 * can rely on without re-deriving requirement math.
 *
 * NOTE: This is a pure translation layer. It does NOT modify the
 * underlying missions.json and it does NOT change evaluator/UI
 * behavior. Existing callers continue to work on the raw mission;
 * new callers opt in by calling normalizeMissionDefinition().
 *
 * Normalized shape:
 * {
 *   missionId,
 *   missionName,
 *   type: 'AND' | 'OR' | 'SLOT' | 'COUNT' | 'UNKNOWN',
 *   requiredCount,    // total distinct cards (or quota for COUNT)
 *   slots:  [{ operator, cards: [...], satisfiedBy: null|cardId|null-array }]
 *   pool:   [...cardId],        // for COUNT missions
 *   quota:  number | null,      // for COUNT missions
 *   groups: [...original groups],   // raw passthrough for debug
 *   requirementPattern,         // _requirement_pattern if present
 *   verificationStatus,         // _verification_status if present
 *   source,                     // _source if present
 * }
 */

'use strict'

/**
 * Classify the mission type from its raw definition. Single source
 * of truth for the mission-shape taxonomy.
 */
export function classifyMissionType(mission) {
  const mode = mission?.evaluation_mode || 'grouped_cards'

  if (mode === 'quota_from_pool' || mode === 'quota_duplicates') {
    return 'COUNT'
  }
  if (mode === 'hybrid') {
    // Hybrid combines grouped + quota. Treat as SLOT with
    // quota-augmentation at the consumer layer.
    return 'SLOT'
  }
  if (mode === 'special_noncard' || mode === 'unknown') {
    return 'UNKNOWN'
  }

  // grouped_cards / collect_all
  const groups = mission?.groups || []
  if (groups.length === 0) return 'UNKNOWN'
  if (groups.length > 1) return 'SLOT'

  // Single group — distinguish AND vs OR by operator.
  const op = groups[0].operator
  if (op === 'AND' || op === 'AND_SINGLE') return 'AND'
  if (op === 'OR') return 'OR'
  // Missing/unknown operator falls back to OR per evaluator legacy.
  return 'OR'
}

/**
 * Normalize a mission to the uniform internal shape.
 * Pure function — never mutates input.
 */
export function normalizeMissionDefinition(mission) {
  if (!mission || typeof mission !== 'object') {
    return {
      missionId: null, missionName: null,
      type: 'UNKNOWN', requiredCount: 0,
      slots: [], pool: [], quota: null,
      groups: [],
      requirementPattern: null, verificationStatus: null, source: null,
    }
  }

  const type = classifyMissionType(mission)
  const groups = Array.isArray(mission.groups) ? mission.groups : []
  const base = {
    missionId: mission.id || null,
    missionName: mission.mission_name || null,
    type,
    requiredCount: 0,
    slots: [],
    pool: [],
    quota: null,
    groups,
    requirementPattern: mission._requirement_pattern || null,
    verificationStatus: mission._verification_status || null,
    source: mission._source || null,
  }

  if (type === 'COUNT') {
    const quota = mission.quota_required || 1
    const pool = Array.isArray(mission.eligible_cards) && mission.eligible_cards.length > 0
      ? [...mission.eligible_cards]
      : [...new Set(groups.flatMap(g => g.cards || []))]
    return {
      ...base,
      requiredCount: quota,
      pool,
      quota,
      slots: [],
    }
  }

  if (type === 'UNKNOWN') {
    return base
  }

  // AND / OR / SLOT — slot model is the superset. AND and OR become
  // single-slot special cases.
  const slots = groups.map(g => ({
    operator: g.operator || 'OR',
    cards: Array.isArray(g.cards) ? [...g.cards] : [],
    lookupName: g.lookup_name || null,
  }))

  // requiredCount = total distinct cards across all slots.
  const distinctCards = new Set(slots.flatMap(s => s.cards))
  return {
    ...base,
    slots,
    requiredCount: distinctCards.size,
    pool: [],
  }
}

/**
 * Compute ownedCount against a per-account ownership map using the
 * normalized definition. Symmetric counterpart of requiredCount so
 * callers can display `{owned}/{required}` consistently.
 */
export function computeOwnedCount(normalized, ownership) {
  if (!normalized || !ownership) return 0
  const own = (id) => (ownership[id] || 0) > 0
  const copies = (id) => (ownership[id] || 0)

  if (normalized.type === 'COUNT') {
    const total = (normalized.pool || []).reduce((s, id) => s + copies(id), 0)
    return Math.min(total, normalized.quota || 0)
  }
  if (normalized.type === 'UNKNOWN') return 0

  // AND / OR / SLOT — count distinct owned cards across all slots.
  const distinct = new Set((normalized.slots || []).flatMap(s => s.cards))
  let owned = 0
  for (const id of distinct) if (own(id)) owned++
  return owned
}

/**
 * Compute isComplete against ownership using the normalized shape.
 * Mirrors evaluator semantics:
 *   AND  → every card owned
 *   OR   → any card owned
 *   SLOT → every slot satisfied (AND slot: every card; OR slot: any)
 *   COUNT → total owned copies in pool >= quota
 */
export function computeIsComplete(normalized, ownership) {
  if (!normalized || !ownership) return false
  const own = (id) => (ownership[id] || 0) > 0
  const copies = (id) => (ownership[id] || 0)
  const slotSatisfied = (slot) => {
    if (slot.operator === 'AND' || slot.operator === 'AND_SINGLE') {
      return slot.cards.every(own)
    }
    return slot.cards.some(own)
  }

  switch (normalized.type) {
    case 'UNKNOWN': return false
    case 'COUNT': {
      const total = (normalized.pool || []).reduce((s, id) => s + copies(id), 0)
      return total >= (normalized.quota || 1)
    }
    case 'AND':
    case 'OR':
    case 'SLOT':
      return (normalized.slots || []).every(slotSatisfied)
    default:
      return false
  }
}

/**
 * Per-slot satisfaction detail — useful for the debug panel.
 */
export function computeSlotBreakdown(normalized, ownership) {
  if (!normalized || normalized.type === 'COUNT' || normalized.type === 'UNKNOWN') return []
  return (normalized.slots || []).map((slot, idx) => {
    const ownedCards = slot.cards.filter(id => (ownership?.[id] || 0) > 0)
    const satisfied = slot.operator === 'AND' || slot.operator === 'AND_SINGLE'
      ? ownedCards.length === slot.cards.length
      : ownedCards.length > 0
    return {
      index: idx,
      operator: slot.operator,
      lookupName: slot.lookupName,
      cards: slot.cards,
      ownedCards,
      missingCards: slot.cards.filter(id => !(ownership?.[id] > 0)),
      satisfied,
    }
  })
}

/**
 * Phase 35 — derive canonical targets[] from a raw mission definition.
 * Twin of lib/missionSchema.js. See CJS twin for full docstring.
 */
export function deriveTargets(mission) {
  if (!mission) return []
  if (Array.isArray(mission.targets) && mission.targets.length > 0) {
    return mission.targets.map(t => ({
      eligibleIds: Array.isArray(t.eligibleIds) ? [...t.eligibleIds] : [],
      amount: t.amount || 1,
      noDupe: t.noDupe !== undefined ? !!t.noDupe : true,
    }))
  }
  const mode = mission.evaluation_mode || 'grouped_cards'
  if (mode === 'quota_from_pool' || mode === 'quota_duplicates') {
    const quota = mission.quota_required || 1
    const pool = Array.isArray(mission.eligible_cards) && mission.eligible_cards.length > 0
      ? [...mission.eligible_cards]
      : [...new Set((mission.groups || []).flatMap(g => g.cards || []))]
    return [{ eligibleIds: pool, amount: quota, noDupe: false }]
  }
  if (mode === 'special_noncard' || mode === 'unknown') return []
  const targets = []
  for (const g of (mission.groups || [])) {
    const cards = Array.isArray(g.cards) ? g.cards : []
    if (cards.length === 0) continue
    if (g.operator === 'AND' || g.operator === 'AND_SINGLE') {
      for (const c of cards) targets.push({ eligibleIds: [c], amount: 1, noDupe: true })
    } else {
      targets.push({ eligibleIds: [...cards], amount: 1, noDupe: true })
    }
  }
  return targets
}

/** Phase 35 — evaluate one target against ownership. */
export function evaluateTarget(target, ownership) {
  if (!target || !Array.isArray(target.eligibleIds)) return false
  const total = target.eligibleIds.reduce((s, id) => s + ((ownership && ownership[id]) || 0), 0)
  return total >= (target.amount || 1)
}

/** Phase 35 — canonical game-model evaluation. */
export function evaluateWithTargets(mission, ownership) {
  const targets = deriveTargets(mission)
  const satisfiedFlags = targets.map(t => evaluateTarget(t, ownership))
  const ownedCount = satisfiedFlags.filter(Boolean).length
  const requiredCount = targets.length
  return {
    targets,
    targetsSatisfied: satisfiedFlags,
    requiredCount,
    ownedCount,
    remaining: Math.max(0, requiredCount - ownedCount),
    isComplete: requiredCount > 0 && ownedCount >= requiredCount,
  }
}

/**
 * One-shot accessor producing the full normalized + evaluated view.
 * Phase 35 — now target-driven. requiredCount = targets.length.
 */
export function getNormalizedView(mission, ownership) {
  const normalized = normalizeMissionDefinition(mission)
  const te = evaluateWithTargets(mission, ownership)
  const slotBreakdown = computeSlotBreakdown(normalized, ownership)
  const progressRatio = te.requiredCount > 0
    ? Math.min(te.ownedCount / te.requiredCount, 1) : 0
  return {
    ...normalized,
    // Phase 35 overrides — canonical game-model.
    requiredCount: te.requiredCount,
    ownedCount: te.ownedCount,
    remaining: te.remaining,
    isComplete: te.isComplete,
    targets: te.targets,
    targetsSatisfied: te.targetsSatisfied,
    progressRatio,
    slotBreakdown,
  }
}
