import { Link } from "@tanstack/react-router";
import { ChevronRight, Crosshair, Gift, Repeat2, Target, Inbox } from "lucide-react";
import type { WaitingItem, WaitingKind } from "@/lib/mock-home";

const kindMeta: Record<WaitingKind, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  gift:       { icon: Gift,      cls: "text-success bg-success/10 border-success/20" },
  trade:      { icon: Repeat2,   cls: "text-primary bg-primary/10 border-primary/20" },
  hunt_ready: { icon: Crosshair, cls: "text-warning bg-warning/10 border-warning/20" },
  mission:    { icon: Target,    cls: "text-primary bg-primary/10 border-primary/20" },
};

const urgencyMeta: Record<0 | 1 | 2, { label: string; cls: string }> = {
  2: { label: "Ready",           cls: "bg-success/15 text-success border-success/30" },
  1: { label: "Action required", cls: "bg-warning/15 text-warning border-warning/30" },
  0: { label: "In progress",     cls: "bg-primary/15 text-primary border-primary/30" },
};

export function WaitingForYou({ items }: { items: WaitingItem[] }) {
  // Ready (2) → Action required (1) → In progress (0). Stable within group.
  const sorted = [...items].sort((a, b) => b.urgency - a.urgency);
  const actionable = sorted.filter((i) => i.urgency >= 1).length;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">Waiting for you</h3>
            <p className="text-xs text-muted-foreground">Gifts, trades, hunts, and daily missions in one place</p>
          </div>
        </div>
        <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
          {actionable} actionable
        </span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {sorted.map((item) => {
          const meta = kindMeta[item.kind];
          const u = urgencyMeta[item.urgency];
          const Icon = meta.icon;
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/30 hover:bg-card/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${meta.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${u.cls}`}>
                        {u.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-80 group-hover:opacity-100">
                  {item.cta} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
