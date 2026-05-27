import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  History, Trophy, Swords, BarChart3, Crown, Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { RewardKind } from "@/lib/mock-rewards";

export const Route = createFileRoute("/battle-history")({
  head: () => ({ meta: [{ title: "Battle history — Radiant" }] }),
  component: BattleHistoryPage,
});

type Match = {
  id: string;
  mode: "Solo" | "Event" | "Casual";
  opp: string;
  result: "win" | "loss";
  delta: number;
  lengthMins: number;
  whenHours: number;
  reward?: { kind: RewardKind; label: string };
};

const MATCHES: Match[] = Array.from({ length: 14 }).map((_, i) => {
  const win = i % 4 !== 0;
  return {
    id: `B-${5240 - i}`,
    mode: (["Solo", "Event", "Casual"] as const)[i % 3],
    opp: ["Nelle", "Jules", "Arden", "Kiera", "Mara", "Soren"][i % 6],
    result: win ? "win" : "loss",
    delta: win ? 12 + (i % 3) * 2 : -(15 + (i % 3) * 3),
    lengthMins: 3 + (i % 6),
    whenHours: i * 2 + 1,
    reward: win
      ? (i % 3 === 0
          ? { kind: "pack",    label: "1 pack" }
          : i % 3 === 1
            ? { kind: "ticket", label: "+1 ticket" }
            : { kind: "dust",   label: "+20 dust" })
      : undefined,
  };
});

function formatWhen(h: number) {
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function BattleHistoryPage() {
  const [tab, setTab] = useState<"all" | "Solo" | "Event" | "Casual">("all");

  const summary = useMemo(() => {
    const wins = MATCHES.filter((m) => m.result === "win").length;
    const losses = MATCHES.length - wins;
    const rating = MATCHES.reduce((s, m) => s + m.delta, 0);
    const longest = (() => {
      let best = 0, cur = 0;
      for (const m of [...MATCHES].reverse()) {
        if (m.result === "win") { cur += 1; best = Math.max(best, cur); }
        else cur = 0;
      }
      return best;
    })();
    return { wins, losses, rating, longest };
  }, []);

  const last = MATCHES[0];

  const visible = tab === "all" ? MATCHES : MATCHES.filter((m) => m.mode === tab);

  return (
    <>
      <PageHeader
        title="Battle history"
        description="Every match you've played — opponent, result, and the rewards it dropped."
      />

      <Hero
        eyebrow="Last match"
        eyebrowIcon={History}
        title={`${last.result === "win" ? "Win" : "Loss"} vs ${last.opp}`}
        subtitle={`${last.mode} · ${last.lengthMins}m · ${formatWhen(last.whenHours)}`}
        right={<ResultTotem result={last.result} delta={last.delta} />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {last.reward
                ? <RewardChip kind={last.reward.kind} label={last.reward.label} />
                : <span className="text-muted-foreground">No reward this match</span>}
            </div>
            <span className={cn(
              "text-mono text-[11px] font-semibold",
              last.delta > 0 ? "text-success" : "text-destructive",
            )}>
              {last.delta > 0 ? "+" : ""}{last.delta} rating
            </span>
          </div>
          <ProgressBar
            done={summary.wins}
            total={MATCHES.length}
            tone={summary.wins / MATCHES.length > 0.6 ? "success" : "primary"}
          />
          <div className="mt-2 text-[11px] text-muted-foreground">
            {summary.wins}W · {summary.losses}L over your last {MATCHES.length} matches
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Matches"     value={String(MATCHES.length)} icon={History} />
        <StatCard label="Wins"        value={String(summary.wins)}    tone="success" icon={Trophy} />
        <StatCard label="Best streak" value={String(summary.longest)} tone="primary" />
        <StatCard label="Rating Δ"
          value={`${summary.rating > 0 ? "+" : ""}${summary.rating}`}
          tone={summary.rating >= 0 ? "success" : "danger"}
          delta={{ value: `${Math.abs(summary.rating)}`, direction: summary.rating >= 0 ? "up" : "down" }} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="Solo">Solo</TabsTrigger>
          <TabsTrigger value="Event">Event</TabsTrigger>
          <TabsTrigger value="Casual">Casual</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <MatchList items={visible} />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/battles"
          icon={Swords}
          tone="primary"
          title="Queue another match"
          hint="Your win rate is climbing — keep the streak going."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/battle-stats" icon={BarChart3} title="Battle stats"   hint="See your strongest deck." />
        <CrossLink to="/pvp"          icon={Crown}     title="PvP rankings"   hint="Track your ladder climb." />
        <CrossLink to="/missions"     icon={Sparkles}  title="Missions"       hint="Wins push daily missions." />
      </div>
    </>
  );
}

function MatchList({ items }: { items: Match[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No matches in this filter.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div key={m.id} className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border bg-background/30 p-3",
          m.result === "win" ? "border-success/30" : "border-destructive/30",
        )}>
          <Badge variant="outline" className={cn(
            "h-5 border-transparent text-[10px] font-semibold uppercase",
            m.result === "win" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}>
            {m.result}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">vs {m.opp}</div>
            <div className="text-[11px] text-muted-foreground">
              {m.mode} · {m.lengthMins}m · {formatWhen(m.whenHours)}
            </div>
          </div>
          {m.reward && <RewardChip kind={m.reward.kind} label={m.reward.label} />}
          <span className={cn(
            "text-mono text-xs font-semibold w-16 text-right",
            m.delta > 0 ? "text-success" : "text-destructive",
          )}>
            {m.delta > 0 ? "+" : ""}{m.delta}
          </span>
        </div>
      ))}
    </div>
  );
}

function ResultTotem({ result, delta }: { result: "win" | "loss"; delta: number }) {
  const win = result === "win";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "grid h-16 w-16 place-items-center rounded-2xl ring-1",
        win ? "bg-success/15 ring-success/30" : "bg-destructive/15 ring-destructive/30",
      )}>
        <Trophy className={cn("h-7 w-7", win ? "text-success" : "text-destructive")} />
      </div>
      <div className={cn("text-[10px] uppercase tracking-wider font-semibold", win ? "text-success" : "text-destructive")}>
        {delta > 0 ? "+" : ""}{delta}
      </div>
    </div>
  );
}
