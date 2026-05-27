import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Battery, Clock, Zap, PackageOpen, Sparkles, Wand2, Swords,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RingGauge } from "@/components/app-shell/RingGauge";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stamina")({
  head: () => ({ meta: [{ title: "Energy — Radiant" }] }),
  component: StaminaPage,
});

type Slot = { name: string; energy: number; max: number; refillMins: number };

const SLOTS: Slot[] = [
  { name: "Open Pack",   energy: 84,  max: 100, refillMins: 12 },
  { name: "Wonder Pick", energy: 42,  max: 100, refillMins: 78 },
  { name: "Battles",     energy: 100, max: 100, refillMins: 0 },
  { name: "Trades",      energy: 18,  max: 100, refillMins: 222 },
];

function formatMins(m: number) {
  if (m <= 0) return "Full";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

function StaminaPage() {
  const summary = useMemo(() => {
    const avg = Math.round(SLOTS.reduce((s, x) => s + x.energy / x.max, 0) / SLOTS.length * 100);
    const full = SLOTS.filter((s) => s.energy >= s.max).length;
    const refilling = SLOTS.filter((s) => s.energy < s.max).length;
    const nextFull = SLOTS.filter((s) => s.refillMins > 0).reduce(
      (m, s) => Math.min(m, s.refillMins),
      Number.POSITIVE_INFINITY,
    );
    return { avg, full, refilling, nextFull: Number.isFinite(nextFull) ? nextFull : 0 };
  }, []);

  const lowest = useMemo(
    () => [...SLOTS].sort((a, b) => a.energy / a.max - b.energy / b.max)[0],
    [],
  );

  return (
    <>
      <PageHeader
        title="Energy"
        description="Each play surface has its own energy. Spend it on what matters most today."
      />

      <Hero
        eyebrow="Lowest right now"
        eyebrowIcon={Zap}
        title={lowest.name}
        subtitle={`${lowest.energy} / ${lowest.max} energy · refills in ${formatMins(lowest.refillMins)}`}
        right={<RingGauge pct={(lowest.energy / lowest.max) * 100} label={`${Math.round((lowest.energy / lowest.max) * 100)}%`} sublabel="Energy" />}
      >
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <ProgressBar done={lowest.energy} total={lowest.max} tone={lowest.energy < 30 ? "warn" : "primary"} />
          <div className="mt-2 text-[11px] text-muted-foreground">
            Tip: while {lowest.name.toLowerCase()} refills, switch to a surface with full energy.
          </div>
        </div>
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Average"   value={`${summary.avg}%`}     icon={Battery} tone="primary" />
        <StatCard label="Full"      value={`${summary.full} / ${SLOTS.length}`} tone="success" />
        <StatCard label="Refilling" value={String(summary.refilling)} icon={Clock} />
        <StatCard label="Next full" value={formatMins(summary.nextFull)} tone="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {SLOTS.map((s) => {
          const pct = (s.energy / s.max) * 100;
          const full = s.energy >= s.max;
          return (
            <div key={s.name} className={cn(
              "rounded-xl border bg-card/60 p-4",
              full ? "border-success/40" : pct < 30 ? "border-warning/40" : "border-border",
            )}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{s.name}</div>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 border-transparent text-[10px] font-semibold uppercase",
                    full ? "bg-success/15 text-success" : pct < 30 ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary",
                  )}
                >
                  {full ? "Ready" : pct < 30 ? "Low" : "Active"}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {s.energy} / {s.max} · refills in {formatMins(s.refillMins)}
              </div>
              <ProgressBar done={s.energy} total={s.max} tone={full ? "success" : pct < 30 ? "warn" : "primary"} />
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <HandoffStrip
          to={lowest.name === "Open Pack" ? "/open-pack" : lowest.name === "Wonder Pick" ? "/wonder-pick" : lowest.name === "Battles" ? "/battles" : "/trades"}
          icon={PackageOpen}
          tone="primary"
          title={`Spend energy on ${lowest.name}`}
          hint="Use what's full first, save what's almost gone."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/missions"    icon={Sparkles} title="Missions"    hint="Earn refills faster." />
        <CrossLink to="/wonder-pick" icon={Wand2}    title="Wonder Pick" hint="Costs 1 ticket, not energy." />
        <CrossLink to="/battles"     icon={Swords}   title="Battles"     hint="Battles refill independently." />
      </div>
    </>
  );
}
