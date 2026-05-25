import { createFileRoute } from "@tanstack/react-router";
import { Crosshair, Filter, Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/hunts")({
  head: () => ({ meta: [{ title: "Hunts — Trade Center" }] }),
  component: Hunts,
});

const sessions = [
  { id: "H-2401", target: "Gold flair · rare", bots: 6, progress: 72, eta: "08m", status: "running" },
  { id: "H-2400", target: "Gift batch · EU",   bots: 4, progress: 41, eta: "22m", status: "running" },
  { id: "H-2399", target: "Inventory sync",    bots: 2, progress: 98, eta: "01m", status: "finishing" },
  { id: "H-2398", target: "Trade scan · US",   bots: 8, progress: 12, eta: "1h 04m", status: "queued" },
  { id: "H-2397", target: "Gold flair · epic", bots: 5, progress: 0,  eta: "—", status: "paused" },
];

function Hunts() {
  return (
    <>
      <PageHeader
        title="Trade Center"
        description="Plan, launch and monitor hunt sessions across the fleet."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" /> Filters</Button>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New hunt</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active"    value="12" icon={Crosshair} tone="primary" />
        <StatCard label="Queued"    value="4"  hint="Next runs in 03m" />
        <StatCard label="Success 24h" value="96.4%" delta={{ value: "+1.2%", direction: "up" }} tone="success" />
        <StatCard label="Avg duration" value="34m" hint="Across last 100 hunts" />
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input placeholder="Search hunts by ID, target, account…" className="h-9 bg-background/40" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["All", "Running", "Queued", "Finishing", "Paused"].map((t, i) => (
            <Button key={t} variant={i === 0 ? "secondary" : "ghost"} size="sm" className="h-8 text-xs">{t}</Button>
          ))}
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Session</th>
              <th className="px-5 py-3">Target</th>
              <th className="px-5 py-3">Bots</th>
              <th className="px-5 py-3 w-[28%]">Progress</th>
              <th className="px-5 py-3">ETA</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-accent/40">
                <td className="px-5 py-3 text-mono">{s.id}</td>
                <td className="px-5 py-3">{s.target}</td>
                <td className="px-5 py-3 text-muted-foreground">{s.bots}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                    </div>
                    <span className="text-mono text-xs text-muted-foreground w-10 text-right">{s.progress}%</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{s.eta}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={
                    "h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " +
                    (s.status === "running"   ? "bg-primary/15 text-primary"
                      : s.status === "finishing" ? "bg-success/15 text-success"
                      : s.status === "queued"    ? "bg-muted text-muted-foreground"
                      : "bg-warning/15 text-warning")
                  }>{s.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"><Play className="h-3 w-3" /> Open</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
