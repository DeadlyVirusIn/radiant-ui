import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/missions")({
  head: () => ({ meta: [{ title: "Missions — Radiant" }] }),
  component: Missions,
});

const daily = [
  { title: "Win 3 battles",     reward: "20 dust", done: 2, total: 3 },
  { title: "Open 5 packs",      reward: "10 hourglasses", done: 5, total: 5 },
  { title: "Trade with a friend", reward: "1 ticket", done: 0, total: 1 },
];

function MissionList({ items }: { items: typeof daily }) {
  return (
    <div className="space-y-2">
      {items.map((m) => {
        const pct = (m.done / m.total) * 100;
        const done = m.done >= m.total;
        return (
          <div key={m.title} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
            {done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="text-sm">{m.title}</div>
                <Badge variant="outline" className="border-transparent bg-primary/10 text-primary text-[10px]">{m.reward}</Badge>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-muted"><div className={"h-full rounded-full " + (done ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
            </div>
            <span className="text-mono text-xs text-muted-foreground w-10 text-right">{m.done}/{m.total}</span>
          </div>
        );
      })}
    </div>
  );
}

function Missions() {
  return (
    <>
      <PageHeader title="Missions" description="Daily, weekly and seasonal missions with their reward queues." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Daily complete"  value="2 / 5" icon={ListChecks} tone="primary" />
        <StatCard label="Weekly complete" value="4 / 8" />
        <StatCard label="Pending rewards" value="3" tone="warning" />
        <StatCard label="Streak"          value="12 d" tone="success" />
      </div>

      <Tabs defaultValue="daily" className="mt-6">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="season">Season</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4"><MissionList items={daily} /></TabsContent>
        <TabsContent value="weekly" className="mt-4"><MissionList items={daily.map((m) => ({ ...m, total: m.total * 7 }))} /></TabsContent>
        <TabsContent value="season" className="mt-4"><MissionList items={daily.map((m) => ({ ...m, total: m.total * 30 }))} /></TabsContent>
      </Tabs>
    </>
  );
}
