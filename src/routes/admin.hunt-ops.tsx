import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";

export const Route = createFileRoute("/admin/hunt-ops")({
  head: () => ({ meta: [{ title: "Admin · Hunt ops — Radiant" }] }),
  component: HuntOps,
});

function HuntOps() {
  return (
    <>
      <PageHeader title="Hunt ops" description="Runbook and live operational view for the hunt subsystem." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active hunts" value="6"   icon={Activity} tone="primary" />
        <StatCard label="Queue depth"  value="14"  tone="warning" />
        <StatCard label="Throughput"   value="184/h" tone="success" />
        <StatCard label="Errors 1h"    value="0"   />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Runbook">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Check fleet health and bot region balance.</li>
            <li>Confirm hunt config v18 is active.</li>
            <li>Inspect queue depth — drain if &gt; 50.</li>
            <li>Verify trust signals on new counterparties.</li>
            <li>Promote staging config only after canary passes.</li>
          </ol>
        </Section>
        <Section title="Live counters">
          <DataRow label="Scheduler tick" value="200ms" />
          <DataRow label="Worker pool"    value="32 / 40" />
          <DataRow label="Backpressure"   value="0.14" />
          <DataRow label="Last incident"  value="9d ago" />
        </Section>
      </div>
    </>
  );
}
