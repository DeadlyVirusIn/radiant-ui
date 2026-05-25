import { createFileRoute } from "@tanstack/react-router";
import { Sparkle, Filter } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/godpacks")({
  head: () => ({ meta: [{ title: "God Packs — Radiant" }] }),
  component: GodPacks;
});

const gp = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  account: ["Aurora-01", "Vanta-02", "Halcyon-EU"][i % 3],
  set: ["Genesis Echo", "Sovereign Loop", "Aurora Pact"][i % 3],
  value: 2400 + i * 180,
  opened: i % 3 === 0,
}));

function GodPacks() {
  return (
    <>
      <PageHeader title="God Pack gallery" description="Every premium pack opened across the fleet, with provenance and yield." actions={<Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Filter</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="God Packs (all time)" value="84" icon={Sparkle} tone="warning" />
        <StatCard label="Opened today" value="3" tone="success" />
        <StatCard label="Total yield" value="184k dust" tone="primary" />
        <StatCard label="Hit rate" value="2.4%" />
      </div>

      <Section title="Gallery" className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {gp.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-card/60">
              <div className="relative aspect-square bg-gradient-to-br from-warning/30 via-primary/10 to-card">
                <Badge className="absolute left-2 top-2 border-transparent bg-warning/90 text-[10px] uppercase text-warning-foreground">God Pack</Badge>
                {p.opened && <Badge className="absolute right-2 top-2 border-transparent bg-success/90 text-[10px] uppercase text-success-foreground">Opened</Badge>}
              </div>
              <div className="p-3">
                <div className="truncate text-xs font-semibold">{p.set}</div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{p.account}</span>
                  <span className="text-mono text-warning">{p.value.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
