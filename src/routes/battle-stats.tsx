import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";

export const Route = createFileRoute("/battle-stats")({
  head: () => ({ meta: [{ title: "Battle stats — Radiant" }] }),
  component: BattleStats,
});

function BattleStats() {
  return (
    <>
      <PageHeader title="Battle stats" description="Aggregate performance across modes, decks and the season." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Win rate"  value="73%" icon={Trophy} tone="success" />
        <StatCard label="Avg turn"  value="6.4" tone="primary" />
        <StatCard label="Top deck"  value="Aurora Mid" />
        <StatCard label="Comeback wins" value="22" tone="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="By mode">
          <DataRow label="Solo ranked" value="74% (148/200)" />
          <DataRow label="Event"       value="68% (32/47)" />
          <DataRow label="Random"      value="71% (28/39)" />
        </Section>
        <Section title="By deck">
          <DataRow label="Aurora Mid"  value="78% (61 games)" />
          <DataRow label="Vanta Aggro" value="72% (48 games)" />
          <DataRow label="Halcyon Control" value="64% (33 games)" />
        </Section>
      </div>
    </>
  );
}
