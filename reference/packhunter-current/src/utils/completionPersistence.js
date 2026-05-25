import { logEvent, logAlert } from './observability'

/**
 * Mission Completion Persistence — prevents regression after card trades/gifts
 *
 * RULE: Once a mission is evaluated as complete, it stays complete FOREVER.
 * Trading away cards must NOT regress a completed mission.
 *
 * Storage: localStorage, scoped per account + schema version.
 * completionSource priority (highest first):
 *   1. "game"                — from MissionIsCompletedV1 API (authoritative, server-confirmed)
 *   2. "manual"              — user explicitly marked as done (separate key, survives schema bumps)
 *   3. "inferred_persistent" — latched from evaluator (auto-detected)
 *   4. "engine"              — live evaluation from current inventory
 */

const STORAGE_KEY = 'vudoo_completed_missions'
const MANUAL_STORAGE_KEY = 'vudoo_manual_completed_missions'
// BUMP THIS when mission definitions change to prevent false-positive persistence
// from old incorrect evaluations. New version = fresh start for all completions.
// History: v3 = initial, v4 = Shiny Museum A2B fixed to quota_from_pool,
// v5 = Phase 32 — evaluator honors operator field + 6 museum/immersive
//      missions (B2B_346, A1A_39, A2A_75, A3B_169, A4B_240, B1A_286)
//      flipped OR→AND to require all variants per Bulbapedia. Pre-v5
//      latches were derived from the permissive OR evaluator and
//      would now false-positively mark AND missions complete. Fresh
//      start forces re-evaluation against the corrected rules.
const SCHEMA_VERSION = 'v5'

/**
 * Load completed mission IDs for an account.
 * Returns Set of mission IDs.
 */
export function loadCompletedMissions(accountId) {
  if (!accountId) return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const data = JSON.parse(raw)
    // Account + schema version scoping
    const key = `${accountId}:${SCHEMA_VERSION}`
    const ids = data[key]
    if (!ids || !Array.isArray(ids)) return new Set()
    return new Set(ids)
  } catch {
    return new Set()
  }
}

/**
 * Save a newly completed mission ID for an account.
 * Additive only — never removes completed missions.
 */
export function markMissionCompleted(accountId, missionId) {
  if (!accountId || !missionId) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const key = `${accountId}:${SCHEMA_VERSION}`
    if (!data[key]) data[key] = []
    if (!data[key].includes(missionId)) {
      data[key].push(missionId)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full — silent fail
  }
}

/**
 * Batch-save multiple completed mission IDs.
 */
export function markMissionsCompleted(accountId, missionIds) {
  if (!accountId || !missionIds?.length) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const key = `${accountId}:${SCHEMA_VERSION}`
    if (!data[key]) data[key] = []
    for (const id of missionIds) {
      if (!data[key].includes(id)) {
        data[key].push(id)
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full — silent fail
  }
}

// ─── Manual Completion (user-driven "Mark Done") ────────────────────────
// Separate key — NOT affected by schema version bumps (intentional user action).
// Scoped per accountId only.

/**
 * Load manually completed mission IDs for an account.
 */
export function loadManualCompletions(accountId) {
  if (!accountId) return new Set()
  try {
    const raw = localStorage.getItem(MANUAL_STORAGE_KEY)
    if (!raw) return new Set()
    const data = JSON.parse(raw)
    const ids = data[String(accountId)]
    if (!ids || !Array.isArray(ids)) return new Set()
    return new Set(ids)
  } catch {
    return new Set()
  }
}

/**
 * Toggle manual completion for a mission (mark done / unmark).
 * Returns the new state (true = marked, false = unmarked).
 */
export function toggleManualCompletion(accountId, missionId) {
  if (!accountId || !missionId) return false
  try {
    const raw = localStorage.getItem(MANUAL_STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const key = String(accountId)
    if (!data[key]) data[key] = []
    const idx = data[key].indexOf(missionId)
    if (idx >= 0) {
      data[key].splice(idx, 1)
      localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(data))
      logEvent('mission.manual.toggle', { accountId, missionId, newValue: false })
      return false // unmarked
    } else {
      data[key].push(missionId)
      localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(data))
      logEvent('mission.manual.toggle', { accountId, missionId, newValue: true })
      return true // marked
    }
  } catch {
    return false
  }
}

/**
 * Determine mission completion status with persistence.
 *
 * Phase 31 — when a server-side snapshot exists (gameSet is non-null),
 * it is the HIGHEST authority and OVERRIDES the localStorage
 * inferred_persistent latch completely. Rationale: inferred_persistent
 * was historically polluted by pre-per-account evaluator behavior and
 * never downgrades. When we have synced game truth, stale localStorage
 * latches must NOT pretend a mission is complete. Manual (user-driven
 * explicit mark-done) still wins over engine because it's a deliberate
 * user intent the game API may not know about.
 *
 * Priority when gameSet != null (snapshot present):
 *   1. Game-confirmed (snapshot or live IsCompletedV1) — authoritative
 *   2. Manual completion                                — user intent
 *   3. Live engine evaluation                           — current inventory
 *   (inferred_persistent is IGNORED in this mode)
 *
 * Priority when gameSet == null (never synced, legacy path):
 *   1. Manual completion
 *   2. Persisted completion (inferred_persistent) — legacy latch
 *   3. Live engine evaluation
 *
 * @param {string} missionId
 * @param {Object} evalResult - from evaluateMission()
 * @param {Set} completedSet - from loadCompletedMissions() (localStorage latch)
 * @param {Set} [manualSet] - from loadManualCompletions()
 * @param {Set|null} [gameSet] - non-null = snapshot available (even empty Set)
 * @returns {{ isComplete, completionSource }}
 */
export function resolveMissionCompletion(missionId, evalResult, completedSet, manualSet, gameSet) {
  // Snapshot mode: non-null gameSet means we have synced game truth for
  // this account. Even an empty Set counts as "synced with zero hits" —
  // the inferred_persistent latch MUST NOT override a true zero.
  const snapshotMode = gameSet != null

  // Priority 1: Game-confirmed — authoritative server data
  if (gameSet && gameSet.has(missionId)) {
    return {
      isComplete: true,
      completionSource: 'game',
    }
  }

  // Priority 2: Manual completion — user explicitly marked done
  if (manualSet && manualSet.has(missionId)) {
    return {
      isComplete: true,
      completionSource: 'manual',
    }
  }

  // Priority 3: Persisted completion (localStorage latch) — ONLY when
  // no snapshot is available. When a snapshot exists, stale latches
  // must not contradict synced truth. See Phase 31 comment above.
  if (!snapshotMode && completedSet && completedSet.has(missionId)) {
    return {
      isComplete: true,
      completionSource: 'inferred_persistent',
    }
  }

  // Priority 4: Live engine evaluation
  if (evalResult.isComplete) {
    return {
      isComplete: true,
      completionSource: 'engine',
      // Caller should persist this!
    }
  }

  return {
    isComplete: false,
    completionSource: 'engine',
  }
}

/**
 * Process all missions: evaluate, apply persistence, latch new completions.
 *
 * @param {Array} missions - all evaluable missions
 * @param {Object} ownership - { cardId: amount }
 * @param {string|number} accountId
 * @param {Function} evaluateMissionFn - evaluateMission from missionHelpers
 * @param {Set} [gameCompletedSet] - from game API (IsCompletedV1), or null if not fetched
 * @returns {{ results: Map<missionId, { isComplete, completionSource, ...evalResult }>, newlyCompleted: string[] }}
 */
export function evaluateAllMissionsWithPersistence(missions, ownership, accountId, evaluateMissionFn, gameCompletedSet) {
  const completedSet = loadCompletedMissions(accountId)
  const manualSet = loadManualCompletions(accountId)
  const gameSet = gameCompletedSet || null
  const results = new Map()
  const newlyCompleted = []

  for (const m of missions) {
    const evalResult = evaluateMissionFn(m, ownership)
    const resolution = resolveMissionCompletion(m.id, evalResult, completedSet, manualSet, gameSet)

    // Latch: if evaluator says complete for the first time, persist it
    if (evalResult.isComplete && !completedSet.has(m.id)) {
      newlyCompleted.push(m.id)
    }

    results.set(m.id, {
      ...evalResult,
      isComplete: resolution.isComplete,
      completionSource: resolution.completionSource,
    })
  }

  // Persist newly completed missions
  if (newlyCompleted.length > 0) {
    markMissionsCompleted(accountId, newlyCompleted)
  }

  // Downgrade detection: mission was manual/persisted but now engine:incomplete
  for (const m of missions) {
    const r = results.get(m.id)
    if (!r) continue
    const wasManual = manualSet.has(m.id)
    const wasPersisted = completedSet.has(m.id)
    if ((wasManual || wasPersisted) && !r.isComplete) {
      logAlert('mission.source_downgrade', 'P1', {
        accountId, missionId: m.id,
        previousSource: wasManual ? 'manual' : 'inferred_persistent',
        newSource: r.completionSource, schemaVersion: SCHEMA_VERSION,
      })
    }
  }

  // Summary instrumentation — one log per evaluation pass, not per mission
  const sourceCounts = {}
  for (const [, r] of results) {
    const key = `${r.completionSource}:${r.isComplete ? 'complete' : 'incomplete'}`
    sourceCounts[key] = (sourceCounts[key] || 0) + 1
  }
  logEvent('mission.evaluation.summary', {
    accountId, totalMissions: missions.length, newlyCompleted: newlyCompleted.length,
    gameCount: gameSet ? gameSet.size : 0,
    manualCount: manualSet.size, persistedCount: completedSet.size,
    schemaVersion: SCHEMA_VERSION, sourceCounts,
  })

  return { results, newlyCompleted }
}
