import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { RECENT_FAILURES, fmtRel } from "@/lib/mock-admin-health";

/**
 * Recent Failures — top 5 actionable items. Each row links to the destination
 * page with ?id=<entity> so the drawer opens directly.
 */
export function RecentFailures() {
  return (
    <section className="rounded-xl border border-border bg-card/40">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Recent failures</h2>
        <span className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          top 5
        </span>
      </header>
      <ul className="divide-y divide-border">
        {RECENT_FAILURES.slice(0, 5).map((f) => (
          <li key={f.id}>
            <Link
              to={f.href}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-card/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {f.domain}
                  </span>
                  <span className="text-mono text-[10px] text-muted-foreground">·</span>
                  <span className="text-mono text-[11px] text-foreground">{f.id}</span>
                  {f.count > 1 && (
                    <span className="rounded bg-destructive/15 px-1.5 text-[10px] font-bold text-destructive">
                      ×{f.count}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-foreground">{f.label}</p>
                <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {fmtRel(f.occurredAt)}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                {f.action}
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
