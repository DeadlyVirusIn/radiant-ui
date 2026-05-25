import { createFileRoute } from "@tanstack/react-router";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";

export const Route = createFileRoute("/wonder-pick")({
  head: () => ({ meta: [{ title: "Wonder pick — Radiant" }] }),
  component: WonderPick,
});

function WonderPick() {
  return (
    <>
      <PageHeader title="Wonder pick" description="Choose one of five hidden cards from a recently opened pack." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Tickets" value="3" icon={Wand2} tone="primary" />
        <StatCard label="Available picks" value="42" tone="success" />
        <StatCard label="Avg dust"   value="68" />
        <StatCard label="Best today" value="Halcyon Mark" tone="warning" />
      </div>

      <Section title="Pick a card" className="mt-6">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/30 via-card to-card transition-transform hover:-translate-y-1 hover:border-primary">
              <div className="absolute inset-0 grid place-items-center">
                <div className="font-display text-3xl font-bold text-primary/60 group-hover:text-primary">?</div>
              </div>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}
