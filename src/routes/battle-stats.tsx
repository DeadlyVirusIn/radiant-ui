import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Trophy, BarChart3, Swords, History, Crown, Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RingGauge } from "@/components/app-shell/RingGauge";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/battle-stats")({
  head: () => ({ meta: [{ title: "Battle stats — Radiant" }] }),
  component: BattleStatsPage,
});

type Row = { label: string; wins: number; total: number };

const BY_MODE: Row[] = [
  { label: "Solo ranked", wins: 148, total: 200 },
  { label: "Event",       wins: 32,  total: 47 },
  { label: "Casual",      wins: 28,  total: 39 },
];

const BY_DECK: Row[] = [
  { label: "Aurora Mid",      wins: 48, total: 61 },
  { label: "Vanta Aggro",     wins: 35, total: 48 },
  { label: "Halcyon Control", wins: 21, total: 33 },
];

function pct(r: Row) { return r.total === 0 ? 0 : Math.round((r.wins / r.total) * 100); }

function BattleStatsPage() {
  const best = useMemo(() => [...BY_DECK].sort((a, b) => pct(b) - pct(a))[0], []);
  const totalWins = BY_MODE.reduce((s, r) => s + r.wins, 0);
  const totalGames = BY_MODE.reduce((s, r) => s + r.total, 0);
  const overall = Math.round((totalWins / totalGames) * 100);

  return (
    <>
      <PageHeader
        title="Battle stats"
        description="How you're performing — broken down by mode, deck, and the season so far."
      />

      <Hero
        eyebrow="Best deck right now"
        eyebrowIcon={Sparkles}
        title={best.label}
        subtitle={`${pct(best)}% win rate over ${best.total} games — lean into this matchup.`}
        right={<RingGauge pct={pct(best)} label={`${pct(best)}%`} sublabel="Win rate" />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <ProgressBar done={best.wins} total={best.total} tone="success" />
          <div className="mt-2 text-[11px] text-muted-foreground">
            {best.wins} wins · {best.total - best.wins} losses
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Overall win rate" value={`${overall}%`} icon={Trophy}  tone="success" />
        <StatCard label="Games played"     value={String(totalGames)} icon={BarChart3} />
        <StatCard label="Best deck"        value={best.label}    tone="primary" />
        <StatCard label="Comeback wins"    value="22"            tone="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RowList title="By mode" rows={BY_MODE} />
        <RowList title="By deck" rows={BY_DECK} />
      </div>

      <div className="mt-6">
        <HandoffStrip
          to="/battles"
          icon={Swords}
          tone="primary"
          title={`Play another match with ${best.label}`}
          hint="Your strongest deck is also your most-played — keep stacking wins."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/battle-history" icon={History} title="Battle history" hint="Match-by-match results." />
        <CrossLink to="/pvp"            icon={Crown}   title="PvP rankings"   hint="Where you stand on the ladder." />
        <CrossLink to="/missions"       icon={Sparkles} title="Missions"      hint="Battle wins push missions." />
      </div>
    </>
  );
}

function RowList({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="rounded-xl border border-border bg-card/60">
      <header className="border-b border-border px-5 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">{title}</h2>
      </header>
      <div className="space-y-3 p-5">
        {rows.map((r) => {
          const p = pct(r);
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(
                    "h-5 border-transparent text-[10px] font-semibold",
                    p >= 70 ? "bg-success/15 text-success" : p >= 50 ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning",
                  )}>
                    {p}%
                  </Badge>
                  <span className="text-mono text-[11px] text-muted-foreground">
                    {r.wins}/{r.total}
                  </span>
                </div>
              </div>
              <ProgressBar done={r.wins} total={r.total} tone={p >= 70 ? "success" : p >= 50 ? "primary" : "warn"} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
