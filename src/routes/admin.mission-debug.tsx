import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, CheckCircle2, XCircle, AlertTriangle, Play } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/mission-debug")({
  head: () => ({ meta: [{ title: "Admin · Mission debug — Radiant" }] }),
  component: MissionDebug,
});

const recentRuns = [
  { id: "RUN-1042", mission: "m-1042", account: "acc-aurora-01", status: "pass" as const, durationMs: 4_800, at: "12:14:08" },
  { id: "RUN-1041", mission: "m-1040", account: "acc-aurora-03", status: "pass" as const, durationMs: 5_120, at: "12:09:31" },
  { id: "RUN-1040", mission: "m-1037", account: "acc-aurora-02", status: "flaky" as const, durationMs: 7_840, at: "12:02:14" },
  { id: "RUN-1039", mission: "m-1031", account: "acc-aurora-04", status: "fail" as const, durationMs: 3_210, at: "11:58:02" },
  { id: "RUN-1038", mission: "m-1029", account: "acc-aurora-01", status: "pass" as const, durationMs: 4_410, at: "11:52:47" },
];

const TONE = {
  pass:  "bg-success/15 text-success",
  fail:  "bg-destructive/15 text-destructive",
  flaky: "bg-warning/15 text-warning",
};

function MissionDebug() {
  return (
    <div className="min-w-0">
      <PageHeader
        title="Mission debug"
        description="Synthetic mission runs and outcome inspector. Operational preview — mock data, runner controls are not wired."
        actions={
          <Badge variant="outline" className="h-6 border-warning/40 bg-warning/10 text-[10px] font-semibold uppercase tracking-wider text-warning">
            Mock data · read-only
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
        <StatCard label="Test runs" value="142" icon={FlaskConical} />
        <StatCard label="Pass"      value="138" icon={CheckCircle2} tone="success" />
        <StatCard label="Fail"      value="4"   icon={XCircle}      tone="danger" />
        <StatCard label="Flaky"     value="2"   icon={AlertTriangle} tone="warning" />
      </div>

      <Section title="New synthetic run" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5"><Label>Mission ID</Label><Input placeholder="m-1042" disabled /></div>
          <div className="space-y-1.5"><Label>Account</Label><Input placeholder="acc-aurora-01" disabled /></div>
          <div className="space-y-1.5"><Label>Seed</Label><Input placeholder="optional" disabled /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button className="gap-1.5" disabled><Play className="h-3.5 w-3.5" /> Run</Button>
          <p className="text-[11px] text-muted-foreground">
            Runner is disabled in this preview. Synthetic execution ships with the controls phase.
          </p>
        </div>
      </Section>

      <Section title="Recent runs" className="mt-4" padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-3">Run</th>
                <th className="px-5 py-3">Mission</th>
                <th className="px-5 py-3">Account</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentRuns.map((r) => (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3 text-mono text-xs">{r.id}</td>
                  <td className="px-5 py-3 text-mono text-xs">{r.mission}</td>
                  <td className="px-5 py-3 text-mono text-xs">{r.account}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + TONE[r.status]}>{r.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-mono text-xs">{(r.durationMs / 1000).toFixed(2)}s</td>
                  <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{r.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Run output" className="mt-4">
        <pre className="overflow-x-auto rounded-lg bg-background/60 p-4 text-mono text-xs leading-relaxed text-muted-foreground">
{`[12:14:08] start mission m-1042 on acc-aurora-01
[12:14:08] resolved preconditions (3)
[12:14:09] step 1/4 ok        - claim daily login
[12:14:10] step 2/4 ok        - validate inventory parity
[12:14:11] step 3/4 ok        - submit trade intent
[12:14:13] step 4/4 ok        - confirm receipt
[12:14:13] PASS in 4.8s`}
        </pre>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Captured from RUN-1042. Live tailing is disabled in this preview.
        </p>
      </Section>
    </div>
  );
}
