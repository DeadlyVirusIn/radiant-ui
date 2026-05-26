import { Link } from "@tanstack/react-router";
import { ArrowRight, Repeat2, Store } from "lucide-react";
import { CardArt } from "./CardArt";
import type { CardRequest, CardRequestAvailability } from "@/lib/mock-card-requests";

const availabilityMeta: Record<CardRequestAvailability, { label: string; cls: string; disabled: boolean }> = {
  available: { label: "Available", cls: "bg-success/15 text-success border-success/30", disabled: false },
  limited:   { label: "Limited",   cls: "bg-warning/15 text-warning border-warning/30", disabled: false },
  sold_out:  { label: "Sold out",  cls: "bg-muted text-muted-foreground border-border", disabled: true  },
};

export function MarketplacePreview({ requests }: { requests: CardRequest[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">Marketplace picks</h3>
            <p className="text-xs text-muted-foreground">Cards from the request marketplace that match your wishlist</p>
          </div>
        </div>
        <Link to="/card-request" search={{ card: undefined }} className="text-xs font-semibold text-primary hover:underline">
          Browse marketplace →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {requests.map((r) => {
          const a = availabilityMeta[r.availability];
          return (
            <div
              key={r.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/40 transition-transform hover:-translate-y-1 hover:border-primary/40"
            >
              <div className="p-3 pb-0">
                <CardArt
                  name={r.card.name}
                  set={r.card.pack}
                  type={r.card.type}
                  rarity={r.card.rarity as Parameters<typeof CardArt>[0]["rarity"]}
                />
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-display text-sm font-semibold text-foreground">{r.card.name}</p>
                  <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a.cls}`}>
                    {a.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.card.pack}</p>
                <div className="mt-2 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Bright Sand</span>
                  <span className="font-mono text-sm font-bold text-warning">{r.cost.toLocaleString()}</span>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">{r.stockLabel}</p>
                <div className="mt-auto pt-3">
                  {a.disabled ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      Unavailable
                    </button>
                  ) : (
                    <Link
                      to="/card-request"
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Repeat2 className="h-3.5 w-3.5" /> Trade <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
