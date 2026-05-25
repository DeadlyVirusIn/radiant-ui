import { createFileRoute } from "@tanstack/react-router";
import { Gift, Send } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/gifts")({
  head: () => ({ meta: [{ title: "Gift trades — Radiant" }] }),
  component: Gifts,
});

const rows = [
  { id: "G-7821", from: "bot-03", to: "user_arden",   item: "Aureate Sigil",    qty: 1, status: "delivered", time: "14:31" },
  { id: "G-7820", from: "bot-01", to: "user_kiera",   item: "Solar Crown",      qty: 2, status: "in-flight", time: "14:30" },
  { id: "G-7819", from: "bot-05", to: "user_morrow",  item: "Halcyon Mark",     qty: 1, status: "queued",    time: "14:28" },
  { id: "G-7818", from: "bot-02", to: "user_nelle",   item: "Gilded Pact",      qty: 4, status: "delivered", time: "14:26" },
  { id: "G-7817", from: "bot-04", to: "user_ferris",  item: "Sovereign Loop",   qty: 1, status: "failed",    time: "14:22" },
];

function Gifts() {
  return (
    <>
      <PageHeader
        title="Gift trades"
        description="One-way deliveries from bot accounts to end users. Tracked end-to-end."
        actions={<Button size="sm" className="gap-1.5"><Send className="h-3.5 w-3.5" /> New gift</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sent today"      value="312" icon={Gift} tone="primary" delta={{ value: "+8%", direction: "up" }} />
        <StatCard label="In flight"       value="14"  hint="Average 41s end-to-end" />
        <StatCard label="Failed"          value="2"   tone="danger" delta={{ value: "−3", direction: "down" }} />
        <StatCard label="Recipients"      value="287" hint="Unique in last 24h" />
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Gift</th>
              <th className="px-5 py-3">From</th>
              <th className="px-5 py-3">To</th>
              <th className="px-5 py-3">Item</th>
              <th className="px-5 py-3 text-right">Qty</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono">{r.id}</td>
                <td className="px-5 py-3 text-mono text-muted-foreground">{r.from}</td>
                <td className="px-5 py-3">{r.to}</td>
                <td className="px-5 py-3">{r.item}</td>
                <td className="px-5 py-3 text-right text-mono">{r.qty}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={
                    "h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " +
                    (r.status === "delivered" ? "bg-success/15 text-success"
                      : r.status === "in-flight" ? "bg-primary/15 text-primary"
                      : r.status === "queued"    ? "bg-muted text-muted-foreground"
                      : "bg-destructive/15 text-destructive")
                  }>{r.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right text-mono text-xs text-muted-foreground">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
