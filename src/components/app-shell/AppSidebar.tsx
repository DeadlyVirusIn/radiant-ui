import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Gauge, Sparkle, Bot, Users, Wand2,
  CreditCard, Target, Heart, ArrowLeftRight, Gift, Gem,
  Swords, ListChecks, PackageOpen, Wallet, Battery, Store, Trophy, Coins,
  HeartPulse, ShieldCheck, BarChart3, Database, Activity, ScrollText, FileSearch,
  Settings as SettingsIcon, Calendar, RotateCcw, GitBranch,
  Search, Command, ChevronDown, UserCog, Shield,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Types
type Leaf = { title: string; to: string; icon: React.ComponentType<{ className?: string }> };
type Branch = { title: string; icon: React.ComponentType<{ className?: string }>; items: Leaf[] };
type Node = Leaf | (Branch & { items: (Leaf | Branch)[] });
type Group = { id: string; label: string; entries: ({ kind: "link" } & Leaf | { kind: "tree" } & Branch & { items: (Leaf | (Branch & { items: Leaf[] }))[] })[] };

// ─────────────────────────────────────────────────────────────────────────
// USER FLOW  (mirrors reference/packhunter-current App.jsx allNavGroups)
const USER_GROUPS: Group[] = [
  {
    id: "main",
    label: "Workspace",
    entries: [
      { kind: "link", title: "Home", to: "/", icon: Home },
      {
        kind: "tree",
        title: "Hunt",
        icon: Gauge,
        items: [
          { title: "Hunt Monitor", to: "/hunt",        icon: Activity },
          { title: "God Packs",    to: "/godpacks",    icon: Sparkle },
          { title: "Bot Hub",      to: "/bot-hub",     icon: Bot },
          { title: "Friends",      to: "/friends",     icon: Users },
          { title: "Wonder Pick",  to: "/wonder-pick", icon: Wand2 },
        ],
      },
      {
        kind: "tree",
        title: "Collection",
        icon: CreditCard,
        items: [
          { title: "My Cards",         to: "/cards",                       icon: CreditCard },
          { title: "Tracker",          to: "/tracker",                     icon: Target },
          { title: "Wishlist",         to: "/wishlist",                    icon: Heart },
          { title: "Trade",            to: "/card-request",                icon: ArrowLeftRight },
          { title: "Gift",             to: "/sharing-cards",               icon: Gift },
          { title: "Gold Flair Trade", to: "/collection/gold-flair-trade", icon: Gem },
        ],
      },
      { kind: "link", title: "Battle", to: "/battles", icon: Swords },
      {
        kind: "tree",
        title: "Play",
        icon: ListChecks,
        items: [
          { title: "Daily Missions", to: "/missions",  icon: ListChecks },
          { title: "Presents",       to: "/presents",  icon: Gift },
          { title: "Open Pack",      to: "/open-pack", icon: PackageOpen },
          {
            title: "Wallet",
            icon: Wallet,
            items: [
              { title: "Stamina",      to: "/stamina",      icon: Battery },
              { title: "Item Shop",    to: "/shop",         icon: Store },
              { title: "Achievements", to: "/achievements", icon: Trophy },
              { title: "Resources",    to: "/resources",    icon: Coins },
            ],
          },
        ],
      },
    ],
  },
];

// ADMIN ADDITIONAL  (System section)
const ADMIN_GROUPS: Group[] = [
  {
    id: "system",
    label: "System",
    entries: [
      {
        kind: "tree",
        title: "Operations",
        icon: HeartPulse,
        items: [
          { title: "Fleet Status", to: "/admin/fleet", icon: HeartPulse },
          {
            title: "Hunts",
            icon: Gauge,
            items: [
              { title: "Hunters",        to: "/admin/users",         icon: Users },
              { title: "Hunt Config",    to: "/admin/hunt-config",   icon: SettingsIcon },
              { title: "Scheduler",      to: "/admin/scheduler",     icon: Calendar },
              { title: "Hunt Bots",      to: "/admin/hunt-bots",     icon: Bot },
              { title: "Hybrid Control", to: "/admin/hybrid-control",icon: GitBranch },
            ],
          },
          { title: "Operations Recovery", to: "/admin/hunt-ops", icon: RotateCcw },
          { title: "Capacity Verdict",    to: "/admin/capacity", icon: Gauge },
        ],
      },
      {
        kind: "tree",
        title: "Integrity",
        icon: ShieldCheck,
        items: [
          { title: "Integrity Dashboard", to: "/admin/integrity",     icon: ShieldCheck },
          { title: "Data Health",         to: "/admin/system-health", icon: Database },
          { title: "Drift Detection",     to: "/admin/trust",         icon: BarChart3 },
          { title: "Account Health",      to: "/admin/audit-log",     icon: HeartPulse },
        ],
      },
      {
        kind: "tree",
        title: "Platform",
        icon: Users,
        items: [
          { title: "Users",         to: "/admin/users",         icon: Users },
          { title: "Observability", to: "/admin/observability", icon: Activity },
          { title: "Audit Log",     to: "/admin/audit-log",     icon: FileSearch },
          { title: "Activity Logs", to: "/admin/activity-logs", icon: ScrollText },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
const isActivePath = (current: string, to: string) =>
  to === "/" ? current === "/" : current === to || current.startsWith(to + "/");

function pathInTree(current: string, items: (Leaf | Branch)[]): boolean {
  return items.some((n) =>
    "to" in n ? isActivePath(current, n.to) : pathInTree(current, n.items)
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Leaf renderer (depth-aware)
function LeafRow({ leaf, currentPath, depth }: { leaf: Leaf; currentPath: string; depth: number }) {
  const active = isActivePath(currentPath, leaf.to);
  const Btn = depth === 0 ? SidebarMenuButton : SidebarMenuSubButton;
  return (
    <Btn
      asChild
      isActive={active}
      className={cn(
        "rounded-md text-[13px] font-medium",
        depth === 0 && "h-8",
        "data-[active=true]:bg-primary/15 data-[active=true]:text-foreground",
        "data-[active=true]:shadow-[inset_2px_0_0_var(--primary)]",
      )}
    >
      <Link to={leaf.to} className="flex items-center gap-2.5">
        <leaf.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{leaf.title}</span>
      </Link>
    </Btn>
  );
}

// Branch renderer (collapsible). Supports one nested branch level (Wallet, Hunts).
function BranchRow({
  branch, currentPath, depth,
}: { branch: Branch & { items: (Leaf | Branch & { items: Leaf[] })[] }; currentPath: string; depth: number }) {
  const branchActive = pathInTree(currentPath, branch.items);
  const [open, setOpen] = useState(branchActive);
  useEffect(() => { if (branchActive) setOpen(true); }, [branchActive]);

  const Trigger = depth === 0 ? SidebarMenuButton : SidebarMenuSubButton;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <CollapsibleTrigger asChild>
        <Trigger
          className={cn(
            "w-full rounded-md text-[13px] font-medium",
            depth === 0 && "h-8",
            branchActive && "text-foreground",
          )}
        >
          <branch.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{branch.title}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-180" />
        </Trigger>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mr-0 pr-0">
          {branch.items.map((child) => (
            <SidebarMenuSubItem key={"to" in child ? child.to : child.title}>
              {"to" in child
                ? <LeafRow leaf={child} currentPath={currentPath} depth={depth + 1} />
                : <BranchRow branch={child as any} currentPath={currentPath} depth={depth + 1} />}
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────────────────────────────────────────────────────
type Role = "user" | "admin";

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const [role, setRole] = useState<Role>("user");

  // Persist role choice (UI-only — no auth/backend changes)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("radiant.viewAs") as Role | null;
      if (saved === "user" || saved === "admin") setRole(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("radiant.viewAs", role); } catch {}
  }, [role]);

  // Auto-switch to admin when on /admin/* so the admin tree is visible
  useEffect(() => {
    if (currentPath.startsWith("/admin")) setRole("admin");
  }, [currentPath]);

  const groups = useMemo(
    () => (role === "admin" ? [...USER_GROUPS, ...ADMIN_GROUPS] : USER_GROUPS),
    [role],
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary via-primary/70 to-primary/40 shadow-[0_0_28px_-6px_var(--primary)] ring-1 ring-primary/30">
            <span className="font-display text-sm font-extrabold text-primary-foreground">R</span>
            <span className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-[15px] font-bold tracking-tight">Radiant</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Ops Console
            </span>
          </div>
        </Link>

        <button
          type="button"
          className="mt-3 flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/30 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-background/60 hover:text-foreground group-data-[collapsible=icon]:hidden"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search or jump to…</span>
          <kbd className="flex items-center gap-0.5 rounded border border-sidebar-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>

        {/* Role switcher — purely UI; no auth changes */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-sidebar-border bg-background/30 p-1 group-data-[collapsible=icon]:hidden">
          {(["user", "admin"] as Role[]).map((r) => {
            const Icon = r === "user" ? UserCog : Shield;
            const active = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all",
                  active
                    ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={active}
              >
                <Icon className="h-3 w-3" /> {r}
              </button>
            );
          })}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5">
        {groups.map((group, idx) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70",
                idx > 0 && "mt-1 border-t border-sidebar-border/60 pt-3",
              )}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.entries.map((entry, i) => (
                  <SidebarMenuItem key={i}>
                    {entry.kind === "link"
                      ? <LeafRow leaf={entry} currentPath={currentPath} depth={0} />
                      : <BranchRow branch={entry as any} currentPath={currentPath} depth={0} />}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary/60 to-primary/20 text-[11px] font-bold ring-1 ring-primary/30">
            DV
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar" />
          </div>
          <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs font-semibold">DeadlyVirus</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {role === "admin" ? "Admin · all surfaces" : "Operator · user surfaces"}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
