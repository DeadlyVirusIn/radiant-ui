import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wand2, Sparkles, Heart, Clock, ArrowRight, Check, Ticket,
  PackageOpen, Users, Gift,
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
  WONDER_PICKS, RARITY_META,
  getWonderSummary, recommendedPick, formatPickExpiry,
  type WonderPick,
} from "@/lib/mock-wonder-pick";

export const Route = createFileRoute("/wonder-pick")({
  head: () => ({ meta: [{ title: "Wonder pick — Radiant" }] }),
  component: WonderPickPage,
});

function WonderPickPage() {
  const [picks, setPicks] = useState<WonderPick[]>(WONDER_PICKS);
  const summary = useMemo(() => getWonderSummary(picks), [picks]);
  const featured = useMemo(() => recommendedPick(picks), [picks]);

  const available = picks.filter((p) => p.state === "available");
  const history = picks.filter((p) => p.state !== "available");

  const play = (id: string) => {
    const pick = picks.find((p) => p.id === id);
    if (!pick) return;
    setPicks((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              state: "picked",
              pickedCard: { name: p.topCard, kind: "card", label: RARITY_META[p.topRarity].label + " card" },
            }
          : p,
      ),
    );
    toast.success(`Picked from ${pick.from}'s pack`);
  };

  return (
    <>
      <PageHeader
        title="Wonder pick"
        description="Pick one of five hidden cards from a friend's recently opened pack."
      />

      <Hero
        eyebrow="Best pick right now"
        eyebrowIcon={Sparkles}
        title={featured ? `${featured.from}'s ${featured.packName}` : "No active picks"}
        subtitle={
          featured
            ? `Top card: ${featured.topCard} · ${formatPickExpiry(featured.expiresInHours)}`
            : "Check back later — friends open packs every few hours."
        }
        right={featured ? <PickTotem rarity={featured.topRarity} /> : undefined}
      >
        {featured && (
          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", RARITY_META[featured.topRarity].dotClass)} />
                <span className={cn("font-semibold uppercase tracking-wider text-[10px]", RARITY_META[featured.topRarity].textClass)}>
                  {RARITY_META[featured.topRarity].label}
                </span>
                {featured.wishlistMatches > 0 && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <Heart className="h-3 w-3" /> {featured.wishlistMatches} wishlist match
                  </span>
                )}
              </div>
              <RewardChip kind="ticket" label={`${featured.ticketCost} ticket`} />
            </div>
            <ProgressBar
              done={Math.max(0, 96 - featured.expiresInHours)}
              total={96}
              tone={featured.expiresInHours < 12 ? "warn" : "primary"}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => play(featured.id)} disabled={summary.tickets <= 0}>
                <Wand2 className="mr-1 h-3.5 w-3.5" /> Pick now
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {summary.tickets} ticket{summary.tickets === 1 ? "" : "s"} left today
              </span>
            </div>
          </div>
        )}
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tickets"            value={String(summary.tickets)}                icon={Ticket} tone="primary" />
        <StatCard label="Available picks"    value={String(summary.available)}              icon={Wand2}  tone="success" />
        <StatCard label="Wishlist chances"   value={String(summary.wishlistOpportunities)}  icon={Heart}  tone="warning" />
        <StatCard label="Picked all-time"    value={String(summary.pickedLifetime)} />
      </div>

      <Tabs defaultValue="available" className="mt-6">
        <TabsList>
          <TabsTrigger value="available">
            Available<span className="ml-1.5 text-[10px] text-muted-foreground">{available.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            History<span className="ml-1.5 text-[10px] text-muted-foreground">{history.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="available" className="mt-4">
          <PickGrid items={available} onPick={play} tickets={summary.tickets} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryList items={history} />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/presents"
          icon={Gift}
          tone="warning"
          title="Picked cards land in your Present Box"
          hint="Open Present Box to claim and review your wonder picks."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/open-pack" icon={PackageOpen} title="Open Pack"  hint="Open your own pack instead." />
        <CrossLink to="/friends"   icon={Users}       title="Friends"    hint="More picks open as friends open packs." />
        <CrossLink to="/wishlist"  icon={Heart}       title="Wishlist"   hint="More matches = better picks." />
      </div>
    </>
  );
}

function PickGrid({
  items, onPick, tickets,
}: { items: WonderPick[]; onPick: (id: string) => void; tickets: number }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No picks open right now.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => <PickCard key={p.id} pick={p} onPick={onPick} disabled={tickets <= 0} />)}
    </div>
  );
}

function PickCard({
  pick, onPick, disabled,
}: { pick: WonderPick; onPick: (id: string) => void; disabled: boolean }) {
  const rar = RARITY_META[pick.topRarity];
  const hot = pick.wishlistMatches > 0;
  const urgent = pick.expiresInHours < 12;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-background/30 p-4 transition-colors",
        hot ? "border-warning/40 bg-warning/5" : urgent ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <span className={cn("h-2 w-2 rounded-full", rar.dotClass)} />
            <span className={rar.textClass}>{rar.label}</span>
          </div>
          <div className="mt-1 text-sm font-medium">{pick.packName}</div>
          <div className="text-[11px] text-muted-foreground">From {pick.from}</div>
        </div>
        <div className="grid grid-cols-5 gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "aspect-[3/4] w-3 rounded-sm bg-gradient-to-br from-primary/30 via-card to-card ring-1",
                hot && i < pick.wishlistMatches ? "ring-warning" : "ring-border",
              )}
            />
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card/40 p-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Top card</span>
          <span className="font-medium">{pick.topCard}</span>
        </div>
        {hot && (
          <div className="mt-1 inline-flex items-center gap-1 text-warning">
            <Heart className="h-3 w-3" /> {pick.wishlistMatches} of 5 on your wishlist
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {formatPickExpiry(pick.expiresInHours)}
        </div>
        <RewardChip kind="ticket" label={`${pick.ticketCost} ticket`} />
      </div>

      <Button size="sm" onClick={() => onPick(pick.id)} disabled={disabled}>
        <Wand2 className="mr-1 h-3.5 w-3.5" /> Pick from this pack
        <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function HistoryList({ items }: { items: WonderPick[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        You haven't picked anything yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            {p.state === "picked" ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">
              {p.state === "picked" && p.pickedCard ? p.pickedCard.name : "Expired pick"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              From {p.from} · {p.packName}
            </div>
          </div>
          {p.state === "picked" && p.pickedCard ? (
            <Badge variant="outline" className="h-5 border-success/40 bg-success/10 text-[10px] font-semibold text-success">
              {p.pickedCard.label}
            </Badge>
          ) : (
            <Badge variant="outline" className="h-5 border-border bg-muted/40 text-[10px] font-normal text-muted-foreground">
              Expired
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function PickTotem({ rarity }: { rarity: WonderPick["topRarity"] }) {
  const rar = RARITY_META[rarity];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "grid h-16 w-16 place-items-center rounded-2xl ring-1",
        rarity === "legendary" && "bg-warning/15 ring-warning/30",
        rarity === "rare"      && "bg-primary/15 ring-primary/30",
        rarity === "common"    && "bg-muted ring-border",
      )}>
        <Wand2 className={cn("h-7 w-7", rar.textClass)} />
      </div>
      <div className={cn("text-[10px] uppercase tracking-wider font-semibold", rar.textClass)}>
        {rar.label}
      </div>
    </div>
  );
}
