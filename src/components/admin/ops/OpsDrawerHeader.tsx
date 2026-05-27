import { type ReactNode } from "react";
import { SheetHeader } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Standard read-only drawer header used across admin ops surfaces.
 *
 * Layout invariant (matches the inline copies verbatim):
 *   <SheetHeader className="border-b border-border p-5">
 *     <div className="flex {items-*} justify-between gap-3">
 *       <div className="min-w-0"> {title slot} </div>
 *       {badges slot}
 *     </div>
 *   </SheetHeader>
 *
 * Caller controls:
 *  - title font (mono id vs display action) — pass JSX in `children`
 *  - subtitle styling — pass JSX in `children`
 *  - badge size / tone — pass pre-rendered <Badge /> in `badges`
 *
 * Props:
 *  - align    "center" (id-headed drawers) | "start" (action-headed drawers)
 *  - stacked  when true, badges are stacked vertically (flex-col items-end gap-1)
 */
export function OpsDrawerHeader({
  children,
  badges,
  align = "center",
  stacked = false,
}: {
  children: ReactNode;
  badges?: ReactNode;
  align?: "center" | "start";
  stacked?: boolean;
}) {
  return (
    <SheetHeader className="border-b border-border p-5">
      <div
        className={cn(
          "flex justify-between gap-3",
          align === "center" ? "items-center" : "items-start",
        )}
      >
        <div className="min-w-0">{children}</div>
        {badges ? (
          stacked ? (
            <div className="flex shrink-0 flex-col items-end gap-1">{badges}</div>
          ) : (
            <div className="shrink-0">{badges}</div>
          )
        ) : null}
      </div>
    </SheetHeader>
  );
}
