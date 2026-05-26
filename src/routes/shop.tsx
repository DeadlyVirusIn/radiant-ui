import { createFileRoute } from "@tanstack/react-router";
import { Store, Tag } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "Item shop — Radiant" }] }),
  component: Shop,
});

const items = [
  { name: "Pack bundle ×6", cost: "12 tickets", tag: "Best value" },
  { name: "Premier pack",   cost: "3 premier", tag: "" },
  { name: "Shine dust 500", cost: "60 coins",  tag: "" },
  { name: "Sleeve · Aurora",cost: "80 coins",  tag: "New" },
  { name: "Sleeve · Vanta", cost: "80 coins",  tag: "" },
  { name: "Avatar frame · Gold", cost: "240 coins", tag: "Limited" },
];

function Shop() {
  return (
    <>
      <PageHeader title="Item shop" description="Rotating premium items, bundles and cosmetics." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Coins"   value="142,800" icon={Store} tone="warning" />
        <StatCard label="Tickets" value="312" />
        <StatCard label="Premier" value="18" tone="primary" />
        <StatCard label="Daily deal" value="Pack ×6" tone="success" />
      </div>

      <Section title="Today" className="mt-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.name} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="aspect-square rounded-lg bg-gradient-to-br from-primary/20 to-card" />
              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{it.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{it.cost}</div>
                </div>
                {it.tag && <Badge variant="outline" className="border-transparent bg-warning/15 text-warning text-[9px] uppercase">{it.tag}</Badge>}
              </div>
              <Button className="mt-3 w-full" size="sm">Buy</Button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
