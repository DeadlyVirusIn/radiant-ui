import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { ShieldCheck, AlertTriangle, AlertOctagon, Clock, Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IntegrityIssueDrawer } from "@/components/admin/IntegrityIssueDrawer";
import {
  INTEGRITY_ISSUES, ISSUE_BY_ID, SEVERITY_META, STATUS_META, CATEGORY_META,
  integrityKpis, fmtRelFrom, type IntegrityIssue,
} from "@/lib/mock-admin-integrity";

type Tab = "overview" | "drift" | "stale" | "failed" | "blockers";
type Search = { tab?: Tab; id?: string };

export const Route = createFileRoute("/admin/integrity")({
  head: () => ({ meta: [{ title: "Admin · Integrity — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (s.tab as Tab) ?? undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: Integrity,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "drift",    label: "Drift" },
  { key: "stale",    label: "Stale data" },
  { key: "failed",   label: "Failed checks" },
  { key: "blockers", label: "Blockers" },
];

function IssueTable({
  issues, onOpen, empty,
}: {
  issues: IntegrityIssue[];
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (issues.length === 0) {
    return (
      <Section padded={false}>
        <div className="px-5 py-10 text-center text-xs text-muted-foreground">{empty}</div>
      </Section>
    );
  }
  return (
    <Section padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Issue</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Affected</th>
              <th className="px-5 py-3">Detected</th>
              <th className="px-5 py-3">Last checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {issues.map((i) => {
              const sev = SEVERITY_META[i.severity];
              const stat = STATUS_META[i.status];
              const cat = CATEGORY_META[i.category];
              return (
                <tr key={i.id} className="cursor-pointer hover:bg-accent/40" onClick={() => onOpen(i.id)}>
                  <td className="px-5 py-3">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <div className="text-mono text-[10px] text-muted-foreground">{i.id}</div>
                  </td>
                  <td className="px-5 py-3 text-xs">{i.owner}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{cat.label}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[stat.tone])}>{stat.label}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[sev.tone])}>{sev.label}</Badge>
                  </td>
                  <td className="px-5 py-3 text-mono text-xs">{i.affectedRecords.toLocaleString()}</td>
                  <td className="px-5 py-3 text-mono text-xs">{fmtRelFrom(i.detectedAt)}</td>
                  <td className="px-5 py-3 text-mono text-xs">{fmtRelFrom(i.lastCheckedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Integrity() {
  const navigate = useNavigate({ from: "/admin/integrity" });
  const search = useSearch({ from: "/admin/integrity" }) as Search;
  const tab: Tab = search.tab ?? "overview";

  const kpis = useMemo(() => integrityKpis(), []);

  const openIssue = (id: string | undefined) =>
    navigate({ search: { ...search, id } });
  const selected = search.id ? ISSUE_BY_ID[search.id] ?? null : null;

  const sortBySeverity = (a: IntegrityIssue, b: IntegrityIssue) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  };

  const drift    = INTEGRITY_ISSUES.filter((i) => i.category === "drift").sort(sortBySeverity);
  const stale    = INTEGRITY_ISSUES.filter((i) => i.category === "stale").sort(sortBySeverity);
  const failed   = INTEGRITY_ISSUES.filter((i) => i.status === "failed" || i.status === "blocked").sort(sortBySeverity);
  const blockers = INTEGRITY_ISSUES.filter((i) => i.blocksOperations).sort(sortBySeverity);
  const overview = [...INTEGRITY_ISSUES].sort(sortBySeverity).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Integrity"
        description="Cross-surface consistency, drift and freshness signals. Operational preview — values shown are mock data, not wired to live integrity checks."
        actions={
          <Badge variant="outline" className="h-6 border-warning/40 bg-warning/10 text-[10px] font-semibold uppercase tracking-wider text-warning">
            Mock data · read-only
          </Badge>
        }
      />

      {/* KPI ROW */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Failed checks" value={String(kpis.failed)}   icon={AlertOctagon}  tone={kpis.failed > 0 ? "danger" : "default"} />
        <StatCard label="Blockers"      value={String(kpis.blockers)} icon={AlertTriangle} tone={kpis.blockers > 0 ? "danger" : "default"} />
        <StatCard label="Drift items"   value={String(kpis.drift)}    icon={Activity}      tone={kpis.drift > 0 ? "warning" : "default"} />
        <StatCard label="Stale records" value={String(kpis.stale)}    tone={kpis.stale > 0 ? "warning" : "default"} />
        <StatCard label="Last checked"  value={fmtRelFrom(kpis.lastCheckedAt)} icon={Clock} tone="primary" />
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

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <IssueTable
              issues={overview}
              onOpen={openIssue}
              empty="No integrity issues detected."
            />
            <Section title="Owner surface health">
              <ul className="divide-y divide-border text-sm">
                {Array.from(new Set(INTEGRITY_ISSUES.map((i) => i.owner))).map((owner) => {
                  const count = INTEGRITY_ISSUES.filter((i) => i.owner === owner).length;
                  const worst = INTEGRITY_ISSUES
                    .filter((i) => i.owner === owner)
                    .sort(sortBySeverity)[0];
                  const sev = SEVERITY_META[worst.severity];
                  return (
                    <li key={owner} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-sm font-medium">{owner}</div>
                        <div className="text-[11px] text-muted-foreground">{count} open</div>
                      </div>
                      <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[sev.tone])}>{sev.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>

          <div className="mt-4">
            <Section title="Posture" padded>
              <div className="flex items-start gap-3 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-muted-foreground">
                  Surface coverage is complete. {kpis.blockers > 0
                    ? <span className="text-foreground"> {kpis.blockers} blocker{kpis.blockers === 1 ? "" : "s"} require immediate operator attention.</span>
                    : <span className="text-foreground"> No operations are currently blocked.</span>}
                </p>
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="drift">
          <IssueTable issues={drift} onOpen={openIssue} empty="No drift detected across owner surfaces." />
        </TabsContent>

        <TabsContent value="stale">
          <IssueTable issues={stale} onOpen={openIssue} empty="No stale records flagged." />
        </TabsContent>

        <TabsContent value="failed">
          <IssueTable issues={failed} onOpen={openIssue} empty="All integrity checks passing." />
        </TabsContent>

        <TabsContent value="blockers">
          <IssueTable issues={blockers} onOpen={openIssue} empty="No issues are currently blocking operations." />
        </TabsContent>
      </Tabs>

      <IntegrityIssueDrawer
        issue={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) openIssue(undefined); }}
      />
    </>
  );
}
