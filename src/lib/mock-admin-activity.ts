// Mock data for /admin/activity-logs — read-only operational preview.

export type ActivityLevel = "info" | "warn" | "error";
export type ActivityKind = "operator" | "system";

export type ActivityEvent = {
  id: string;
  at: number;
  actor: string;
  actorRole: "operator" | "admin" | "system";
  kind: ActivityKind;
  action: string;
  surface: string;
  target: string;
  level: ActivityLevel;
  ip?: string;
  details: string;
  context?: Record<string, unknown>;
};

const MIN = 60_000;
const now = Date.now();

export const ACTIVITY_EVENTS: ActivityEvent[] = [
  { id: "ACT-9412", at: now - 2 * MIN,   actor: "alex",   actorRole: "operator", kind: "operator", action: "hunt.resume",          surface: "Hunt H-2104",   target: "H-2104", level: "info",  ip: "10.0.4.21", details: "Resumed hunt after manual review of pack rate drift.", context: { prev_state: "paused", reason: "operator_clear" } },
  { id: "ACT-9411", at: now - 7 * MIN,   actor: "system", actorRole: "system",   kind: "system",   action: "token.rotate",         surface: "Auth",          target: "session.token", level: "info", details: "Scheduled session token rotation completed." },
  { id: "ACT-9410", at: now - 11 * MIN,  actor: "jules",  actorRole: "operator", kind: "operator", action: "share.rule.create",    surface: "Auto-share",    target: "rule-204", level: "info",  ip: "10.0.4.88", details: "Created auto-share rule for SR+ pulls.", context: { scope: "team", min_rarity: "SR" } },
  { id: "ACT-9409", at: now - 18 * MIN,  actor: "nelle",  actorRole: "operator", kind: "operator", action: "friend.remove",        surface: "Friends",       target: "friend-3349", level: "warn",  ip: "10.0.4.55", details: "Removed friend over inactivity threshold.", context: { inactive_days: 41 } },
  { id: "ACT-9408", at: now - 24 * MIN,  actor: "system", actorRole: "system",   kind: "system",   action: "bot.pause",            surface: "Bot bot-09",    target: "bot-09", level: "warn",  details: "Auto-paused bot after 3 consecutive timeouts.", context: { timeouts: 3 } },
  { id: "ACT-9407", at: now - 38 * MIN,  actor: "kiera",  actorRole: "admin",    kind: "operator", action: "queue.drain",          surface: "Queues",        target: "queue.trades", level: "info",  ip: "10.0.4.12", details: "Triggered drain on trades queue during low-traffic window." },
  { id: "ACT-9406", at: now - 52 * MIN,  actor: "system", actorRole: "system",   kind: "system",   action: "cache.invalidate",     surface: "Cache",         target: "cache.catalog", level: "info",  details: "Invalidated catalog cache after upstream schema bump." },
  { id: "ACT-9405", at: now - 67 * MIN,  actor: "alex",   actorRole: "operator", kind: "operator", action: "trade.reassign",       surface: "Trades",        target: "TRD-1487", level: "info",  ip: "10.0.4.21", details: "Reassigned stalled trade request to alternate hunter." },
  { id: "ACT-9404", at: now - 84 * MIN,  actor: "system", actorRole: "system",   kind: "system",   action: "integrity.scan",       surface: "Integrity",     target: "scan.daily", level: "warn",  details: "Daily integrity scan finished with 4 drift findings.", context: { findings: 4 } },
  { id: "ACT-9403", at: now - 96 * MIN,  actor: "system", actorRole: "system",   kind: "system",   action: "webhook.deliver.fail", surface: "Webhooks",      target: "wh-out-12", level: "error", details: "Outbound webhook delivery failed after 5 retries.", context: { http_status: 502, retries: 5 } },
  { id: "ACT-9402", at: now - 124 * MIN, actor: "jules",  actorRole: "operator", kind: "operator", action: "gift.acknowledge",     surface: "Gifts",         target: "GFT-5520", level: "info",  ip: "10.0.4.88", details: "Acknowledged inbound gift for inventory reconciliation." },
  { id: "ACT-9401", at: now - 145 * MIN, actor: "system", actorRole: "system",   kind: "system",   action: "scheduler.run",        surface: "Scheduler",     target: "JOB-NIGHTLY-AUDIT", level: "info", details: "Nightly audit job completed in 4m12s." },
  { id: "ACT-9400", at: now - 178 * MIN, actor: "kiera",  actorRole: "admin",    kind: "operator", action: "user.suspend",         surface: "Users",         target: "user-7782", level: "warn",  ip: "10.0.4.12", details: "Temporarily suspended user pending trust review." },
  { id: "ACT-9399", at: now - 220 * MIN, actor: "system", actorRole: "system",   kind: "system",   action: "db.failover",          surface: "Database",      target: "primary-eu", level: "error", details: "Primary DB briefly failed over to replica.", context: { duration_s: 38 } },
];

export const ACTIVITY_BY_ID: Record<string, ActivityEvent> =
  Object.fromEntries(ACTIVITY_EVENTS.map((e) => [e.id, e]));

export const LEVEL_META: Record<ActivityLevel, { label: string; tone: "primary" | "warning" | "danger" }> = {
  info:  { label: "Info",  tone: "primary" },
  warn:  { label: "Warn",  tone: "warning" },
  error: { label: "Error", tone: "danger" },
};

export const KIND_META: Record<ActivityKind, { label: string; tone: "primary" | "muted" }> = {
  operator: { label: "Operator", tone: "primary" },
  system:   { label: "System",   tone: "muted" },
};

export function activityKpis() {
  const events24h = ACTIVITY_EVENTS.length;
  const warnings = ACTIVITY_EVENTS.filter((e) => e.level === "warn").length;
  const errors = ACTIVITY_EVENTS.filter((e) => e.level === "error").length;
  const operators = new Set(
    ACTIVITY_EVENTS.filter((e) => e.kind === "operator").map((e) => e.actor),
  ).size;
  const lastEventAt = Math.max(...ACTIVITY_EVENTS.map((e) => e.at));
  return { events24h, warnings, errors, operators, lastEventAt };
}

export function fmtRelFrom(ts: number, ref = Date.now()): string {
  const diff = Math.max(0, ref - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtTs(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + "Z";
}
