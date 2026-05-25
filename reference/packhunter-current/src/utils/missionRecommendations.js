/**
 * Mission Recommendation Engine
 *
 * Computes smart recommendations on top of the grouped mission model:
 * - Best card to trade/gift right now (highest multi-mission impact)
 * - Instant wins (missions completable with 1 action)
 * - Multi-mission cards (cards satisfying groups across many missions)
 * - Best mission to finish next (reward × actionability)
 *
 * All functions are pure — take missions + ownership + cardMetadata, return ranked results.
 * Reuses isGroupSatisfied/evaluateMission from missionHelpers.js.
 */

import { isGroupSatisfied, evaluateMission, isCardTradable, GIFTABLE_RARITIES, getUnsatisfiedRequirements } from './missionHelpers'

/**
 * Build a map: cardId → { groupsSatisfied, missions affected, reward unlocked }
 *
 * For every unsatisfied group across all incomplete missions, each card option
 * in that group gets credit. If acquiring that card would also complete the
 * entire mission, it gets additional credit.
 *
 * @param {Array} missions - evaluable missions
 * @param {Object} ownership - { cardId: amount }
 * @returns {Map<string, Object>} cardId → impact data
 */
export function buildCardImpactMap(missions, ownership) {
  const impact = new Map() // cardId → { groups: Set<groupKey>, missions: Map<missionId, missionData>, ... }

  for (const mission of missions) {
    const eval_ = evaluateMission(mission, ownership)
    if (eval_.isComplete) continue

    // Use unified helper to get missing requirements for ANY mode
    const reqStatus = getUnsatisfiedRequirements(mission, ownership)
    if (reqStatus.isComplete) continue

    // For quota missions: each missing eligible card is a potential impact
    // For grouped: each unsatisfied group's options are potential impacts
    const candidateCards = reqStatus.missingCardIds || []

    for (const cardId of candidateCards) {
      // Skip cards user already owns (they don't help grouped missions)
      if ((ownership[cardId] || 0) > 0 && !reqStatus.quotaMode) continue

      // For quota: even owned cards don't need skipping since missingCardIds already filters
      const groupKey = reqStatus.quotaMode
        ? `${mission.id}:quota_pool`
        : `${mission.id}:${(reqStatus.unsatisfiedGroups || []).find(g => g.cards?.includes(cardId))?.lookup_name || cardId}`

      if (!impact.has(cardId)) {
        impact.set(cardId, {
          cardId,
          groups: new Set(),
          missionIds: new Set(),
          missionDetails: [],
          wonderUnlocked: 0,
          packUnlocked: 0,
          shopUnlocked: 0,
          missionsCompleted: 0,
        })
      }

      const entry = impact.get(cardId)
      entry.groups.add(groupKey)

      if (!entry.missionIds.has(mission.id)) {
        entry.missionIds.add(mission.id)
        entry.missionDetails.push({
          id: mission.id,
          name: mission.mission_name,
          set_code: mission.set_code,
          wonder: mission.wonder_hourglass || 0,
          pack: mission.pack_hourglass || 0,
          shop: mission.shop_ticket || 0,
          unsatisfied: eval_.unsatisfiedGroups,
        })

        // Would acquiring this card complete the mission?
        // For quota: 1 unsatisfied means 1 more copy needed
        // For grouped: 1 unsatisfied means this is the last group
        if (eval_.unsatisfiedGroups === 1) {
          entry.missionsCompleted++
          entry.wonderUnlocked += mission.wonder_hourglass || 0
          entry.packUnlocked += mission.pack_hourglass || 0
          entry.shopUnlocked += mission.shop_ticket || 0
        }
      }
    }
  }

  return impact
}

/**
 * Score and rank candidate cards by impact.
 *
 * @param {Map} impactMap - from buildCardImpactMap
 * @param {Object} cardMetadata - { cardId: { rarity_code, is_promo, set_code, card_name, ... } }
 * @returns {Array} ranked cards with scores
 */
export function rankCardsByImpact(impactMap, cardMetadata = {}) {
  const ranked = []

  for (const [cardId, entry] of impactMap) {
    const meta = cardMetadata[cardId] || {}
    const tradeable = isCardTradable(meta)
    const giftable = GIFTABLE_RARITIES.includes(meta.rarity_code) && !meta.is_promo
    const actionable = tradeable || giftable

    // Reward value: wonder hourglasses worth 2x pack hourglasses
    const rewardValue = entry.wonderUnlocked * 2 + entry.packUnlocked + entry.shopUnlocked * 0.3

    // Score: reward × completion bonus × actionability bonus
    const completionBonus = entry.missionsCompleted > 0 ? (1 + entry.missionsCompleted) : 1
    const actionBonus = tradeable ? 1.5 : giftable ? 1.3 : 1.0
    const multiMissionBonus = 1 + (entry.missionIds.size - 1) * 0.3

    const score = Math.round(
      (rewardValue + entry.groups.size * 5) * completionBonus * actionBonus * multiMissionBonus * 10
    ) / 10

    ranked.push({
      cardId,
      cardName: meta.card_name || cardId,
      rarityCode: meta.rarity_code,
      setCode: meta.set_code,
      backendId: meta.backend_id,
      tradeable,
      giftable,
      actionable,
      groupsSatisfied: entry.groups.size,
      missionsAffected: entry.missionIds.size,
      missionsCompleted: entry.missionsCompleted,
      wonderUnlocked: entry.wonderUnlocked,
      packUnlocked: entry.packUnlocked,
      shopUnlocked: entry.shopUnlocked,
      missionDetails: entry.missionDetails,
      score,
    })
  }

  // Sort by score descending, then by actionability, then by missions completed
  ranked.sort((a, b) => b.score - a.score || (b.actionable ? 1 : 0) - (a.actionable ? 1 : 0) || b.missionsCompleted - a.missionsCompleted)

  return ranked
}

/**
 * Get top recommendations in structured categories.
 *
 * @param {Array} missions - evaluable missions
 * @param {Object} ownership - { cardId: amount }
 * @param {Object} cardMetadata - { cardId: { ... } }
 * @param {number} topN - max items per category
 * @returns {Object} { bestCards, instantWins, bestMissions, summary }
 */
export function getRecommendations(missions, ownership, cardMetadata = {}, topN = 5) {
  const impactMap = buildCardImpactMap(missions, ownership)
  const allRanked = rankCardsByImpact(impactMap, cardMetadata)

  // Category 2: Instant wins — cards that complete 1+ missions AND are actionable
  const instantWins = allRanked
    .filter(c => c.missionsCompleted > 0 && c.actionable)
    .slice(0, topN)

  // Track instant-win card IDs to avoid duplication in bestCards
  const instantWinIds = new Set(instantWins.map(c => c.cardId))

  // Category 1: Best actionable cards (excluding those already in instantWins)
  const bestCards = allRanked
    .filter(c => c.actionable && !instantWinIds.has(c.cardId))
    .slice(0, topN)

  // Category 3: Multi-mission cards (affect 2+ missions, any actionability)
  const multiMission = allRanked
    .filter(c => c.missionsAffected >= 2)
    .slice(0, topN)

  // Category 4: Best mission to finish next (1 group away, actionable)
  const bestMissions = []
  const seenMissions = new Set()
  for (const card of allRanked) {
    if (!card.actionable) continue
    for (const md of card.missionDetails) {
      if (md.unsatisfied === 1 && !seenMissions.has(md.id)) {
        seenMissions.add(md.id)
        bestMissions.push({
          ...md,
          completionCard: card.cardId,
          completionCardName: card.cardName,
          tradeable: card.tradeable,
          giftable: card.giftable,
        })
      }
    }
    if (bestMissions.length >= topN) break
  }

  // Summary stats
  const totalActionableCards = allRanked.filter(c => c.actionable).length
  const totalInstantWins = instantWins.length
  const totalWonderUnlockable = instantWins.reduce((s, c) => s + c.wonderUnlocked, 0)
  const totalPackUnlockable = instantWins.reduce((s, c) => s + c.packUnlocked, 0)

  return {
    bestCards,
    instantWins,
    multiMission,
    bestMissions,
    summary: {
      totalActionableCards,
      totalInstantWins,
      totalWonderUnlockable,
      totalPackUnlockable,
    },
    // Pass ranked list for combo engine
    _allRanked: allRanked,
  }
}

// ── Combo / Strategy Engine ─────────────────────────────────────

/**
 * Simulate acquiring a set of cards and evaluate mission impact.
 * Returns missions completed and rewards unlocked vs current state.
 */
function simulateCombo(cardIds, missions, ownership) {
  // Clone ownership with new cards added
  const simOwnership = { ...ownership }
  for (const id of cardIds) {
    simOwnership[id] = (simOwnership[id] || 0) + 1
  }

  // Evaluate all missions under simulated ownership
  let missionsCompleted = 0
  let wonderUnlocked = 0
  let packUnlocked = 0
  let shopUnlocked = 0
  let groupsSatisfied = 0

  for (const mission of missions) {
    const before = evaluateMission(mission, ownership)
    if (before.isComplete) continue // already done

    const after = evaluateMission(mission, simOwnership)
    const newGroups = after.satisfiedGroups - before.satisfiedGroups
    groupsSatisfied += newGroups

    if (after.isComplete && !before.isComplete) {
      missionsCompleted++
      wonderUnlocked += mission.wonder_hourglass || 0
      packUnlocked += mission.pack_hourglass || 0
      shopUnlocked += mission.shop_ticket || 0
    }
  }

  return { missionsCompleted, groupsSatisfied, wonderUnlocked, packUnlocked, shopUnlocked }
}

/**
 * Score a combo and classify it by type.
 */
function scoreCombo(cards, sim, actions, individualCompletionSum) {
  if (sim.groupsSatisfied === 0) return null

  const hasSynergy = sim.missionsCompleted > individualCompletionSum
  const rewardValue = sim.wonderUnlocked * 2 + sim.packUnlocked + sim.shopUnlocked * 0.3

  // Synergy bonus reduced to 1.15 — mission completions already capture the chain value
  const score = Math.round((
    rewardValue +
    sim.missionsCompleted * 50 +
    sim.groupsSatisfied * 5 -
    actions * 10
  ) * (hasSynergy ? 1.15 : 1.0) * 10) / 10

  // Classify combo type for UX labeling
  const efficiency = sim.missionsCompleted / actions
  let comboType = 'value'
  if (sim.missionsCompleted === 0) comboType = 'setup'  // no completions = setup combo
  else if (efficiency >= 1.5) comboType = 'fastest'      // high missions per action
  else if (rewardValue >= 150) comboType = 'reward'       // high raw reward

  // Generate explanation
  let reason = ''
  if (hasSynergy) reason = 'Cards unlock shared requirements across missions'
  else if (sim.missionsCompleted >= 2) reason = 'High multi-mission completion'
  else if (sim.missionsCompleted === 1 && actions === 2) reason = 'Efficient path to mission completion'
  else if (sim.missionsCompleted === 0) reason = `Sets up ${sim.groupsSatisfied} requirement${sim.groupsSatisfied !== 1 ? 's' : ''} for future completion`
  else reason = 'Strong combined value'

  return {
    cards,
    cardIds: cards.map(c => c.cardId),
    cardNames: cards.map(c => c.cardName),
    actions,
    ...sim,
    hasSynergy,
    score,
    comboType,
    reason,
    allTradeable: cards.every(c => c.tradeable),
    allGiftable: cards.every(c => c.giftable),
    allActionable: true,
  }
}

/**
 * Generate and evaluate card combinations (2-card and 3-card).
 * Uses top N actionable candidates to keep computation bounded.
 *
 * @param {Array} missions - evaluable missions
 * @param {Object} ownership - { cardId: amount }
 * @param {Array} rankedCards - from rankCardsByImpact (actionable only)
 * @param {Object} options - { maxCandidates, maxCombos, include3Card }
 * @returns {Array} top combos sorted by score
 */
export function generateCombos(missions, ownership, rankedCards, options = {}) {
  const { maxCandidates = 12, maxResults = 3, include3Card = true } = options

  // Take top N actionable candidates
  const candidates = rankedCards.filter(c => c.actionable).slice(0, maxCandidates)
  if (candidates.length < 2) return []

  const combos = []

  // Generate 2-card combos
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const cards = [candidates[i], candidates[j]]
      const cardIds = cards.map(c => c.cardId)
      const sim = simulateCombo(cardIds, missions, ownership)

      // Check for synergy — does combo complete more than sum of individuals?
      const individualSum = cards.reduce((s, c) => s + c.missionsCompleted, 0)
      const hasSynergy = sim.missionsCompleted > individualSum

      const result = scoreCombo(cards, sim, 2, individualSum)
      if (result) combos.push(result)
    }
  }

  // Generate 3-card combos (from top 8 only to limit computation)
  if (include3Card && candidates.length >= 3) {
    const top8 = candidates.slice(0, 8)
    for (let i = 0; i < top8.length; i++) {
      for (let j = i + 1; j < top8.length; j++) {
        for (let k = j + 1; k < top8.length; k++) {
          const cards = [top8[i], top8[j], top8[k]]
          const cardIds = cards.map(c => c.cardId)
          const sim = simulateCombo(cardIds, missions, ownership)
          const individualSum = cards.reduce((s, c) => s + c.missionsCompleted, 0)
          const result = scoreCombo(cards, sim, 3, individualSum)
          if (result) combos.push(result)
        }
      }
    }
  }

  // Hard rule: mission-completing combos FIRST, then by score, then fewer actions
  combos.sort((a, b) => {
    // Primary: completions > 0 always beats completions = 0
    const aCompletes = a.missionsCompleted > 0 ? 1 : 0
    const bCompletes = b.missionsCompleted > 0 ? 1 : 0
    if (bCompletes !== aCompletes) return bCompletes - aCompletes
    // Secondary: score
    if (b.score !== a.score) return b.score - a.score
    // Tertiary: fewer actions
    return a.actions - b.actions
  })

  // Deduplicate — remove combos whose impact is identical to a higher-ranked one
  const seen = new Set()
  const deduped = []
  for (const combo of combos) {
    const key = `${combo.missionsCompleted}:${combo.groupsSatisfied}:${combo.wonderUnlocked}:${combo.packUnlocked}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(combo)
    }
    if (deduped.length >= maxResults * 2) break // keep extra for primary/secondary split
  }

  return deduped
}

// ── Auto-Plan Generator ─────────────────────────────────────

/**
 * Simulate a sequence incrementally — shows what each step contributes.
 * Returns an array of step objects with cumulative + incremental stats.
 */
function simulateSequence(cardSequence, missions, ownership) {
  const steps = []
  let currentOwnership = { ...ownership }
  let cumulativeMissions = 0
  let cumulativeWonder = 0
  let cumulativePack = 0

  for (const card of cardSequence) {
    // Simulate adding this one card
    const beforeOwnership = { ...currentOwnership }
    currentOwnership[card.cardId] = (currentOwnership[card.cardId] || 0) + 1

    // Evaluate incremental impact
    let stepMissions = 0
    let stepWonder = 0
    let stepPack = 0
    let stepGroups = 0

    for (const mission of missions) {
      const before = evaluateMission(mission, beforeOwnership)
      if (before.isComplete) continue
      const after = evaluateMission(mission, currentOwnership)
      stepGroups += after.satisfiedGroups - before.satisfiedGroups
      if (after.isComplete && !before.isComplete) {
        stepMissions++
        stepWonder += mission.wonder_hourglass || 0
        stepPack += mission.pack_hourglass || 0
      }
    }

    cumulativeMissions += stepMissions
    cumulativeWonder += stepWonder
    cumulativePack += stepPack

    steps.push({
      card,
      cardId: card.cardId,
      cardName: card.cardName,
      tradeable: card.tradeable,
      giftable: card.giftable,
      actionable: card.actionable,
      // Incremental (this step only)
      stepMissions,
      stepWonder,
      stepPack,
      stepGroups,
      // Cumulative (all steps so far)
      cumulativeMissions,
      cumulativeWonder,
      cumulativePack,
    })
  }

  return steps
}

/**
 * Generate auto-plans: ordered sequences of actions with incremental outcomes.
 *
 * @param {Array} missions - evaluable missions
 * @param {Object} ownership - { cardId: amount }
 * @param {Array} rankedCards - from rankCardsByImpact
 * @param {Object} options
 * @returns {Array} top plans sorted by score
 */
export function generatePlans(missions, ownership, rankedCards, options = {}) {
  const { maxCandidates = 10, maxSteps = 3, maxResults = 2 } = options

  const candidates = rankedCards.filter(c => c.actionable).slice(0, maxCandidates)
  if (candidates.length === 0) return []

  const plans = []

  // Generate all sequences of 1, 2, and 3 steps
  // 1-step plans
  for (const c of candidates) {
    const steps = simulateSequence([c], missions, ownership)
    if (steps[0].stepMissions > 0 || steps[0].stepGroups > 0) {
      plans.push(buildPlan(steps))
    }
  }

  // 2-step plans
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      // Try both orderings — pick the one where more missions complete early
      const seqA = simulateSequence([candidates[i], candidates[j]], missions, ownership)
      const seqB = simulateSequence([candidates[j], candidates[i]], missions, ownership)
      // Pick ordering where step 1 completes more missions (frontloads gratification)
      const best = seqA[0].stepMissions >= seqB[0].stepMissions ? seqA : seqB
      if (best[best.length - 1].cumulativeMissions > 0 || best[best.length - 1].stepGroups > 0) {
        plans.push(buildPlan(best))
      }
    }
  }

  // 3-step plans (from top 7 only)
  if (maxSteps >= 3) {
    const top7 = candidates.slice(0, 7)
    for (let i = 0; i < top7.length; i++) {
      for (let j = i + 1; j < top7.length; j++) {
        for (let k = j + 1; k < top7.length; k++) {
          // Simple heuristic: order by individual missionsCompleted descending
          const trio = [top7[i], top7[j], top7[k]]
            .sort((a, b) => b.missionsCompleted - a.missionsCompleted || b.score - a.score)
          const steps = simulateSequence(trio, missions, ownership)
          const last = steps[steps.length - 1]
          if (last.cumulativeMissions > 0) {
            plans.push(buildPlan(steps))
          }
        }
      }
    }
  }

  // Score and sort plans
  plans.sort((a, b) => {
    // Primary: missions completed
    if (b.totalMissions !== a.totalMissions) return b.totalMissions - a.totalMissions
    // Secondary: reward per action
    if (b.rewardPerAction !== a.rewardPerAction) return b.rewardPerAction - a.rewardPerAction
    // Tertiary: fewer steps
    return a.steps - b.steps
  })

  // Deduplicate by impact
  const seen = new Set()
  const deduped = []
  for (const plan of plans) {
    const key = `${plan.totalMissions}:${plan.totalWonder}:${plan.totalPack}:${plan.steps}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(plan)
    }
    if (deduped.length >= maxResults * 2) break
  }

  // Classify plan types
  if (deduped.length > 0) {
    // Best = highest reward
    deduped.sort((a, b) => b.score - a.score)
    deduped[0].planType = 'best'
    // Find fastest (most missions per action, different from best)
    const fastest = deduped.find((p, i) => i > 0 && p.rewardPerAction > deduped[0].rewardPerAction)
    if (fastest) fastest.planType = 'fastest'
  }

  return deduped.slice(0, maxResults)
}

function buildPlan(steps) {
  const last = steps[steps.length - 1]
  const totalReward = last.cumulativeWonder * 2 + last.cumulativePack
  return {
    steps: steps.length,
    sequence: steps,
    totalMissions: last.cumulativeMissions,
    totalWonder: last.cumulativeWonder,
    totalPack: last.cumulativePack,
    totalReward,
    rewardPerAction: steps.length > 0 ? Math.round(totalReward / steps.length * 10) / 10 : 0,
    score: Math.round((totalReward + last.cumulativeMissions * 50 - steps.length * 15) * 10) / 10,
    planType: 'value', // default, overridden in generatePlans
    allTradeable: steps.every(s => s.tradeable),
    allActionable: steps.every(s => s.actionable),
  }
}
