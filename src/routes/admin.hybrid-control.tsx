import { createFileRoute } from "@tanstack/react-router";
import { GitBranch, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ReadOnlyBadge } from "@/components/admin/ops/ReadOnlyBadge";

export const Route = createFileRoute("/admin/hybrid-control")({
  head: () => ({ meta: [{ title: "Admin · Hybrid control — Radiant" }] }),
  component: HybridControl,
});

function HybridControl() {
  return (
    <>
      <PageHeader
        title="Hybrid control"
        description="Operator-in-the-loop switches for sensitive actions across the fleet. Operational preview — values shown are mock data, not wired to live gate storage."
        actions={<ReadOnlyBadge />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Manual gates" value="6" icon={GitBranch} tone="primary" />
        <StatCard label="Auto"         value="14" tone="success" />
        <StatCard label="Pending"      value="2"  tone="warning" icon={AlertTriangle} />
        <StatCard label="Overrides 7d" value="11" />
      </div>

      <Section title="Gates" className="mt-6">
        <div className="space-y-4">
          {[
            { label: "Approve legendary trades", on: true },
            { label: "Confirm token rotation",   on: true },
            { label: "Allow cross-region transfer", on: false },
            { label: "Promote staging config",   on: true },
            { label: "Auto-pause on anomaly",    on: true },
          ].map((g) => (
            <div key={g.label} className="flex items-center justify-between rounded-lg border border-border bg-background/30 p-4">
              <Label className="text-sm">{g.label}</Label>
              <Switch defaultChecked={g.on} disabled />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Read-only preview — gate toggles are disabled until hybrid control storage is wired.</p>
      </Section>
    </>
  );
}
