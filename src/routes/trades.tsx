import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/trades")({
  head: () => ({ meta: [{ title: "Trades — Radiant" }] }),
  component: Trades,
});

const trades = [
  { id: "T-A91F2", side: "buy",  pair: "bot-03 ⇄ user_arden",  give: "Halcyon Mark ×1", get: "Gilded Pact ×2", status: "settled",   time: "14:32" },
  { id: "T-A91E8", side: "sell", pair: "bot-01 ⇄ user_kiera",  give: "Solar Crown ×1",  get: "Embered Vow ×3", status: "pending",   time: "14:31" },
  { id: "T-A91DA", side: "buy",  pair: "bot-05 ⇄ user_morrow", give: "Sovereign Loop",  get: "Aureate Sigil",  status: "settled",   time: "14:30" },
  { id: "T-A91CB", side: "sell", pair: "bot-02 ⇄ user_nelle",  give: "Aureate Sigil ×2",get: "Halcyon Mark ×1",status: "settled",   time: "14:28" },
  { id: "T-A91BC", side: "buy",  pair: "bot-04 ⇄ user_ferris", give: "Embered Vow ×2",  get: "Solar Crown",    status: "cancelled", time: "14:22" },
];

function Trades() {
  return (
    <>
      <PageHeader
        title="Regular trades"
        description="Two-sided trades between bot accounts and counterparties."
        actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New trade</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Settled 24h"   value="2,418" icon={ArrowLeftRight} tone="success" delta={{ value: "+4%", direction: "up" }} />
        <StatCard label="Pending"       value="36"    tone="warning" />
        <StatCard label="Avg latency"   value="412ms" hint="P95 · 1.1s" />
        <StatCard label="Cancel rate"   value="0.6%"  tone="danger" delta={{ value: "−0.2pp", direction: "down" }} />
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Trade</th>
              <th className="px-5 py-3">Side</th>
              <th className="px-5 py-3">Parties</th>
              <th className="px-5 py-3">Give</th>
              <th className="px-5 py-3">Get</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trades.map((t) => (
              <tr key={t.id} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono">{t.id}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={
                    "h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " +
                    (t.side === "buy" ? "bg-success/15 text-success" : "bg-primary/15 text-primary")
                  }>{t.side}</Badge>
                </td>
                <td className="px-5 py-3 text-muted-foreground text-mono text-xs">{t.pair}</td>
                <td className="px-5 py-3">{t.give}</td>
                <td className="px-5 py-3">{t.get}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={
                    "h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " +
                    (t.status === "settled"   ? "bg-success/15 text-success"
                      : t.status === "pending"   ? "bg-warning/15 text-warning"
                      : "bg-destructive/15 text-destructive")
                  }>{t.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right text-mono text-xs text-muted-foreground">{t.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
