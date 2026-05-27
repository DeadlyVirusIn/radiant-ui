import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ScrollText, AlertTriangle, AlertOctagon, Users, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ActivityEventDrawer } from "@/components/admin/ActivityEventDrawer";
import {
  ACTIVITY_EVENTS, ACTIVITY_BY_ID, LEVEL_META, KIND_META,
  activityKpis, fmtRelFrom, type ActivityEvent,
} from "@/lib/mock-admin-activity";

type Tab = "all" | "operators" | "system" | "warnings" | "errors";
type Search = { tab?: Tab; id?: string };

export const Route = createFileRoute("/admin/activity-logs")({
  head: () => ({ meta: [{ title: "Admin · Activity logs — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (s.tab as Tab) ?? undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: ActivityLogs,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all",       label: "All activity" },
  { key: "operators", label: "Operator" },
  { key: "system",    label: "System" },
  { key: "warnings",  label: "Warnings" },
  { key: "errors",    label: "Errors" },
];

function ActivityTable({
  events, onOpen, empty,
}: {
  events: ActivityEvent[];
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (events.length === 0) {
    return (
      <Section padded={false}>
        <div className="px-5 py-10 text-center text-xs text-muted-foreground">{empty}</div>
      </Section>
    );
  }
  return (
    <Section padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Actor</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Surface</th>
              <th className="px-5 py-3">Target</th>
              <th className="px-5 py-3">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e) => {
              const lvl = LEVEL_META[e.level];
              const kind = KIND_META[e.kind];
              return (
                <tr key={e.id} className="cursor-pointer hover:bg-accent/40" onClick={() => onOpen(e.id)}>
                  <td className="px-5 py-3 text-mono text-xs">
                    <div>{fmtRelFrom(e.at)}</div>
                    <div className="text-[10px] text-muted-foreground">{e.id}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-mono text-xs">{e.actor}</div>
                    <Badge variant="outline" className={cn("mt-0.5 h-4 border-transparent px-1 text-[9px]", TONE[kind.tone])}>{kind.label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-mono text-xs">{e.action}</td>
                  <td className="px-5 py-3 text-xs">{e.surface}</td>
                  <td className="px-5 py-3 text-mono text-[11px] text-muted-foreground max-w-[180px] truncate">{e.target}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[lvl.tone])}>{lvl.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ActivityLogs() {
  const navigate = useNavigate({ from: "/admin/activity-logs" });
  const search = useSearch({ from: "/admin/activity-logs" }) as Search;
  const tab: Tab = search.tab ?? "all";

  const kpis = useMemo(() => activityKpis(), []);

  const openEvent = (id: string | undefined) =>
    navigate({ search: { ...search, id } });
  const selected = search.id ? ACTIVITY_BY_ID[search.id] ?? null : null;

  const sorted = [...ACTIVITY_EVENTS].sort((a, b) => b.at - a.at);
  const ops = sorted.filter((e) => e.kind === "operator");
  const sys = sorted.filter((e) => e.kind === "system");
  const warns = sorted.filter((e) => e.level === "warn");
  const errs = sorted.filter((e) => e.level === "error");

  return (
    <div className="min-w-0">
      <PageHeader
        title="Activity logs"
        description="Operator and system actions across the workspace. Operational preview — mock data, not wired to the live activity stream."
        actions={
          <Badge variant="outline" className="h-6 border-warning/40 bg-warning/10 text-[10px] font-semibold uppercase tracking-wider text-warning">
            Mock data · read-only
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Events 24h" value={String(kpis.events24h)}  icon={ScrollText} />
        <StatCard label="Warnings"   value={String(kpis.warnings)}   icon={AlertTriangle} tone={kpis.warnings > 0 ? "warning" : "default"} />
        <StatCard label="Errors"     value={String(kpis.errors)}     icon={AlertOctagon}  tone={kpis.errors > 0 ? "danger" : "default"} />
        <StatCard label="Operators"  value={String(kpis.operators)}  icon={Users} />
        <StatCard label="Last event" value={fmtRelFrom(kpis.lastEventAt)} icon={Clock} tone="primary" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { ...search, tab: v as Tab } })}
        className="mt-6 min-w-0"
      >
        <div className="relative mb-4 -mx-4 max-w-[100vw] overflow-hidden md:-mx-6">
          <div className="overflow-x-auto px-4 pr-10 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden" />
        </div>

        <TabsContent value="all">
          <ActivityTable events={sorted} onOpen={openEvent} empty="No activity recorded." />
        </TabsContent>
        <TabsContent value="operators">
          <ActivityTable events={ops} onOpen={openEvent} empty="No operator actions in window." />
        </TabsContent>
        <TabsContent value="system">
          <ActivityTable events={sys} onOpen={openEvent} empty="No system events in window." />
        </TabsContent>
        <TabsContent value="warnings">
          <ActivityTable events={warns} onOpen={openEvent} empty="No warnings in window." />
        </TabsContent>
        <TabsContent value="errors">
          <ActivityTable events={errs} onOpen={openEvent} empty="No errors in window." />
        </TabsContent>
      </Tabs>

      <ActivityEventDrawer
        event={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) openEvent(undefined); }}
      />
    </div>
  );
}
