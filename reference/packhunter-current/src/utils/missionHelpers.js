/**
 * Shared mission evaluation helpers — used by Tracker sidebar + Missions page
 */

import { deriveTargets, evaluateTarget } from './missionSchema'

// Rarities eligible for gifting (game rule: 1D-4D only)
export const GIFTABLE_RARITIES = ['C', 'U', 'R', 'RR']

// Rarities that cannot be traded (game rule)
const NON_TRADABLE_RARITIES = new Set(['UR', 'IM'])

/**
 * Check if a card is tradeable based on rarity, promo status, and set code
 */
export function isCardTradable(card) {
  if (!card?.rarity_code) return false
  if (NON_TRADABLE_RARITIES.has(card.rarity_code)) return false
  if (card.is_promo === 1) return false
  if (card.set_code?.startsWith('PROMO')) return false
  return true
}

/**
 * Check if a requirement group is satisfied.
 *
 * Phase 32 — honor the group.operator field. Prior to Phase 32 the
 * evaluator ignored operator entirely and treated every group as OR
 * (cards.some), which meant the system could not express
 * "own BOTH variants" requirements (e.g. Mega Shine Immersive
 * Experience B2B_346 required both B2B-085 and B2B-086 Mew immersives
 * per Bulbapedia, but the code counted owning either as complete).
 *
 * Supported operators:
 *   - "OR"          → any card in group owned satisfies (group.cards.some)
 *   - "AND"         → ALL cards in group must be owned (group.cards.every)
 *   - "AND_SINGLE"  → single-card group; every() and some() are equivalent
 *                      for 1 card, so AND_SINGLE is kept for label clarity
 *                      without needing a separate branch.
 *   - missing / unknown → fall back to OR (legacy behavior preserved so
 *                         untagged groups in missions.json don't regress).
 *
 * NOTE: AND_SINGLE is handled by the AND branch (every() on a 1-element
 * array is identical to some()). Missions that were declared AND_SINGLE
 * but historically populated with multiple cards (data bug class) will
 * now REGRESS to "all required" — the intended behavior per the label.
 * The data audit in Phase 32 verified no such cases exist.
 */
export function isGroupSatisfied(group, ownership) {
  const op = group?.operator
  if (op === 'AND' || op === 'AND_SINGLE') {
    return group.cards.every(id => (ownership?.[id] || 0) > 0)
  }
  // OR and legacy/untagged fall through to permissive "any"
  return group.cards.some(id => (ownership?.[id] || 0) > 0)
}

/**
 * Evaluate a mission's completion status against an ownership map.
 * Supports multiple evaluation modes from Bulbapedia:
 *   - grouped_cards / collect_all: group-based boolean satisfaction
 *   - quota_from_pool: need N copies from eligible card pool (duplicates count)
 *   - quota_duplicates: need N copies of one specific card
 *   - special_noncard / unknown: not evaluable
 *
 * Returns: { totalGroups, satisfiedGroups, unsatisfiedGroups, progressRatio, isComplete,
 *            quotaRequired?, quotaOwned?, quotaMode? }
 */
export function evaluateMission(mission, ownership) {
  const mode = mission.evaluation_mode || 'grouped_cards'

  // Quota-based modes: count total owned copies from eligible pool
  if (mode === 'quota_from_pool' || mode === 'quota_duplicates') {
    const quota = mission.quota_required || 1
    const pool = mission.eligible_cards || getAllCardsFromGroups(mission.groups)
    const totalOwned = pool.reduce((sum, id) => sum + (ownership?.[id] || 0), 0)
    const missing = Math.max(0, quota - totalOwned)
    return {
      totalGroups: quota,
      satisfiedGroups: Math.min(totalOwned, quota),
      unsatisfiedGroups: missing,
      progressRatio: quota > 0 ? Math.min(totalOwned / quota, 1) : 0,
      isComplete: totalOwned >= quota,
      quotaMode: true,
      quotaRequired: quota,
      quotaOwned: totalOwned,
      // Phase 33 — UI truth layer. ownedCount / requiredCount drive
      // the displayed "X/Y" label and progress bar, decoupled from the
      // group-level operator/slot completion logic. For quota missions
      // these are the quota count.
      requiredCount: quota,
      ownedCount:    Math.min(totalOwned, quota),
    }
  }

  // Hybrid mode: some groups are grouped_cards + a quota pool
  if (mode === 'hybrid') {
    // Evaluate grouped portion
    const totalGrouped = mission.groups?.length || 0
    const satisfiedGrouped = (mission.groups || []).filter(g => isGroupSatisfied(g, ownership)).length
    const unsatisfiedGrouped = totalGrouped - satisfiedGrouped

    // Evaluate quota portion (if present)
    const quota = mission.quota_required || 0
    const pool = mission.eligible_cards || []
    const quotaOwned = pool.reduce((sum, id) => sum + (ownership?.[id] || 0), 0)
    const quotaSatisfied = quota > 0 ? Math.min(quotaOwned, quota) : 0
    const quotaMissing = Math.max(0, quota - quotaOwned)

    // Combined: all groups must be satisfied AND quota must be met
    const totalReqs = totalGrouped + (quota > 0 ? 1 : 0)
    const satisfiedReqs = satisfiedGrouped + (quotaMissing === 0 ? 1 : 0)
    const unsatisfiedReqs = totalReqs - satisfiedReqs

    // Phase 33 display counts: sum of distinct grouped cards + quota.
    const groupedCardsAll = [...new Set((mission.groups || []).flatMap(g => g.cards || []))]
    const groupedOwned    = groupedCardsAll.filter(id => (ownership?.[id] || 0) > 0).length
    return {
      totalGroups: totalReqs,
      satisfiedGroups: satisfiedReqs,
      unsatisfiedGroups: unsatisfiedReqs,
      progressRatio: totalReqs > 0 ? satisfiedReqs / totalReqs : 0,
      isComplete: unsatisfiedReqs === 0,
      hybridMode: true,
      groupedSatisfied: satisfiedGrouped,
      groupedTotal: totalGrouped,
      quotaRequired: quota,
      quotaOwned,
      quotaMissing,
      requiredCount: groupedCardsAll.length + quota,
      ownedCount:    groupedOwned + Math.min(quotaOwned, quota),
    }
  }

  // Special / unknown: not evaluable
  if (mode === 'special_noncard' || mode === 'unknown') {
    return {
      totalGroups: 0, satisfiedGroups: 0, unsatisfiedGroups: 0,
      progressRatio: 0, isComplete: false,
      requiredCount: 0, ownedCount: 0,
    }
  }

  // Default: grouped_cards / collect_all — group-based evaluation.
  //
  // Supported requirement patterns (no extra modes needed — the group
  // array is the cross-group AND and each group's operator controls
  // the within-group check):
  //
  //   1. ALL cards required         → single group, operator='AND'
  //   2. ANY card required          → single group, operator='OR'
  //   3. Slot-based (AND across     → multiple groups, each with
  //      slots, OR within slot)       operator='OR' (or 'AND' for
  //                                    single-card slots). Mission
  //                                    completes only when EVERY slot
  //                                    has a satisfying card. Example:
  //                                    A3B_169 Eevee Museum =
  //                                      Slot 1: OR [#055, #078, #092]
  //                                      Slot 2: OR [#056, #083]
  //                                    owning one card from each slot
  //                                    satisfies the mission.
  //
  // Do NOT collapse slot-based missions into a single OR group — that
  // would let owning one card from any slot satisfy the mission.
  const totalGroups = mission.groups?.length || 0
  const satisfiedGroups = (mission.groups || []).filter(g => isGroupSatisfied(g, ownership)).length
  const unsatisfiedGroups = totalGroups - satisfiedGroups

  // Phase 35 — canonical targets[] game model. Replaces Phase 33's
  // distinct-cards display with the game's actual slot-count model:
  //
  //   targets = deriveTargets(mission)
  //   requiredCount = targets.length
  //   ownedCount    = targets.filter(satisfied).length
  //   isComplete    = ownedCount >= requiredCount
  //
  // Derivation (when mission has no explicit targets[]):
  //   AND / AND_SINGLE group → 1 target per card (each card required)
  //   OR group               → 1 target with all cards as alternatives
  //
  // Effect on user-visible displays:
  //   1-AND-group museums (e.g. Mew ex Museum, 4 cards) → X/4 (same as Phase 33)
  //   Slot-based missions (e.g. Eevee Museum, 2 OR slots) → X/2 (was X/5)
  //   A Swarm of Bug Pokémon (11 groups) → X/11 (was X/14)
  // This matches the game's in-client "X/Y" label verbatim.
  //
  // Completion logic now derives from target satisfaction, not
  // group satisfaction — fixes the reported "missions disappear on
  // ALT" class because each target is evaluated against per-account
  // ownership independently.
  const targets = deriveTargets(mission)
  const targetSatisfied = targets.map(t => evaluateTarget(t, ownership || {}))
  const ownedCount = targetSatisfied.filter(Boolean).length
  const requiredCount = targets.length

  // 2026-04-24 — secondary "listed card coverage" counters. Phase 35's
  // requiredCount/ownedCount matches the game's in-client X/Y label
  // (groups/slots), but for OR-heavy missions like B2A_330 "Trainers of
  // Paldea" (5 groups × 2-3 alternatives = 11 listed cards), the user
  // cannot tell from X/Y how many distinct cards are still missing.
  // cardEntriesTotal / cardEntriesOwned give the flat card-level
  // coverage as an UI-only clarity signal. Evaluator semantics,
  // isComplete, progressRatio are UNCHANGED.
  const cardEntriesTotal = (mission.groups || []).reduce(
    (sum, g) => sum + (Array.isArray(g.cards) ? g.cards.length : 0), 0)
  const cardEntriesOwned = (mission.groups || []).reduce(
    (sum, g) => sum + (Array.isArray(g.cards)
      ? g.cards.filter(id => (ownership?.[id] || 0) > 0).length
      : 0), 0)

  return {
    // Phase 35 — legacy group-level counters kept for backward compat
    // with sorting (mission.unsatisfiedGroups) + chip text. The
    // authoritative values are requiredCount / ownedCount below.
    totalGroups,
    satisfiedGroups,
    unsatisfiedGroups,
    progressRatio: requiredCount > 0 ? ownedCount / requiredCount : 0,
    // isComplete now driven by target satisfaction (slot-count model).
    isComplete: requiredCount > 0 && ownedCount >= requiredCount,
    requiredCount,
    ownedCount,
    remaining: Math.max(0, requiredCount - ownedCount),
    targets,
    targetsSatisfied: targetSatisfied,
    // Secondary UI clarity signal (UI-only, not used by evaluator logic)
    cardEntriesTotal,
    cardEntriesOwned,
  }
}

// Helper: extract all card IDs from groups (for quota fallback)
function getAllCardsFromGroups(groups) {
  if (!groups) return []
  const ids = new Set()
  groups.forEach(g => g.cards?.forEach(id => ids.add(id)))
  return [...ids]
}

/**
 * Get unsatisfied requirements for ANY mission mode.
 * This is the ONLY correct way to compute "what's missing" for a mission.
 * Do NOT use isGroupSatisfied() directly for this purpose.
 *
 * For grouped_cards/collect_all: returns unsatisfied group objects
 * For quota: returns { quotaMode: true, quotaMissing, eligibleCards, quotaRequired, quotaOwned }
 * For hybrid: returns { hybridMode: true, unsatisfiedGroups: [...], quotaMissing, ... }
 */
export function getUnsatisfiedRequirements(mission, ownership) {
  const mode = mission.evaluation_mode || 'grouped_cards'

  if (mode === 'quota_from_pool' || mode === 'quota_duplicates') {
    const quota = mission.quota_required || 1
    const pool = mission.eligible_cards || getAllCardsFromGroups(mission.groups)
    const totalOwned = pool.reduce((sum, id) => sum + (ownership?.[id] || 0), 0)
    const missing = Math.max(0, quota - totalOwned)
    return {
      quotaMode: true,
      isComplete: totalOwned >= quota,
      quotaMissing: missing,
      quotaRequired: quota,
      quotaOwned: totalOwned,
      eligibleCards: pool,
      // For card-detail fetching: return cards user doesn't own from pool
      missingCardIds: pool.filter(id => !(ownership?.[id] > 0)),
      // Empty groups array for compatibility with grouped render paths
      unsatisfiedGroups: [],
    }
  }

  if (mode === 'hybrid') {
    const unsatisfiedGroups = (mission.groups || []).filter(g => !isGroupSatisfied(g, ownership))
    const quota = mission.quota_required || 0
    const pool = mission.eligible_cards || []
    const quotaOwned = pool.reduce((sum, id) => sum + (ownership?.[id] || 0), 0)
    const quotaMissing = Math.max(0, quota - quotaOwned)
    const allSatisfied = unsatisfiedGroups.length === 0 && quotaMissing === 0
    return {
      hybridMode: true,
      isComplete: allSatisfied,
      unsatisfiedGroups,
      quotaMissing,
      quotaRequired: quota,
      quotaOwned,
      eligibleCards: pool,
      missingCardIds: [
        ...new Set([
          ...unsatisfiedGroups.flatMap(g => g.cards.filter(id => !(ownership?.[id] > 0))),
          ...pool.filter(id => !(ownership?.[id] > 0)),
        ])
      ],
    }
  }

  // Default: grouped_cards / collect_all
  const unsatisfiedGroups = (mission.groups || []).filter(g => !isGroupSatisfied(g, ownership))
  return {
    isComplete: unsatisfiedGroups.length === 0,
    unsatisfiedGroups,
    missingCardIds: [...new Set(unsatisfiedGroups.flatMap(g => g.cards.filter(id => !(ownership?.[id] > 0))))],
  }
}

/**
 * Get all unique card IDs from an array of missions (across all groups)
 */
export function getAllMissionCardIds(missions) {
  const allIds = new Set()
  missions.forEach(m => {
    // Group-based cards
    if (m.groups) m.groups.forEach(g => g.cards?.forEach(id => allIds.add(id)))
    // Quota-based eligible cards
    if (m.eligible_cards) m.eligible_cards.forEach(id => allIds.add(id))
  })
  return [...allIds]
}

/**
 * Filter missions to only grouped_cards with valid groups
 */
export function getEvaluableMissions(allMissions) {
  if (!allMissions) return []
  const evaluableModes = new Set(['grouped_cards', 'collect_all', 'quota_from_pool', 'quota_duplicates', 'hybrid'])
  return allMissions.filter(m =>
    evaluableModes.has(m.evaluation_mode) &&
    m.mission_name.length >= 3 &&
    ((m.groups && m.groups.length > 0) || (m.eligible_cards && m.eligible_cards.length > 0))
  )
}

/**
 * Score a mission for ranking (higher = more valuable + more achievable)
 */
export function scoreMission(mission, ownership) {
  const ev = evaluateMission(mission, ownership)
  if (ev.isComplete) return null // completed
  if (ev.totalGroups === 0 && !ev.quotaMode) return null // not evaluable
  const totalHourglass = (mission.wonder_hourglass || 0) + (mission.pack_hourglass || 0)
  const score = totalHourglass * (1 + ev.progressRatio * 3)
  return { ...mission, ...ev, totalHourglass, score }
}
