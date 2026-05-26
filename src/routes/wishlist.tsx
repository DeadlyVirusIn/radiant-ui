import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Heart, Plus, X, Repeat2, Crosshair, Sparkles, Package, Lock, Minus,
  ArrowRight, Star, Search, Flame,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Radiant" }] }),
  component: Wishlist,
});

// ─── Card-art primitive (mirrors Cards page — self-contained) ───────────
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
      <div className="absolute inset-x-0 top-1/2 mx-auto h-2/3 w-2/3 -translate-y-1/2 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-background/40" />

      <div className="absolute inset-x-2 top-2 flex items-start justify-between">
        <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <Star className="h-2.5 w-2.5" /> {rarity}
        </span>
        {!missing && typeof owned === "number" && owned > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-success-foreground shadow-md ring-1 ring-success-foreground/20">
            ×{owned}
          </span>
        )}
        {missing && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-warning/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground shadow-md">
            <Lock className="h-2.5 w-2.5" /> Missing
          </span>
        )}
      </div>

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

// ─── Mock data ──────────────────────────────────────────────────────────
const SETS = [
  { id: "TL",  name: "Triumphant Light",     short: "TL" },
  { id: "MI",  name: "Mythical Island",      short: "MI" },
  { id: "STS", name: "Space-Time Smackdown", short: "STS" },
  { id: "GA",  name: "Genetic Apex",         short: "GA" },
] as const;
type SetId = (typeof SETS)[number]["id"];

type Acquisition = "trade" | "hunt" | "pack";
type Priority = "high" | "medium" | "low";

type WishCard = {
  id: string; name: string; set: SetId; number: string;
  type: EnergyType; rarity: Rarity; owned: number;
  priority: Priority;
  acquisition: Acquisition;
  tradeOffers?: number;
  activeHunts?: number;
  pullOdds?: string;
  // collection context — purely display
  completes?: string;           // "Completes Mythical Island"
  remaining?: string;           // "1 of 2 remaining"
  setCompletion?: boolean;      // "Needed for Set Completion"
  note?: string;
};

const WISH: WishCard[] = [
  { id: "w01", name: "Mew ex",          set: "TL",  number: "TL 086/120", type: "psychic",  rarity: "Crown",     owned: 0, priority: "high",   acquisition: "trade", tradeOffers: 8, completes: "Completes Triumphant Light", remaining: "1 of 2 remaining", setCompletion: true, note: "Holding 200 trade tokens for this." },
  { id: "w02", name: "Rayquaza Crown",  set: "TL",  number: "TL 119/120", type: "dragon",   rarity: "Crown",     owned: 0, priority: "high",   acquisition: "hunt",  activeHunts: 11400, setCompletion: true, remaining: "2 of 2 remaining" },
  { id: "w03", name: "Articuno ex",     set: "MI",  number: "MI 084/086", type: "water",    rarity: "EX",        owned: 0, priority: "high",   acquisition: "trade", tradeOffers: 6, completes: "Completes Mythical Island", remaining: "1 of 2 remaining", setCompletion: true },
  { id: "w04", name: "Mew",             set: "MI",  number: "MI 085/086", type: "psychic",  rarity: "Star",      owned: 0, priority: "high",   acquisition: "trade", tradeOffers: 3, completes: "Completes Mythical Island", remaining: "2 of 2 remaining", setCompletion: true },
  { id: "w05", name: "Lugia Crown",     set: "STS", number: "STS 108/108",type: "lightning",rarity: "Crown",     owned: 0, priority: "medium", acquisition: "hunt",  activeHunts: 12400 },
  { id: "w06", name: "Blastoise ex",    set: "GA",  number: "GA 200/286", type: "water",    rarity: "EX",        owned: 0, priority: "medium", acquisition: "trade", tradeOffers: 4 },
  { id: "w07", name: "Sylveon",         set: "TL",  number: "TL 054/120", type: "fairy",    rarity: "Star",      owned: 0, priority: "medium", acquisition: "trade", tradeOffers: 2 },
  { id: "w08", name: "Dialga ex",       set: "STS", number: "STS 098/108",type: "metal",    rarity: "EX",        owned: 0, priority: "medium", acquisition: "trade", tradeOffers: 5 },
  { id: "w09", name: "Palkia ex",       set: "STS", number: "STS 099/108",type: "water",    rarity: "EX",        owned: 0, priority: "low",    acquisition: "pack",  pullOdds: "1.2%" },
  { id: "w10", name: "Garchomp ex",     set: "STS", number: "STS 100/108",type: "dragon",   rarity: "EX",        owned: 0, priority: "low",    acquisition: "pack",  pullOdds: "1.2%" },
  { id: "w11", name: "Pale Charter",    set: "TL",  number: "TL 092/120", type: "dark",     rarity: "Full Art",  owned: 0, priority: "low",    acquisition: "pack",  pullOdds: "0.8%" },
  { id: "w12", name: "Aureate Sigil",   set: "TL",  number: "TL 077/120", type: "fairy",    rarity: "Star",      owned: 0, priority: "low",    acquisition: "pack",  pullOdds: "0.5%" },
  { id: "w13", name: "Embered Vow",     set: "GA",  number: "GA 233/286", type: "fire",     rarity: "Full Art",  owned: 0, priority: "low",    acquisition: "pack",  pullOdds: "0.8%" },
  { id: "w14", name: "Halcyon Mark",    set: "GA",  number: "GA 240/286", type: "grass",    rarity: "Full Art",  owned: 0, priority: "low",    acquisition: "pack",  pullOdds: "0.8%" },
];

const ACQ_META: Record<Acquisition, { label: string; cls: string; icon: typeof Repeat2 }> = {
  trade: { label: "Trade Available", cls: "bg-success/15 text-success border-success/30",  icon: Repeat2 },
  hunt:  { label: "Active Hunt",     cls: "bg-warning/15 text-warning border-warning/30",  icon: Crosshair },
  pack:  { label: "Pack Only",       cls: "bg-primary/15 text-primary border-primary/30",  icon: Package },
};

const PRIO_META: Record<Priority, { label: string; dot: string; ring: string }> = {
  high:   { label: "High",   dot: "bg-rose-400",    ring: "ring-rose-400/50" },
  medium: { label: "Medium", dot: "bg-amber-400",   ring: "ring-amber-400/50" },
  low:    { label: "Low",    dot: "bg-slate-400",   ring: "ring-slate-400/40" },
};

// ─── Page ──────────────────────────────────────────────────────────────
type SortKey = "priority" | "set" | "newest" | "availability";

function Wishlist() {
  const [activeSet, setActiveSet] = useState<SetId | "ALL">("ALL");
  const [acq, setAcq] = useState<Acquisition | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("priority");
  const [picked, setPicked] = useState<WishCard | null>(null);
  const [search, setSearch] = useState("");

  const counts = useMemo(() => ({
    total: WISH.length,
    trade: WISH.filter((c) => c.acquisition === "trade").length,
    hunt:  WISH.filter((c) => c.acquisition === "hunt").length,
    pack:  WISH.filter((c) => c.acquisition === "pack").length,
  }), []);

  const opportunities = useMemo(() => {
    const trades = WISH.filter((c) => c.acquisition === "trade").slice(0, 4);
    const hunts  = WISH.filter((c) => c.acquisition === "hunt").slice(0, 2);
    const pack   = WISH.filter((c) => c.acquisition === "pack").slice(0, 2);
    return [...trades, ...hunts, ...pack];
  }, []);

  const filtered = useMemo(() => {
    const prioRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    const acqRank:  Record<Acquisition, number> = { trade: 0, hunt: 1, pack: 2 };
    let arr = WISH.filter((c) => {
      if (activeSet !== "ALL" && c.set !== activeSet) return false;
      if (acq !== "ALL" && c.acquisition !== acq) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.number.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sort === "priority") arr = [...arr].sort((a, b) => prioRank[a.priority] - prioRank[b.priority]);
    if (sort === "set")      arr = [...arr].sort((a, b) => a.set.localeCompare(b.set));
    if (sort === "availability") arr = [...arr].sort((a, b) => acqRank[a.acquisition] - acqRank[b.acquisition]);
    return arr;
  }, [activeSet, acq, sort, search]);

  return (
    <div className="relative">
      <PageHeader
        title="Wishlist"
        description="Tag the cards you actually want. Radiant uses this list to prioritize trades, hunts, and pack guidance."
      />

      {/* ── Hero counters ─────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-5">
        <HeroStat label="On Wishlist"     value={counts.total} icon={Heart}     tone="primary" />
        <HeroStat label="Trade Available" value={counts.trade} icon={Repeat2}   tone="success" />
        <HeroStat label="Active Hunts"    value={counts.hunt}  icon={Crosshair} tone="warning" />
        <HeroStat label="Pack Only"       value={counts.pack}  icon={Package}   tone="muted" />
        <button className="group flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary transition-all hover:border-primary/70 hover:bg-primary/10">
          <Plus className="h-4 w-4" /> Add Card
        </button>
      </div>

      {/* ── Best Opportunities ────────────────────────────────────── */}
      <section className="mb-6 rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-warning" />
              <h2 className="font-display text-base font-bold tracking-tight">Best Opportunities</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Open trades, active hunts, and featured pack runs for cards on your list.
            </p>
          </div>
          <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:block">
            {opportunities.length} cards
          </span>
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {opportunities.map((c) => {
            const meta = ACQ_META[c.acquisition];
            const Icon = meta.icon;
            return (
              <button
                key={"op-" + c.id}
                onClick={() => setPicked(c)}
                className="group w-[140px] shrink-0 text-left"
              >
                <CardArt name={c.name} type={c.type} rarity={c.rarity} number={c.number} missing />
                <div className="mt-1.5 flex items-center gap-1">
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", meta.cls)}>
                    <Icon className="h-2.5 w-2.5" /> {meta.label}
                  </span>
                </div>
                <div className="mt-1 text-[11px] font-semibold text-foreground/90">
                  {c.acquisition === "trade" && c.tradeOffers && <>{c.tradeOffers} open offers</>}
                  {c.acquisition === "hunt"  && c.activeHunts  && <>{(c.activeHunts/1000).toFixed(1)}k hunting</>}
                  {c.acquisition === "pack"  && c.pullOdds     && <>{c.pullOdds} / pack</>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Filters bar ───────────────────────────────────────────── */}
      <div className="sticky top-12 z-20 -mx-4 mb-6 mt-2 border-y border-border bg-background/85 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">

        <div className="flex flex-wrap items-center gap-2">
          {/* Set chips */}
          <div className="flex gap-1.5 overflow-x-auto">
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
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s ? s.short : "All sets"}
                </button>
              );
            })}
          </div>

          <span className="hidden h-5 w-px bg-border md:block" />

          {/* Availability chips */}
          <div className="flex gap-1.5">
            <AvailChip active={acq === "ALL"}   onClick={() => setAcq("ALL")}>All</AvailChip>
            <AvailChip active={acq === "trade"} onClick={() => setAcq("trade")} className="text-success">Trade</AvailChip>
            <AvailChip active={acq === "hunt"}  onClick={() => setAcq("hunt")}  className="text-warning">Hunt</AvailChip>
            <AvailChip active={acq === "pack"}  onClick={() => setAcq("pack")}  className="text-primary">Pack</AvailChip>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative w-40">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 bg-background/40 pl-7 text-xs" />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-md border border-border bg-background/40 px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="priority">Sort: Priority</option>
              <option value="availability">Sort: Availability</option>
              <option value="set">Sort: Set</option>
              <option value="newest">Sort: Recently added</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Grid header: legend + count ───────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span>Priority:</span>
          <LegendDot color="bg-rose-400"  label="High" />
          <LegendDot color="bg-amber-400" label="Medium" />
          <LegendDot color="bg-slate-400" label="Low" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {filtered.length} cards
        </span>
      </div>

      {/* ── Wishlist grid ─────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyWishlist />
      ) : (
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {filtered.map((c) => {
            const meta = ACQ_META[c.acquisition];
            const prio = PRIO_META[c.priority];
            const Icon = meta.icon;
            return (
              <button key={c.id} onClick={() => setPicked(c)} className="group relative text-left transition-all hover:-translate-y-0.5">
                <CardArt name={c.name} type={c.type} rarity={c.rarity} number={c.number} missing />
                {/* priority indicator */}
                <span
                  className={cn(
                    "absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-background ring-2 shadow-md",
                    prio.ring,
                  )}
                  title={`${prio.label} priority`}
                >
                  <span className={cn("h-2 w-2 rounded-full", prio.dot)} />
                </span>

                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none", meta.cls)}>
                    <Icon className="h-2.5 w-2.5" /> {meta.label}
                  </span>
                </div>
                {(c.completes || c.setCompletion || c.remaining) && (
                  <div className="mt-1 rounded-md border border-primary/20 bg-primary/5 px-1.5 py-1 text-[10px] leading-tight text-primary">
                    {c.completes || (c.setCompletion ? "Needed for Set Completion" : c.remaining)}
                  </div>
                )}
              </button>
            );
          })}
        </section>
      )}


      <p className="mt-5 text-center text-xs text-muted-foreground">
        Showing <span className="text-mono text-foreground">{filtered.length}</span> of {WISH.length} wishlisted cards
      </p>




      {/* ── Card detail drawer ───────────────────────────────────── */}
      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-[440px]">
          {picked && <CardDetail card={picked} onClose={() => setPicked(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────
function HeroStat({
  label, value, icon: Icon, tone,
}: {
  label: string; value: number;
  icon: typeof Heart;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const toneCls =
    tone === "success" ? "text-success bg-success/10 border-success/25"
    : tone === "warning" ? "text-warning bg-warning/10 border-warning/25"
    : tone === "primary" ? "text-primary bg-primary/10 border-primary/25"
    : "text-muted-foreground bg-muted/40 border-border";
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 place-items-center rounded-md border", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold leading-none">{value}</div>
    </div>
  );
}

function AvailChip({
  children, active, onClick, className,
}: { children: React.ReactNode; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
        !active && className,
      )}
    >
      {children}
    </button>
  );
}

function EmptyWishlist() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-500/15">
        <Heart className="h-5 w-5 text-rose-400" />
      </div>
      <p className="mt-3 font-display text-sm font-bold">Your wishlist is empty</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">Add a card to make Radiant prioritize trades, hunts, and pack guidance around it.</p>
      <Button size="sm" className="mt-3 h-8 gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add card</Button>
    </div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────
function CardDetail({ card, onClose }: { card: WishCard; onClose: () => void }) {
  const set = SETS.find((s) => s.id === card.set)!;
  const isOwned = card.owned > 0;
  const meta = ACQ_META[card.acquisition];
  const Icon = meta.icon;
  const prio = PRIO_META[card.priority];

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

      <div className="px-6 pt-5">
        <div className="mx-auto w-[220px]">
          <CardArt name={card.name} type={card.type} rarity={card.rarity} number={card.number} owned={card.owned} missing={!isOwned} size="lg" />
        </div>
      </div>

      <div className="px-5 pt-4">
        <h2 className="font-display text-xl font-bold tracking-tight">{card.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{set.name} · <span className="capitalize">{card.type}</span></p>

        {/* Priority + acquisition headline */}
        <div className="mt-4 flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold", meta.cls)}>
            <Icon className="h-3 w-3" /> {meta.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1 text-[11px] font-semibold text-foreground">
            <span className={cn("h-2 w-2 rounded-full", prio.dot)} /> {prio.label} priority
          </span>
        </div>

        {(card.completes || card.setCompletion || card.remaining) && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Collection context</div>
            <div className="mt-0.5 font-display text-sm font-bold">
              {card.completes ?? (card.setCompletion ? "Needed for Set Completion" : card.remaining)}
            </div>
            {card.completes && card.remaining && (
              <div className="mt-0.5 text-[11px] text-primary/80">{card.remaining}</div>
            )}
          </div>
        )}

        <div
          className={cn(
            "mt-3 rounded-lg border p-3",
            isOwned ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10",
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

      <div className="mt-4 grid grid-cols-3 gap-2 px-5">
        <FactCell label="Set"    value={set.short} />
        <FactCell label="Number" value={card.number.split(" ")[1]} />
        <FactCell label="Rarity" value={card.rarity} />
      </div>

      <div className="mt-5 px-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">How can I get it</div>
        <div className="space-y-1.5">
          <SourceRow icon={<Sparkles className="h-3.5 w-3.5" />} label={`Pull from ${set.name}`} value={card.pullOdds ? `${card.pullOdds} per pack` : "Not currently featured"} tone="primary" />
          <SourceRow icon={<Repeat2 className="h-3.5 w-3.5" />}   label="Trade with a friend"      value={card.tradeOffers ? `${card.tradeOffers} open offers` : "No offers yet"} tone={card.tradeOffers ? "success" : "muted"} />
          <SourceRow icon={<Crosshair className="h-3.5 w-3.5" />} label="Community hunt"           value={card.activeHunts ? `${card.activeHunts.toLocaleString()} hunting now` : "No active hunt"} tone={card.activeHunts ? "warning" : "muted"} />
        </div>
      </div>

      {card.note && (
        <div className="mx-5 mt-4 rounded-md border border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Note: </span>{card.note}
        </div>
      )}

      <div className="sticky bottom-0 mt-5 grid grid-cols-1 gap-2 border-t border-border bg-background/95 p-4 backdrop-blur sm:grid-cols-3">
        <Button variant="secondary" size="sm" className="h-9 gap-1.5">
          <Heart className="h-3.5 w-3.5 fill-current text-rose-400" /> Remove
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
