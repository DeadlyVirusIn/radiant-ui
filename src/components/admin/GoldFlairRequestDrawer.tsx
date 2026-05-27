import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OpsDrawerHeader } from "@/components/admin/ops/OpsDrawerHeader";
import { OpsDrawerFooter } from "@/components/admin/ops/OpsDrawerFooter";
import { TONE } from "@/components/admin/ops/toneTokens";
import {
  GF_STATUS, GF_BLOCK_LABEL, type GFRequest,
} from "@/lib/mock-gold-flair-admin";

function fmt(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : "—";
}

export function GoldFlairRequestDrawer({
  request, open, onOpenChange,
}: {
  request: GFRequest | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!request) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const meta = GF_STATUS[request.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-screen max-w-full flex-col gap-0 overflow-y-auto p-0 sm:w-auto sm:max-w-lg"
      >
        <OpsDrawerHeader
          align="center"
          badges={
            <Badge variant="outline" className={cn("h-6 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[meta.tone])}>
              {meta.label}
            </Badge>
          }
        >
          <SheetTitle className="font-mono text-base">{request.id}</SheetTitle>
          <p className="mt-1 text-xs text-muted-foreground">{request.recipient}</p>
        </OpsDrawerHeader>

        <div className="flex flex-col gap-5 p-5">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">SKU</div>
            <div className="text-mono text-sm">{request.sku}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Signer</span>
              <div className="text-mono mt-0.5 text-sm">{request.signer ?? "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Retries</span>
              <div className="text-mono mt-0.5 text-sm">{request.retries}</div>
            </div>
          </div>

          {request.blockReason && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-warning">Blocked</div>
              <div className="text-sm">{GF_BLOCK_LABEL[request.blockReason]}</div>
            </div>
          )}

          {request.lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-destructive">Last error</div>
              <div className="text-sm">{request.lastError}</div>
            </div>
          )}

          <Separator />

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Lifecycle</div>
            <ol className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Opened</span><span className="text-mono text-xs">{fmt(request.openedAt)}</span></li>
              <li className="flex justify-between"><span>Age</span><span className="text-mono text-xs">{request.ageMin}m</span></li>
            </ol>
          </div>

          <OpsDrawerFooter note="Read-only view. Gold-flair request actions ship with the control surface.">
            <Button size="sm" variant="outline" disabled>Retry mint</Button>
            <Button size="sm" variant="outline" disabled>Unblock</Button>
            <Button size="sm" variant="ghost" disabled>View recipient</Button>
          </OpsDrawerFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
