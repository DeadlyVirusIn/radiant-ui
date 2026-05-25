import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Crown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/gold-flair")({
  head: () => ({ meta: [{ title: "Gold Flair — Radiant" }] }),
  component: GoldFlair,
});

const items = Array.from({ length: 12 }).map((_, i) => ({
  id: `GF-${(2000 + i).toString(16).toUpperCase()}`,
  name: ["Solar Crown", "Aureate Sigil", "Gilded Pact", "Halcyon Mark", "Sovereign Loop", "Embered Vow"][i % 6],
  tier: ["epic", "rare", "legendary"][i % 3],
  yield: (1.2 + (i % 5) * 0.4).toFixed(2),
  trend: i % 2 === 0 ? "up" : "down",
  count: 4 + (i * 7) % 23,
}));

const tierStyle: Record<string, string> = {
  legendary: "bg-warning/15 text-warning ring-warning/30",
  epic: "bg-primary/15 text-primary ring-primary/30",
  rare: "bg-success/15 text-success ring-success/30",
};

function GoldFlair() {
  return (
    <>
      <PageHeader
        title="Gold Flair"
        description="Premium-tier items in active settlement. Higher yield, stricter rate caps."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="In rotation"   value="28"   icon={Sparkles} tone="warning" />
        <StatCard label="Legendary"     value="6"    icon={Crown}    tone="primary" />
        <StatCard label="Yield (24h)"   value="184"  delta={{ value: "+12%", direction: "up" }} tone="success" />
        <StatCard label="Avg margin"    value="2.41×" icon={TrendingUp} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((it) => (
          <article key={it.id} className="group rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/40 hover:bg-card">
            <div className="flex items-start justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground text-mono">{it.id}</div>
              <Badge variant="outline" className={"h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider ring-1 " + tierStyle[it.tier]}>
                {it.tier}
              </Badge>
            </div>
            <div className="mt-3 font-display text-lg font-semibold leading-tight">{it.name}</div>

            <div className="mt-4 flex h-16 items-end gap-1">
              {Array.from({ length: 16 }).map((_, j) => {
                const h = 20 + ((j * (it.count + 3)) % 60);
                return <div key={j} className="flex-1 rounded-sm bg-warning/40" style={{ height: `${h}%` }} />;
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div>
                <div className="text-muted-foreground">Yield</div>
                <div className="font-display text-base font-semibold text-warning">{it.yield}×</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">In stock</div>
                <div className="font-display text-base font-semibold">{it.count}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
