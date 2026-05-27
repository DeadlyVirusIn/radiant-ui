import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { QUEUE_SNAPSHOTS } from "@/lib/mock-admin-queues";

const ROUTE: Record<string, string> = {
  hunts: "/admin/queues?tab=hunts",
  trades: "/admin/queues?tab=trades",
  gifts: "/admin/queues?tab=gifts",
  mint: "/admin/queues?tab=mint",
};

/**
 * Compact per-queue depth strip. Each bar deep-links to the matching Queues tab.
 */
export function QueueDepthStrip() {
  const max = Math.max(...Object.values(QUEUE_SNAPSHOTS).map((q) => q.depth), 1);
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Queue depth
      </h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.values(QUEUE_SNAPSHOTS).map((q) => {
          const pct = Math.max(6, (q.depth / max) * 100);
          const hot = q.depth >= 10;
          return (
            <Link
              key={q.key}
              to={ROUTE[q.key]}
              className="group rounded-lg border border-border bg-card/40 p-3 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  {q.label}
                </span>
                <span className="text-mono text-base font-bold">{q.depth}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
                <div
                  className={cn("h-full transition-all", hot ? "bg-warning" : "bg-success")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>oldest {q.oldestAgeMin}m</span>
                <span>p95 {q.p95WaitSec}s</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
