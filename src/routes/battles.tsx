import { createFileRoute } from "@tanstack/react-router";
import { Swords, Play, Crown } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/battles")({
  head: () => ({ meta: [{ title: "Battles — Radiant" }] }),
  component: Battles,
});

function ModeCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Swords className="h-5 w-5" /></div>
      <h3 className="mt-3 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <Button size="sm" className="mt-3 w-full gap-1.5"><Play className="h-3.5 w-3.5" /> Queue up</Button>
    </div>
  );
}

function Battles() {
  return (
    <>
      <PageHeader title="Battles" description="Solo, event and random matchups — pick a mode and Radiant auto-routes idle bots." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active queues" value="2" icon={Swords} tone="primary" />
        <StatCard label="Wins today" value="38 / 52" tone="success" />
        <StatCard label="Rank" value="Gold I" tone="warning" icon={Crown} />
        <StatCard label="Win rate" value="73%" delta={{ value: "+4%", direction: "up" }} />
      </div>

      <Tabs defaultValue="solo" className="mt-6">
        <TabsList>
          <TabsTrigger value="solo">Solo</TabsTrigger>
          <TabsTrigger value="event">Event</TabsTrigger>
          <TabsTrigger value="random">Random</TabsTrigger>
        </TabsList>
        <TabsContent value="solo" className="mt-4 grid gap-3 md:grid-cols-3">
          <ModeCard title="Ranked ladder" hint="Climb the seasonal ladder" />
          <ModeCard title="Practice"      hint="No rating, fast queues" />
          <ModeCard title="Daily quest"   hint="Today: 5 wins for 60 dust" />
        </TabsContent>
        <TabsContent value="event" className="mt-4 grid gap-3 md:grid-cols-3">
          <ModeCard title="Aurora Cup"    hint="Ends in 2d 14h" />
          <ModeCard title="Halcyon brawl" hint="3-stack format" />
          <ModeCard title="Weekend rush"  hint="Double rewards" />
        </TabsContent>
        <TabsContent value="random" className="mt-4 grid gap-3 md:grid-cols-3">
          <ModeCard title="Quick match"  hint="60-sec queues" />
          <ModeCard title="Mystery draft" hint="Random deck pulled" />
          <ModeCard title="Co-op pair"    hint="2v2 random allies" />
        </TabsContent>
      </Tabs>
    </>
  );
}
