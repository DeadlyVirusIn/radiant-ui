import { createFileRoute } from "@tanstack/react-router";
import { Share2, Send } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sharing-cards")({
  head: () => ({ meta: [{ title: "Sharing cards — Radiant" }] }),
  component: SharingCards,
});

const rules = [
  { from: "Aurora-01", to: "Friends ≥ 3 days",  filter: "Duplicates only", state: "Active" },
  { from: "Vanta-02",  to: "Wishlist matches",  filter: "Rare or above",  state: "Active" },
  { from: "Halcyon-EU",to: "Manual approve",    filter: "Legendary",      state: "Paused" },
];

function SharingCards() {
  return (
    <>
      <PageHeader title="Sharing cards" description="Auto-gift rules that route duplicates to friends or wishlists." actions={<Button size="sm" className="gap-1.5"><Send className="h-3.5 w-3.5" /> New rule</Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active rules" value="6" icon={Share2} tone="primary" />
        <StatCard label="Gifts sent 24h" value="42" tone="success" />
        <StatCard label="Cards routed" value="318" hint="Last 30 days" />
        <StatCard label="Errors" value="2" tone="danger" />
      </div>

      <Section title="Auto-share rules" className="mt-6" padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">From</th>
              <th className="px-5 py-3">Route to</th>
              <th className="px-5 py-3">Filter</th>
              <th className="px-5 py-3">State</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r, i) => (
              <tr key={i} className="hover:bg-accent/40">
                <td className="px-5 py-3 font-medium">{r.from}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.to}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.filter}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] " + (r.state === "Active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{r.state}</Badge></td>
                <td className="px-5 py-3 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
