import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META, type TradeRecord } from "@/lib/mock-trades";

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function summarize(cards: TradeRecord["gave"]): string {
  if (cards.length === 0) return "—";
  const first = cards[0];
  const base = `${first.name}${first.qty > 1 ? ` ×${first.qty}` : ""}`;
  return cards.length > 1 ? `${base} +${cards.length - 1}` : base;
}

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-primary/15 text-primary border-transparent",
  success: "bg-success/15 text-success border-transparent",
  warning: "bg-warning/15 text-warning border-transparent",
  danger: "bg-destructive/15 text-destructive border-transparent",
};

export function TradeHistoryTable({
  trades,
  onSelect,
}: {
  trades: TradeRecord[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Trade</th>
              <th className="px-5 py-3">Dir</th>
              <th className="px-5 py-3">Partner</th>
              <th className="px-5 py-3">Gave</th>
              <th className="px-5 py-3">Got</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trades.map((t) => {
              const meta = STATUS_META[t.status];
              return (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-accent/40"
                  onClick={() => onSelect(t.id)}
                >
                  <td className="px-5 py-3 font-mono text-xs">{t.id}</td>
                  <td className="px-5 py-3">
                    {t.direction === "incoming" ? (
                      <ArrowDownLeft className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {t.partner.handle}
                  </td>
                  <td className="px-5 py-3">{summarize(t.gave)}</td>
                  <td className="px-5 py-3">{summarize(t.got)}</td>
                  <td className="px-5 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 text-[10px] font-semibold uppercase tracking-wider",
                        TONE_CLASS[meta.tone],
                      )}
                    >
                      {meta.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                    {relTime(t.completedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {trades.map((t) => {
          const meta = STATUS_META[t.status];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-3 text-left hover:bg-accent/40"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
                {t.direction === "incoming" ? (
                  <ArrowDownLeft className="h-4 w-4 text-success" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {t.partner.handle}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 shrink-0 text-[10px] font-semibold uppercase tracking-wider",
                      TONE_CLASS[meta.tone],
                    )}
                  >
                    {meta.label}
                  </Badge>
                </div>
                <div className="mt-1 truncate text-sm">
                  {summarize(t.gave)} <span className="text-muted-foreground">→</span>{" "}
                  {summarize(t.got)}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {t.id} · {relTime(t.completedAt)}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </>
  );
}
