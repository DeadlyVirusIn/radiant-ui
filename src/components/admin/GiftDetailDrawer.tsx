import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GIFT_STATUS, type AdminGift } from "@/lib/mock-gifts-admin";

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

function fmt(ts: number) { return new Date(ts).toLocaleString(); }

export function GiftDetailDrawer({
  gift,
  open,
  onOpenChange,
}: {
  gift: AdminGift | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!gift) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const meta = GIFT_STATUS[gift.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="font-mono text-base">{gift.id}</SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">{gift.recipient}</p>
            </div>
            <Badge variant="outline" className={cn("h-6 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[meta.tone])}>
              {meta.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">SKU</div>
            <div className="text-mono text-sm">{gift.sku}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Source</span><div className="mt-0.5 text-sm capitalize">{gift.source.replace("-", " ")}</div></div>
            <div><span className="text-muted-foreground">Retries</span><div className="text-mono mt-0.5 text-sm">{gift.retries}</div></div>
            <div className="col-span-2"><span className="text-muted-foreground">Sent</span><div className="text-mono mt-0.5 text-sm">{fmt(gift.sentAt)}</div></div>
          </div>

          {gift.lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-destructive">Last error</div>
              <div className="text-sm">{gift.lastError}</div>
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={gift.status !== "failed"}>Retry delivery</Button>
            <Button size="sm" variant="outline" disabled={gift.status === "refunded"}>Refund</Button>
            <Button size="sm" variant="ghost">View recipient</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
