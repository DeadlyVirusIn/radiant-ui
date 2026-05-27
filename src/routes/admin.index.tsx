import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  Brain,
  CheckCircle2,
  Crosshair,
  Gem,
  Gift,
  Loader2,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { HealthSummaryRow } from "@/components/admin/HealthSummaryRow";
import { QueueDepthStrip } from "@/components/admin/QueueDepthStrip";
import { AlertsList } from "@/components/admin/AlertsList";
import { RecentFailures } from "@/components/admin/RecentFailures";
import { SLABreaches } from "@/components/admin/SLABreaches";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Mission Control · Admin — Radiant" }] }),
  component: Dashboard,
});

// ─────────────────────────────────────────────────────────────
// PackHunter-specific status vocabulary
type Status =
  | "ready-to-send"
  | "needs-mint"
  | "low-stock"
  | "out-of-stock"
  | "waiting-for-user"
  | "in-progress"
  | "completed"
  | "failed";

const STATUS_META: Record<Status, { label: string; tone: "success" | "warning" | "danger" | "primary" | "muted"; icon: React.ComponentType<{ className?: string }> }> = {
  "ready-to-send":     { label: "Ready to Send",     tone: "success",  icon: Send },
  "needs-mint":        { label: "Needs Mint",        tone: "warning",  icon: Sparkles },
  "low-stock":         { label: "Low Stock",         tone: "warning",  icon: Boxes },
  "out-of-stock":      { label: "Out of Stock",      tone: "danger",   icon: XCircle },
  "waiting-for-user":  { label: "Waiting for User",  tone: "muted",    icon: UserCheck },
  "in-progress":       { label: "In Progress",       tone: "primary",  icon: Loader2 },
  "completed":         { label: "Completed",         tone: "success",  icon: CheckCircle2 },
  "failed":            { label: "Failed",            tone: "danger",   icon: XCircle },
};

const toneChip: Record<string, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger:  "bg-destructive/10 text-destructive border-destructive/20",
  primary: "bg-primary/10 text-primary border-primary/20",
  muted:   "bg-muted/40 text-muted-foreground border-border",
};
const toneDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-destructive",
  primary: "bg-primary",
  muted:   "bg-muted-foreground/60",
};
const toneBorder: Record<string, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  danger:  "border-l-destructive",
  primary: "border-l-primary",
  muted:   "border-l-border",
};

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneChip[m.tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${toneDot[m.tone]}`} />
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Mock PackHunter data
const aiSummary = {
  posture: "Stable with two pressure points",
  highlights: [
    "Hunt throughput up 8% vs 24h baseline — EU-W queue absorbing surge.",
    "Gold Flair mint backlog (14 pending) is the current rate-limiting step for trade settlement.",
    "Sneakerhead-7 inventory is two pulls away from Out of Stock; recommend rotating SKU SH-204 into hunt-12.",
  ],
  next: "Mint 14 Gold Flair · then release hunts 12, 14, 17",
};

const needsAttention: Array<{
  id: string;
  entity: "Hunt" | "Gold Flair" | "Gift" | "Trade" | "Inventory";
  title: string;
  status: Status;
  detail: string;
  age: string;
  cta: string;
}> = [
  { id: "h-12",  entity: "Hunt",       title: "Hunt slot B stalled past ETA",          status: "in-progress",      detail: "HUNT-12 · EU-W · waiting on bot-07",     age: "8m",  cta: "Reassign" },
  { id: "gf-q", entity: "Gold Flair", title: "14 Gold Flair awaiting mint",            status: "needs-mint",       detail: "Queue depth +6 in last hour",            age: "14m", cta: "Mint batch" },
  { id: "gi-19",entity: "Gift",       title: "Gift batch B-19 partial delivery",       status: "waiting-for-user", detail: "2 of 24 recipients un-claimed",          age: "33m", cta: "Notify" },
  { id: "inv-7",entity: "Inventory",  title: "Sneakerhead-7 stock dropping",           status: "low-stock",        detail: "3 units left · SKU SH-204",              age: "1h",  cta: "Restock" },
  { id: "t-9f", entity: "Trade",      title: "Trade #A9F2 awaiting counterparty",      status: "waiting-for-user", detail: "fleet-3 · sent 9m ago",                  age: "9m",  cta: "Ping" },
  { id: "h-09", entity: "Hunt",       title: "Hunt-09 settle handshake failed",        status: "failed",           detail: "Retry budget exhausted · bot-02",        age: "22m", cta: "Resolve" },
];

// First-class entity rails
const hunts = [
  { id: "HUNT-12", status: "in-progress" as Status,    target: "Sneakerhead-7", region: "EU-W", eta: "+28m" },
  { id: "HUNT-14", status: "ready-to-send" as Status,  target: "Streetcap",      region: "NA-E", eta: "queued" },
  { id: "HUNT-17", status: "ready-to-send" as Status,  target: "Heatlist",       region: "JP",   eta: "queued" },
  { id: "HUNT-09", status: "failed" as Status,         target: "Sneakerhead-3",  region: "EU-W", eta: "—" },
  { id: "HUNT-08", status: "completed" as Status,      target: "Drop-tracker",   region: "OCE",  eta: "settled" },
];

const goldFlair = { needsMint: 14, readyToSend: 6, inProgress: 3, completed24h: 184, failed24h: 1 };
const gifts =     { readyToSend: 18, waitingForUser: 4, completed24h: 22, failed24h: 0 };
const trades =    { inProgress: 7, waitingForUser: 5, completed24h: 2418, failed24h: 4 };

const inventory = [
  { name: "Sneakerhead-7", sku: "SH-204", status: "low-stock"    as Status, qty:  3, of: 50 },
  { name: "Streetcap",     sku: "SC-118", status: "ready-to-send" as Status, qty: 42, of: 50 },
  { name: "Heatlist Pro",  sku: "HL-077", status: "needs-mint"   as Status, qty: 12, of: 50 },
  { name: "Drop-tracker",  sku: "DT-301", status: "out-of-stock" as Status, qty:  0, of: 25 },
];

const fleet = { healthy: 40, total: 42, regions: [
  { id: "NA-E", state: "ok",   bots: 12 },
  { id: "EU-W", state: "warn", bots: 10 },
  { id: "JP",   state: "ok",   bots:  8 },
  { id: "OCE",  state: "ok",   bots: 12 },
]};

// ─────────────────────────────────────────────────────────────
function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>
      {action}
    </div>
  );
}

function EntityCard({
  title, to, icon: Icon, accent, stats, footer,
}: {
  title: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tone key
  stats: Array<{ label: string; value: string | number; status?: Status }>;
  footer?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-primary/40 hover:bg-card"
    >
      <div className={`absolute left-0 top-0 h-full w-0.5 ${toneDot[accent]}`} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`grid h-7 w-7 place-items-center rounded-md border ${toneChip[accent]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <h4 className="font-display text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-border/50 bg-background/40 p-2">
            <p className="text-mono text-base font-bold leading-tight text-foreground">{s.value}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
            {s.status && <div className="mt-1.5"><StatusPill status={s.status} /></div>}
          </div>
        ))}
      </div>
      {footer && <div className="mt-3 border-t border-border/60 pt-3">{footer}</div>}
    </Link>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            PackHunter Operational · {fleet.healthy}/{fleet.total} bots
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Mission Control
          </h1>
          <p className="text-sm text-muted-foreground">
            Hunts, Gold Flair, Gifts, Trades and Inventory — operations-first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Pause className="h-3.5 w-3.5" /> Pause fleet
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-6px_var(--primary)] transition-colors hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> New hunt
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* PRIMARY COLUMN */}
        <div className="space-y-4">

          {/* 1. AI OPERATIONS SUMMARY (hero) */}
          <section className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.06] via-card/60 to-card/40 p-5">
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-primary/30" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">AI Operations Summary</p>
                  <p className="font-display text-base font-semibold text-foreground">{aiSummary.posture}</p>
                </div>
              </div>
              <span className="text-mono shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">updated 12s ago</span>
            </div>
            <ul className="mt-4 space-y-2">
              {aiSummary.highlights.map((h, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                  <span className="text-mono mt-1 shrink-0 text-[10px] text-primary">0{i + 1}</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-2 text-xs">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Recommended next:</span>
                <span className="font-semibold text-foreground">{aiSummary.next}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded-md border border-border bg-card/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                  Dismiss
                </button>
                <button className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
                  <Play className="h-3 w-3" /> Run plan
                </button>
              </div>
            </div>
          </section>

          {/* 2. NEEDS ATTENTION QUEUE */}
          <section>
            <SectionLabel
              action={<Link to="/events" className="text-[11px] font-semibold text-primary hover:underline">Open queue →</Link>}
            >
              Needs Attention · {needsAttention.length}
            </SectionLabel>
            <div className="overflow-hidden rounded-xl border border-border bg-card/30">
              <ul className="divide-y divide-border">
                {needsAttention.map((item) => {
                  const tone = STATUS_META[item.status].tone;
                  return (
                    <li key={item.id} className={`flex flex-col gap-2 border-l-2 p-3 transition-colors hover:bg-card/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${toneBorder[tone]}`}>
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="text-mono w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:w-20">
                          {item.entity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground break-words">{item.title}</p>
                          <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground break-words">{item.detail}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-[4.5rem] sm:pl-0 sm:shrink-0">
                        <StatusPill status={item.status} />
                        <span className="text-mono w-10 text-[10px] text-muted-foreground sm:text-right">{item.age}</span>
                        <button className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          tone === "danger"
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            : "border border-border bg-background/60 text-foreground hover:bg-card"
                        }`}>
                          {item.cta}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* 3. FIRST-CLASS ENTITY RAILS */}
          <section>
            <SectionLabel>Operational Entities</SectionLabel>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <EntityCard
                title="Hunts" to="/hunts" icon={Crosshair} accent="primary"
                stats={[
                  { label: "In Progress",   value: hunts.filter(h => h.status === "in-progress").length,   status: "in-progress" },
                  { label: "Ready to Send", value: hunts.filter(h => h.status === "ready-to-send").length, status: "ready-to-send" },
                  { label: "Failed",        value: hunts.filter(h => h.status === "failed").length,        status: "failed" },
                  { label: "Completed 24h", value: 47 },
                ]}
                footer={
                  <ul className="space-y-1.5 text-[11px]">
                    {hunts.slice(0, 3).map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2">
                        <span className="text-mono text-muted-foreground">{h.id}</span>
                        <span className="truncate text-foreground/80">{h.target}</span>
                        <StatusPill status={h.status} />
                      </li>
                    ))}
                  </ul>
                }
              />
              <EntityCard
                title="Gold Flair" to="/gold-flair" icon={Gem} accent="warning"
                stats={[
                  { label: "Needs Mint",    value: goldFlair.needsMint,    status: "needs-mint" },
                  { label: "Ready to Send", value: goldFlair.readyToSend,  status: "ready-to-send" },
                  { label: "In Progress",   value: goldFlair.inProgress,   status: "in-progress" },
                  { label: "Completed 24h", value: goldFlair.completed24h },
                ]}
              />
              <EntityCard
                title="Gifts" to="/gifts" icon={Gift} accent="success"
                stats={[
                  { label: "Ready to Send",    value: gifts.readyToSend,    status: "ready-to-send" },
                  { label: "Waiting for User", value: gifts.waitingForUser, status: "waiting-for-user" },
                  { label: "Completed 24h",    value: gifts.completed24h },
                  { label: "Failed 24h",       value: gifts.failed24h },
                ]}
              />
              <EntityCard
                title="Trades" to="/trades" icon={Repeat2} accent="primary"
                stats={[
                  { label: "In Progress",      value: trades.inProgress,      status: "in-progress" },
                  { label: "Waiting for User", value: trades.waitingForUser,  status: "waiting-for-user" },
                  { label: "Completed 24h",    value: trades.completed24h.toLocaleString() },
                  { label: "Failed 24h",       value: trades.failed24h,       status: "failed" },
                ]}
              />
            </div>
          </section>

          {/* 4. INVENTORY (first-class) */}
          <section className="rounded-xl border border-border bg-card/40">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-display text-sm font-semibold text-foreground">Inventory</h3>
              </div>
              <Link to="/inventory" className="text-[11px] font-semibold text-primary hover:underline">Manage stock →</Link>
            </div>
            <ul className="divide-y divide-border">
              {inventory.map((row) => {
                const pct = Math.round((row.qty / row.of) * 100);
                const tone = STATUS_META[row.status].tone;
                return (
                  <li key={row.sku} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 sm:grid-cols-[1fr_120px_180px_auto]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                      <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{row.sku}</p>
                    </div>
                    <p className="text-mono hidden text-sm font-bold text-foreground sm:block">
                      {row.qty}<span className="text-muted-foreground"> / {row.of}</span>
                    </p>
                    <div className="hidden h-1.5 overflow-hidden rounded-full bg-muted/40 sm:block">
                      <div className={`h-full ${toneDot[tone]}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <StatusPill status={row.status} />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <aside className="space-y-4 xl:sticky xl:top-16 xl:h-fit">
          {/* Fleet snapshot */}
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <SectionLabel
              action={<Link to="/accounts" className="text-[11px] font-semibold text-primary hover:underline">Fleet →</Link>}
            >
              Fleet · {fleet.healthy}/{fleet.total}
            </SectionLabel>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-mono text-3xl font-bold tracking-tight text-foreground">95.2%</span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">healthy</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {fleet.regions.map((r) => (
                <div key={r.id} className="space-y-1.5">
                  <div className={`h-1.5 rounded-full ${r.state === "warn" ? "bg-warning" : "bg-success"}`} />
                  <div className="text-center">
                    <p className="text-mono text-[10px] font-bold text-foreground">{r.id}</p>
                    <p className="text-mono text-[10px] text-muted-foreground">{r.bots}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick ops */}
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <SectionLabel>Quick Operations</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: "/hunts",      title: "New Hunt",   icon: Plus,       tone: "primary" },
                { to: "/gold-flair", title: "Mint Batch", icon: Sparkles,   tone: "warning" },
                { to: "/gifts",      title: "Send Gifts", icon: Send,       tone: "success" },
                { to: "/admin/fleet",title: "Rotate Bot", icon: RotateCcw,  tone: "muted"   },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="group rounded-lg border border-border bg-background/40 p-3 transition-all hover:border-primary/40">
                  <div className={`mb-2 grid h-7 w-7 place-items-center rounded-md border ${toneChip[a.tone]}`}>
                    <a.icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">{a.title}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Live activity (compact) */}
          <section className="rounded-xl border border-border bg-card/40 p-5">
            <SectionLabel
              action={<Link to="/events" className="text-[11px] font-semibold text-primary hover:underline">All →</Link>}
            >
              Live Activity
            </SectionLabel>
            <ul className="space-y-2.5 text-[11px]">
              {[
                { t: "14:32", title: "Trade #A9F2 settled",       tag: "Trade · Completed",     tone: "success" },
                { t: "14:31", title: "HUNT-12 opened",            tag: "Hunt · In Progress",    tone: "primary" },
                { t: "14:30", title: "bot-07 rate limited",       tag: "Fleet · Failed",        tone: "danger"  },
                { t: "14:28", title: "Gift batch B-18 delivered", tag: "Gift · Completed",      tone: "success" },
                { t: "14:25", title: "SH-204 low stock alert",    tag: "Inventory · Low Stock", tone: "warning" },
                { t: "14:21", title: "bot-02 token rotated",      tag: "Fleet · Completed",     tone: "muted"   },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[e.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-foreground">{e.title}</p>
                      <span className="text-mono shrink-0 text-[10px] text-muted-foreground">{e.t}</span>
                    </div>
                    <p className="text-mono mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">{e.tag}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Watchlist */}
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <SectionLabel
              action={<ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
            >
              Watchlist
            </SectionLabel>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between"><span className="text-foreground">bot-07 EU-W</span><StatusPill status="failed" /></li>
              <li className="flex items-center justify-between"><span className="text-foreground">SH-204 stock</span><StatusPill status="low-stock" /></li>
              <li className="flex items-center justify-between"><span className="text-foreground">DT-301 stock</span><StatusPill status="out-of-stock" /></li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
