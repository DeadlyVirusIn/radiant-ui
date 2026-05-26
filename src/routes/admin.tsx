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
  { to: "/admin/hunt-ops", label: "Hunt ops" },
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
  return (
    <div className="-mt-4">
      <div className="sticky top-12 z-10 -mx-4 mb-5 overflow-x-auto border-b border-border bg-background/80 px-4 backdrop-blur md:-mx-6 md:px-6">
        <nav className="flex min-w-max gap-1 py-2">
          {tabs.map((t) => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
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
      </div>
      <Outlet />
    </div>
  );
}
