import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { FileSearch, AlertOctagon, ShieldAlert, UserCog, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Tabs, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AuditEventDrawer } from "@/components/admin/AuditEventDrawer";
import { OpsKpiGrid } from "@/components/admin/ops/OpsKpiGrid";
import { OpsTabStrip } from "@/components/admin/ops/OpsTabStrip";
import { OpsEmptyState } from "@/components/admin/ops/OpsEmptyState";
import { ReadOnlyBadge } from "@/components/admin/ops/ReadOnlyBadge";
import {
  AUDIT_EVENTS, EVENT_BY_ID, SEVERITY_META, STATUS_META, KIND_META,
  auditKpis, fmtRelFrom, fmtDuration, type AuditEvent,
} from "@/lib/mock-admin-audit";

type Tab = "all" | "admin" | "system" | "failed" | "high-risk";
type Search = { tab?: Tab; id?: string };

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({ meta: [{ title: "Admin · Audit log — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (s.tab as Tab) ?? undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: AuditLog,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all",       label: "All events" },
  { key: "admin",     label: "Admin actions" },
  { key: "system",    label: "System events" },
  { key: "failed",    label: "Failed" },
  { key: "high-risk", label: "High risk" },
];

function EventTable({
  events, onOpen, empty,
}: {
  events: AuditEvent[];
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (events.length === 0) {
    return <OpsEmptyState message={empty} />;
  }
  return (
    <Section padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">When</th>
              <th className="px-5 py-3">Actor</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Surface</th>
              <th className="px-5 py-3">Entity</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e) => {
              const sev = SEVERITY_META[e.severity];
              const stat = STATUS_META[e.status];
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
                  <td className="px-5 py-3 text-mono text-[11px] text-muted-foreground max-w-[220px] truncate">{e.entity}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[stat.tone])}>{stat.label}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[sev.tone])}>{sev.label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-mono text-xs">{fmtDuration(e.durationMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function AuditLog() {
  const navigate = useNavigate({ from: "/admin/audit-log" });
  const search = useSearch({ from: "/admin/audit-log" }) as Search;
  const tab: Tab = search.tab ?? "all";

  const kpis = useMemo(() => auditKpis(), []);

  const openEvent = (id: string | undefined) =>
    navigate({ search: { ...search, id } });
  const selected = search.id ? EVENT_BY_ID[search.id] ?? null : null;

  const sorted = [...AUDIT_EVENTS].sort((a, b) => b.at - a.at);
  const adminOnly  = sorted.filter((e) => e.kind === "admin");
  const systemOnly = sorted.filter((e) => e.kind === "system");
  const failed     = sorted.filter((e) => e.status === "failed" || e.status === "denied");
  const highRisk   = sorted.filter((e) => e.severity === "high" || e.severity === "critical");

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Immutable historical trail of admin and system activity. Operational preview — values shown are mock data, not wired to live audit storage."
        actions={<ReadOnlyBadge />}
      />

      {/* KPI ROW */}
      <OpsKpiGrid>
        <StatCard label="Events 24h"     value={String(kpis.events24h)}   icon={FileSearch} />
        <StatCard label="Failed actions" value={String(kpis.failed)}      icon={AlertOctagon} tone={kpis.failed > 0 ? "danger" : "default"} />
        <StatCard label="High risk"      value={String(kpis.highRisk)}    icon={ShieldAlert}  tone={kpis.highRisk > 0 ? "warning" : "default"} />
        <StatCard label="Admin actions"  value={String(kpis.adminActions)} icon={UserCog} />
        <StatCard label="Last event"     value={fmtRelFrom(kpis.lastEventAt)} icon={Clock} tone="primary" />
      </OpsKpiGrid>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { ...search, tab: v as Tab } })}
        className="mt-6 min-w-0"
      >
        <OpsTabStrip>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </OpsTabStrip>

        <TabsContent value="all">
          <EventTable events={sorted} onOpen={openEvent} empty="No audit events recorded." />
        </TabsContent>
        <TabsContent value="admin">
          <EventTable events={adminOnly} onOpen={openEvent} empty="No admin actions recorded." />
        </TabsContent>
        <TabsContent value="system">
          <EventTable events={systemOnly} onOpen={openEvent} empty="No system events recorded." />
        </TabsContent>
        <TabsContent value="failed">
          <EventTable events={failed} onOpen={openEvent} empty="No failed or denied actions in window." />
        </TabsContent>
        <TabsContent value="high-risk">
          <EventTable events={highRisk} onOpen={openEvent} empty="No high-risk events in window." />
        </TabsContent>
      </Tabs>

      <AuditEventDrawer
        event={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) openEvent(undefined); }}
      />
    </>
  );
}
