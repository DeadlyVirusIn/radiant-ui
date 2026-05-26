import { createFileRoute } from "@tanstack/react-router";
import { Bot, Activity, Cpu, Wifi } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bot-hub")({
  head: () => ({ meta: [{ title: "Bot hub — Radiant" }] }),
  component: BotHub,
});

const bots = Array.from({ length: 12 }).map((_, i) => ({
  id: `bot-${(i + 1).toString().padStart(2, "0")}`,
  region: ["NA", "EU", "JP", "OCE"][i % 4],
  cpu: 18 + (i * 7) % 60,
  net: 30 + (i * 13) % 70,
  status: i % 5 === 0 ? "warn" : "ok",
}));

function BotHub() {
  return (
    <>
      <PageHeader title="Bot hub" description="Central control surface for every bot — assign hunts, drain queues, rotate tokens." actions={<><Button variant="outline" size="sm">Drain all</Button><Button size="sm">Assign hunt</Button></>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Bots online" value="40 / 42" icon={Bot} tone="success" />
        <StatCard label="Avg CPU"     value="34%"     icon={Cpu} tone="primary" />
        <StatCard label="Avg latency" value="118 ms"  icon={Wifi} />
        <StatCard label="Throughput"  value="1.8k/m"  icon={Activity} delta={{ value: "+12%", direction: "up" }} />
      </div>

      <Section title="Fleet" className="mt-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((b) => (
            <div key={b.id} className="rounded-lg border border-border bg-background/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={"h-2 w-2 rounded-full " + (b.status === "ok" ? "bg-success" : "bg-warning")} />
                  <span className="text-mono text-sm font-semibold">{b.id}</span>
                </div>
                <Badge variant="outline" className="h-5 border-transparent bg-muted text-[10px] text-muted-foreground">{b.region}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground"><span>CPU</span><span className="text-mono">{b.cpu}%</span></div>
                  <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${b.cpu}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground"><span>Network</span><span className="text-mono">{b.net}%</span></div>
                  <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${b.net}%` }} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
