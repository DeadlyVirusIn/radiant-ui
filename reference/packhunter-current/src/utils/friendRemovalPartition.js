/**
 * Phase v3.3 (May 14 2026) — Shared friend-removal partition + sequential
 * override helpers. Used by every user-facing bulk-remove entry point in
 * Friends.jsx (handleDeleteSelected, handleRemoveAllBots,
 * handleRemoveAllExceptGodpacks) so all three paths behave identically:
 *
 *   1. normal friends     → MANUAL_BULK batch (existing route policy).
 *   2. tier 1-5 GP        → sequential MANUAL_SINGLE with overrideProtected=true.
 *   3. pseudo / anomaly   → hard-blocked from this flow (surfaced in toast;
 *                            removable only via per-friend single-delete with
 *                            its own SYSTEM_BLOCKED_FRIEND policy gate).
 *
 * No backend policy change. No new override source. Same per-call
 * policy enforcement. Cap=25 protects against quasi-Smart-Clear bypass
 * via 500-friend selection.
 *
 * Pure helpers. No side effects beyond logging in runSequentialOverride.
 */

'use strict';

const MAX_OVERRIDE_BATCH = 25;

/**
 * Classify friends into removal buckets based on the local godPackMap.
 *
 * @param {string[]}                 playerIds      list of friend player IDs to remove
 * @param {Record<string, Array<{tier?:number, god_pack_card_count?:number}>>} godPackMap
 *                                                   map of playerId → array of god_packs rows
 * @param {{ maxOverrideBatch?: number }} [opts]
 * @returns {{
 *   partitions: { normal: string[], overrideable: string[], hardBlocked: string[] },
 *   tierBreakdown: { t1:number, t2:number, t3:number, t4:number, t5:number, pseudo:number, anomaly:number },
 *   overrideCapped: boolean,
 *   overrideEligible: string[],
 *   overrideDeferred: string[],
 *   highValueCount: number,
 *   lowTierCount: number,
 *   totalRemovable: number,
 *   maxOverrideBatch: number,
 * }}
 */
export function partitionFriendsForRemoval(playerIds, godPackMap, opts = {}) {
  const maxOverrideBatch = opts.maxOverrideBatch != null ? opts.maxOverrideBatch : MAX_OVERRIDE_BATCH;
  const partitions = { normal: [], overrideable: [], hardBlocked: [] };
  const tierBreakdown = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, pseudo: 0, anomaly: 0 };

  for (const id of playerIds) {
    const packs = (godPackMap && godPackMap[id]) || [];
    if (packs.length === 0) {
      partitions.normal.push(id);
      continue;
    }
    const tiers = packs.map(gp => {
      const t = gp.tier != null ? gp.tier : (gp.god_pack_card_count != null ? gp.god_pack_card_count : null);
      return typeof t === 'number' && Number.isFinite(t) ? t : null;
    });
    const hasNullTier = tiers.some(t => t === null);
    const maxTier = tiers.filter(t => t !== null).reduce((a, b) => Math.max(a, b), 0);

    // Anomaly: null or 0 tier → hard-blocked
    if (hasNullTier || maxTier === 0) {
      partitions.hardBlocked.push(id);
      tierBreakdown.anomaly++;
      continue;
    }
    // Pseudo high-value (tier ≥6) → hard-blocked
    if (maxTier >= 6) {
      partitions.hardBlocked.push(id);
      tierBreakdown.pseudo++;
      continue;
    }
    // Tier 1-5 → overrideable via sequential MANUAL_SINGLE
    partitions.overrideable.push(id);
    if (maxTier === 1) tierBreakdown.t1++;
    else if (maxTier === 2) tierBreakdown.t2++;
    else if (maxTier === 3) tierBreakdown.t3++;
    else if (maxTier === 4) tierBreakdown.t4++;
    else if (maxTier === 5) tierBreakdown.t5++;
  }

  const overrideCapped = partitions.overrideable.length > maxOverrideBatch;
  const overrideEligible = partitions.overrideable.slice(0, maxOverrideBatch);
  const overrideDeferred = partitions.overrideable.slice(maxOverrideBatch);
  const highValueCount = tierBreakdown.t4 + tierBreakdown.t5;
  const lowTierCount = tierBreakdown.t1 + tierBreakdown.t2 + tierBreakdown.t3;
  const totalRemovable = partitions.normal.length + overrideEligible.length;

  return {
    partitions,
    tierBreakdown,
    overrideCapped,
    overrideEligible,
    overrideDeferred,
    highValueCount,
    lowTierCount,
    totalRemovable,
    maxOverrideBatch,
  };
}

/**
 * Run sequential MANUAL_SINGLE override calls for the protected-overrideable
 * bucket. Each call is policy-gated server-side via the existing
 * MANUAL_SINGLE OVERRIDEABLE_BY_SOURCE matrix. UI is responsible for the
 * pre-flight confirmation modal (basic + high-value second-confirm when
 * 4/5 or 5/5 included).
 *
 * @param {Object}   friendsApi        the api client (must expose deleteGameFriend)
 * @param {string|number} accountId
 * @param {string[]} overrideEligible
 * @param {{ overrideReason?: string, logPrefix?: string, cap?: number }} [opts]
 * @returns {Promise<{ overrideRemoved: number, overrideFailed: number }>}
 */
export async function runSequentialOverride(friendsApi, accountId, overrideEligible, opts = {}) {
  const overrideReason = opts.overrideReason || 'user_selected_multi_override';
  const logPrefix = opts.logPrefix || '[MANUAL_SELECTED_OVERRIDE]';
  const cap = opts.cap != null ? opts.cap : MAX_OVERRIDE_BATCH;

  let overrideRemoved = 0;
  let overrideFailed = 0;
  if (!Array.isArray(overrideEligible) || overrideEligible.length === 0) {
    return { overrideRemoved, overrideFailed };
  }

  try {
    // eslint-disable-next-line no-console
    console.log(`${logPrefix} starting sequential override for ${overrideEligible.length} friend(s) (cap=${cap})`);
  } catch (_) { /* swallow logging errors */ }

  for (const id of overrideEligible) {
    try {
      const result = await friendsApi.deleteGameFriend(accountId, id, {
        source: 'manual_single',
        overrideProtected: true,
        overrideReason,
      });
      if (result && (result.success || (typeof result.code === 'undefined' && !result.error))) {
        overrideRemoved++;
        try { console.log(`${logPrefix} removed player=${id}`); } catch (_) {}
      } else if (result && (result.code === 'SYSTEM_BLOCKED_FRIEND' || result.code === 'PROTECTED_FRIEND')) {
        overrideFailed++;
        try {
          const reasons = (result.protectionReasons || []).map(r => r.type).join(',');
          console.log(`[MANUAL_SELECTED_BLOCKED] player=${id} code=${result.code} reasons=[${reasons}]`);
        } catch (_) {}
      } else {
        overrideFailed++;
        try { console.warn(`${logPrefix} non-success result for player=${id}:`, result); } catch (_) {}
      }
    } catch (singleErr) {
      overrideFailed++;
      try { console.warn(`${logPrefix} threw for player=${id}: ${singleErr && singleErr.message}`); } catch (_) {}
    }
  }

  return { overrideRemoved, overrideFailed };
}

// Constant export so callers can reference the canonical cap in toast text.
export { MAX_OVERRIDE_BATCH };
