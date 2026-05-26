// Canonical mock for the Card Request marketplace.
// Consumed today by Home's MarketplacePreview. Will be the source of truth
// for /card-request when that page is redesigned. Do not fork.

import type { EnergyType } from "@/components/home/CardArt";
import type { Rarity } from "./mock-trades";

export type CardRequestAvailability = "available" | "limited" | "sold_out";

export type CardRequest = {
  id: string;                  // "CR-xxxxx"
  card: {
    name: string;
    rarity: Rarity | "Crown" | "Immersive" | "Star" | "Full Art" | "EX";
    pack: string;
    type: EnergyType;
  };
  cost: number;                // Bright Sand
  availability: CardRequestAvailability;
  stockLabel: string;          // human-friendly availability label
  ownedByUser: number;
  listedAt: number;            // ms epoch
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
];

// "Matches your wishlist" subset surfaced on Home.
export const FEATURED_CARD_REQUESTS: CardRequest[] = MOCK_CARD_REQUESTS.slice(0, 4);
