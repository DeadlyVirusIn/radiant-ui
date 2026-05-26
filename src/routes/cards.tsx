import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search, Heart, Lock, Sparkles, Crosshair, Repeat2, Plus, Minus,
  SlidersHorizontal, LayoutGrid, Rows3, Star, Check, X, ArrowRight,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [{ title: "My Collection — Radiant" }] }),
  component: MyCollection,
});

// ─────────────────────────────────────────────────────────────────────────
// Card-art primitive (mirrors the one on Home; duplicated here so the
// Cards route stays self-contained for the page-by-page redesign pass)
type EnergyType =
  | "fire" | "water" | "grass" | "lightning" | "psychic"
  | "fighting" | "dark" | "metal" | "dragon" | "fairy" | "colorless";

const energy: Record<EnergyType, { from: string; via: string; to: string; glow: string }> = {
  fire:      { from: "from-orange-500/70", via: "via-red-600/40",    to: "to-amber-900/60",   glow: "shadow-[0_8px_40px_-12px_rgba(249,115,22,0.5)]" },
  water:     { from: "from-sky-400/70",    via: "via-blue-600/40",   to: "to-indigo-900/60",  glow: "shadow-[0_8px_40px_-12px_rgba(56,189,248,0.5)]" },
  grass:     { from: "from-emerald-400/70",via: "via-green-600/40",  to: "to-teal-900/60",    glow: "shadow-[0_8px_40px_-12px_rgba(52,211,153,0.5)]" },
  lightning: { from: "from-yellow-300/80", via: "via-amber-500/40",  to: "to-yellow-900/60",  glow: "shadow-[0_8px_40px_-12px_rgba(250,204,21,0.55)]" },
  psychic:   { from: "from-fuchsia-400/70",via: "via-purple-600/40", to: "to-indigo-900/60",  glow: "shadow-[0_8px_40px_-12px_rgba(217,70,239,0.5)]" },
  fighting:  { from: "from-orange-700/70", via: "via-amber-800/40",  to: "to-stone-900/60",   glow: "shadow-[0_8px_40px_-12px_rgba(180,83,9,0.5)]" },
  dark:      { from: "from-slate-600/70",  via: "via-zinc-800/40",   to: "to-black/70",       glow: "shadow-[0_8px_40px_-12px_rgba(15,23,42,0.7)]" },
  metal:     { from: "from-slate-300/70",  via: "via-zinc-500/40",   to: "to-slate-800/60",   glow: "shadow-[0_8px_40px_-12px_rgba(148,163,184,0.5)]" },
  dragon:    { from: "from-amber-400/70",  via: "via-indigo-600/40", to: "to-violet-900/60",  glow: "shadow-[0_8px_40px_-12px_rgba(251,191,36,0.45)]" },
  fairy:     { from: "from-pink-300/70",   via: "via-rose-500/40",   to: "to-fuchsia-900/60", glow: "shadow-[0_8px_40px_-12px_rgba(244,114,182,0.5)]" },
  colorless: { from: "from-slate-200/60",  via: "via-slate-400/30",  to: "to-slate-700/60",   glow: "shadow-[0_8px_40px_-12px_rgba(203,213,225,0.4)]" },
};

type Rarity = "Common" | "Uncommon" | "Rare" | "EX" | "Full Art" | "Star" | "Immersive" | "Crown";
const rarityRing: Record<Rarity, string> = {
  Common:    "ring-1 ring-white/10",
  Uncommon:  "ring-1 ring-white/20",
  Rare:      "ring-1 ring-sky-300/50",
  EX:        "ring-1 ring-orange-400/70",
  "Full Art":"ring-1 ring-sky-300/70",
  Star:      "ring-2 ring-amber-300/70",
  Immersive: "ring-2 ring-fuchsia-400/70",
  Crown:     "ring-2 ring-yellow-400/80",
};
const rarityChip: Record<Rarity, string> = {
  Common:    "bg-muted text-muted-foreground",
  Uncommon:  "bg-muted text-muted-foreground",
  Rare:      "bg-sky-500/15 text-sky-300",
  EX:        "bg-orange-500/15 text-orange-300",
  "Full Art":"bg-sky-500/15 text-sky-300",
  Star:      "bg-amber-400/15 text-amber-300",
  Immersive: "bg-fuchsia-500/15 text-fuchsia-300",
  Crown:     "bg-yellow-400/15 text-yellow-300",
};

function CardArt({
  name, type, rarity, number, owned, missing, size = "md",
}: {
  name: string; type: EnergyType; rarity: Rarity; number?: string;
  owned?: number; missing?: boolean; size?: "sm" | "md" | "lg";
}) {
  const e = energy[type];
  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10",
        rarityRing[rarity], e.glow,
        missing && "saturate-[.4] opacity-80",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", e.from, e.via, e.to)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.32),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.16)_50%,transparent_70%)]" />
      <div className="absolute inset-0 opacity-25 mix-blend-overlay [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_4px)]" />
      {/* Reserved art area — swap silhouette for <img src={card.imageUrl}> when API wires up */}
      <div className="absolute inset-x-0 top-1/2 mx-auto h-2/3 w-2/3 -translate-y-1/2 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-background/40" />

      {/* top chips */}
      <div className="absolute inset-x-2 top-2 flex items-start justify-between">
        <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <Star className="h-2.5 w-2.5" /> {rarity}
        </span>
        {!missing && typeof owned === "number" && owned > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-success-foreground shadow-md ring-1 ring-success-foreground/20 backdrop-blur">
            ×{owned}
          </span>
        )}
        {missing && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-warning/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground shadow-md backdrop-blur">
            <Lock className="h-2.5 w-2.5" /> Missing
          </span>
        )}
      </div>

      {/* bottom name plate */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 pt-6">
        <p className={cn(
          "truncate font-display font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
          size === "lg" ? "text-base" : "text-[13px]",
        )}>{name}</p>
        {number && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/85">{number}</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mock data — sets, rarities, cards
const SETS = [
  { id: "TL",  name: "Triumphant Light",     short: "TL",  owned: 118, total: 120 },
  { id: "MI",  name: "Mythical Island",      short: "MI",  owned: 84,  total: 86 },
  { id: "STS", name: "Space-Time Smackdown", short: "STS", owned: 92,  total: 108 },
  { id: "GA",  name: "Genetic Apex",         short: "GA",  owned: 226, total: 286 },
] as const;
type SetId = (typeof SETS)[number]["id"];

const TYPES: EnergyType[] = ["fire", "water", "grass", "lightning", "psychic", "fighting", "dark", "metal", "dragon", "fairy", "colorless"];
const RARITIES: Rarity[] = ["Common", "Uncommon", "Rare", "EX", "Full Art", "Star", "Immersive", "Crown"];

type Card = {
  id: string; name: string; set: SetId; number: string;
  type: EnergyType; rarity: Rarity; owned: number; wishlist?: boolean;
  pullOdds?: string; tradeOffers?: number; activeHunts?: number;
};

const CARDS: Card[] = [
  { id: "c01", name: "Mew ex",          set: "TL",  number: "TL 086/120", type: "psychic",   rarity: "Crown",     owned: 0, wishlist: true,  pullOdds: "0.05%", tradeOffers: 8, activeHunts: 18900 },
  { id: "c02", name: "Rayquaza Crown",  set: "TL",  number: "TL 119/120", type: "dragon",    rarity: "Crown",     owned: 0, wishlist: true,  pullOdds: "0.05%", tradeOffers: 2, activeHunts: 11400 },
  { id: "c03", name: "Gengar ex",       set: "TL",  number: "TL 067/120", type: "psychic",   rarity: "Immersive", owned: 1,                  pullOdds: "0.15%", tradeOffers: 14 },
  { id: "c04", name: "Solar Crown",     set: "TL",  number: "TL 118/120", type: "fire",      rarity: "Crown",     owned: 1,                  pullOdds: "0.05%" },
  { id: "c05", name: "Charizard ex",    set: "GA",  number: "GA 184/286", type: "fire",      rarity: "EX",        owned: 3,                  pullOdds: "1.2%" },
  { id: "c06", name: "Blastoise ex",    set: "GA",  number: "GA 200/286", type: "water",     rarity: "EX",        owned: 0, wishlist: true,  pullOdds: "1.2%", tradeOffers: 4 },
  { id: "c07", name: "Venusaur ex",     set: "GA",  number: "GA 211/286", type: "grass",     rarity: "EX",        owned: 2,                  pullOdds: "1.2%" },
  { id: "c08", name: "Pikachu ex",      set: "GA",  number: "GA 096/286", type: "lightning", rarity: "EX",        owned: 4,                  pullOdds: "1.2%" },
  { id: "c09", name: "Mewtwo ex",       set: "GA",  number: "GA 286/286", type: "psychic",   rarity: "Immersive", owned: 1,                  pullOdds: "0.15%" },
  { id: "c10", name: "Articuno ex",     set: "MI",  number: "MI 084/086", type: "water",     rarity: "EX",        owned: 0,                  pullOdds: "1.2%", tradeOffers: 6, activeHunts: 2100 },
  { id: "c11", name: "Mew",             set: "MI",  number: "MI 085/086", type: "psychic",   rarity: "Star",      owned: 0, wishlist: true,  pullOdds: "0.5%", tradeOffers: 3 },
  { id: "c12", name: "Lugia Crown",     set: "STS", number: "STS 108/108",type: "lightning", rarity: "Crown",     owned: 0,                  pullOdds: "0.05%", tradeOffers: 1, activeHunts: 12400 },
  { id: "c13", name: "Snorlax",         set: "GA",  number: "GA 145/286", type: "colorless", rarity: "Star",      owned: 2 },
  { id: "c14", name: "Eevee",           set: "GA",  number: "GA 089/286", type: "colorless", rarity: "Rare",      owned: 5 },
  { id: "c15", name: "Greninja ex",     set: "GA",  number: "GA 210/286", type: "water",     rarity: "EX",        owned: 1 },
  { id: "c16", name: "Lucario",         set: "STS", number: "STS 071/108",type: "fighting",  rarity: "Full Art",  owned: 1 },
  { id: "c17", name: "Dialga ex",       set: "STS", number: "STS 098/108",type: "metal",     rarity: "EX",        owned: 0,                  pullOdds: "1.2%", tradeOffers: 5 },
  { id: "c18", name: "Palkia ex",       set: "STS", number: "STS 099/108",type: "water",     rarity: "EX",        owned: 0,                  pullOdds: "1.2%" },
  { id: "c19", name: "Gardevoir",       set: "TL",  number: "TL 053/120", type: "fairy",     rarity: "Full Art",  owned: 1 },
  { id: "c20", name: "Sylveon",         set: "TL",  number: "TL 054/120", type: "fairy",     rarity: "Star",      owned: 0,                  pullOdds: "0.5%", tradeOffers: 2 },
  { id: "c21", name: "Umbreon",         set: "TL",  number: "TL 088/120", type: "dark",      rarity: "Star",      owned: 1 },
  { id: "c22", name: "Magnezone",       set: "STS", number: "STS 047/108",type: "metal",     rarity: "Rare",      owned: 3 },
  { id: "c23", name: "Garchomp ex",     set: "STS", number: "STS 100/108",type: "dragon",    rarity: "EX",        owned: 0,                  pullOdds: "1.2%" },
  { id: "c24", name: "Wigglytuff",      set: "GA",  number: "GA 052/286", type: "fairy",     rarity: "Uncommon",  owned: 4 },
];

const TOTAL_OWNED = CARDS.reduce((acc, c) => acc + (c.owned > 0 ? 1 : 0), 0);
const TOTAL_MISSING = CARDS.length - TOTAL_OWNED;
const TOTAL_WISHLIST = CARDS.filter((c) => c.wishlist).length;

// ─────────────────────────────────────────────────────────────────────────
type OwnFilter = "all" | "owned" | "missing" | "wishlist";

function MyCollection() {
  const [activeSet, setActiveSet] = useState<SetId | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [own, setOwn] = useState<OwnFilter>("all");
  const [rarity, setRarity] = useState<Rarity | "ALL">("ALL");
  const [type, setType] = useState<EnergyType | "ALL">("ALL");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picked, setPicked] = useState<Card | null>(null);

  const filtered = useMemo(() => {
    return CARDS.filter((c) => {
      if (activeSet !== "ALL" && c.set !== activeSet) return false;
      if (rarity !== "ALL" && c.rarity !== rarity) return false;
      if (type !== "ALL" && c.type !== type) return false;
      if (own === "owned"   && c.owned <= 0) return false;
      if (own === "missing" && c.owned > 0)  return false;
      if (own === "wishlist" && !c.wishlist) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.number.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [activeSet, rarity, type, own, search]);

  const setMeta = activeSet === "ALL"
    ? { name: "All sets", owned: SETS.reduce((a, s) => a + s.owned, 0), total: SETS.reduce((a, s) => a + s.total, 0) }
    : SETS.find((s) => s.id === activeSet)!;
  const setPct = Math.round((setMeta.owned / setMeta.total) * 100);
  const setMissing = setMeta.total - setMeta.owned;

  return (
    <div className="relative">
      <PageHeader
        title="My Collection"
        description="Your card binder — owned, missing, wishlisted, and where to find them."
      />

      {/* ── Sticky binder header ──────────────────────────────────────── */}
      <div className="sticky top-12 z-20 -mx-4 mb-4 border-y border-border bg-background/85 px-4 backdrop-blur md:-mx-6 md:px-6">
        {/* set chips */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto pt-3 pb-2">
          {(["ALL", ...SETS.map((s) => s.id)] as const).map((id) => {
            const s = id === "ALL" ? null : SETS.find((x) => x.id === id)!;
            const active = activeSet === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSet(id as SetId | "ALL")}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {s ? s.short : "All"}
                <span className="ml-1.5 text-[10px] opacity-70">
                  {s ? `${Math.round((s.owned / s.total) * 100)}%` : `${TOTAL_OWNED}/${CARDS.length}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* completion bar + counters */}
        <div className="grid grid-cols-1 gap-3 pb-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-base font-bold leading-none">{setMeta.name}</span>
                <span className="text-mono text-xs text-muted-foreground">
                  {setMeta.owned}/{setMeta.total}
                </span>
              </div>
              <span className="text-mono text-sm font-bold text-primary">{setPct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60 transition-all"
                style={{ width: `${setPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <CountChip label="Owned"    value={own === "all" ? TOTAL_OWNED   : filtered.filter((c) => c.owned > 0).length} tone="success" active={own === "owned"}    onClick={() => setOwn(own === "owned"    ? "all" : "owned")} icon={<Check className="h-3 w-3" />} />
            <CountChip label="Missing"  value={own === "all" ? TOTAL_MISSING : filtered.filter((c) => c.owned <= 0).length} tone="warning" active={own === "missing"}  onClick={() => setOwn(own === "missing"  ? "all" : "missing")} icon={<Lock className="h-3 w-3" />} />
            <CountChip label="Wishlist" value={TOTAL_WISHLIST} tone="primary" active={own === "wishlist"} onClick={() => setOwn(own === "wishlist" ? "all" : "wishlist")} icon={<Heart className="h-3 w-3" />} />
          </div>
        </div>

        {/* search + view + filters */}
        <div className="flex items-center gap-2 pb-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cards or number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-background/40 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {(rarity !== "ALL" || type !== "ALL") && (
              <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {(rarity !== "ALL" ? 1 : 0) + (type !== "ALL" ? 1 : 0)}
              </span>
            )}
          </Button>
          <div className="hidden rounded-md border border-border bg-card/40 p-0.5 md:flex">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("grid")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("list")}><Rows3 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      {/* ── Binder grid / list ───────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyBinder onClear={() => { setSearch(""); setOwn("all"); setRarity("ALL"); setType("ALL"); }} />
      ) : view === "grid" ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setPicked(c)}
              className="group relative text-left transition-all hover:-translate-y-1"
            >
              <CardArt
                name={c.name}
                type={c.type}
                rarity={c.rarity}
                number={c.number}
                owned={c.owned}
                missing={c.owned <= 0}
              />
              {c.wishlist && (
                <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-rose-500/90 text-white shadow-lg ring-2 ring-background">
                  <Heart className="h-3 w-3 fill-current" />
                </span>
              )}
            </button>
          ))}
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-card/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2.5">Card</th>
                <th className="px-4 py-2.5">Set</th>
                <th className="px-4 py-2.5">Rarity</th>
                <th className="px-4 py-2.5 text-right">Owned</th>
                <th className="px-4 py-2.5 text-right">Get it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setPicked(c)} className="cursor-pointer hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-8 shrink-0">
                        <CardArt name={c.name} type={c.type} rarity={c.rarity} owned={c.owned} missing={c.owned <= 0} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{c.name}</div>
                        <div className="text-mono text-[11px] text-muted-foreground">{c.number}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{SETS.find((s) => s.id === c.set)!.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", rarityChip[c.rarity])}>
                      {c.rarity}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.owned > 0
                      ? <span className="text-mono text-success">×{c.owned}</span>
                      : <span className="text-mono text-warning">missing</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground">
                    {c.tradeOffers ? `${c.tradeOffers} trades` : c.activeHunts ? `${(c.activeHunts/1000).toFixed(1)}k hunting` : c.pullOdds ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* counter under the grid */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Showing <span className="text-mono text-foreground">{filtered.length}</span> of {CARDS.length} cards
        {setMissing > 0 && <> · <span className="text-warning">{setMissing} missing in {setMeta.name}</span></>}
      </p>

      {/* ── Filter sheet ─────────────────────────────────────────────── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[300px] bg-background p-0 sm:w-[340px]">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-display text-base font-bold">Filter binder</h3>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setRarity("ALL"); setType("ALL"); }}>
              Reset
            </Button>
          </div>

          <div className="space-y-5 p-4">
            <FilterGroup label="Rarity">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={rarity === "ALL"} onClick={() => setRarity("ALL")}>All</FilterChip>
                {RARITIES.map((r) => (
                  <FilterChip key={r} active={rarity === r} onClick={() => setRarity(r)} className={rarityChip[r]}>
                    {r}
                  </FilterChip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label="Energy">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={type === "ALL"} onClick={() => setType("ALL")}>All</FilterChip>
                {TYPES.map((t) => (
                  <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                    <span className="capitalize">{t}</span>
                  </FilterChip>
                ))}
              </div>
            </FilterGroup>

            <FilterGroup label="View">
              <div className="flex gap-1.5">
                <FilterChip active={view === "grid"} onClick={() => setView("grid")}>
                  <LayoutGrid className="mr-1 h-3 w-3 inline" /> Grid
                </FilterChip>
                <FilterChip active={view === "list"} onClick={() => setView("list")}>
                  <Rows3 className="mr-1 h-3 w-3 inline" /> List
                </FilterChip>
              </div>
            </FilterGroup>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Card detail drawer ──────────────────────────────────────── */}
      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-[440px]">
          {picked && <CardDetail card={picked} onClose={() => setPicked(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CountChip({
  label, value, tone, active, onClick, icon,
}: {
  label: string; value: number;
  tone: "success" | "warning" | "primary";
  active: boolean; onClick: () => void; icon: React.ReactNode;
}) {
  const toneCls =
    tone === "success" ? "border-success/30 text-success bg-success/10"
    : tone === "warning" ? "border-warning/30 text-warning bg-warning/10"
    : "border-primary/30 text-primary bg-primary/10";
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
        active ? toneCls + " shadow-[inset_0_0_0_1px_currentColor]" : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="text-mono">{value}</span>
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
function FilterChip({
  children, active, onClick, className,
}: { children: React.ReactNode; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
        !active && className,
      )}
    >
      {children}
    </button>
  );
}

function EmptyBinder({ onClear }: { onClear: () => void }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 font-display text-sm font-bold">No cards match those filters</p>
      <p className="mt-1 text-xs text-muted-foreground">Try clearing filters or switching set.</p>
      <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onClear}>Clear filters</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  const set = SETS.find((s) => s.id === card.set)!;
  const isOwned = card.owned > 0;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", rarityChip[card.rarity])}>
            {card.rarity}
          </Badge>
          <span className="text-mono text-[11px] text-muted-foreground">{card.number}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Hero art */}
      <div className="px-6 pt-5">
        <div className="mx-auto w-[220px]">
          <CardArt
            name={card.name}
            type={card.type}
            rarity={card.rarity}
            number={card.number}
            owned={card.owned}
            missing={!isOwned}
            size="lg"
          />
        </div>
      </div>

      {/* Headline + ownership answer */}
      <div className="px-5 pt-4">
        <h2 className="font-display text-xl font-bold tracking-tight">{card.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{set.name} · <span className="capitalize">{card.type}</span></p>

        <div
          className={cn(
            "mt-4 rounded-lg border p-3",
            isOwned
              ? "border-success/30 bg-success/10"
              : "border-warning/30 bg-warning/10",
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", isOwned ? "text-success" : "text-warning")}>
                {isOwned ? "Owned" : "Missing"}
              </div>
              <div className="mt-0.5 font-display text-base font-bold">
                {isOwned ? `${card.owned} ${card.owned === 1 ? "copy" : "copies"} in your binder` : "Not in your binder yet"}
              </div>
            </div>
            {isOwned ? (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center text-mono text-sm font-bold">{card.owned}</span>
                <Button variant="outline" size="icon" className="h-7 w-7"><Plus className="h-3 w-3" /></Button>
              </div>
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-warning/20">
                <Lock className="h-4 w-4 text-warning" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Meta facts */}
      <div className="mt-4 grid grid-cols-3 gap-2 px-5">
        <FactCell label="Set"    value={set.short} />
        <FactCell label="Number" value={card.number.split(" ")[1]} />
        <FactCell label="Rarity" value={card.rarity} />
      </div>

      {/* How can I get it */}
      <div className="mt-5 px-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          How can I get it
        </div>
        <div className="space-y-1.5">
          <SourceRow
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={`Pull from ${set.name}`}
            value={card.pullOdds ? `${card.pullOdds} per pack` : "Not currently in pool"}
            tone="primary"
          />
          <SourceRow
            icon={<Repeat2 className="h-3.5 w-3.5" />}
            label="Trade with a friend"
            value={card.tradeOffers ? `${card.tradeOffers} open offers` : "No offers yet"}
            tone={card.tradeOffers ? "success" : "muted"}
          />
          <SourceRow
            icon={<Crosshair className="h-3.5 w-3.5" />}
            label="Community hunt"
            value={card.activeHunts ? `${card.activeHunts.toLocaleString()} hunting now` : "No active hunt"}
            tone={card.activeHunts ? "warning" : "muted"}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 mt-5 grid grid-cols-1 gap-2 border-t border-border bg-background/95 p-4 backdrop-blur sm:grid-cols-3">
        <Button variant={card.wishlist ? "secondary" : "outline"} size="sm" className="h-9 gap-1.5">
          <Heart className={cn("h-3.5 w-3.5", card.wishlist && "fill-current text-rose-400")} />
          {card.wishlist ? "Wishlisted" : "Wishlist"}
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={!card.tradeOffers}>
          <Repeat2 className="h-3.5 w-3.5" /> Find Trade
        </Button>
        <Button size="sm" className="h-9 gap-1.5">
          <Crosshair className="h-3.5 w-3.5" /> Hunt This Card
          <ArrowRight className="ml-auto h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function FactCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function SourceRow({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "warning" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-success bg-success/10 border-success/20"
    : tone === "warning" ? "text-warning bg-warning/10 border-warning/20"
    : tone === "primary" ? "text-primary bg-primary/10 border-primary/20"
    : "text-muted-foreground bg-muted/40 border-border";
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-6 w-6 place-items-center rounded-md border", toneCls)}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-mono text-[11px] text-muted-foreground">{value}</span>
    </div>
  );
}
