import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Crosshair,
  Flame,
  Gem,
  Gift,
  Heart,
  Package,
  Repeat2,
  Search,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Radiant" }] }),
  component: UserHome,
});

// ─────────────────────────────────────────────────────────────
// User-facing data: collector, not operator
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

const dailyTasks = [
  { id: 1, label: "Open 2 packs",            done: 2, total: 2 },
  { id: 2, label: "Win a Wonder Pick",        done: 1, total: 1 },
  { id: 3, label: "Send a gift to a friend",  done: 0, total: 1 },
  { id: 4, label: "Complete 1 trade",         done: 0, total: 2 },
];

const recentPulls = [
  { id: "p1", name: "Mewtwo ex",       set: "Genetic Apex",  rarity: "Crown",     pulled: "2h ago", accent: "from-yellow-500/40 to-amber-700/20" },
  { id: "p2", name: "Charizard",        set: "Genetic Apex",  rarity: "Immersive", pulled: "5h ago", accent: "from-orange-500/40 to-red-700/20" },
  { id: "p3", name: "Pikachu",          set: "Promo-A",       rarity: "Full Art",  pulled: "Yesterday", accent: "from-yellow-300/40 to-yellow-600/10" },
  { id: "p4", name: "Articuno ex",      set: "Mythical Island", rarity: "Star",    pulled: "Yesterday", accent: "from-sky-400/40 to-indigo-700/20" },
];

const activeHunts = [
  { id: "h1", target: "Gengar ex",        set: "Triumphant Light",  progress: 72, eta: "ready soon" },
  { id: "h2", target: "Lugia Crown",      set: "Space-Time Smackdown", progress: 41, eta: "~2 days" },
];

const recommended = [
  { id: "r1", kind: "trade",  title: "Trade your Snorlax for Blastoise ex", with: "Mika", value: "+58 collection value" },
  { id: "r2", kind: "gift",   title: "Send a daily gift to Hana",            with: "10-day mutual streak", value: "Earn 25 Gold Flair" },
  { id: "r3", kind: "hunt",   title: "Hunt Mew ex — only 2 missing in set",  with: "Triumphant Light",  value: "Completes 3 collections" },
];

const missingHighlights = [
  { name: "Mew ex",         set: "Triumphant Light",     odds: "1 / 480", tag: "Crown" },
  { name: "Rayquaza",       set: "Space-Time Smackdown", odds: "1 / 120", tag: "Immersive" },
  { name: "Greninja ex",    set: "Genetic Apex",         odds: "1 / 90",  tag: "Star" },
];

const friendsActivity = [
  { name: "Mika",   action: "pulled Charizard ex",   when: "3m" },
  { name: "Hana",   action: "sent you a gift",       when: "18m" },
  { name: "Daichi", action: "wants to trade Snorlax",when: "1h" },
];

// ─────────────────────────────────────────────────────────────
// Small primitives — softer, card-game flavored (distinct from admin grid)
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

function UserHome() {
  const xpPct = Math.round((player.xpInLevel / player.xpToNext) * 100);
  const staminaPct = Math.round((player.staminaNow / player.staminaMax) * 100);

  return (
    <div className="space-y-6 pb-12">
      {/* ─────────────────── HERO — Welcome back ─────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/40 to-background p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-warning/20 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Flame className="h-3.5 w-3.5" />
              {player.streakDays}-day streak · keep it alive
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Welcome back, {player.name}.
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground md:text-base">
              You're <span className="font-semibold text-foreground">2 cards away</span> from completing
              Triumphant Light. Want to keep hunting?
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link to="/open-pack" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_var(--primary)] transition-transform hover:-translate-y-0.5">
                <Sparkles className="h-4 w-4" /> Open today's pack
              </Link>
              <Link to="/hunts" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card">
                <Crosshair className="h-4 w-4" /> Resume hunts
              </Link>
              <Link to="/wishlist" className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                <Heart className="h-4 w-4" /> Wishlist
              </Link>
            </div>
          </div>

          {/* Player stat ring */}
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
              <p className="mt-1 text-[11px] text-muted-foreground">{player.ownedCards.toLocaleString()} / {player.totalCards.toLocaleString()} cards</p>
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

      {/* ─────────────────── Body grid ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* LEFT — discovery */}
        <div className="space-y-6">
          {/* Latest pulls */}
          <Tile>
            <TileHeader
              icon={Package}
              title="Latest pulls"
              subtitle="Your most recent cards"
              action={<Link to="/cards" className="text-xs font-semibold text-primary hover:underline">View all →</Link>}
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {recentPulls.map((c) => (
                <Link
                  key={c.id}
                  to="/cards"
                  className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br p-3 transition-transform hover:-translate-y-1 hover:border-primary/40"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.accent} opacity-80`} />
                  <div className="relative flex h-full flex-col justify-between">
                    <span className="inline-flex w-fit items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
                      <Star className="h-2.5 w-2.5" /> {c.rarity}
                    </span>
                    <div>
                      <p className="font-display text-sm font-bold text-foreground drop-shadow">{c.name}</p>
                      <p className="text-[10px] text-foreground/70">{c.set}</p>
                      <p className="mt-0.5 text-[10px] text-foreground/60">{c.pulled}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Tile>

          {/* Recommended for you */}
          <Tile>
            <TileHeader
              icon={Sparkles}
              title="Recommended for you"
              subtitle="Smart actions tailored to your collection"
            />
            <ul className="space-y-2">
              {recommended.map((r) => {
                const map = {
                  trade: { icon: Repeat2,    chip: "Trade", color: "text-primary bg-primary/10 border-primary/20" },
                  gift:  { icon: Gift,       chip: "Gift",  color: "text-success bg-success/10 border-success/20" },
                  hunt:  { icon: Crosshair,  chip: "Hunt",  color: "text-warning bg-warning/10 border-warning/20" },
                }[r.kind as "trade" | "gift" | "hunt"];
                const Icon = map.icon;
                return (
                  <li key={r.id} className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30 hover:bg-card/60">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${map.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.with} · <span className="text-foreground/80">{r.value}</span></p>
                      </div>
                    </div>
                    <button className="shrink-0 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-foreground opacity-80 transition-opacity hover:opacity-100">
                      Do it
                    </button>
                  </li>
                );
              })}
            </ul>
          </Tile>

          {/* Active hunts (player perspective, friendly) */}
          <Tile>
            <TileHeader
              icon={Crosshair}
              title="Your hunts"
              subtitle="Cards being chased for you"
              action={<Link to="/hunts" className="text-xs font-semibold text-primary hover:underline">Manage →</Link>}
            />
            <div className="grid gap-3 md:grid-cols-2">
              {activeHunts.map((h) => (
                <div key={h.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-sm font-semibold text-foreground">{h.target}</p>
                      <p className="text-[11px] text-muted-foreground">{h.set}</p>
                    </div>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{h.eta}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/50" style={{ width: `${h.progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{h.progress}% · hunt in progress</p>
                </div>
              ))}
            </div>
          </Tile>

          {/* Missing cards — discovery */}
          <Tile>
            <TileHeader
              icon={Search}
              title="Still missing"
              subtitle="Closest to completing a set"
              action={<Link to="/wishlist" className="text-xs font-semibold text-primary hover:underline">See all gaps →</Link>}
            />
            <ul className="divide-y divide-border/60">
              {missingHighlights.map((m) => (
                <li key={m.name} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-7 place-items-center rounded-md border border-dashed border-border bg-background/40 text-muted-foreground">
                      <Star className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">{m.set}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-mono text-[11px] text-muted-foreground">{m.odds}</span>
                    <Link to="/hunts" className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20">
                      Hunt
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Tile>
        </div>

        {/* RIGHT — daily engagement rail */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Daily tasks */}
          <Tile>
            <TileHeader icon={Calendar} title="Today" subtitle="Resets in 7h 24m" />
            <ul className="space-y-2.5">
              {dailyTasks.map((t) => {
                const done = t.done >= t.total;
                return (
                  <li key={t.id} className="flex items-center gap-3">
                    <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${done ? "border-success bg-success/20 text-success" : "border-border bg-background/60 text-muted-foreground"}`}>
                      {done ? "✓" : ""}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-medium ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.label}</p>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/40">
                        <div className={`h-full ${done ? "bg-success" : "bg-primary"}`} style={{ width: `${(t.done / t.total) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-mono text-[10px] text-muted-foreground">{t.done}/{t.total}</span>
                  </li>
                );
              })}
            </ul>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-card">
              <Trophy className="h-3.5 w-3.5 text-warning" /> Claim 75 XP
            </button>
          </Tile>

          {/* Friends activity */}
          <Tile>
            <TileHeader
              icon={Heart}
              title="From your friends"
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
                      <span className="font-semibold">{f.name}</span> <span className="text-muted-foreground">{f.action}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">{f.when} ago</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </li>
              ))}
            </ul>
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
