import { createFileRoute } from "@tanstack/react-router";
import { Users, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Friends — Radiant" }] }),
  component: Friends,
});

const friends = Array.from({ length: 10 }).map((_, i) => ({
  id: i,
  name: ["Nelle", "Jules", "Arden", "Kiera", "Soren", "Bree", "Onyx", "Vex", "Quill", "Mira"][i],
  status: i % 3 === 0 ? "online" : i % 3 === 1 ? "away" : "offline",
  trades: 12 + i * 3,
}));

const status: Record<string, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};

function Friends() {
  return (
    <>
      <PageHeader title="Friends" description="Your trading and gifting network." actions={<Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Add friend</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Friends"   value="42" icon={Users} />
        <StatCard label="Online"    value="14" tone="success" />
        <StatCard label="Pending"   value="3"  tone="warning" />
        <StatCard label="Top trader" value="Nelle" tone="primary" />
      </div>

      <Section title="Your friends" className="mt-6">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {friends.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
              <div className="relative">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-card text-xs font-semibold">{f.name[0]}</div>
                <span className={"absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card " + status[f.status]} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{f.name}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{f.status} · {f.trades} trades</div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs">Trade</Button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
