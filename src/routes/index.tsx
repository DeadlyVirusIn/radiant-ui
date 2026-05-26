import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crosshair,
  Flame,
  Gem,
  Gift,
  Heart,
  Inbox,
  Lightbulb,
  Package,
  PlayCircle,
  Repeat2,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Radiant" }] }),
  component: UserHome,
});

// ─────────────────────────────────────────────────────────────
// Player + card-art system (energy-typed holographic placeholders)
const player = {
  name: "Riko", level: 27, xpInLevel: 1820, xpToNext: 2400,
  streakDays: 12, goldFlair: 1284, staminaNow: 38, staminaMax: 50,
  collectionPct: 67, ownedCards: 1241, totalCards: 1840,
};

type EnergyType = "fire"|"water"|"grass"|"lightning"|"psychic"|"fighting"|"dark"|"metal"|"dragon"|"fairy"|"colorless";
const energy: Record<EnergyType, { from: string; via: string; to: string; glow: string }> = {
  fire:      { from:"from-orange-500/70", via:"via-red-600/40",    to:"to-amber-900/60",   glow:"shadow-[0_8px_40px_-12px_rgba(249,115,22,0.5)]" },
  water:     { from:"from-sky-400/70",    via:"via-blue-600/40",   to:"to-indigo-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(56,189,248,0.5)]" },
  grass:     { from:"from-emerald-400/70",via:"via-green-600/40",  to:"to-teal-900/60",    glow:"shadow-[0_8px_40px_-12px_rgba(52,211,153,0.5)]" },
  lightning: { from:"from-yellow-300/80", via:"via-amber-500/40",  to:"to-yellow-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(250,204,21,0.55)]" },
  psychic:   { from:"from-fuchsia-400/70",via:"via-purple-600/40", to:"to-indigo-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(217,70,239,0.5)]" },
  fighting:  { from:"from-orange-700/70", via:"via-amber-800/40",  to:"to-stone-900/60",   glow:"shadow-[0_8px_40px_-12px_rgba(180,83,9,0.5)]" },
  dark:      { from:"from-slate-600/70",  via:"via-zinc-800/40",   to:"to-black/70",       glow:"shadow-[0_8px_40px_-12px_rgba(15,23,42,0.7)]" },
  metal:     { from:"from-slate-300/70",  via:"via-zinc-500/40",   to:"to-slate-800/60",   glow:"shadow-[0_8px_40px_-12px_rgba(148,163,184,0.5)]" },
  dragon:    { from:"from-amber-400/70",  via:"via-indigo-600/40", to:"to-violet-900/60",  glow:"shadow-[0_8px_40px_-12px_rgba(251,191,36,0.45)]" },
  fairy:     { from:"from-pink-300/70",   via:"via-rose-500/40",   to:"to-fuchsia-900/60", glow:"shadow-[0_8px_40px_-12px_rgba(244,114,182,0.5)]" },
  colorless: { from:"from-slate-200/60",  via:"via-slate-400/30",  to:"to-slate-700/60",   glow:"shadow-[0_8px_40px_-12px_rgba(203,213,225,0.4)]" },
};
const rarityRing: Record<string, string> = {
  Crown: "ring-2 ring-yellow-400/80",
  Immersive: "ring-2 ring-fuchsia-400/70",
  Star: "ring-2 ring-amber-300/60",
  "Full Art": "ring-1 ring-sky-300/70",
  EX: "ring-1 ring-orange-400/70",
};

function CardArt({ name, type, rarity, set, className = "" }:{
  name: string; type: EnergyType; rarity?: keyof typeof rarityRing; set?: string; className?: string;
}) {
  const e = energy[type];
  const ring = rarity ? rarityRing[rarity] ?? "" : "";
  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/10 ${ring} ${e.glow} ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${e.from} ${e.via} ${e.to}`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.18)_50%,transparent_70%)]" />
      <div className="absolute inset-0 opacity-30 mix-blend-overlay [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_4px)]" />
      <div className="absolute inset-x-0 top-1/2 mx-auto h-2/3 w-2/3 -translate-y-1/2 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute inset-x-0 top-1/2 mx-auto h-px w-2/3 -translate-y-1/2 bg-white/20" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-background/40" />
      {rarity && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
          <Star className="h-2.5 w-2.5" /> {rarity}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate font-display text-[11px] font-bold leading-tight text-white drop-shadow">{name}</p>
        {set && <p className="truncate text-[9px] uppercase tracking-wider text-white/70">{set}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
const continueItems = [
  { id:"c1", kind:"hunt",    title:"Gengar ex hunt",         sub:"Triumphant Light · 72% progress",  status:"in-progress",      cta:"Resume",    to:"/hunts" },
  { id:"c2", kind:"trade",   title:"Trade with Mika",        sub:"Blastoise ex ↔ Snorlax",            status:"waiting-for-user", cta:"Review",    to:"/trades" },
  { id:"c3", kind:"gift",    title:"3 gifts to claim",       sub:"Hana, Daichi, Yui",                 status:"ready-to-send",    cta:"Claim all", to:"/gifts" },
  { id:"c4", kind:"flair",   title:"Charizard Gold Flair",   sub:"Mint ready · approve to send",      status:"ready-to-send",    cta:"Approve",   to:"/gold-flair" },
  { id:"c5", kind:"mission", title:"Daily missions — 2 of 4",sub:"Trade + Gift remaining",            status:"in-progress",      cta:"Continue",  to:"/missions" },
];
const kindMeta = {
  hunt:    { icon: Crosshair, color:"text-warning bg-warning/10 border-warning/20" },
  trade:   { icon: Repeat2,   color:"text-primary bg-primary/10 border-primary/20" },
  gift:    { icon: Gift,      color:"text-success bg-success/10 border-success/20" },
  flair:   { icon: Gem,       color:"text-warning bg-warning/10 border-warning/20" },
  mission: { icon: Target,    color:"text-primary bg-primary/10 border-primary/20" },
} as const;
const statusMeta: Record<string,{label:string;cls:string}> = {
  "ready-to-send":    { label:"Ready",           cls:"bg-success/15 text-success border-success/30" },
  "waiting-for-user": { label:"Waiting for you", cls:"bg-warning/15 text-warning border-warning/30" },
  "in-progress":      { label:"In progress",     cls:"bg-primary/15 text-primary border-primary/30" },
};

const setProgress = [
  { name:"Triumphant Light",     owned:118, total:120, missing:2,  highlight:"Mew ex, Rayquaza Crown", type:"psychic"   as EnergyType },
  { name:"Mythical Island",      owned:84,  total:86,  missing:2,  highlight:"Mew, Articuno ex",       type:"water"     as EnergyType },
  { name:"Space-Time Smackdown", owned:92,  total:108, missing:16, highlight:"Lugia Crown +15",        type:"lightning" as EnergyType },
  { name:"Genetic Apex",         owned:226, total:286, missing:60, highlight:"Charizard ex +59",       type:"fire"      as EnergyType },
];

const myHunts = [
  { id:"h1", target:"Gengar ex",   set:"Triumphant Light",     type:"psychic"   as EnergyType, rarity:"Immersive" as const, progress:72, pulls:1820, eta:"Ready soon", status:"in-progress",   community:3210 },
  { id:"h2", target:"Lugia Crown", set:"Space-Time Smackdown", type:"lightning" as EnergyType, rarity:"Crown"     as const, progress:41, pulls:980,  eta:"~2 days",    status:"in-progress",   community:12400 },
  { id:"h3", target:"Mew ex",      set:"Triumphant Light",     type:"psychic"   as EnergyType, rarity:"Crown"     as const, progress:12, pulls:240,  eta:"~6 days",    status:"in-progress",   community:18900 },
  { id:"h4", target:"Solar Crown", set:"Triumphant Light",     type:"fire"      as EnergyType, rarity:"Star"      as const, progress:88, pulls:2240, eta:"Ready",      status:"ready-to-send", community:4120 },
];

const tradeOpportunities = [
  { id:"t1", partner:"Mika",
    youGive:{ name:"Snorlax",    type:"colorless" as EnergyType, rarity:"Star"     as const, set:"Genetic Apex" },
    youGet: { name:"Blastoise ex",type:"water"    as EnergyType, rarity:"EX"       as const, set:"Genetic Apex" },
    valueDelta:"+58",  completes:"Triumphant Light", status:"waiting-for-user" },
  { id:"t2", partner:"Daichi",
    youGive:{ name:"Articuno",   type:"water"     as EnergyType, rarity:"Full Art" as const, set:"Mythical Island" },
    youGet: { name:"Mew ex",     type:"psychic"   as EnergyType, rarity:"Crown"    as const, set:"Triumphant Light" },
    valueDelta:"+120", completes:"Mythical Island",  status:"in-progress" },
  { id:"t3", partner:"Hana",
    youGive:{ name:"Eevee",      type:"colorless" as EnergyType, rarity:"Star"     as const, set:"Genetic Apex" },
    youGet: { name:"Greninja ex",type:"water"     as EnergyType, rarity:"EX"       as const, set:"Genetic Apex" },
    valueDelta:"+34",  completes:"Genetic Apex",     status:"ready-to-send" },
];

const recentPulls = [
  { name:"Mewtwo ex",   set:"Genetic Apex",    rarity:"Crown"     as const, type:"psychic"   as EnergyType, when:"2h ago" },
  { name:"Charizard",   set:"Genetic Apex",    rarity:"Immersive" as const, type:"fire"      as EnergyType, when:"5h ago" },
  { name:"Pikachu",     set:"Promo-A",         rarity:"Full Art"  as const, type:"lightning" as EnergyType, when:"Yesterday" },
  { name:"Articuno ex", set:"Mythical Island", rarity:"Star"      as const, type:"water"     as EnergyType, when:"Yesterday" },
  { name:"Greninja",    set:"Genetic Apex",    rarity:"Full Art"  as const, type:"water"     as EnergyType, when:"2d ago" },
];

const latestExpansion = {
  code:"TRL", name:"Triumphant Light",
  tagline:"New chase cards. Limited window. Community hunts now live.",
  joined:12420, newCount:4,
  featured:[
    { name:"Mew ex",      rarity:"Crown"     as const, type:"psychic"   as EnergyType },
    { name:"Gengar ex",   rarity:"Immersive" as const, type:"psychic"   as EnergyType },
    { name:"Lugia Crown", rarity:"Crown"     as const, type:"lightning" as EnergyType },
    { name:"Solar Crown", rarity:"Star"      as const, type:"fire"      as EnergyType },
  ],
};

const intelligence = [
  { id:"i1", icon:Trophy,    title:"Complete Triumphant Light",     insight:"You're 2 cards away. Trading Snorlax to Mika gets you Blastoise ex. Joining the Mew ex community hunt closes the gap.", impact:"Set completion in ~2 days", cta:"Build a plan",       tone:"warning" },
  { id:"i2", icon:Repeat2,   title:"5 trades match your wishlist",  insight:"Mika, Daichi, and Hana have cards you need and want cards you have duplicates of.",                                    impact:"+58 collection value",      cta:"View trades",        tone:"primary" },
  { id:"i3", icon:Crosshair, title:"Best hunt for your stamina",    insight:"Gengar ex needs ~720 pulls. You have 38 stamina + 12-day streak — start within 6h to ride the multiplier.",            impact:"1.8× drop rate",            cta:"Start hunt",         tone:"warning" },
  { id:"i4", icon:Gem,       title:"Gold Flair: spend Charizard",   insight:"Only 8 mints remain. You have 1,284 Gold Flair — enough for 2 mints. Next restock is uncertain.",                      impact:"Lock in before low stock",  cta:"Open Flair center",  tone:"warning" },
];

const dailyTasks = [
  { label:"Open 2 packs",            done:2, total:2 },
  { label:"Win a Wonder Pick",       done:1, total:1 },
  { label:"Send a gift to a friend", done:0, total:1 },
  { label:"Complete 1 trade",        done:0, total:2 },
];
const friendsActivity = [
  { name:"Mika",   action:"pulled Charizard ex",        when:"3m"  },
  { name:"Hana",   action:"sent you a gift",            when:"18m" },
  { name:"Daichi", action:"wants to trade Snorlax",     when:"1h"  },
  { name:"Yui",    action:"completed Triumphant Light", when:"2h"  },
  { name:"Ren",    action:"joined Mew ex hunt",         when:"3h"  },
];

// ─────────────────────────────────────────────────────────────
function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm ${className}`}>{children}</div>;
}
function TileHeader({ icon: Icon, title, subtitle, action }:{
  icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  const m = statusMeta[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>{m.label}</span>;
}

function UserHome() {
  const xpPct = Math.round((player.xpInLevel / player.xpToNext) * 100);
  const staminaPct = Math.round((player.staminaNow / player.staminaMax) * 100);
  const waiting = continueItems.filter((c) => c.status === "waiting-for-user" || c.status === "ready-to-send").length;

  return (
    <div className="space-y-6 pb-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/40 to-background p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-warning/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" />{player.streakDays}-day streak</span>
              {waiting > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-warning">
                  <Bell className="h-3 w-3" /> {waiting} waiting for you
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Welcome back, {player.name}.</h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground md:text-base">
              You're <span className="font-semibold text-foreground">2 cards away</span> from completing Triumphant Light.{" "}
              <span className="text-warning">4 actions</span> are waiting on you.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link to="/hunts" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_var(--primary)] transition-transform hover:-translate-y-0.5">
                <PlayCircle className="h-4 w-4" /> Resume hunt
              </Link>
              <Link to="/open-pack" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card">
                <Sparkles className="h-4 w-4" /> Open today's pack
              </Link>
              <Link to="/gifts" className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success hover:bg-success/15">
                <Gift className="h-4 w-4" /> Claim 3 gifts
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Level</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">{player.level}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${xpPct}%` }} /></div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{player.xpInLevel}/{player.xpToNext} XP</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Collection</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">{player.collectionPct}%</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{player.ownedCards.toLocaleString()} / {player.totalCards.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Stamina</p>
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{player.staminaNow}<span className="text-base text-muted-foreground">/{player.staminaMax}</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-success" style={{ width: `${staminaPct}%` }} /></div>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/15 to-transparent p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">Gold Flair</p>
                <Gem className="h-3.5 w-3.5 text-warning" />
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{player.goldFlair.toLocaleString()}</p>
              <Link to="/gold-flair" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning hover:underline">Spend now <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* CONTINUE WHERE YOU LEFT OFF */}
      <Tile>
        <TileHeader icon={Inbox} title="Continue where you left off" subtitle="Hunts, trades, gifts, and Gold Flair waiting for you" action={<span className="text-[11px] font-semibold text-muted-foreground">{continueItems.length} open</span>} />
        <div className="grid gap-2 md:grid-cols-2">
          {continueItems.map((c) => {
            const meta = kindMeta[c.kind as keyof typeof kindMeta];
            const Icon = meta.icon;
            return (
              <Link key={c.id} to={c.to} className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30 hover:bg-card/60">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${meta.color}`}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                      <StatusPill status={c.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.sub}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-80 group-hover:opacity-100">
                  {c.cta} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </Tile>

      {/* 1. MY COLLECTION PROGRESS — promoted above Latest Expansion */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/30 to-background p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <Trophy className="h-3.5 w-3.5" /> My collection progress
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {player.collectionPct}% complete · {(player.totalCards - player.ownedCards).toLocaleString()} cards to go
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Two sets are within reach this week.</p>
          </div>
          <Link to="/cards" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-card">
            Open collection <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {setProgress.map((s) => {
            const pct = Math.round((s.owned / s.total) * 100);
            const near = pct >= 95;
            const e = energy[s.type];
            return (
              <Link key={s.name} to="/cards" className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 p-4 transition-transform hover:-translate-y-1 hover:border-primary/40">
                <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${e.from} ${e.to} opacity-30 blur-2xl`} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-semibold text-foreground">{s.name}</p>
                    {near && <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">Almost done</span>}
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <p className="font-display text-4xl font-bold text-foreground">{pct}<span className="text-lg text-muted-foreground">%</span></p>
                    <p className="font-mono text-[11px] text-muted-foreground">{s.owned}/{s.total}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div className={`h-full rounded-full ${near ? "bg-gradient-to-r from-success to-success/60" : "bg-gradient-to-r from-primary to-primary/50"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2.5 truncate text-[11px] text-muted-foreground">Missing: {s.highlight}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 5. COLLECTION INTELLIGENCE */}
      <Tile className="bg-gradient-to-br from-primary/10 via-card/40 to-warning/5">
        <TileHeader icon={Brain} title="Collection intelligence" subtitle="Smart plays generated from your collection, friends, and live stock" action={<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary"><Lightbulb className="h-3 w-3" /> Updated 2m ago</span>} />
        <div className="grid gap-3 md:grid-cols-2">
          {intelligence.map((r) => {
            const Icon = r.icon;
            const toneCls = r.tone === "warning" ? "border-warning/30 bg-warning/5" : "border-primary/30 bg-primary/5";
            const iconCls = r.tone === "warning" ? "text-warning bg-warning/15" : "text-primary bg-primary/15";
            return (
              <div key={r.id} className={`flex flex-col gap-3 rounded-xl border p-4 ${toneCls}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconCls}`}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{r.insight}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                  <span className={`text-[11px] font-semibold ${r.tone === "warning" ? "text-warning" : "text-primary"}`}>{r.impact}</span>
                  <button className="rounded-md bg-foreground/90 px-2.5 py-1.5 text-[11px] font-bold text-background hover:bg-foreground">{r.cta}</button>
                </div>
              </div>
            );
          })}
        </div>
      </Tile>

      {/* 2. MY HUNTS — dedicated, card-art driven */}
      <Tile>
        <TileHeader
          icon={Crosshair}
          title="My hunts"
          subtitle="Cards you're actively chasing"
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{myHunts.length} active</span>
              <Link to="/hunts" className="text-xs font-semibold text-primary hover:underline">All hunts →</Link>
            </div>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {myHunts.map((h) => (
            <div key={h.id} className="overflow-hidden rounded-2xl border border-border/60 bg-background/40 transition-transform hover:-translate-y-1 hover:border-primary/40">
              <div className="p-3 pb-0">
                <CardArt name={h.target} set={h.set} type={h.type} rarity={h.rarity} />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-display text-sm font-semibold text-foreground">{h.target}</p>
                  <StatusPill status={h.status} />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{h.set}</p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div className="h-full rounded-full bg-gradient-to-r from-warning to-warning/50" style={{ width: `${h.progress}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-mono">{h.pulls.toLocaleString()} pulls</span>
                  <span className="font-semibold text-warning">{h.eta}</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Users className="h-3 w-3" /> {h.community.toLocaleString()}</span>
                  <Link to="/hunts" className="rounded-md bg-warning/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-warning hover:bg-warning/25">Resume</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Tile>

      {/* 3. TRADE OPPORTUNITIES — dedicated */}
      <Tile>
        <TileHeader icon={Repeat2} title="Trade opportunities" subtitle="Matches with your friends' wishlists right now" action={<Link to="/trades" className="text-xs font-semibold text-primary hover:underline">All trades →</Link>} />
        <div className="grid gap-3 lg:grid-cols-3">
          {tradeOpportunities.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-[10px] font-bold text-foreground">{t.partner[0]}</div>
                  <p className="text-xs font-semibold text-foreground">{t.partner}</p>
                </div>
                <StatusPill status={t.status} />
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">You give</p>
                  <CardArt name={t.youGive.name} set={t.youGive.set} type={t.youGive.type} rarity={t.youGive.rarity} />
                </div>
                <div className="grid place-items-center">
                  <div className="grid h-7 w-7 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary"><Repeat2 className="h-3.5 w-3.5" /></div>
                </div>
                <div>
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-success">You get</p>
                  <CardArt name={t.youGet.name} set={t.youGet.set} type={t.youGet.type} rarity={t.youGet.rarity} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-2.5">
                <div>
                  <p className="text-[10px] text-muted-foreground">Helps complete</p>
                  <p className="text-[11px] font-semibold text-foreground">{t.completes}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Value</p>
                  <p className="font-mono text-sm font-bold text-success">{t.valueDelta}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Open trade</button>
                <button className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </Tile>

      {/* LATEST EXPANSION (now below collection progress) */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-warning/10 via-background to-primary/10 p-6">
        <div className="pointer-events-none absolute -right-10 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-warning/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-warning">
              <Sparkles className="h-3 w-3" /> Latest expansion · {latestExpansion.code}
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">{latestExpansion.name}</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{latestExpansion.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary" /> {latestExpansion.joined.toLocaleString()} players hunting</span>
              <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-warning" /> {latestExpansion.newCount} new chase cards</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/hunts" className="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-sm font-semibold text-warning-foreground hover:bg-warning/90">
                <Crosshair className="h-4 w-4" /> Join community hunt
              </Link>
              <Link to="/cards" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card">Browse the set</Link>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {latestExpansion.featured.map((c) => (
              <CardArt key={c.name} name={c.name} type={c.type} rarity={c.rarity} set={latestExpansion.name} />
            ))}
          </div>
        </div>
      </section>

      {/* Body grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Latest pulls — card-art driven */}
          <Tile>
            <TileHeader icon={Package} title="Latest pulls" subtitle="Your most recent cards" action={<Link to="/cards" className="text-xs font-semibold text-primary hover:underline">View all →</Link>} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {recentPulls.map((c) => (
                <div key={c.name} className="space-y-1">
                  <CardArt name={c.name} type={c.type} rarity={c.rarity} set={c.set} />
                  <p className="text-center text-[10px] text-muted-foreground">{c.when}</p>
                </div>
              ))}
            </div>
          </Tile>

          {/* Gold Flair quadrants */}
          <Tile>
            <TileHeader icon={Gem} title="Gold Flair center" subtitle={`Balance: ${player.goldFlair.toLocaleString()}`} action={<Link to="/gold-flair" className="text-xs font-semibold text-warning hover:underline">Open center →</Link>} />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success"><CheckCircle2 className="h-3 w-3" /> Ready (2)</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Charizard</span><span className="text-[10px] text-success">Ready now</span></li>
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Pikachu Promo</span><span className="text-[10px] text-success">Ready now</span></li>
                </ul>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary"><Clock className="h-3 w-3" /> Preparing (2)</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Mewtwo ex</span><span className="text-[10px] text-muted-foreground">~14 min</span></li>
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Articuno ex</span><span className="text-[10px] text-muted-foreground">~38 min</span></li>
                </ul>
              </div>
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-warning"><Bell className="h-3 w-3" /> Low stock (1)</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Gengar ex</span><span className="text-[10px] text-warning">3 mints left</span></li>
                </ul>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Package className="h-3 w-3" /> Recently completed</p>
                <ul className="space-y-1.5 text-xs">
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Snorlax</span><span className="text-[10px] text-muted-foreground">Sent 2h ago</span></li>
                  <li className="flex justify-between"><span className="font-semibold text-foreground">Eevee</span><span className="text-[10px] text-muted-foreground">Yesterday</span></li>
                </ul>
              </div>
            </div>
          </Tile>
        </div>

        {/* RIGHT RAIL */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Tile>
            <TileHeader icon={Calendar} title="Today" subtitle="Resets in 7h 24m" />
            <ul className="space-y-2.5">
              {dailyTasks.map((t, i) => {
                const done = t.done >= t.total;
                return (
                  <li key={i} className="flex items-center gap-3">
                    <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${done ? "border-success bg-success/20 text-success" : "border-border bg-background/60 text-muted-foreground"}`}>{done ? "✓" : ""}</div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.label}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/40"><div className={`h-full ${done ? "bg-success" : "bg-primary"}`} style={{ width: `${(t.done / t.total) * 100}%` }} /></div>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.done}/{t.total}</span>
                  </li>
                );
              })}
            </ul>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-card">
              <Trophy className="h-3.5 w-3.5 text-warning" /> Claim 75 XP
            </button>
          </Tile>

          <Tile>
            <TileHeader icon={Heart} title="Friend activity" subtitle="Live feed" action={<Link to="/friends" className="text-xs font-semibold text-primary hover:underline">All →</Link>} />
            <ul className="space-y-3">
              {friendsActivity.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-[11px] font-bold text-foreground">{f.name[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground"><span className="font-semibold">{f.name}</span> <span className="text-muted-foreground">{f.action}</span></p>
                    <p className="text-[10px] text-muted-foreground">{f.when} ago</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </li>
              ))}
            </ul>
          </Tile>

          <Tile className="bg-gradient-to-br from-card/40 to-primary/5">
            <p className="font-display text-sm font-semibold text-foreground">Jump back in</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { to:"/trades",  label:"Trades",   icon:Repeat2 },
                { to:"/gifts",   label:"Gifts",    icon:Gift },
                { to:"/collection-missions", label:"Missions", icon:Target },
                { to:"/wonder-pick", label:"Wonder Pick", icon:Zap },
              ].map((q) => (
                <Link key={q.to} to={q.to} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-card/60">
                  <q.icon className="h-3.5 w-3.5 text-primary" />
                  {q.label}
                </Link>
              ))}
            </div>
          </Tile>
        </aside>
      </div>
    </div>
  );
}
