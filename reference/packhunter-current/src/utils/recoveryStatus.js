/**
 * Pure helpers for rendering recovery state in admin UI. No React.
 */

export const RECOVERY_MODES = Object.freeze({
  OFF:       'off',
  DRY_RUN:   'dry-run',
  // Phase 25A — Assist Mode sits between DRY_RUN and LIVE_SAFE:
  // auto-executes ONLY low-risk actions, surfaces everything else as
  // recommendations.
  ASSIST:    'assist',
  LIVE_SAFE: 'live-safe',
});

export const MODE_LABEL = {
  off:         'Off',
  'dry-run':   'Dry-run',
  'assist':    'Assist',
  'live-safe': 'Live (safe)',
};

// C5 (2026-04-24) — canonical "SAFE-style" upper-case alias for the
// status-display surface. The MODE_LABEL values above remain as-is
// because they drive the operator-selectable Menu items where familiar
// names reduce mis-clicks. The status chips use MODE_LABEL_CANONICAL
// so display is consistent with OpsHealthSummary / RecoveryStatusPanel
// (both of which read huntConstants.formatRecoveryLabels()).
export const MODE_LABEL_CANONICAL = {
  off:         'OFF',
  'dry-run':   'DRY-RUN',
  'assist':    'ASSIST',
  'live-safe': 'SAFE',
};

export const IMPACT_LABEL = {
  off:         'None (not running)',
  'dry-run':   'None (observe only)',
  'assist':    'Moderate',
  'live-safe': 'Minimal',
};

export const MODE_COLOR = {
  off:         'default',
  'dry-run':   'warning',
  'assist':    'info',
  'live-safe': 'success',
};

export const ACTION_LABEL = {
  'refresh-bot-status':    'Probe bot status',
  'refresh-friend-count':  'Probe friend count',
  'refresh-fleet-summary': 'Refresh fleet summary',
  'mark-for-attention':    'Mark for attention',
  // Phase 25A — low-risk maintenance actions.
  'resolve-suppressed':      'Resolve (entity healthy)',
  'deduplicate-findings':    'Deduplicate findings',
  'auto-suppress-noise':     'Auto-suppress noise',
  // Phase 25A.1 — real low-risk recovery actions.
  'refresh-container-state':    'Refresh container state',
  'retry-stalled-hunter':       'Retry stalled hunter',
  'revalidate-pack-assignment': 'Revalidate pack assignment',
  'requeue-light-task':         'Requeue light task',
  // Phase 25A.2 — stale-lock cleanup.
  'clear-stale-lock':           'Clear stale lock',
  'escalate':                'Escalate',
  'none':                    '—',
};

// Phase 25A.2 — action → impact category. Used by the UI to put a
// concise badge next to each decision so admins can see *what kind*
// of value each action delivered without reading the reason string.
//   fixed    — cleared an entry / resolved an issue
//   improved — transitioned state (stale → fresh, orphaned → clean)
//   checked  — idempotent re-observation, no state mutation
export const ACTION_CATEGORY = {
  // fixed — entries removed
  'refresh-container-state':    'fixed',
  'resolve-suppressed':         'fixed',
  'clear-stale-lock':           'fixed',
  // improved — measurable state change
  'retry-stalled-hunter':       'improved',
  'requeue-light-task':         'improved',
  'auto-suppress-noise':        'improved',
  // checked — observational
  'refresh-bot-status':         'checked',
  'refresh-friend-count':       'checked',
  'refresh-fleet-summary':      'checked',
  'revalidate-pack-assignment': 'checked',
  'deduplicate-findings':       'checked',
  'mark-for-attention':         'checked',
  // medium/high — rendered as their own risk chip instead
  'escalate':                   'checked',
  'none':                       null,
};
export const CATEGORY_LABEL = {
  fixed:    'Fixed',
  improved: 'Improved',
  checked:  'Checked',
};

// Phase 25A — risk badge tokens for the decision row. Kept in sync with
// lib/recoveryEngine.js's RISK_LEVELS constant.
export const RISK_LABEL = {
  low:    'Low-risk',
  medium: 'Medium-risk',
  high:   'High-risk',
  none:   '—',
};
export const RISK_COLOR = {
  low:    'success',
  medium: 'warning',
  high:   'error',
  none:   'default',
};

export function formatCooldown(cooldownUntil, now = Date.now()) {
  if (!cooldownUntil) return null;
  const ms = Number(cooldownUntil) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'expired';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}m`;
}

export function formatAttempts(entry) {
  const attempts = Array.isArray(entry?.attempts) ? entry.attempts.length : 0;
  return `${attempts}/3`;
}

/** Returns { state, label } matching StatusDot states. */
export function entryToStatusDotState(entry) {
  if (!entry) return { state: 'idle', label: 'No recovery' };
  if (entry.escalated) return { state: 'error', label: 'Escalated — needs ack' };
  if (entry.lastVerificationResult === 'failed') return { state: 'warning', label: 'Recovery failed — retrying' };
  if (entry.lastVerificationResult === 'pending') return { state: 'warning', label: 'Recovery pending' };
  return { state: 'idle', label: 'Tracked' };
}

/**
 * Summarize a list of entries into counts the Fleet Health strip uses.
 * Always returns all four keys so the UI doesn't have to guard.
 */
export function summarizeRecoveryState(entries) {
  const out = { total: 0, pending: 0, failed: 0, escalated: 0 };
  for (const e of entries || []) {
    out.total++;
    if (e.escalated) out.escalated++;
    else if (e.lastVerificationResult === 'failed') out.failed++;
    else if (e.lastVerificationResult === 'pending') out.pending++;
  }
  return out;
}
