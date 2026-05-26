import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-width hand-off card pointing to another collector surface.
 * Used to bridge Missions → Presents, Events → Open Pack, etc.
 */
export function HandoffStrip({
  to,
  icon: Icon,
  title,
  hint,
  tone = "primary",
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  tone?: "primary" | "warning" | "success";
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-5 py-3 transition-colors hover:border-primary/50 hover:bg-card"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-md",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "warning" && "bg-warning/10 text-warning",
            tone === "success" && "bg-success/10 text-success",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
