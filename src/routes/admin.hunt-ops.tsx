import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy compatibility: /admin/hunt-ops was renamed to /admin/queues.
// Preserve old bookmarks/tabs by redirecting at the route level.
export const Route = createFileRoute("/admin/hunt-ops")({
  loader: () => {
    throw redirect({ to: "/admin/queues", replace: true });
  },
});
