import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, Play } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/mission-debug")({
  head: () => ({ meta: [{ title: "Admin · Mission debug — Radiant" }] }),
  component: MissionDebug,
});

function MissionDebug() {
  return (
    <>
      <PageHeader title="Mission debug" description="Synthetic mission runs and outcome inspector." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Test runs" value="142" icon={FlaskConical} />
        <StatCard label="Pass"      value="138"  tone="success" />
        <StatCard label="Fail"      value="4"   tone="danger" />
        <StatCard label="Flaky"     value="2"   tone="warning" />
      </div>

      <Section title="New synthetic run" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5"><Label>Mission ID</Label><Input placeholder="m-1042" /></div>
          <div className="space-y-1.5"><Label>Account</Label><Input placeholder="acc-aurora-01" /></div>
          <div className="space-y-1.5"><Label>Seed</Label><Input placeholder="optional" /></div>
        </div>
        <Button className="mt-4 gap-1.5"><Play className="h-3.5 w-3.5" /> Run</Button>
      </Section>

      <Section title="Run output" className="mt-4">
        <pre className="rounded-lg bg-background/60 p-4 text-mono text-xs leading-relaxed text-muted-foreground">
{`[12:14:08] start mission m-1042 on acc-aurora-01
[12:14:08] resolved preconditions (3)
[12:14:09] step 1/4 ok        - claim daily login
[12:14:10] step 2/4 ok        - validate inventory parity
[12:14:11] step 3/4 ok        - submit trade intent
[12:14:13] step 4/4 ok        - confirm receipt
[12:14:13] PASS in 4.8s`}
        </pre>
      </Section>
    </>
  );
}
