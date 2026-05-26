import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";

export const Route = createFileRoute("/admin/observability")({
  head: () => ({ meta: [{ title: "Admin · Observability — Radiant" }] }),
  component: Observability,
});

function Observability() {
  return (
    <>
      <PageHeader title="Observability" description="Metrics, traces and logs from the live services." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Req/s"      value="2,840" icon={Activity} tone="primary" />
        <StatCard label="P95"        value="184 ms" />
        <StatCard label="Error rate" value="0.18%" tone="success" />
        <startCard label="" />
        <StatCard label="Saturation" value="42%" tone="warning" />
      </div>

      <Section title="Service map" className="mt-6">
        <div className="h-48 rounded-lg border border-dashed border-border bg-background/30 p-3">
          <div className="grid h-full grid-cols-4 gap-3">
            {["gateway", "scheduler", "trader", "vault"].map((s) => (
              <div key={s} className="grid place-items-center rounded-md bg-card/60 text-xs font-medium">{s}</div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Top endpoints" className="mt-4">
        <DataRow label="POST /trades"    value="184 ms · 0.1% err" />
        <DataRow label="GET /inventory"  value="48 ms · 0%" />
        <DataRow label="POST /hunts"     value="220 ms · 0.4% err" />
        <DataRow label="GET /accounts"   value="62 ms · 0%" />
      </Section>
    </>
  );
}
