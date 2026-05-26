import { useRouterState } from "@tanstack/react-router";
import { Bell, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/app-shell/ThemeToggle";

const labels: Record<string, string> = {
  "": "Dashboard",
  cards: "My Collection",
  hunts: "Hunts",
  tracker: "Set Progress",
  "gold-flair": "Gold Flair",
  gifts: "Gifts",
  trades: "Trades",
  wishlist: "Wishlist",
  inventory: "Inventory",
  accounts: "Accounts",
  analytics: "Analytics",
  events: "Events",
  settings: "Settings",
  admin: "Admin",
};

export function AppHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const segments = path.split("/").filter(Boolean);
  const crumbs = segments.length ? segments : [""];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md md:px-6">
      <SidebarTrigger className="h-8 w-8" />

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Radiant
        </span>
        {crumbs.map((seg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className={i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
              {labels[seg] ?? seg}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          <span>All systems nominal</span>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
