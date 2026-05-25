import { createFileRoute } from "@tanstack/react-router";
import { Battery, Clock } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/stamina")({
  head: () => ({ meta: [{ title: "Stamina — Radiant" }] }),
  component: Stamina,
});

const accounts = [
  { name: "Aurora-01",  stamina: 84, max: 100, refill: "12m" },
  { name: "Vanta-02",   stamina: 42, max: 100, refill: "1h 18m" },
  { name: "Halcyon-EU", stamina: 100, max: 100, refill: "—" },
  { name: "Solace-JP",  stamina: 18, max: 100, refill: "3h 42m" },
];

function Stamina() {
  return (
    <>
      <PageHeader title="Stamina dashboard" description="Action capacity across your accounts — Radiant routes actions to whoever has headroom." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Avg stamina" value="61%" icon={Battery} tone="primary" />
        <StatCard label="At capacity" value="1 / 4" tone="success" />
        <StatCard label="Refilling"   value="3" icon={Clock} />
        <StatCard label="Next full"   value="12m" tone="warning" />
      </div>

      <Section title="Accounts" className="mt-6">
        <div className="space-y-3">
          {accounts.map((a) => {
            const pct = (a.stamina / a.max) * 100;
            return (
              <div key={a.name} className="rounded-lg border border-border bg-background/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-mono text-xs text-muted-foreground">{a.stamina} / {a.max} · refill {a.refill}</div>
                </div>
                <Progress value={pct} className="mt-2.5 h-1.5" />
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
