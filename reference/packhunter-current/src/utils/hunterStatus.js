/**
 * Deterministic hunter status derivation.
 *
 * Input: participant row (from GET /admin/hunt-participants, with packs[],
 * active_packs, player_id, etc.) + optional botStatus object from the
 * useAdminUsers hook's botStatuses map.
 *
 * Output: { state, label, reason } where `state` is one of the four
 * canonical states the dot system renders:
 *
 *   healthy  — green  — producing / no failures / bot running if linked
 *   warning  — yellow — failing pack, bot offline, stale activity
 *   error    — red    — repeated failures (>5) or bot explicit error
 *   idle     — grey   — 0 active packs
 *
 * The logic is conservative: it prefers `warning` over `error` unless the
 * signal is unambiguous (failure_count > STALE_ERROR_THRESHOLD or the bot
 * status is literally 'error'). This avoids ops chasing red rows that
 * would self-heal on next cycle.
 */

'use strict';

export const HUNTER_STATES = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  ERROR:   'error',
  IDLE:    'idle',
};

const FAILURE_WARN = 1;   // >=1 failure on an active pack → yellow
const FAILURE_ERROR = 5;  // >5 failures → red
const STALE_MS = 30 * 60 * 1000; // 30 min with no updated_at → yellow

/**
 * @param {Object} p           participant row
 * @param {Object|null} botStatus optional botStatuses[`${player_id}_${account_type}`]
 * @returns {{ state: string, label: string, reason: string|null }}
 */
export function deriveHunterStatus(p, botStatus) {
  if (!p) return { state: HUNTER_STATES.IDLE, label: 'No data', reason: 'missing-participant' };

  const activeCount = p.active_packs || 0;
  if (activeCount === 0) {
    return { state: HUNTER_STATES.IDLE, label: 'Not hunting', reason: 'no-active-packs' };
  }

  // Look at pack-level failures first — they're the most specific signal.
  const activePacks = (p.packs || []).filter(pk => pk.is_active);
  const maxFailures = activePacks.reduce((m, pk) => Math.max(m, pk.failure_count || 0), 0);

  if (maxFailures > FAILURE_ERROR) {
    return {
      state: HUNTER_STATES.ERROR,
      label: `Pack failing ×${maxFailures}`,
      reason: 'high-failure-count',
    };
  }

  // Bot-level explicit error beats soft failures.
  if (p.player_id && botStatus && botStatus.status === 'error') {
    return { state: HUNTER_STATES.ERROR, label: 'Bot error', reason: 'bot-error' };
  }

  if (maxFailures >= FAILURE_WARN) {
    return {
      state: HUNTER_STATES.WARNING,
      label: `Pack failing ×${maxFailures}`,
      reason: 'some-failure-count',
    };
  }

  // Bot not running while account is linked — likely operator attention needed.
  if (p.player_id && botStatus && botStatus.status && botStatus.status !== 'running' && botStatus.status !== 'no_account') {
    return { state: HUNTER_STATES.WARNING, label: 'Bot offline', reason: 'bot-not-running' };
  }

  // Stale activity — no pack-level update in a long time.
  const last = p.lastUpdatedAt || p.last_updated_at || null;
  if (last) {
    const ageMs = Date.now() - new Date(last).getTime();
    if (Number.isFinite(ageMs) && ageMs > STALE_MS) {
      return { state: HUNTER_STATES.WARNING, label: 'Stale', reason: 'stale-updated-at' };
    }
  }

  return { state: HUNTER_STATES.HEALTHY, label: 'Active', reason: null };
}

/** Group hunters by state for dashboard counts. */
export function bucketByStatus(participants, botStatuses = {}) {
  const buckets = {
    [HUNTER_STATES.HEALTHY]: 0,
    [HUNTER_STATES.WARNING]: 0,
    [HUNTER_STATES.ERROR]:   0,
    [HUNTER_STATES.IDLE]:    0,
  };
  for (const p of participants) {
    const key = `${p.player_id}_${p.account_type || 'main'}`;
    const bs = botStatuses[key];
    const { state } = deriveHunterStatus(p, bs);
    buckets[state] += 1;
  }
  return buckets;
}
