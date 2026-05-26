import { createFileRoute } from "@tanstack/react-router";
import { Shield, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/trust")({
  head: () => ({ meta: [{ title: "Admin · Trust — Radiant" }] }),
  component: AdminTrust,
});

const flags = [
  { user: "drift_77",   score: 22, signal: "Repeated trade declines", level: "high" },
  { user: "shadowcat",  score: 41, signal: "New account · high volume", level: "med" },
  { user: "vexpoint",   score: 58, signal: "Unusual gift pattern", level: "med" },
  { user: "pivotbloom", score: 78, signal: "Verified · no issues", level: "low" },
];

const level: Record<string, string> = { high: "bg-destructive/15 text-destructive", med: "bg-warning/15 text-warning", low: "bg-success/15 text-success" };

function AdminTrust() {
  return (
    <>
      <PageHeader title="Trust" description="Risk signals across users and counterparties — sort by score, act on outliers." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Avg score" value="74" icon={Shield} tone="success" />
        <StatCard label="High risk" value="3"  tone="danger" icon={AlertTriangle} />
        <StatCard label="Watchlist" value="12" tone="warning" />
        <StatCard label="Verified"  value="884" tone="primary" />
      </div>

      <Section title="Signals" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="px-5 py-3">User</th><th className="px-5 py-3">Signal</th><th className="px-5 py-3 text-right">Score</th><th className="px-5 py-3">Level</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {flags.map((f) => (
              <tr key={f.user} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono">{f.user}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{f.signal}</td>
                <td className="px-5 py-3 text-right text-mono">{f.score}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + level[f.level]}>{f.level}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
