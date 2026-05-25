import { createFileRoute } from "@tanstack/react-router";
import { Target, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/tracker")({
  head: () => ({ meta: [{ title: "Tracker — Radiant" }] }),
  component: Tracker,
});

const sets = [
  { name: "Genesis Echo",   owned: 142, total: 180, rare: 18, total_rare: 24 },
  { name: "Aurora Pact",    owned: 96,  total: 160, rare: 9,  total_rare: 22 },
  { name: "Sovereign Loop", owned: 64,  total: 140, rare: 4,  total_rare: 20 },
  { name: "Halcyon Mark",   owned: 188, total: 200, rare: 22, total_rare: 24 },
];

function Tracker() {
  return (
    <>
      <PageHeader title="Tracker" description="Progress toward set completion and missing card highlights." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sets tracked" value="14" icon={Target} />
        <StatCard label="Cards owned"  value="490 / 680" tone="primary" />
        <StatCard label="Completion"   value="72%" tone="success" delta={{ value: "+3%", direction: "up" }} />
        <StatCard label="Missing rare" value="49" tone="warning" icon={TrendingUp} />
      </div>

      <Section title="Set progress" className="mt-6">
        <div className="space-y-4">
          {sets.map((s) => {
            const pct = Math.round((s.owned / s.total) * 100);
            const rarePct = Math.round((s.rare / s.total_rare) * 100);
            return (
              <div key={s.name} className="rounded-lg border border-border bg-background/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-mono text-xs text-muted-foreground">{s.owned}/{s.total}</div>
                </div>
                <Progress value={pct} className="mt-2.5 h-1.5" />
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Rare completion</span>
                  <span className="text-mono">{s.rare}/{s.total_rare} ({rarePct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
