import { createFileRoute } from "@tanstack/react-router";
import { User, Mail, Shield, Calendar } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Radiant" }] }),
  component: Profile,
});

function Profile() {
  return (
    <>
      <PageHeader title="Profile" description="Your operator identity, tier and linked services." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/40 text-2xl font-bold text-primary-foreground shadow-[0_0_32px_-4px_var(--primary)]">DV</div>
            <h2 className="mt-3 font-display text-lg font-semibold">DeadlyVirus</h2>
            <p className="text-xs text-muted-foreground">deadly@radiant.app</p>
            <Badge className="mt-3 bg-primary/15 text-primary border-transparent">Premium tier</Badge>
            <Button className="mt-4 w-full" size="sm">Edit profile</Button>
          </div>
        </Section>

        <Section title="Account" className="lg:col-span-2">
          <DataRow label="Display name" value="DeadlyVirus" />
          <DataRow label="Email" value="deadly@radiant.app" />
          <DataRow label="Subscription tier" value={<Badge className="bg-primary/15 text-primary border-transparent">Premium</Badge>} />
          <DataRow label="Renewal" value="Jul 12, 2026" hint="Auto-renew enabled" />
          <DataRow label="2FA" value={<Badge className="bg-success/15 text-success border-transparent">Enabled</Badge>} />
          <DataRow label="Member since" value="Mar 2024" />
        </Section>
      </div>

      <Section title="Linked services" className="mt-4">
        {[
          { name: "Nintendo Account", status: "Connected", tone: "success" as const },
          { name: "Discord", status: "Connected", tone: "success" as const },
          { name: "Telegram", status: "Not connected", tone: "muted" as const },
        ].map((s) => (
          <DataRow key={s.name} label={s.name} value={
            <Badge variant="outline" className={s.tone === "success" ? "border-transparent bg-success/15 text-success" : "border-transparent bg-muted text-muted-foreground"}>{s.status}</Badge>
          } />
        ))}
      </Section>
    </>
  );
}
