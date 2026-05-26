// Mock data + helpers for /wonder-pick — pick-one-of-five from friends' packs.
import type { RewardKind } from "@/lib/mock-rewards";

export type WonderState = "available" | "picked" | "expired";

export type WonderPick = {
  id: string;
  /** Friend whose pack this came from. */
  from: string;
  /** Pack name / set. */
  packName: string;
  /** Best-known card in the pack (drives "worth picking" hint). */
  topCard: string;
  topRarity: "common" | "rare" | "legendary";
  /** Wishlist cards present among the 5. */
  wishlistMatches: number;
  /** Hours until this pick expires. */
  expiresInHours: number;
  /** Ticket cost. */
  ticketCost: number;
  state: WonderState;
  /** Result, only when state === "picked". */
  pickedCard?: { name: string; kind: RewardKind; label: string };
};

export const WONDER_PICKS: WonderPick[] = [
  { id: "w-1", from: "Nelle",  packName: "Mewtwo Week pack",    topCard: "Solar Crown",     topRarity: "legendary", wishlistMatches: 2, expiresInHours: 6,  ticketCost: 1, state: "available" },
  { id: "w-2", from: "Jules",  packName: "Aurora set",          topCard: "Halcyon Mark",    topRarity: "legendary", wishlistMatches: 1, expiresInHours: 18, ticketCost: 1, state: "available" },
  { id: "w-3", from: "Arden",  packName: "Vanta set",           topCard: "Cinder Hare",     topRarity: "rare",      wishlistMatches: 1, expiresInHours: 30, ticketCost: 1, state: "available" },
  { id: "w-4", from: "Kiera",  packName: "Verdant set",         topCard: "Tidal Drake",     topRarity: "rare",      wishlistMatches: 0, expiresInHours: 44, ticketCost: 1, state: "available" },
  { id: "w-5", from: "Soren",  packName: "Onyx set",            topCard: "Shale Wisp",      topRarity: "common",    wishlistMatches: 0, expiresInHours: 70, ticketCost: 1, state: "available" },
  { id: "w-6", from: "Mira",   packName: "Halcyon set",         topCard: "Aureate Sigil",   topRarity: "rare",      wishlistMatches: 1, expiresInHours: 90, ticketCost: 1, state: "available" },

  // History
  { id: "w-h1", from: "Bree",  packName: "Mewtwo Week pack",    topCard: "—", topRarity: "rare",  wishlistMatches: 0, expiresInHours: 0, ticketCost: 1, state: "picked",  pickedCard: { name: "Halcyon Mark", kind: "card", label: "Legendary card" } },
  { id: "w-h2", from: "Vex",   packName: "Aurora set",          topCard: "—", topRarity: "common",wishlistMatches: 0, expiresInHours: 0, ticketCost: 1, state: "picked",  pickedCard: { name: "Shale Wisp",   kind: "card", label: "Common card" } },
  { id: "w-h3", from: "Onyx",  packName: "Verdant set",         topCard: "—", topRarity: "rare",  wishlistMatches: 0, expiresInHours: 0, ticketCost: 1, state: "expired" },
];

export const RARITY_META: Record<WonderPick["topRarity"], { label: string; textClass: string; dotClass: string }> = {
  common:    { label: "Common",    textClass: "text-muted-foreground", dotClass: "bg-muted-foreground/40" },
  rare:      { label: "Rare",      textClass: "text-primary",          dotClass: "bg-primary" },
  legendary: { label: "Legendary", textClass: "text-warning",          dotClass: "bg-warning" },
};

export function formatPickExpiry(hours: number): string {
  if (hours <= 0) return "Expired";
  if (hours < 24) return `Expires in ${hours}h`;
  const d = Math.round(hours / 24);
  return `${d}d left`;
}

export type WonderSummary = {
  tickets: number;
  available: number;
  wishlistOpportunities: number;
  pickedLifetime: number;
};

export function getWonderSummary(items: WonderPick[] = WONDER_PICKS): WonderSummary {
  const av = items.filter((p) => p.state === "available");
  return {
    tickets: 3,
    available: av.length,
    wishlistOpportunities: av.reduce((n, p) => n + p.wishlistMatches, 0),
    pickedLifetime: 68,
  };
}

/** Best pick to act on: wishlist matches → rarity → soonest expiry. */
export function recommendedPick(items: WonderPick[] = WONDER_PICKS): WonderPick | null {
  const rarityScore = { legendary: 3, rare: 2, common: 1 } as const;
  const candidates = items
    .filter((p) => p.state === "available")
    .sort((a, b) => {
      if (b.wishlistMatches !== a.wishlistMatches) return b.wishlistMatches - a.wishlistMatches;
      const ra = rarityScore[a.topRarity];
      const rb = rarityScore[b.topRarity];
      if (rb !== ra) return rb - ra;
      return a.expiresInHours - b.expiresInHours;
    });
  return candidates[0] ?? null;
}
