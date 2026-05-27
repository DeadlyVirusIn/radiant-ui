import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type AdminTrade } from "@/lib/mock-trades-admin";

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
};

function fmt(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : "—";
}
function fmtDur(ms: number | null) {
  if (!ms) return "—";
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AdminTradeDetailDrawer({
  trade,
  open,
  onOpenChange,
}: {
  trade: AdminTrade | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!trade) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const meta = STATUS_LABEL[trade.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="font-mono text-base">{trade.id}</SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {trade.account} · {trade.partner}
              </p>
            </div>
            <Badge variant="outline" className={cn("h-6 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[meta.tone])}>
              {meta.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          {/* Exchange */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Gave</div>
              <div className="text-sm font-medium">{trade.gave}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Got</div>
              <div className="text-sm font-medium">{trade.got}</div>
            </div>
          </div>

          <Separator />

          {/* Settlement */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Settlement</div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
              <span className="text-sm capitalize">{trade.settlement}</span>
              <span className="text-mono text-xs text-muted-foreground">retries · {trade.retries}</span>
            </div>
          </div>

          {trade.lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-destructive">Last error</div>
              <div className="text-sm text-foreground">{trade.lastError}</div>
            </div>
          )}

          <Separator />

          {/* Lifecycle */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Lifecycle</div>
            <ol className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Opened</span><span className="text-mono text-xs">{fmt(trade.openedAt)}</span></li>
              <li className="flex justify-between"><span>Closed</span><span className="text-mono text-xs">{fmt(trade.closedAt)}</span></li>
              <li className="flex justify-between"><span>Duration</span><span className="text-mono text-xs">{fmtDur(trade.durationMs)}</span></li>
            </ol>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={trade.settlement !== "failed"}>Retry settlement</Button>
            <Button size="sm" variant="outline">View audit log</Button>
            <Button size="sm" variant="ghost">View partner trades</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
