import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GF_STATUS, type MintBatch } from "@/lib/mock-gold-flair-admin";

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

function fmt(ts: number) { return new Date(ts).toLocaleString(); }

export function MintBatchDrawer({
  batch, open, onOpenChange,
}: {
  batch: MintBatch | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!batch) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const meta = GF_STATUS[batch.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-screen max-w-full flex-col gap-0 overflow-y-auto p-0 sm:w-auto sm:max-w-lg">
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="font-mono text-base">{batch.id}</SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">Mint batch · {batch.size} items</p>
            </div>
            <Badge variant="outline" className={cn("h-6 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[meta.tone])}>
              {meta.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Signer</div>
              <div className="text-mono text-sm">{batch.signer}</div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Retries</div>
              <div className="text-mono text-sm">{batch.retries}</div>
            </div>
          </div>

          {batch.lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-destructive">Last error</div>
              <div className="text-sm">{batch.lastError}</div>
            </div>
          )}

          <Separator />

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Lifecycle</div>
            <ol className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Opened</span><span className="text-mono text-xs">{fmt(batch.openedAt)}</span></li>
              <li className="flex justify-between"><span>Age</span><span className="text-mono text-xs">{batch.ageMin}m</span></li>
            </ol>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button size="sm" variant="outline" disabled={batch.status !== "queued"}>Approve</Button>
            <Button size="sm" variant="outline" disabled={batch.status !== "failed"}>Retry batch</Button>
            <Button size="sm" variant="ghost">View audit log</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
