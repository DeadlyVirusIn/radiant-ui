import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Crown, Medal, Swords, History, BarChart3, Sparkles, Trophy,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RingGauge } from "@/components/app-shell/RingGauge";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pvp")({
  head: () => ({ meta: [{ title: "PvP rankings — Radiant" }] }),
  component: PvpPage,
});

type Tier = "Master" | "Diamond" | "Platinum" | "Gold" | "Silver" | "Bronze";

const TIER_STYLE: Record<Tier, string> = {
  Master:   "bg-warning/15 text-warning",
  Diamond:  "bg-primary/15 text-primary",
  Platinum: "bg-primary/15 text-primary",
  Gold:     "bg-warning/15 text-warning",
  Silver:   "bg-muted text-muted-foreground",
  Bronze:   "bg-muted text-muted-foreground",
};

const ladder: Array<{ rank: number; name: string; rating: number; tier: Tier; you?: boolean }> = [
  { rank: 1,    name: "DeepCurrent", rating: 2840, tier: "Master" },
  { rank: 2,    name: "Halcyon77",   rating: 2792, tier: "Master" },
  { rank: 3,    name: "Aurora-X",    rating: 2754, tier: "Master" },
  { rank: 4,    name: "VantaPrime",  rating: 2701, tier: "Diamond" },
  { rank: 5,    name: "EmberFox",    rating: 2688, tier: "Diamond" },
  { rank: 6,    name: "Solace.JP",   rating: 2654, tier: "Diamond" },
  { rank: 1284, name: "You",         rating: 1824, tier: "Gold", you: true },
];

const YOU = { rank: 1284, rating: 1824, tier: "Gold" as Tier, toNext: 176, nextTier: "Platinum" as const };

function PvpPage() {
  const pctToNext = useMemo(() => {
    const span = 200; // notional points per tier band
    return Math.max(0, Math.min(100, Math.round(((span - YOU.toNext) / span) * 100)));
  }, []);

  return (
    <>
      <PageHeader
        title="PvP rankings"
        description="Live ladder, your placement, and the climb to the next tier."
      />

      <Hero
        eyebrow="Next tier"
        eyebrowIcon={Crown}
        title={`${YOU.toNext} points to ${YOU.nextTier}`}
        subtitle={`You're rank #${YOU.rank.toLocaleString()} in ${YOU.tier} — about ${Math.ceil(YOU.toNext / 14)} ranked wins away.`}
        right={<RingGauge pct={pctToNext} label={`${pctToNext}%`} sublabel={`to ${YOU.nextTier}`} />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <ProgressBar done={200 - YOU.toNext} total={200} tone="primary" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <RewardChip kind="pack" label="Tier-up pack" />
            <span>awarded when you reach {YOU.nextTier}.</span>
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Your rank"     value={`#${YOU.rank.toLocaleString()}`} icon={Medal}  tone="primary" />
        <StatCard label="Rating"        value={YOU.rating.toLocaleString()}     tone="success" delta={{ value: "+38", direction: "up" }} />
        <StatCard label="Tier"          value={`${YOU.tier} I`}                 icon={Crown}  tone="warning" />
        <StatCard label={`To ${YOU.nextTier}`} value={`${YOU.toNext} pts`}      icon={Trophy} />
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card/60">
        <header className="border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">Top of ladder</h2>
        </header>
        <ul className="divide-y divide-border">
          {ladder.map((r) => (
            <li
              key={r.rank}
              className={cn(
                "flex items-center gap-3 px-5 py-3",
                r.you ? "bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <span className="text-mono w-12 shrink-0 text-sm font-semibold">
                {r.rank > 999 ? `#${r.rank.toLocaleString()}` : `#${r.rank}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {r.name}
                {r.you && <span className="ml-1 text-[10px] uppercase text-primary">You</span>}
              </span>
              <Badge variant="outline" className={cn(
                "h-5 border-transparent text-[10px] uppercase",
                TIER_STYLE[r.tier],
              )}>
                {r.tier}
              </Badge>
              <span className="text-mono w-16 shrink-0 text-right text-sm">
                {r.rating.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <HandoffStrip
          to="/battles"
          icon={Swords}
          tone="primary"
          title="Queue a ranked match"
          hint={`Win 1 to gain ~14 rating, ${Math.ceil(YOU.toNext / 14)} more to hit ${YOU.nextTier}.`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/battle-history" icon={History}    title="Battle history" hint="See your recent climbs and drops." />
        <CrossLink to="/battle-stats"   icon={BarChart3}  title="Battle stats"   hint="Pick your best deck." />
        <CrossLink to="/missions"       icon={Sparkles}   title="Missions"       hint="Wins push daily missions." />
      </div>
    </>
  );
}
