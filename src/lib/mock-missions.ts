// Mock data + helpers for the /missions page.
// Daily play-loop only. No backend, no economy calculations.

export type MissionScope = "daily" | "weekly" | "event";
export type MissionCategory = "play" | "collect" | "trade" | "social";
export type MissionState = "in_progress" | "complete_unclaimed" | "claimed";
export type RewardKind = "pack" | "hourglass" | "ticket" | "dust" | "card";

export type MissionActionTo =
  | "/open-pack"
  | "/hunt"
  | "/trades"
  | "/wonder-pick"
  | "/cards"
  | "/wishlist"
  | "/card-request"
  | null;

export type Mission = {
  id: string;
  scope: MissionScope;
  category: MissionCategory;
  title: string;
  hint?: string;
  progress: { done: number; total: number };
  reward: { kind: RewardKind; amount: number; label: string };
  state: MissionState;
  actionTo: MissionActionTo;
  /** Hours until this mission resets / expires. */
  resetInHours: number;
};

// Reward "value" used purely to break ties when ranking the recommended next mission.
// Higher = better. NOT a real economy calculation.
const REWARD_WEIGHT: Record<RewardKind, number> = {
  card: 100,
  pack: 80,
  ticket: 60,
  hourglass: 30,
  dust: 10,
};

export const MISSIONS: Mission[] = [
  // ───── Daily ─────
  {
    id: "d-open-3",
    scope: "daily",
    category: "play",
    title: "Open 3 packs",
    hint: "Any expansion counts.",
    progress: { done: 2, total: 3 },
    reward: { kind: "hourglass", amount: 6, label: "+6 hourglasses" },
    state: "in_progress",
    actionTo: "/open-pack",
    resetInHours: 6,
  },
  {
    id: "d-wonder-1",
    scope: "daily",
    category: "play",
    title: "Try 1 Wonder Pick",
    progress: { done: 0, total: 1 },
    reward: { kind: "ticket", amount: 1, label: "+1 wonder ticket" },
    state: "in_progress",
    actionTo: "/wonder-pick",
    resetInHours: 6,
  },
  {
    id: "d-add-2",
    scope: "daily",
    category: "collect",
    title: "Add 2 new cards to your collection",
    progress: { done: 2, total: 2 },
    reward: { kind: "pack", amount: 1, label: "+1 pack" },
    state: "complete_unclaimed",
    actionTo: "/cards",
    resetInHours: 6,
  },
  {
    id: "d-trade-1",
    scope: "daily",
    category: "trade",
    title: "Post 1 trade",
    progress: { done: 1, total: 1 },
    reward: { kind: "dust", amount: 20, label: "+20 dust" },
    state: "claimed",
    actionTo: "/trades",
    resetInHours: 6,
  },

  // ───── Weekly ─────
  {
    id: "w-hunt-20",
    scope: "weekly",
    category: "play",
    title: "Open 20 packs this week",
    progress: { done: 17, total: 20 },
    reward: { kind: "pack", amount: 2, label: "+2 packs" },
    state: "in_progress",
    actionTo: "/hunt",
    resetInHours: 56,
  },
  {
    id: "w-wishlist-3",
    scope: "weekly",
    category: "collect",
    title: "Pull 3 wishlist cards",
    progress: { done: 1, total: 3 },
    reward: { kind: "ticket", amount: 2, label: "+2 wonder tickets" },
    state: "in_progress",
    actionTo: "/wishlist",
    resetInHours: 56,
  },
  {
    id: "w-trade-3",
    scope: "weekly",
    category: "trade",
    title: "Complete 3 trades",
    progress: { done: 3, total: 3 },
    reward: { kind: "card", amount: 1, label: "+1 random rare" },
    state: "complete_unclaimed",
    actionTo: "/trades",
    resetInHours: 56,
  },
  {
    id: "w-request-1",
    scope: "weekly",
    category: "social",
    title: "Answer 1 card request",
    progress: { done: 0, total: 1 },
    reward: { kind: "hourglass", amount: 12, label: "+12 hourglasses" },
    state: "in_progress",
    actionTo: "/card-request",
    resetInHours: 56,
  },

  // ───── Event ─────
  {
    id: "e-mewtwo-week",
    scope: "event",
    category: "play",
    title: "Mewtwo Week · open 5 Genetic Apex packs",
    hint: "Limited event — ends in 2 days.",
    progress: { done: 3, total: 5 },
    reward: { kind: "pack", amount: 1, label: "+1 Mewtwo pack" },
    state: "in_progress",
    actionTo: "/open-pack",
    resetInHours: 48,
  },
  {
    id: "e-mewtwo-share",
    scope: "event",
    category: "social",
    title: "Mewtwo Week · share 1 pull",
    progress: { done: 1, total: 1 },
    reward: { kind: "ticket", amount: 1, label: "+1 wonder ticket" },
    state: "complete_unclaimed",
    actionTo: "/cards",
    resetInHours: 48,
  },
];

export type MissionSummary = {
  dailyDone: number;
  dailyTotal: number;
  weeklyDone: number;
  weeklyTotal: number;
  unclaimed: number;
  streakDays: number;
};

export function getMissionSummary(missions: Mission[] = MISSIONS): MissionSummary {
  const daily = missions.filter((m) => m.scope === "daily");
  const weekly = missions.filter((m) => m.scope === "weekly");
  const done = (m: Mission) => m.state !== "in_progress";
  return {
    dailyDone: daily.filter(done).length,
    dailyTotal: daily.length,
    weeklyDone: weekly.filter(done).length,
    weeklyTotal: weekly.length,
    unclaimed: missions.filter((m) => m.state === "complete_unclaimed").length,
    streakDays: 12,
  };
}

export function unclaimedCount(missions: Mission[] = MISSIONS): number {
  return missions.filter((m) => m.state === "complete_unclaimed").length;
}

/**
 * Recommend the next mission for the "Today's focus" hero.
 * Ranking:
 *   1. Closest to completion (highest progress %, but not yet complete)
 *   2. Highest reward weight (tiebreak)
 *   3. Earliest reset (tiebreak)
 * Only considers daily missions still in progress.
 */
export function recommendedNext(missions: Mission[] = MISSIONS): Mission | null {
  const candidates = missions.filter(
    (m) => m.scope === "daily" && m.state === "in_progress",
  );
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const pa = a.progress.done / a.progress.total;
    const pb = b.progress.done / b.progress.total;
    if (pb !== pa) return pb - pa;
    const wa = REWARD_WEIGHT[a.reward.kind] * a.reward.amount;
    const wb = REWARD_WEIGHT[b.reward.kind] * b.reward.amount;
    if (wb !== wa) return wb - wa;
    return a.resetInHours - b.resetInHours;
  })[0];
}

/**
 * Sort missions for display within a tab:
 *   complete_unclaimed -> nearly complete (>75%) -> in progress -> claimed
 */
export function sortForDisplay(missions: Mission[]): Mission[] {
  const bucket = (m: Mission): number => {
    if (m.state === "complete_unclaimed") return 0;
    if (m.state === "claimed") return 3;
    const pct = m.progress.done / m.progress.total;
    return pct > 0.75 ? 1 : 2;
  };
  return [...missions].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    const pa = a.progress.done / a.progress.total;
    const pb = b.progress.done / b.progress.total;
    return pb - pa;
  });
}

export function formatResetChip(hours: number): string {
  if (hours <= 0) return "Resets soon";
  if (hours < 24) return `Resets in ${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d left`;
}

export const CATEGORY_META: Record<
  MissionCategory,
  { label: string; dotClass: string; textClass: string }
> = {
  play: { label: "Play", dotClass: "bg-primary", textClass: "text-primary" },
  collect: { label: "Collect", dotClass: "bg-success", textClass: "text-success" },
  trade: { label: "Trade", dotClass: "bg-warning", textClass: "text-warning" },
  social: { label: "Social", dotClass: "bg-accent-foreground", textClass: "text-foreground" },
};
