import type { EnergyType } from "@/components/home/CardArt";

export type Rarity =
  | "Common" | "Uncommon" | "Rare" | "EX" | "Full Art" | "Star" | "Immersive" | "Crown";

export type SetInfo = {
  id: string;
  name: string;
  short: string;
  total: number;
};

export const SETS: SetInfo[] = [
  { id: "TL",  name: "Triumphant Light",     short: "TL",  total: 120 },
  { id: "MI",  name: "Mythical Island",      short: "MI",  total: 86  },
  { id: "STS", name: "Space-Time Smackdown", short: "STS", total: 108 },
  { id: "GA",  name: "Genetic Apex",         short: "GA",  total: 286 },
];

export type Card = {
  id: string;
  name: string;
  set: string;
  number: string;       // e.g. "TL 086/120"
  numberIndex: number;  // numeric part for set-order sort
  type: EnergyType;
  rarity: Rarity;
  owned: number;        // 0 = missing
  wishlist?: boolean;
  pullOdds?: string;
  acquiredAt?: string;  // ISO date for owned cards
};

// Source cards. Mock-only.
const RAW: Array<Omit<Card, "numberIndex">> = [
  { id: "c01", name: "Mew ex",          set: "TL",  number: "TL 086/120",  type: "psychic",   rarity: "Crown",     owned: 0, wishlist: true,  pullOdds: "0.05%" },
  { id: "c02", name: "Rayquaza Crown",  set: "TL",  number: "TL 119/120",  type: "dragon",    rarity: "Crown",     owned: 0, wishlist: true,  pullOdds: "0.05%" },
  { id: "c03", name: "Gengar ex",       set: "TL",  number: "TL 067/120",  type: "psychic",   rarity: "Immersive", owned: 1, acquiredAt: "2026-05-21", pullOdds: "0.15%" },
  { id: "c04", name: "Solar Crown",     set: "TL",  number: "TL 118/120",  type: "fire",      rarity: "Crown",     owned: 1, acquiredAt: "2026-05-12", pullOdds: "0.05%" },
  { id: "c05", name: "Charizard ex",    set: "GA",  number: "GA 184/286",  type: "fire",      rarity: "EX",        owned: 3, acquiredAt: "2026-05-23", pullOdds: "1.2%" },
  { id: "c06", name: "Blastoise ex",    set: "GA",  number: "GA 200/286",  type: "water",     rarity: "EX",        owned: 0, wishlist: true,  pullOdds: "1.2%" },
  { id: "c07", name: "Venusaur ex",     set: "GA",  number: "GA 211/286",  type: "grass",     rarity: "EX",        owned: 2, acquiredAt: "2026-05-08", pullOdds: "1.2%" },
  { id: "c08", name: "Pikachu ex",      set: "GA",  number: "GA 096/286",  type: "lightning", rarity: "EX",        owned: 4, acquiredAt: "2026-05-25", pullOdds: "1.2%" },
  { id: "c09", name: "Mewtwo ex",       set: "GA",  number: "GA 286/286",  type: "psychic",   rarity: "Immersive", owned: 1, acquiredAt: "2026-04-30", pullOdds: "0.15%" },
  { id: "c10", name: "Articuno ex",     set: "MI",  number: "MI 084/086",  type: "water",     rarity: "EX",        owned: 0,                  pullOdds: "1.2%" },
  { id: "c11", name: "Mew",             set: "MI",  number: "MI 085/086",  type: "psychic",   rarity: "Star",      owned: 0, wishlist: true,  pullOdds: "0.5%" },
  { id: "c12", name: "Lugia Crown",     set: "STS", number: "STS 108/108", type: "lightning", rarity: "Crown",     owned: 0,                  pullOdds: "0.05%" },
  { id: "c13", name: "Snorlax",         set: "GA",  number: "GA 145/286",  type: "colorless", rarity: "Star",      owned: 2, acquiredAt: "2026-05-18" },
  { id: "c14", name: "Eevee",           set: "GA",  number: "GA 089/286",  type: "colorless", rarity: "Rare",      owned: 5, acquiredAt: "2026-05-24" },
  { id: "c15", name: "Greninja ex",     set: "GA",  number: "GA 210/286",  type: "water",     rarity: "EX",        owned: 1, acquiredAt: "2026-05-02" },
  { id: "c16", name: "Lucario",         set: "STS", number: "STS 071/108", type: "fighting",  rarity: "Full Art",  owned: 1, acquiredAt: "2026-05-15" },
  { id: "c17", name: "Dialga ex",       set: "STS", number: "STS 098/108", type: "metal",     rarity: "EX",        owned: 0,                  pullOdds: "1.2%" },
  { id: "c18", name: "Palkia ex",       set: "STS", number: "STS 099/108", type: "water",     rarity: "EX",        owned: 0,                  pullOdds: "1.2%" },
  { id: "c19", name: "Gardevoir",       set: "TL",  number: "TL 053/120",  type: "fairy",     rarity: "Full Art",  owned: 1, acquiredAt: "2026-05-20" },
  { id: "c20", name: "Sylveon",         set: "TL",  number: "TL 054/120",  type: "fairy",     rarity: "Star",      owned: 0,                  pullOdds: "0.5%" },
  { id: "c21", name: "Umbreon",         set: "TL",  number: "TL 088/120",  type: "dark",      rarity: "Star",      owned: 1, acquiredAt: "2026-05-11" },
  { id: "c22", name: "Magnezone",       set: "STS", number: "STS 047/108", type: "metal",     rarity: "Rare",      owned: 3, acquiredAt: "2026-05-22" },
  { id: "c23", name: "Garchomp ex",     set: "STS", number: "STS 100/108", type: "dragon",    rarity: "EX",        owned: 0,                  pullOdds: "1.2%" },
  { id: "c24", name: "Wigglytuff",      set: "GA",  number: "GA 052/286", type: "fairy",      rarity: "Uncommon",  owned: 4, acquiredAt: "2026-05-17" },
];

export const CARDS: Card[] = RAW.map((c) => {
  const m = c.number.match(/(\d+)\/(\d+)/);
  return { ...c, numberIndex: m ? parseInt(m[1], 10) : 0 };
});

export const RARITIES: Rarity[] =
  ["Common", "Uncommon", "Rare", "EX", "Full Art", "Star", "Immersive", "Crown"];

export const TYPES: EnergyType[] =
  ["fire","water","grass","lightning","psychic","fighting","dark","metal","dragon","fairy","colorless"];

// Helpers
export function getSet(id: string): SetInfo | undefined {
  return SETS.find((s) => s.id === id);
}
export function getCardByName(name: string): Card | undefined {
  const q = name.toLowerCase();
  return CARDS.find((c) => c.name.toLowerCase() === q);
}
export function setOwnedCount(setId: string): number {
  return CARDS.filter((c) => c.set === setId && c.owned > 0).length;
}

export function getCollectionSummary() {
  const owned = CARDS.filter((c) => c.owned > 0).length;
  const missing = CARDS.length - owned;
  const duplicates = CARDS.reduce((acc, c) => acc + Math.max(0, c.owned - 1), 0);
  const completion = Math.round((owned / CARDS.length) * 100);
  const wishlistCount = CARDS.filter((c) => c.wishlist).length;
  return { owned, missing, duplicates, completion, wishlistCount, total: CARDS.length };
}
