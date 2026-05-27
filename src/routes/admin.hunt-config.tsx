import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ReadOnlyBadge } from "@/components/admin/ops/ReadOnlyBadge";

export const Route = createFileRoute("/admin/hunt-config")({
  head: () => ({ meta: [{ title: "Admin · Hunt config — Radiant" }] }),
  component: HuntConfig,
});

function HuntConfig() {
  return (
    <>
      <PageHeader
        title="Hunt configuration"
        description="Defaults that apply to every newly created hunt. Operational preview — values shown are mock data, not wired to live configuration storage."
        actions={
          <div className="flex items-center gap-2">
            <ReadOnlyBadge />
            <Button size="sm" className="gap-1.5" disabled><Save className="h-3.5 w-3.5" /> Save</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Defaults">
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Default bot pool</Label><Input defaultValue="8" disabled /></div>
            <div className="space-y-1.5"><Label>Max parallel hunts</Label><Input defaultValue="6" disabled /></div>
            <div className="space-y-1.5"><Label>Rarity floor</Label><Input defaultValue="rare" disabled /></div>
            <div className="space-y-1.5"><Label>ETA budget (minutes)</Label><Input defaultValue="45" disabled /></div>
          </div>
        </Section>

        <Section title="Behaviour">
          <div className="space-y-4">
            <div className="flex items-center justify-between"><Label>Auto-graduate on first match</Label><Switch defaultChecked disabled /></div>
            <div className="flex items-center justify-between"><Label>Pause on bot health drop</Label><Switch defaultChecked disabled /></div>
            <div className="flex items-center justify-between"><Label>Notify on completion</Label><Switch defaultChecked disabled /></div>
            <div className="flex items-center justify-between"><Label>Aggressive retry</Label><Switch disabled /></div>
          </div>
        </Section>
      </div>

      <Section title="Last applied" className="mt-4">
        <DataRow label="Updated by" value="alex@radiant.app" />
        <DataRow label="At" value="Today, 14:22" />
        <DataRow label="Version" value="hc-v18" />
      </Section>

      <p className="mt-3 text-[10px] text-muted-foreground">Read-only preview — controls are disabled until configuration storage is wired.</p>
    </>
  );
}
