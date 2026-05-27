// Per-queue operator snapshot for /admin/queues tabs.
// Adds oldestAge + p95Wait as requested.

export type QueueKey = "hunts" | "trades" | "gifts" | "mint";

export type QueueSnapshot = {
  key: QueueKey;
  label: string;
  depth: number;
  throughputPerH: number;
  errors1h: number;
  oldestAgeMin: number;   // age of the oldest item in queue, minutes
  p95WaitSec: number;     // p95 wait time, seconds
};

export const QUEUE_SNAPSHOTS: Record<QueueKey, QueueSnapshot> = {
  hunts: { key: "hunts", label: "Hunts", depth: 14, throughputPerH: 184, errors1h: 1, oldestAgeMin: 8,  p95WaitSec: 42 },
  trades:{ key: "trades", label: "Trades", depth:  7, throughputPerH: 612, errors1h: 4, oldestAgeMin: 3,  p95WaitSec: 18 },
  gifts: { key: "gifts", label: "Gifts", depth:  4, throughputPerH:  96, errors1h: 0, oldestAgeMin: 11, p95WaitSec: 27 },
  mint:  { key: "mint", label: "Mint",  depth: 14, throughputPerH:  42, errors1h: 1, oldestAgeMin: 14, p95WaitSec: 96 },
};

export const QUEUE_RUNBOOK: Record<QueueKey, string[]> = {
  hunts: [
    "Check fleet health and bot region balance.",
    "Confirm hunt config v18 is active.",
    "Drain queue if depth > 50.",
    "Promote staging config only after canary passes.",
  ],
  trades: [
    "Verify settlement worker pool size.",
    "Inspect counterparty trust signals for repeated failures.",
    "If p95 > 120s, escalate to settlement on-call.",
  ],
  gifts: [
    "Confirm recipient resolver SLA.",
    "If oldest > 30m, force a recipient cache refresh.",
    "Bulk-retry failed deliveries from the Gifts page.",
  ],
  mint: [
    "Confirm Gold Flair signer pool capacity.",
    "If depth > 20, batch-approve from Mint Queue drawer.",
    "Escalate to chain on-call if signature rejections > 5/h.",
  ],
};
