// Mock data + helpers for /presents.
// Reward inbox. Claim flow mirrors Missions: local state + sonner toast.

export type PresentSource = "mission" | "event" | "friend" | "system" | "trade";
export type PresentState = "ready" | "claimed";
export type PresentRewardKind = "pack" | "hourglass" | "ticket" | "dust" | "card";

export type Present = {
  id: string;
  source: PresentSource;
  /** Who/what produced this reward, e.g. "Daily missions" or "Mewtwo Week". */
  from: string;
  item: string;
  kind: PresentRewardKind;
  amount: number;
  state: PresentState;
  /** Hours until this present expires. Only meaningful while state === "ready". */
  expiresInHours: number;
  /** Deep-link back to the surface that produced this reward, when relevant. */
  originTo?: "/missions" | "/events" | "/trades" | "/friends";
  claimedAt?: string;
};

export const PRESENTS: Present[] = [
  // Mission rewards
  { id: "p-1", source: "mission", from: "Daily missions",  item: "10 hourglasses",        kind: "hourglass", amount: 10, state: "ready",   expiresInHours: 18, originTo: "/missions" },
  { id: "p-2", source: "mission", from: "Weekly missions", item: "1 random rare card",    kind: "card",      amount: 1,  state: "ready",   expiresInHours: 56, originTo: "/missions" },
  { id: "p-3", source: "mission", from: "Daily missions",  item: "1 pack",                kind: "pack",      amount: 1,  state: "ready",   expiresInHours: 6,  originTo: "/missions" },

  // Event
  { id: "p-4", source: "event",   from: "Mewtwo Week",     item: "Mewtwo event pack",     kind: "pack",      amount: 1,  state: "ready",   expiresInHours: 48, originTo: "/events" },
  { id: "p-5", source: "event",   from: "Mewtwo Week",     item: "2 wonder tickets",      kind: "ticket",    amount: 2,  state: "ready",   expiresInHours: 48, originTo: "/events" },

  // Friend / trade
  { id: "p-6", source: "friend",  from: "Nelle",           item: "Solar Crown",           kind: "card",      amount: 1,  state: "ready",   expiresInHours: 96, originTo: "/friends" },
  { id: "p-7", source: "trade",   from: "Trade settled",   item: "Aureate Sigil",         kind: "card",      amount: 1,  state: "claimed", expiresInHours: 0,  originTo: "/trades", claimedAt: "2h ago" },

  // System
  { id: "p-8", source: "system",  from: "Login bonus",     item: "200 shine dust",        kind: "dust",      amount: 200, state: "claimed", expiresInHours: 0, claimedAt: "Yesterday" },
  { id: "p-9", source: "system",  from: "Launch gift",     item: "Starter pack",          kind: "pack",      amount: 1,  state: "claimed", expiresInHours: 0, claimedAt: "Mar 10" },
];

export type PresentSummary = {
  ready: number;
  expiringSoon: number;
  claimed24h: number;
  totalLifetime: number;
};

export function getPresentSummary(items: Present[] = PRESENTS): PresentSummary {
  return {
    ready: items.filter((p) => p.state === "ready").length,
    expiringSoon: items.filter((p) => p.state === "ready" && p.expiresInHours < 24).length,
    claimed24h: 9, // fixed mock — would come from real claim history
    totalLifetime: 142,
  };
}

export function formatExpiryChip(hours: number): string {
  if (hours <= 0) return "Expired";
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d left`;
}

export const SOURCE_META: Record<PresentSource, { label: string; dotClass: string; textClass: string }> = {
  mission: { label: "Missions",   dotClass: "bg-primary",          textClass: "text-primary" },
  event:   { label: "Events",     dotClass: "bg-warning",          textClass: "text-warning" },
  friend:  { label: "Friends",    dotClass: "bg-success",          textClass: "text-success" },
  trade:   { label: "Trades",     dotClass: "bg-accent-foreground", textClass: "text-foreground" },
  system:  { label: "System",     dotClass: "bg-muted-foreground", textClass: "text-muted-foreground" },
};
