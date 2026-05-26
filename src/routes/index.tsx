import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Crosshair,
  Gem,
  Gift,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Mission Control — Radiant" }] }),
  component: Dashboard,
});

// ─────────────────────────────────────────────────────────────
// Data (mock, matches existing PackHunter shapes)
const regions = [
  { id: "NA-E", state: "ok",   healthy: 12, bots: 12, latency: 42 },
  { id: "EU-W", state: "warn", healthy:  9, bots: 10, latency: 112 },
  { id: "JP",   state: "ok",   healthy:  8, bots:  8, latency: 218 },
  { id: "OCE",  state: "ok",   healthy: 11, bots: 12, latency: 162 },
];

const throughput = [40, 60, 80, 95, 75, 50, 90, 65, 72, 88, 54, 92, 70, 45, 30, 58];

const alerts = [
  { id: "a1", sev: "danger",  title: "Bot-07 Rate Limited",     meta: "Region EU-W · 4m ago",  action: "ROT" },
  { id: "a2", sev: "warning", title: "Inventory Sync Delay",    meta: "Drift +1.2s · 12m ago", action: "FIX" },
  { id: "a3", sev: "warning", title: "Auth Token Near Expiry",  meta: "bot-02 · 22m ago",      action: "ROTATE" },
];

const issues = [
  { title: "Hunt slot B stalled past ETA", entity: "hunt-12", age: "8m", sev: "warning" },
  { title: "Gold Flair queue back-pressure", entity: "gf-queue", age: "14m", sev: "warning" },
  { title: "Bot-02 token rotation pending",  entity: "bot-02", age: "22m", sev: "danger"  },
  { title: "Gift batch B-19 partial delivery", entity: "gifts", age: "33m", sev: "info"   },
];

const events = [
  { t: "14:32", dot: "success", title: "Trade #A9F2 Settled",      sub: "+2 GOLD FLAIR · fleet-3" },
  { t: "14:31", dot: "primary", title: "Hunt Opened: Slot B",       sub: "HUNT-12 · ETA 28m" },
  { t: "14:30", dot: "danger",  title: "Rate Limit · bot-07",       sub: "Upstream backoff 30s" },
  { t: "14:28", dot: "success", title: "Gift Batch B-18 Delivered", sub: "24 items · 22 recipients" },
  { t: "14:25", dot: "muted",   title: "Inventory Sync · 1.4s",     sub: "parity drift 0" },
  { t: "14:21", dot: "warning", title: "Auth Token Auto-rotated",   sub: "bot-02 · EU-W" },
];

// ─────────────────────────────────────────────────────────────
const sevBorder: Record<string, string> = {
  danger: "border-l-destructive",
  warning: "border-l-warning",
  info: "border-l-primary",
};
const sevBg: Record<string, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  info: "bg-primary/10 text-primary",
};
const dotBg: Record<string, string> = {
  success: "bg-success",
  primary: "bg-primary",
  danger:  "bg-destructive",
  warning: "bg-warning",
  muted:   "bg-muted-foreground",
};

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>
      {action}
    </div>
  );
}

function Dashboard() {
  const settled = 2418;
  const goldFlair = 184;
  const errorRate = 0.18;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            System Operational
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Mission Control
          </h1>
          <p className="text-sm text-muted-foreground">
            Live fleet, hunts, trades and inventory across all regions.
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Last 24h
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition-colors hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> New hunt
          </button>
        </div>
      </header>

      {/* Main grid: primary column + right rail (desktop) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* PRIMARY COLUMN */}
        <div className="space-y-4">
          {/* Fleet health card (hero) */}
          <section className="relative overflow-hidden rounded-xl border border-border bg-surface/60 p-5">
            <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Active Fleet Health</p>
                <div className="flex items-baseline gap-2 text-mono">
                  <span className="text-4xl font-bold tracking-tight text-foreground">40</span>
                  <span className="text-lg text-muted-foreground">/ 42</span>
                  <span className="ml-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">95.2%</span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Avg Latency</p>
                  <p className="text-mono text-lg font-bold text-success">412ms</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Open Alerts</p>
                  <p className="text-mono text-lg font-bold text-warning">3</p>
                </div>
              </div>
            </div>

            {/* Regional bars */}
            <div className="grid grid-cols-4 gap-2">
              {regions.map((r) => (
                <div key={r.id} className={`h-1.5 rounded-full ${r.state === "warn" ? "bg-warning" : r.state === "down" ? "bg-destructive" : "bg-success"}`} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                {regions.map((r) => (
                  <span key={r.id} className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.state === "warn" ? "bg-warning" : "bg-success"}`} />
                    <span className="font-medium text-foreground">{r.id}</span>
                    <span className="text-mono">{r.healthy}/{r.bots}</span>
                    <span className="text-muted-foreground/70 text-mono">· {r.latency}ms</span>
                  </span>
                ))}
              </div>
              <Link to="/accounts" className="font-semibold text-primary hover:underline">View fleet →</Link>
            </div>
          </section>

          {/* Throughput chart */}
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">Trade Throughput</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Per-minute settlements across the fleet</p>
              </div>
              <span className="rounded border border-success/20 bg-success/10 px-2 py-0.5 text-mono text-[10px] font-bold uppercase text-success">
                {errorRate}% error
              </span>
            </div>
            <div className="flex h-28 items-end gap-1">
              {throughput.map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t-sm ${
                    h >= 80 ? "bg-primary" : h >= 55 ? "bg-primary/60" : "bg-muted"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total settled</p>
                <p className="text-mono text-lg font-bold text-foreground">{settled.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gold Flair · 24h</p>
                <p className="text-mono text-lg font-bold text-foreground">
                  {goldFlair} <span className="ml-1 text-xs font-medium text-success">+12%</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Avg latency</p>
                <p className="text-mono text-lg font-bold text-foreground">412ms</p>
              </div>
            </div>
          </section>

          {/* Active alerts */}
          <section>
            <SectionLabel
              action={<Link to="/events" className="text-[11px] font-semibold text-primary hover:underline">Manage →</Link>}
            >
              Active Alerts ({alerts.length})
            </SectionLabel>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className={`flex items-center justify-between rounded-r-lg border-l-2 bg-surface/50 p-3 ${sevBorder[a.sev]}`}>
                  <div className="flex items-center gap-3">
                    <div className={`grid h-8 w-8 place-items-center rounded ${sevBg[a.sev]}`}>
                      {a.sev === "danger" ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{a.meta}</p>
                    </div>
                  </div>
                  <button className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${
                    a.sev === "danger"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}>
                    {a.action}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Top issues + quick activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card/40 p-5">
              <SectionLabel>Top Issues Requiring Attention</SectionLabel>
              <ul className="divide-y divide-border">
                {issues.map((i, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-mono w-5 shrink-0 text-[11px] text-muted-foreground">{idx + 1}.</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{i.title}</p>
                        <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{i.entity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-mono text-[10px] ${i.sev === "danger" ? "text-destructive" : i.sev === "warning" ? "text-warning" : "text-muted-foreground"}`}>
                        {i.age}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-border bg-card/40 p-5">
              <SectionLabel>Activity Snapshot · 24h</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Crosshair, label: "Active hunts", value: "12", sub: "+3 vs yest." },
                  { icon: Gem,       label: "Gold Flair",   value: "184", sub: "+12%" },
                  { icon: Gift,      label: "Gift batches", value: "18",  sub: "22 recipients" },
                  { icon: Sparkles,  label: "Hunt success", value: "94%", sub: "rolling 24h" },
                  { icon: Boxes,     label: "Inventory drift", value: "0",   sub: "parity OK" },
                  { icon: RotateCcw, label: "Token rotates",   value: "6",   sub: "auto · 24h" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-mono mt-1.5 text-lg font-bold text-foreground">{m.value}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{m.sub}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Quick actions */}
          <nav className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { to: "/hunts",      title: "New Hunt",         tag: "Deployment",  icon: Plus },
              { to: "/gold-flair", title: "Gold Flair Queue", tag: "Premium",     icon: Gem },
              { to: "/gifts",      title: "Gift Batches",     tag: "Outbound",    icon: Gift },
              { to: "/admin/fleet",title: "Fleet Rotation",   tag: "Maintenance", icon: RotateCcw },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="group rounded-xl border border-border bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{a.tag}</p>
                  <a.icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{a.title}</p>
              </Link>
            ))}
          </nav>
        </div>

        {/* RIGHT RAIL — Event stream (desktop), stacks below on mobile/tablet */}
        <aside className="rounded-xl border border-border bg-card/40 p-5 xl:sticky xl:top-16 xl:h-fit">
          <SectionLabel
            action={<Link to="/events" className="text-[11px] font-semibold text-primary hover:underline">View all →</Link>}
          >
            Event Stream
          </SectionLabel>
          <div className="relative space-y-4">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            {events.map((e, i) => (
              <div key={i} className="relative flex gap-4">
                <div className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background">
                  <span className={`h-2 w-2 rounded-full ${dotBg[e.dot]}`} />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-medium text-foreground">{e.title}</p>
                    <span className="text-mono shrink-0 text-[10px] text-muted-foreground">{e.t}</span>
                  </div>
                  <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{e.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
