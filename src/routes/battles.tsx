import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Swords, Play, Crown, Sparkles, History, BarChart3, Trophy, Clock,
  Heart, Zap,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { RewardKind } from "@/lib/mock-rewards";

export const Route = createFileRoute("/battles")({
  head: () => ({ meta: [{ title: "Battles — Radiant" }] }),
  component: BattlesPage,
});

type Mode = {
  id: string;
  group: "solo" | "event" | "casual";
  title: string;
  hint: string;
  reward: { kind: RewardKind; label: string };
  endsIn?: string;
  queueSecs?: number;
  hot?: boolean;
};

const MODES: Mode[] = [
  { id: "m1", group: "solo",   title: "Ranked ladder",  hint: "Climb the seasonal ladder",       reward: { kind: "ticket",    label: "+1 ticket / win" }, queueSecs: 35 },
  { id: "m2", group: "solo",   title: "Daily quest",    hint: "5 wins for today's bonus pack",   reward: { kind: "pack",      label: "1 pack" },          hot: true },
  { id: "m3", group: "solo",   title: "Practice",       hint: "No rating, fast queues",           reward: { kind: "dust",      label: "+20 dust" },        queueSecs: 12 },
  { id: "m4", group: "event",  title: "Aurora Cup",     hint: "Featured event ladder",            reward: { kind: "pack",      label: "Event pack" },      endsIn: "2d 14h", hot: true },
  { id: "m5", group: "event",  title: "Weekend rush",   hint: "Double rewards all weekend",       reward: { kind: "hourglass", label: "+1 hourglass" },    endsIn: "1d 6h" },
  { id: "m6", group: "casual", title: "Quick match",    hint: "60-second queues",                  reward: { kind: "dust",      label: "+30 dust" },        queueSecs: 55 },
  { id: "m7", group: "casual", title: "Mystery draft",  hint: "Random deck pulled for you",        reward: { kind: "ticket",    label: "+1 ticket" },       queueSecs: 80 },
];

function BattlesPage() {
  const [queued, setQueued] = useState<string | null>(null);

  // Recommendation: hot event > daily quest > shortest queue
  const featured = useMemo(() => {
    const hotEvent = MODES.find((m) => m.hot && m.group === "event");
    if (hotEvent) return hotEvent;
    const hot = MODES.find((m) => m.hot);
    if (hot) return hot;
    return [...MODES].sort((a, b) => (a.queueSecs ?? 999) - (b.queueSecs ?? 999))[0];
  }, []);

  const queue = (id: string) => {
    setQueued(id);
    toast.success(`Queued for ${MODES.find((m) => m.id === id)?.title ?? "battle"}`);
  };

  return (
    <>
      <PageHeader
        title="Battles"
        description="Pick a mode and play. Wins push missions, rewards, and your ladder."
      />

      <Hero
        eyebrow={featured.group === "event" ? "Event spotlight" : "Recommended now"}
        eyebrowIcon={Sparkles}
        title={featured.title}
        subtitle={featured.hint}
        right={<BattleTotem />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <RewardChip kind={featured.reward.kind} label={featured.reward.label} />
              {featured.endsIn && (
                <span className="inline-flex items-center gap-1 text-warning">
                  <Clock className="h-3 w-3" /> Ends in {featured.endsIn}
                </span>
              )}
            </div>
            {featured.queueSecs != null && (
              <span className="text-[11px] text-muted-foreground">
                Avg queue ~{featured.queueSecs}s
              </span>
            )}
          </div>
          <div className="mt-3">
            <Button size="sm" onClick={() => queue(featured.id)} disabled={queued === featured.id}>
              <Play className="mr-1 h-3.5 w-3.5" />
              {queued === featured.id ? "Queued" : "Queue up"}
            </Button>
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Win rate"     value="73%"      icon={Trophy} tone="success" delta={{ value: "+4%", direction: "up" }} />
        <StatCard label="Wins today"   value="12 / 5"   tone="primary" hint="Daily target met" />
        <StatCard label="Best streak"  value="14"       icon={Swords} />
        <StatCard label="Season tier"  value="Gold I"   icon={Crown}  tone="warning" />
      </div>

      <Tabs defaultValue="solo" className="mt-6">
        <TabsList>
          <TabsTrigger value="solo">Solo</TabsTrigger>
          <TabsTrigger value="event">Event</TabsTrigger>
          <TabsTrigger value="casual">Casual</TabsTrigger>
        </TabsList>
        {(["solo", "event", "casual"] as const).map((g) => (
          <TabsContent key={g} value={g} className="mt-4">
            <ModeGrid
              items={MODES.filter((m) => m.group === g)}
              queued={queued}
              onQueue={queue}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/battle-history"
          icon={History}
          tone="primary"
          title="Review your recent matches"
          hint="See rating deltas, opponents, and rewards earned."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/battle-stats"   icon={BarChart3} title="Battle stats"  hint="Win rate by mode and deck." />
        <CrossLink to="/pvp"            icon={Crown}     title="PvP rankings"  hint="Where you stand on the ladder." />
        <CrossLink to="/stamina"        icon={Zap}       title="Energy"        hint="Battles refill independently." />
      </div>
    </>
  );
}

function ModeGrid({
  items, queued, onQueue,
}: { items: Mode[]; queued: string | null; onQueue: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No modes here right now.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => {
        const isQueued = queued === m.id;
        return (
          <div key={m.id} className={cn(
            "flex flex-col gap-3 rounded-xl border bg-background/30 p-4",
            m.hot ? "border-warning/40 bg-warning/5" : "border-border",
          )}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                <Swords className="h-4 w-4" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <RewardChip kind={m.reward.kind} label={m.reward.label} />
              {m.endsIn && (
                <Badge variant="outline" className="h-5 border-warning/40 bg-warning/10 text-[10px] font-semibold text-warning">
                  Ends {m.endsIn}
                </Badge>
              )}
              {m.queueSecs != null && (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> ~{m.queueSecs}s queue
                </span>
              )}
            </div>

            <Button size="sm" onClick={() => onQueue(m.id)} disabled={isQueued} className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> {isQueued ? "Queued" : "Queue up"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function BattleTotem() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
        <Swords className="h-7 w-7 text-primary" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Battle</div>
    </div>
  );
}

void Heart;
