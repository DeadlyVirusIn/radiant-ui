import { createFileRoute } from "@tanstack/react-router";
import { PackageOpen, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/open-pack")({
  head: () => ({ meta: [{ title: "Open pack — Radiant" }] }),
  component: OpenPack,
});

const packs = [
  { name: "Genesis Echo", cost: "12 hourglasses", odds: "Standard", color: "from-primary/40" },
  { name: "Aurora Pact",  cost: "12 hourglasses", odds: "Standard", color: "from-success/40" },
  { name: "Premier Bundle", cost: "3 premier",    odds: "Boosted",  color: "from-warning/40" },
];

function OpenPack() {
  return (
    <>
      <PageHeader title="Open pack" description="Spend hourglasses or tickets to open a pack and see the result instantly." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Packs available" value="107" icon={PackageOpen} tone="primary" />
        <StatCard label="Opened today"   value="14" tone="success" />
        <StatCard label="Rare hits"      value="4"  tone="warning" />
        <StatCard label="Avg yield"      value="84 dust" />
      </div>

      <Section title="Choose a pack" className="mt-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {packs.map((p) => (
            <div key={p.name} className="overflow-hidden rounded-xl border border-border bg-card/60">
              <div className={"relative aspect-[3/4] bg-gradient-to-br " + p.color + " via-card to-card"}>
                <Sparkles className="absolute right-3 top-3 h-4 w-4 text-warning" />
              </div>
              <div className="p-4">
                <div className="font-display text-sm font-semibold">{p.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{p.cost} · {p.odds} odds</div>
                <Button className="mt-3 w-full" size="sm">Open</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
