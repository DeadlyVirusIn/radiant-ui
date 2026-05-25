/**
 * Plan Persistence — save/restore execution plan across page navigations
 *
 * Uses sessionStorage (survives refresh, not tab close).
 * Stores ONLY safe state: step card IDs + account + timestamp.
 * Everything else is recomputed from fresh ownership on restore.
 */

const STORAGE_KEY = 'vudoo_execution_plan'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Save plan to sessionStorage.
 * Stores minimal safe data — NO derived evaluation results.
 * Includes ownershipHash for stale detection on restore.
 */
export function savePlan(queue, ownershipHash = null) {
  if (!queue) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }

  const data = {
    version: 2, // v2: added ownershipHash
    accountId: queue.accountId,
    timestamp: Date.now(),
    ownershipHash: ownershipHash || null,
    steps: queue.steps.map(s => ({
      cardId: s.cardId,
      cardName: s.cardName,
      backendId: s.backendId,
      actionType: s.actionType,
      status: s.status,
      // NOT persisted: expectedMissions, expectedWonder — recomputed on restore
    })),
    completedMissions: queue.completedMissions,
    completedWonder: queue.completedWonder,
    completedPack: queue.completedPack,
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    // Storage full or unavailable — silent fail
  }
}

/**
 * Load persisted plan from sessionStorage.
 * Returns null if:
 *   - no saved plan
 *   - plan is stale (>24h)
 *   - plan is for a different account
 *   - plan data is corrupt
 */
export function loadPlan(currentAccountId) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const data = JSON.parse(raw)
    if (!data || (data.version !== 1 && data.version !== 2)) return null

    // Account mismatch
    if (data.accountId !== currentAccountId) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    // Stale check
    if (Date.now() - data.timestamp > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    return data
  } catch (e) {
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

/**
 * Clear persisted plan.
 */
export function clearPlan() {
  sessionStorage.removeItem(STORAGE_KEY)
}

/**
 * Check if a persisted plan exists for the current account.
 */
export function hasSavedPlan(currentAccountId) {
  return loadPlan(currentAccountId) !== null
}
