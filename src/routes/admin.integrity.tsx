import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/integrity")({
  head: () => ({ meta: [{ title: "Admin · Integrity — Radiant" }] }),
  component: Integrity,
});

const checks = [
  { name: "Inventory parity",  result: "Pass", drift: 0 },
  { name: "Trade ledger hash", result: "Pass", drift: 0 },
  { name: "Account snapshots", result: "Drift", drift: 3 },
  { name: "Bot token freshness", result: "Pass", drift: 0 },
];

function Integrity() {
  return (
    <>
      <PageHeader title="System integrity" description="Cross-system consistency checks and reconciliation reports." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Checks"  value="48" icon={ShieldCheck} />
        <StatCard label="Passing" value="46" tone="success" />
        <StatCard label="Drift"   value="2"  tone="warning" icon={AlertTriangle} />
        <StatCard label="Last run" value="6m ago" tone="primary" />
      </div>

      <Section title="Latest run" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-5 py-3">Check</th><th className="px-5 py-3">Result</th><th className="px-5 py-3 text-right">Drift</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {checks.map((c) => (
              <tr key={c.name} className="hover:bg-accent/40">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] " + (c.result === "Pass" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{c.result}</Badge></td>
                <td className="px-5 py-3 text-right text-mono">{c.drift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
