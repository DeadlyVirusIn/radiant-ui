import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Share2, Plus, Users, Gift, Sparkles, ArrowRight, Pause, Play,
  Heart, Repeat2, Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  SHARING_RULES, SHARING_RECENT, SCOPE_META,
  getSharingSummary, formatRecentChip,
  type SharingRule,
} from "@/lib/mock-sharing";

export const Route = createFileRoute("/sharing-cards")({
  head: () => ({ meta: [{ title: "Sharing cards — Radiant" }] }),
  component: SharingCardsPage,
});

function SharingCardsPage() {
  const [rules, setRules] = useState<SharingRule[]>(SHARING_RULES);
  const summary = useMemo(() => getSharingSummary(rules), [rules]);

  const toggle = (id: string) =>
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, state: r.state === "active" ? "paused" : "active" } : r,
      ),
    );

  const activeRules = rules.filter((r) => r.state === "active");
  const pausedRules = rules.filter((r) => r.state === "paused");

  // Recommended rule: highest dailyCap utilization but not yet capped.
  const featured =
    activeRules
      .filter((r) => r.sentToday < r.dailyCap)
      .sort((a, b) => b.sentToday / b.dailyCap - a.sentToday / a.dailyCap)[0] ?? activeRules[0];

  const handleNew = () => toast("Rule builder coming soon");

  return (
    <>
      <PageHeader
        title="Sharing cards"
        description="Turn your duplicates into someone else's wishlist hit, automatically."
        actions={
          <Button size="sm" className="gap-1.5" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5" /> New rule
          </Button>
        }
      />

      <Hero
        eyebrow="Most active rule"
        eyebrowIcon={Sparkles}
        title={featured ? featured.name : "No active sharing rules"}
        subtitle={
          featured
            ? `${featured.sentToday} of ${featured.dailyCap} cards routed today · ${featured.routedLifetime} all-time`
            : "Create a rule to start routing duplicates to friends."
        }
        right={featured ? <ShareTotem count={featured.sentToday} cap={featured.dailyCap} /> : undefined}
      >
        {featured && (
          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full align-middle", SCOPE_META[featured.scope].dotClass)} />
                {featured.from} → {featured.to} · {featured.filter}
              </span>
              <Badge variant="outline" className="h-5 border-success/40 bg-success/10 text-[10px] font-semibold text-success">
                Active
              </Badge>
            </div>
            <ProgressBar done={featured.sentToday} total={featured.dailyCap} tone="success" />
          </div>
        )}
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active rules"      value={String(summary.activeRules)}    icon={Share2} tone="primary" />
        <StatCard label="Routed today"      value={String(summary.sentToday)}      icon={Gift}   tone="success" />
        <StatCard label="Lifetime gifts"    value={String(summary.routedLifetime)} />
        <StatCard label="At daily cap"      value={String(summary.ceilingHit)}     tone={summary.ceilingHit > 0 ? "warning" : "default"} />
      </div>

      <Tabs defaultValue="active" className="mt-6">
        <TabsList>
          <TabsTrigger value="active">
            Active<span className="ml-1.5 text-[10px] text-muted-foreground">{activeRules.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused<span className="ml-1.5 text-[10px] text-muted-foreground">{pausedRules.length}</span>
          </TabsTrigger>
          <TabsTrigger value="recent">Recent gifts</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <RuleList items={activeRules} onToggle={toggle} />
        </TabsContent>
        <TabsContent value="paused" className="mt-4">
          <RuleList items={pausedRules} onToggle={toggle} />
        </TabsContent>
        <TabsContent value="recent" className="mt-4">
          <RecentList />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/friends"
          icon={Users}
          tone="primary"
          title="Pick recipients in Friends"
          hint="Auto-gift only sends to friends who match your rule's filter."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/friends"     icon={Users}    title="Friends"      hint="Manage your gifting network." />
        <CrossLink to="/wishlist"    icon={Heart}    title="Wishlist"     hint="What others can route to you." />
        <CrossLink to="/trades"      icon={Repeat2}  title="Trades"       hint="Settle bigger swaps manually." />
      </div>

      {/* Keep imports referenced for future iterations */}
      <span className="sr-only"><Wand2 /></span>
    </>
  );
}

function RuleList({
  items, onToggle,
}: { items: SharingRule[]; onToggle: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No rules in this tab.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((r) => <RuleRow key={r.id} rule={r} onToggle={onToggle} />)}
    </div>
  );
}

function RuleRow({ rule, onToggle }: { rule: SharingRule; onToggle: (id: string) => void }) {
  const meta = SCOPE_META[rule.scope];
  const isActive = rule.state === "active";
  const isCapped = isActive && rule.sentToday >= rule.dailyCap;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background/30 p-3 transition-colors sm:flex-row sm:items-center",
        isCapped ? "border-warning/40 bg-warning/5" : "border-border",
        !isActive && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2 sm:flex-col sm:items-start">
        <span className={cn("mt-1 h-2 w-2 rounded-full", meta.dotClass)} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", meta.textClass)}>{meta.label}</span>
          <span className="text-sm font-medium">{rule.name}</span>
          {isCapped && (
            <Badge variant="outline" className="h-5 border-warning/40 bg-warning/10 text-[10px] font-semibold text-warning">
              Daily cap reached
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {rule.from} → {rule.to} · {rule.filter}
        </div>
        <ProgressBar
          done={rule.sentToday}
          total={rule.dailyCap}
          tone={!isActive ? "muted" : isCapped ? "warn" : "primary"}
        />
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <span className="text-mono text-[11px] text-muted-foreground">{rule.sentToday}/{rule.dailyCap} today</span>
        <Button
          size="sm"
          variant={isActive ? "outline" : "default"}
          className="h-7 text-xs"
          onClick={() => onToggle(rule.id)}
        >
          {isActive ? <><Pause className="mr-1 h-3 w-3" /> Pause</> : <><Play className="mr-1 h-3 w-3" /> Resume</>}
        </Button>
      </div>
    </div>
  );
}

function RecentList() {
  if (SHARING_RECENT.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No gifts routed yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {SHARING_RECENT.map((g) => (
        <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Gift className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{g.card} → {g.to}</div>
            <div className="text-[11px] text-muted-foreground">{formatRecentChip(g.whenHours)}</div>
          </div>
          <RewardChip kind={g.rewardKind} label="Card" />
          <Link to="/friends">
            <Button size="sm" variant="ghost" className="h-7 text-xs">
              View <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}

function ShareTotem({ count, cap }: { count: number; cap: number }) {
  const pct = cap === 0 ? 0 : Math.round((count / cap) * 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
        <Share2 className="h-7 w-7 text-primary" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{pct}% used</div>
    </div>
  );
}
