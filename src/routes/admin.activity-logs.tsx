import { createFileRoute } from "@tanstack/react-router";
import { ScrollText, Filter } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/activity-logs")({
  head: () => ({ meta: [{ title: "Admin · Activity logs — Radiant" }] }),
  component: ActivityLogs,
});

const logs = Array.from({ length: 14 }).map((_, i) => ({
  t: new Date(Date.now() - i * 60_000 * 7).toISOString().slice(11, 19),
  who: ["alex", "jules", "nelle", "system", "kiera"][i % 5],
  what: ["Resumed hunt H-2104", "Created auto-share rule", "Removed friend", "Token rotated", "Paused bot-09"][i % 5],
  level: i % 5 === 3 ? "info" : i % 4 === 0 ? "warn" : "info",
}));

const lvl: Record<string, string> = { info: "bg-primary/15 text-primary", warn: "bg-warning/15 text-warning", error: "bg-destructive/15 text-destructive" };

function ActivityLogs() {
  return (
    <>
      <PageHeader title="Activity logs" description="Operator and system actions across the workspace." actions={<Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Filter</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Events 24h" value="2,103" icon={ScrollText} />
        <StatCard label="Warnings"   value="14" tone="warning" />
        <StatCard label="Errors"     value="2"  tone="danger" />
        <StatCard label="Operators"  value="9"  tone="primary" />
      </div>

      <Section title="Stream" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-5 py-3 w-24">Time</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Level</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {logs.map((l, i) => (
              <tr key={i} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{l.t}</td>
                <td className="px-5 py-3 text-mono text-xs">{l.who}</td>
                <td className="px-5 py-3">{l.what}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + lvl[l.level]}>{l.level}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
