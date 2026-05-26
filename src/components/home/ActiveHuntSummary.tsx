import { Link } from "@tanstack/react-router";
import { ArrowRight, Crosshair } from "lucide-react";
import type { ActiveHunt } from "@/lib/mock-home";

const statusMeta: Record<ActiveHunt["status"], { label: string; cls: string }> = {
  in_progress:   { label: "In progress",   cls: "bg-primary/15 text-primary border-primary/30" },
  ready_to_send: { label: "Ready to send", cls: "bg-success/15 text-success border-success/30" },
};

export function ActiveHuntSummary({ hunt }: { hunt: ActiveHunt }) {
  const s = statusMeta[hunt.status];
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-warning/10 text-warning">
            <Crosshair className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">Active hunt</h3>
            <p className="text-xs text-muted-foreground">Your current chase</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>
          {s.label}
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold text-foreground">{hunt.name}</p>
          <p className="truncate text-xs text-muted-foreground">{hunt.set}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">ETA</p>
          <p className="font-mono text-sm font-semibold text-warning">{hunt.etaLabel}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span className="font-mono">{hunt.progress}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-warning to-warning/50"
            style={{ width: `${hunt.progress}%` }}
          />
        </div>
      </div>
      <Link
        to="/hunt"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-warning-foreground hover:bg-warning/90"
      >
        Open hunt monitor <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
