import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ListChecks, Flame, Gift, Trophy, Check, Clock, ArrowRight, Sparkles, Star,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Hero } from "@/components/app-shell/Hero";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RingGauge } from "@/components/app-shell/RingGauge";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  MISSIONS, CATEGORY_META,
  getMissionSummary, recommendedNext, sortForDisplay, formatResetChip,
  type Mission, type MissionScope,
} from "@/lib/mock-missions";

export const Route = createFileRoute("/missions")({
  head: () => ({ meta: [{ title: "Missions — Radiant" }] }),
  component: Missions,
});

function Missions() {
  const [missions, setMissions] = useState<Mission[]>(MISSIONS);

  const summary = useMemo(() => getMissionSummary(missions), [missions]);
  const recommended = useMemo(() => recommendedNext(missions), [missions]);
  const dailyPct = summary.dailyTotal === 0 ? 0 : Math.round((summary.dailyDone / summary.dailyTotal) * 100);

  const claim = (id: string) =>
    setMissions((prev) => prev.map((m) => (m.id === id ? { ...m, state: "claimed" as const } : m)));

  const byScope = (scope: MissionScope) =>
    sortForDisplay(missions.filter((m) => m.scope === scope));

  return (
    <>
      <PageHeader
        title="Missions"
        description="Your daily play loop. Finish today's list before reset."
      />

      <Hero
        eyebrow="Today's focus"
        eyebrowIcon={Sparkles}
        title={recommended ? recommended.title : "All daily missions complete"}
        subtitle={
          <>
            {summary.dailyDone} of {summary.dailyTotal} daily missions complete ·{" "}
            <span className="inline-flex items-center gap-1 text-warning">
              <Flame className="h-3 w-3" /> {summary.streakDays}-day streak
            </span>
          </>
        }
        right={<RingGauge pct={dailyPct} label={`${summary.dailyDone}/${summary.dailyTotal}`} sublabel="daily" />}
      >
        {recommended && (
          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                {recommended.progress.done} / {recommended.progress.total} ·{" "}
                {formatResetChip(recommended.resetInHours)}
              </span>
              <RewardChip kind={recommended.reward.kind} label={recommended.reward.label} />
            </div>
            <ProgressBar done={recommended.progress.done} total={recommended.progress.total} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {recommended.actionTo && (
                <Link to={recommended.actionTo}>
                  <Button size="sm">Go <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
                </Link>
              )}
              <span className="text-[11px] text-muted-foreground">Closest to done — finish this first.</span>
            </div>
          </div>
        )}
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Daily complete" value={`${summary.dailyDone} / ${summary.dailyTotal}`} icon={ListChecks} tone="primary" />
        <StatCard label="Weekly complete" value={`${summary.weeklyDone} / ${summary.weeklyTotal}`} />
        <StatCard label="Unclaimed rewards" value={String(summary.unclaimed)} icon={Gift} tone="warning" />
        <StatCard label="Streak" value={`${summary.streakDays} d`} icon={Flame} tone="success" />
      </div>

      <Tabs defaultValue="daily" className="mt-6">
        <TabsList>
          <TabsTrigger value="daily">
            Daily<span className="ml-1.5 text-[10px] text-muted-foreground">{summary.dailyDone}/{summary.dailyTotal}</span>
          </TabsTrigger>
          <TabsTrigger value="weekly">
            Weekly<span className="ml-1.5 text-[10px] text-muted-foreground">{summary.weeklyDone}/{summary.weeklyTotal}</span>
          </TabsTrigger>
          <TabsTrigger value="event">Event</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4"><MissionGroup items={byScope("daily")} onClaim={claim} /></TabsContent>
        <TabsContent value="weekly" className="mt-4"><MissionGroup items={byScope("weekly")} onClaim={claim} /></TabsContent>
        <TabsContent value="event" className="mt-4"><MissionGroup items={byScope("event")} onClaim={claim} /></TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/presents"
          icon={Gift}
          tone="warning"
          title={
            summary.unclaimed > 0
              ? `${summary.unclaimed} reward${summary.unclaimed === 1 ? "" : "s"} ready to claim`
              : "All caught up — no rewards waiting"
          }
          hint="Reward hand-off lives in your Present Box."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/collection-missions" icon={Trophy} title="Collection Goals" hint="Long-term collection targets and sets." />
        <CrossLink to="/achievements" icon={Star} title="Achievements" hint="Permanent unlocks for lifetime milestones." />
        <CrossLink to="/presents" icon={Gift} title="Present Box" hint="Open and review your claimed rewards." />
      </div>
    </>
  );
}

function MissionGroup({ items, onClaim }: { items: Mission[]; onClaim: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No missions in this tab.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((m) => <MissionRow key={m.id} mission={m} onClaim={onClaim} />)}
    </div>
  );
}

function MissionRow({ mission, onClaim }: { mission: Mission; onClaim: (id: string) => void }) {
  const cat = CATEGORY_META[mission.category];
  const isClaimed = mission.state === "claimed";
  const isUnclaimed = mission.state === "complete_unclaimed";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background/30 p-3 transition-colors sm:flex-row sm:items-center",
        isUnclaimed ? "border-warning/50 bg-warning/5" : "border-border",
        isClaimed && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-2">
        <span className={cn("h-2 w-2 rounded-full", cat.dotClass)} aria-hidden />
        {isClaimed ? <Check className="h-4 w-4 text-success" />
          : isUnclaimed ? <Sparkles className="h-4 w-4 text-warning" />
          : <Clock className="h-4 w-4 text-muted-foreground" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", cat.textClass)}>{cat.label}</span>
          <span className="text-sm font-medium">{mission.title}</span>
          <Badge variant="outline" className="border-border bg-muted/40 text-[10px] font-normal text-muted-foreground">
            {formatResetChip(mission.resetInHours)}
          </Badge>
        </div>
        {mission.hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{mission.hint}</div>}
        <ProgressBar
          done={mission.progress.done}
          total={mission.progress.total}
          tone={isClaimed ? "muted" : isUnclaimed ? "warn" : "primary"}
        />
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <RewardChip kind={mission.reward.kind} label={mission.reward.label} />
        <span className="text-mono text-[11px] text-muted-foreground">{mission.progress.done}/{mission.progress.total}</span>
        <MissionAction mission={mission} onClaim={onClaim} />
      </div>
    </div>
  );
}

function MissionAction({ mission, onClaim }: { mission: Mission; onClaim: (id: string) => void }) {
  if (mission.state === "claimed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Check className="h-3 w-3" /> Claimed
      </span>
    );
  }
  if (mission.state === "complete_unclaimed") {
    return (
      <Button size="sm" onClick={() => onClaim(mission.id)}>
        <Gift className="mr-1 h-3.5 w-3.5" /> Claim
      </Button>
    );
  }
  if (mission.actionTo) {
    return (
      <Link to={mission.actionTo}>
        <Button size="sm" variant="outline">Go <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
      </Link>
    );
  }
  return null;
}
