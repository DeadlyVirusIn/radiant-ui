import { createFileRoute } from "@tanstack/react-router";
import { FileSearch, Filter } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({ meta: [{ title: "Admin · Audit log — Radiant" }] }),
  component: AuditLog,
});

const events = Array.from({ length: 14 }).map((_, i) => ({
  t: new Date(Date.now() - i * 86_400_000 / 14).toISOString().slice(0, 16).replace("T", " "),
  actor: ["alex", "jules", "system", "nelle"][i % 4],
  scope: ["users", "fleet", "trades", "config"][i % 4],
  action: ["created", "updated", "deleted", "approved"][i % 4],
  target: `obj-${1000 + i}`,
}));

function AuditLog() {
  return (
    <>
      <PageHeader title="Audit log" description="Immutable record of every change made through Radiant." actions={<Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Filter</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Events"      value="48,210" icon={FileSearch} />
        <StatCard label="Today"       value="312"   tone="primary" />
        <StatCard label="By system"   value="60%"   tone="success" />
        <StatCard label="Retained"    value="365 d" />
      </div>

      <Section title="Events" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-5 py-3">When</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Scope</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Target</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {events.map((e, i) => (
              <tr key={i} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{e.t}</td>
                <td className="px-5 py-3 text-mono text-xs">{e.actor}</td>
                <td className="px-5 py-3"><Badge variant="outline" className="h-5 border-transparent bg-muted text-[10px] text-muted-foreground">{e.scope}</Badge></td>
                <td className="px-5 py-3 capitalize">{e.action}</td>
                <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{e.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
