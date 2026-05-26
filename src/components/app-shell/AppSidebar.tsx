import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Gauge, Sparkle, Bot, Users, Wand2, Repeat2,
  CreditCard, Target, Heart, ArrowLeftRight, Gift, Gem,
  Swords, ListChecks, PackageOpen, Wallet, Battery, Store, Trophy, Coins,
  HeartPulse, ShieldCheck, BarChart3, Database, Activity, ScrollText, FileSearch,
  Settings as SettingsIcon, Calendar, RotateCcw, GitBranch, FlaskConical, LayoutDashboard,
  Search, Command, ChevronDown, ChevronRight, UserCog, Shield,
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
type IconC = React.ComponentType<{ className?: string }>;
type Leaf = { title: string; to: string; icon: IconC };
type SubBranch = { title: string; icon: IconC; items: Leaf[] };
type TopBranch = { title: string; icon: IconC; items: (Leaf | SubBranch)[] };
type Entry =
  | ({ kind: "link" } & Leaf)
  | ({ kind: "tree" } & TopBranch);
type Group = { id: string; label: string; entries: Entry[] };

// ─────────────────────────────────────────────────────────────────────────
// USER FLOW
//
// Every entry below maps to a real route file in src/routes/ AND has a
// counterpart page in reference/packhunter-current/src/pages/. Labels are
// taken from the reference component so the sidebar reflects what the page
// actually does instead of inventing product surface.
//
//  label              | route                          | reference page
//  -------------------|--------------------------------|------------------------
//  Home               | /                              | Dashboard.jsx
//  Missions           | /missions                      | Missions.jsx
//  Open Pack          | /open-pack                     | OpenPack.jsx
//  Wonder Pick        | /wonder-pick                   | WonderPick.jsx
//  Cards              | /cards                         | Cards.jsx
//  Tracker            | /tracker                       | Tracker.jsx
//  Wishlist           | /wishlist                      | Wishlist.jsx
//  God Pack Gallery   | /godpacks                      | GodPackGallery.jsx
//  Collection Goals   | /collection-missions           | CollectionMissions.jsx
//  Hunt Monitor       | /hunt                          | HuntMonitor.jsx
//  Bot Hub            | /bot-hub                       | BotHub.jsx
//  Trades             | /trades                        | (custom route, real file)
//  Trade Analytics    | /trade-analytics               | TradeAnalytics.jsx
//  Card Requests      | /card-request                  | CardRequest.jsx
//  Sharing Cards      | /sharing-cards                 | SharingCards.jsx
//  Present Box        | /presents                      | PresentBox.jsx
//  Gold Flair         | /gold-flair                    | (custom route, real file)
//  Gold Flair Trade   | /collection/gold-flair-trade   | (custom route, real file)
//  Friends            | /friends                       | Friends.jsx
//  Battles            | /battles                       | Battles.jsx
//  PvP Rankings       | /pvp                           | PvpRankings.jsx
//  Battle History     | /battle-history                | BattleHistory.jsx
//  Battle Stats       | /battle-stats                  | BattleStats.jsx
//  Events             | /events                        | Events.jsx
//  Achievements       | /achievements                  | Achievements.jsx
//  Item Shop          | /shop                          | ItemShop.jsx
//  Stamina            | /stamina                       | StaminaDashboard.jsx
//  Resources          | /resources                     | ResourceDashboard.jsx
//
// ─────────────────────────────────────────────────────────────────────────
// FUTURE IDEAS — NOT IN NAVIGATION
// The following concepts came up during design but have no backing route or
// reference component. Do not add to the sidebar until a real page exists:
//   - "Latest Pulls" landing (distinct from God Pack Gallery)
//   - "Community Hunts" hub (distinct from Bot Hub)
//   - "Trade Matches" matchmaker (distinct from Trades list)
//   - "Send a Card" quick action (covered by Card Requests today)
//   - "Inbox" unified notifications (Present Box only covers gifts)
//   - "Trending" / "Discover" feed
//   - "My Hunts" personal hunts view (only /hunts exists as a generic file)
// ─────────────────────────────────────────────────────────────────────────

const USER_GROUPS: Group[] = [
  {
    id: "play",
    label: "Play",
    entries: [
      { kind: "link", title: "Home",         to: "/",            icon: Home },
      { kind: "link", title: "Missions",     to: "/missions",    icon: ListChecks },
      { kind: "link", title: "Open Pack",    to: "/open-pack",   icon: PackageOpen },
      { kind: "link", title: "Wonder Pick",  to: "/wonder-pick", icon: Wand2 },
    ],
  },
  {
    id: "collect",
    label: "Collection",
    entries: [
      { kind: "link", title: "Cards",            to: "/cards",                icon: CreditCard },
      { kind: "link", title: "Tracker",          to: "/tracker",              icon: Target },
      { kind: "link", title: "Wishlist",         to: "/wishlist",             icon: Heart },
      { kind: "link", title: "Collection Goals", to: "/collection-missions",  icon: Trophy },
      { kind: "link", title: "God Pack Gallery", to: "/godpacks",             icon: Sparkle },
    ],
  },
  {
    id: "hunts",
    label: "Hunts",
    entries: [
      { kind: "link", title: "Hunt Monitor", to: "/hunt",    icon: Activity },
      { kind: "link", title: "Bot Hub",      to: "/bot-hub", icon: Bot },
    ],
  },
  {
    id: "trade",
    label: "Trades",
    entries: [
      { kind: "link", title: "Trades",          to: "/trades",          icon: Repeat2 },
      { kind: "link", title: "Trade Analytics", to: "/trade-analytics", icon: BarChart3 },
      { kind: "link", title: "Card Requests",   to: "/card-request",    icon: ArrowLeftRight },
    ],
  },
  {
    id: "gift",
    label: "Gifts",
    entries: [
      { kind: "link", title: "Sharing Cards", to: "/sharing-cards", icon: Gift },
      { kind: "link", title: "Present Box",   to: "/presents",      icon: PackageOpen },
    ],
  },
  {
    id: "flair",
    label: "Gold Flair",
    entries: [
      { kind: "link", title: "Gold Flair",       to: "/gold-flair",                  icon: Gem },
      { kind: "link", title: "Gold Flair Trade", to: "/collection/gold-flair-trade", icon: ArrowLeftRight },
    ],
  },
  {
    id: "social",
    label: "Social",
    entries: [
      { kind: "link", title: "Friends",        to: "/friends",        icon: Users },
      { kind: "link", title: "Battles",        to: "/battles",        icon: Swords },
      { kind: "link", title: "PvP Rankings",   to: "/pvp",            icon: Trophy },
      { kind: "link", title: "Battle History", to: "/battle-history", icon: ScrollText },
      { kind: "link", title: "Battle Stats",   to: "/battle-stats",   icon: BarChart3 },
    ],
  },
  {
    id: "more",
    label: "More",
    entries: [
      { kind: "link", title: "Events",       to: "/events",       icon: Calendar },
      { kind: "link", title: "Achievements", to: "/achievements", icon: Trophy },
      { kind: "link", title: "Item Shop",    to: "/shop",         icon: Store },
      { kind: "link", title: "Stamina",      to: "/stamina",      icon: Battery },
      { kind: "link", title: "Resources",    to: "/resources",    icon: Coins },
    ],
  },
];

// ADMIN FLOW (replaces user flow when role=admin) — covers every /admin/* route
const ADMIN_GROUPS: Group[] = [
  {
    id: "admin-overview",
    label: "Overview",
    entries: [
      { kind: "link", title: "Admin Home",     to: "/admin",          icon: LayoutDashboard },
      { kind: "link", title: "Observability",  to: "/admin/observability", icon: Activity },
      { kind: "link", title: "System Health",  to: "/admin/system-health", icon: HeartPulse },
      { kind: "link", title: "Capacity",       to: "/admin/capacity",      icon: Gauge },
    ],
  },
  {
    id: "admin-ops",
    label: "Operations",
    entries: [
      { kind: "link", title: "Fleet Health",   to: "/admin/fleet",         icon: HeartPulse },
      {
        kind: "tree",
        title: "Hunts",
        icon: Gauge,
        items: [
          { title: "Hunt Config",    to: "/admin/hunt-config",    icon: SettingsIcon },
          { title: "Hunt Bots",      to: "/admin/hunt-bots",      icon: Bot },
          { title: "Hunt Ops",       to: "/admin/hunt-ops",       icon: RotateCcw },
          { title: "Hybrid Control", to: "/admin/hybrid-control", icon: GitBranch },
          { title: "Scheduler",      to: "/admin/scheduler",      icon: Calendar },
        ],
      },
      { kind: "link", title: "Mission Debug",  to: "/admin/mission-debug", icon: FlaskConical },
    ],
  },
  {
    id: "admin-integrity",
    label: "Integrity",
    entries: [
      { kind: "link", title: "Integrity",  to: "/admin/integrity", icon: ShieldCheck },
      { kind: "link", title: "Trust",      to: "/admin/trust",     icon: Shield },
      { kind: "link", title: "Drift",      to: "/admin/system-health", icon: BarChart3 },
    ],
  },
  {
    id: "admin-platform",
    label: "Platform",
    entries: [
      { kind: "link", title: "Users",         to: "/admin/users",         icon: Users },
      { kind: "link", title: "Activity Logs", to: "/admin/activity-logs", icon: ScrollText },
      { kind: "link", title: "Audit Log",     to: "/admin/audit-log",     icon: FileSearch },
      { kind: "link", title: "Data Stores",   to: "/admin/system-health", icon: Database },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
const isActivePath = (current: string, to: string) =>
  to === "/" ? current === "/" : current === to || current.startsWith(to + "/");

function pathInTree(current: string, items: (Leaf | SubBranch)[]): boolean {
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
}: { branch: TopBranch; currentPath: string; depth: number }) {
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
          {branch.items.map((child: Leaf | SubBranch) => (
            <SidebarMenuSubItem key={"to" in child ? child.to : child.title}>
              {"to" in child
                ? <LeafRow leaf={child} currentPath={currentPath} depth={depth + 1} />
                : <BranchRow branch={child} currentPath={currentPath} depth={depth + 1} />}
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
    () => (role === "admin" ? ADMIN_GROUPS : USER_GROUPS),
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

      <SidebarContent className="overflow-y-auto px-1.5">
        {groups.map((group, idx) => {
          const groupActive = group.entries.some((e) =>
            e.kind === "link"
              ? isActivePath(currentPath, e.to)
              : pathInTree(currentPath, e.items),
          );
          const open = groupActive || !collapsedGroups[group.id];
          return (
            <SidebarGroup key={group.id} className={cn(idx > 0 && "mt-1 border-t border-sidebar-border/60 pt-2")}>
              <Collapsible
                open={open}
                onOpenChange={(next) => toggleGroup(group.id, next, groupActive)}
                className="group/group"
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel
                    asChild
                    className="group/label flex h-7 w-full cursor-pointer items-center justify-between gap-1 rounded px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 transition-colors hover:bg-accent/40 hover:text-foreground group-data-[collapsible=icon]:hidden"
                  >
                    <button type="button" aria-expanded={open}>
                      <span className="truncate">{group.label}</span>
                      <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-data-[state=open]/group:rotate-90" />
                    </button>
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
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
