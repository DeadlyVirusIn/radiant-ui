// Canonical mock for the Card Request marketplace.
// Consumed by Home's MarketplacePreview AND /card-request. Do not fork.

import type { EnergyType } from "@/components/home/CardArt";
import type { Rarity } from "./mock-trades";

export type CardRequestAvailability = "available" | "limited" | "sold_out";

export type MarketplaceRarity = Rarity | "Crown" | "Immersive" | "Star" | "Full Art" | "EX";

export type CardRequest = {
  id: string;                  // "CR-xxxxx"
  card: {
    name: string;
    rarity: MarketplaceRarity;
    pack: string;
    type: EnergyType;
  };
  cost: number;                // Bright Sand
  availability: CardRequestAvailability;
  stockLabel: string;          // human-friendly availability label
  ownedByUser: number;
  listedAt: number;            // ms epoch
};

// ── Lifecycle ────────────────────────────────────────────────────────────────

export type UserRequestStatus =
  | "pending"
  | "matching"
  | "friend_sent"
  | "pick_card"
  | "accepted"
  | "completed"
  | "failed"
  | "cancelled"
  | "stuck";

export const USER_REQUEST_STATUS_META: Record<
  UserRequestStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; cls: string; terminal: boolean; description: string }
> = {
  pending:     { label: "Pending",       tone: "neutral", cls: "bg-muted text-muted-foreground border-border",      terminal: false, description: "Waiting to match with a trader" },
  matching:    { label: "Matching",      tone: "info",    cls: "bg-primary/15 text-primary border-primary/30",      terminal: false, description: "Looking for a matching partner" },
  friend_sent: { label: "Friend sent",   tone: "info",    cls: "bg-primary/15 text-primary border-primary/30",      terminal: false, description: "Friend request sent to partner" },
  pick_card:   { label: "Pick card",     tone: "warning", cls: "bg-warning/15 text-warning border-warning/30",      terminal: false, description: "Awaiting partner card selection" },
  accepted:    { label: "Accepted",      tone: "info",    cls: "bg-primary/15 text-primary border-primary/30",      terminal: false, description: "Trade accepted, finalizing" },
  completed:   { label: "Completed",     tone: "success", cls: "bg-success/15 text-success border-success/30",      terminal: true,  description: "Trade finished successfully" },
  failed:      { label: "Failed",        tone: "danger",  cls: "bg-destructive/15 text-destructive border-destructive/30", terminal: true, description: "Trade did not complete" },
  cancelled:   { label: "Cancelled",     tone: "neutral", cls: "bg-muted text-muted-foreground border-border",      terminal: true,  description: "You cancelled this request" },
  stuck:       { label: "Stuck",         tone: "warning", cls: "bg-warning/15 text-warning border-warning/30",      terminal: false, description: "Hasn't progressed recently" },
};

export type UserCardRequest = {
  id: string;                  // "UR-xxxxx"
  card: CardRequest["card"];
  cost: number;
  status: UserRequestStatus;
  createdAt: number;
  ageLabel: string;
  partner?: string;            // handle when matched
};

const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;

export const MOCK_CARD_REQUESTS: CardRequest[] = [
  {
    id: "CR-9f4a1",
    card: { name: "Mew ex",       rarity: "Crown",     pack: "Triumphant Light",     type: "psychic" },
    cost: 1200, availability: "limited", stockLabel: "3 left", ownedByUser: 0, listedAt: NOW - 12 * MIN,
  },
  {
    id: "CR-9f4a2",
    card: { name: "Blastoise ex", rarity: "EX",        pack: "Genetic Apex",         type: "water" },
    cost: 480,  availability: "available", stockLabel: "In stock", ownedByUser: 0, listedAt: NOW - 40 * MIN,
  },
  {
    id: "CR-9f4a3",
    card: { name: "Lugia Crown",  rarity: "Crown",     pack: "Space-Time Smackdown", type: "lightning" },
    cost: 1450, availability: "limited", stockLabel: "2 left", ownedByUser: 0, listedAt: NOW - 1 * HOUR,
  },
  {
    id: "CR-9f4a4",
    card: { name: "Charizard",    rarity: "Immersive", pack: "Genetic Apex",         type: "fire" },
    cost: 980,  availability: "available", stockLabel: "In stock", ownedByUser: 1, listedAt: NOW - 2 * HOUR,
  },
  {
    id: "CR-9f4a5",
    card: { name: "Articuno ex",  rarity: "EX",        pack: "Mythical Island",      type: "water" },
    cost: 420,  availability: "available", stockLabel: "In stock", ownedByUser: 0, listedAt: NOW - 3 * HOUR,
  },
  {
    id: "CR-9f4a6",
    card: { name: "Gengar ex",    rarity: "Immersive", pack: "Triumphant Light",     type: "psychic" },
    cost: 860,  availability: "limited", stockLabel: "1 left", ownedByUser: 0, listedAt: NOW - 4 * HOUR,
  },
  {
    id: "CR-9f4a7",
    card: { name: "Greninja ex",  rarity: "EX",        pack: "Genetic Apex",         type: "water" },
    cost: 390,  availability: "available", stockLabel: "In stock", ownedByUser: 0, listedAt: NOW - 5 * HOUR,
  },
  {
    id: "CR-9f4a8",
    card: { name: "Solar Crown",  rarity: "Star",      pack: "Triumphant Light",     type: "fire" },
    cost: 720,  availability: "sold_out", stockLabel: "Sold out", ownedByUser: 0, listedAt: NOW - 6 * HOUR,
  },
  {
    id: "CR-9f4a9",
    card: { name: "Rayquaza Crown", rarity: "Crown",   pack: "Triumphant Light",     type: "dragon" },
    cost: 1380, availability: "limited", stockLabel: "2 left", ownedByUser: 0, listedAt: NOW - 7 * HOUR,
  },
  {
    id: "CR-9f4b0",
    card: { name: "Pikachu ex",   rarity: "EX",        pack: "Genetic Apex",         type: "lightning" },
    cost: 540,  availability: "available", stockLabel: "In stock", ownedByUser: 0, listedAt: NOW - 8 * HOUR,
  },
  {
    id: "CR-9f4b1",
    card: { name: "Mewtwo ex",    rarity: "Crown",     pack: "Genetic Apex",         type: "psychic" },
    cost: 1280, availability: "available", stockLabel: "In stock", ownedByUser: 0, listedAt: NOW - 9 * HOUR,
  },
  {
    id: "CR-9f4b2",
    card: { name: "Halcyon Mark", rarity: "Full Art",  pack: "Mythical Island",      type: "fairy" },
    cost: 360,  availability: "available", stockLabel: "In stock", ownedByUser: 2, listedAt: NOW - 10 * HOUR,
  },
];

// "Matches your wishlist" subset surfaced on Home.
export const FEATURED_CARD_REQUESTS: CardRequest[] = MOCK_CARD_REQUESTS.slice(0, 4);

// Derived: unique packs and rarities for filter chips.
export const MARKETPLACE_PACKS: string[] = Array.from(
  new Set(MOCK_CARD_REQUESTS.map((c) => c.card.pack)),
);

export const MARKETPLACE_RARITIES: MarketplaceRarity[] = [
  "Crown", "Immersive", "Star", "Full Art", "EX",
];

// User's own requests (lifecycle preview).
export const MOCK_USER_REQUESTS: UserCardRequest[] = [
  {
    id: "UR-7c4e9",
    card: MOCK_CARD_REQUESTS[1].card, // Blastoise ex
    cost: 480,
    status: "pick_card",
    createdAt: NOW - 8 * MIN,
    ageLabel: "8m",
    partner: "user_kiera",
  },
  {
    id: "UR-7c4ea",
    card: MOCK_CARD_REQUESTS[4].card, // Articuno ex
    cost: 420,
    status: "matching",
    createdAt: NOW - 22 * MIN,
    ageLabel: "22m",
  },
  {
    id: "UR-7c4ec",
    card: MOCK_CARD_REQUESTS[6].card, // Greninja ex
    cost: 390,
    status: "stuck",
    createdAt: NOW - 3 * HOUR,
    ageLabel: "3h",
    partner: "user_arden",
  },
  {
    id: "UR-7c4ed",
    card: MOCK_CARD_REQUESTS[11].card, // Halcyon Mark
    cost: 360,
    status: "completed",
    createdAt: NOW - 5 * HOUR,
    ageLabel: "5h",
    partner: "user_nelle",
  },
  {
    id: "UR-7c4ee",
    card: MOCK_CARD_REQUESTS[7].card, // Solar Crown
    cost: 720,
    status: "failed",
    createdAt: NOW - 7 * HOUR,
    ageLabel: "7h",
  },
];

// Cap per blueprint (matches reference behavior).
export const PENDING_REQUEST_CAP = 3;
