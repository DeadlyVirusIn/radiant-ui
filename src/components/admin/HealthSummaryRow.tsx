import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOMAIN_HEALTH, fmtRel } from "@/lib/mock-admin-health";

const DOT: Record<string, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  down: "bg-destructive",
};
const RING: Record<string, string> = {
  ok: "ring-success/30",
  warn: "ring-warning/40",
  down: "ring-destructive/40",
};

/**
 * 5-tile health summary row. Each tile deep-links into the relevant operator
 * page so an alert at-a-glance becomes a one-click investigation.
 */
export function HealthSummaryRow() {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Domain health
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {DOMAIN_HEALTH.map((d) => (
          <Link
            key={d.domain}
            to={d.href}
            className={cn(
              "group relative flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3 ring-1 transition-colors hover:border-primary/40 hover:bg-card",
              RING[d.status],
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", DOT[d.status])} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  {d.label}
                </span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-mono text-lg font-bold leading-none">{d.queueDepth}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">in queue</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>last exec {fmtRel(d.lastExecAt)}</span>
              {d.errors1h > 0 && (
                <span className="font-semibold text-destructive">{d.errors1h} err/h</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
