import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  JOB_STATE, RUN_STATUS, fmtDurMs, fmtRelFrom, runsForJob,
  type ScheduledJob,
} from "@/lib/mock-admin-scheduler";

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

function fmtTs(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : "—";
}

export function ScheduledJobDrawer({
  job, open, onOpenChange,
}: {
  job: ScheduledJob | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!job) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  const stateMeta = JOB_STATE[job.state];
  const lastMeta = job.lastStatus ? RUN_STATUS[job.lastStatus] : null;
  const recent = runsForJob(job.id).slice(0, 8);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-screen max-w-full flex-col gap-0 overflow-y-auto p-0 sm:w-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="font-display text-base">{job.name}</SheetTitle>
              <p className="text-mono mt-1 text-[11px] text-muted-foreground">{job.id}</p>
            </div>
            <Badge variant="outline" className={cn("h-6 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[stateMeta.tone])}>
              {stateMeta.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          <p className="text-sm text-muted-foreground">{job.description}</p>

          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Cron</div>
            <div className="text-mono text-sm">{job.cron}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">Owner · {job.owner}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Last run</span>
              <div className="mt-0.5 text-sm">{fmtRelFrom(job.lastRunAt)}</div>
              <div className="text-mono text-[10px] text-muted-foreground">{fmtTs(job.lastRunAt)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Next run</span>
              <div className="mt-0.5 text-sm">{fmtRelFrom(job.nextRunAt)}</div>
              <div className="text-mono text-[10px] text-muted-foreground">{fmtTs(job.nextRunAt)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Last status</span>
              <div className="mt-0.5">
                {lastMeta ? (
                  <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[lastMeta.tone])}>
                    {lastMeta.label}
                  </Badge>
                ) : <span className="text-mono text-sm">—</span>}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Last duration</span>
              <div className="text-mono mt-0.5 text-sm">{fmtDurMs(job.lastDurationMs)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg duration</span>
              <div className="text-mono mt-0.5 text-sm">{fmtDurMs(job.avgDurationMs)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Success 7d</span>
              <div className="text-mono mt-0.5 text-sm">{Math.round(job.successRate7d * 100)}%</div>
            </div>
            <div>
              <span className="text-muted-foreground">Failures 24h</span>
              <div className={cn("text-mono mt-0.5 text-sm", job.failures24h > 0 && "text-destructive")}>{job.failures24h}</div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Recent runs</div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {recent.length === 0 && (
                <li className="px-3 py-3 text-xs text-muted-foreground">No runs recorded.</li>
              )}
              {recent.map((r) => {
                const m = RUN_STATUS[r.status];
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="text-mono truncate">{r.id}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtRelFrom(r.startedAt)} · {r.worker}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-mono text-[11px]">{fmtDurMs(r.durationMs)}</span>
                      <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>
                        {m.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button size="sm" variant="outline" disabled>Run now</Button>
            <Button size="sm" variant="outline" disabled>{job.state === "paused" ? "Resume" : "Pause"}</Button>
            <Button size="sm" variant="ghost">View runbook</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Read-only view. Actions disabled until scheduler control surface ships.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
