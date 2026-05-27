import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Crown, ArrowRight, Sparkles, Check, X, Heart, Repeat2, Star,
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

export const Route = createFileRoute("/collection/gold-flair-trade")({
  head: () => ({ meta: [{ title: "Gold Flair trades — Radiant" }] }),
  component: GoldFlairTradePage,
});

type Tier = "legendary" | "epic";
type State = "open" | "accepted" | "declined";

type Offer = {
  id: string;
  give: { name: string; tier: Tier };
  receive: { name: string; tier: Tier; wishlistMatch: boolean };
  partner: string;
  expiresInHours: number;
  state: State;
};

const TIER_STYLE: Record<Tier, string> = {
  legendary: "bg-warning/15 text-warning",
  epic:      "bg-primary/15 text-primary",
};

const OFFERS: Offer[] = [
  { id: "o1", give: { name: "Aureate Sigil", tier: "epic" },      receive: { name: "Sovereign Loop", tier: "legendary", wishlistMatch: true },  partner: "Halcyon-EU", expiresInHours: 9,  state: "open" },
  { id: "o2", give: { name: "Halcyon Mark",  tier: "epic" },      receive: { name: "Vermilion Veil", tier: "legendary", wishlistMatch: true },  partner: "Aurora.01",  expiresInHours: 22, state: "open" },
  { id: "o3", give: { name: "Embered Vow",   tier: "epic" },      receive: { name: "Pale Charter",    tier: "epic",     wishlistMatch: false }, partner: "Vanta.02",   expiresInHours: 38, state: "open" },
  { id: "o4", give: { name: "Solar Crown",   tier: "legendary" }, receive: { name: "Quiet Lantern",   tier: "epic",     wishlistMatch: false }, partner: "Solace.JP",  expiresInHours: 64, state: "open" },
];

function formatExpiry(h: number) {
  if (h < 1) return "Expires soon";
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

function GoldFlairTradePage() {
  const [offers, setOffers] = useState<Offer[]>(OFFERS);
  const [tab, setTab] = useState<"open" | "history">("open");

  const open = offers.filter((o) => o.state === "open");
  const history = offers.filter((o) => o.state !== "open");

  const summary = useMemo(() => ({
    open: open.length,
    wishlistChances: open.filter((o) => o.receive.wishlistMatch).length,
    legendary: open.filter((o) => o.receive.tier === "legendary").length,
    accepted: offers.filter((o) => o.state === "accepted").length,
  }), [offers, open]);

  // Recommended: wishlist match + soonest expiry
  const featured = useMemo(
    () => [...open].sort((a, b) => {
      if (a.receive.wishlistMatch !== b.receive.wishlistMatch) return a.receive.wishlistMatch ? -1 : 1;
      return a.expiresInHours - b.expiresInHours;
    })[0],
    [open],
  );

  const act = (id: string, next: "accepted" | "declined") => {
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, state: next } : o)));
    toast.success(`Trade ${next}`);
  };

  return (
    <>
      <PageHeader
        title="Gold Flair trades"
        description="Curated two-sided trades for premium cards. Accept the ones that fill your wishlist."
      />

      <Hero
        eyebrow={featured ? "Best trade right now" : "No open trades"}
        eyebrowIcon={Sparkles}
        title={featured ? `${featured.give.name} → ${featured.receive.name}` : "Check back soon"}
        subtitle={
          featured
            ? `From ${featured.partner} · ${formatExpiry(featured.expiresInHours)}`
            : "New Gold Flair trades roll in throughout the day."
        }
        right={
          <div className="flex flex-col items-center gap-1">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-warning/15 ring-1 ring-warning/30">
              <Crown className="h-7 w-7 text-warning" />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-warning">Gold</div>
          </div>
        }
      >
        {featured && (
          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase", TIER_STYLE[featured.receive.tier])}>
                  {featured.receive.tier}
                </Badge>
                {featured.receive.wishlistMatch && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <Heart className="h-3 w-3" /> wishlist match
                  </span>
                )}
              </div>
              <RewardChip kind="card" label="Gold flair" />
            </div>
            <ProgressBar
              done={Math.max(0, 72 - featured.expiresInHours)}
              total={72}
              tone={featured.expiresInHours < 12 ? "warn" : "primary"}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => act(featured.id, "accepted")}>
                <Check className="mr-1 h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => act(featured.id, "declined")}>
                <X className="mr-1 h-3.5 w-3.5" /> Decline
              </Button>
            </div>
          </div>
        )}
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open trades"      value={String(summary.open)}            icon={Repeat2} tone="primary" />
        <StatCard label="Wishlist chances" value={String(summary.wishlistChances)} icon={Heart}   tone="warning" />
        <StatCard label="Legendary"        value={String(summary.legendary)}       icon={Crown}   tone="primary" />
        <StatCard label="Accepted"         value={String(summary.accepted)}        tone="success" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="open">
            Open<span className="ml-1.5 text-[10px] text-muted-foreground">{open.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            History<span className="ml-1.5 text-[10px] text-muted-foreground">{history.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4">
          <OfferList items={open} onAction={act} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryList items={history} />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/gold-flair"
          icon={Crown}
          tone="warning"
          title="See your full Gold Flair collection"
          hint="Track which legendary cards you still need to chase."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/trades"   icon={Repeat2} title="All trades" hint="Standard and event trades." />
        <CrossLink to="/wishlist" icon={Heart}   title="Wishlist"   hint="Mark what you want first." />
        <CrossLink to="/cards"    icon={Star}    title="My Cards"   hint="See what you already own." />
      </div>
    </>
  );
}

function OfferList({
  items, onAction,
}: { items: Offer[]; onAction: (id: string, state: "accepted" | "declined") => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No open Gold Flair trades right now.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((o) => {
        const urgent = o.expiresInHours < 12;
        const hot = o.receive.wishlistMatch;
        return (
          <div key={o.id} className={cn(
            "flex flex-col gap-3 rounded-lg border bg-background/30 p-3 sm:flex-row sm:items-center",
            hot ? "border-warning/40 bg-warning/5" : urgent ? "border-destructive/40" : "border-border",
          )}>
            <div className="flex flex-wrap items-center gap-2 sm:flex-1">
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase", TIER_STYLE[o.give.tier])}>
                {o.give.name}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase", TIER_STYLE[o.receive.tier])}>
                {o.receive.name}
              </Badge>
              {hot && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
                  <Heart className="h-3 w-3" /> wishlist
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:flex-1">
              <span>From {o.partner}</span>
              <span>·</span>
              <span className={urgent ? "text-warning" : ""}>{formatExpiry(o.expiresInHours)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => onAction(o.id, "accepted")}>
                <Check className="mr-1 h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction(o.id, "declined")}>
                <X className="mr-1 h-3.5 w-3.5" /> Decline
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({ items }: { items: Offer[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No completed trades yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((o) => (
        <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
          <div className={cn(
            "grid h-8 w-8 place-items-center rounded-md",
            o.state === "accepted" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}>
            {o.state === "accepted" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{o.give.name} → {o.receive.name}</div>
            <div className="text-[11px] text-muted-foreground">From {o.partner}</div>
          </div>
          <Badge variant="outline" className={cn(
            "h-5 border-transparent text-[10px] font-semibold uppercase",
            o.state === "accepted" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}>
            {o.state}
          </Badge>
        </div>
      ))}
    </div>
  );
}
