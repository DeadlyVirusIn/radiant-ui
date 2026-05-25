/**
 * Phase 17 — last-action summary aggregator.
 *
 * No new storage. Reads from existing payloads:
 *   - /api/hunt/hybrid-control  → recentAudit, rebalancePolicy.recentAttempts
 *   - /api/admin/recovery/audit → recovery audit ring
 *
 * Returns a small set of one-line summaries (last manual move, last
 * auto-apply attempt, last block reason) bounded to the last RETENTION_MS.
 *
 * Pure — no fetches. Caller passes the snapshot.
 */

'use strict';

const RETENTION_MS = 30 * 60 * 1000;  // 30 min

function ageMin(ts, now) {
  if (!ts) return Infinity;
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, Math.round((now - t) / 60_000));
}

function relAgo(ts, now) {
  const m = ageMin(ts, now);
  if (!Number.isFinite(m)) return '';
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/**
 * Build summary lines from a /hybrid-control response.
 *
 * @param {object} args
 * @param {object} args.hybridControl  full /hybrid-control response
 * @param {number} [args.now]
 * @param {number} [args.limit]        max lines to return (default 3)
 * @returns {Array<{ kind, severity, text, ts }>}  newest first
 */
export function summarizeHybridControl({ hybridControl, now = Date.now(), limit = 3 } = {}) {
  if (!hybridControl) return [];
  const lines = [];

  // 1. Last manual move (from hunt_assignment_audit)
  const audit = hybridControl.recentAudit || [];
  const manualMove = audit.find(r => r.action_type === 'manual_move' && ageMin(r.created_at, now) <= RETENTION_MS / 60_000);
  if (manualMove) {
    const who = manualMove.username || 'user';
    const fromTo = (manualMove.from_group != null && manualMove.to_group != null)
      ? ` C${manualMove.from_group}→C${manualMove.to_group}` : '';
    const by = manualMove.actor_id ? ` by ${manualMove.actor_id}` : '';
    lines.push({
      kind: 'manual_move',
      severity: 'info',
      text: `Last move: ${who}${fromTo}${by} ${relAgo(manualMove.created_at, now)}`,
      ts: new Date(manualMove.created_at).getTime(),
    });
  }

  // 2. Last auto-apply attempt (from rebalancePolicy.recentAttempts)
  const attempts = hybridControl.rebalancePolicy?.recentAttempts || [];
  const lastApply = attempts.find(a => a.kind === 'apply' && ageMin(a.ts, now) <= RETENTION_MS / 60_000);
  if (lastApply) {
    const verb =
      lastApply.outcome === 'ok'      ? 'applied' :
      lastApply.outcome === 'skipped' ? `skipped (${lastApply.blocker || lastApply.reason || 'gate'})` :
      lastApply.outcome === 'no-op'   ? 'no-op' :
      'failed';
    const move = lastApply.move
      ? ` — ${lastApply.move.username || 'user'} C${lastApply.move.fromGroup}→C${lastApply.move.toGroup}`
      : '';
    lines.push({
      kind: 'auto_apply',
      severity: lastApply.outcome === 'ok' ? 'success' : lastApply.outcome === 'failed' ? 'error' : 'info',
      text: `Last auto-apply: ${verb} ${relAgo(lastApply.ts, now)}${move}`,
      ts: lastApply.ts,
    });
  }

  // 3. Last block reason (most recent recommendation that was 'blocked')
  if (hybridControl.recommendation?.status === 'blocked') {
    const blockers = hybridControl.recommendation.blockers || [];
    const reason = blockers.length ? blockers.join(', ') : 'no movable users';
    lines.push({
      kind: 'last_block',
      severity: 'warning',
      text: `Currently blocked: ${reason}`,
      ts: hybridControl.generatedAt ? new Date(hybridControl.generatedAt).getTime() : now,
    });
  }

  // Newest first.
  lines.sort((a, b) => b.ts - a.ts);
  return lines.slice(0, limit);
}

/**
 * Compact summary for Fleet Health: pulls from rebalanceHeadline +
 * lastApply (already on the headline) — does NOT require the full
 * /hybrid-control response.
 */
export function summarizeFleetHeadline({ rebalanceHeadline, now = Date.now() } = {}) {
  if (!rebalanceHeadline) return [];
  const lines = [];

  if (rebalanceHeadline.lastApply?.ts) {
    const a = rebalanceHeadline.lastApply;
    lines.push({
      kind: 'auto_apply',
      severity: 'success',
      text: `Last rebalance: imbalance ${a.imbalanceBefore}→${a.imbalanceAfter} ${relAgo(a.ts, now)}`,
      ts: a.ts,
    });
  }
  if (rebalanceHeadline.status === 'blocked' && rebalanceHeadline.blockers?.length) {
    lines.push({
      kind: 'last_block',
      severity: 'warning',
      text: `Blocked: ${rebalanceHeadline.blockers.join(', ')}`,
      ts: now,
    });
  }
  return lines;
}

export { RETENTION_MS, relAgo, ageMin };
