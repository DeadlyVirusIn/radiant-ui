import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/hunt-bots")({
  head: () => ({ meta: [{ title: "Admin · Hunt bots — Radiant" }] }),
  component: HuntBots,
});

const bots = Array.from({ length: 14 }).map((_, i) => ({
  id: `hbot-${(i + 1).toString().padStart(2, "0")}`,
  role: ["scout", "harvest", "trade"][i % 3],
  state: i % 6 === 0 ? "Paused" : "Running",
  hunts: 2 + (i % 5),
}));

function HuntBots() {
  return (
    <>
      <PageHeader title="Hunt bots" description="Dedicated bots reserved for hunt sessions — assign roles and pool counts." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Hunt bots" value="14" icon={Bot} />
        <StatCard label="Scouts"    value="5"  tone="primary" />
        <StatCard label="Harvest"   value="5"  tone="success" />
        <StatCard label="Trade"     value="4"  tone="warning" />
      </div>

      <Section title="Pool" className="mt-6" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">ID</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">State</th><th className="px-5 py-3 text-right">Hunts</th><th className="px-5 py-3 text-right">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {bots.map((b) => (
                <tr key={b.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3 text-mono text-xs whitespace-nowrap">{b.id}</td>
                  <td className="px-5 py-3 capitalize">{b.role}</td>
                  <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] " + (b.state === "Running" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{b.state}</Badge></td>
                  <td className="px-5 py-3 text-right text-mono">{b.hunts}</td>
                  <td className="px-5 py-3 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs">Inspect</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
