import { cn } from "@/lib/utils";

export function ProgressBar({
  done,
  total,
  tone = "primary",
}: {
  done: number;
  total: number;
  tone?: "primary" | "warn" | "muted" | "success";
}) {
  const pct = total === 0 ? 0 : Math.min(100, (done / total) * 100);
  return (
    <div className="mt-1.5 h-1 rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          tone === "primary" && "bg-primary",
          tone === "warn" && "bg-warning",
          tone === "muted" && "bg-muted-foreground/40",
          tone === "success" && "bg-success",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
