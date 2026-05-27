// Read-only mock audit log feed. Operator-grade historical trail.

export type AuditSeverity = "low" | "medium" | "high" | "critical";
export type AuditStatus = "success" | "failed" | "partial" | "denied";
export type AuditKind = "admin" | "system";

export type AuditSurface =
  | "Mission Control"
  | "Queues"
  | "Trades"
  | "Gifts"
  | "Gold Flair"
  | "Scheduler"
  | "Integrity"
  | "Fleet"
  | "Users"
  | "Auth";

export type RelatedEvent = { id: string; at: number; label: string };

export type AuditEvent = {
  id: string;
  at: number;
  kind: AuditKind;
  actor: string;            // username or "system:<service>"
  actorRole: "admin" | "operator" | "system" | "scheduler";
  action: string;           // verb phrase, e.g. "grant_admin"
  surface: AuditSurface;
  entity: string;           // resource id / handle
  status: AuditStatus;
  severity: AuditSeverity;
  durationMs?: number;
  source: {
    ip?: string;
    userAgent?: string;
    requestId: string;
    region?: string;
  };
  details: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  evidence?: string[];
  related?: RelatedEvent[];
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;
const hours = (n: number) => now - n * 60 * 60_000;

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "AUD-88241",
    at: mins(2),
    kind: "admin",
    actor: "alex",
    actorRole: "admin",
    action: "grant_admin",
    surface: "Users",
    entity: "user://nelle",
    status: "success",
    severity: "high",
    durationMs: 142,
    source: { ip: "10.0.4.21", userAgent: "Radiant/Web 2024.11", requestId: "req_8a91f2", region: "eu-west-1" },
    details: "Admin role granted to user 'nelle'. Two-factor verified at sign-in.",
    before: { roles: ["operator"] },
    after: { roles: ["operator", "admin"] },
    evidence: ["2FA verified 4m before action", "Approval ticket SEC-441"],
    related: [
      { id: "AUD-88200", at: mins(8), label: "alex signed in" },
    ],
  },
  {
    id: "AUD-88240",
    at: mins(7),
    kind: "system",
    actor: "system:scheduler",
    actorRole: "scheduler",
    action: "job_run_failed",
    surface: "Scheduler",
    entity: "job://gift-expiry-sweeper",
    status: "failed",
    severity: "high",
    durationMs: 8_420,
    source: { requestId: "sched_4421", region: "eu-west-1" },
    details: "Scheduled run for gift-expiry-sweeper exited non-zero. Backoff queued for next window.",
    evidence: ["exit_code=2", "stderr: redis timeout (4500ms)"],
    related: [
      { id: "AUD-88150", at: hours(6), label: "previous run · success" },
    ],
  },
  {
    id: "AUD-88239",
    at: mins(14),
    kind: "admin",
    actor: "jules",
    actorRole: "operator",
    action: "release_gold_flair",
    surface: "Gold Flair",
    entity: "request://GF-7741",
    status: "success",
    severity: "medium",
    durationMs: 318,
    source: { ip: "10.0.4.55", userAgent: "Radiant/Web 2024.11", requestId: "req_ab12cd", region: "eu-west-1" },
    details: "Manual release of held Gold Flair request after fraud check cleared.",
    before: { state: "held", reason: "fraud_review" },
    after: { state: "released" },
  },
  {
    id: "AUD-88238",
    at: mins(22),
    kind: "system",
    actor: "system:integrity",
    actorRole: "system",
    action: "drift_check_failed",
    surface: "Integrity",
    entity: "check://trades.ledger.hash",
    status: "failed",
    severity: "critical",
    durationMs: 1_201,
    source: { requestId: "intg_9c12", region: "eu-west-1" },
    details: "Ledger hash mismatch detected on fleet-3 window-44.",
    evidence: ["Expected 0x9c…41ab", "Observed 0xd2…77fe"],
    related: [{ id: "INT-9041", at: mins(18), label: "Integrity issue opened" }],
  },
  {
    id: "AUD-88237",
    at: mins(31),
    kind: "admin",
    actor: "nelle",
    actorRole: "operator",
    action: "cancel_trade",
    surface: "Trades",
    entity: "trade://T-55821",
    status: "success",
    severity: "medium",
    durationMs: 207,
    source: { ip: "10.0.4.77", userAgent: "Radiant/Web 2024.11", requestId: "req_77ab21" },
    details: "Operator-cancelled stuck trade after both parties timed out.",
    before: { state: "matching" },
    after: { state: "cancelled", reason: "operator_cancel" },
  },
  {
    id: "AUD-88236",
    at: mins(44),
    kind: "admin",
    actor: "alex",
    actorRole: "admin",
    action: "revoke_session",
    surface: "Auth",
    entity: "session://s_91ab44",
    status: "success",
    severity: "high",
    durationMs: 88,
    source: { ip: "10.0.4.21", requestId: "req_aa991x" },
    details: "Forced sign-out for user 'pavel' across all devices.",
    before: { activeSessions: 3 },
    after: { activeSessions: 0 },
  },
  {
    id: "AUD-88235",
    at: hours(1),
    kind: "admin",
    actor: "jules",
    actorRole: "operator",
    action: "approve_gift_batch",
    surface: "Gifts",
    entity: "batch://GB-2210",
    status: "partial",
    severity: "medium",
    durationMs: 4_021,
    source: { ip: "10.0.4.55", requestId: "req_88f1c2" },
    details: "Bulk approval on 42 pending gifts. 3 entries failed validation and were skipped.",
    evidence: ["skipped: GIFT-7741 (rate-limit)", "skipped: GIFT-7742 (recipient suspended)", "skipped: GIFT-7755 (catalog mismatch)"],
  },
  {
    id: "AUD-88234",
    at: hours(2),
    kind: "system",
    actor: "system:queues",
    actorRole: "system",
    action: "dlq_message_landed",
    surface: "Queues",
    entity: "queue://hunt.events#dlq",
    status: "failed",
    severity: "medium",
    durationMs: 12,
    source: { requestId: "q_771ab3" },
    details: "Message routed to dead-letter after 5 redelivery attempts.",
    evidence: ["payload_id=evt_44ff1", "last_error: validation.schema_mismatch"],
  },
  {
    id: "AUD-88233",
    at: hours(3),
    kind: "admin",
    actor: "alex",
    actorRole: "admin",
    action: "rotate_api_key",
    surface: "Users",
    entity: "key://k_admin_44",
    status: "success",
    severity: "high",
    durationMs: 612,
    source: { ip: "10.0.4.21", requestId: "req_kx88r2" },
    details: "Rotated admin API key. Previous key revoked, new key issued and acknowledged.",
    before: { keyId: "k_admin_44", lastUsed: hours(40) },
    after: { keyId: "k_admin_45", rotatedAt: hours(3) },
  },
  {
    id: "AUD-88232",
    at: hours(4),
    kind: "admin",
    actor: "pavel",
    actorRole: "operator",
    action: "delete_user",
    surface: "Users",
    entity: "user://ghost-91",
    status: "denied",
    severity: "high",
    durationMs: 41,
    source: { ip: "10.0.4.91", requestId: "req_zz8821" },
    details: "Delete blocked — operator role lacks 'users:delete' capability.",
    evidence: ["policy=admin_only", "required=users:delete"],
  },
  {
    id: "AUD-88231",
    at: hours(5),
    kind: "system",
    actor: "system:scheduler",
    actorRole: "scheduler",
    action: "job_run_success",
    surface: "Scheduler",
    entity: "job://daily-trade-rollup",
    status: "success",
    severity: "low",
    durationMs: 23_412,
    source: { requestId: "sched_4310" },
    details: "Daily trade rollup completed. 18,221 trades aggregated.",
  },
  {
    id: "AUD-88230",
    at: hours(6),
    kind: "admin",
    actor: "alex",
    actorRole: "admin",
    action: "update_config",
    surface: "Mission Control",
    entity: "config://feature.gold_flair.cap",
    status: "success",
    severity: "medium",
    durationMs: 96,
    source: { ip: "10.0.4.21", requestId: "req_cfg77x" },
    details: "Increased Gold Flair daily cap from 250 to 400.",
    before: { value: 250 },
    after: { value: 400 },
  },
  {
    id: "AUD-88229",
    at: hours(8),
    kind: "system",
    actor: "system:fleet",
    actorRole: "system",
    action: "node_unhealthy",
    surface: "Fleet",
    entity: "node://fleet-3",
    status: "failed",
    severity: "critical",
    durationMs: 0,
    source: { requestId: "fleet_aa11" },
    details: "Node fleet-3 fell below health threshold (cpu>92% sustained 5m).",
    evidence: ["cpu=94%", "memory=87%", "queue_depth=2104"],
  },
  {
    id: "AUD-88228",
    at: hours(9),
    kind: "admin",
    actor: "jules",
    actorRole: "operator",
    action: "freeze_queue",
    surface: "Queues",
    entity: "queue://trades.match",
    status: "success",
    severity: "high",
    durationMs: 51,
    source: { ip: "10.0.4.55", requestId: "req_qfrz1" },
    details: "Match queue paused for 4 minutes during fleet-3 recovery window.",
    before: { state: "running" },
    after: { state: "frozen", until: hours(8.93) },
  },
  {
    id: "AUD-88227",
    at: hours(11),
    kind: "system",
    actor: "system:auth",
    actorRole: "system",
    action: "sign_in",
    surface: "Auth",
    entity: "user://alex",
    status: "success",
    severity: "low",
    durationMs: 318,
    source: { ip: "10.0.4.21", userAgent: "Radiant/Web 2024.11", requestId: "req_si881" },
    details: "Admin sign-in with 2FA.",
  },
];

export const EVENT_BY_ID: Record<string, AuditEvent> = Object.fromEntries(
  AUDIT_EVENTS.map((e) => [e.id, e]),
);

export const SEVERITY_META: Record<AuditSeverity, { label: string; tone: string }> = {
  critical: { label: "Critical", tone: "danger" },
  high:     { label: "High",     tone: "warning" },
  medium:   { label: "Medium",   tone: "primary" },
  low:      { label: "Low",      tone: "muted" },
};

export const STATUS_META: Record<AuditStatus, { label: string; tone: string }> = {
  success: { label: "Success", tone: "success" },
  failed:  { label: "Failed",  tone: "danger" },
  partial: { label: "Partial", tone: "warning" },
  denied:  { label: "Denied",  tone: "danger" },
};

export const KIND_META: Record<AuditKind, { label: string; tone: string }> = {
  admin:  { label: "Admin",  tone: "primary" },
  system: { label: "System", tone: "muted" },
};

export function fmtTs(ts: number) {
  return new Date(ts).toLocaleString();
}

export function fmtRelFrom(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtDuration(ms?: number) {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

export function auditKpis() {
  const day = Date.now() - 24 * 60 * 60_000;
  const last24 = AUDIT_EVENTS.filter((e) => e.at >= day);
  return {
    events24h:    last24.length,
    failed:       AUDIT_EVENTS.filter((e) => e.status === "failed" || e.status === "denied").length,
    highRisk:     AUDIT_EVENTS.filter((e) => e.severity === "high" || e.severity === "critical").length,
    adminActions: AUDIT_EVENTS.filter((e) => e.kind === "admin").length,
    lastEventAt:  AUDIT_EVENTS.reduce((m, e) => Math.max(m, e.at), 0),
  };
}
