import { useEffect, useRef } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Radiant" }] }),
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/fleet", label: "Fleet health" },
  { to: "/admin/trust", label: "Trust" },
  { to: "/admin/scheduler", label: "Scheduler" },
  { to: "/admin/activity-logs", label: "Activity" },
  { to: "/admin/hunt-config", label: "Hunt config" },
  { to: "/admin/hunt-bots", label: "Hunt bots" },
  { to: "/admin/queues", label: "Queues" },
  { to: "/admin/trades", label: "Trades" },
  { to: "/admin/gifts", label: "Gifts" },
  { to: "/admin/hybrid-control", label: "Hybrid control" },
  { to: "/admin/observability", label: "Observability" },
  { to: "/admin/audit-log", label: "Audit log" },
  { to: "/admin/system-health", label: "System" },
  { to: "/admin/integrity", label: "Integrity" },
  { to: "/admin/capacity", label: "Capacity" },
  { to: "/admin/mission-debug", label: "Mission debug" },
];

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navRef = useRef<HTMLElement | null>(null);

  // Scroll the active tab into view on route change so the current page
  // is always discoverable on narrow viewports.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLAnchorElement>("[data-active='true']");
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [path]);

  return (
    <div className="-mt-4">
      <div className="sticky top-12 z-10 -mx-4 mb-5 border-b border-border bg-background/80 backdrop-blur md:-mx-6">
        <div className="relative">
          <nav
            ref={navRef}
            className="flex min-w-max gap-1 overflow-x-auto px-4 py-2 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((t) => {
              const active = t.exact ? path === t.to : path.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  data-active={active}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-primary/15 text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          {/* Right-edge fade — affordance signalling more tabs off-screen on mobile */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/90 to-transparent md:hidden" />
        </div>
      </div>
      <Outlet />
    </div>
  );
}
