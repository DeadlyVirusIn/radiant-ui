import { CARDS, SETS, getSet, type Card } from "@/lib/mock-cards";

export type Pack = {
  id: string;
  name: string;
  expansion: string;          // matches SETS[].id
  cost: string;
  odds: string;
  featuredCardIds: string[];  // 3 thumbnails for the tile
  pullResultIds: string[];    // deterministic 5-card pull
};

// Deterministic mock packs (one per known expansion + a special boosted pack).
export const PACKS: Pack[] = [
  {
    id: "ga-charizard",
    name: "Genetic Apex · Charizard",
    expansion: "GA",
    cost: "12 hourglasses",
    odds: "Standard",
    featuredCardIds: ["c05", "c08", "c09"],
    pullResultIds: ["c14", "c08", "c13", "c05", "c09"],
  },
  {
    id: "ga-mewtwo",
    name: "Genetic Apex · Mewtwo",
    expansion: "GA",
    cost: "12 hourglasses",
    odds: "Standard",
    featuredCardIds: ["c09", "c06", "c07"],
    pullResultIds: ["c24", "c06", "c14", "c07", "c09"],
  },
  {
    id: "mi-mew",
    name: "Mythical Island",
    expansion: "MI",
    cost: "12 hourglasses",
    odds: "Standard",
    featuredCardIds: ["c11", "c10", "c11"],
    pullResultIds: ["c10", "c11", "c10", "c14", "c11"],
  },
  {
    id: "sts-dialga",
    name: "Space-Time · Dialga",
    expansion: "STS",
    cost: "12 hourglasses",
    odds: "Standard",
    featuredCardIds: ["c17", "c22", "c12"],
    pullResultIds: ["c22", "c17", "c16", "c12", "c22"],
  },
  {
    id: "sts-palkia",
    name: "Space-Time · Palkia",
    expansion: "STS",
    cost: "12 hourglasses",
    odds: "Standard",
    featuredCardIds: ["c18", "c23", "c16"],
    pullResultIds: ["c22", "c18", "c16", "c23", "c12"],
  },
  {
    id: "tl-solar",
    name: "Triumphant Light",
    expansion: "TL",
    cost: "12 hourglasses",
    odds: "Standard",
    featuredCardIds: ["c01", "c03", "c02"],
    pullResultIds: ["c19", "c20", "c03", "c01", "c02"],
  },
  {
    id: "premier-bundle",
    name: "Premier Bundle",
    expansion: "GA",
    cost: "3 premier tickets",
    odds: "Boosted",
    featuredCardIds: ["c05", "c09", "c08"],
    pullResultIds: ["c08", "c05", "c09", "c13", "c14"],
  },
];

export function getCardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}

export type PackScore = {
  pack: Pack;
  setName: string;
  setShort: string;
  missingInSet: number;
  missingInPack: number;
  wishlistInPack: number;
  completionGain: number;   // pp gained if every featured missing was acquired
  setCompletion: number;    // current %
  score: number;
  reasons: string[];
};

export function scorePackForCollector(pack: Pack): PackScore {
  const set = getSet(pack.expansion);
  const setCards = CARDS.filter((c) => c.set === pack.expansion);
  const owned = setCards.filter((c) => c.owned > 0).length;
  const total = set?.total ?? setCards.length;
  const setCompletion = total > 0 ? Math.round((owned / total) * 100) : 0;
  const missingInSet = (set?.total ?? setCards.length) - owned;

  const featured = pack.featuredCardIds.map(getCardById).filter(Boolean) as Card[];
  const missingInPack = featured.filter((c) => c.owned === 0).length;
  const wishlistInPack = featured.filter((c) => c.wishlist).length;

  // Completion gain estimate: each missing featured ≈ 1 card / set total
  const completionGain = total > 0 ? Math.round((missingInPack / total) * 100) : 0;

  // Score weights collector value heavily.
  const boostedBonus = pack.odds === "Boosted" ? 8 : 0;
  const score =
    missingInPack * 18 +
    wishlistInPack * 22 +
    completionGain * 3 +
    boostedBonus;

  const reasons: string[] = [];
  if (missingInPack > 0) reasons.push(`${missingInPack} featured card${missingInPack > 1 ? "s" : ""} missing`);
  if (wishlistInPack > 0) reasons.push(`${wishlistInPack} wishlist card${wishlistInPack > 1 ? "s" : ""} inside`);
  if (completionGain > 0) reasons.push(`+${completionGain}% completion potential`);
  if (missingInSet > 0) reasons.push(`helps ${set?.name ?? pack.expansion} collection goal`);
  if (pack.odds === "Boosted") reasons.push("Boosted pull odds");
  if (reasons.length === 0) reasons.push("All featured cards already owned — keep for duplicates");

  return {
    pack,
    setName: set?.name ?? pack.expansion,
    setShort: set?.short ?? pack.expansion,
    missingInSet,
    missingInPack,
    wishlistInPack,
    completionGain,
    setCompletion,
    score,
    reasons,
  };
}

export function rankedPacks(preferExpansion?: string): PackScore[] {
  const scored = PACKS.map(scorePackForCollector);
  scored.sort((a, b) => {
    if (preferExpansion) {
      const ax = a.pack.expansion === preferExpansion ? 1 : 0;
      const bx = b.pack.expansion === preferExpansion ? 1 : 0;
      if (ax !== bx) return bx - ax;
    }
    return b.score - a.score;
  });
  return scored;
}

// Expansion grouping (mirrors reference packUtils, newest-series first).
function parseExp(exp: string) {
  const m = exp.match(/^([A-Z])(\d*)([a-z]?)$/i);
  if (!m) return { series: "Z", major: 0, sub: "" };
  return { series: m[1].toUpperCase(), major: parseInt(m[2] || "0", 10), sub: m[3] || "" };
}
function cmpExp(a: string, b: string) {
  const pa = parseExp(a), pb = parseExp(b);
  if (pa.series !== pb.series) return pb.series.localeCompare(pa.series);
  if (pa.major !== pb.major) return pb.major - pa.major;
  return pb.sub.localeCompare(pa.sub);
}
export function groupPacksByExpansion(packs: Pack[]) {
  const groups: Record<string, Pack[]> = {};
  for (const p of packs) {
    (groups[p.expansion] ||= []).push(p);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => cmpExp(a, b))
    .map(([expansion, items]) => ({
      expansion,
      setName: getSet(expansion)?.name ?? expansion,
      packs: items,
    }));
}

export type RecentPull = {
  id: string;
  packId: string;
  packName: string;
  when: string;     // human label
  cardIds: string[];
  newToCollection: number;
  wishlistHits: number;
};

export const RECENT_PULLS: RecentPull[] = [
  {
    id: "rp-1",
    packId: "ga-charizard",
    packName: "Genetic Apex · Charizard",
    when: "2h ago",
    cardIds: ["c14", "c08", "c13", "c22", "c05"],
    newToCollection: 0,
    wishlistHits: 0,
  },
  {
    id: "rp-2",
    packId: "tl-solar",
    packName: "Triumphant Light",
    when: "Yesterday",
    cardIds: ["c19", "c20", "c21", "c03", "c04"],
    newToCollection: 1,
    wishlistHits: 0,
  },
  {
    id: "rp-3",
    packId: "mi-mew",
    packName: "Mythical Island",
    when: "2d ago",
    cardIds: ["c10", "c11", "c14", "c24", "c11"],
    newToCollection: 2,
    wishlistHits: 1,
  },
  {
    id: "rp-4",
    packId: "sts-dialga",
    packName: "Space-Time · Dialga",
    when: "3d ago",
    cardIds: ["c22", "c16", "c17", "c12", "c14"],
    newToCollection: 2,
    wishlistHits: 0,
  },
  {
    id: "rp-5",
    packId: "ga-mewtwo",
    packName: "Genetic Apex · Mewtwo",
    when: "4d ago",
    cardIds: ["c24", "c06", "c14", "c07", "c09"],
    newToCollection: 0,
    wishlistHits: 1,
  },
];

export function getQuickStats() {
  const opened = RECENT_PULLS.length;
  const uniqueAdded = RECENT_PULLS.reduce((a, r) => a + r.newToCollection, 0);
  const wishlistHits = RECENT_PULLS.reduce((a, r) => a + r.wishlistHits, 0);
  return {
    available: PACKS.length,
    openedThisWeek: opened,
    uniqueAdded,
    wishlistHits,
  };
}

// Computes collection / wishlist impact for a deterministic pull result.
export function pullImpact(cardIds: string[]) {
  const cards = cardIds.map(getCardById).filter(Boolean) as Card[];
  const newToCollection = cards.filter((c) => c.owned === 0).length;
  const wishlistHits = cards.filter((c) => c.wishlist).length;
  const duplicates = cards.length - newToCollection;
  return { newToCollection, wishlistHits, duplicates };
}
