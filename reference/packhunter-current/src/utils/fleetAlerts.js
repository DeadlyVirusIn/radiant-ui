/**
 * Phase 7 — deterministic in-app alert derivation from Fleet Summary.
 *
 * Input: current fleet tiles + previousAlerts (for `since`-persistence) +
 * a `stalenessMs` number (client computes staleness vs generatedAt).
 *
 * Output: sorted alerts (critical first). Each alert has a STABLE `id` so
 * persistence across refreshes works without flicker — if an alert id
 * re-appears on the next tick its `since` / `firstSeenAt` are carried over.
 *
 * Deliberately NOT reactive to every tick — rules only fire on
 * thresholds, not on every numeric wiggle. Severity is explicit (no
 * fuzzy math).
 */

export const SEVERITY = { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' };

// Thresholds — single place ops can audit.
const IDLE_WARN = 5;
const IDLE_CRIT = 15;
const ERRORS_WARN = 1;
const ERRORS_CRIT = 5;
const FLAGS_WARN = 1;
const FLAGS_CRIT = 3;
const STALE_DATA_MS = 2 * 60 * 1000; // 2 min without a fresh fleet-summary
const PPM_DROP_PCT = 20;             // 20% drop vs median of recent samples

const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };

function valueOf(tile) { return Number(tile?.value ?? 0); }

function ruleZeroHunters(tiles) {
  const active = valueOf(tiles.activeHunters);
  if (active > 0) return null;
  // Only fire if there ARE paid users to hunt — otherwise "0 active"
  // is a healthy off-cycle state, not an incident.
  const paid = valueOf(tiles.paidActive);
  if (paid === 0) return null;
  return {
    id: 'zero-active-hunters',
    severity: SEVERITY.CRITICAL,
    title: 'No active hunters',
    body: `Zero users hunting with ${paid} paid user${paid === 1 ? '' : 's'} present.`,
    href: '/admin/users?tab=hunters',
  };
}

function ruleTooManyIdle(tiles) {
  const v = valueOf(tiles.idleHunters);
  if (v < IDLE_WARN) return null;
  const sev = v >= IDLE_CRIT ? SEVERITY.CRITICAL : SEVERITY.WARNING;
  return {
    id: 'too-many-idle',
    severity: sev,
    title: `${v} hunters idle`,
    body: 'Active packs with no updates in 30+ min.',
    href: '/admin/users?tab=hunters&hunterState=warning',
  };
}

function ruleErrors(tiles) {
  const v = valueOf(tiles.errorHunters);
  if (v < ERRORS_WARN) return null;
  const sev = v >= ERRORS_CRIT ? SEVERITY.CRITICAL : SEVERITY.WARNING;
  return {
    id: 'hunters-in-error',
    severity: sev,
    title: `${v} hunter${v === 1 ? '' : 's'} in error`,
    body: 'Active packs with repeated failures.',
    href: '/admin/users?tab=hunters&hunterState=error',
  };
}

function ruleAttentionItems(tiles) {
  const v = valueOf(tiles.flags);
  if (v < FLAGS_WARN) return null;
  const sev = v >= FLAGS_CRIT ? SEVERITY.WARNING : SEVERITY.INFO;
  return {
    id: 'attention-items',
    severity: sev,
    title: `${v} attention item${v === 1 ? '' : 's'}`,
    body: 'Paid subscribers not yet linked to a WebUI user.',
    href: '/admin/users',
  };
}

function ruleStaleData(_, { stalenessMs }) {
  if (!Number.isFinite(stalenessMs) || stalenessMs < STALE_DATA_MS) return null;
  return {
    id: 'stale-data',
    severity: SEVERITY.WARNING,
    title: 'Fleet Health data is stale',
    body: `No refresh in ${Math.round(stalenessMs / 60000)}m — auto-refresh may have stalled.`,
    href: null,
  };
}

function rulePpmDrop(tiles) {
  const hist = tiles.recentGodPacks?.history || [];
  if (hist.length < 6) return null;
  const current = Number(hist[hist.length - 1]?.value || 0);
  const priorWindow = hist.slice(0, -1);
  const median = computeMedian(priorWindow.map(p => Number(p.value || 0)));
  if (!(median > 0)) return null;
  const dropPct = ((median - current) / median) * 100;
  if (dropPct < PPM_DROP_PCT) return null;
  return {
    id: 'gp-throughput-drop',
    severity: SEVERITY.INFO,
    title: `God-pack throughput ${Math.round(dropPct)}% below recent`,
    body: `Last sample ${current} vs recent median ${median}.`,
    href: '/godpacks',
  };
}

function computeMedian(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Derive the current alert list.
 *
 * @param {object} args
 * @param {object} args.tiles          The `tiles` object from /fleet-summary
 * @param {Array}  [args.previousAlerts] Prior list (for `since` carry-over)
 * @param {number} [args.stalenessMs]  ms since generatedAt (client computes)
 * @param {number} [args.now]          override for tests
 * @returns {Array<object>}
 */
export function deriveAlerts({ tiles, previousAlerts = [], stalenessMs = 0, now = Date.now() } = {}) {
  if (!tiles) return [];

  const rules = [ruleZeroHunters, ruleTooManyIdle, ruleErrors, ruleAttentionItems, ruleStaleData, rulePpmDrop];
  const ctx = { stalenessMs };

  const raw = [];
  for (const fn of rules) {
    const a = fn(tiles, ctx);
    if (a) raw.push(a);
  }

  // Persist `since` / `firstSeenAt` when an id continues to fire.
  const prevById = new Map((previousAlerts || []).map(p => [p.id, p]));
  const alerts = raw.map(a => {
    const prev = prevById.get(a.id);
    if (prev) {
      return { ...a, since: prev.since, firstSeenAt: prev.firstSeenAt };
    }
    return { ...a, since: new Date(now).toISOString(), firstSeenAt: now };
  });

  alerts.sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
  return alerts;
}

/** Short label for the relative "since" time of an alert. */
export function formatSince(firstSeenAt, now = Date.now()) {
  if (!firstSeenAt) return '';
  const ms = now - Number(firstSeenAt);
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  if (ms < 60_000) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
