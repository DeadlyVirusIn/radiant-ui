import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Download } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trade-analytics")({
  head: () => ({ meta: [{ title: "Trade analytics — Radiant" }] }),
  component: TradeAnalytics,
});

function TradeAnalytics() {
  return (
    <>
      <PageHeader title="Trade analytics" description="Volume, latency and counterparty health across all trade lanes." actions={<Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Trades 24h" value="1,284" icon={BarChart3} tone="primary" delta={{ value: "+8%", direction: "up" }} />
        <StatCard label="Success rate" value="98.4%" tone="success" />
        <StatCard label="Avg latency" value="2.1 s" />
        <StatCard label="Disputed" value="3" tone="danger" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Volume by lane" className="lg:col-span-2">
          <div className="h-48 rounded-lg border border-dashed border-border bg-background/30 p-3 text-xs text-muted-foreground">
            <div className="flex h-full items-end gap-1">
              {Array.from({ length: 28 }).map((_, i) => {
                const h = 20 + ((i * 17) % 70);
                return <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/30 to-primary" style={{ height: `${h}%` }} />;
              })}
            </div>
          </div>
        </Section>

        <Section title="Top counterparties">
          <DataRow label="Aurora-01"  value="312" hint="98.7% success" />
          <DataRow label="Vanta-02"   value="248" hint="98.1% success" />
          <DataRow label="Halcyon-EU" value="201" hint="97.9% success" />
          <DataRow label="Nelle Park" value="148" hint="External · 96%" />
        </Section>
      </div>

      <Section title="Performance" className="mt-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div><div className="text-[11px] uppercase text-muted-foreground">P50 latency</div><div className="mt-1 font-display text-xl font-bold">1.4s</div></div>
          <div><div className="text-[11px] uppercase text-muted-foreground">P95 latency</div><div className="mt-1 font-display text-xl font-bold">3.8s</div></div>
          <div><div className="text-[11px] uppercase text-muted-foreground">P99 latency</div><div className="mt-1 font-display text-xl font-bold">6.2s</div></div>
          <div><div className="text-[11px] uppercase text-muted-foreground">Retries</div><div className="mt-1 font-display text-xl font-bold">12</div></div>
        </div>
      </Section>
    </>
  );
}
