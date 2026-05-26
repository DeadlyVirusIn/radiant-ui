// Mock data + helpers for /achievements.
// Lifetime collector milestones. No backend, no economy.

export type AchievementCategory = "collect" | "play" | "trade" | "social" | "event";
export type AchievementTier = "bronze" | "silver" | "gold" | "legendary";
export type AchievementState = "locked" | "in_progress" | "unlocked";

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  tier: AchievementTier;
  progress: { done: number; total: number };
  state: AchievementState;
  /** Optional deep-link to the surface that advances this achievement. */
  actionTo?: "/open-pack" | "/cards" | "/trades" | "/wishlist" | "/hunt" | "/friends" | "/wonder-pick";
  unlockedAt?: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Collect
  { id: "c-first-card", name: "First card", desc: "Add your first card to the collection.", category: "collect", tier: "bronze", progress: { done: 1, total: 1 }, state: "unlocked", unlockedAt: "Mar 12" },
  { id: "c-100-cards", name: "Centurion", desc: "Own 100 unique cards.", category: "collect", tier: "silver", progress: { done: 87, total: 100 }, state: "in_progress", actionTo: "/open-pack" },
  { id: "c-set-complete", name: "Set complete", desc: "Finish any expansion set.", category: "collect", tier: "gold", progress: { done: 0, total: 1 }, state: "in_progress", actionTo: "/cards" },
  { id: "c-rare-10", name: "Rare hoarder", desc: "Pull 10 rare cards.", category: "collect", tier: "silver", progress: { done: 10, total: 10 }, state: "unlocked", unlockedAt: "Apr 02" },
  { id: "c-wishlist-clear", name: "Wishlist crusher", desc: "Pull every card on your wishlist.", category: "collect", tier: "legendary", progress: { done: 4, total: 12 }, state: "in_progress", actionTo: "/wishlist" },

  // Play
  { id: "p-pack-10", name: "Pack opener", desc: "Open 10 packs.", category: "play", tier: "bronze", progress: { done: 10, total: 10 }, state: "unlocked", unlockedAt: "Mar 14" },
  { id: "p-pack-500", name: "Pack marathon", desc: "Open 500 packs lifetime.", category: "play", tier: "gold", progress: { done: 312, total: 500 }, state: "in_progress", actionTo: "/open-pack" },
  { id: "p-wonder-10", name: "Wonder picker", desc: "Complete 10 Wonder Picks.", category: "play", tier: "silver", progress: { done: 6, total: 10 }, state: "in_progress", actionTo: "/wonder-pick" },
  { id: "p-hunt-marathon", name: "Hunt night", desc: "Open 25 packs in one session.", category: "play", tier: "gold", progress: { done: 0, total: 25 }, state: "locked", actionTo: "/hunt" },

  // Trade
  { id: "t-first-trade", name: "Trade handshake", desc: "Complete your first trade.", category: "trade", tier: "bronze", progress: { done: 1, total: 1 }, state: "unlocked", unlockedAt: "Mar 22" },
  { id: "t-trade-50", name: "Trade veteran", desc: "Complete 50 trades.", category: "trade", tier: "gold", progress: { done: 23, total: 50 }, state: "in_progress", actionTo: "/trades" },

  // Social
  { id: "s-friend-5", name: "Circle of five", desc: "Add 5 friends.", category: "social", tier: "bronze", progress: { done: 5, total: 5 }, state: "unlocked", unlockedAt: "Mar 18" },
  { id: "s-friend-50", name: "Network", desc: "Add 50 friends.", category: "social", tier: "silver", progress: { done: 18, total: 50 }, state: "in_progress", actionTo: "/friends" },

  // Event
  { id: "e-mewtwo", name: "Mewtwo Week", desc: "Participate in the Mewtwo Week event.", category: "event", tier: "silver", progress: { done: 3, total: 5 }, state: "in_progress", actionTo: "/open-pack" },
  { id: "e-launch", name: "Day-one collector", desc: "Joined during launch week.", category: "event", tier: "legendary", progress: { done: 1, total: 1 }, state: "unlocked", unlockedAt: "Mar 10" },
];

export const TIER_META: Record<AchievementTier, { label: string; ringClass: string; bgClass: string; textClass: string }> = {
  bronze:    { label: "Bronze",    ringClass: "ring-amber-700/40",   bgClass: "bg-amber-700/10",   textClass: "text-amber-600" },
  silver:    { label: "Silver",    ringClass: "ring-slate-300/40",   bgClass: "bg-slate-300/10",   textClass: "text-slate-200" },
  gold:      { label: "Gold",      ringClass: "ring-warning/50",     bgClass: "bg-warning/10",     textClass: "text-warning" },
  legendary: { label: "Legendary", ringClass: "ring-primary/50",     bgClass: "bg-primary/10",     textClass: "text-primary" },
};

export const CATEGORY_META: Record<AchievementCategory, { label: string }> = {
  collect: { label: "Collect" },
  play:    { label: "Play" },
  trade:   { label: "Trade" },
  social:  { label: "Social" },
  event:   { label: "Event" },
};

export type AchievementSummary = {
  unlocked: number;
  total: number;
  inProgress: number;
  legendary: number;
};

export function getAchievementSummary(items: Achievement[] = ACHIEVEMENTS): AchievementSummary {
  return {
    unlocked: items.filter((a) => a.state === "unlocked").length,
    total: items.length,
    inProgress: items.filter((a) => a.state === "in_progress").length,
    legendary: items.filter((a) => a.tier === "legendary" && a.state === "unlocked").length,
  };
}

export function sortAchievements(items: Achievement[]): Achievement[] {
  const stateRank = (a: Achievement) =>
    a.state === "in_progress" ? 0 : a.state === "unlocked" ? 1 : 2;
  return [...items].sort((a, b) => {
    const sa = stateRank(a);
    const sb = stateRank(b);
    if (sa !== sb) return sa - sb;
    if (a.state === "in_progress") {
      return b.progress.done / b.progress.total - a.progress.done / a.progress.total;
    }
    return 0;
  });
}
