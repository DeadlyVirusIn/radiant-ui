import { ACCOUNTS } from "./mock-accounts";

export type TradeStatus =
  | "pending"
  | "matching"
  | "friend_sent"
  | "proposal"
  | "completed"
  | "failed"
  | "cancelled";

export type TradeDirection = "incoming" | "outgoing";
export type Rarity = "C" | "U" | "R" | "EX" | "FA" | "IM" | "UR";

export const ACTIVE_STATUSES: TradeStatus[] = ["pending", "matching", "friend_sent", "proposal"];

export const STATUS_META: Record<
  TradeStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  pending: { label: "Pending", tone: "neutral" },
  matching: { label: "Matching", tone: "info" },
  friend_sent: { label: "Friend sent", tone: "info" },
  proposal: { label: "Proposal", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "warning" },
};

export type TradeCard = {
  name: string;
  rarity: Rarity;
  pack: string;
  qty: number;
};

export type TradePartner = {
  id: string;
  handle: string;
  avatarSeed: string;
};

export type LifecycleEvent = {
  ts: number;
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

export type TradeRecord = {
  id: string;
  requestId: string;
  origin: "card_request";
  originLabel: string;
  accountId: string;
  partner: TradePartner;
  direction: TradeDirection;
  gave: TradeCard[];
  got: TradeCard[];
  status: TradeStatus;
  completedAt: number;
  durationMs: number;
  lifecycle: LifecycleEvent[];
};

export type TradePowerSnapshot = {
  current: number;
  max: number;
  nextPipInMs: number;
  pipIntervalMs: number;
};

export type PartnerAggregate = {
  partner: TradePartner;
  tradeCount: number;
  successRate: number;
  lastTradeAt: number;
};

const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const PARTNERS: TradePartner[] = [
  { id: "p_kiera", handle: "user_kiera", avatarSeed: "kiera" },
  { id: "p_morrow", handle: "user_morrow", avatarSeed: "morrow" },
  { id: "p_arden", handle: "user_arden", avatarSeed: "arden" },
  { id: "p_nelle", handle: "user_nelle", avatarSeed: "nelle" },
  { id: "p_ferris", handle: "user_ferris", avatarSeed: "ferris" },
  { id: "p_solene", handle: "user_solene", avatarSeed: "solene" },
  { id: "p_tavi", handle: "user_tavi", avatarSeed: "tavi" },
];

function lc(start: number, ...steps: Array<[number, string, LifecycleEvent["tone"]]>): LifecycleEvent[] {
  let t = start;
  return steps.map(([dt, label, tone]) => {
    t += dt;
    return { ts: t, label, tone };
  });
}

const baseStarted = NOW - 4 * HOUR;

export const MOCK_TRADES: TradeRecord[] = [
  {
    id: "T-A91F2",
    requestId: "REQ-7c4e9",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[0],
    direction: "incoming",
    gave: [{ name: "Halcyon Mark", rarity: "R", pack: "Genetic Apex", qty: 1 }],
    got: [{ name: "Gilded Pact", rarity: "EX", pack: "Mythic Island", qty: 1 }],
    status: "completed",
    completedAt: NOW - 32 * MIN,
    durationMs: 4 * MIN + 12_000,
    lifecycle: lc(NOW - 36 * MIN, [0, "Request created", "neutral"], [45_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [70_000, "Trade proposal sent", "neutral"], [55_000, "Trade accepted", "success"], [22_000, "Completed", "success"]),
  },
  {
    id: "T-A91E8",
    requestId: "REQ-7c4d2",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[1],
    direction: "outgoing",
    gave: [{ name: "Solar Crown", rarity: "FA", pack: "Space-Time", qty: 1 }],
    got: [{ name: "Embered Vow", rarity: "EX", pack: "Mythic Island", qty: 1 }],
    status: "proposal",
    completedAt: NOW - 2 * MIN,
    durationMs: 0,
    lifecycle: lc(NOW - 6 * MIN, [0, "Request created", "neutral"], [40_000, "Matched", "neutral"], [80_000, "Friend request sent", "neutral"], [60_000, "Trade proposal sent", "neutral"]),
  },
  {
    id: "T-A91DA",
    requestId: "REQ-7c4c1",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[2],
    direction: "incoming",
    gave: [{ name: "Sovereign Loop", rarity: "R", pack: "Genetic Apex", qty: 1 }],
    got: [{ name: "Aureate Sigil", rarity: "EX", pack: "Genetic Apex", qty: 1 }],
    status: "completed",
    completedAt: NOW - 1 * HOUR,
    durationMs: 3 * MIN,
    lifecycle: lc(NOW - 1 * HOUR - 3 * MIN, [0, "Request created", "neutral"], [30_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [40_000, "Trade proposal sent", "neutral"], [40_000, "Trade accepted", "success"], [10_000, "Completed", "success"]),
  },
  {
    id: "T-A91CB",
    requestId: "REQ-7c4a8",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[3],
    direction: "outgoing",
    gave: [{ name: "Aureate Sigil", rarity: "EX", pack: "Genetic Apex", qty: 2 }],
    got: [{ name: "Halcyon Mark", rarity: "R", pack: "Genetic Apex", qty: 1 }],
    status: "completed",
    completedAt: NOW - 3 * HOUR,
    durationMs: 5 * MIN,
    lifecycle: lc(NOW - 3 * HOUR - 5 * MIN, [0, "Request created", "neutral"], [60_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [90_000, "Trade proposal sent", "neutral"], [60_000, "Trade accepted", "success"], [30_000, "Completed", "success"]),
  },
  {
    id: "T-A91BC",
    requestId: "REQ-7c498",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[4],
    direction: "incoming",
    gave: [{ name: "Embered Vow", rarity: "EX", pack: "Mythic Island", qty: 2 }],
    got: [{ name: "Solar Crown", rarity: "FA", pack: "Space-Time", qty: 1 }],
    status: "cancelled",
    completedAt: NOW - 5 * HOUR,
    durationMs: 90_000,
    lifecycle: lc(NOW - 5 * HOUR - 90_000, [0, "Request created", "neutral"], [60_000, "Matched", "neutral"], [30_000, "Cancelled by you", "warning"]),
  },
  {
    id: "T-A91AA",
    requestId: "REQ-7c481",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[0],
    direction: "outgoing",
    gave: [{ name: "Tideborn Crest", rarity: "EX", pack: "Mythic Island", qty: 1 }],
    got: [{ name: "Glacial Edict", rarity: "FA", pack: "Space-Time", qty: 1 }],
    status: "failed",
    completedAt: NOW - 8 * HOUR,
    durationMs: 6 * MIN,
    lifecycle: lc(NOW - 8 * HOUR - 6 * MIN, [0, "Request created", "neutral"], [50_000, "Matched", "neutral"], [120_000, "Friend request sent", "neutral"], [180_000, "Partner unresponsive", "danger"], [10_000, "Failed", "danger"]),
  },
  {
    id: "T-A919F",
    requestId: "REQ-7c463",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_02",
    partner: PARTNERS[5],
    direction: "incoming",
    gave: [{ name: "Verdant Oath", rarity: "EX", pack: "Genetic Apex", qty: 1 }],
    got: [{ name: "Obsidian Pact", rarity: "FA", pack: "Mythic Island", qty: 1 }],
    status: "completed",
    completedAt: NOW - 1 * DAY,
    durationMs: 4 * MIN,
    lifecycle: lc(NOW - 1 * DAY - 4 * MIN, [0, "Request created", "neutral"], [30_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [60_000, "Trade proposal sent", "neutral"], [60_000, "Trade accepted", "success"], [30_000, "Completed", "success"]),
  },
  {
    id: "T-A918E",
    requestId: "REQ-7c450",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_02",
    partner: PARTNERS[6],
    direction: "outgoing",
    gave: [{ name: "Crimson Wake", rarity: "R", pack: "Space-Time", qty: 1 }],
    got: [{ name: "Lunar Ember", rarity: "EX", pack: "Space-Time", qty: 1 }],
    status: "matching",
    completedAt: NOW - 30_000,
    durationMs: 0,
    lifecycle: lc(NOW - 90_000, [0, "Request created", "neutral"], [60_000, "Matching partner...", "neutral"]),
  },
  {
    id: "T-A917D",
    requestId: "REQ-7c43c",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[1],
    direction: "incoming",
    gave: [{ name: "Iron Vow", rarity: "U", pack: "Genetic Apex", qty: 1 }],
    got: [{ name: "Sigil of Dawn", rarity: "R", pack: "Genetic Apex", qty: 1 }],
    status: "completed",
    completedAt: NOW - 2 * DAY,
    durationMs: 3 * MIN,
    lifecycle: lc(baseStarted, [0, "Request created", "neutral"], [30_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [40_000, "Trade proposal sent", "neutral"], [40_000, "Trade accepted", "success"], [10_000, "Completed", "success"]),
  },
  {
    id: "T-A916C",
    requestId: "REQ-7c421",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[2],
    direction: "outgoing",
    gave: [{ name: "Eclipse Mark", rarity: "EX", pack: "Mythic Island", qty: 1 }],
    got: [{ name: "Auric Tide", rarity: "FA", pack: "Mythic Island", qty: 1 }],
    status: "pending",
    completedAt: NOW - 15_000,
    durationMs: 0,
    lifecycle: lc(NOW - 15_000, [0, "Request created", "neutral"]),
  },
  {
    id: "T-A915B",
    requestId: "REQ-7c40e",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[3],
    direction: "incoming",
    gave: [{ name: "Halcyon Mark", rarity: "R", pack: "Genetic Apex", qty: 1 }],
    got: [{ name: "Twilight Sigil", rarity: "EX", pack: "Mythic Island", qty: 1 }],
    status: "friend_sent",
    completedAt: NOW - 2 * MIN,
    durationMs: 0,
    lifecycle: lc(NOW - 3 * MIN, [0, "Request created", "neutral"], [40_000, "Matched", "neutral"], [80_000, "Friend request sent", "neutral"]),
  },
  {
    id: "T-A914A",
    requestId: "REQ-7c3f0",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[4],
    direction: "outgoing",
    gave: [{ name: "Bramble Pact", rarity: "U", pack: "Genetic Apex", qty: 1 }],
    got: [{ name: "Hollow Crown", rarity: "R", pack: "Space-Time", qty: 1 }],
    status: "completed",
    completedAt: NOW - 3 * DAY,
    durationMs: 4 * MIN,
    lifecycle: lc(NOW - 3 * DAY - 4 * MIN, [0, "Request created", "neutral"], [40_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [60_000, "Trade proposal sent", "neutral"], [60_000, "Trade accepted", "success"], [20_000, "Completed", "success"]),
  },
  {
    id: "T-A9139",
    requestId: "REQ-7c3d2",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_03",
    partner: PARTNERS[5],
    direction: "incoming",
    gave: [{ name: "Frost Sigil", rarity: "R", pack: "Space-Time", qty: 1 }],
    got: [{ name: "Sunfire Pact", rarity: "EX", pack: "Genetic Apex", qty: 1 }],
    status: "completed",
    completedAt: NOW - 4 * DAY,
    durationMs: 5 * MIN,
    lifecycle: lc(NOW - 4 * DAY - 5 * MIN, [0, "Request created", "neutral"], [60_000, "Matched", "neutral"], [60_000, "Friend request sent", "neutral"], [90_000, "Trade proposal sent", "neutral"], [60_000, "Trade accepted", "success"], [30_000, "Completed", "success"]),
  },
  {
    id: "T-A9128",
    requestId: "REQ-7c3b4",
    origin: "card_request",
    originLabel: "Card Request Marketplace",
    accountId: "acc_01",
    partner: PARTNERS[6],
    direction: "outgoing",
    gave: [{ name: "Onyx Vow", rarity: "R", pack: "Mythic Island", qty: 1 }],
    got: [{ name: "Mercury Crest", rarity: "EX", pack: "Space-Time", qty: 1 }],
    status: "failed",
    completedAt: NOW - 6 * DAY,
    durationMs: 7 * MIN,
    lifecycle: lc(NOW - 6 * DAY - 7 * MIN, [0, "Request created", "neutral"], [60_000, "Matched", "neutral"], [120_000, "Friend request sent", "neutral"], [240_000, "Partner declined", "danger"], [10_000, "Failed", "danger"]),
  },
];

void ACCOUNTS;

export const MOCK_TRADE_POWER: TradePowerSnapshot = {
  current: 5,
  max: 8,
  nextPipInMs: 18 * MIN,
  pipIntervalMs: 30 * MIN,
};

export const MOCK_PARTNERS: PartnerAggregate[] = (() => {
  const map = new Map<string, PartnerAggregate>();
  for (const t of MOCK_TRADES) {
    const cur = map.get(t.partner.id);
    if (cur) {
      cur.tradeCount += 1;
      if (t.status === "completed") cur.successRate += 1;
      if (t.completedAt > cur.lastTradeAt) cur.lastTradeAt = t.completedAt;
    } else {
      map.set(t.partner.id, {
        partner: t.partner,
        tradeCount: 1,
        successRate: t.status === "completed" ? 1 : 0,
        lastTradeAt: t.completedAt,
      });
    }
  }
  return Array.from(map.values())
    .map((p) => ({ ...p, successRate: p.successRate / p.tradeCount }))
    .sort((a, b) => b.tradeCount - a.tradeCount);
})();
