// Canonical mock for /trade-analytics. Collector-facing.
// Derived deterministically from MARKETPLACE_PACKS + partner handles in
// MOCK_USER_REQUESTS so cross-page numbers feel consistent.

import { MARKETPLACE_PACKS } from "./mock-card-requests";

export type AnalyticsTimeframe = "7d" | "30d" | "90d" | "all";

export type DailyBucket = {
  date: string; // yyyy-mm-dd
  completed: number;
  failed: number;
  cancelled: number;
  sandEarned: number;
  sandSpent: number;
};

export type FunnelStep =
  | "requested"
  | "matched"
  | "friend_sent"
  | "pick_card"
  | "completed";

export type FunnelSnapshot = Record<FunnelStep, number>;

export type PackPerformance = {
  pack: string;
  trades: number;
  successPct: number;
  avgSand: number;
  netSand: number;
  topCard: string;
};

export type PartnerPerformance = {
  handle: string;
  trades: number;
  successPct: number;
  netSand: number;
  lastTradeAt: number; // ms
  tag: "new" | "repeat" | "top5" | null;
};

export type CollectionImpact = {
  cardsAcquired: number;
  wishlistAcquired: number;
  setsProgressed: number;
  biggestSetImprovement: { set: string; deltaPct: number };
  mostValuableAcquisition: { card: string; pack: string; sand: number };
};

export type TradeAnalyticsMock = {
  generatedAt: number;
  buckets: DailyBucket[];          // last 90 days
  funnel: FunnelSnapshot;          // 30d snapshot baseline; recomputed per timeframe in UI
  packs: PackPerformance[];
  partners: PartnerPerformance[];
  collection: CollectionImpact;
  mostExpensiveTradeId: string;    // ID into mock-trades
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const NOW = Date.now();
const DAY = 86_400_000;

function isoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

// Deterministic pseudo-random based on day index.
function noise(i: number, seed: number) {
  const x = Math.sin((i + 1) * 13.37 + seed * 7.7) * 10_000;
  return x - Math.floor(x);
}

const buckets: DailyBucket[] = Array.from({ length: 90 }, (_, idx) => {
  const i = 89 - idx; // 0 = oldest
  const base = 4 + Math.floor(noise(i, 1) * 10); // 4–13
  const completed = base + (i % 7 === 0 ? 3 : 0);
  const failed = Math.floor(noise(i, 2) * 3); // 0–2
  const cancelled = Math.floor(noise(i, 3) * 2); // 0–1
  const sandEarned = completed * (220 + Math.floor(noise(i, 4) * 280));
  const sandSpent = (completed + failed) * (160 + Math.floor(noise(i, 5) * 220));
  return {
    date: isoDate(NOW - i * DAY),
    completed,
    failed,
    cancelled,
    sandEarned,
    sandSpent,
  };
});

// ── Funnel (30d baseline) ───────────────────────────────────────────────────
const last30 = buckets.slice(-30);
const completed30 = last30.reduce((a, b) => a + b.completed, 0);
const failed30 = last30.reduce((a, b) => a + b.failed, 0);
const cancelled30 = last30.reduce((a, b) => a + b.cancelled, 0);
const requested = completed30 + failed30 + cancelled30 + 14; // some dropped at request stage
const matched = requested - 12;
const friendSent = matched - 9;
const pickCard = friendSent - 7;

const funnel: FunnelSnapshot = {
  requested,
  matched,
  friend_sent: friendSent,
  pick_card: pickCard,
  completed: completed30,
};

// ── Pack performance ────────────────────────────────────────────────────────
const topCardByPack: Record<string, string> = {
  "Triumphant Light": "Mew ex",
  "Genetic Apex": "Charizard",
  "Space-Time Smackdown": "Lugia Crown",
  "Mythical Island": "Articuno ex",
};

const packs: PackPerformance[] = MARKETPLACE_PACKS.map((pack, i) => {
  const trades = 18 + Math.floor(noise(i, 11) * 60);
  const successPct = 78 + Math.floor(noise(i, 12) * 20); // 78–97
  const avgSand = 380 + Math.floor(noise(i, 13) * 700);
  const netSand = Math.floor((noise(i, 14) - 0.4) * 18_000);
  return {
    pack,
    trades,
    successPct,
    avgSand,
    netSand,
    topCard: topCardByPack[pack] ?? "—",
  };
}).sort((a, b) => b.trades - a.trades);

// ── Partners ────────────────────────────────────────────────────────────────
const partnerHandles = [
  "user_kiera",
  "user_morrow",
  "user_arden",
  "user_nelle",
  "user_halcyon",
  "user_vanta",
  "user_aurora",
  "user_solene",
  "user_riven",
  "user_juno",
];

const partners: PartnerPerformance[] = partnerHandles
  .map((handle, i) => {
    const trades = 6 + Math.floor(noise(i, 21) * 38);
    const successPct = 80 + Math.floor(noise(i, 22) * 18);
    const netSand = Math.floor((noise(i, 23) - 0.35) * 9_000);
    const lastTradeAt = NOW - Math.floor(noise(i, 24) * 14) * DAY;
    return { handle, trades, successPct, netSand, lastTradeAt, tag: null as PartnerPerformance["tag"] };
  })
  .sort((a, b) => b.trades - a.trades)
  .map((p, i) => ({
    ...p,
    tag: i < 5 ? "top5" : p.trades < 12 ? "new" : "repeat",
  }));

// ── Collection impact ───────────────────────────────────────────────────────
const collection: CollectionImpact = {
  cardsAcquired: 47,
  wishlistAcquired: 12,
  setsProgressed: 3,
  biggestSetImprovement: { set: "Triumphant Light", deltaPct: 18 },
  mostValuableAcquisition: { card: "Mew ex", pack: "Triumphant Light", sand: 1200 },
};

export const MOCK_TRADE_ANALYTICS: TradeAnalyticsMock = {
  generatedAt: NOW,
  buckets,
  funnel,
  packs,
  partners,
  collection,
  mostExpensiveTradeId: "TR-9001",
};

// ── Derivation helpers used by the page ─────────────────────────────────────
export function sliceBuckets(b: DailyBucket[], tf: AnalyticsTimeframe): DailyBucket[] {
  if (tf === "all") return b;
  const days = tf === "7d" ? 7 : tf === "30d" ? 30 : 90;
  return b.slice(-days);
}

export function sumBuckets(b: DailyBucket[]) {
  return b.reduce(
    (a, x) => ({
      completed: a.completed + x.completed,
      failed: a.failed + x.failed,
      cancelled: a.cancelled + x.cancelled,
      sandEarned: a.sandEarned + x.sandEarned,
      sandSpent: a.sandSpent + x.sandSpent,
    }),
    { completed: 0, failed: 0, cancelled: 0, sandEarned: 0, sandSpent: 0 },
  );
}

export function deriveFunnel(b: DailyBucket[]): FunnelSnapshot {
  const s = sumBuckets(b);
  const requested = s.completed + s.failed + s.cancelled + Math.round(s.completed * 0.18);
  const matched = Math.round(requested * 0.9);
  const friend_sent = Math.round(matched * 0.92);
  const pick_card = Math.round(friend_sent * 0.93);
  return { requested, matched, friend_sent, pick_card, completed: s.completed };
}

// Rule-based suggestion engine (deterministic, no AI).
export type Suggestion = { title: string; body: string; href: string; cta: string };

export function suggest(
  b: DailyBucket[],
  packs: PackPerformance[],
  partners: PartnerPerformance[],
  pendingRequests: number,
): Suggestion {
  if (pendingRequests >= 3) {
    return {
      title: "Complete pending requests first",
      body: `You're at the 3/3 request cap. Wrap up an open trade before queuing more.`,
      href: "/card-request",
      cta: "Open Card Requests",
    };
  }
  const weakPack = [...packs].sort((a, b) => a.successPct - b.successPct)[0];
  if (weakPack && weakPack.successPct < 82) {
    return {
      title: `Avoid ${weakPack.pack} for now`,
      body: `Only ${weakPack.successPct}% of ${weakPack.pack} trades completed recently. Focus on stronger packs.`,
      href: "/card-request",
      cta: "Browse marketplace",
    };
  }
  const topPartner = partners[0];
  const topPack = packs[0];
  const recentNet = sumBuckets(b).sandEarned - sumBuckets(b).sandSpent;
  if (topPartner && topPartner.successPct >= 90) {
    return {
      title: `Trade more with ${topPartner.handle}`,
      body: `${topPartner.trades} trades · ${topPartner.successPct}% success · net ${topPartner.netSand >= 0 ? "+" : ""}${topPartner.netSand.toLocaleString()} Sand. Your strongest partner this period.`,
      href: `/trades?partner=${encodeURIComponent(topPartner.handle)}`,
      cta: "Open partner ledger",
    };
  }
  if (topPack) {
    return {
      title: `Focus on ${topPack.pack} trades`,
      body: `${topPack.trades} trades at ${topPack.successPct}% success. Net Sand ${recentNet >= 0 ? "+" : ""}${recentNet.toLocaleString()}.`,
      href: "/card-request",
      cta: "Browse marketplace",
    };
  }
  return {
    title: "Start your first trade",
    body: "No trade activity in this window yet.",
    href: "/card-request",
    cta: "Open Card Requests",
  };
}
