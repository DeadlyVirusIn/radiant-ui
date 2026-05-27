import { Link } from "@tanstack/react-router";
import { SLA_BREACHES, fmtRel } from "@/lib/mock-admin-health";

export function SLABreaches() {
  return (
    <section className="rounded-xl border border-warning/30 bg-warning/5">
      <header className="flex items-center justify-between gap-3 border-b border-warning/20 px-5 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
          SLA breaches
        </h2>
        <span className="text-mono text-[10px] uppercase tracking-wider text-warning">
          {SLA_BREACHES.length} active
        </span>
      </header>
      <ul className="divide-y divide-warning/20">
        {SLA_BREACHES.map((b) => (
          <li key={b.id}>
            <Link
              to={b.href}
              className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-warning/10"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{b.metric}</p>
                <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {b.domain} · since {fmtRel(b.since)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-mono text-sm font-bold text-warning">{b.actual}</p>
                <p className="text-mono text-[10px] text-muted-foreground">target {b.target}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
