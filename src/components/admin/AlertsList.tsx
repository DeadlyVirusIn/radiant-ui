import { Link } from "@tanstack/react-router";
import { AlertTriangle, Info, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVE_ALERTS, fmtRel, type Alert } from "@/lib/mock-admin-health";

const ICON = { info: Info, warn: AlertTriangle, critical: Siren } as const;
const TONE: Record<Alert["severity"], string> = {
  info: "text-muted-foreground",
  warn: "text-warning",
  critical: "text-destructive",
};
const BORDER: Record<Alert["severity"], string> = {
  info: "border-l-border",
  warn: "border-l-warning",
  critical: "border-l-destructive",
};

/**
 * Active alerts feed. Each row deep-links to the relevant entity drawer via
 * the destination page's ?id= search param.
 */
export function AlertsList() {
  return (
    <section className="rounded-xl border border-border bg-card/40">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Active alerts</h2>
        <span className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {ACTIVE_ALERTS.length}
        </span>
      </header>
      <ul className="divide-y divide-border">
        {ACTIVE_ALERTS.map((a) => {
          const Icon = ICON[a.severity];
          return (
            <li key={a.id} className={cn("border-l-2", BORDER[a.severity])}>
              <Link
                to={a.href}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-card/60"
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE[a.severity])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{a.message}</p>
                  <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {a.domain} · {fmtRel(a.since)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
