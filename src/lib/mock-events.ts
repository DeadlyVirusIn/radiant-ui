// Mock data + helpers for /events.
// Collector-facing Live Events. No backend.

export type EventState = "active" | "upcoming" | "ended";
export type EventCategory = "expansion" | "tournament" | "community" | "shop";

export type LiveEvent = {
  id: string;
  name: string;
  tagline: string;
  category: EventCategory;
  state: EventState;
  /** Hours until start (upcoming) or end (active). 0 for ended. */
  hoursLeft: number;
  /** Human banner blurb for the card body. */
  blurb: string;
  rewards: string[];
  /** Deep-link to the most relevant collector surface. */
  actionTo?: "/open-pack" | "/missions" | "/wonder-pick" | "/cards" | "/shop";
  actionQuery?: Record<string, string>;
  actionLabel?: string;
};

export const EVENTS: LiveEvent[] = [
  // Active
  {
    id: "mewtwo-week",
    name: "Mewtwo Week",
    tagline: "Boosted Genetic Apex pulls",
    category: "expansion",
    state: "active",
    hoursLeft: 48,
    blurb: "Open Genetic Apex packs for boosted Mewtwo odds and event-exclusive rewards.",
    rewards: ["+1 Mewtwo pack", "+2 wonder tickets", "Event badge"],
    actionTo: "/open-pack",
    actionQuery: { set: "GA" },
    actionLabel: "Open Genetic Apex",
  },
  {
    id: "trade-rush",
    name: "Trade Rush",
    tagline: "Double rewards on completed trades",
    category: "community",
    state: "active",
    hoursLeft: 18,
    blurb: "Every completed trade this weekend earns double mission credit and bonus dust.",
    rewards: ["2× trade mission credit", "+50 dust per trade"],
    actionTo: "/missions",
    actionLabel: "View trade missions",
  },

  // Upcoming
  {
    id: "spacetime-drop",
    name: "Space-Time Drop",
    tagline: "New expansion launch",
    category: "expansion",
    state: "upcoming",
    hoursLeft: 72,
    blurb: "A new expansion drops in 3 days. Save your hourglasses — first pulls earn launch bonuses.",
    rewards: ["Launch login pack", "Day-one collector achievement"],
    actionTo: "/cards",
    actionLabel: "Review collection",
  },
  {
    id: "wonder-weekend",
    name: "Wonder Weekend",
    tagline: "Free Wonder Picks every 4h",
    category: "community",
    state: "upcoming",
    hoursLeft: 120,
    blurb: "Get a free Wonder Pick ticket every 4 hours during the event window.",
    rewards: ["Free wonder tickets", "Bonus event missions"],
    actionTo: "/wonder-pick",
    actionLabel: "Wonder Pick",
  },

  // Ended
  {
    id: "charizard-cup",
    name: "Charizard Cup",
    tagline: "Boosted Charizard pulls",
    category: "expansion",
    state: "ended",
    hoursLeft: 0,
    blurb: "Boosted Charizard odds across Genetic Apex packs. Rewards delivered to Present Box.",
    rewards: ["Charizard event pack", "Event badge"],
  },
  {
    id: "launch-week",
    name: "Launch Week",
    tagline: "Welcome event",
    category: "community",
    state: "ended",
    hoursLeft: 0,
    blurb: "The original launch event. Day-one collector achievement awarded.",
    rewards: ["Starter pack", "Day-one badge"],
  },
];

export function formatEventChip(state: EventState, hours: number): string {
  if (state === "ended") return "Ended";
  if (state === "upcoming") {
    if (hours < 24) return `Starts in ${hours}h`;
    return `Starts in ${Math.round(hours / 24)}d`;
  }
  if (hours < 24) return `Ends in ${hours}h`;
  return `${Math.round(hours / 24)}d left`;
}

export type EventSummary = {
  active: number;
  upcoming: number;
  endedRecent: number;
  rewardsReady: number;
};

export function getEventSummary(items: LiveEvent[] = EVENTS): EventSummary {
  return {
    active: items.filter((e) => e.state === "active").length,
    upcoming: items.filter((e) => e.state === "upcoming").length,
    endedRecent: items.filter((e) => e.state === "ended").length,
    rewardsReady: 3, // matches Presents mock — event-sourced ready items
  };
}

export const CATEGORY_META: Record<EventCategory, { label: string; dotClass: string }> = {
  expansion:  { label: "Expansion",  dotClass: "bg-primary" },
  tournament: { label: "Tournament", dotClass: "bg-warning" },
  community:  { label: "Community",  dotClass: "bg-success" },
  shop:       { label: "Shop",       dotClass: "bg-accent-foreground" },
};
