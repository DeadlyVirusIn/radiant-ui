import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Shared collector-page hero. One gradient card, eyebrow chip, title, subtitle,
 * and slots for body content + a right-aligned visual (e.g. RingGauge / icon).
 */
export function Hero({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  subtitle,
  children,
  right,
}: {
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-5 ring-1 ring-primary/20">
      <div className={cn("grid gap-5", right && "md:grid-cols-[1fr_auto] md:items-center")}>
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {EyebrowIcon && <EyebrowIcon className="h-3 w-3" />}
            {eyebrow}
          </div>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
        {right && <div className="grid place-items-center">{right}</div>}
      </div>
    </div>
  );
}
