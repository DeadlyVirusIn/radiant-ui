/**
 * Hybrid Control safety helpers — pure, testable.
 *
 * All of these are callable without React. The component wires them into
 * the preview dialog and per-user cards.
 */

'use strict';

export const STALENESS = Object.freeze({
  FRESH:  'fresh',     // < 45s — actions safe
  AGING:  'aging',     // 45s–2min — soft warning
  STALE:  'stale',     // > 2min — block actions, require refresh
});

export const SOURCE = Object.freeze({
  AUTO:           'auto',
  MANUAL:         'manual',
  PINNED:         'pinned',
  DEFAULT:        'default',
  RECENT_OVERRIDE:'recent-override',
});

const FRESH_MS = 45 * 1000;
const STALE_MS = 2 * 60 * 1000;
const RECENT_OVERRIDE_MS = 10 * 60 * 1000; // 10-min "recent" marker for badges

const STANDARD_GROUPS = [1, 2, 3];
const LEGACY_GROUP = 4;

/**
 * Classify response age. `generatedAt` can be an ISO string, a Date, or ms.
 */
export function classifyStaleness(generatedAt, now = Date.now()) {
  if (!generatedAt) return STALENESS.STALE;
  const t = typeof generatedAt === 'number'
    ? generatedAt
    : new Date(generatedAt).getTime();
  if (!Number.isFinite(t)) return STALENESS.STALE;
  const age = now - t;
  if (age < 0) return STALENESS.FRESH;
  if (age < FRESH_MS) return STALENESS.FRESH;
  if (age < STALE_MS) return STALENESS.AGING;
  return STALENESS.STALE;
}

/**
 * Given the current user list, produce { [group]: userCount } for all four
 * containers after a proposed move. Also returns the resulting imbalance.
 *
 * imbalance = max(standard container count) − min(standard container count).
 * The legacy group (C4) is not included in imbalance math because policy
 * pins legacy users there.
 */
export function projectedLoadAfterMove(users, fromGroup, toGroup) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const seen = new Set();
  for (const u of users || []) {
    // Count distinct users by discordId + accountType (same key the backend uses).
    const key = `${u.discordId}:${u.accountType || 'main'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const g = Number(u.containerGroup) || 0;
    if (counts[g] != null) counts[g] += 1;
  }
  if (counts[fromGroup] != null) counts[fromGroup] = Math.max(0, counts[fromGroup] - 1);
  if (counts[toGroup]   != null) counts[toGroup]   = counts[toGroup] + 1;

  const std = STANDARD_GROUPS.map(g => counts[g] || 0);
  const imbalance = std.length ? Math.max(...std) - Math.min(...std) : 0;
  return { counts, imbalance };
}

/**
 * Compute the imbalance of the current state (no move applied).
 */
export function currentImbalance(users) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const seen = new Set();
  for (const u of users || []) {
    const key = `${u.discordId}:${u.accountType || 'main'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const g = Number(u.containerGroup) || 0;
    if (counts[g] != null) counts[g] += 1;
  }
  const std = STANDARD_GROUPS.map(g => counts[g] || 0);
  const imbalance = std.length ? Math.max(...std) - Math.min(...std) : 0;
  return { counts, imbalance };
}

/**
 * True if the proposed move would make imbalance worse than the current
 * state. Used to gate the confirm button in red.
 */
export function moveWorsensImbalance(users, fromGroup, toGroup) {
  const before = currentImbalance(users).imbalance;
  const after = projectedLoadAfterMove(users, fromGroup, toGroup).imbalance;
  return after > before;
}

/**
 * Derive the placement-source label for a user row. Priority (highest first):
 *   1. pinned          → "Pinned"
 *   2. manual          → "Manual override"
 *   3. recent override → "Recent override" (moved < 10 min ago, not manual)
 *   4. auto            → "Auto"
 *   5. default         → "Default" (never moved, unassigned, no mode)
 */
export function sourceOfPlacement(user, now = Date.now()) {
  if (!user) return SOURCE.DEFAULT;
  if (user.pinned) return SOURCE.PINNED;
  if (user.assignmentMode === 'manual') return SOURCE.MANUAL;
  if (user.lastMovedAt) {
    const age = now - new Date(user.lastMovedAt).getTime();
    if (Number.isFinite(age) && age < RECENT_OVERRIDE_MS) return SOURCE.RECENT_OVERRIDE;
    return SOURCE.AUTO;
  }
  return SOURCE.DEFAULT;
}

export function sourceLabel(source) {
  switch (source) {
    case SOURCE.AUTO:            return 'Auto';
    case SOURCE.MANUAL:          return 'Manual';
    case SOURCE.PINNED:          return 'Pinned';
    case SOURCE.DEFAULT:         return 'Default';
    case SOURCE.RECENT_OVERRIDE: return 'Recent';
    default:                     return 'Unknown';
  }
}

export function sourceColor(source) {
  switch (source) {
    case SOURCE.MANUAL:          return '#8B5CF6'; // purple — deliberate
    case SOURCE.PINNED:          return '#F59E0B'; // amber
    case SOURCE.RECENT_OVERRIDE: return '#3B82F6'; // blue — info
    case SOURCE.AUTO:            return '#22C55E'; // green
    default:                     return '#6B7280'; // gray
  }
}

/**
 * Safety gate for a proposed action. Returns { allowed, severity, reason }.
 * Severity: 'block' (must refresh), 'warn' (proceed with confirm), or null.
 *
 * Inputs:
 *   action: 'move' | 'pin' | 'rebalance' | 'reconcile'
 *   generatedAt: data timestamp
 *   context: { users, fromGroup, toGroup, targetUser } (move-specific)
 */
export function evaluateActionSafety({ action, generatedAt, context = {}, now = Date.now() }) {
  const staleness = classifyStaleness(generatedAt, now);

  // Stale data always blocks live actions. Aging triggers a soft warn.
  if (staleness === STALENESS.STALE) {
    return {
      allowed: false,
      severity: 'block',
      reason: 'Data is more than 2 minutes old. Refresh before proceeding.',
    };
  }

  if (action === 'move' && context.users && context.fromGroup != null && context.toGroup != null) {
    if (moveWorsensImbalance(context.users, context.fromGroup, context.toGroup)) {
      return {
        allowed: true,
        severity: 'warn',
        reason: 'This move would worsen container imbalance.',
      };
    }
  }

  if (staleness === STALENESS.AGING) {
    return {
      allowed: true,
      severity: 'warn',
      reason: 'Data is more than 45 seconds old. Consider refreshing.',
    };
  }

  return { allowed: true, severity: null, reason: null };
}

/**
 * True if two recent invocations of the same action target are likely a
 * duplicate submit (same entity+action+target within N ms).
 */
export function isDuplicateAction({ actionKey, lastAction, windowMs = 1500, now = Date.now() }) {
  if (!actionKey || !lastAction) return false;
  if (lastAction.key !== actionKey) return false;
  return (now - lastAction.at) < windowMs;
}
