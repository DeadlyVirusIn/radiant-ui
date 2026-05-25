import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Radiant" }] }),
  component: SettingsPage,
});

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-6 border-b border-border py-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="md:col-span-2 space-y-4">{children}</div>
    </section>
  );
}

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Personal preferences, notifications and API access." />

      <div className="rounded-xl border border-border bg-card/60 px-6">
        <Section title="Profile" description="Your operator identity across the console.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" defaultValue="DeadlyVirus" className="bg-background/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="ops@radiant.app" className="bg-background/40" />
            </div>
          </div>
        </Section>

        <Section title="Notifications" description="What we ping you about — and where.">
          {[
            { k: "Hunt completion", d: "Notify when a hunt session settles or fails." },
            { k: "Bot incidents",   d: "Auth rotations, rate-limits and recoveries." },
            { k: "Gold flair drops",d: "New legendary-tier items entering rotation." },
            { k: "Weekly digest",   d: "Summary of throughput, yield and reliability." },
          ].map((row, i) => (
            <div key={row.k} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{row.k}</div>
                <div className="text-xs text-muted-foreground">{row.d}</div>
              </div>
              <Switch defaultChecked={i !== 3} />
            </div>
          ))}
        </Section>

        <Section title="API access" description="Personal access token for the Radiant API.">
          <div className="flex items-center gap-2">
            <Input readOnly value="rad_••••••••••••••••5fA2" className="bg-background/40 text-mono" />
            <Button variant="outline" size="sm">Rotate</Button>
            <Button size="sm">Copy</Button>
          </div>
          <p className="text-xs text-muted-foreground">Last rotated 12 days ago · scope: <span className="text-mono">read,trade</span></p>
        </Section>

        <Section title="Appearance" description="Tailor the look of the console.">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Compact density</div>
              <div className="text-xs text-muted-foreground">Tighter rows and smaller paddings in tables.</div>
            </div>
            <Switch />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">High-contrast borders</div>
              <div className="text-xs text-muted-foreground">Improves separation in dense screens.</div>
            </div>
            <Switch />
          </div>
        </Section>

        <div className="flex items-center justify-end gap-2 py-5">
          <Button variant="ghost">Cancel</Button>
          <Button>Save changes</Button>
        </div>
      </div>
    </>
  );
}
