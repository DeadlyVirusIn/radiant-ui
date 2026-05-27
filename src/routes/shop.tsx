import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Store, Ticket, Sparkles, Package as PackageIcon, Hourglass, Crown,
  PackageOpen, Heart, Gift, ArrowRight,
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

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "Shop — Radiant" }] }),
  component: ShopPage,
});

type Tab = "daily" | "bundles" | "cosmetics";
type Item = {
  id: string;
  name: string;
  tab: Tab;
  cost: { kind: RewardKind; amount: number; label: string };
  reward: { kind: RewardKind; label: string };
  highlight?: "best-value" | "limited" | "new";
  capLeft?: number;
  capTotal?: number;
};

const WALLET = { tickets: 312, hourglasses: 18, dust: 1480, packs: 4 };

const ITEMS: Item[] = [
  { id: "i1", name: "Pack bundle ×6",   tab: "daily",   cost: { kind: "ticket",    amount: 12,  label: "12 tickets" }, reward: { kind: "pack",      label: "6 packs" },     highlight: "best-value", capLeft: 1, capTotal: 1 },
  { id: "i2", name: "Premier pack",     tab: "daily",   cost: { kind: "hourglass", amount: 3,   label: "3 hourglasses" }, reward: { kind: "pack",      label: "1 premier" },   capLeft: 2, capTotal: 3 },
  { id: "i3", name: "Wonder ticket",    tab: "daily",   cost: { kind: "dust",      amount: 60,  label: "60 dust" },  reward: { kind: "ticket",    label: "1 ticket" },                       capLeft: 4, capTotal: 5 },
  { id: "i4", name: "Hourglass ×5",     tab: "bundles", cost: { kind: "dust",      amount: 240, label: "240 dust" }, reward: { kind: "hourglass", label: "5 hourglasses" } },
  { id: "i5", name: "Pack bundle ×3",   tab: "bundles", cost: { kind: "ticket",    amount: 7,   label: "7 tickets" },reward: { kind: "pack",      label: "3 packs" } },
  { id: "i6", name: "Dust crate",       tab: "bundles", cost: { kind: "ticket",    amount: 4,   label: "4 tickets" },reward: { kind: "dust",      label: "+800 dust" } },
  { id: "i7", name: "Sleeve · Aurora",  tab: "cosmetics", cost: { kind: "dust",    amount: 800, label: "800 dust" }, reward: { kind: "card",      label: "Sleeve" },     highlight: "new" },
  { id: "i8", name: "Sleeve · Vanta",   tab: "cosmetics", cost: { kind: "dust",    amount: 800, label: "800 dust" }, reward: { kind: "card",      label: "Sleeve" } },
  { id: "i9", name: "Frame · Gold",     tab: "cosmetics", cost: { kind: "dust",    amount: 2400,label: "2,400 dust" }, reward: { kind: "card",    label: "Frame" },      highlight: "limited" },
];

function ShopPage() {
  const [bought, setBought] = useState<Set<string>>(new Set());

  const featured = useMemo(
    () => ITEMS.find((i) => i.highlight === "best-value") ?? ITEMS[0],
    [],
  );

  const buy = (id: string) => {
    const it = ITEMS.find((i) => i.id === id);
    if (!it) return;
    setBought((prev) => new Set(prev).add(id));
    toast.success(`Claimed ${it.reward.label}`);
  };

  return (
    <>
      <PageHeader
        title="Shop"
        description="Spend tickets, hourglasses, and dust on packs, bundles, and cosmetics."
      />

      <Hero
        eyebrow="Today's best value"
        eyebrowIcon={Sparkles}
        title={featured.name}
        subtitle={`Pays back roughly ${featured.reward.label} for ${featured.cost.label}.`}
        right={<ShopTotem />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <RewardChip kind={featured.reward.kind} label={featured.reward.label} />
              <span className="text-muted-foreground">for</span>
              <RewardChip kind={featured.cost.kind} label={featured.cost.label} />
            </div>
            {featured.capLeft != null && featured.capTotal != null && (
              <span className="text-[11px] text-muted-foreground">
                {featured.capLeft} of {featured.capTotal} left today
              </span>
            )}
          </div>
          {featured.capLeft != null && featured.capTotal != null && (
            <ProgressBar
              done={featured.capTotal - featured.capLeft}
              total={featured.capTotal}
              tone="success"
            />
          )}
          <div className="mt-3">
            <Button size="sm" onClick={() => buy(featured.id)} disabled={bought.has(featured.id)}>
              <Store className="mr-1 h-3.5 w-3.5" /> {bought.has(featured.id) ? "Claimed" : "Buy now"}
            </Button>
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tickets"     value={String(WALLET.tickets)}      icon={Ticket}       tone="primary" />
        <StatCard label="Hourglasses" value={String(WALLET.hourglasses)}  icon={Hourglass}    tone="warning" />
        <StatCard label="Dust"        value={WALLET.dust.toLocaleString()} icon={Sparkles}    tone="success" />
        <StatCard label="Packs ready" value={String(WALLET.packs)}        icon={PackageIcon} />
      </div>

      <Tabs defaultValue="daily" className="mt-6">
        <TabsList>
          <TabsTrigger value="daily">Daily deals</TabsTrigger>
          <TabsTrigger value="bundles">Bundles</TabsTrigger>
          <TabsTrigger value="cosmetics">Cosmetics</TabsTrigger>
        </TabsList>
        {(["daily", "bundles", "cosmetics"] as Tab[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <ItemGrid items={ITEMS.filter((i) => i.tab === t)} bought={bought} onBuy={buy} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/open-pack"
          icon={PackageOpen}
          tone="primary"
          title="Open the packs you just bought"
          hint="Packs land in your inventory and are ready to open immediately."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/missions"  icon={Sparkles} title="Missions"     hint="Earn tickets and hourglasses." />
        <CrossLink to="/presents"  icon={Gift}     title="Present Box"  hint="Free rewards waiting to claim." />
        <CrossLink to="/wishlist"  icon={Heart}    title="Wishlist"     hint="Plan what to chase next." />
      </div>
    </>
  );
}

function ItemGrid({
  items, bought, onBuy,
}: { items: Item[]; bought: Set<string>; onBuy: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Nothing in this tab yet.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const owned = bought.has(it.id);
        return (
          <div key={it.id} className={cn(
            "flex flex-col gap-3 rounded-xl border bg-background/30 p-4",
            it.highlight === "best-value" ? "border-warning/40 bg-warning/5" : "border-border",
          )}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{it.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Get {it.reward.label}
                </div>
              </div>
              {it.highlight && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 border-transparent text-[10px] font-semibold uppercase",
                    it.highlight === "best-value" && "bg-warning/15 text-warning",
                    it.highlight === "new"        && "bg-success/15 text-success",
                    it.highlight === "limited"    && "bg-primary/15 text-primary",
                  )}
                >
                  {it.highlight === "best-value" ? "Best value" : it.highlight}
                </Badge>
              )}
            </div>

            {it.capLeft != null && it.capTotal != null && (
              <div className="text-[11px] text-muted-foreground">
                {it.capLeft} of {it.capTotal} left today
                <ProgressBar done={it.capTotal - it.capLeft} total={it.capTotal} tone="primary" />
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <RewardChip kind={it.cost.kind} label={it.cost.label} />
              <Button size="sm" onClick={() => onBuy(it.id)} disabled={owned}>
                {owned ? "Claimed" : "Buy"} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShopTotem() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-warning/15 ring-1 ring-warning/30">
        <Store className="h-7 w-7 text-warning" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily</div>
    </div>
  );
}

// Keep import referenced for navigation parity
void Link;
