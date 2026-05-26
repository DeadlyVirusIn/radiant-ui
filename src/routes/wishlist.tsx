import { createFileRoute } from "@tanstack/react-router";
import { Heart, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Radiant" }] }),
  component: Wishlist,
});

const list = [
  { name: "Solar Crown",  set: "Genesis Echo",   priority: "High" },
  { name: "Aureate Sigil",set: "Sovereign Loop", priority: "Med" },
  { name: "Embered Vow",  set: "Aurora Pact",    priority: "Low" },
  { name: "Pale Charter", set: "Halcyon Mark",   priority: "High" },
];

function Wishlist() {
  return (
    <>
      <PageHeader title="Wishlist" description="Tag cards you want — Radiant prioritizes hunts and trades around them." actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add card</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Wishlisted" value="14" icon={Heart} tone="primary" />
        <StatCard label="High priority" value="6" tone="warning" />
        <StatCard label="Auto-trade hits" value="3" tone="success" hint="Last 7 days" />
        <StatCard label="Estimated value" value="2,400 dust" />
      </div>

      <Section title="Your wishlist" className="mt-6">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {list.map((c) => (
            <div key={c.name} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
              <div className="h-12 w-9 rounded-md bg-gradient-to-br from-primary/30 to-primary/10" />
              <div className="flex-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{c.set} · {c.priority} priority</div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7"><X className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
