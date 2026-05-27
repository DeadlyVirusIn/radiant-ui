import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, Cpu, Database, Wifi } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Progress } from "@/components/ui/progress";
import { ReadOnlyBadge } from "@/components/admin/ops/ReadOnlyBadge";

export const Route = createFileRoute("/admin/system-health")({
  head: () => ({ meta: [{ title: "Admin · System — Radiant" }] }),
  component: SystemHealth,
});

const checks = [
  { name: "API gateway",  load: 28, status: "healthy" },
  { name: "Scheduler",    load: 42, status: "healthy" },
  { name: "Trader",       load: 64, status: "healthy" },
  { name: "Vault",        load: 18, status: "healthy" },
  { name: "Webhooks",     load: 81, status: "warning" },
];

function SystemHealth() {
  return (
    <>
      <PageHeader
        title="System health"
        description="Service-level readiness and resource saturation. Operational preview — values shown are mock data, not wired to live service probes."
        actions={<ReadOnlyBadge />}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Uptime"   value="99.97%" icon={HeartPulse} tone="success" />
        <StatCard label="CPU avg"  value="38%"    icon={Cpu} />
        <StatCard label="DB connections" value="62 / 200" icon={Database} tone="primary" />
        <StatCard label="Network"  value="412 Mbps" icon={Wifi} />
      </div>

      <Section title="Services" className="mt-6">
        <div className="space-y-3">
          {checks.map((c) => (
            <div key={c.name} className="rounded-lg border border-border bg-background/30 p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <span className={"text-[10px] uppercase font-semibold " + (c.status === "healthy" ? "text-success" : "text-warning")}>{c.status}</span>
              </div>
              <Progress value={c.load} className="mt-2.5 h-1.5" />
              <div className="mt-1 text-right text-mono text-[11px] text-muted-foreground">{c.load}% load</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
