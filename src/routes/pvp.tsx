import { createFileRoute } from "@tanstack/react-router";
import { Medal, Crown } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/pvp")({
  head: () => ({ meta: [{ title: "PvP rankings — Radiant" }] }),
  component: Pvp,
});

const ladder = [
  { rank: 1, name: "DeepCurrent", rating: 2840, tier: "Master" },
  { rank: 2, name: "Halcyon77",   rating: 2792, tier: "Master" },
  { rank: 3, name: "Aurora-X",    rating: 2754, tier: "Master" },
  { rank: 4, name: "VantaPrime",  rating: 2701, tier: "Diamond" },
  { rank: 5, name: "EmberFox",    rating: 2688, tier: "Diamond" },
  { rank: 6, name: "DeadlyVirus", rating: 1824, tier: "Gold", you: true },
];

const tierStyle: Record<string, string> = {
  Master: "bg-warning/15 text-warning",
  Diamond: "bg-primary/15 text-primary",
  Gold: "bg-success/15 text-success",
};

function Pvp() {
  return (
    <>
      <PageHeader title="PvP rankings" description="Live ladder, your placement, and the path to the next tier." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Your rank"  value="#1,284" icon={Medal} tone="primary" />
        <StatCard label="Rating"     value="1,824"  tone="success" delta={{ value: "+38", direction: "up" }} />
        <StatCard label="Tier"       value="Gold I" icon={Crown} tone="warning" />
        <StatCard label="To Platinum" value="176 pts" />
      </div>

      <Section title="Top of ladder" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3 w-12">#</th>
              <th className="px-5 py-3">Player</th>
              <th className="px-5 py-3">Tier</th>
              <th className="px-5 py-3 text-right">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ladder.map((r) => (
              <tr key={r.rank} className={"hover:bg-accent/40 " + (r.you ? "bg-primary/5" : "")}>
                <td className="px-5 py-3 text-mono text-sm font-semibold">{r.rank}</td>
                <td className="px-5 py-3 font-medium">{r.name} {r.you && <span className="ml-1 text-[10px] uppercase text-primary">You</span>}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + tierStyle[r.tier]}>{r.tier}</Badge></td>
                <td className="px-5 py-3 text-right text-mono">{r.rating.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
