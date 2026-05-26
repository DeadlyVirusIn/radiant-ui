// Home-local mocks. Restricted (per approved blueprint) to:
//   - PLAYER
//   - ACTIVE_HUNT
//   - WAITING_ITEMS
// Everything else on Home stays sourced from its existing owner (in-file
// fixtures in index.tsx) until a canonical module ships for it.
//
// WAITING_ITEMS is partially derived from canonical sources:
//   - "Trade requests waiting" count → mock-trades.ts (proposal + friend_sent)

import { MOCK_TRADES } from "./mock-trades";

export type WaitingKind = "gift" | "trade" | "hunt_ready" | "mission";

// Sort weight: 2 = Ready/Claimable, 1 = Action required, 0 = In progress.
export type WaitingUrgency = 0 | 1 | 2;

export type WaitingTo =
  | "/presents"
  | "/sharing-cards"
  | "/trades"
  | "/hunt"
  | "/missions";

export type WaitingItem = {
  id: string;
  kind: WaitingKind;
  title: string;
  sub: string;
  cta: string;
  to: WaitingTo;
  urgency: WaitingUrgency;
};

export type ActiveHunt = {
  name: string;
  set: string;
  status: "in_progress" | "ready_to_send";
  progress: number;      // 0..100
  etaLabel: string;
};

export const PLAYER = {
  name: "Riko",
  level: 27,
  xpInLevel: 1820,
  xpToNext: 2400,
  streakDays: 12,
  goldFlair: 1284,
  staminaNow: 38,
  staminaMax: 50,
  collectionPct: 67,
  ownedCards: 1241,
  totalCards: 1840,
};

export const ACTIVE_HUNT: ActiveHunt = {
  name: "Gengar ex",
  set: "Triumphant Light",
  status: "in_progress",
  progress: 72,
  etaLabel: "Ready soon",
};

const tradesWaiting = MOCK_TRADES.filter(
  (t) => t.status === "proposal" || t.status === "friend_sent",
).length;

export const WAITING_ITEMS: WaitingItem[] = [
  {
    id: "w-gifts",
    kind: "gift",
    title: "3 gifts to claim",
    sub: "From Hana, Daichi, Yui",
    cta: "Claim all",
    to: "/presents",
    urgency: 2,
  },
  {
    id: "w-hunt-ready",
    kind: "hunt_ready",
    title: "Solar Crown hunt ready",
    sub: "Triumphant Light · 2,240 pulls",
    cta: "Send",
    to: "/hunt",
    urgency: 2,
  },
  {
    id: "w-trades",
    kind: "trade",
    title: `${tradesWaiting} trade${tradesWaiting === 1 ? "" : "s"} waiting for you`,
    sub: "Proposals and friend requests pending",
    cta: "Review",
    to: "/trades",
    urgency: 1,
  },
  {
    id: "w-sharing",
    kind: "gift",
    title: "Send a card to a friend",
    sub: "Daily mission · 0 of 1",
    cta: "Send",
    to: "/sharing-cards",
    urgency: 1,
  },
  {
    id: "w-missions",
    kind: "mission",
    title: "Daily missions — 2 of 4",
    sub: "Resets in 7h 24m",
    cta: "Continue",
    to: "/missions",
    urgency: 0,
  },
];
