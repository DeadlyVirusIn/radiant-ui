import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Calendar, Activity, AlertTriangle, Timer, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScheduledJobDrawer } from "@/components/admin/ScheduledJobDrawer";
import {
  SCHEDULED_JOBS, JOB_RUNS, JOB_BY_ID, JOB_STATE, RUN_STATUS,
  schedulerKpis, fmtDurMs, fmtRelFrom,
} from "@/lib/mock-admin-scheduler";

type Tab = "running" | "schedule" | "recent" | "failures";
type Search = { tab?: Tab; id?: string };

export const Route = createFileRoute("/admin/scheduler")({
  head: () => ({ meta: [{ title: "Admin · Scheduler — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (s.tab as Tab) ?? undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: Scheduler,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "running",  label: "Running" },
  { key: "schedule", label: "Schedule" },
  { key: "recent",   label: "Recent runs" },
  { key: "failures", label: "Failures" },
];

function Scheduler() {
  const navigate = useNavigate({ from: "/admin/scheduler" });
  const search = useSearch({ from: "/admin/scheduler" }) as Search;
  const tab: Tab = search.tab ?? "running";

  const kpis = useMemo(() => schedulerKpis(), []);

  const openJob = (id: string | undefined) =>
    navigate({ search: { ...search, id } });
  const selected = search.id ? JOB_BY_ID[search.id] ?? null : null;

  const runningRuns = JOB_RUNS.filter((r) => r.status === "running");
  const recentRuns = [...JOB_RUNS].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  const failureRuns = JOB_RUNS
    .filter((r) => r.status === "failed" || r.status === "timeout")
    .sort((a, b) => b.startedAt - a.startedAt);

  return (
    <>
      <PageHeader
        title="Scheduler"
        description="Cron-style jobs across the fleet. Operational preview — values shown are mock data, not wired to the live scheduler."
        actions={
          <Badge variant="outline" className="h-6 border-warning/40 bg-warning/10 text-[10px] font-semibold uppercase tracking-wider text-warning">
            Mock data · read-only
          </Badge>
        }
      />

      {/* KPI ROW — canonical */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Running now"   value={String(kpis.running)}      icon={Activity}       tone={kpis.running > 0 ? "primary" : "default"} />
        <StatCard label="Enabled"       value={String(kpis.enabled)}      icon={Calendar}       tone="success" />
        <StatCard label="Paused"        value={String(kpis.paused)}       tone={kpis.paused > 0 ? "warning" : "default"} />
        <StatCard label="Failures 24h"  value={String(kpis.failures24h)}  icon={AlertTriangle}  tone={kpis.failures24h > 0 ? "danger" : "default"} />
        <StatCard label="Next run"      value={fmtRelFrom(kpis.nextRun)}  icon={Clock}          tone="primary" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { ...search, tab: v as Tab } })}
        className="mt-6 min-w-0"
      >
        <div className="relative mb-4 -mx-4 max-w-[100vw] overflow-hidden md:-mx-6">
          <div className="overflow-x-auto px-4 pr-10 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden" />
        </div>

        {/* ─── RUNNING ───────────────────────────────────────────── */}
        <TabsContent value="running">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Run</th>
                    <th className="px-5 py-3">Job</th>
                    <th className="px-5 py-3">Worker</th>
                    <th className="px-5 py-3">Started</th>
                    <th className="px-5 py-3">Elapsed</th>
                    <th className="px-5 py-3">Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runningRuns.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-muted-foreground">No jobs currently running.</td></tr>
                  )}
                  {runningRuns.map((r) => {
                    const job = JOB_BY_ID[r.jobId];
                    const elapsed = Date.now() - r.startedAt;
                    return (
                      <tr key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => job && openJob(job.id)}>
                        <td className="px-5 py-3 text-mono text-xs">{r.id}</td>
                        <td className="px-5 py-3">
                          <div className="text-sm font-semibold">{job?.name ?? r.jobId}</div>
                          <div className="text-mono text-[10px] text-muted-foreground">{job?.cron}</div>
                        </td>
                        <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{r.worker}</td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtRelFrom(r.startedAt)}</td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtDurMs(elapsed)}</td>
                        <td className="px-5 py-3 text-xs capitalize text-muted-foreground">{r.triggeredBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ─── SCHEDULE (all jobs) ───────────────────────────────── */}
        <TabsContent value="schedule">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Job</th>
                    <th className="px-5 py-3">Cron</th>
                    <th className="px-5 py-3">State</th>
                    <th className="px-5 py-3">Last run</th>
                    <th className="px-5 py-3">Last status</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Next run</th>
                    <th className="px-5 py-3">Fail 24h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SCHEDULED_JOBS.map((j) => {
                    const sm = JOB_STATE[j.state];
                    const lm = j.lastStatus ? RUN_STATUS[j.lastStatus] : null;
                    return (
                      <tr key={j.id} className="cursor-pointer hover:bg-accent/40" onClick={() => openJob(j.id)}>
                        <td className="px-5 py-3">
                          <div className="text-sm font-semibold">{j.name}</div>
                          <div className="text-[10px] text-muted-foreground">{j.owner}</div>
                        </td>
                        <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{j.cron}</td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[sm.tone])}>{sm.label}</Badge>
                        </td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtRelFrom(j.lastRunAt)}</td>
                        <td className="px-5 py-3">
                          {lm ? (
                            <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[lm.tone])}>{lm.label}</Badge>
                          ) : <span className="text-mono text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtDurMs(j.lastDurationMs)}</td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtRelFrom(j.nextRunAt)}</td>
                        <td className={cn("px-5 py-3 text-mono text-xs", j.failures24h > 0 && "text-destructive")}>{j.failures24h}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ─── RECENT RUNS ───────────────────────────────────────── */}
        <TabsContent value="recent">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Run</th>
                    <th className="px-5 py-3">Job</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Started</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Attempt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentRuns.map((r) => {
                    const m = RUN_STATUS[r.status];
                    const job = JOB_BY_ID[r.jobId];
                    return (
                      <tr key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => job && openJob(job.id)}>
                        <td className="px-5 py-3 text-mono text-xs">{r.id}</td>
                        <td className="px-5 py-3">{job?.name ?? r.jobId}</td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>{m.label}</Badge>
                        </td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtRelFrom(r.startedAt)}</td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtDurMs(r.durationMs)}</td>
                        <td className="px-5 py-3 text-mono text-xs">{r.attempt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ─── FAILURES ──────────────────────────────────────────── */}
        <TabsContent value="failures">
          <Section padded={false}>
            {failureRuns.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                No failed or timed-out runs in the last 24h.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {failureRuns.map((r) => {
                  const m = RUN_STATUS[r.status];
                  const job = JOB_BY_ID[r.jobId];
                  return (
                    <li
                      key={r.id}
                      className="cursor-pointer px-5 py-4 hover:bg-accent/30"
                      onClick={() => job && openJob(job.id)}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Timer className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-sm font-semibold">{job?.name ?? r.jobId}</span>
                            <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>{m.label}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{r.lastError ?? "No error message recorded."}</p>
                          <p className="text-mono mt-1 text-[10px] text-muted-foreground">
                            {r.id} · {r.worker} · attempt {r.attempt} · {fmtRelFrom(r.startedAt)}
                          </p>
                        </div>
                        <div className="text-mono shrink-0 text-xs text-muted-foreground sm:pl-4">
                          {fmtDurMs(r.durationMs)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <ScheduledJobDrawer
        job={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) openJob(undefined); }}
      />
    </>
  );
}
