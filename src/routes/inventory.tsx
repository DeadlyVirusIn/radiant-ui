import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Boxes, Ticket, Hourglass, Sparkles, Package as PackageIcon, Star,
  PackageOpen, Store, Wand2,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { REWARD_ICON, type RewardKind } from "@/lib/mock-rewards";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Radiant" }] }),
  component: InventoryPage,
});

type Tab = "currency" | "packs" | "cosmetics";

type Consumable = {
  id: string;
  name: string;
  kind: RewardKind;
  amount: number;
  cap?: number;
  spendsOn: string;
  tab: Tab;
};

type Cosmetic = {
  id: string;
  name: string;
  family: "Sleeve" | "Frame" | "Emote";
  rarity: "common" | "rare" | "legendary";
  equipped?: boolean;
};

const CONSUMABLES: Consumable[] = [
  { id: "c1", name: "Tickets",     kind: "ticket",    amount: 312,  cap: 999,  spendsOn: "Shop, Wonder Pick", tab: "currency" },
  { id: "c2", name: "Hourglasses", kind: "hourglass", amount: 18,   cap: 50,   spendsOn: "Premier packs",     tab: "currency" },
  { id: "c3", name: "Dust",        kind: "dust",      amount: 1480, cap: 9999, spendsOn: "Cosmetics, bundles",tab: "currency" },
  { id: "p1", name: "Standard packs", kind: "pack",   amount: 4,    cap: 20,   spendsOn: "Open Pack",         tab: "packs" },
  { id: "p2", name: "Premier packs",  kind: "pack",   amount: 1,    cap: 5,    spendsOn: "Open Pack",         tab: "packs" },
  { id: "p3", name: "Event packs",    kind: "pack",   amount: 2,    cap: 10,   spendsOn: "Open Pack",         tab: "packs" },
];

const COSMETICS: Cosmetic[] = [
  { id: "k1", name: "Aurora",       family: "Sleeve", rarity: "rare",      equipped: true },
  { id: "k2", name: "Vanta",        family: "Sleeve", rarity: "rare" },
  { id: "k3", name: "Halcyon",      family: "Sleeve", rarity: "common" },
  { id: "k4", name: "Gold frame",   family: "Frame",  rarity: "legendary", equipped: true },
  { id: "k5", name: "Silver frame", family: "Frame",  rarity: "rare" },
  { id: "k6", name: "Spark emote",  family: "Emote",  rarity: "common" },
  { id: "k7", name: "Crown emote",  family: "Emote",  rarity: "rare" },
];

const RARITY_STYLE: Record<Cosmetic["rarity"], string> = {
  legendary: "bg-warning/15 text-warning",
  rare:      "bg-primary/15 text-primary",
  common:    "bg-muted text-muted-foreground",
};

function InventoryPage() {
  const featured = useMemo(() => {
    // Lowest cap utilization = "you should spend this"
    return [...CONSUMABLES]
      .filter((c) => c.cap)
      .sort((a, b) => (b.amount / (b.cap ?? 1)) - (a.amount / (a.cap ?? 1)))[0];
  }, []);

  const FeaturedIcon = REWARD_ICON[featured.kind];

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Your wallet, packs ready to open, and the cosmetics you've earned."
      />

      <Hero
        eyebrow="Closest to cap"
        eyebrowIcon={Sparkles}
        title={featured.name}
        subtitle={`You're holding ${featured.amount.toLocaleString()}${featured.cap ? ` of ${featured.cap.toLocaleString()}` : ""} — spend before they cap out.`}
        right={
          <div className="flex flex-col items-center gap-1">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
              <FeaturedIcon className="h-7 w-7 text-primary" />
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{featured.name}</div>
          </div>
        }
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          {featured.cap && (
            <ProgressBar done={featured.amount} total={featured.cap}
              tone={featured.amount / featured.cap > 0.8 ? "warn" : "primary"} />
          )}
          <div className="mt-2 text-[11px] text-muted-foreground">
            Spends on {featured.spendsOn}.
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tickets"     value="312"    icon={Ticket}      tone="primary" />
        <StatCard label="Hourglasses" value="18"     icon={Hourglass}   tone="warning" />
        <StatCard label="Dust"        value="1,480"  icon={Sparkles}    tone="success" />
        <StatCard label="Packs ready" value="7"      icon={PackageIcon} />
      </div>

      <Tabs defaultValue="currency" className="mt-6">
        <TabsList>
          <TabsTrigger value="currency">Currency</TabsTrigger>
          <TabsTrigger value="packs">Packs</TabsTrigger>
          <TabsTrigger value="cosmetics">Cosmetics</TabsTrigger>
        </TabsList>

        <TabsContent value="currency" className="mt-4">
          <ConsumableList items={CONSUMABLES.filter((c) => c.tab === "currency")} />
        </TabsContent>
        <TabsContent value="packs" className="mt-4">
          <ConsumableList items={CONSUMABLES.filter((c) => c.tab === "packs")} />
        </TabsContent>
        <TabsContent value="cosmetics" className="mt-4">
          <CosmeticGrid items={COSMETICS} />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/open-pack"
          icon={PackageOpen}
          tone="primary"
          title="Open the packs you're holding"
          hint="Every pack is one closer to completing your wishlist."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/shop"        icon={Store} title="Shop"        hint="Spend tickets, dust, and hourglasses." />
        <CrossLink to="/wonder-pick" icon={Wand2} title="Wonder Pick" hint="1 ticket per pick." />
        <CrossLink to="/cards"       icon={Star}  title="My Cards"    hint="Cards already in your collection." />
      </div>
    </>
  );
}

function ConsumableList({ items }: { items: Consumable[] }) {
  return (
    <div className="space-y-2">
      {items.map((c) => {
        const Icon = REWARD_ICON[c.kind];
        const pct = c.cap ? Math.round((c.amount / c.cap) * 100) : 0;
        const nearCap = c.cap && c.amount / c.cap > 0.8;
        return (
          <div key={c.id} className={cn(
            "flex items-center gap-3 rounded-lg border bg-background/30 p-3",
            nearCap ? "border-warning/40" : "border-border",
          )}>
            <div className={cn(
              "grid h-9 w-9 place-items-center rounded-md",
              nearCap ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{c.name}</div>
                {nearCap && (
                  <Badge variant="outline" className="h-5 border-warning/40 bg-warning/10 text-[10px] font-semibold text-warning">
                    Near cap
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">Spends on {c.spendsOn}</div>
              {c.cap && <ProgressBar done={c.amount} total={c.cap} tone={nearCap ? "warn" : "primary"} />}
            </div>
            <div className="text-mono text-sm font-semibold tabular-nums">
              {c.amount.toLocaleString()}
              {c.cap && <span className="ml-1 text-[10px] text-muted-foreground">/{c.cap.toLocaleString()} · {pct}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CosmeticGrid({ items }: { items: Cosmetic[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.id} className={cn(
          "flex flex-col gap-2 rounded-xl border bg-background/30 p-3",
          k.equipped ? "border-success/40 bg-success/5" : "border-border",
        )}>
          <div className="aspect-square rounded-lg bg-gradient-to-br from-primary/20 via-card to-card" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{k.name}</div>
              <div className="text-[11px] text-muted-foreground">{k.family}</div>
            </div>
            <RewardChip kind="card" label={k.family} />
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn(
              "h-5 border-transparent text-[10px] font-semibold uppercase",
              RARITY_STYLE[k.rarity],
            )}>
              {k.rarity}
            </Badge>
            {k.equipped && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-success">
                Equipped
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
