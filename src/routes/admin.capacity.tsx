import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/admin/capacity")({
  head: () => ({ meta: [{ title: "Admin · Capacity — Radiant" }] }),
  component: Capacity,
});

const pools = [
  { name: "Hunt workers",  used: 32, max: 50 },
  { name: "Trade workers", used: 18, max: 40 },
  { name: "DB connections", used: 62, max: 200 },
  { name: "Storage",       used: 412, max: 1000 },
];

function Capacity() {
  return (
    <>
      <PageHeader title="Capacity verdict" description="Headroom across the worker pools and data stores." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Headroom"      value="58%" icon={Database} tone="success" />
        <StatCard label="Hot pool"      value="Trade" tone="warning" />
        <StatCard label="Capacity used" value="42%" tone="primary" />
        <StatCard label="Forecast"      value="3 weeks" />
      </div>

      <Section title="Pools" className="mt-6">
        <div className="space-y-3">
          {pools.map((p) => {
            const pct = (p.used / p.max) * 100;
            return (
              <div key={p.name} className="rounded-lg border border-border bg-background/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-mono text-xs text-muted-foreground">{p.used} / {p.max}</div>
                </div>
                <Progress value={pct} className="mt-2.5 h-1.5" />
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
