import { createFileRoute } from "@tanstack/react-router";
import { Coins, Hourglass, Ticket, Diamond, Sparkle, Package, Boxes, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/resources")({
  head: () => ({ meta: [{ title: "Resources — Radiant" }] }),
  component: Resources,
});

function Resources() {
  const hourglasses = 1284;
  const shopTickets = 312;
  const premier = 18;
  const packs = Math.floor(hourglasses / 12);

  return (
    <>
      <PageHeader
        title="Resource dashboard"
        description="Live in-game currencies and crafting materials across every linked account."
        actions={
          <>
            <Select defaultValue="acc-1">
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acc-1">Aurora — primary</SelectItem>
                <SelectItem value="acc-2">Vanta-02</SelectItem>
                <SelectItem value="acc-3">Halcyon-EU</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Hourglasses"     value={hourglasses.toLocaleString()} icon={Hourglass} tone="primary" delta={{ value: "+24", direction: "up" }} hint={`${packs} packs available`} />
        <StatCard label="Shop tickets"    value={shopTickets.toString()} icon={Ticket} tone="warning" delta={{ value: "+6", direction: "up" }} />
        <StatCard label="Premier tickets" value={premier.toString()} icon={Diamond} />
        <StatCard label="Shine dust"      value="48,210" icon={Sparkle} delta={{ value: "+1.2k", direction: "up" }} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section title="Spending power" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Regular packs", value: packs, hint: "12 hourglasses each" },
              { label: "6-pack bundles", value: Math.floor(shopTickets / 12), hint: "12 shop tickets each" },
              { label: "Single rolls", value: Math.floor(shopTickets / 3), hint: "3 shop tickets each" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-background/40 p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-1 font-display text-3xl font-bold">{s.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.hint}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Other resources">
          <DataRow label="Pack points" value="2,140" hint="Bonus from packs" />
          <DataRow label="Total cards" value="8,914" hint="In collection" />
          <DataRow label="Coins" value="142,800" />
          <DataRow label="Friend tokens" value="64" />
        </Section>
      </div>
    </>
  );
}
