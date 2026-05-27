import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/scheduler")({
  head: () => ({ meta: [{ title: "Admin · Scheduler — Radiant" }] }),
  component: Scheduler,
});

const jobs = [
  { name: "Daily login", cron: "0 4 * * *",  next: "in 6h",   state: "Enabled" },
  { name: "Token rotate", cron: "0 */6 * * *", next: "in 1h", state: "Enabled" },
  { name: "Backup snapshot", cron: "0 2 * * *", next: "in 4h", state: "Enabled" },
  { name: "Weekly digest", cron: "0 9 * * 1", next: "in 3d", state: "Paused" },
];

function Scheduler() {
  return (
    <>
      <PageHeader title="Automation scheduler" description="Cron-style jobs that run unattended across the fleet." actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New job</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Jobs"      value="18" icon={Calendar} />
        <StatCard label="Enabled"   value="14" tone="success" />
        <StatCard label="Paused"    value="4"  tone="warning" />
        <StatCard label="Next run"  value="32m" tone="primary" />
      </div>

      <Section title="Jobs" className="mt-6" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Name</th><th className="px-5 py-3">Cron</th><th className="px-5 py-3">Next</th><th className="px-5 py-3">State</th><th className="px-5 py-3 text-right">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {jobs.map((j) => (
                <tr key={j.name} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium whitespace-nowrap">{j.name}</td>
                  <td className="px-5 py-3 text-mono text-xs text-muted-foreground whitespace-nowrap">{j.cron}</td>
                  <td className="px-5 py-3 text-xs whitespace-nowrap">{j.next}</td>
                  <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] " + (j.state === "Enabled" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{j.state}</Badge></td>
                  <td className="px-5 py-3 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs">Run now</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
