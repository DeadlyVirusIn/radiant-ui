import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Search, Filter, Grid3x3 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [{ title: "Cards — Radiant" }] }),
  component: Cards,
});

const cards = Array.from({ length: 18 }).map((_, i) => ({
  id: i + 1,
  name: ["Halcyon", "Solar", "Embered", "Quiet", "Pale", "Gilded"][i % 6] + " #" + (i + 101),
  rarity: ["common", "rare", "epic", "legendary"][i % 4],
  qty: Math.floor(Math.random() * 12) + 1,
}));

const rarityStyle: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  rare: "bg-success/15 text-success",
  epic: "bg-primary/15 text-primary",
  legendary: "bg-warning/15 text-warning",
};

function Cards() {
  return (
    <>
      <PageHeader title="Cards" description="Your full card collection across every account." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unique cards" value="412" icon={CreditCard} />
        <StatCard label="Total copies" value="8,914" tone="primary" />
        <StatCard label="Legendaries"  value="38"  tone="warning" />
        <StatCard label="Completion"   value="74%" tone="success" />
      </div>

      <div className="mt-6 flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, set, rarity…" className="h-9 bg-background/40 pl-8" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Filters</Button>
        <Button variant="outline" size="sm" className="gap-1.5"><Grid3x3 className="h-3.5 w-3.5" /> Grid</Button>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.id} className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-all hover:-translate-y-0.5 hover:border-primary/40">
            <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 via-card to-card" />
            <div className="p-3">
              <div className="truncate text-xs font-semibold">{c.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <Badge variant="outline" className={"h-4 border-transparent text-[9px] font-semibold uppercase " + rarityStyle[c.rarity]}>
                  {c.rarity}
                </Badge>
                <span className="text-mono text-[11px] text-muted-foreground">×{c.qty}</span>
              </div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
