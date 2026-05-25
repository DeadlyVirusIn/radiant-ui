import { createFileRoute } from "@tanstack/react-router";
import { Bot, RefreshCw, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Bot fleet" }] }),
  component: Accounts,
});

const fleet = Array.from({ length: 18 }).map((_, i) => {
  const status = i % 9 === 0 ? "rotating" : i % 11 === 0 ? "idle" : i % 17 === 0 ? "error" : "online";
  return {
    id: `bot-${String(i + 1).padStart(2, "0")}`,
    region: ["EU-W", "US-E", "APAC", "US-W"][i % 4],
    status,
    load: status === "idle" ? 4 : status === "error" ? 0 : 20 + (i * 13) % 70,
    uptime: status === "error" ? "00m" : `${(i % 96) + 1}h`,
    last: `${(i % 59) + 1}s ago`,
  };
});

function Accounts() {
  return (
    <>
      <PageHeader
        title="Bot fleet"
        description="Health, load and recent activity for every account in the fleet."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add account</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Online"   value="38" icon={Bot} tone="success" />
        <StatCard label="Rotating" value="2" tone="warning" />
        <StatCard label="Idle"     value="2" />
        <StatCard label="Errors"   value="0" tone="success" hint="Last 1h" />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fleet.map((b) => (
          <article key={b.id} className="rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-semibold text-mono">{b.id}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{b.region}</div>
                </div>
              </div>
              <Badge variant="outline" className={
                "h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " +
                (b.status === "online"   ? "bg-success/15 text-success"
                  : b.status === "rotating" ? "bg-warning/15 text-warning"
                  : b.status === "error"    ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground")
              }>{b.status}</Badge>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Load</span><span className="text-mono">{b.load}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                <div className={"h-full rounded-full " + (b.load > 75 ? "bg-warning" : b.load > 40 ? "bg-primary" : "bg-success")} style={{ width: `${b.load}%` }} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
              <div><div className="text-muted-foreground">Uptime</div><div className="font-display text-sm font-semibold">{b.uptime}</div></div>
              <div className="text-right"><div className="text-muted-foreground">Last seen</div><div className="text-mono">{b.last}</div></div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
