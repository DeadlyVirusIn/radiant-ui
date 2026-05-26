import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
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
  Package,
  PlayCircle,
  Repeat2,
  Search,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Radiant" }] }),
  component: UserHome,
});

// ─────────────────────────────────────────────────────────────
// Collector data — player workflows, not platform metrics
const player = {
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

// 1. Continue where I left off
const continueItems = [
  {
    id: "c1",
    kind: "hunt",
    title: "Gengar ex hunt",
    sub: "Triumphant Light · 72% progress",
    status: "in-progress",
    cta: "Resume",
    to: "/hunts",
  },
  {
    id: "c2",
    kind: "trade",
    title: "Trade with Mika",
    sub: "Blastoise ex ↔ Snorlax · awaiting your confirmation",
    status: "waiting-for-user",
    cta: "Review",
    to: "/trades",
  },
  {
    id: "c3",
    kind: "gift",
    title: "3 gifts to claim",
    sub: "Hana, Daichi, Yui sent today",
    status: "ready-to-send",
    cta: "Claim all",
    to: "/gifts",
  },
  {
    id: "c4",
    kind: "flair",
    title: "Charizard Gold Flair request",
    sub: "Mint ready · waiting for you to approve",
    status: "ready-to-send",
    cta: "Approve",
    to: "/gold-flair",
  },
  {
    id: "c5",
    kind: "mission",
    title: "Daily missions — 2 of 4",
    sub: "Trade + Gift remaining",
    status: "in-progress",
    cta: "Continue",
    to: "/missions",
  },
];

const kindMeta = {
  hunt:    { icon: Crosshair, color: "text-warning bg-warning/10 border-warning/20" },
  trade:   { icon: Repeat2,   color: "text-primary bg-primary/10 border-primary/20" },
  gift:    { icon: Gift,      color: "text-success bg-success/10 border-success/20" },
  flair:   { icon: Gem,       color: "text-warning bg-warning/10 border-warning/20" },
  mission: { icon: Target,    color: "text-primary bg-primary/10 border-primary/20" },
} as const;

const statusMeta: Record<string, { label: string; cls: string }> = {
  "ready-to-send":      { label: "Ready",            cls: "bg-success/15 text-success border-success/30" },
  "waiting-for-user":   { label: "Waiting for you",  cls: "bg-warning/15 text-warning border-warning/30" },
  "in-progress":        { label: "In progress",      cls: "bg-primary/15 text-primary border-primary/30" },
  "needs-mint":         { label: "Needs mint",       cls: "bg-warning/15 text-warning border-warning/30" },
  "low-stock":          { label: "Low stock",        cls: "bg-warning/15 text-warning border-warning/30" },
  "completed":          { label: "Completed",        cls: "bg-success/15 text-success border-success/30" },
};

// 2. Collection goals
const setProgress = [
  { name: "Triumphant Light",     owned: 118, total: 120, missing: 2,  highlight: "Mew ex, Rayquaza Crown" },
  { name: "Space-Time Smackdown", owned: 92,  total: 108, missing: 16, highlight: "Lugia Crown +15" },
  { name: "Mythical Island",      owned: 84,  total: 86,  missing: 2,  highlight: "Mew, Articuno ex" },
  { name: "Genetic Apex",         owned: 226, total: 286, missing: 60, highlight: "Charizard ex +59" },
];

// 3. Recommended actions
const recommended = [
  { id: "r1", kind: "hunt",  title: "Join Mew ex community hunt",       reward: "Crown · 1/480 odds",       cta: "Join hunt"   },
  { id: "r2", kind: "trade", title: "Trade your Snorlax for Blastoise ex", reward: "+58 collection value",  cta: "Open trade"  },
  { id: "r3", kind: "gift",  title: "Claim 3 daily gifts",               reward: "Earn 75 Gold Flair",      cta: "Claim"       },
  { id: "r4", kind: "flair", title: "Charizard Gold Flair available",    reward: "Stock: 8 remaining",      cta: "Request"     },
  { id: "r5", kind: "mission", title: "Finish today's missions",         reward: "+150 XP, 25 Gold Flair",  cta: "Continue"    },
];

// 4. Latest expansion spotlight
const latestExpansion = {
  code: "TRL",
  name: "Triumphant Light",
  tagline: "New chase cards. Limited window. Community hunts now live.",
  joined: 12420,
  newCount: 4,
  featured: [
    { name: "Mew ex",       rarity: "Crown",     accent: "from-yellow-400/50 to-orange-600/20" },
    { name: "Gengar ex",    rarity: "Immersive", accent: "from-purple-500/50 to-fuchsia-700/20" },
    { name: "Lugia Crown",  rarity: "Crown",     accent: "from-sky-400/50 to-indigo-700/20" },
    { name: "Solar Crown",  rarity: "Star",      accent: "from-amber-400/50 to-red-600/20" },
  ],
};

// 5. Missing card discovery
const missingDiscovery = [
  { name: "Mew ex",       set: "Triumphant Light",     odds: "1 / 480", hunts: 32, trades: 4, popularity: 98 },
  { name: "Rayquaza",     set: "Space-Time Smackdown", odds: "1 / 120", hunts: 19, trades: 7, popularity: 91 },
  { name: "Greninja ex",  set: "Genetic Apex",         odds: "1 / 90",  hunts: 11, trades: 12, popularity: 78 },
];

// 6. Gold Flair Center
const flairCenter = {
  balance: 1284,
  ready:       [{ name: "Charizard",     when: "Ready now" }, { name: "Pikachu Promo", when: "Ready now" }],
  preparing:   [{ name: "Mewtwo ex",     when: "~14 min" }, { name: "Articuno ex",   when: "~38 min" }],
  lowStock:    [{ name: "Gengar ex",     when: "3 mints left" }],
  completed:   [{ name: "Snorlax",       when: "Sent 2h ago" }, { name: "Eevee",     when: "Sent yesterday" }],
};

// 7. Friends activity (expanded)
const friendsActivity = [
  { name: "Mika",   action: "pulled Charizard ex",        when: "3m",  tag: "pull"  },
  { name: "Hana",   action: "sent you a gift",            when: "18m", tag: "gift"  },
  { name: "Daichi", action: "wants to trade Snorlax",     when: "1h",  tag: "trade" },
  { name: "Yui",    action: "completed Triumphant Light", when: "2h",  tag: "set"   },
  { name: "Ren",    action: "joined Mew ex hunt",         when: "3h",  tag: "hunt"  },
  { name: "Sora",   action: "earned Gold Flair: Pikachu", when: "5h",  tag: "flair" },
];

// ─────────────────────────────────────────────────────────────
function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function TileHeader({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
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
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}

function UserHome() {
  const xpPct = Math.round((player.xpInLevel / player.xpToNext) * 100);
  const staminaPct = Math.round((player.staminaNow / player.staminaMax) * 100);
  const waitingCount = continueItems.filter((c) => c.status === "waiting-for-user" || c.status === "ready-to-send").length;

  return (
    <div className="space-y-6 pb-12">
      {/* ─────────────────── HERO ─────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/40 to-background p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-warning/20 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" />{player.streakDays}-day streak</span>
              {waitingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-warning">
                  <Bell className="h-3 w-3" /> {waitingCount} waiting for you
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Welcome back, {player.name}.
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground md:text-base">
              You're <span className="font-semibold text-foreground">2 cards away</span> from completing
              Triumphant Light, and <span className="font-semibold text-warning">4 actions</span> are waiting on you.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link to="/hunts" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_var(--primary)] transition-transform hover:-translate-y-0.5">
                <PlayCircle className="h-4 w-4" /> Resume Gengar ex hunt
              </Link>
              <Link to="/open-pack" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card">
                <Sparkles className="h-4 w-4" /> Open today's pack
              </Link>
              <Link to="/gifts" className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success hover:bg-success/15">
                <Gift className="h-4 w-4" /> Claim 3 gifts
              </Link>
            </div>
          </div>

          {/* Player ring */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Level</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">{player.level}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${xpPct}%` }} />
              </div>
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
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div className="h-full rounded-full bg-success" style={{ width: `${staminaPct}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/15 to-transparent p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">Gold Flair</p>
                <Gem className="h-3.5 w-3.5 text-warning" />
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{player.goldFlair.toLocaleString()}</p>
              <Link to="/gold-flair" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning hover:underline">
                Spend now <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── 1. CONTINUE WHERE I LEFT OFF ─────────────────── */}
      <Tile>
        <TileHeader
          icon={Inbox}
          title="Continue where you left off"
          subtitle="Pick up active hunts, trades, gifts, and Gold Flair"
          action={<span className="text-[11px] font-semibold text-muted-foreground">{continueItems.length} open</span>}
        />
        <div className="grid gap-2 md:grid-cols-2">
          {continueItems.map((c) => {
            const meta = kindMeta[c.kind as keyof typeof kindMeta];
            const Icon = meta.icon;
            return (
              <Link
                key={c.id}
                to={c.to}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30 hover:bg-card/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${meta.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
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

      {/* ─────────────────── 4. LATEST EXPANSION SPOTLIGHT ─────────────────── */}
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
              <Link to="/cards" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card">
                Browse the set
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {latestExpansion.featured.map((c) => (
              <div key={c.name} className={`relative aspect-[3/4] overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br ${c.accent} p-2.5`}>
                <span className="inline-flex w-fit items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
                  <Star className="h-2.5 w-2.5" /> {c.rarity}
                </span>
                <p className="absolute inset-x-2.5 bottom-2 font-display text-[11px] font-bold leading-tight text-foreground drop-shadow">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── Body grid ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* 2. COLLECTION GOALS */}
          <Tile>
            <TileHeader
              icon={Trophy}
              title="Collection goals"
              subtitle="Sets closest to completion"
              action={<Link to="/cards" className="text-xs font-semibold text-primary hover:underline">All sets →</Link>}
            />
            <div className="space-y-3">
              {setProgress.map((s) => {
                const pct = Math.round((s.owned / s.total) * 100);
                const near = pct >= 95;
                return (
                  <div key={s.name} className="rounded-xl border border-border/60 bg-background/40 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-display text-sm font-semibold text-foreground">{s.name}</p>
                          {near && (
                            <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">Almost done</span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Missing: {s.highlight}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-foreground">{pct}%</p>
                        <p className="text-[10px] text-muted-foreground">{s.owned}/{s.total}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div className={`h-full rounded-full ${near ? "bg-gradient-to-r from-success to-success/60" : "bg-gradient-to-r from-primary to-primary/50"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{s.missing} card{s.missing === 1 ? "" : "s"} to go</span>
                      <Link to="/wishlist" className="font-semibold text-primary hover:underline">View missing →</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Tile>

          {/* 3. RECOMMENDED ACTIONS */}
          <Tile>
            <TileHeader
              icon={Zap}
              title="Recommended for you"
              subtitle="Best next actions for your collection right now"
            />
            <ul className="space-y-2">
              {recommended.map((r) => {
                const meta = kindMeta[r.kind as keyof typeof kindMeta];
                const Icon = meta.icon;
                return (
                  <li key={r.id} className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30 hover:bg-card/60">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.reward}</p>
                      </div>
                    </div>
                    <button className="shrink-0 rounded-lg bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary">
                      {r.cta}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Tile>

          {/* 5. MISSING CARD DISCOVERY */}
          <Tile>
            <TileHeader
              icon={Search}
              title="Popular missing cards"
              subtitle="Most-hunted cards you don't own yet"
              action={<Link to="/wishlist" className="text-xs font-semibold text-primary hover:underline">All gaps →</Link>}
            />
            <div className="space-y-2">
              {missingDiscovery.map((m) => (
                <div key={m.name} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                  <div className="grid h-12 w-9 shrink-0 place-items-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                    <Star className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">{m.odds}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{m.set}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 text-warning" /> {m.popularity}% popular</span>
                      <span>{m.hunts} active hunts</span>
                      <span>{m.trades} trade offers</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Link to="/hunts" className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-warning hover:bg-warning/20">
                      Hunt
                    </Link>
                    <Link to="/trades" className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20">
                      Trade
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Tile>

          {/* 6. GOLD FLAIR CENTER */}
          <Tile>
            <TileHeader
              icon={Gem}
              title="Gold Flair center"
              subtitle={`Balance: ${flairCenter.balance.toLocaleString()} · ready, preparing, low stock`}
              action={<Link to="/gold-flair" className="text-xs font-semibold text-warning hover:underline">Open center →</Link>}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-success/30 bg-success/5 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-success">
                  <CheckCircle2 className="h-3 w-3" /> Ready ({flairCenter.ready.length})
                </p>
                <ul className="space-y-1.5">
                  {flairCenter.ready.map((i) => (
                    <li key={i.name} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{i.name}</span>
                      <span className="text-[10px] text-success">{i.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Clock className="h-3 w-3" /> Preparing ({flairCenter.preparing.length})
                </p>
                <ul className="space-y-1.5">
                  {flairCenter.preparing.map((i) => (
                    <li key={i.name} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{i.name}</span>
                      <span className="text-[10px] text-muted-foreground">{i.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                  <Bell className="h-3 w-3" /> Low stock ({flairCenter.lowStock.length})
                </p>
                <ul className="space-y-1.5">
                  {flairCenter.lowStock.map((i) => (
                    <li key={i.name} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{i.name}</span>
                      <span className="text-[10px] text-warning">{i.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Package className="h-3 w-3" /> Recently completed
                </p>
                <ul className="space-y-1.5">
                  {flairCenter.completed.map((i) => (
                    <li key={i.name} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{i.name}</span>
                      <span className="text-[10px] text-muted-foreground">{i.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Tile>
        </div>

        {/* RIGHT RAIL */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Daily missions */}
          <Tile>
            <TileHeader icon={Calendar} title="Today" subtitle="Resets in 7h 24m" />
            <ul className="space-y-2.5">
              {[
                { label: "Open 2 packs",           done: 2, total: 2 },
                { label: "Win a Wonder Pick",      done: 1, total: 1 },
                { label: "Send a gift to a friend",done: 0, total: 1 },
                { label: "Complete 1 trade",       done: 0, total: 2 },
              ].map((t, i) => {
                const done = t.done >= t.total;
                return (
                  <li key={i} className="flex items-center gap-3">
                    <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${done ? "border-success bg-success/20 text-success" : "border-border bg-background/60 text-muted-foreground"}`}>
                      {done ? "✓" : ""}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.label}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/40">
                        <div className={`h-full ${done ? "bg-success" : "bg-primary"}`} style={{ width: `${(t.done / t.total) * 100}%` }} />
                      </div>
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

          {/* 7. Expanded friends activity */}
          <Tile>
            <TileHeader
              icon={Heart}
              title="Friend activity"
              subtitle="Live feed"
              action={<Link to="/friends" className="text-xs font-semibold text-primary hover:underline">All →</Link>}
            />
            <ul className="space-y-3">
              {friendsActivity.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 text-[11px] font-bold text-foreground">
                    {f.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground">
                      <span className="font-semibold">{f.name}</span>{" "}
                      <span className="text-muted-foreground">{f.action}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">{f.when} ago</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </li>
              ))}
            </ul>
            <button className="mt-3 w-full rounded-lg border border-border bg-card/60 py-1.5 text-[11px] font-semibold text-foreground hover:bg-card">
              Load more activity
            </button>
          </Tile>

          {/* Quick links */}
          <Tile className="bg-gradient-to-br from-card/40 to-primary/5">
            <p className="font-display text-sm font-semibold text-foreground">Jump back in</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { to: "/trades",     label: "Trades",     icon: Repeat2 },
                { to: "/gifts",      label: "Gifts",      icon: Gift },
                { to: "/collection-missions", label: "Missions", icon: Target },
                { to: "/wonder-pick", label: "Wonder Pick", icon: Sparkles },
              ].map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-card/60"
                >
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
