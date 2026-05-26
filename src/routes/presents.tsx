import { createFileRoute } from "@tanstack/react-router";
import { Package, Gift } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/presents")({
  head: () => ({ meta: [{ title: "Present box — Radiant" }] }),
  component: Presents,
});

const presents = [
  { from: "Daily login",   item: "10 hourglasses", state: "Ready" },
  { from: "Event reward",  item: "Wonder pick ticket", state: "Ready" },
  { from: "Friend Nelle",  item: "Solar Crown", state: "Ready" },
  { from: "System bonus",  item: "200 shine dust", state: "Claimed" },
];

function Presents() {
  return (
    <>
      <PageHeader title="Present box" description="Pending and claimed rewards delivered to the account inbox." actions={<Button size="sm">Claim all</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending" value="3" icon={Package} tone="warning" />
        <StatCard label="Claimed 24h" value="9" tone="success" />
        <StatCard label="Expires < 24h" value="1" tone="danger" />
        <StatCard label="Inbox capacity" value="42 / 100" />
      </div>

      <Section title="Inbox" className="mt-6">
        <div className="space-y-2">
          {presents.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
              <Gift className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">{p.item}</div>
                <div className="text-[11px] text-muted-foreground">From {p.from}</div>
              </div>
              {p.state === "Ready" ? <Button size="sm">Claim</Button> : <span className="text-xs text-muted-foreground">Claimed</span>}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
