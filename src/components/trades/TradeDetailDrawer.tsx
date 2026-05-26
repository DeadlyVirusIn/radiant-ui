import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Copy, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { STATUS_META, type TradeCard, type TradeRecord } from "@/lib/mock-trades";

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-primary/15 text-primary border-transparent",
  success: "bg-success/15 text-success border-transparent",
  warning: "bg-warning/15 text-warning border-transparent",
  danger: "bg-destructive/15 text-destructive border-transparent",
};

const DOT: Record<string, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

function fmtAbs(ts: number) {
  return new Date(ts).toLocaleString();
}
function fmtRel(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDuration(ms: number) {
  if (ms <= 0) return "—";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CardRow({ c }: { c: TradeCard }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{c.pack}</div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="h-5 text-[10px]">
          {c.rarity}
        </Badge>
        {c.qty > 1 && (
          <span className="font-mono text-xs text-muted-foreground">×{c.qty}</span>
        )}
      </div>
    </div>
  );
}

export function TradeDetailDrawer({
  trade,
  open,
  onOpenChange,
  onViewPartner,
}: {
  trade: TradeRecord | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onViewPartner: (partnerId: string) => void;
}) {
  if (!trade) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  const meta = STATUS_META[trade.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="font-mono text-base">{trade.id}</SheetTitle>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {trade.direction === "incoming" ? (
                  <>
                    <ArrowDownLeft className="h-3 w-3 text-success" /> Incoming
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="h-3 w-3 text-primary" /> Outgoing
                  </>
                )}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "h-6 text-[10px] font-semibold uppercase tracking-wider",
                TONE_CLASS[meta.tone],
              )}
            >
              {meta.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          {/* Exchange */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                You gave
              </div>
              <div className="space-y-1.5">
                {trade.gave.map((c, i) => <CardRow key={i} c={c} />)}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                You got
              </div>
              <div className="space-y-1.5">
                {trade.got.map((c, i) => <CardRow key={i} c={c} />)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Partner */}
          <div>
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Partner
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
              <span className="font-mono text-sm">{trade.partner.handle}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => onViewPartner(trade.partner.id)}
              >
                View all trades
              </Button>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Timeline
            </div>
            <ol className="space-y-2.5">
              {trade.lifecycle.map((e, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[e.tone])}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{e.label}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {fmtTime(e.ts)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Separator />

          {/* Traceability */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-primary">
              Origin
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Request ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs">{trade.requestId}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(trade.requestId);
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Copy request ID"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Source</span>
                <span className="text-xs">{trade.originLabel}</span>
              </div>
              <Button asChild size="sm" className="mt-1 w-full gap-1.5">
                <Link to="/card-request" onClick={() => onOpenChange(false)}>
                  Open in Card Requests <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Meta */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span>
                {fmtAbs(trade.completedAt)} · {fmtRel(trade.completedAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-mono">{fmtDuration(trade.durationMs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-mono">{trade.accountId}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
