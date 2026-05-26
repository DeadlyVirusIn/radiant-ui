// Mock data + helpers for /sharing-cards — auto-gift rules for duplicates.
import type { RewardKind } from "@/lib/mock-rewards";

export type SharingScope = "duplicates" | "wishlist_match" | "rarity";
export type SharingState = "active" | "paused";

export type SharingRule = {
  id: string;
  name: string;
  /** Where the duplicates come from (your collection / a specific account). */
  from: string;
  /** Who receives the gift. */
  to: string;
  /** What the rule filters on. */
  scope: SharingScope;
  /** Human filter description. */
  filter: string;
  state: SharingState;
  /** Cards routed by this rule today vs daily cap. */
  sentToday: number;
  dailyCap: number;
  /** Lifetime cards routed by this rule. */
  routedLifetime: number;
};

export const SHARING_RULES: SharingRule[] = [
  { id: "r-1", name: "Duplicates → Newer friends", from: "My collection", to: "Friends ≥ 3 days",  scope: "duplicates",     filter: "Duplicates only",       state: "active", sentToday: 6,  dailyCap: 10, routedLifetime: 184 },
  { id: "r-2", name: "Wishlist matches → Nelle",   from: "My collection", to: "Nelle",             scope: "wishlist_match", filter: "Matches her wishlist",  state: "active", sentToday: 2,  dailyCap: 5,  routedLifetime: 41  },
  { id: "r-3", name: "Rares → Inner circle",       from: "My collection", to: "Top 3 traders",     scope: "rarity",         filter: "Rare or above",         state: "active", sentToday: 1,  dailyCap: 3,  routedLifetime: 27  },
  { id: "r-4", name: "Legendaries → Manual",       from: "My collection", to: "Manual approve",    scope: "rarity",         filter: "Legendary only",        state: "paused", sentToday: 0,  dailyCap: 2,  routedLifetime: 6   },
];

export type SharingRecent = {
  id: string;
  ruleId: string;
  to: string;
  card: string;
  rewardKind: RewardKind;
  whenHours: number;
};

export const SHARING_RECENT: SharingRecent[] = [
  { id: "s-1", ruleId: "r-1", to: "Soren", card: "Tidal Drake",     rewardKind: "card",     whenHours: 0 },
  { id: "s-2", ruleId: "r-2", to: "Nelle", card: "Solar Crown",     rewardKind: "card",     whenHours: 1 },
  { id: "s-3", ruleId: "r-1", to: "Arden", card: "Cinder Hare",     rewardKind: "card",     whenHours: 2 },
  { id: "s-4", ruleId: "r-3", to: "Kiera", card: "Aureate Sigil",   rewardKind: "card",     whenHours: 5 },
  { id: "s-5", ruleId: "r-1", to: "Mira",  card: "Verdant Mote",    rewardKind: "card",     whenHours: 9 },
];

export const SCOPE_META: Record<SharingScope, { label: string; dotClass: string; textClass: string }> = {
  duplicates:     { label: "Duplicates",      dotClass: "bg-primary", textClass: "text-primary" },
  wishlist_match: { label: "Wishlist match",  dotClass: "bg-warning", textClass: "text-warning" },
  rarity:         { label: "Rarity filter",   dotClass: "bg-success", textClass: "text-success" },
};

export type SharingSummary = {
  activeRules: number;
  sentToday: number;
  routedLifetime: number;
  ceilingHit: number; // rules that have hit their daily cap
};

export function getSharingSummary(items: SharingRule[] = SHARING_RULES): SharingSummary {
  const active = items.filter((r) => r.state === "active");
  return {
    activeRules: active.length,
    sentToday: active.reduce((n, r) => n + r.sentToday, 0),
    routedLifetime: items.reduce((n, r) => n + r.routedLifetime, 0),
    ceilingHit: active.filter((r) => r.sentToday >= r.dailyCap).length,
  };
}

export function formatRecentChip(hours: number): string {
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const d = Math.round(hours / 24);
  return `${d}d ago`;
}
