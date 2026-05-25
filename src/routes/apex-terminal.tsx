import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Crosshair, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/apex-terminal")({
  head: () => ({ meta: [{ title: "Apex Terminal — Radiant" }] }),
  component: ApexTerminal,
});

function ApexTerminal() {
  return (
    <div className="-m-4 md:-m-6">
      <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.6_0.18_280/.15),transparent)] px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3 w-3" /> Apex Terminal · v3.2
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-6xl">
            Run the perfect hunt,<br />without watching it.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Radiant orchestrates your fleet, balances inventory, and surfaces only what matters — so your operators decide, not babysit.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button asChild size="lg" className="gap-1.5"><Link to="/">Open dashboard <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/help">See how it works</Link></Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 px-6 py-12 md:grid-cols-3 md:px-12">
        {[
          { icon: Crosshair, title: "Targeted hunts", body: "Define rarity gates, account scope, and ETA budgets — Radiant runs the rest." },
          { icon: Activity, title: "Real-time fleet", body: "42-bot health, latency and throughput surfaced in one calm panel." },
          { icon: Sparkles, title: "Premium-grade UI", body: "Built for night shifts. Dense when you need it, quiet when you don't." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card/60 p-6">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><f.icon className="h-4 w-4" /></div>
            <h3 className="mt-4 font-display text-base font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
