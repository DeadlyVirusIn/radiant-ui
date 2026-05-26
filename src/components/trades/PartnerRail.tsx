import { Users } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PartnerAggregate } from "@/lib/mock-trades";

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PartnerRail({
  partners,
  activePartnerId,
  onSelect,
}: {
  partners: PartnerAggregate[];
  activePartnerId: string | "all";
  onSelect: (id: string | "all") => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Users className="h-3 w-3" /> Top Partners
        </div>
        {activePartnerId !== "all" && (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {partners.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Partners appear after your first completed trade.
        </p>
      ) : (
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {partners.map((p) => {
              const active = activePartnerId === p.partner.id;
              return (
                <button
                  key={p.partner.id}
                  type="button"
                  onClick={() => onSelect(active ? "all" : p.partner.id)}
                  className={cn(
                    "flex shrink-0 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/40 hover:bg-accent/40",
                  )}
                >
                  <span className="font-mono text-xs">{p.partner.handle}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {p.tradeCount} trade{p.tradeCount === 1 ? "" : "s"} · {Math.round(p.successRate * 100)}% ·{" "}
                    {relTime(p.lastTradeAt)}
                  </span>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
