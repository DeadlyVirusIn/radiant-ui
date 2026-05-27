import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Crown, Sparkles, Star, Repeat2, Heart, Trophy, ArrowRight,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RingGauge } from "@/components/app-shell/RingGauge";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gold-flair")({
  head: () => ({ meta: [{ title: "Gold Flair — Radiant" }] }),
  component: GoldFlairPage,
});

type Tier = "legendary" | "epic" | "rare";

const TIER_STYLE: Record<Tier, string> = {
  legendary: "bg-warning/15 text-warning ring-warning/30",
  epic:      "bg-primary/15 text-primary ring-primary/30",
  rare:      "bg-success/15 text-success ring-success/30",
};

type Flair = {
  id: string;
  name: string;
  tier: Tier;
  owned: number;
  wishlistMatches: number;
  state: "owned" | "tradeable" | "hunting";
};

const FLAIRS: Flair[] = [
  { id: "f1",  name: "Solar Crown",    tier: "legendary", owned: 1, wishlistMatches: 0, state: "owned" },
  { id: "f2",  name: "Aureate Sigil",  tier: "epic",      owned: 2, wishlistMatches: 0, state: "tradeable" },
  { id: "f3",  name: "Gilded Pact",    tier: "epic",      owned: 1, wishlistMatches: 0, state: "owned" },
  { id: "f4",  name: "Halcyon Mark",   tier: "rare",      owned: 4, wishlistMatches: 1, state: "tradeable" },
  { id: "f5",  name: "Sovereign Loop", tier: "legendary", owned: 0, wishlistMatches: 3, state: "hunting" },
  { id: "f6",  name: "Embered Vow",    tier: "rare",      owned: 3, wishlistMatches: 0, state: "tradeable" },
  { id: "f7",  name: "Quiet Lantern",  tier: "rare",      owned: 0, wishlistMatches: 2, state: "hunting" },
  { id: "f8",  name: "Pale Charter",   tier: "epic",      owned: 0, wishlistMatches: 1, state: "hunting" },
  { id: "f9",  name: "Bright Anchor",  tier: "rare",      owned: 5, wishlistMatches: 0, state: "tradeable" },
  { id: "f10", name: "Vermilion Veil", tier: "legendary", owned: 0, wishlistMatches: 4, state: "hunting" },
  { id: "f11", name: "Iron Refrain",   tier: "epic",      owned: 2, wishlistMatches: 0, state: "owned" },
  { id: "f12", name: "Silver Vow",     tier: "rare",      owned: 1, wishlistMatches: 0, state: "owned" },
];

function GoldFlairPage() {
  const [tab, setTab] = useState<"all" | "owned" | "tradeable" | "hunting">("all");

  const summary = useMemo(() => {
    const owned = FLAIRS.filter((f) => f.owned > 0).length;
    const total = FLAIRS.length;
    const legendary = FLAIRS.filter((f) => f.tier === "legendary" && f.owned > 0).length;
    const tradeable = FLAIRS.filter((f) => f.state === "tradeable").length;
    return { owned, total, legendary, tradeable, pct: Math.round((owned / total) * 100) };
  }, []);

  // Recommended: hunting + most wishlist matches first
  const featured = useMemo(
    () => [...FLAIRS].sort((a, b) => {
      if (a.state === "hunting" && b.state !== "hunting") return -1;
      if (b.state === "hunting" && a.state !== "hunting") return 1;
      return b.wishlistMatches - a.wishlistMatches;
    })[0],
    [],
  );

  const visible =
    tab === "all"
      ? FLAIRS
      : FLAIRS.filter((f) =>
          tab === "owned" ? f.owned > 0 :
          tab === "tradeable" ? f.state === "tradeable" :
          f.state === "hunting",
        );

  return (
    <>
      <PageHeader
        title="Gold Flair"
        description="The premium collection — legendary, epic, and rare cards with a golden shine."
      />

      <Hero
        eyebrow="Closest unlock"
        eyebrowIcon={Sparkles}
        title={featured.name}
        subtitle={
          featured.wishlistMatches > 0
            ? `${featured.wishlistMatches} wishlist match${featured.wishlistMatches === 1 ? "" : "es"} — line up a trade or chase it in packs.`
            : "Not on your wishlist yet — add it to start hunting."
        }
        right={<RingGauge pct={summary.pct} label={`${summary.pct}%`} sublabel="Owned" />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <ProgressBar done={summary.owned} total={summary.total} tone="warn" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase", TIER_STYLE[featured.tier])}>
              {featured.tier}
            </Badge>
            <RewardChip kind="card" label="Gold flair" />
            <span className="text-muted-foreground">{summary.owned} of {summary.total} flairs owned</span>
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Owned"       value={`${summary.owned} / ${summary.total}`} icon={Crown}  tone="warning" />
        <StatCard label="Legendary"   value={String(summary.legendary)}             icon={Trophy} tone="primary" />
        <StatCard label="Tradeable"   value={String(summary.tradeable)}             icon={Repeat2} tone="success" />
        <StatCard label="Completion"  value={`${summary.pct}%`}                      tone="primary" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="owned">Owned</TabsTrigger>
          <TabsTrigger value="tradeable">Tradeable</TabsTrigger>
          <TabsTrigger value="hunting">Hunting</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <FlairGrid items={visible} />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/collection/gold-flair-trade"
          icon={Repeat2}
          tone="warning"
          title="Curated Gold Flair trades"
          hint="Hand-picked two-sided trades for high-value flairs."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/wishlist" icon={Heart}  title="Wishlist"  hint="Mark the flairs you want first." />
        <CrossLink to="/trades"   icon={Repeat2} title="Trades"   hint="Settle other trades manually." />
        <CrossLink to="/cards"    icon={Star}   title="My Cards" hint="See your full collection." />
      </div>
    </>
  );
}

function FlairGrid({ items }: { items: Flair[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No flairs in this view.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((f) => {
        const has = f.owned > 0;
        const hot = f.wishlistMatches > 0;
        return (
          <article key={f.id} className={cn(
            "flex flex-col gap-3 rounded-xl border bg-card/60 p-4 transition-colors",
            has ? "border-border hover:border-primary/40" :
            hot ? "border-warning/40 bg-warning/5"        :
            "border-dashed border-border",
          )}>
            <div className="flex items-start justify-between gap-2">
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase ring-1", TIER_STYLE[f.tier])}>
                {f.tier}
              </Badge>
              {f.state === "tradeable" && (
                <Badge variant="outline" className="h-5 border-success/40 bg-success/10 text-[10px] font-semibold text-success">
                  ×{f.owned}
                </Badge>
              )}
              {!has && (
                <Badge variant="outline" className="h-5 border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground">
                  Locked
                </Badge>
              )}
            </div>

            <div className="font-display text-lg font-semibold leading-tight">{f.name}</div>

            <div className={cn(
              "h-16 rounded-md bg-gradient-to-br",
              f.tier === "legendary" && "from-warning/30 via-warning/10 to-card",
              f.tier === "epic"      && "from-primary/30 via-primary/10 to-card",
              f.tier === "rare"      && "from-success/30 via-success/10 to-card",
              !has && "opacity-40",
            )} />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
              {has ? (
                <span className="text-muted-foreground">Owned ×{f.owned}</span>
              ) : hot ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <Heart className="h-3 w-3" /> {f.wishlistMatches} wishlist match
                </span>
              ) : (
                <span className="text-muted-foreground">Not owned</span>
              )}
              {f.state === "tradeable" ? (
                <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                  <a href="/collection/gold-flair-trade">Trade <ArrowRight className="ml-1 h-3 w-3" /></a>
                </Button>
              ) : f.state === "hunting" ? (
                <Button size="sm" className="h-7 text-xs" asChild>
                  <a href="/open-pack">Hunt <ArrowRight className="ml-1 h-3 w-3" /></a>
                </Button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
