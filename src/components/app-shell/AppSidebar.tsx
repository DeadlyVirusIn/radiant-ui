import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Crosshair,
  Sparkles,
  Gift,
  ArrowLeftRight,
  Boxes,
  Bot,
  BarChart3,
  ScrollText,
  Settings,
  ShieldCheck,
  Search,
  Command,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = { title: string; to: string; icon: React.ComponentType<{ className?: string }> };

const overview: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Analytics", to: "/analytics", icon: BarChart3 },
];

const operations: NavItem[] = [
  { title: "Hunts", to: "/hunts", icon: Crosshair },
  { title: "Gold Flair", to: "/gold-flair", icon: Sparkles },
  { title: "Gifts", to: "/gifts", icon: Gift },
  { title: "Trades", to: "/trades", icon: ArrowLeftRight },
];

const fleet: NavItem[] = [
  { title: "Inventory", to: "/inventory", icon: Boxes },
  { title: "Accounts", to: "/accounts", icon: Bot },
  { title: "Events", to: "/events", icon: ScrollText },
];

const system: NavItem[] = [
  { title: "Settings", to: "/settings", icon: Settings },
  { title: "Admin", to: "/admin", icon: ShieldCheck },
];

function NavGroup({ label, items, currentPath }: { label: string; items: NavItem[]; currentPath: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to);
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="h-9 rounded-md text-[13px] font-medium data-[active=true]:bg-primary/15 data-[active=true]:text-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--primary)]"
                >
                  <Link to={item.to} className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_24px_-4px_var(--primary)]">
            <span className="font-display text-sm font-bold text-primary-foreground">R</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-sm font-bold tracking-tight">Radiant</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Ops Console
            </span>
          </div>
        </Link>

        <button
          type="button"
          className="mt-3 flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/40 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search or jump to…</span>
          <kbd className="flex items-center gap-0.5 rounded border border-sidebar-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-1.5">
        <NavGroup label="Overview" items={overview} currentPath={currentPath} />
        <NavGroup label="Operations" items={operations} currentPath={currentPath} />
        <NavGroup label="Fleet" items={fleet} currentPath={currentPath} />
        <NavGroup label="System" items={system} currentPath={currentPath} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-card text-xs font-semibold ring-1 ring-border">
            DV
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-semibold">DeadlyVirus</div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online · Operator
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
