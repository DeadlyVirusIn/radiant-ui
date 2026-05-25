import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, CheckCircle2, Circle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/collection-missions")({
  head: () => ({ meta: [{ title: "Collection missions — Radiant" }] }),
  component: CollectionMissions,
});

const missions = [
  { title: "Complete Genesis Echo (rare)", reward: "+24 hourglasses", progress: 18, total: 24, done: false },
  { title: "Open 50 packs this week",      reward: "+1 premier ticket", progress: 50, total: 50, done: true },
  { title: "Trade 5 gold flair items",     reward: "+200 shine dust", progress: 3, total: 5, done: false },
  { title: "Gift a card to 10 friends",    reward: "+50 coins", progress: 7, total: 10, done: false },
  { title: "Reach battle rank Gold I",     reward: "+1 wonder pick", progress: 100, total: 100, done: true },
];

function CollectionMissions() {
  return (
    <>
      <PageHeader title="Collection missions" description="Long-running goals and the rewards you earn for completing them." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active"    value="12" icon={ListChecks} />
        <StatCard label="Completed" value="7"  tone="success" icon={CheckCircle2} />
        <StatCard label="Weekly"    value="4 / 7" tone="primary" />
        <StatCard label="Rewards pending" value="3" tone="warning" />
      </div>

      <Section title="Missions" className="mt-6">
        <div className="space-y-2">
          {missions.map((m) => {
            const pct = Math.round((m.progress / m.total) * 100);
            return (
              <div key={m.title} className="flex items-center gap-4 rounded-lg border border-border bg-background/30 p-4">
                {m.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{m.title}</div>
                    <Badge variant="outline" className="border-transparent bg-primary/10 text-primary text-[10px]">{m.reward}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div className={"h-full rounded-full " + (m.done ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-mono text-xs text-muted-foreground w-16 text-right">{m.progress}/{m.total}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
