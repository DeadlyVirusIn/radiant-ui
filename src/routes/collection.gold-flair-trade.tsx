import { createFileRoute } from "@tanstack/react-router";
import { Gem, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/collection/gold-flair-trade")({
  head: () => ({ meta: [{ title: "Gold Flair trade — Radiant" }] }),
  component: GoldFlairTrade,
});

const queue = [
  { item: "Solar Crown",   from: "Aurora-01",  to: "Vanta-02",  status: "Awaiting" },
  { item: "Embered Vow",   from: "Halcyon-EU", to: "Aurora-01", status: "Confirming" },
  { item: "Sovereign Loop",from: "Vanta-02",   to: "Aurora-01", status: "Pending review" },
];

function GoldFlairTrade() {
  return (
    <>
      <PageHeader title="Manual Gold Flair trade" description="Curated, two-sided trades for high-value gold-flair items. Each transfer requires explicit operator approval." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending"   value="3" icon={Gem} tone="warning" />
        <StatCard label="Today"     value="11" tone="success" />
        <StatCard label="This week" value="48" />
        <StatCard label="Avg value" value="2.4k dust" tone="primary" />
      </div>

      <Section title="Queue" className="mt-6">
        <div className="space-y-2">
          {queue.map((q, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/30 p-4">
              <div className="h-10 w-10 rounded-md bg-gradient-to-br from-warning/30 to-warning/10" />
              <div className="flex-1">
                <div className="text-sm font-medium">{q.item}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{q.from}</span> <ArrowRight className="h-3 w-3" /> <span>{q.to}</span>
                </div>
              </div>
              <Badge variant="outline" className="h-5 border-transparent bg-warning/15 text-warning text-[10px]">{q.status}</Badge>
              <Button size="sm" variant="outline">Review</Button>
              <Button size="sm">Approve</Button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
