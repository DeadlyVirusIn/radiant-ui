import { Badge } from "@/components/ui/badge";

/**
 * Frozen mock/read-only chip used across operational admin surfaces.
 * Mechanically extracted — markup matches the inline copy verbatim.
 */
export function ReadOnlyBadge({ label = "Mock data · read-only" }: { label?: string }) {
  return (
    <Badge
      variant="outline"
      className="h-6 border-warning/40 bg-warning/10 text-[10px] font-semibold uppercase tracking-wider text-warning"
    >
      {label}
    </Badge>
  );
}
