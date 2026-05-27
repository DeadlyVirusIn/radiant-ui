import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QUEUE_SNAPSHOTS, QUEUE_RUNBOOK, type QueueKey } from "@/lib/mock-admin-queues";

type Search = { tab?: QueueKey; id?: string };

export const Route = createFileRoute("/admin/queues")({
  head: () => ({ meta: [{ title: "Admin · Queues — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (s.tab as QueueKey) ?? undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: Queues,
});

const TABS: { key: QueueKey; label: string }[] = [
  { key: "hunts",  label: "Hunts" },
  { key: "trades", label: "Trades" },
  { key: "gifts",  label: "Gifts" },
  { key: "mint",   label: "Mint" },
];

function QueuePanel({ k }: { k: QueueKey }) {
  const q = QUEUE_SNAPSHOTS[k];
  const runbook = QUEUE_RUNBOOK[k];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Queue depth"    value={String(q.depth)}                icon={Activity} tone={q.depth >= 10 ? "warning" : "primary"} />
        <StatCard label="Throughput"     value={`${q.throughputPerH}/h`}        tone="success" />
        <StatCard label="Errors 1h"      value={String(q.errors1h)}             tone={q.errors1h > 0 ? "danger" : "default"} />
        <StatCard label="Oldest item"    value={`${q.oldestAgeMin}m`}           tone={q.oldestAgeMin >= 10 ? "warning" : "default"} />
        <StatCard label="p95 wait"       value={`${q.p95WaitSec}s`}             tone={q.p95WaitSec >= 60 ? "warning" : "default"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Runbook">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {runbook.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </Section>
        <Section title="Live counters">
          <DataRow label="Worker pool"   value="32 / 40" />
          <DataRow label="Backpressure"  value="0.14" />
          <DataRow label="Scheduler tick" value="200ms" />
          <DataRow label="Last incident" value="9d ago" />
        </Section>
      </div>
    </>
  );
}

function Queues() {
  const navigate = useNavigate({ from: "/admin/queues" });
  const search = useSearch({ from: "/admin/queues" }) as Search;
  const active = useMemo<QueueKey>(() => search.tab ?? "hunts", [search.tab]);

  return (
    <>
      <PageHeader
        title="Queues"
        description="Live operational view across hunts, trades, gifts and mint."
      />
      <Tabs
        value={active}
        onValueChange={(v) => navigate({ search: { ...search, tab: v as QueueKey } })}
      >
        <TabsList className="mb-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <QueuePanel k={t.key} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
