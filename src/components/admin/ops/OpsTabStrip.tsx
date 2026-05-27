import { type ReactNode } from "react";
import { TabsList } from "@/components/ui/tabs";

/**
 * Mobile-safe tab strip wrapper. Provides:
 *  - negative side margins to flush against the page gutter
 *  - internal horizontal scroll only (never bleeds to body)
 *  - right-edge fade gradient on mobile
 * Children are <TabsTrigger /> elements; this component renders the <TabsList />.
 */
export function OpsTabStrip({ children }: { children: ReactNode }) {
  return (
    <div className="relative mb-4 -mx-4 max-w-[100vw] overflow-hidden md:-mx-6">
      <div className="overflow-x-auto px-4 pr-10 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="w-max">{children}</TabsList>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden" />
    </div>
  );
}
