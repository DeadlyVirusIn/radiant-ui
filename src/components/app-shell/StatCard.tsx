import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const toneRing: Record<string, string> = {
    default: "ring-border",
    primary: "ring-primary/30",
    success: "ring-success/30",
    warning: "ring-warning/30",
    danger: "ring-destructive/30",
  };
  const toneIcon: Record<string, string> = {
    default: "text-muted-foreground bg-card",
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    danger: "text-destructive bg-destructive/10",
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/60 p-4 ring-1 transition-colors hover:bg-card",
        toneRing[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        {Icon ? (
          <div className={cn("grid h-7 w-7 place-items-center rounded-md", toneIcon[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
        {delta ? (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
              delta.direction === "up" && "bg-success/10 text-success",
              delta.direction === "down" && "bg-destructive/10 text-destructive",
              delta.direction === "flat" && "bg-muted text-muted-foreground",
            )}
          >
            {delta.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
            {delta.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
            {delta.value}
          </div>
        ) : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
