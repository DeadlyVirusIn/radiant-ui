import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity, Pause, Play, RefreshCw, Search, Sparkles, Zap, Timer,
  Bot, Crosshair, ArrowUpRight, GraduationCap, ChevronRight, X, Clock,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hunt")({
  head: () => ({ meta: [{ title: "Hunt Monitor — Radiant" }] }),
  component: HuntMonitor,
});

// ─── Types & Mock Data ──────────────────────────────────────────────────
type Status = "Hunting" | "Paused" | "Stalled" | "Completed";
type Session = {
  id: string;
  target: string;
  status: Status;
  bots: number;
  capacity: number;
  found: number;
  etaMin: number;
  progress: number;
  runtime: string;
  startedAgo: string;
  throughput: number[]; // sparkline
  recent: { card: string; ago: string }[];
};

const SESSIONS: Session[] = [
  { id: "H-2106", target: "Halcyon Mark",  status: "Hunting",   bots: 12, capacity: 14, found: 7, etaMin: 4,  progress: 89, runtime: "1h 42m", startedAgo: "1h ago",
    throughput: [2,3,4,3,5,6,7,8,7,9,8,10], recent: [{ card: "Halcyon Mark · holo", ago: "1m" }, { card: "Halcyon Mark · full art", ago: "6m" }, { card: "Halcyon Mark · holo", ago: "12m" }] },
  { id: "H-2104", target: "Solar Crown",   status: "Hunting",   bots: 8,  capacity: 10, found: 3, etaMin: 12, progress: 64, runtime: "58m",    startedAgo: "58m ago",
    throughput: [1,2,2,3,3,4,3,4,5,4,5,6], recent: [{ card: "Solar Crown · holo", ago: "8m" }, { card: "Solar Crown · holo", ago: "21m" }] },
  { id: "H-2105", target: "Aureate Sigil", status: "Hunting",   bots: 6,  capacity: 8,  found: 1, etaMin: 28, progress: 32, runtime: "34m",    startedAgo: "34m ago",
    throughput: [0,1,1,2,1,2,2,3,2,3,3,3], recent: [{ card: "Aureate Sigil · holo", ago: "19m" }] },
  { id: "H-2103", target: "Halcyon Mark",  status: "Paused",    bots: 4,  capacity: 8,  found: 2, etaMin: 0,  progress: 41, runtime: "22m",    startedAgo: "2h ago",
    throughput: [1,2,2,3,2,2,1,1,0,0,0,0], recent: [{ card: "Halcyon Mark · holo", ago: "1h" }] },
  { id: "H-2101", target: "Solar Crown",   status: "Stalled",   bots: 3,  capacity: 6,  found: 0, etaMin: 0,  progress: 18, runtime: "12m",    startedAgo: "3h ago",
    throughput: [1,1,1,0,0,0,0,0,0,0,0,0], recent: [] },
  { id: "H-2099", target: "Aureate Sigil", status: "Completed", bots: 0,  capacity: 8,  found: 9, etaMin: 0,  progress: 100, runtime: "2h 11m", startedAgo: "5h ago",
    throughput: [2,3,4,5,6,7,8,7,6,5,4,3], recent: [{ card: "Aureate Sigil · full art", ago: "5h" }, { card: "Aureate Sigil · holo", ago: "5h" }] },
];

const STATUS_TONE: Record<Status, string> = {
  Hunting:   "border-primary/40 bg-primary/15 text-primary",
  Paused:    "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Stalled:   "border-destructive/40 bg-destructive/10 text-destructive",
  Completed: "border-success/40 bg-success/10 text-success",
};

const STATUS_DOT: Record<Status, string> = {
  Hunting:   "bg-primary animate-pulse",
  Paused:    "bg-amber-400",
  Stalled:   "bg-destructive",
  Completed: "bg-success",
};

const RECENT_FINDS = [
  { card: "Halcyon Mark · holo",       sessionId: "H-2106", ago: "1m" },
  { card: "Halcyon Mark · full art",   sessionId: "H-2106", ago: "6m" },
  { card: "Solar Crown · holo",        sessionId: "H-2104", ago: "8m" },
  { card: "Halcyon Mark · holo",       sessionId: "H-2106", ago: "12m" },
  { card: "Aureate Sigil · holo",      sessionId: "H-2105", ago: "19m" },
  { card: "Solar Crown · holo",        sessionId: "H-2104", ago: "21m" },
  { card: "Halcyon Mark · holo",       sessionId: "H-2103", ago: "1h" },
];

// ─── Helpers ────────────────────────────────────────────────────────────
type StatusFilter = "all" | Status;
type SortKey = "eta" | "progress" | "bots" | "newest";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "Hunting", label: "Hunting" },
  { id: "Paused", label: "Paused" },
  { id: "Stalled", label: "Stalled" },
  { id: "Completed", label: "Completed" },
];

function Sparkline({ data, tone = "primary" }: { data: number[]; tone?: "primary" | "success" | "muted" }) {
  const w = 120, h = 32;
  const max = Math.max(1, ...data);
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  const stroke = tone === "success" ? "hsl(var(--success))" : tone === "muted" ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_TONE[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  );
}

function ProgressBar({ value, status }: { value: number; status: Status }) {
  const tone =
    status === "Completed" ? "bg-success" :
    status === "Stalled"   ? "bg-destructive/70" :
    status === "Paused"    ? "bg-amber-400" :
                              "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────
function HuntMonitor() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [target, setTarget] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("eta");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Session | null>(null);

  // Counters (computed from mock)
  const live = SESSIONS.filter((s) => s.status === "Hunting").length;
  const botsEngaged = SESSIONS.filter((s) => s.status === "Hunting" || s.status === "Paused").reduce((a, s) => a + s.bots, 0);
  const foundToday = SESSIONS.reduce((a, s) => a + s.found, 0);
  const huntingEtas = SESSIONS.filter((s) => s.status === "Hunting").map((s) => s.etaMin);
  const avgEta = huntingEtas.length ? Math.round(huntingEtas.reduce((a, b) => a + b, 0) / huntingEtas.length) : 0;

  // Targets derived from mock
  const targets = useMemo(() => ["all", ...Array.from(new Set(SESSIONS.map((s) => s.target)))], []);

  // Filter + sort
  const visible = useMemo(() => {
    let list = [...SESSIONS];
    if (status !== "all") list = list.filter((s) => s.status === status);
    if (target !== "all") list = list.filter((s) => s.target === target);
    if (sort === "eta")      list.sort((a, b) => (a.etaMin || 999) - (b.etaMin || 999));
    if (sort === "progress") list.sort((a, b) => b.progress - a.progress);
    if (sort === "bots")     list.sort((a, b) => b.bots - a.bots);
    if (sort === "newest")   list.sort((a, b) => a.id < b.id ? 1 : -1);
    return list;
  }, [status, target, sort]);

  return (
    <>
      <PageHeader
        title="Hunt Monitor"
        description="Live operations view of every running hunt session across the fleet."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><Pause className="h-3.5 w-3.5" /> Pause all</Button>
            <Button size="sm" className="gap-1.5"><Play className="h-3.5 w-3.5" /> New hunt</Button>
          </>
        }
      />

      {/* Hero counters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Live Sessions" value={String(live)}        icon={Activity} tone="primary" />
        <StatCard label="Bots Engaged"  value={String(botsEngaged)} icon={Bot} />
        <StatCard label="Found Today"   value={String(foundToday)}  icon={Sparkles} tone="success" delta={{ value: "+11", direction: "up" }} />
        <StatCard label="Avg ETA"       value={`${avgEta}m`}        icon={Timer}    tone="warning" />
      </div>

      {/* Sticky ops control row */}
      <div className="sticky top-14 z-20 -mx-3 mt-5 border-y border-border/60 bg-background/85 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-md border border-border bg-card/40 text-xs">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatus(f.id)}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  status === f.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {targets.map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  target === t
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "all" ? "All targets" : t}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                autoRefresh
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
              )}
              title="Visual only — no live polling"
            >
              <RefreshCw className={cn("h-3 w-3", autoRefresh && "animate-spin")} style={{ animationDuration: "3s" }} />
              Auto-refresh
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-md border border-border bg-card/40 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="eta">Sort: By ETA</option>
              <option value="progress">Sort: By Progress</option>
              <option value="bots">Sort: By Bots</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bot Allocation strip */}
      <section className="mt-5">
        <header className="mb-2 flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Bot Allocation</h3>
        </header>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {SESSIONS.filter((s) => s.status !== "Completed").map((s) => {
            const active = highlightId === s.id;
            const pct = Math.round((s.bots / s.capacity) * 100);
            return (
              <button
                key={s.id}
                onClick={() => setHighlightId(active ? null : s.id)}
                className={cn(
                  "min-w-[200px] rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-card/40 hover:border-border/80",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>
                  <StatusPill status={s.status} />
                </div>
                <div className="mt-1 truncate text-xs font-medium">{s.target}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.bots}/{s.capacity}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Sessions */}
      <Section title="Active Sessions" description={`${visible.length} ${visible.length === 1 ? "session" : "sessions"}`} className="mt-5">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No sessions match this filter</p>
            <button onClick={() => { setStatus("all"); setTarget("all"); }} className="mt-2 text-xs text-primary hover:underline">Reset filters</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {/* header */}
            <div className="hidden grid-cols-[110px_1fr_110px_70px_70px_70px_180px_auto] items-center gap-3 border-b border-border bg-card/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
              <div>ID</div>
              <div>Target</div>
              <div>Status</div>
              <div className="text-right">Bots</div>
              <div className="text-right">Found</div>
              <div className="text-right">ETA</div>
              <div>Progress</div>
              <div className="text-right">Actions</div>
            </div>
            <ul className="divide-y divide-border">
              {visible.map((s) => {
                const isHi = highlightId === s.id;
                return (
                  <li
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className={cn(
                      "group cursor-pointer px-3 py-3 transition-colors hover:bg-card/60",
                      isHi && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                    )}
                  >
                    {/* desktop row */}
                    <div className="hidden grid-cols-[110px_1fr_110px_70px_70px_70px_180px_auto] items-center gap-3 lg:grid">
                      <span className="font-mono text-xs text-muted-foreground">{s.id}</span>
                      <span className="truncate text-sm font-medium">{s.target}</span>
                      <StatusPill status={s.status} />
                      <span className="text-right font-mono text-xs">{s.bots}<span className="text-muted-foreground">/{s.capacity}</span></span>
                      <span className="text-right font-mono text-xs text-success">{s.found}</span>
                      <span className="text-right font-mono text-xs">{s.etaMin ? `${s.etaMin}m` : "—"}</span>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={s.progress} status={s.status} />
                        <span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{s.progress}%</span>
                      </div>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Pause className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Zap className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><GraduationCap className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary" onClick={() => setSelected(s)}>
                          <Search className="h-3 w-3" /> Inspect
                        </Button>
                      </div>
                    </div>

                    {/* mobile row */}
                    <div className="lg:hidden">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>
                            <StatusPill status={s.status} />
                          </div>
                          <div className="mt-0.5 truncate text-sm font-medium">{s.target}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar value={s.progress} status={s.status} />
                        <span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{s.progress}%</span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span><Bot className="mr-1 inline h-3 w-3" />{s.bots}/{s.capacity}</span>
                        <span><Sparkles className="mr-1 inline h-3 w-3 text-success" />{s.found}</span>
                        <span><Timer className="mr-1 inline h-3 w-3" />{s.etaMin ? `${s.etaMin}m` : "—"}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Section>

      {/* Recent Finds strip */}
      <section className="mt-6">
        <header className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-success" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Finds</h3>
        </header>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {RECENT_FINDS.map((f, i) => (
            <div key={i} className="flex min-w-[260px] items-center gap-3 rounded-lg border border-success/20 bg-success/[0.04] px-3 py-2">
              <div className="grid h-7 w-7 place-items-center rounded-md border border-success/30 bg-success/10 text-success">
                <Crosshair className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{f.card}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{f.sessionId}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {f.ago} ago</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Session Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          {selected && (
            <div>
              {/* Header */}
              <div className="relative border-b border-border bg-gradient-to-br from-primary/10 via-card to-background p-5">
                <button
                  onClick={() => setSelected(null)}
                  className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{selected.id}</span>
                  <StatusPill status={selected.status} />
                </div>
                <h3 className="mt-1 font-display text-xl font-bold tracking-tight">{selected.target}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Started {selected.startedAgo} · Runtime {selected.runtime}</p>
              </div>

              <div className="space-y-5 p-5">
                {/* Stats grid */}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bot Allocation</dt>
                    <dd className="mt-1 font-mono">{selected.bots} <span className="text-muted-foreground">/ {selected.capacity}</span></dd>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Found</dt>
                    <dd className="mt-1 font-mono text-success">{selected.found}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ETA</dt>
                    <dd className="mt-1 font-mono">{selected.etaMin ? `${selected.etaMin}m` : "—"}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Progress</dt>
                    <dd className="mt-1 font-mono">{selected.progress}%</dd>
                  </div>
                </dl>

                {/* Throughput */}
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Throughput (last 12 min)</div>
                    <ArrowUpRight className="h-3 w-3 text-success" />
                  </div>
                  <div className="mt-2"><Sparkline data={selected.throughput} tone="success" /></div>
                </div>

                {/* Recent finds */}
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Finds</h4>
                  {selected.recent.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 text-xs text-muted-foreground">
                      No finds yet in this session.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {selected.recent.map((r, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 bg-card/40 px-3 py-2.5 text-sm">
                          <span className="truncate">{r.card}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{r.ago} ago</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Operator action stack */}
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operator Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5"><Pause className="h-3.5 w-3.5" /> Pause</Button>
                    <Button variant="outline" size="sm" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Scale</Button>
                    <Button variant="outline" size="sm" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Graduate</Button>
                    <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Restart</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
