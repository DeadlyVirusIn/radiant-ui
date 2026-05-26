import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, ArrowUpRight, Bell, Calendar, Flame, Gem, Gift, Heart,
  Package, PlayCircle, Sparkles, Star, Store, Target, Trophy, Users,
} from "lucide-react";

import { CardArt, energy, type EnergyType } from "@/components/home/CardArt";
import { WaitingForYou } from "@/components/home/WaitingForYou";
import { ActiveHuntSummary } from "@/components/home/ActiveHuntSummary";
import { MarketplacePreview } from "@/components/home/MarketplacePreview";
import { PLAYER, ACTIVE_HUNT, WAITING_ITEMS } from "@/lib/mock-home";
import { FEATURED_CARD_REQUESTS } from "@/lib/mock-card-requests";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Home — Radiant" }] }),
  component: UserHome,
});

// ─────────────────────────────────────────────────────────────
// In-file fixtures kept per approved blueprint modification #1:
// these stay sourced here until their owning page ships a canonical mock.

const setProgress = [
  { name: "Triumphant Light",     owned: 118, total: 120, missing: 2,  highlight: "Mew ex, Rayquaza Crown", type: "psychic"   as EnergyType },
  { name: "Mythical Island",      owned: 84,  total: 86,  missing: 2,  highlight: "Mew, Articuno ex",       type: "water"     as EnergyType },
  { name: "Space-Time Smackdown", owned: 92,  total: 108, missing: 16, highlight: "Lugia Crown +15",        type: "lightning" as EnergyType },
  { name: "Genetic Apex",         owned: 226, total: 286, missing: 60, highlight: "Charizard ex +59",       type: "fire"      as EnergyType },
];

const wishlist = [
  { name: "Mew ex",       set: "Triumphant Light",     type: "psychic"   as EnergyType, rarity: "Crown"     as const, routeLabel: "Hunt at 12%",         progress: 12, sub: "4,200 pulls to expected" },
  { name: "Blastoise ex", set: "Genetic Apex",         type: "water"     as EnergyType, rarity: "EX"        as const, routeLabel: "Trade with Mika",     progress: 80, sub: "Waiting for your reply" },
  { name: "Lugia Crown",  set: "Space-Time Smackdown", type: "lightning" as EnergyType, rarity: "Crown"     as const, routeLabel: "Hunt at 41%",         progress: 41, sub: "~2 days to expected" },
  { name: "Charizard",    set: "Genetic Apex",         type: "fire"      as EnergyType, rarity: "Immersive" as const, routeLabel: "Mint via Gold Flair", progress: 95, sub: "Ready · 1,284 flair on hand" },
];

const recentPulls = [
  { name: "Mewtwo ex",   set: "Genetic Apex",    rarity: "Crown"     as const, type: "psychic"   as EnergyType, when: "2h ago" },
  { name: "Charizard",   set: "Genetic Apex",    rarity: "Immersive" as const, type: "fire"      as EnergyType, when: "5h ago" },
  { name: "Pikachu",     set: "Promo-A",         rarity: "Full Art"  as const, type: "lightning" as EnergyType, when: "Yesterday" },
  { name: "Articuno ex", set: "Mythical Island", rarity: "Star"      as const, type: "water"     as EnergyType, when: "Yesterday" },
  { name: "Greninja",    set: "Genetic Apex",    rarity: "Full Art"  as const, type: "water"     as EnergyType, when: "2d ago" },
];

const latestExpansion = {
  code: "TRL", name: "Triumphant Light",
  tagline: "New chase cards. Limited window. Community hunts now live.",
  joined: 12420, newCount: 4,
  featured: [
    { name: "Mew ex",      rarity: "Crown"     as const, type: "psychic"   as EnergyType },
    { name: "Gengar ex",   rarity: "Immersive" as const, type: "psychic"   as EnergyType },
    { name: "Lugia Crown", rarity: "Crown"     as const, type: "lightning" as EnergyType },
    { name: "Solar Crown", rarity: "Star"      as const, type: "fire"      as EnergyType },
  ],
};

const friendsActivity = [
  { name: "Mika",   action: "pulled Charizard ex",        when: "3m"  },
  { name: "Hana",   action: "sent you a gift",            when: "18m" },
  { name: "Daichi", action: "wants to trade Snorlax",     when: "1h"  },
  { name: "Yui",    action: "completed Triumphant Light", when: "2h"  },
  { name: "Ren",    action: "joined Mew ex hunt",         when: "3h"  },
];

// ─────────────────────────────────────────────────────────────
function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm ${className}`}>{children}</div>;
}

function TileHeader({ icon: Icon, title, subtitle, action }: {
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

function UserHome() {
  const xpPct = Math.round((PLAYER.xpInLevel / PLAYER.xpToNext) * 100);
  const staminaPct = Math.round((PLAYER.staminaNow / PLAYER.staminaMax) * 100);
  const waiting = WAITING_ITEMS.filter((c) => c.urgency >= 1).length;

  return (
    <div className="space-y-6 pb-12">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card/40 to-background p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-warning/20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <span className="inline-flex items-center gap-1.5"><Flame className="h-3.5 w-3.5" />{PLAYER.streakDays}-day streak</span>
              {waiting > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-0.5 text-warning">
                  <Bell className="h-3 w-3" /> {waiting} waiting for you
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Welcome back, {PLAYER.name}.</h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground md:text-base">
              You're <span className="font-semibold text-foreground">2 cards away</span> from completing Triumphant Light.{" "}
              <span className="text-warning">{waiting} actions</span> are waiting on you.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link to="/open-pack" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_var(--primary)] transition-transform hover:-translate-y-0.5">
                <PlayCircle className="h-4 w-4" /> Open today's pack
              </Link>
              <Link to="/card-request" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-card">
                <Store className="h-4 w-4" /> Browse marketplace
              </Link>
              <Link to="/hunt" className="inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm font-semibold text-warning hover:bg-warning/15">
                <PlayCircle className="h-4 w-4" /> Resume hunt
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Level</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">{PLAYER.level}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${xpPct}%` }} /></div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">{PLAYER.xpInLevel}/{PLAYER.xpToNext} XP</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Collection</p>
              <p className="mt-1 font-display text-3xl font-bold text-foreground">{PLAYER.collectionPct}%</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{PLAYER.ownedCards.toLocaleString()} / {PLAYER.totalCards.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Stamina</p>
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{PLAYER.staminaNow}<span className="text-base text-muted-foreground">/{PLAYER.staminaMax}</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-success" style={{ width: `${staminaPct}%` }} /></div>
            </div>
            <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/15 to-transparent p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">Gold Flair</p>
                <Gem className="h-3.5 w-3.5 text-warning" />
              </div>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">{PLAYER.goldFlair.toLocaleString()}</p>
              <Link to="/gold-flair" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning hover:underline">Spend now <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* WAITING FOR YOU — replaces Continue + Intelligence + Daily tasks */}
      <WaitingForYou items={WAITING_ITEMS} />

      {/* COLLECTION SNAPSHOT */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/30 to-background p-6 md:p-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <Trophy className="h-3.5 w-3.5" /> My collection progress
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {PLAYER.collectionPct}% complete · {(PLAYER.totalCards - PLAYER.ownedCards).toLocaleString()} cards to go
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Two sets are within reach this week.</p>
          </div>
          <Link to="/cards" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-card">
            Open collection <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* ACTIVE HUNT — compact summary */}
      <ActiveHuntSummary hunt={ACTIVE_HUNT} />

      {/* WISHLIST PREVIEW */}
      <Tile>
        <TileHeader
          icon={Heart}
          title="Wishlist progress"
          subtitle="The fastest path to every card you want"
          action={<Link to="/wishlist" className="text-xs font-semibold text-primary hover:underline">Manage wishlist →</Link>}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {wishlist.map((w) => (
            <div key={w.name} className="flex gap-3 rounded-2xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/40">
              <div className="w-20 shrink-0">
                <CardArt name={w.name} set={w.set} type={w.type} rarity={w.rarity} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate font-display text-sm font-semibold text-foreground">{w.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{w.set}</p>
                <p className="mt-1.5 truncate text-[11px] font-semibold text-foreground">{w.routeLabel}</p>
                <p className="truncate text-[10px] text-muted-foreground">{w.sub}</p>
                <div className="mt-auto pt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-warning" style={{ width: `${w.progress}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Tile>

      {/* MARKETPLACE PREVIEW */}
      <MarketplacePreview requests={FEATURED_CARD_REQUESTS} />

      {/* BODY GRID — Latest pulls + right rail */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
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

          {/* LATEST EXPANSION */}
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
                  <Link to="/hunt" className="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-sm font-semibold text-warning-foreground hover:bg-warning/90">
                    <Calendar className="h-4 w-4" /> Open hunt monitor
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
        </div>

        {/* RIGHT RAIL — Friend activity only */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
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
                { to: "/trades" as const,             label: "Trades",      icon: Repeat2Icon },
                { to: "/presents" as const,           label: "Presents",    icon: Gift },
                { to: "/missions" as const,           label: "Missions",    icon: Target },
                { to: "/wonder-pick" as const,        label: "Wonder Pick", icon: Sparkles },
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

// local alias to avoid double-import noise
import { Repeat2 as Repeat2Icon } from "lucide-react";
