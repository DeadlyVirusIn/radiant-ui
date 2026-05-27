import { createFileRoute } from "@tanstack/react-router";
import { Database, Cpu, Network, HardDrive, Gauge } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/capacity")({
  head: () => ({ meta: [{ title: "Admin · Capacity — Radiant" }] }),
  component: Capacity,
});

type Pool = {
  name: string;
  icon: typeof Database;
  used: number;
  max: number;
  unit?: string;
  hint: string;
};

const pools: Pool[] = [
  { name: "Hunt workers",   icon: Cpu,      used: 32,  max: 50,   hint: "Concurrent hunters dispatched across the fleet." },
  { name: "Trade workers",  icon: Cpu,      used: 18,  max: 40,   hint: "Concurrent trade reconciliation workers." },
  { name: "DB connections", icon: Database, used: 62,  max: 200,  hint: "Primary cluster connection pool." },
  { name: "Storage",        icon: HardDrive, used: 412, max: 1000, unit: "GB", hint: "Persisted object storage usage." },
  { name: "Egress",         icon: Network,  used: 184, max: 500,  unit: "Mbps", hint: "Sustained outbound bandwidth." },
];

function toneFor(pct: number): "default" | "warning" | "danger" {
  if (pct >= 85) return "danger";
  if (pct >= 70) return "warning";
  return "default";
}

function Capacity() {
  const hotPool = [...pools].sort((a, b) => b.used / b.max - a.used / a.max)[0];
  const hotPct = Math.round((hotPool.used / hotPool.max) * 100);
  const avgPct = Math.round(
    (pools.reduce((s, p) => s + p.used / p.max, 0) / pools.length) * 100,
  );

  return (
    <div className="min-w-0">
      <PageHeader
        title="Capacity verdict"
        description="Headroom across the worker pools and data stores. Operational preview — mock data, not wired to live telemetry."
        actions={
          <Badge variant="outline" className="h-6 border-warning/40 bg-warning/10 text-[10px] font-semibold uppercase tracking-wider text-warning">
            Mock data · read-only
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Headroom"      value={`${100 - avgPct}%`} icon={Gauge}    tone={avgPct >= 70 ? "warning" : "success"} />
        <StatCard label="Avg utilization" value={`${avgPct}%`}      icon={Database} tone="primary" />
        <StatCard label="Hot pool"      value={hotPool.name}        icon={Cpu}      tone={toneFor(hotPct)} />
        <StatCard label="Hot pool load" value={`${hotPct}%`}        icon={Gauge}    tone={toneFor(hotPct)} />
        <StatCard label="Forecast"      value="~3 weeks"            icon={Network} />
      </div>

      <Section title="Pool utilization" className="mt-6">
        <div className="space-y-3">
          {pools.map((p) => {
            const pct = Math.round((p.used / p.max) * 100);
            const tone = toneFor(pct);
            return (
              <div key={p.name} className="rounded-lg border border-border bg-background/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <p.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.hint}</div>
                    </div>
                  </div>
                  <div className="text-mono shrink-0 text-right text-xs">
                    <div>{p.used} / {p.max}{p.unit ? ` ${p.unit}` : ""}</div>
                    <div className={
                      tone === "danger" ? "text-destructive" :
                      tone === "warning" ? "text-warning" :
                      "text-muted-foreground"
                    }>{pct}%</div>
                  </div>
                </div>
                <Progress value={pct} className="mt-2.5 h-1.5" />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Notes" className="mt-4">
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>· Auto-scaling and burst credits are not surfaced in this preview.</li>
          <li>· Forecast is a static placeholder. Live capacity projection ships with the controls phase.</li>
          <li>· No actions exposed here — capacity adjustments require the dedicated control surface.</li>
        </ul>
      </Section>
    </div>
  );
}
