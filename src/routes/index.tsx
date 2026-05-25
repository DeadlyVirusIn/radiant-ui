import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Boxes,
  Crosshair,
  Gift,
  Sparkles,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Radiant" }] }),
  component: Dashboard,
});

const recentEvents = [
  { time: "14:32:08", level: "success", source: "fleet-3",  msg: "Trade #A9F2 settled · +2 gold flair" },
  { time: "14:31:52", level: "info",    source: "hunt-12",  msg: "Hunt session opened on slot B" },
  { time: "14:30:11", level: "warning", source: "bot-07",   msg: "Rate-limited by upstream, backing off 30s" },
  { time: "14:28:44", level: "success", source: "gifts",    msg: "Gift batch (24 items) delivered" },
  { time: "14:25:03", level: "info",    source: "inventory",msg: "Inventory sync completed in 1.4s" },
  { time: "14:21:17", level: "danger",  source: "bot-02",   msg: "Auth token expired — auto-rotating" },
];

const fleet = [
  { id: "bot-01", region: "EU-W", status: "online",  load: 64, queue: 12 },
  { id: "bot-02", region: "EU-W", status: "rotating",load: 22, queue: 4 },
  { id: "bot-03", region: "US-E", status: "online",  load: 81, queue: 18 },
  { id: "bot-04", region: "US-E", status: "online",  load: 47, queue: 9 },
  { id: "bot-05", region: "APAC", status: "idle",    load: 8,  queue: 0 },
];

function Dashboard() {
  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        description="Live snapshot of hunts, trades, fleet health and inventory across all regions."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Last 24h
            </Button>
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Zap className="h-3.5 w-3.5" /> Quick action
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active hunts"   value="12"     delta={{ value: "+3", direction: "up" }}   icon={Crosshair} tone="primary" hint="3 finishing within the hour" />
        <StatCard label="Gold flair (24h)" value="184"  delta={{ value: "+12%", direction: "up" }} icon={Sparkles}  tone="warning" hint="Above 7-day average" />
        <StatCard label="Trades settled" value="2,418" delta={{ value: "−4%", direction: "down" }} icon={Gift}      tone="success" hint="Slower morning window" />
        <StatCard label="Bots online"    value="38 / 42" delta={{ value: "stable", direction: "flat" }} icon={Bot} hint="2 rotating · 2 idle" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Throughput */}
        <section className="lg:col-span-2 rounded-xl border border-border bg-card/60 p-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-base font-semibold">Trade throughput</h2>
              <p className="text-xs text-muted-foreground">Per-minute settlements across the fleet</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-sm bg-primary" /> Settled
              <span className="ml-3 h-2 w-2 rounded-sm bg-warning" /> Pending
            </div>
          </div>

          {/* Pure-CSS sparkline grid */}
          <div className="mt-5 grid h-44 grid-cols-24 items-end gap-1">
            {Array.from({ length: 24 }).map((_, i) => {
              const a = 20 + Math.round(Math.abs(Math.sin(i * 0.7)) * 70 + (i % 5) * 4);
              const b = 6 + Math.round(Math.abs(Math.cos(i * 0.9)) * 24);
              return (
                <div key={i} className="flex flex-col justify-end gap-0.5">
                  <div className="rounded-sm bg-primary/70" style={{ height: `${a}%` }} />
                  <div className="rounded-sm bg-warning/60" style={{ height: `${b}%` }} />
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
            <div><div className="text-muted-foreground">Peak/min</div><div className="font-display text-lg font-semibold">94</div></div>
            <div><div className="text-muted-foreground">Avg latency</div><div className="font-display text-lg font-semibold">412ms</div></div>
            <div><div className="text-muted-foreground">Error rate</div><div className="font-display text-lg font-semibold text-success">0.18%</div></div>
          </div>
        </section>

        {/* Events */}
        <section className="rounded-xl border border-border bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Recent events</h2>
            <Link to="/events" className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {recentEvents.map((e, i) => (
              <li key={i} className="flex items-start gap-2.5 py-2.5 text-xs">
                <span
                  className={
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full " +
                    (e.level === "success" ? "bg-success"
                      : e.level === "warning" ? "bg-warning"
                      : e.level === "danger"  ? "bg-destructive"
                      : "bg-muted-foreground")
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{e.msg}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="text-mono">{e.time}</span>
                    <span>·</span>
                    <span>{e.source}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Fleet */}
      <section className="mt-6 rounded-xl border border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-display text-base font-semibold">Bot fleet</h2>
            <p className="text-xs text-muted-foreground">Top accounts by load</p>
          </div>
          <Link to="/accounts" className="text-xs text-primary hover:underline">Manage fleet</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-2.5">Account</th>
                <th className="px-5 py-2.5">Region</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Load</th>
                <th className="px-5 py-2.5 text-right">Queue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fleet.map((b) => (
                <tr key={b.id} className="text-sm transition-colors hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium text-mono">{b.id}</td>
                  <td className="px-5 py-3 text-muted-foreground">{b.region}</td>
                  <td className="px-5 py-3">
                    <Badge
                      variant="outline"
                      className={
                        "h-5 border-transparent px-2 text-[10px] font-semibold uppercase tracking-wider " +
                        (b.status === "online"   ? "bg-success/15 text-success"
                          : b.status === "rotating" ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground")
                      }
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 rounded-full bg-muted">
                        <div
                          className={
                            "h-full rounded-full " +
                            (b.load > 75 ? "bg-warning" : b.load > 40 ? "bg-primary" : "bg-success")
                          }
                          style={{ width: `${b.load}%` }}
                        />
                      </div>
                      <span className="text-mono text-xs text-muted-foreground">{b.load}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-mono">{b.queue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { to: "/hunts",       title: "Open Trade Center", icon: Crosshair, desc: "Plan + execute hunts" },
          { to: "/gold-flair",  title: "Gold Flair queue",  icon: Sparkles,  desc: "Premium settlement track" },
          { to: "/gifts",       title: "Gift trades",       icon: Gift,      desc: "Outbound gifts pipeline" },
          { to: "/inventory",   title: "Inventory explorer",icon: Boxes,     desc: "Search across all accounts" },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card"
          >
            <q.icon className="h-4 w-4 text-primary" />
            <div className="font-display text-sm font-semibold">{q.title}</div>
            <div className="text-xs text-muted-foreground">{q.desc}</div>
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </section>
    </>
  );
}
