import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OpsDrawerHeader } from "@/components/admin/ops/OpsDrawerHeader";
import { OpsDrawerFooter } from "@/components/admin/ops/OpsDrawerFooter";
import { TONE } from "@/components/admin/ops/toneTokens";
import { STATUS_LABEL, type AdminTrade } from "@/lib/mock-trades-admin";

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
        <OpsDrawerHeader
          align="center"
          badges={
            <Badge variant="outline" className={cn("h-6 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[meta.tone])}>
              {meta.label}
            </Badge>
          }
        >
          <SheetTitle className="font-mono text-base">{trade.id}</SheetTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {trade.account} · {trade.partner}
          </p>
        </OpsDrawerHeader>

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

          <OpsDrawerFooter note="Read-only view. Trade actions ship with the trades control surface.">
            <Button size="sm" variant="outline" disabled>Retry settlement</Button>
            <Button size="sm" variant="outline" disabled>View audit log</Button>
            <Button size="sm" variant="ghost" disabled>View partner trades</Button>
          </OpsDrawerFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
