import { createFileRoute } from "@tanstack/react-router";
import { Activity, Pause, Play } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/hunt")({
  head: () => ({ meta: [{ title: "Hunt monitor — Radiant" }] }),
  component: HuntMonitor,
});

const sessions = [
  { id: "H-2104", target: "Solar Crown", bots: 8, found: 3, eta: "12m", progress: 64 },
  { id: "H-2105", target: "Aureate Sigil", bots: 6, found: 1, eta: "28m", progress: 32 },
  { id: "H-2106", target: "Halcyon Mark", bots: 12, found: 7, eta: "4m", progress: 89 },
];

function HuntMonitor() {
  return (
    <>
      <PageHeader title="Hunt monitor" description="Live feed of every running hunt session — pause, scale, or graduate at any moment." actions={<><Button variant="outline" size="sm" className="gap-1.5"><Pause className="h-3.5 w-3.5" /> Pause all</Button><Button size="sm" className="gap-1.5"><Play className="h-3.5 w-3.5" /> New hunt</Button></>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Live sessions" value="3" icon={Activity} tone="primary" />
        <StatCard label="Bots engaged" value="26" />
        <StatCard label="Found today" value="48" tone="success" delta={{ value: "+11", direction: "up" }} />
        <StatCard label="Avg ETA" value="14 m" tone="warning" />
      </div>

      <Section title="Active sessions" className="mt-6">
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-background/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-mono text-xs font-semibold text-muted-foreground">{s.id}</span>
                    <Badge variant="outline" className="h-5 border-transparent bg-primary/15 text-primary text-[10px]">Hunting</Badge>
                  </div>
                  <div className="mt-1 font-display text-sm font-semibold">{s.target}</div>
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <div><div className="text-[10px] uppercase">Bots</div><div className="text-mono text-foreground">{s.bots}</div></div>
                  <div><div className="text-[10px] uppercase">Found</div><div className="text-mono text-success">{s.found}</div></div>
                  <div><div className="text-[10px] uppercase">ETA</div><div className="text-mono text-foreground">{s.eta}</div></div>
                </div>
              </div>
              <Progress value={s.progress} className="mt-3 h-1.5" />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
