import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Crosshair, Sparkles, Gift, ArrowLeftRight, Boxes, Bot,
  BarChart3, ScrollText, Settings, ShieldCheck, Search, Command,
  CreditCard, Trophy, Target, Heart, Share2, Package, PackageOpen, Wand2,
  Users, Swords, History, Coins, Medal, Calendar, Battery, Store, ListChecks,
  LifeBuoy, User, Sparkle, Gem, BookOpen, Activity, FileSearch, HeartPulse,
  Cog, GitBranch, Database, FlaskConical,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = { title: string; to: string; icon: React.ComponentType<{ className?: string }> };

const overview: NavItem[] = [
  { title: "Dashboard",     to: "/",          icon: LayoutDashboard },
  { title: "Resources",     to: "/resources", icon: Coins },
  { title: "Analytics",     to: "/analytics", icon: BarChart3 },
  { title: "Profile",       to: "/profile",   icon: User },
];

const collection: NavItem[] = [
  { title: "Cards",              to: "/cards",               icon: CreditCard },
  { title: "Tracker",            to: "/tracker",             icon: Target },
  { title: "Wishlist",           to: "/wishlist",            icon: Heart },
  { title: "Collection missions",to: "/collection-missions", icon: ListChecks },
  { title: "Card request",       to: "/card-request",        icon: BookOpen },
  { title: "Sharing cards",      to: "/sharing-cards",       icon: Share2 },
  { title: "Gold Flair trade",   to: "/collection/gold-flair-trade", icon: Gem },
];

const operations: NavItem[] = [
  { title: "Hunts",         to: "/hunts",      icon: Crosshair },
  { title: "Hunt monitor",  to: "/hunt",       icon: Activity },
  { title: "God Packs",     to: "/godpacks",   icon: Sparkle },
  { title: "Gold Flair",    to: "/gold-flair", icon: Sparkles },
  { title: "Gifts",         to: "/gifts",      icon: Gift },
  { title: "Presents",      to: "/presents",   icon: Package },
  { title: "Trades",        to: "/trades",     icon: ArrowLeftRight },
  { title: "Trade analytics", to: "/trade-analytics", icon: BarChart3 },
];

const gameplay: NavItem[] = [
  { title: "Battles",       to: "/battles",        icon: Swords },
  { title: "Battle history",to: "/battle-history", icon: History },
  { title: "Battle stats",  to: "/battle-stats",   icon: Trophy },
  { title: "PvP rankings",  to: "/pvp",            icon: Medal },
  { title: "Missions",      to: "/missions",       icon: ListChecks },
  { title: "Achievements",  to: "/achievements",   icon: Trophy },
  { title: "Events",        to: "/events",         icon: Calendar },
  { title: "Open pack",     to: "/open-pack",      icon: PackageOpen },
  { title: "Wonder pick",   to: "/wonder-pick",    icon: Wand2 },
  { title: "Item shop",     to: "/shop",           icon: Store },
  { title: "Stamina",       to: "/stamina",        icon: Battery },
  { title: "Friends",       to: "/friends",        icon: Users },
];

const fleet: NavItem[] = [
  { title: "Inventory", to: "/inventory", icon: Boxes },
  { title: "Accounts",  to: "/accounts",  icon: Bot },
  { title: "Bot hub",   to: "/bot-hub",   icon: Bot },
  { title: "Event log", to: "/events",    icon: ScrollText },
];

const system: NavItem[] = [
  { title: "Settings", to: "/settings", icon: Settings },
  { title: "Help",     to: "/help",     icon: LifeBuoy },
  { title: "Admin",    to: "/admin",    icon: ShieldCheck },
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
            const active = item.to === "/" ? currentPath === "/" : currentPath === item.to || currentPath.startsWith(item.to + "/");
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className="h-8 rounded-md text-[13px] font-medium data-[active=true]:bg-primary/15 data-[active=true]:text-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--primary)]"
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
        <NavGroup label="Overview"   items={overview}   currentPath={currentPath} />
        <NavGroup label="Collection" items={collection} currentPath={currentPath} />
        <NavGroup label="Operations" items={operations} currentPath={currentPath} />
        <NavGroup label="Gameplay"   items={gameplay}   currentPath={currentPath} />
        <NavGroup label="Fleet"      items={fleet}      currentPath={currentPath} />
        <NavGroup label="System"     items={system}     currentPath={currentPath} />
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
