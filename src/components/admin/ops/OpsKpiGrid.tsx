import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Canonical operational KPI grid wrapper.
 * Default: 2 → sm:3 → xl:5 columns (matches frozen 5-card surfaces).
 * cols="4" variant matches mission-debug.
 */
export function OpsKpiGrid({
  children,
  cols = 5,
  className,
}: {
  children: ReactNode;
  cols?: 4 | 5;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3",
        cols === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
