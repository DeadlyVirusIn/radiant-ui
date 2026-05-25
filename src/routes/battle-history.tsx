import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/battle-history")({
  head: () => ({ meta: [{ title: "Battle history — Radiant" }] }),
  component: BattleHistory,
});

const games = Array.from({ length: 12 }).map((_, i) => ({
  id: `B-${5240 - i}`,
  mode: ["Solo", "Event", "Random"][i % 3],
  opp: ["Nelle", "Jules", "Arden", "Kiera"][i % 4],
  result: i % 4 === 0 ? "loss" : "win",
  time: `${i + 2}m`,
  delta: i % 4 === 0 ? -18 : 12,
}));

function BattleHistory() {
  return (
    <>
      <PageHeader title="Battle history" description="Every match, with opponent, mode, rating delta and replay link." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Matches"    value="248" icon={History} />
        <StatCard label="Win rate"   value="73%" tone="success" />
        <StatCard label="Best streak" value="14"  tone="primary" />
        <StatCard label="Rating"     value="1,824" delta={{ value: "+38", direction: "up" }} />
      </div>

      <Section title="Recent matches" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Match</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Opponent</th>
              <th className="px-5 py-3">Result</th>
              <th className="px-5 py-3 text-right">Δ rating</th>
              <th className="px-5 py-3 text-right">Length</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {games.map((g) => (
              <tr key={g.id} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{g.id}</td>
                <td className="px-5 py-3">{g.mode}</td>
                <td className="px-5 py-3">{g.opp}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + (g.result === "win" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{g.result}</Badge></td>
                <td className={"px-5 py-3 text-right text-mono " + (g.delta > 0 ? "text-success" : "text-destructive")}>{g.delta > 0 ? "+" : ""}{g.delta}</td>
                <td className="px-5 py-3 text-right text-mono text-xs text-muted-foreground">{g.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
