import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Sparkles, ArrowRight, Gift, ListChecks, PackageOpen,
  Clock, Check, Flag,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  EVENTS, CATEGORY_META, getEventSummary, formatEventChip,
  type LiveEvent, type EventState,
} from "@/lib/mock-events";

export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "Live events — Radiant" }] }),
  component: Events,
});

function Events() {
  const summary = useMemo(() => getEventSummary(EVENTS), []);
  const featured = useMemo(() => EVENTS.find((e) => e.state === "active") ?? null, []);

  const byState = (state: EventState) =>
    EVENTS.filter((e) => e.state === state).sort((a, b) => a.hoursLeft - b.hoursLeft);

  return (
    <>
      <PageHeader
        title="Live events"
        description="Limited-time collector events. Active boosts, what's coming, and what just ended."
      />

      {featured && (
        <Hero
          eyebrow="Live now"
          eyebrowIcon={Sparkles}
          title={featured.name}
          subtitle={
            <>
              {featured.tagline} · <span className="text-warning">{formatEventChip(featured.state, featured.hoursLeft)}</span>
            </>
          }
        >
          <p className="mt-3 text-sm text-foreground/90">{featured.blurb}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {featured.rewards.map((r) => (
              <Badge key={r} variant="outline" className="border-transparent bg-primary/10 text-[10px] font-semibold text-primary">
                <Gift className="mr-1 h-3 w-3" /> {r}
              </Badge>
            ))}
          </div>
          {featured.actionTo && (
            <div className="mt-4">
              <Link to={featured.actionTo} search={featured.actionQuery}>
                <Button size="sm">
                  {featured.actionLabel ?? "Join event"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
        </Hero>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active now" value={String(summary.active)} icon={Sparkles} tone="primary" />
        <StatCard label="Upcoming" value={String(summary.upcoming)} icon={Clock} tone="warning" />
        <StatCard label="Recently ended" value={String(summary.endedRecent)} icon={Flag} />
        <StatCard label="Rewards ready" value={String(summary.rewardsReady)} icon={Gift} tone="success" />
      </div>

      <Tabs defaultValue="active" className="mt-6">
        <TabsList>
          <TabsTrigger value="active">
            Active<span className="ml-1.5 text-[10px] text-muted-foreground">{summary.active}</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming<span className="ml-1.5 text-[10px] text-muted-foreground">{summary.upcoming}</span>
          </TabsTrigger>
          <TabsTrigger value="ended">
            Ended<span className="ml-1.5 text-[10px] text-muted-foreground">{summary.endedRecent}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4"><EventGrid items={byState("active")} /></TabsContent>
        <TabsContent value="upcoming" className="mt-4"><EventGrid items={byState("upcoming")} /></TabsContent>
        <TabsContent value="ended" className="mt-4"><EventGrid items={byState("ended")} /></TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/presents"
          icon={Gift}
          tone="warning"
          title={`${summary.rewardsReady} event reward${summary.rewardsReady === 1 ? "" : "s"} ready to claim`}
          hint="Event rewards are delivered to your Present Box."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/open-pack" icon={PackageOpen} title="Open pack" hint="Spend event boosts on the right pack." />
        <CrossLink to="/missions" icon={ListChecks} title="Missions" hint="Event missions live on the Event tab." />
        <CrossLink to="/presents" icon={Gift} title="Present Box" hint="Claim event rewards as they drop." />
      </div>
    </>
  );
}

function EventGrid({ items }: { items: LiveEvent[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Nothing here right now.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((e) => <EventCard key={e.id} event={e} />)}
    </div>
  );
}

function EventCard({ event }: { event: LiveEvent }) {
  const cat = CATEGORY_META[event.category];
  const isActive = event.state === "active";
  const isEnded = event.state === "ended";

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-background/30 p-4 transition-colors",
        isActive ? "border-primary/40 bg-primary/5" : "border-border",
        isEnded && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", cat.dotClass)} aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
          </div>
          <h3 className="mt-1 font-display text-base font-semibold tracking-tight">{event.name}</h3>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{event.tagline}</div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "border-transparent text-[10px] font-semibold uppercase tracking-wider",
            isActive ? "bg-primary/15 text-primary"
              : event.state === "upcoming" ? "bg-warning/15 text-warning"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isEnded ? <Check className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
          {formatEventChip(event.state, event.hoursLeft)}
        </Badge>
      </div>

      <p className="mt-3 text-sm text-foreground/80">{event.blurb}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {event.rewards.map((r) => (
          <Badge key={r} variant="outline" className="border-border bg-muted/40 text-[10px] font-normal text-muted-foreground">
            <Gift className="mr-1 h-3 w-3" /> {r}
          </Badge>
        ))}
      </div>

      {!isEnded && event.actionTo && (
        <div className="mt-4">
          <Link to={event.actionTo} search={event.actionQuery}>
            <Button size="sm" variant={isActive ? "default" : "outline"} className="w-full sm:w-auto">
              {event.actionLabel ?? (isActive ? "Join event" : "Set reminder")}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// satisfy unused import in some configurations
void Calendar;
