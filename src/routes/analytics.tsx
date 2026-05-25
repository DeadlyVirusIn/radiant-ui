import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Radiant" }] }),
  component: Analytics,
});

function Analytics() {
  const bars = Array.from({ length: 30 }).map((_, i) => 20 + Math.round(Math.abs(Math.sin(i * 0.4)) * 70 + (i % 6) * 3));

  return (
    <>
      <PageHeader title="Analytics" description="Throughput, yield and reliability — week-over-week trends." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Trades (7d)"   value="16,402" delta={{ value: "+9%",  direction: "up" }}   icon={BarChart3} tone="primary" />
        <StatCard label="Gold yield"    value="1,184"  delta={{ value: "+12%", direction: "up" }}   tone="warning" />
        <StatCard label="Uptime"        value="99.94%" delta={{ value: "+0.02pp", direction: "up" }} tone="success" />
        <StatCard label="Cost / trade"  value="$0.014" delta={{ value: "−$0.002", direction: "down" }} />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card/60 p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">Settlements · last 30 days</h2>
            <p className="text-xs text-muted-foreground">Daily totals across all regions</p>
          </div>
        </div>
        <div className="mt-5 flex h-56 items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="group relative flex-1">
              <div className="rounded-sm bg-gradient-to-t from-primary/40 to-primary transition-all group-hover:from-primary group-hover:to-primary/80" style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Top items by yield</h3>
          <ul className="mt-4 space-y-3">
            {[
              { name: "Solar Crown", v: 412, pct: 92 },
              { name: "Aureate Sigil", v: 318, pct: 71 },
              { name: "Gilded Pact", v: 244, pct: 54 },
              { name: "Halcyon Mark", v: 198, pct: 44 },
              { name: "Embered Vow", v: 132, pct: 29 },
            ].map((row) => (
              <li key={row.name} className="flex items-center gap-3 text-sm">
                <div className="w-32 truncate">{row.name}</div>
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-warning" style={{ width: `${row.pct}%` }} />
                </div>
                <div className="w-12 text-right text-mono text-xs text-muted-foreground">{row.v}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Region split</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { r: "EU-W", v: 6240, pct: 38, c: "bg-primary" },
              { r: "US-E", v: 5180, pct: 32, c: "bg-success" },
              { r: "US-W", v: 3120, pct: 19, c: "bg-warning" },
              { r: "APAC", v: 1862, pct: 11, c: "bg-chart-5" },
            ].map((row) => (
              <li key={row.r} className="flex items-center gap-3">
                <div className="w-14 text-mono text-xs text-muted-foreground">{row.r}</div>
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div className={"h-full rounded-full " + row.c} style={{ width: `${row.pct}%` }} />
                </div>
                <div className="w-14 text-right text-mono text-xs">{row.v}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
