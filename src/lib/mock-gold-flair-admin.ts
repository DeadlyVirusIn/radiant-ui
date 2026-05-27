// Mock operational data for /admin/gold-flair.
// Canonical terminology: Queue depth, Throughput, Errors 1h, Oldest item,
// P95 wait, In flight, Failed, Blocked, Ready, Delivered, Drift, SLA breach.

export type GFStatus =
  | "queued"
  | "in_flight"
  | "ready"
  | "delivered"
  | "blocked"
  | "failed";

export type GFBlockReason =
  | "supply_exhausted"
  | "catalog_drift"
  | "signer_unavailable"
  | "recipient_unresolved"
  | "verification_pending";

export const GF_STATUS: Record<GFStatus, { label: string; tone: string }> = {
  queued:    { label: "Queued",     tone: "muted"   },
  in_flight: { label: "In flight",  tone: "primary" },
  ready:     { label: "Ready",      tone: "success" },
  delivered: { label: "Delivered",  tone: "success" },
  blocked:   { label: "Blocked",    tone: "warning" },
  failed:    { label: "Failed",     tone: "danger"  },
};

export const GF_BLOCK_LABEL: Record<GFBlockReason, string> = {
  supply_exhausted:      "Supply exhausted",
  catalog_drift:         "Catalog drift",
  signer_unavailable:    "Signer unavailable",
  recipient_unresolved:  "Recipient unresolved",
  verification_pending:  "Verification pending",
};

// ─── Mint Queue ──────────────────────────────────────────────────────────
export type MintBatch = {
  id: string;            // BATCH-…
  size: number;
  status: GFStatus;
  signer: string;
  openedAt: number;
  ageMin: number;
  retries: number;
  lastError: string | null;
};

// ─── Requests ────────────────────────────────────────────────────────────
export type GFRequest = {
  id: string;            // GF-…
  recipient: string;
  sku: string;
  status: GFStatus;
  blockReason: GFBlockReason | null;
  signer: string | null;
  retries: number;
  openedAt: number;
  ageMin: number;
  lastError: string | null;
};

// ─── Supply ──────────────────────────────────────────────────────────────
export type SupplyRow = {
  sku: string;
  label: string;
  onHand: number;
  reserved: number;
  available: number;
  burnPerH: number;
  hoursLeft: number;     // available / burnPerH
};

// ─── Catalog Health ──────────────────────────────────────────────────────
export type CatalogMapping = {
  sku: string;
  label: string;
  state: "verified" | "drift" | "missing";
  lastVerifiedAt: number | null;
  note: string | null;
};

// ─── Demand Backlog ──────────────────────────────────────────────────────
export type BacklogRow = {
  sku: string;
  label: string;
  pending: number;
  oldestAgeMin: number;
  p95WaitSec: number;
};

// ─── Signer pool snapshot ────────────────────────────────────────────────
export type SignerPoolSnapshot = {
  active: number;
  capacity: number;
  rejections1h: number;
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;

// ─── DATA ────────────────────────────────────────────────────────────────
export const MINT_QUEUE: MintBatch[] = [
  { id: "BATCH-2104", size: 8, status: "in_flight", signer: "signer-02", openedAt: mins(6),  ageMin: 6,  retries: 0, lastError: null },
  { id: "BATCH-2103", size: 6, status: "queued",    signer: "signer-01", openedAt: mins(11), ageMin: 11, retries: 0, lastError: null },
  { id: "BATCH-2102", size: 4, status: "failed",    signer: "signer-04", openedAt: mins(22), ageMin: 22, retries: 3, lastError: "Mint signature rejected by chain" },
  { id: "BATCH-2101", size: 5, status: "ready",     signer: "signer-03", openedAt: mins(31), ageMin: 31, retries: 1, lastError: null },
  { id: "BATCH-2100", size: 9, status: "delivered", signer: "signer-02", openedAt: mins(58), ageMin: 58, retries: 0, lastError: null },
];

export const GF_REQUESTS: GFRequest[] = [
  { id: "GF-9041", recipient: "@noctis",     sku: "GF-CAMP-EVO-9",   status: "blocked",   blockReason: "catalog_drift",      signer: null,        retries: 2, openedAt: mins(38), ageMin: 38, lastError: "SKU GF-CAMP-EVO-9 missing in catalog v18" },
  { id: "GF-9040", recipient: "@lumenwave",  sku: "GF-STREETCAP-1",  status: "ready",     blockReason: null,                 signer: "signer-02", retries: 0, openedAt: mins(12), ageMin: 12, lastError: null },
  { id: "GF-9039", recipient: "@dropmaven",  sku: "GF-HEATLIST-77",  status: "in_flight", blockReason: null,                 signer: "signer-01", retries: 0, openedAt: mins(8),  ageMin: 8,  lastError: null },
  { id: "GF-9038", recipient: "@kibo",       sku: "GF-CAMP-EVO-9",   status: "blocked",   blockReason: "supply_exhausted",   signer: null,        retries: 0, openedAt: mins(46), ageMin: 46, lastError: "On-hand supply is zero" },
  { id: "GF-9037", recipient: "@aerial",     sku: "GF-SNEAK-204",    status: "failed",    blockReason: null,                 signer: "signer-04", retries: 3, openedAt: mins(64), ageMin: 64, lastError: "Mint signature rejected by chain" },
  { id: "GF-9036", recipient: "@chartreuse", sku: "GF-DROP-301",     status: "blocked",   blockReason: "recipient_unresolved", signer: null,      retries: 1, openedAt: mins(91), ageMin: 91, lastError: "Recipient handle returned 404 from resolver" },
  { id: "GF-9035", recipient: "@vespers",    sku: "GF-STREETCAP-1",  status: "queued",    blockReason: null,                 signer: null,        retries: 0, openedAt: mins(3),  ageMin: 3,  lastError: null },
  { id: "GF-9034", recipient: "@quanta",     sku: "GF-HEATLIST-77",  status: "delivered", blockReason: null,                 signer: "signer-03", retries: 0, openedAt: mins(120),ageMin: 120,lastError: null },
];

export const SUPPLY: SupplyRow[] = [
  { sku: "GF-SNEAK-204",   label: "Sneakerhead-7", onHand: 18,  reserved: 6,  available: 12,  burnPerH: 4, hoursLeft: 3.0 },
  { sku: "GF-STREETCAP-1", label: "Streetcap",     onHand: 142, reserved: 14, available: 128, burnPerH: 8, hoursLeft: 16.0 },
  { sku: "GF-HEATLIST-77", label: "Heatlist Pro",  onHand:  44, reserved: 12, available:  32, burnPerH: 6, hoursLeft: 5.3 },
  { sku: "GF-DROP-301",    label: "Drop-tracker",  onHand:   0, reserved:  0, available:   0, burnPerH: 2, hoursLeft: 0.0 },
  { sku: "GF-CAMP-EVO-9",  label: "Campaign EVO",  onHand:   0, reserved:  4, available:  -4, burnPerH: 3, hoursLeft: 0.0 },
];

export const CATALOG: CatalogMapping[] = [
  { sku: "GF-SNEAK-204",   label: "Sneakerhead-7", state: "verified", lastVerifiedAt: mins(18),  note: null },
  { sku: "GF-STREETCAP-1", label: "Streetcap",     state: "verified", lastVerifiedAt: mins(42),  note: null },
  { sku: "GF-HEATLIST-77", label: "Heatlist Pro",  state: "drift",    lastVerifiedAt: mins(310), note: "Mint signer pubkey differs from catalog v18" },
  { sku: "GF-DROP-301",    label: "Drop-tracker",  state: "verified", lastVerifiedAt: mins(64),  note: null },
  { sku: "GF-CAMP-EVO-9",  label: "Campaign EVO",  state: "missing",  lastVerifiedAt: null,      note: "SKU not present in catalog v18" },
];

export const BACKLOG: BacklogRow[] = [
  { sku: "GF-CAMP-EVO-9",  label: "Campaign EVO",  pending: 6, oldestAgeMin: 91, p95WaitSec: 184 },
  { sku: "GF-SNEAK-204",   label: "Sneakerhead-7", pending: 3, oldestAgeMin: 38, p95WaitSec: 96  },
  { sku: "GF-HEATLIST-77", label: "Heatlist Pro",  pending: 2, oldestAgeMin: 14, p95WaitSec: 42  },
  { sku: "GF-STREETCAP-1", label: "Streetcap",     pending: 1, oldestAgeMin:  3, p95WaitSec: 18  },
];

export const SIGNER_POOL: SignerPoolSnapshot = {
  active: 3,
  capacity: 4,
  rejections1h: 1,
};

// ─── Aggregate KPIs (canonical terminology) ──────────────────────────────
export function goldFlairKpis() {
  const requests = GF_REQUESTS;
  const queueDepth   = MINT_QUEUE.filter((b) => b.status === "queued" || b.status === "in_flight").length
                     + requests.filter((r) => r.status === "queued").length;
  const inFlight     = requests.filter((r) => r.status === "in_flight").length;
  const blocked      = requests.filter((r) => r.status === "blocked").length;
  const failed       = requests.filter((r) => r.status === "failed").length;
  const ready        = requests.filter((r) => r.status === "ready").length;
  const delivered24h = requests.filter((r) => r.status === "delivered").length + 184;
  const oldestItem   = Math.max(...requests.map((r) => r.ageMin), 0);
  const p95Wait      = 184;        // seconds — matches backlog worst-case
  const throughput   = 42;         // mints per hour
  const errors1h     = 1;
  return {
    queueDepth, inFlight, blocked, failed, ready, delivered24h,
    oldestItem, p95Wait, throughput, errors1h,
  };
}

export const GF_REQUEST_BY_ID: Record<string, GFRequest> =
  Object.fromEntries(GF_REQUESTS.map((r) => [r.id, r]));

export const MINT_BATCH_BY_ID: Record<string, MintBatch> =
  Object.fromEntries(MINT_QUEUE.map((b) => [b.id, b]));
