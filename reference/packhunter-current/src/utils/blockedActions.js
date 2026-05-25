/**
 * Shared blocked-action reason system.
 *
 * Single source of truth for "why can't I click this?" across admin
 * surfaces. Pure functions, no React. UI components consume the Reason
 * objects this file produces.
 *
 * Reason shape (all fields stable across releases — UI may render any subset):
 *
 *   {
 *     action: 'hunter.move' | 'hunter.pin' | 'hunter.startBot' | …,
 *     allowed: boolean,
 *     kind: ReasonKind,            // machine-readable category
 *     label: string,               // 1–2 word chip label ("Pinned", "Cooldown 18m")
 *     shortReason: string,         // 1-line caption shown inline on disabled rows
 *     fullReason: string,          // long sentence shown in tooltip / drawer
 *     severity: 'info'|'warning'|'error',
 *     retryAt: number|null,        // ms timestamp when the block lifts (cooldown only)
 *     suggestedFix: string|null,   // one-line operator action ("Unpin to allow moves")
 *   }
 *
 * Helpers to remember:
 *   - resolveBlockedReason(action, ctx)        — primary API; returns Reason
 *   - REASON_KINDS                              — constants for switch / tests
 *   - kindMeta(kind)                            — color + iconName + severity defaults
 *
 * Resolvers always return the FIRST matching block (priority order is
 * encoded in each resolver). Policy/identity blocks rank above per-user
 * state which ranks above transient state (cooldown/in-flight/stale).
 */

'use strict';

export const REASON_KINDS = Object.freeze({
  // Policy / structural (cannot be overridden by an admin click)
  POLICY_RESTRICTED:   'policy-restricted',
  OWNER_PROTECTED:     'owner-protected',
  SELF_PROTECTED:      'self-protected',
  ADMIN_PROTECTED:     'admin-protected',
  // Per-user state (admin can clear)
  PINNED:              'pinned',
  MANUAL_OVERRIDE:     'manual-override',
  NO_LINKED_ACCOUNT:   'no-linked-account',
  BOT_NOT_RUNNING:     'bot-not-running',
  // Phase 17 — additional state-level kinds from the unified spec.
  // missing-setup    — preconditions like "DC.bin not uploaded"
  // blocked-by-mode  — mode='off' suppresses recommendations / actions
  // capacity         — finite resource hit (friend list cap, slot cap, etc.)
  MISSING_SETUP:       'missing-setup',
  BLOCKED_BY_MODE:     'blocked-by-mode',
  CAPACITY:            'capacity',
  // Transient (waits or refresh)
  COOLDOWN:            'cooldown',
  STALE_DATA:          'stale-data',
  IN_FLIGHT:           'in-flight',
  // Insufficient context — we don't know enough to permit the action
  INSUFFICIENT_DATA:   'insufficient-data',
});

const KIND_META = {
  // grey — policy
  [REASON_KINDS.POLICY_RESTRICTED]: { color: '#6B7280', severity: 'info',    label: 'Policy' },
  [REASON_KINDS.OWNER_PROTECTED]:   { color: '#6B7280', severity: 'info',    label: 'Owner' },
  [REASON_KINDS.SELF_PROTECTED]:    { color: '#6B7280', severity: 'info',    label: 'Self' },
  [REASON_KINDS.ADMIN_PROTECTED]:   { color: '#6B7280', severity: 'info',    label: 'Admin' },
  // amber — pinned (admin intent)
  [REASON_KINDS.PINNED]:            { color: '#F59E0B', severity: 'info',    label: 'Pinned' },
  // purple — manual override (admin intent)
  [REASON_KINDS.MANUAL_OVERRIDE]:   { color: '#8B5CF6', severity: 'info',    label: 'Manual' },
  // grey — missing infra
  [REASON_KINDS.NO_LINKED_ACCOUNT]: { color: '#6B7280', severity: 'warning', label: 'No account' },
  [REASON_KINDS.BOT_NOT_RUNNING]:   { color: '#6B7280', severity: 'warning', label: 'Bot off' },
  // amber — setup gap (operator action required to enable)
  [REASON_KINDS.MISSING_SETUP]:     { color: '#F59E0B', severity: 'warning', label: 'Setup needed' },
  // grey — feature flag / mode disabled
  [REASON_KINDS.BLOCKED_BY_MODE]:   { color: '#6B7280', severity: 'info',    label: 'Mode off' },
  // red — finite resource exhausted
  [REASON_KINDS.CAPACITY]:          { color: '#EF4444', severity: 'warning', label: 'At capacity' },
  // blue — transient
  [REASON_KINDS.COOLDOWN]:          { color: '#3B82F6', severity: 'info',    label: 'Cooldown' },
  [REASON_KINDS.STALE_DATA]:        { color: '#EF4444', severity: 'error',   label: 'Stale' },
  [REASON_KINDS.IN_FLIGHT]:         { color: '#3B82F6', severity: 'info',    label: 'Working…' },
  // generic
  [REASON_KINDS.INSUFFICIENT_DATA]: { color: '#6B7280', severity: 'info',    label: 'Unknown' },
};

/** Lookup palette + default label for a reason kind. */
export function kindMeta(kind) {
  return KIND_META[kind] || { color: '#6B7280', severity: 'info', label: 'Blocked' };
}

/** Construct an "allowed" Reason — passed through UI as a no-op marker. */
export function allow(action) {
  return { action, allowed: true, kind: null, label: null, shortReason: null,
           fullReason: null, severity: null, retryAt: null, suggestedFix: null };
}

/** Construct a deny Reason. All fields default sensibly from `kind`. */
export function deny({ action, kind, label, shortReason, fullReason, severity, retryAt, suggestedFix }) {
  const meta = kindMeta(kind);
  return {
    action,
    allowed: false,
    kind,
    label: label || meta.label,
    shortReason: shortReason || fullReason || '',
    fullReason: fullReason || shortReason || '',
    severity: severity || meta.severity,
    retryAt: retryAt || null,
    suggestedFix: suggestedFix || null,
  };
}

/* ════════════════════════════════════════════════════════════════════
 * Action-specific resolvers
 *
 * Each takes a single context object so call sites can be self-documenting.
 * Returns either an `allow()` or a `deny()` Reason — never both, never null.
 * ════════════════════════════════════════════════════════════════════ */

/**
 * Drag a hunter between containers.
 * ctx: { user, isLegacyContainer, moveCooldownMinutes, now }
 */
export function canMoveHunter({ user, isLegacyContainer = false, moveCooldownMinutes = 30, now = Date.now() }) {
  if (!user) {
    return deny({ action: 'hunter.move', kind: REASON_KINDS.INSUFFICIENT_DATA,
      fullReason: 'Hunter data unavailable.' });
  }
  // Policy first — uncoverable by admin action.
  if (user.isLegacy) {
    return deny({ action: 'hunter.move', kind: REASON_KINDS.POLICY_RESTRICTED,
      label: 'Legacy',
      shortReason: 'Legacy users routed to C4',
      fullReason: 'Legacy users are routed to C4 by assignment policy.' });
  }
  if (isLegacyContainer && !user.isLegacy) {
    return deny({ action: 'hunter.move', kind: REASON_KINDS.POLICY_RESTRICTED,
      label: 'Std-only',
      shortReason: 'Standard users cannot be in C4',
      fullReason: 'Standard users cannot be placed in C4.' });
  }
  // Per-user state — admin can clear.
  if (user.pinned) {
    return deny({ action: 'hunter.move', kind: REASON_KINDS.PINNED,
      shortReason: 'Pinned — auto-rebalancer skips this user',
      fullReason: 'Pinned — excluded from auto-rebalance. Unpin to enable dragging.',
      suggestedFix: 'Unpin to allow moves' });
  }
  if (user.assignmentMode === 'manual') {
    return deny({ action: 'hunter.move', kind: REASON_KINDS.MANUAL_OVERRIDE,
      shortReason: 'Manual override',
      fullReason: 'Manually assigned by admin. Use the hand-back-to-auto control to allow moves.',
      suggestedFix: 'Hand back to auto' });
  }
  // Transient — server enforces cooldown via last_moved_at filter; UI mirrors.
  if (user.lastMovedAt && Number.isFinite(moveCooldownMinutes) && moveCooldownMinutes > 0) {
    const movedAt = new Date(user.lastMovedAt).getTime();
    const ageMs = now - movedAt;
    const cooldownMs = moveCooldownMinutes * 60_000;
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < cooldownMs) {
      const remainMin = Math.ceil((cooldownMs - ageMs) / 60_000);
      return deny({
        action: 'hunter.move',
        kind: REASON_KINDS.COOLDOWN,
        label: `Cooldown ${remainMin}m`,
        shortReason: `Move cooldown — ${remainMin}m remaining`,
        fullReason: `Move cooldown — moved ${Math.round(ageMs / 60_000)}m ago. Auto-rebalancer skips this user for ${remainMin}m more.`,
        retryAt: movedAt + cooldownMs,
        suggestedFix: `Wait ${remainMin}m or move manually anyway`,
      });
    }
  }
  return allow('hunter.move');
}

/**
 * Pin / unpin a hunter. Always allowed for an admin — included for symmetry
 * so call sites can use the same `<BlockedReason>` chip for the in-flight
 * spinner state.
 * ctx: { user, pendingKey }
 */
export function canPinHunter({ user, pendingKey = null }) {
  if (!user) {
    return deny({ action: 'hunter.pin', kind: REASON_KINDS.INSUFFICIENT_DATA });
  }
  if (pendingKey === `pin:${user.id}`) {
    return deny({ action: 'hunter.pin', kind: REASON_KINDS.IN_FLIGHT,
      shortReason: 'Saving…', fullReason: 'Previous pin/unpin still saving.' });
  }
  return allow('hunter.pin');
}

/**
 * Start or stop the friend-acceptor bot for a hunter.
 * ctx: { participant, botStatus, isStop }
 */
export function canBotControl({ participant, botStatus = null, isStop = false }) {
  const action = isStop ? 'hunter.stopBot' : 'hunter.startBot';
  if (!participant) {
    return deny({ action, kind: REASON_KINDS.INSUFFICIENT_DATA });
  }
  if (!participant.player_id) {
    return deny({ action, kind: REASON_KINDS.NO_LINKED_ACCOUNT,
      shortReason: 'No linked account',
      fullReason: 'This Discord user has no linked PTCGP account. Link an account before starting the bot.',
      suggestedFix: 'Link a PTCGP account in WebUI Users' });
  }
  if (botStatus?.status === 'no_account') {
    return deny({ action, kind: REASON_KINDS.NO_LINKED_ACCOUNT,
      shortReason: 'Bot reports no account',
      fullReason: 'Bot manager has no account record for this player. Verify the account is linked correctly.',
      suggestedFix: 'Re-link account' });
  }
  if (botStatus?.loading) {
    return deny({ action, kind: REASON_KINDS.IN_FLIGHT,
      shortReason: 'Saving…', fullReason: 'Previous bot action still in flight.' });
  }
  return allow(action);
}

/**
 * Refresh a hunter's friend count. Requires a running bot to query.
 * ctx: { participant, botStatus }
 */
export function canRefreshFriendCount({ participant, botStatus = null }) {
  if (!participant?.player_id) {
    return deny({ action: 'hunter.refreshFriends', kind: REASON_KINDS.NO_LINKED_ACCOUNT,
      shortReason: 'No linked account', fullReason: 'Link a PTCGP account first.' });
  }
  if (botStatus?.status !== 'running') {
    return deny({ action: 'hunter.refreshFriends', kind: REASON_KINDS.BOT_NOT_RUNNING,
      shortReason: 'Bot not running',
      fullReason: 'Friend count is fetched live by the bot. Start the bot to refresh.',
      suggestedFix: 'Start the friend-acceptor bot' });
  }
  return allow('hunter.refreshFriends');
}

/**
 * Toggle admin role on a user.
 * ctx: { targetUser, currentUser }
 */
export function canToggleAdmin({ targetUser, currentUser }) {
  if (!targetUser || !currentUser) {
    return deny({ action: 'admin.toggleAdmin', kind: REASON_KINDS.INSUFFICIENT_DATA });
  }
  if (targetUser.id === currentUser.id) {
    return deny({ action: 'admin.toggleAdmin', kind: REASON_KINDS.SELF_PROTECTED,
      label: 'You',
      shortReason: 'Cannot modify your own admin status',
      fullReason: 'You cannot grant or revoke your own admin role. Ask another admin to change it.' });
  }
  if (targetUser.is_owner) {
    return deny({ action: 'admin.toggleAdmin', kind: REASON_KINDS.OWNER_PROTECTED,
      shortReason: 'Owner is protected',
      fullReason: 'Owner accounts always have admin and cannot be revoked.' });
  }
  return allow('admin.toggleAdmin');
}

/**
 * Toggle active status on a user.
 * ctx: { targetUser, currentUser }
 */
export function canToggleActive({ targetUser, currentUser }) {
  if (!targetUser || !currentUser) {
    return deny({ action: 'admin.toggleActive', kind: REASON_KINDS.INSUFFICIENT_DATA });
  }
  if (targetUser.id === currentUser.id) {
    return deny({ action: 'admin.toggleActive', kind: REASON_KINDS.SELF_PROTECTED,
      label: 'You',
      shortReason: 'Cannot deactivate yourself',
      fullReason: 'You cannot deactivate your own account.' });
  }
  if (targetUser.is_owner) {
    return deny({ action: 'admin.toggleActive', kind: REASON_KINDS.OWNER_PROTECTED,
      shortReason: 'Owner is protected',
      fullReason: 'Owner accounts cannot be deactivated.' });
  }
  return allow('admin.toggleActive');
}

/**
 * Delete a user.
 * ctx: { targetUser, currentUser }
 */
export function canDeleteUser({ targetUser, currentUser }) {
  if (!targetUser || !currentUser) {
    return deny({ action: 'admin.deleteUser', kind: REASON_KINDS.INSUFFICIENT_DATA });
  }
  if (targetUser.id === currentUser.id) {
    return deny({ action: 'admin.deleteUser', kind: REASON_KINDS.SELF_PROTECTED,
      label: 'You',
      shortReason: 'Cannot delete yourself',
      fullReason: 'You cannot delete your own account.' });
  }
  if (targetUser.is_owner) {
    return deny({ action: 'admin.deleteUser', kind: REASON_KINDS.OWNER_PROTECTED,
      shortReason: 'Owner is protected',
      fullReason: 'Owner accounts cannot be deleted.' });
  }
  if (targetUser.is_admin) {
    return deny({ action: 'admin.deleteUser', kind: REASON_KINDS.ADMIN_PROTECTED,
      shortReason: 'Revoke admin first',
      fullReason: 'Admin accounts cannot be deleted directly. Revoke admin role, then delete.' });
  }
  return allow('admin.deleteUser');
}

/**
 * Apply a fleet rebalance recommendation. Used by Hybrid Control + Fleet
 * Health "Apply" buttons. Mirrors lib/rebalancePolicy gate semantics for
 * the *operator* surface (does not reach into server-side cooldown/cap —
 * those are surfaced via skipped-attempt audit rows).
 *
 * ctx: { recommendation, generatedAt, mode, now }
 */
export function canApplyRebalance({ recommendation, generatedAt, mode = 'recommend-only', now = Date.now() }) {
  if (!recommendation) {
    return deny({ action: 'rebalance.apply', kind: REASON_KINDS.INSUFFICIENT_DATA,
      shortReason: 'No recommendation', fullReason: 'No recommendation data available.' });
  }
  if (mode === 'off') {
    return deny({ action: 'rebalance.apply', kind: REASON_KINDS.POLICY_RESTRICTED,
      label: 'Mode off',
      shortReason: 'Recommendations disabled',
      fullReason: 'Rebalance policy mode is off. Switch to recommend-only or auto-apply to enable.',
      suggestedFix: 'Change policy mode' });
  }
  if (recommendation.status !== 'recommended' && recommendation.status !== 'weak') {
    return deny({ action: 'rebalance.apply', kind: REASON_KINDS.POLICY_RESTRICTED,
      label: 'Not actionable',
      shortReason: `Status: ${recommendation.status}`,
      fullReason: `Recommendation status is "${recommendation.status}" — nothing safe to apply right now.` });
  }
  if (generatedAt) {
    const age = now - new Date(generatedAt).getTime();
    if (Number.isFinite(age) && age > 2 * 60_000) {
      return deny({ action: 'rebalance.apply', kind: REASON_KINDS.STALE_DATA,
        shortReason: `Data ${Math.round(age/60_000)}m old`,
        fullReason: `Recommendation data is more than 2 minutes old. Refresh before applying.`,
        suggestedFix: 'Refresh' });
    }
  }
  return allow('rebalance.apply');
}
