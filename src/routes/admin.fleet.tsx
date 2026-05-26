import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, Bot, Wifi } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/fleet")({
  head: () => ({ meta: [{ title: "Admin · Fleet health — Radiant" }] }),
  component: FleetHealth,
});

const fleets = [
  { region: "NA-east", bots: 12, healthy: 11, latency: 98,  alerts: 1 },
  { region: "EU-west", bots: 10, healthy: 10, latency: 124, alerts: 0 },
  { region: "JP",      bots: 8,  healthy: 7,  latency: 218, alerts: 2 },
  { region: "OCE",     bots: 6,  healthy: 6,  latency: 162, alerts: 0 },
];

function FleetHealth() {
  return (
    <>
      <PageHeader title="Fleet health" description="Regional bot pools, healthiness and any in-flight alerts." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Bots online" value="40 / 42" icon={Bot} tone="success" />
        <StatCard label="Open alerts" value="3"   tone="warning" />
        <StatCard label="Avg latency" value="128 ms" icon={Wifi} />
        <StatCard label="Uptime 30d"  value="99.94%" tone="primary" icon={HeartPulse} />
      </div>

      <Section title="By region" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-5 py-3">Region</th><th className="px-5 py-3 text-right">Bots</th><th className="px-5 py-3 text-right">Healthy</th><th className="px-5 py-3 text-right">Latency</th><th className="px-5 py-3 text-right">Alerts</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {fleets.map((f) => (
              <tr key={f.region} className="hover:bg-accent/40">
                <td className="px-5 py-3 font-medium">{f.region}</td>
                <td className="px-5 py-3 text-right text-mono">{f.bots}</td>
                <td className="px-5 py-3 text-right text-mono text-success">{f.healthy}</td>
                <td className="px-5 py-3 text-right text-mono">{f.latency} ms</td>
                <td className="px-5 py-3 text-right">{f.alerts > 0 ? <Badge variant="outline" className="border-transparent bg-warning/15 text-warning">{f.alerts}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
