import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Trophy, Target, Sparkles, Crosshair, Repeat2, Package, ArrowRight,
  Heart, Lock, Star, Check, X, ArrowUpDown, Flame,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tracker")({
  head: () => ({ meta: [{ title: "Set Progress — Radiant" }] }),
  component: SetProgress,
});

// ─────────────────────────────────────────────────────────────────────────
// Local copies of CardArt / types (mirrors the Cards page so this route is
// self-contained — page-by-page redesign pass)
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

const RARITY_TIERS: { rarity: Rarity; tone: string; chip: string; isChase: boolean }[] = [
  { rarity: "Common",    tone: "text-muted-foreground", chip: "bg-muted text-muted-foreground",   isChase: false },
  { rarity: "Uncommon",  tone: "text-muted-foreground", chip: "bg-muted text-muted-foreground",   isChase: false },
  { rarity: "Rare",      tone: "text-sky-300",          chip: "bg-sky-500/15 text-sky-300",       isChase: false },
  { rarity: "EX",        tone: "text-orange-300",       chip: "bg-orange-500/15 text-orange-300", isChase: true  },
  { rarity: "Full Art",  tone: "text-sky-300",          chip: "bg-sky-500/15 text-sky-300",       isChase: true  },
  { rarity: "Star",      tone: "text-amber-300",        chip: "bg-amber-400/15 text-amber-300",   isChase: true  },
  { rarity: "Immersive", tone: "text-fuchsia-300",      chip: "bg-fuchsia-500/15 text-fuchsia-300",isChase: true  },
  { rarity: "Crown",     tone: "text-yellow-300",       chip: "bg-yellow-400/15 text-yellow-300", isChase: true  },
];

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

type Acquisition = "trade" | "hunt" | "pack";
const acquisitionMeta: Record<Acquisition, { label: string; tone: string; icon: typeof Repeat2 }> = {
  trade: { label: "Trade Available", tone: "bg-success/90 text-success-foreground", icon: Repeat2 },
  hunt:  { label: "Active Hunt",     tone: "bg-primary/90 text-primary-foreground", icon: Crosshair },
  pack:  { label: "Pack Only",       tone: "bg-warning/90 text-warning-foreground", icon: Package },
};

function CardArt({
  name, type, rarity, number, missing, acquisition,
}: {
  name: string; type: EnergyType; rarity: Rarity; number?: string;
  missing?: boolean; acquisition?: Acquisition;
}) {
  const e = energy[type];
  const acq = acquisition ? acquisitionMeta[acquisition] : null;
  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10",
        rarityRing[rarity], e.glow,
        missing && "saturate-[.4] opacity-85",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", e.from, e.via, e.to)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.32),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.16)_50%,transparent_70%)]" />
      <div className="absolute inset-0 opacity-25 mix-blend-overlay [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_4px)]" />
      <div className="absolute inset-x-0 top-1/2 mx-auto h-2/3 w-2/3 -translate-y-1/2 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-background/40" />

      <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
        <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <Star className="h-2.5 w-2.5" /> {rarity}
        </span>
        {missing && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-warning/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground shadow-md backdrop-blur">
            <Lock className="h-2.5 w-2.5" /> Missing
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2 pt-6">
        <p className="truncate font-display text-[13px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{name}</p>
        {number && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/85">{number}</p>
        )}
        {acq && (
          <span className={cn(
            "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow",
            acq.tone,
          )}>
            <acq.icon className="h-2.5 w-2.5" /> {acq.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mock data
type SetId = "TL" | "MI" | "STS" | "GA";

type TierProgress = { rarity: Rarity; owned: number; total: number };
type MissingCard = {
  id: string; name: string; set: SetId; number: string;
  type: EnergyType; rarity: Rarity; acquisition: Acquisition;
  tradeOffers?: number; activeHunts?: number; pullOdds?: string;
  value: number; // dust value, for "Most Valuable Missing" sort
  wishlist?: boolean;
};

type SetData = {
  id: SetId; name: string; short: string;
  owned: number; total: number;
  tiers: TierProgress[];
  missing: MissingCard[];
  path: {
    trade: string;   // recommended trade move
    hunt: string;    // recommended hunt move
    pack: string;    // recommended pack to open
  };
};

const SETS: SetData[] = [
  {
    id: "TL", name: "Triumphant Light", short: "TL",
    owned: 118, total: 120,
    tiers: [
      { rarity: "Common",    owned: 40, total: 40 },
      { rarity: "Uncommon",  owned: 30, total: 30 },
      { rarity: "Rare",      owned: 20, total: 20 },
      { rarity: "EX",        owned: 14, total: 15 },
      { rarity: "Full Art",  owned: 8,  total: 8  },
      { rarity: "Star",      owned: 4,  total: 4  },
      { rarity: "Immersive", owned: 1,  total: 1  },
      { rarity: "Crown",     owned: 1,  total: 2  },
    ],
    missing: [
      { id: "tl-01", name: "Mew ex",         set: "TL", number: "TL 086/120", type: "psychic", rarity: "Crown", acquisition: "hunt",  activeHunts: 18900, value: 4800, wishlist: true },
      { id: "tl-02", name: "Rayquaza Crown", set: "TL", number: "TL 119/120", type: "dragon",  rarity: "EX",    acquisition: "trade", tradeOffers: 8,     value: 1200 },
    ],
    path: {
      trade: "Open trade for Rayquaza — 8 offers up",
      hunt:  "Join the Mew ex hunt (18.9k hunters)",
      pack:  "Open Triumphant Light packs (×3 odds)",
    },
  },
  {
    id: "MI", name: "Mythical Island", short: "MI",
    owned: 84, total: 86,
    tiers: [
      { rarity: "Common",    owned: 30, total: 30 },
      { rarity: "Uncommon",  owned: 22, total: 22 },
      { rarity: "Rare",      owned: 15, total: 15 },
      { rarity: "EX",        owned: 9,  total: 10 },
      { rarity: "Full Art",  owned: 5,  total: 5  },
      { rarity: "Star",      owned: 2,  total: 3  },
      { rarity: "Immersive", owned: 1,  total: 1  },
    ],
    missing: [
      { id: "mi-01", name: "Articuno ex", set: "MI", number: "MI 084/086", type: "water",   rarity: "EX",   acquisition: "trade", tradeOffers: 6, value: 900 },
      { id: "mi-02", name: "Mew",         set: "MI", number: "MI 085/086", type: "psychic", rarity: "Star", acquisition: "hunt",  activeHunts: 4200, value: 2200, wishlist: true },
    ],
    path: {
      trade: "Trade for Articuno ex — 6 offers waiting",
      hunt:  "Watch the Mew shiny hunt (4.2k hunters)",
      pack:  "Mythical Island packs — EX odds best here",
    },
  },
  {
    id: "STS", name: "Space-Time Smackdown", short: "STS",
    owned: 92, total: 108,
    tiers: [
      { rarity: "Common",    owned: 36, total: 36 },
      { rarity: "Uncommon",  owned: 26, total: 28 },
      { rarity: "Rare",      owned: 14, total: 18 },
      { rarity: "EX",        owned: 10, total: 14 },
      { rarity: "Full Art",  owned: 4,  total: 6  },
      { rarity: "Star",      owned: 1,  total: 3  },
      { rarity: "Immersive", owned: 1,  total: 2  },
      { rarity: "Crown",     owned: 0,  total: 1  },
    ],
    missing: [
      { id: "sts-01", name: "Lugia Crown",  set: "STS", number: "STS 108/108", type: "lightning", rarity: "Crown",    acquisition: "hunt",  activeHunts: 12400, value: 5200, wishlist: true },
      { id: "sts-02", name: "Dialga ex",    set: "STS", number: "STS 098/108", type: "metal",     rarity: "EX",       acquisition: "trade", tradeOffers: 5, value: 1100 },
      { id: "sts-03", name: "Palkia ex",    set: "STS", number: "STS 099/108", type: "water",     rarity: "EX",       acquisition: "pack",  pullOdds: "1.2%", value: 1100 },
      { id: "sts-04", name: "Garchomp ex",  set: "STS", number: "STS 100/108", type: "dragon",    rarity: "EX",       acquisition: "pack",  pullOdds: "1.2%", value: 1300 },
      { id: "sts-05", name: "Origin Giratina", set: "STS", number: "STS 107/108", type: "dragon", rarity: "Immersive",acquisition: "hunt",  activeHunts: 6800, value: 3400 },
    ],
    path: {
      trade: "Trade for Dialga ex — 5 offers up",
      hunt:  "Lugia Crown hunt is hot — 12.4k hunters",
      pack:  "Open STS packs for Palkia & Garchomp",
    },
  },
  {
    id: "GA", name: "Genetic Apex", short: "GA",
    owned: 226, total: 286,
    tiers: [
      { rarity: "Common",    owned: 80, total: 80 },
      { rarity: "Uncommon",  owned: 70, total: 72 },
      { rarity: "Rare",      owned: 40, total: 50 },
      { rarity: "EX",        owned: 22, total: 40 },
      { rarity: "Full Art",  owned: 8,  total: 20 },
      { rarity: "Star",      owned: 4,  total: 14 },
      { rarity: "Immersive", owned: 1,  total: 6  },
      { rarity: "Crown",     owned: 1,  total: 4  },
    ],
    missing: [
      { id: "ga-01", name: "Blastoise ex", set: "GA", number: "GA 200/286", type: "water",     rarity: "EX",       acquisition: "trade", tradeOffers: 4, value: 1000, wishlist: true },
      { id: "ga-02", name: "Pikachu Crown",set: "GA", number: "GA 285/286", type: "lightning", rarity: "Crown",    acquisition: "hunt",  activeHunts: 22300, value: 5600 },
      { id: "ga-03", name: "Mewtwo Crown", set: "GA", number: "GA 286/286", type: "psychic",   rarity: "Crown",    acquisition: "hunt",  activeHunts: 19800, value: 5600 },
      { id: "ga-04", name: "Zapdos ex",    set: "GA", number: "GA 165/286", type: "lightning", rarity: "EX",       acquisition: "pack",  pullOdds: "1.2%", value: 1000 },
      { id: "ga-05", name: "Moltres ex",   set: "GA", number: "GA 170/286", type: "fire",      rarity: "EX",       acquisition: "pack",  pullOdds: "1.2%", value: 1000 },
      { id: "ga-06", name: "Gyarados ex",  set: "GA", number: "GA 205/286", type: "water",     rarity: "EX",       acquisition: "trade", tradeOffers: 2, value: 950 },
      { id: "ga-07", name: "Aerodactyl",   set: "GA", number: "GA 142/286", type: "fighting",  rarity: "Full Art", acquisition: "pack",  pullOdds: "0.8%", value: 700 },
      { id: "ga-08", name: "Articuno Star",set: "GA", number: "GA 274/286", type: "water",     rarity: "Star",     acquisition: "hunt",  activeHunts: 3200, value: 1800 },
    ],
    path: {
      trade: "Trade for Blastoise ex — 4 offers ready",
      hunt:  "Pikachu Crown hunt — biggest pool right now",
      pack:  "Open Charizard pack — best EX yield",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────
type SortKey = "closest" | "highest" | "valuable" | "chase";

const SORT_OPTIONS: { key: SortKey; label: string; icon: typeof Trophy }[] = [
  { key: "closest",  label: "Closest to Finish",       icon: Flame },
  { key: "highest",  label: "Highest Completion",      icon: Trophy },
  { key: "valuable", label: "Most Valuable Missing",   icon: Sparkles },
  { key: "chase",    label: "Most Chase Cards Missing",icon: Star },
];

function chaseMissing(s: SetData) {
  return s.tiers.filter((t) => RARITY_TIERS.find((r) => r.rarity === t.rarity)?.isChase)
    .reduce((acc, t) => acc + (t.total - t.owned), 0);
}
function valuableMissing(s: SetData) {
  return s.missing.reduce((a, c) => a + c.value, 0);
}

function SetProgress() {
  const [activeSet, setActiveSet] = useState<SetId>("MI"); // closest to finish by default
  const [sort, setSort] = useState<SortKey>("closest");
  const [picked, setPicked] = useState<MissingCard | null>(null);

  const overall = useMemo(() => {
    const owned = SETS.reduce((a, s) => a + s.owned, 0);
    const total = SETS.reduce((a, s) => a + s.total, 0);
    const chase = SETS.reduce((a, s) => a + chaseMissing(s), 0);
    const complete = SETS.filter((s) => s.owned === s.total).length;
    return { owned, total, pct: Math.round((owned / total) * 100), chase, complete };
  }, []);

  const sortedSets = useMemo(() => {
    const arr = [...SETS];
    switch (sort) {
      case "closest":  return arr.sort((a, b) => (a.total - a.owned) - (b.total - b.owned));
      case "highest":  return arr.sort((a, b) => (b.owned / b.total) - (a.owned / a.total));
      case "valuable": return arr.sort((a, b) => valuableMissing(b) - valuableMissing(a));
      case "chase":    return arr.sort((a, b) => chaseMissing(b) - chaseMissing(a));
    }
  }, [sort]);

  const hero = SETS.find((s) => s.id === activeSet)!;
  const heroPct = Math.round((hero.owned / hero.total) * 100);
  const heroRemaining = hero.total - hero.owned;
  const heroChase = chaseMissing(hero);
  const closestLeader = [...SETS].sort((a, b) => (a.total - a.owned) - (b.total - b.owned))[0];

  return (
    <div className="relative">
      <PageHeader
        title="Set Progress"
        description="Pick a set to finish — see what's missing, how close you are, and the fastest way to complete it."
      />

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-12 z-20 -mx-4 mb-6 border-y border-border bg-background/85 px-4 backdrop-blur md:-mx-6 md:px-6">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto pt-3 pb-2">
          {SETS.map((s) => {
            const active = activeSet === s.id;
            const pct = Math.round((s.owned / s.total) * 100);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSet(s.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {s.short}
                <span className="ml-1.5 text-[10px] opacity-70">{pct}%</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 pb-3 text-xs">
          <Counter label="Overall" value={`${overall.pct}%`} hint={`${overall.owned}/${overall.total}`} tone="primary" />
          <Counter label="Chase cards missing" value={overall.chase.toString()} hint="EX → Crown" tone="warning" />
          <Counter label="Sets at 100%" value={overall.complete.toString()} hint={`of ${SETS.length}`} tone="success" />
        </div>
      </div>

      {/* ── Hero set card ──────────────────────────────────────────────── */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card/60 to-background">
        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[auto_1fr] md:p-6">
          {/* completion ring */}
          <div className="flex items-center justify-center">
            <RingProgress pct={heroPct} />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                {closestLeader.id === hero.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
                    <Flame className="h-3 w-3" /> Closest to finish
                  </span>
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{hero.short}</span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{hero.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{heroRemaining} cards to go</span> · {heroChase} chase cards left
              </p>
            </div>

            {/* tier breakdown */}
            <div className="space-y-1.5">
              {hero.tiers.map((t) => {
                const meta = RARITY_TIERS.find((r) => r.rarity === t.rarity)!;
                const missing = t.total - t.owned;
                const pct = Math.round((t.owned / t.total) * 100);
                const done = missing === 0;
                return (
                  <div key={t.rarity} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-xs">
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", meta.chip, meta.isChase && "ring-1 ring-current/30")}>
                      {meta.isChase && <Star className="h-2.5 w-2.5" />}
                      {t.rarity}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", done ? "bg-success" : meta.isChase ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-primary/70")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-mono w-14 text-right text-[11px] text-muted-foreground">{t.owned}/{t.total}</span>
                    </div>
                    <span className={cn("text-mono w-16 text-right text-[11px] font-semibold", done ? "text-success" : missing > 0 && meta.isChase ? "text-warning" : "text-muted-foreground")}>
                      {done ? "✓ Done" : `${missing} to go`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* quick actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5"><Lock className="h-3.5 w-3.5" /> Browse missing</Button>
              <Button size="sm" variant="outline" className="gap-1.5"><Crosshair className="h-3.5 w-3.5" /> Hunt this set</Button>
              <Button size="sm" variant="outline" className="gap-1.5"><Repeat2 className="h-3.5 w-3.5" /> Find trades</Button>
            </div>
          </div>
        </div>

        {/* Fastest Completion Path */}
        <div className="border-t border-border bg-background/40 p-5 md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">Fastest Completion Path</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <PathCard icon={Repeat2} label="Trade" tone="success" text={hero.path.trade} cta="Open trades" />
            <PathCard icon={Crosshair} label="Hunt" tone="primary" text={hero.path.hunt} cta="Join hunt" />
            <PathCard icon={Package}  label="Pack" tone="warning" text={hero.path.pack} cta="Open pack" />
          </div>
        </div>
      </section>

      {/* ── Missing cards strip ────────────────────────────────────────── */}
      <section className="mb-6 rounded-xl border border-border bg-card/40">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold tracking-tight">Missing from {hero.short}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Tap any card to see how to get it.</p>
          </div>
          <span className="text-mono text-xs text-muted-foreground">{hero.missing.length} cards</span>
        </header>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-5 py-4">
          {hero.missing.map((c) => (
            <button
              key={c.id}
              onClick={() => setPicked(c)}
              className="w-[120px] shrink-0 text-left transition-transform hover:-translate-y-0.5 md:w-[140px]"
            >
              <CardArt name={c.name} type={c.type} rarity={c.rarity} number={c.number} missing acquisition={c.acquisition} />
            </button>
          ))}
        </div>
      </section>

      {/* ── All sets comparison ─────────────────────────────────────────── */}
      <section className="mb-6 rounded-xl border border-border bg-card/40">
        <header className="flex flex-col gap-3 border-b border-border px-5 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold tracking-tight">All sets</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Compare progress and pick your next target.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    sort === opt.key
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <opt.icon className="h-3 w-3" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="divide-y divide-border/60">
          {sortedSets.map((s, i) => {
            const pct = Math.round((s.owned / s.total) * 100);
            const remaining = s.total - s.owned;
            const chase = chaseMissing(s);
            const value = valuableMissing(s);
            const isHero = s.id === activeSet;
            const isLeader = i === 0;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSet(s.id)}
                className={cn(
                  "grid w-full grid-cols-[40px_1fr_auto] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40",
                  isHero && "bg-primary/5",
                )}
              >
                <MiniRing pct={pct} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-semibold">{s.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.short}</span>
                    {isLeader && sort === "closest" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">
                        <Flame className="h-2.5 w-2.5" /> Closest
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="text-mono">{s.owned}/{s.total}</span>
                    <span>·</span>
                    <span><span className="font-semibold text-foreground">{remaining}</span> to go</span>
                    <span>·</span>
                    <span><span className="font-semibold text-warning">{chase}</span> chase</span>
                    <span>·</span>
                    <span><span className="font-semibold text-amber-300">{value.toLocaleString()}</span> dust</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Card detail drawer ─────────────────────────────────────────── */}
      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {picked && <CardDetail card={picked} onClose={() => setPicked(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Counter({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: "primary" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary";
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className={cn("text-mono text-lg font-bold leading-none", toneClass)}>{value}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

function RingProgress({ pct }: { pct: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 128 128" className="h-32 w-32 -rotate-90">
        <circle cx="64" cy="64" r={r} stroke="currentColor" strokeWidth="10" fill="none" className="text-muted/40" />
        <circle
          cx="64" cy="64" r={r} stroke="url(#ring-grad)" strokeWidth="10" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="oklch(78% 0.18 70)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-mono text-3xl font-extrabold leading-none">{pct}%</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">complete</span>
      </div>
    </div>
  );
}

function MiniRing({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-10 w-10">
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r={r} stroke="currentColor" strokeWidth="4" fill="none" className="text-muted/40" />
        <circle cx="20" cy="20" r={r} stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="text-primary transition-all" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pct}</div>
    </div>
  );
}

function PathCard({ icon: Icon, label, tone, text, cta }: { icon: typeof Repeat2; label: string; tone: "primary" | "success" | "warning"; text: string; cta: string }) {
  const toneRing = tone === "success" ? "border-success/40 bg-success/5" : tone === "warning" ? "border-warning/40 bg-warning/5" : "border-primary/40 bg-primary/5";
  const toneText = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-primary";
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-3", toneRing)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", toneText)} />
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", toneText)}>{label}</span>
      </div>
      <p className="text-sm leading-snug">{text}</p>
      <button className={cn("mt-auto inline-flex items-center gap-1 text-[11px] font-semibold", toneText)}>
        {cta} <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function CardDetail({ card, onClose }: { card: MissingCard; onClose: () => void }) {
  const acq = acquisitionMeta[card.acquisition];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{card.set} · {card.number}</div>
          <h3 className="mt-1 font-display text-xl font-bold leading-tight">{card.name}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="mx-auto w-2/3">
        <CardArt name={card.name} type={card.type} rarity={card.rarity} number={card.number} missing acquisition={card.acquisition} />
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
        <div className="flex items-center gap-1.5 text-warning">
          <Lock className="h-3.5 w-3.5" />
          <span className="font-bold uppercase tracking-wider text-[11px]">Missing</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">You don't own this card yet.</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Fact label="Set" value={card.set} />
        <Fact label="Number" value={card.number.split(" ")[1] ?? card.number} />
        <Fact label="Rarity" value={card.rarity} />
        <Fact label="Est. value" value={`${card.value.toLocaleString()} dust`} />
      </dl>

      <div>
        <h4 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">How to get</h4>
        <div className={cn("flex items-center gap-2 rounded-lg p-3 text-sm font-semibold", acq.tone)}>
          <acq.icon className="h-4 w-4" />
          {acq.label}
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {typeof card.tradeOffers === "number" && <li>· {card.tradeOffers} trade offers up right now</li>}
          {typeof card.activeHunts === "number" && <li>· {card.activeHunts.toLocaleString()} hunters tracking this</li>}
          {card.pullOdds && <li>· Pack pull odds: {card.pullOdds}</li>}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Button className="gap-1.5"><Repeat2 className="h-3.5 w-3.5" /> Find Trade</Button>
        <Button variant="outline" className="gap-1.5"><Crosshair className="h-3.5 w-3.5" /> Hunt This Card</Button>
        <Button variant="ghost" className="gap-1.5">
          <Heart className={cn("h-3.5 w-3.5", card.wishlist && "fill-current text-rose-400")} />
          {card.wishlist ? "On wishlist" : "Add to wishlist"}
        </Button>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
