/**
 * Plan Execution Engine — converts auto-plans into executable step queues
 *
 * Manages plan lifecycle: idle → in_progress → completed/invalidated
 * Revalidates remaining steps after each action using fresh ownership data.
 * Does NOT implement trade/gift logic — delegates to existing action handlers.
 */

import { evaluateMission, getEvaluableMissions, getAllMissionCardIds } from './missionHelpers'

// ── Plan/Step Status ──

export const PLAN_STATUS = {
  IDLE: 'idle',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  INVALIDATED: 'invalidated',
}

export const STEP_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  NO_LONGER_NEEDED: 'no_longer_needed',
}

/**
 * Convert a plan (from generatePlans) into an executable queue.
 */
export function createExecutionQueue(plan, accountId) {
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: PLAN_STATUS.IDLE,
    accountId,
    createdAt: Date.now(),
    steps: plan.sequence.map((step, i) => ({
      index: i,
      status: i === 0 ? STEP_STATUS.ACTIVE : STEP_STATUS.PENDING,
      cardId: step.cardId,
      cardName: step.cardName,
      backendId: step.card?.backendId || null,
      actionType: step.tradeable ? 'trade' : step.giftable ? 'gift' : 'collect',
      tradeable: step.tradeable,
      giftable: step.giftable,
      // Expected impact (may change after revalidation)
      expectedMissions: step.stepMissions,
      expectedWonder: step.stepWonder,
      expectedPack: step.stepPack,
      expectedGroups: step.stepGroups,
      // Actual result (filled after completion)
      actualMissions: null,
      actualWonder: null,
      actualPack: null,
      // Metadata
      skipReason: null,
      failReason: null,
      completedAt: null,
    })),
    // Totals (from original plan)
    originalTotalMissions: plan.totalMissions,
    originalTotalWonder: plan.totalWonder,
    originalTotalPack: plan.totalPack,
    // Running totals (updated after each step)
    completedMissions: 0,
    completedWonder: 0,
    completedPack: 0,
  }
}

/**
 * Get the current active step (first non-terminal step).
 */
export function getActiveStep(queue) {
  return queue.steps.find(s =>
    s.status === STEP_STATUS.ACTIVE || s.status === STEP_STATUS.PENDING
  ) || null
}

/**
 * Mark current step as completed and advance to next.
 * Returns updated queue.
 */
export function completeStep(queue, stepIndex, actualResult = {}) {
  const q = { ...queue, steps: queue.steps.map(s => ({ ...s })) }
  const step = q.steps[stepIndex]
  if (!step) return q

  step.status = STEP_STATUS.COMPLETED
  step.completedAt = Date.now()
  step.actualMissions = actualResult.missions ?? step.expectedMissions
  step.actualWonder = actualResult.wonder ?? step.expectedWonder
  step.actualPack = actualResult.pack ?? step.expectedPack

  q.completedMissions += step.actualMissions || 0
  q.completedWonder += step.actualWonder || 0
  q.completedPack += step.actualPack || 0

  // Activate next pending step
  const next = q.steps.find(s => s.status === STEP_STATUS.PENDING)
  if (next) {
    next.status = STEP_STATUS.ACTIVE
    q.status = PLAN_STATUS.IN_PROGRESS
  } else {
    // All steps done
    q.status = PLAN_STATUS.COMPLETED
  }

  return q
}

/**
 * Mark step as failed.
 */
export function failStep(queue, stepIndex, reason = 'Action failed') {
  const q = { ...queue, steps: queue.steps.map(s => ({ ...s })) }
  const step = q.steps[stepIndex]
  if (step) {
    step.status = STEP_STATUS.FAILED
    step.failReason = reason
  }
  q.status = PLAN_STATUS.PAUSED
  return q
}

/**
 * Skip a step (user choice or no longer needed).
 */
export function skipStep(queue, stepIndex, reason = 'Skipped by user') {
  const q = { ...queue, steps: queue.steps.map(s => ({ ...s })) }
  const step = q.steps[stepIndex]
  if (step) {
    step.status = STEP_STATUS.SKIPPED
    step.skipReason = reason
  }
  // Activate next
  const next = q.steps.find(s => s.status === STEP_STATUS.PENDING)
  if (next) {
    next.status = STEP_STATUS.ACTIVE
  } else if (!q.steps.some(s => s.status === STEP_STATUS.ACTIVE)) {
    q.status = PLAN_STATUS.COMPLETED
  }
  return q
}

/**
 * Revalidate remaining steps against fresh ownership.
 * Marks steps as NO_LONGER_NEEDED if the card's mission impact disappeared.
 * Returns updated queue.
 */
export function revalidateQueue(queue, missions, freshOwnership) {
  const q = { ...queue, steps: queue.steps.map(s => ({ ...s })) }

  for (const step of q.steps) {
    if (step.status !== STEP_STATUS.PENDING && step.status !== STEP_STATUS.ACTIVE) continue

    // Check if the card is already owned (someone else gifted it, or sync added it)
    if ((freshOwnership[step.cardId] || 0) > 0) {
      step.status = STEP_STATUS.NO_LONGER_NEEDED
      step.skipReason = 'Card already owned after sync'
      continue
    }

    // Simulate what happens if we add this card
    const simOwnership = { ...freshOwnership }
    simOwnership[step.cardId] = (simOwnership[step.cardId] || 0) + 1

    let newMissions = 0
    let newWonder = 0
    let newPack = 0
    let newGroups = 0

    for (const mission of missions) {
      const before = evaluateMission(mission, freshOwnership)
      if (before.isComplete) continue
      const after = evaluateMission(mission, simOwnership)
      newGroups += after.satisfiedGroups - before.satisfiedGroups
      if (after.isComplete && !before.isComplete) {
        newMissions++
        newWonder += mission.wonder_hourglass || 0
        newPack += mission.pack_hourglass || 0
      }
    }

    // Update expected impact with fresh data
    step.expectedMissions = newMissions
    step.expectedWonder = newWonder
    step.expectedPack = newPack
    step.expectedGroups = newGroups

    // If this card no longer helps any mission at all, mark as no longer needed
    if (newMissions === 0 && newGroups === 0) {
      step.status = STEP_STATUS.NO_LONGER_NEEDED
      step.skipReason = 'Mission already completed by previous steps'
    }
  }

  // Check if all remaining steps are terminal
  const hasActive = q.steps.some(s =>
    s.status === STEP_STATUS.PENDING || s.status === STEP_STATUS.ACTIVE
  )
  if (!hasActive && q.status === PLAN_STATUS.IN_PROGRESS) {
    q.status = PLAN_STATUS.COMPLETED
  }

  // Ensure first pending step is active
  if (hasActive) {
    const firstPending = q.steps.find(s => s.status === STEP_STATUS.PENDING || s.status === STEP_STATUS.ACTIVE)
    if (firstPending && firstPending.status === STEP_STATUS.PENDING) {
      firstPending.status = STEP_STATUS.ACTIVE
    }
  }

  return q
}

/**
 * Check if queue is still valid for the given account.
 */
export function isQueueValidForAccount(queue, accountId) {
  return queue.accountId === accountId
}
