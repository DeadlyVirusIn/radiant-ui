// Mock admin operational health data — surfaced on Mission Control + reused by
// HealthSummaryRow, AlertsList, RecentFailures, SLABreaches, QueueDepthStrip.

export type DomainKey = "hunts" | "trades" | "gifts" | "gold-flair" | "scheduler";
export type DomainStatus = "ok" | "warn" | "down";

export type DomainHealth = {
  domain: DomainKey;
  label: string;
  status: DomainStatus;
  lastExecAt: number;           // ms epoch
  queueDepth: number;
  errors1h: number;
  href: string;                 // deep link to the operator page
};

export type Alert = {
  id: string;
  severity: "info" | "warn" | "critical";
  domain: DomainKey;
  message: string;
  since: number;                // ms epoch
  href: string;                 // deep link with ?id=… to open the entity drawer
};

export type FailureItem = {
  id: string;                   // entity id (TRADE-A9F2, GIFT-B19, …)
  domain: DomainKey;
  label: string;
  occurredAt: number;
  count: number;
  action: string;               // CTA label
  href: string;                 // deep link with ?id=… to open the entity drawer
};

export type SLABreach = {
  id: string;
  domain: DomainKey;
  metric: string;
  target: string;
  actual: string;
  since: number;
  href: string;
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;

export const DOMAIN_HEALTH: DomainHealth[] = [
  { domain: "hunts",      label: "Hunts",      status: "warn", lastExecAt: mins(2),  queueDepth: 14, errors1h: 1, href: "/admin/queues" },
  { domain: "trades",     label: "Trades",     status: "ok",   lastExecAt: mins(1),  queueDepth:  7, errors1h: 4, href: "/admin/trades" },
  { domain: "gifts",      label: "Gifts",      status: "ok",   lastExecAt: mins(3),  queueDepth:  4, errors1h: 0, href: "/admin/gifts" },
  { domain: "gold-flair", label: "Gold Flair", status: "warn", lastExecAt: mins(14), queueDepth: 14, errors1h: 1, href: "/admin/gold-flair" },
  { domain: "scheduler",  label: "Scheduler",  status: "ok",   lastExecAt: mins(0),  queueDepth:  0, errors1h: 0, href: "/admin/scheduler" },
];

export const ACTIVE_ALERTS: Alert[] = [
  { id: "AL-01", severity: "critical", domain: "trades",     message: "Settlement retry budget exhausted on TRADE-A9F2", since: mins(22), href: "/admin/trades?id=TRADE-A9F2" },
  { id: "AL-02", severity: "warn",     domain: "gold-flair", message: "Mint backlog 14 items — exceeds 10 SLA threshold",  since: mins(14), href: "/admin/queues?tab=mint" },
  { id: "AL-03", severity: "warn",     domain: "hunts",      message: "HUNT-12 stalled past ETA (EU-W · bot-07)",          since: mins(8),  href: "/admin/queues?tab=hunts" },
  { id: "AL-04", severity: "info",     domain: "gifts",      message: "Gift batch B-19 partial delivery (2 unclaimed)",    since: mins(33), href: "/admin/gifts?id=GIFT-B19" },
];

export const RECENT_FAILURES: FailureItem[] = [
  { id: "TRADE-A9F2", domain: "trades",     label: "Settle handshake failed — retry budget exhausted",  occurredAt: mins(22), count: 3, action: "Inspect",     href: "/admin/trades?id=TRADE-A9F2" },
  { id: "HUNT-09",    domain: "hunts",      label: "Hunt-09 worker timeout (bot-02)",                    occurredAt: mins(31), count: 1, action: "Reassign",    href: "/admin/queues?tab=hunts&id=HUNT-09" },
  { id: "GIFT-B17",   domain: "gifts",      label: "Recipient resolution failed (3 of 24)",              occurredAt: mins(47), count: 3, action: "Retry",       href: "/admin/gifts?id=GIFT-B17" },
  { id: "MINT-2041",  domain: "gold-flair", label: "Mint signature rejected by chain",                   occurredAt: mins(58), count: 1, action: "Re-sign",     href: "/admin/queues?tab=mint&id=MINT-2041" },
  { id: "TRADE-B021", domain: "trades",     label: "Counterparty offline before handshake",              occurredAt: mins(64), count: 2, action: "Ping",        href: "/admin/trades?id=TRADE-B021" },
];

export const SLA_BREACHES: SLABreach[] = [
  { id: "SLA-1", domain: "gold-flair", metric: "Mint queue depth",      target: "≤ 10",   actual: "14",      since: mins(14), href: "/admin/queues?tab=mint" },
  { id: "SLA-2", domain: "trades",     metric: "Settle p95 latency",    target: "≤ 90s",  actual: "142s",    since: mins(36), href: "/admin/trades?tab=settlement" },
  { id: "SLA-3", domain: "hunts",      metric: "Stalled hunt age",      target: "≤ 5m",   actual: "8m",      since: mins(8),  href: "/admin/queues?tab=hunts&id=HUNT-12" },
];

export function fmtRel(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
