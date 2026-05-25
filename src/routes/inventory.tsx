import { createFileRoute } from "@tanstack/react-router";
import { Boxes, Download, Filter, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Radiant" }] }),
  component: Inventory,
});

const items = [
  { name: "Solar Crown",     tier: "legendary", total: 14, accounts: 9,  reserved: 3 },
  { name: "Aureate Sigil",   tier: "epic",      total: 42, accounts: 18, reserved: 5 },
  { name: "Halcyon Mark",    tier: "rare",      total: 187, accounts: 31, reserved: 12 },
  { name: "Gilded Pact",     tier: "epic",      total: 73, accounts: 22, reserved: 0 },
  { name: "Sovereign Loop",  tier: "legendary", total: 6,  accounts: 4,  reserved: 1 },
  { name: "Embered Vow",     tier: "rare",      total: 219, accounts: 38, reserved: 8 },
  { name: "Quiet Lantern",   tier: "common",    total: 612, accounts: 41, reserved: 0 },
  { name: "Pale Charter",    tier: "common",    total: 488, accounts: 39, reserved: 4 },
];

const tier: Record<string, string> = {
  legendary: "bg-warning/15 text-warning",
  epic: "bg-primary/15 text-primary",
  rare: "bg-success/15 text-success",
  common: "bg-muted text-muted-foreground",
};

function Inventory() {
  return (
    <>
      <PageHeader
        title="Inventory explorer"
        description="Search and inspect items held across every account in the fleet."
        actions={<Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Unique items"    value="184"  icon={Boxes} />
        <StatCard label="Total units"     value="6,412" delta={{ value: "+312", direction: "up" }} tone="primary" />
        <StatCard label="Reserved"        value="148"  tone="warning" hint="In open trades" />
        <StatCard label="Accounts covered" value="41 / 42" tone="success" />
      </div>

      <div className="mt-6 flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, tier, account…" className="h-9 bg-background/40 pl-8" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Filters</Button>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Item</th>
              <th className="px-5 py-3">Tier</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Accounts</th>
              <th className="px-5 py-3 text-right">Reserved</th>
              <th className="px-5 py-3 w-[24%]">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it) => {
              const cov = Math.round((it.accounts / 42) * 100);
              return (
                <tr key={it.name} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium">{it.name}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={"h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " + tier[it.tier]}>
                      {it.tier}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right text-mono">{it.total}</td>
                  <td className="px-5 py-3 text-right text-mono text-muted-foreground">{it.accounts}</td>
                  <td className="px-5 py-3 text-right text-mono text-warning">{it.reserved}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${cov}%` }} />
                      </div>
                      <span className="text-mono text-xs text-muted-foreground w-10 text-right">{cov}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
