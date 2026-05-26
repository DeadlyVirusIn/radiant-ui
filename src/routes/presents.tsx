import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Package, Gift, Check, ArrowRight, ListChecks, Calendar, Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Hero } from "@/components/app-shell/Hero";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  PRESENTS, SOURCE_META, getPresentSummary, formatExpiryChip,
  type Present, type PresentSource,
} from "@/lib/mock-presents";

export const Route = createFileRoute("/presents")({
  head: () => ({ meta: [{ title: "Present box — Radiant" }] }),
  component: Presents,
});

const TABS: ("all" | PresentSource)[] = ["all", "mission", "event", "friend", "trade", "system"];

function Presents() {
  const [presents, setPresents] = useState<Present[]>(PRESENTS);

  const summary = useMemo(() => getPresentSummary(presents), [presents]);
  const nextExpiring = useMemo(() => {
    const ready = presents.filter((p) => p.state === "ready");
    if (ready.length === 0) return null;
    return [...ready].sort((a, b) => a.expiresInHours - b.expiresInHours)[0];
  }, [presents]);

  const claim = (id: string) => {
    const p = presents.find((x) => x.id === id);
    if (!p) return;
    setPresents((prev) =>
      prev.map((x) => (x.id === id ? { ...x, state: "claimed", claimedAt: "Just now" } : x)),
    );
    toast.success(`Claimed: ${p.item}`, { description: `From ${p.from}` });
  };

  const claimAll = () => {
    const ready = presents.filter((p) => p.state === "ready");
    if (ready.length === 0) return;
    setPresents((prev) =>
      prev.map((p) => (p.state === "ready" ? { ...p, state: "claimed", claimedAt: "Just now" } : p)),
    );
    toast.success(`Claimed ${ready.length} present${ready.length === 1 ? "" : "s"}`);
  };

  const byTab = (tab: "all" | PresentSource) =>
    sortPresents(tab === "all" ? presents : presents.filter((p) => p.source === tab));

  return (
    <>
      <PageHeader
        title="Present box"
        description="Rewards waiting to be claimed. Sources stay linked back to where they came from."
        actions={
          <Button size="sm" onClick={claimAll} disabled={summary.ready === 0}>
            <Gift className="mr-1 h-3.5 w-3.5" /> Claim all
          </Button>
        }
      />

      <Hero
        eyebrow={summary.ready > 0 ? "Ready to claim" : "All caught up"}
        eyebrowIcon={Sparkles}
        title={
          summary.ready > 0
            ? `${summary.ready} present${summary.ready === 1 ? "" : "s"} waiting`
            : "No presents to claim right now"
        }
        subtitle={
          nextExpiring
            ? <>Next to expire: <span className="text-foreground font-medium">{nextExpiring.item}</span> · {formatExpiryChip(nextExpiring.expiresInHours)}</>
            : "Earn more by completing daily and weekly missions."
        }
      >
        {nextExpiring && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => claim(nextExpiring.id)}>
              <Gift className="mr-1 h-3.5 w-3.5" /> Claim now
            </Button>
            {nextExpiring.originTo && (
              <Link to={nextExpiring.originTo}>
                <Button size="sm" variant="outline">View source <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
              </Link>
            )}
          </div>
        )}
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Ready" value={String(summary.ready)} icon={Package} tone="warning" />
        <StatCard label="Expiring < 24h" value={String(summary.expiringSoon)} tone="danger" />
        <StatCard label="Claimed 24h" value={String(summary.claimed24h)} tone="success" icon={Check} />
        <StatCard label="Lifetime claimed" value={String(summary.totalLifetime)} />
      </div>

      <Tabs defaultValue="all" className="mt-6">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === "all" ? "All" : SOURCE_META[t].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <PresentList items={byTab(t)} onClaim={claim} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/missions"
          icon={ListChecks}
          title="Earn more presents"
          hint="Daily and weekly missions are your most reliable source."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/missions" icon={ListChecks} title="Missions" hint="Daily and weekly play loop." />
        <CrossLink to="/events" icon={Calendar} title="Live events" hint="Limited-time reward drops." />
        <CrossLink to="/achievements" icon={Gift} title="Achievements" hint="Lifetime collector milestones." />
      </div>
    </>
  );
}

function sortPresents(items: Present[]): Present[] {
  return [...items].sort((a, b) => {
    if (a.state !== b.state) return a.state === "ready" ? -1 : 1;
    if (a.state === "ready") return a.expiresInHours - b.expiresInHours;
    return 0;
  });
}

function PresentList({ items, onClaim }: { items: Present[]; onClaim: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((p) => <PresentRow key={p.id} present={p} onClaim={onClaim} />)}
    </div>
  );
}

function PresentRow({ present, onClaim }: { present: Present; onClaim: (id: string) => void }) {
  const src = SOURCE_META[present.source];
  const isReady = present.state === "ready";
  const isExpiringSoon = isReady && present.expiresInHours < 24;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background/30 p-3 transition-colors sm:flex-row sm:items-center",
        isExpiringSoon ? "border-warning/50 bg-warning/5" : "border-border",
        !isReady && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 sm:flex-col sm:items-start">
        <span className={cn("h-2 w-2 rounded-full", src.dotClass)} aria-hidden />
        {isReady ? <Gift className="h-4 w-4 text-primary" /> : <Check className="h-4 w-4 text-success" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", src.textClass)}>{src.label}</span>
          <span className="text-sm font-medium">{present.item}</span>
          {isReady && (
            <Badge
              variant="outline"
              className={cn(
                "border-border bg-muted/40 text-[10px] font-normal",
                isExpiringSoon ? "text-warning" : "text-muted-foreground",
              )}
            >
              {formatExpiryChip(present.expiresInHours)}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          From {present.from}
          {present.originTo && (
            <>
              {" · "}
              <Link to={present.originTo} className="text-primary hover:underline">View source</Link>
            </>
          )}
          {!isReady && present.claimedAt && <> · Claimed {present.claimedAt}</>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <RewardChip kind={present.kind} label={present.item} />
        {isReady ? (
          <Button size="sm" onClick={() => onClaim(present.id)}>
            <Gift className="mr-1 h-3.5 w-3.5" /> Claim
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Check className="h-3 w-3" /> Claimed
          </span>
        )}
      </div>
    </div>
  );
}
