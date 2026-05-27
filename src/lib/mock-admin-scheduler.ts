// Operator-grade scheduler view. Read-only: jobs, current runs, recent history.

export type JobState = "enabled" | "paused" | "disabled";
export type RunStatus = "running" | "success" | "failed" | "skipped" | "timeout";

export type ScheduledJob = {
  id: string;
  name: string;
  cron: string;
  description: string;
  owner: string;
  state: JobState;
  lastRunAt: number | null;
  lastStatus: RunStatus | null;
  lastDurationMs: number | null;
  nextRunAt: number | null;
  avgDurationMs: number;
  successRate7d: number; // 0..1
  failures24h: number;
};

export type JobRun = {
  id: string;
  jobId: string;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  status: RunStatus;
  attempt: number;
  worker: string;
  triggeredBy: "schedule" | "manual" | "retry";
  lastError?: string;
};

const now = Date.now();
const mins = (n: number) => now - n * 60_000;
const future = (n: number) => now + n * 60_000;

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    id: "JOB-daily-login",     name: "Daily login",      cron: "0 4 * * *",
    description: "Walks the fleet and clears the daily login reward for every active account.",
    owner: "fleet-ops",  state: "enabled",
    lastRunAt: mins(60 * 18), lastStatus: "success", lastDurationMs: 142_000,
    nextRunAt: future(60 * 6), avgDurationMs: 138_000, successRate7d: 0.99, failures24h: 0,
  },
  {
    id: "JOB-token-rotate",    name: "Token rotate",     cron: "0 */6 * * *",
    description: "Rotates session tokens across fleet workers; pages on-call if rotation budget is exhausted.",
    owner: "platform",   state: "enabled",
    lastRunAt: mins(48),      lastStatus: "running", lastDurationMs: null,
    nextRunAt: future(60 * 1 + 12), avgDurationMs: 26_000, successRate7d: 0.97, failures24h: 1,
  },
  {
    id: "JOB-backup-snap",     name: "Backup snapshot",  cron: "0 2 * * *",
    description: "Snapshots fleet config, hunt config and trust ledger to cold storage.",
    owner: "platform",   state: "enabled",
    lastRunAt: mins(60 * 20), lastStatus: "success", lastDurationMs: 312_000,
    nextRunAt: future(60 * 4), avgDurationMs: 305_000, successRate7d: 1.00, failures24h: 0,
  },
  {
    id: "JOB-weekly-digest",   name: "Weekly digest",    cron: "0 9 * * 1",
    description: "Emails the weekly operator digest with fleet KPIs and incident timeline.",
    owner: "ops",        state: "paused",
    lastRunAt: mins(60 * 24 * 5), lastStatus: "success", lastDurationMs: 4_800,
    nextRunAt: null, avgDurationMs: 5_100, successRate7d: 0.98, failures24h: 0,
  },
  {
    id: "JOB-trust-recompute", name: "Trust recompute",  cron: "*/15 * * * *",
    description: "Recomputes counterparty trust scores from the last 24h trade ledger.",
    owner: "trust",      state: "enabled",
    lastRunAt: mins(3),       lastStatus: "running", lastDurationMs: null,
    nextRunAt: future(12), avgDurationMs: 84_000, successRate7d: 0.95, failures24h: 2,
  },
  {
    id: "JOB-gift-resolver",   name: "Gift recipient resolver", cron: "*/10 * * * *",
    description: "Refreshes recipient cache for queued gifts and retries failed lookups.",
    owner: "gifts",      state: "enabled",
    lastRunAt: mins(8),       lastStatus: "failed",  lastDurationMs: 41_000,
    nextRunAt: future(2),  avgDurationMs: 36_000, successRate7d: 0.88, failures24h: 4,
  },
  {
    id: "JOB-mint-batcher",    name: "Mint batcher",     cron: "*/5 * * * *",
    description: "Groups pending Gold Flair requests into mint batches for the signer pool.",
    owner: "gold-flair", state: "enabled",
    lastRunAt: mins(2),       lastStatus: "success", lastDurationMs: 9_800,
    nextRunAt: future(3),  avgDurationMs: 10_200, successRate7d: 0.99, failures24h: 0,
  },
  {
    id: "JOB-hunt-config-roll",name: "Hunt config rollout", cron: "0 */1 * * *",
    description: "Promotes staged hunt configs to canary, then to fleet on green canary.",
    owner: "hunt-ops",   state: "enabled",
    lastRunAt: mins(22),      lastStatus: "success", lastDurationMs: 17_400,
    nextRunAt: future(38), avgDurationMs: 16_900, successRate7d: 0.96, failures24h: 1,
  },
];

export const JOB_RUNS: JobRun[] = [
  // currently running
  { id: "RUN-9412", jobId: "JOB-trust-recompute", startedAt: mins(3),  finishedAt: null,        durationMs: null,    status: "running", attempt: 1, worker: "wrk-tr-02", triggeredBy: "schedule" },
  { id: "RUN-9411", jobId: "JOB-token-rotate",    startedAt: mins(48), finishedAt: null,        durationMs: null,    status: "running", attempt: 1, worker: "wrk-pl-01", triggeredBy: "schedule" },

  // recent finished
  { id: "RUN-9410", jobId: "JOB-gift-resolver",   startedAt: mins(8),  finishedAt: mins(7),     durationMs: 41_000,  status: "failed",  attempt: 2, worker: "wrk-gf-03", triggeredBy: "retry",    lastError: "Recipient cache miss · 12 of 184 lookups failed" },
  { id: "RUN-9409", jobId: "JOB-mint-batcher",    startedAt: mins(2),  finishedAt: mins(1),     durationMs: 9_800,   status: "success", attempt: 1, worker: "wrk-gf-01", triggeredBy: "schedule" },
  { id: "RUN-9408", jobId: "JOB-hunt-config-roll",startedAt: mins(22), finishedAt: mins(21),    durationMs: 17_400,  status: "success", attempt: 1, worker: "wrk-hn-04", triggeredBy: "schedule" },
  { id: "RUN-9407", jobId: "JOB-gift-resolver",   startedAt: mins(18), finishedAt: mins(17),    durationMs: 39_000,  status: "failed",  attempt: 1, worker: "wrk-gf-03", triggeredBy: "schedule", lastError: "Recipient cache miss · 9 of 162 lookups failed" },
  { id: "RUN-9406", jobId: "JOB-trust-recompute", startedAt: mins(18), finishedAt: mins(17),    durationMs: 82_000,  status: "success", attempt: 1, worker: "wrk-tr-02", triggeredBy: "schedule" },
  { id: "RUN-9405", jobId: "JOB-mint-batcher",    startedAt: mins(7),  finishedAt: mins(6),     durationMs: 10_400,  status: "success", attempt: 1, worker: "wrk-gf-01", triggeredBy: "schedule" },
  { id: "RUN-9404", jobId: "JOB-token-rotate",    startedAt: mins(60*6 + 48), finishedAt: mins(60*6 + 47), durationMs: 25_000, status: "success", attempt: 1, worker: "wrk-pl-01", triggeredBy: "schedule" },
  { id: "RUN-9403", jobId: "JOB-token-rotate",    startedAt: mins(60*12 + 48), finishedAt: mins(60*12 + 46), durationMs: 118_000, status: "timeout", attempt: 1, worker: "wrk-pl-02", triggeredBy: "schedule", lastError: "Rotation budget exceeded · 8 workers skipped" },
  { id: "RUN-9402", jobId: "JOB-daily-login",     startedAt: mins(60*18), finishedAt: mins(60*18 - 3), durationMs: 142_000, status: "success", attempt: 1, worker: "wrk-fl-09", triggeredBy: "schedule" },
  { id: "RUN-9401", jobId: "JOB-hunt-config-roll",startedAt: mins(82), finishedAt: mins(81),    durationMs: 16_800,  status: "success", attempt: 1, worker: "wrk-hn-04", triggeredBy: "schedule" },
];

export const RUN_STATUS: Record<RunStatus, { label: string; tone: "primary" | "success" | "danger" | "warning" | "muted" }> = {
  running: { label: "Running",  tone: "primary" },
  success: { label: "Success",  tone: "success" },
  failed:  { label: "Failed",   tone: "danger" },
  skipped: { label: "Skipped",  tone: "muted" },
  timeout: { label: "Timeout",  tone: "warning" },
};

export const JOB_STATE: Record<JobState, { label: string; tone: "success" | "warning" | "muted" }> = {
  enabled:  { label: "Enabled",  tone: "success" },
  paused:   { label: "Paused",   tone: "warning" },
  disabled: { label: "Disabled", tone: "muted" },
};

export const JOB_BY_ID: Record<string, ScheduledJob> =
  Object.fromEntries(SCHEDULED_JOBS.map((j) => [j.id, j]));

export function runsForJob(jobId: string): JobRun[] {
  return JOB_RUNS.filter((r) => r.jobId === jobId).sort((a, b) => b.startedAt - a.startedAt);
}

export function schedulerKpis() {
  const running = JOB_RUNS.filter((r) => r.status === "running").length;
  const failures24h = SCHEDULED_JOBS.reduce((n, j) => n + j.failures24h, 0);
  const enabled = SCHEDULED_JOBS.filter((j) => j.state === "enabled").length;
  const paused = SCHEDULED_JOBS.filter((j) => j.state === "paused").length;
  const nextRun = SCHEDULED_JOBS
    .map((j) => j.nextRunAt).filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b)[0] ?? null;
  const avgDuration = Math.round(
    SCHEDULED_JOBS.reduce((n, j) => n + j.avgDurationMs, 0) / SCHEDULED_JOBS.length,
  );
  return { running, failures24h, enabled, paused, nextRun, avgDuration };
}

export function fmtDurMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function fmtRelFrom(ts: number | null): string {
  if (ts == null) return "—";
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000);
  const tag = diff >= 0 ? "in " : "";
  const suffix = diff >= 0 ? "" : " ago";
  if (m < 60) return `${tag}${m}m${suffix}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${tag}${h}h${suffix}`;
  return `${tag}${Math.floor(h / 24)}d${suffix}`;
}
