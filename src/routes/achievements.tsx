import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Star, Lock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";

export const Route = createFileRoute("/achievements")({
  head: () => ({ meta: [{ title: "Achievements — Radiant" }] }),
  component: Achievements,
});

const items = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  name: ["Pack Master", "First Trade", "Gold Hunter", "Friend of All", "Marathon", "Night Owl"][i % 6],
  desc: "Reach the milestone to unlock.",
  unlocked: i % 3 !== 2,
  rare: i % 5 === 0,
}));

function Achievements() {
  return (
    <>
      <PageHeader title="Achievements" description="Milestones unlocked across hunting, trading, battles and community." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unlocked" value="34 / 80" icon={Trophy} tone="success" />
        <StatCard label="Rare"     value="6"  tone="warning" icon={Star} />
        <StatCard label="In progress" value="12" tone="primary" />
        <StatCard label="Locked"   value="34" />
      </div>

      <Section title="All achievements" className="mt-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className={"rounded-lg border p-4 " + (a.unlocked ? "border-primary/30 bg-primary/5" : "border-border bg-background/30")}>
              <div className="flex items-start gap-3">
                <div className={"grid h-10 w-10 place-items-center rounded-md " + (a.unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                  {a.unlocked ? <Trophy className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-semibold">{a.name}</div>
                    {a.rare && <Star className="h-3 w-3 fill-warning text-warning" />}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{a.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
