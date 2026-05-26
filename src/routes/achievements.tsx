import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Trophy, Star, Lock, Sparkles, ArrowRight, Check,
  Gift, ListChecks,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ACHIEVEMENTS, TIER_META, CATEGORY_META,
  getAchievementSummary, sortAchievements,
  type Achievement, type AchievementCategory,
} from "@/lib/mock-achievements";

export const Route = createFileRoute("/achievements")({
  head: () => ({ meta: [{ title: "Achievements — Radiant" }] }),
  component: Achievements,
});

const TABS: (AchievementCategory | "all")[] = ["all", "collect", "play", "trade", "social", "event"];

function Achievements() {
  const summary = useMemo(() => getAchievementSummary(ACHIEVEMENTS), []);

  const featured = useMemo(() => {
    const inProgress = ACHIEVEMENTS.filter((a) => a.state === "in_progress");
    if (inProgress.length === 0) return null;
    return [...inProgress].sort(
      (a, b) => b.progress.done / b.progress.total - a.progress.done / a.progress.total,
    )[0];
  }, []);

  const byTab = (tab: AchievementCategory | "all") =>
    sortAchievements(tab === "all" ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.category === tab));

  return (
    <>
      <PageHeader
        title="Achievements"
        description="Lifetime collector milestones. Permanent unlocks — nothing resets."
      />

      {/* CLOSEST UNLOCK HERO */}
      {featured && <ClosestHero a={featured} />}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unlocked" value={`${summary.unlocked} / ${summary.total}`} icon={Trophy} tone="success" />
        <StatCard label="In progress" value={String(summary.inProgress)} tone="primary" icon={Sparkles} />
        <StatCard label="Legendary" value={String(summary.legendary)} tone="warning" icon={Star} />
        <StatCard label="Locked" value={String(summary.total - summary.unlocked - summary.inProgress)} />
      </div>

      <Tabs defaultValue="all" className="mt-6">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === "all" ? "All" : CATEGORY_META[t].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <AchievementGrid items={byTab(t)} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/missions" icon={ListChecks} title="Missions" hint="Daily and weekly play loop." />
        <CrossLink to="/collection-missions" icon={Trophy} title="Collection Goals" hint="Long-term set completion." />
        <CrossLink to="/presents" icon={Gift} title="Present Box" hint="Claim rewards waiting for you." />
      </div>
    </>
  );
}

/* ────────────────────── components ────────────────────── */

function ClosestHero({ a }: { a: Achievement }) {
  const tier = TIER_META[a.tier];
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-5 ring-1 ring-primary/20">
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Closest unlock
          </div>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight md:text-2xl">{a.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p>

          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={cn("font-semibold uppercase tracking-wider", tier.textClass)}>
                {tier.label}
              </span>
              <span className="text-mono text-muted-foreground">
                {a.progress.done} / {a.progress.total}
              </span>
            </div>
            <ProgressBar done={a.progress.done} total={a.progress.total} />
            {a.actionTo && (
              <div className="mt-3">
                <Link to={a.actionTo}>
                  <Button size="sm">
                    Make progress <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className={cn("grid h-24 w-24 place-items-center rounded-2xl ring-2", tier.bgClass, tier.ringClass)}>
          <Trophy className={cn("h-10 w-10", tier.textClass)} />
        </div>
      </div>
    </div>
  );
}

function AchievementGrid({ items }: { items: Achievement[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => <AchievementCard key={a.id} a={a} />)}
    </div>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const tier = TIER_META[a.tier];
  const isUnlocked = a.state === "unlocked";
  const isLocked = a.state === "locked";
  const Icon = isUnlocked ? Trophy : isLocked ? Lock : Sparkles;

  return (
    <div
      className={cn(
        "rounded-lg border bg-background/30 p-4 transition-colors",
        isUnlocked ? "border-primary/30 bg-primary/5" : "border-border",
        isLocked && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md ring-1", tier.bgClass, tier.ringClass)}>
          <Icon className={cn("h-5 w-5", isUnlocked ? tier.textClass : "text-muted-foreground")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-semibold">{a.name}</div>
            {a.tier === "legendary" && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{a.desc}</div>

          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("border-transparent text-[10px] font-semibold uppercase tracking-wider", tier.bgClass, tier.textClass)}
            >
              {tier.label}
            </Badge>
            <Badge variant="outline" className="border-border bg-muted/40 text-[10px] font-normal text-muted-foreground capitalize">
              {CATEGORY_META[a.category].label}
            </Badge>
          </div>

          {a.state === "in_progress" && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progress</span>
                <span className="text-mono">{a.progress.done}/{a.progress.total}</span>
              </div>
              <ProgressBar done={a.progress.done} total={a.progress.total} />
              {a.actionTo && (
                <div className="mt-2">
                  <Link
                    to={a.actionTo}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Continue <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {isUnlocked && (
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-success">
              <Check className="h-3 w-3" /> Unlocked {a.unlockedAt}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, (done / total) * 100);
  return (
    <div className="mt-1.5 h-1 rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
