// Operator-grade integrity / consistency surface. Read-only mock data.

export type Severity = "critical" | "high" | "medium" | "low";
export type IntegrityStatus = "blocked" | "failed" | "warning" | "verified";
export type IntegrityCategory = "drift" | "stale" | "failed" | "missing" | "mismatch";

export type OwnerSurface =
  | "Fleet"
  | "Hunt config"
  | "Trades"
  | "Gifts"
  | "Gold Flair"
  | "Scheduler"
  | "Trust"
  | "Catalog";

export type LifecycleEvent = {
  at: number;
  kind: "detected" | "checked" | "escalated" | "muted" | "acknowledged";
  note?: string;
};

export type IntegrityIssue = {
  id: string;
  title: string;
  category: IntegrityCategory;
  status: IntegrityStatus;
  severity: Severity;
  owner: OwnerSurface;
  entity: string;                // e.g. "trade ledger #A9F2", "sku PROMO-MEW-22"
  affectedRecords: number;
  detectedAt: number;
  lastCheckedAt: number;
  details: string;
  evidence: string[];            // short bullet evidence lines, mock
  recommendedAction: string;
  blocksOperations: boolean;
  lifecycle: LifecycleEvent[];
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;
const hours = (n: number) => now - n * 60 * 60_000;

export const INTEGRITY_ISSUES: IntegrityIssue[] = [
  {
    id: "INT-9041",
    title: "Trade ledger hash mismatch on fleet-3",
    category: "mismatch",
    status: "blocked",
    severity: "critical",
    owner: "Trades",
    entity: "ledger://fleet-3/window-44",
    affectedRecords: 12,
    detectedAt: mins(18),
    lastCheckedAt: mins(2),
    details: "Settlement worker on fleet-3 reports a ledger hash divergence from the canonical chain. 12 trades opened in the affected window have not been replayed since detection.",
    evidence: [
      "Expected hash 0x9c…41ab, observed 0xd2…77fe",
      "Window opened at " + new Date(mins(45)).toLocaleString(),
      "12 in-flight trades held; 4 disputed downstream",
    ],
    recommendedAction: "Quarantine fleet-3 settlement worker, replay window-44 from canonical chain, then resume.",
    blocksOperations: true,
    lifecycle: [
      { at: mins(18), kind: "detected", note: "Hash divergence detected by parity job" },
      { at: mins(14), kind: "escalated", note: "Paged settlement on-call" },
      { at: mins(2),  kind: "checked" },
    ],
  },
  {
    id: "INT-9040",
    title: "Gold Flair signer pool · 3 idle signers below quorum",
    category: "failed",
    status: "blocked",
    severity: "critical",
    owner: "Gold Flair",
    entity: "signer-pool://gold-flair",
    affectedRecords: 7,
    detectedAt: mins(34),
    lastCheckedAt: mins(4),
    details: "Active signers dropped to 5/8. 7 mint batches are queued and exceeding their SLA window.",
    evidence: [
      "Active 5 / capacity 8",
      "Rejections 1h: 12",
      "Oldest queued batch age 14m",
    ],
    recommendedAction: "Recycle idle signers; if rejections persist, escalate to chain on-call.",
    blocksOperations: true,
    lifecycle: [
      { at: mins(34), kind: "detected" },
      { at: mins(30), kind: "escalated", note: "Paged chain on-call" },
      { at: mins(4),  kind: "checked" },
    ],
  },
  {
    id: "INT-9039",
    title: "Catalog drift · PROMO-MEW-22 metadata diverges from canonical",
    category: "drift",
    status: "warning",
    severity: "medium",
    owner: "Catalog",
    entity: "sku://PROMO-MEW-22",
    affectedRecords: 1,
    detectedAt: mins(72),
    lastCheckedAt: mins(8),
    details: "Catalog mirror reports rarity 'EX' but canonical source reports 'FA'. No fulfillment held; downstream displays may be wrong.",
    evidence: [
      "Mirror rarity: EX",
      "Canonical rarity: FA",
      "Last sync " + new Date(mins(72)).toLocaleString(),
    ],
    recommendedAction: "Force a catalog sync for PROMO-MEW-22 from canonical source.",
    blocksOperations: false,
    lifecycle: [
      { at: mins(72), kind: "detected" },
      { at: mins(8),  kind: "checked" },
    ],
  },
  {
    id: "INT-9038",
    title: "Drift · 4 fleet bots running hunt config v17 (current v18)",
    category: "drift",
    status: "warning",
    severity: "medium",
    owner: "Hunt config",
    entity: "fleet://bots/v17-stragglers",
    affectedRecords: 4,
    detectedAt: hours(2),
    lastCheckedAt: mins(11),
    details: "Four bots on fleet-1 and fleet-2 did not pick up the v18 rollout. They continue to honor v17 targeting rules.",
    evidence: [
      "bot-fleet-1-07, bot-fleet-1-12",
      "bot-fleet-2-03, bot-fleet-2-19",
      "v18 promoted " + new Date(hours(3)).toLocaleString(),
    ],
    recommendedAction: "Re-trigger hunt config rollout job for the listed bots.",
    blocksOperations: false,
    lifecycle: [
      { at: hours(2), kind: "detected" },
      { at: hours(1), kind: "acknowledged", note: "Hunt-ops aware" },
      { at: mins(11), kind: "checked" },
    ],
  },
  {
    id: "INT-9037",
    title: "Stale · Trust scores not recomputed for 6h",
    category: "stale",
    status: "warning",
    severity: "high",
    owner: "Trust",
    entity: "trust://scores/window",
    affectedRecords: 1842,
    detectedAt: hours(6),
    lastCheckedAt: mins(3),
    details: "Trust recompute job has not produced a fresh window in 6h. Counterparty risk decisions are based on stale data.",
    evidence: [
      "Last successful recompute " + new Date(hours(6)).toLocaleString(),
      "Scheduler shows 2 failed runs in last 24h",
      "1,842 active counterparties affected",
    ],
    recommendedAction: "Investigate trust-recompute failures from Scheduler · Failures tab.",
    blocksOperations: false,
    lifecycle: [
      { at: hours(6), kind: "detected" },
      { at: mins(3),  kind: "checked" },
    ],
  },
  {
    id: "INT-9036",
    title: "Stale · Recipient cache older than 30m",
    category: "stale",
    status: "warning",
    severity: "medium",
    owner: "Gifts",
    entity: "cache://gifts/recipient-resolver",
    affectedRecords: 184,
    detectedAt: mins(31),
    lastCheckedAt: mins(1),
    details: "Recipient resolver cache TTL exceeded. 184 queued gifts will retry against the stale snapshot until refresh.",
    evidence: [
      "Cache age: 31m (limit 30m)",
      "Gift resolver failures 24h: 4",
      "Pending gifts: 184",
    ],
    recommendedAction: "Force a recipient cache refresh from the Gifts page.",
    blocksOperations: false,
    lifecycle: [
      { at: mins(31), kind: "detected" },
      { at: mins(1),  kind: "checked" },
    ],
  },
  {
    id: "INT-9035",
    title: "Missing · 2 expected Gold Flair SKUs absent from catalog",
    category: "missing",
    status: "failed",
    severity: "high",
    owner: "Catalog",
    entity: "sku://gold-flair/missing",
    affectedRecords: 2,
    detectedAt: hours(4),
    lastCheckedAt: mins(15),
    details: "GF-CHAR-FA and GF-LUGIA-UR are listed in the demand backlog but have no catalog entry. Fulfillment will fail until added.",
    evidence: [
      "GF-CHAR-FA: 18 pending requests",
      "GF-LUGIA-UR: 6 pending requests",
      "Both referenced by campaign CAMPAIGN-EVO-9",
    ],
    recommendedAction: "Add missing SKUs to catalog or pull requests from the demand backlog.",
    blocksOperations: false,
    lifecycle: [
      { at: hours(4), kind: "detected" },
      { at: hours(3), kind: "escalated", note: "Catalog team notified" },
      { at: mins(15), kind: "checked" },
    ],
  },
  {
    id: "INT-9034",
    title: "Failed check · Backup snapshot diff > 5% from canonical",
    category: "failed",
    status: "failed",
    severity: "high",
    owner: "Scheduler",
    entity: "backup://daily/2026-05-26",
    affectedRecords: 1,
    detectedAt: hours(8),
    lastCheckedAt: mins(45),
    details: "Backup-snapshot integrity check reports an 8.4% byte-level diff from canonical. Last good snapshot is 32h old.",
    evidence: [
      "Diff: 8.4% (threshold 5%)",
      "Last good snapshot " + new Date(hours(32)).toLocaleString(),
      "No incidents reported by storage layer",
    ],
    recommendedAction: "Re-run backup snapshot manually and compare against canonical.",
    blocksOperations: false,
    lifecycle: [
      { at: hours(8), kind: "detected" },
      { at: hours(7), kind: "acknowledged" },
      { at: mins(45), kind: "checked" },
    ],
  },
  {
    id: "INT-9033",
    title: "Drift · Fleet-2 stamina ledger lags primary by 12m",
    category: "drift",
    status: "warning",
    severity: "low",
    owner: "Fleet",
    entity: "ledger://stamina/fleet-2",
    affectedRecords: 38,
    detectedAt: mins(42),
    lastCheckedAt: mins(6),
    details: "Stamina ledger replica on fleet-2 is 12m behind the primary. No fleet operations are blocked yet.",
    evidence: [
      "Replication lag: 12m (alert >10m)",
      "38 stamina updates pending replay",
      "Primary healthy",
    ],
    recommendedAction: "Watch lag; if it exceeds 30m, drain fleet-2 stamina traffic to fleet-1.",
    blocksOperations: false,
    lifecycle: [
      { at: mins(42), kind: "detected" },
      { at: mins(6),  kind: "checked" },
    ],
  },
];

export const SEVERITY_META: Record<Severity, { label: string; tone: "danger" | "warning" | "primary" | "muted" }> = {
  critical: { label: "Critical", tone: "danger" },
  high:     { label: "High",     tone: "warning" },
  medium:   { label: "Medium",   tone: "primary" },
  low:      { label: "Low",      tone: "muted" },
};

export const STATUS_META: Record<IntegrityStatus, { label: string; tone: "danger" | "warning" | "primary" | "success" }> = {
  blocked:  { label: "Blocked",  tone: "danger" },
  failed:   { label: "Failed",   tone: "danger" },
  warning:  { label: "Warning",  tone: "warning" },
  verified: { label: "Verified", tone: "success" },
};

export const CATEGORY_META: Record<IntegrityCategory, { label: string }> = {
  drift:    { label: "Drift" },
  stale:    { label: "Stale" },
  failed:   { label: "Failed check" },
  missing:  { label: "Missing" },
  mismatch: { label: "Mismatch" },
};

export const ISSUE_BY_ID: Record<string, IntegrityIssue> =
  Object.fromEntries(INTEGRITY_ISSUES.map((i) => [i.id, i]));

export function integrityKpis() {
  const failed = INTEGRITY_ISSUES.filter((i) => i.status === "failed" || i.status === "blocked").length;
  const blockers = INTEGRITY_ISSUES.filter((i) => i.blocksOperations).length;
  const drift = INTEGRITY_ISSUES.filter((i) => i.category === "drift").length;
  const stale = INTEGRITY_ISSUES.filter((i) => i.category === "stale").length;
  const lastCheckedAt = INTEGRITY_ISSUES
    .map((i) => i.lastCheckedAt)
    .sort((a, b) => b - a)[0] ?? null;
  return { failed, blockers, drift, stale, lastCheckedAt };
}

export function fmtRelFrom(ts: number | null): string {
  if (ts == null) return "—";
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000);
  const tag = diff >= 0 ? "in " : "";
  const suffix = diff >= 0 ? "" : " ago";
  if (m < 60) return `${tag}${m}m${suffix}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${tag}${h}h${suffix}`;
  return `${tag}${Math.floor(h / 24)}d${suffix}`;
}

export function fmtTs(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString() : "—";
}
