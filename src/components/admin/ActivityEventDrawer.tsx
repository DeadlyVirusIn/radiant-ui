import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OpsDrawerFooter } from "@/components/admin/ops/OpsDrawerFooter";
import {
  LEVEL_META, KIND_META, fmtTs, fmtRelFrom,
  type ActivityEvent,
} from "@/lib/mock-admin-activity";

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

export function ActivityEventDrawer({
  event, open, onOpenChange,
}: {
  event: ActivityEvent | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!event) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  const lvl = LEVEL_META[event.level];
  const kind = KIND_META[event.kind];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-screen max-w-full flex-col gap-0 overflow-y-auto p-0 sm:w-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="font-display text-base leading-snug break-words">{event.action}</SheetTitle>
              <p className="text-mono mt-1 text-[11px] text-muted-foreground">{event.id} · {kind.label} · {event.surface}</p>
            </div>
            <Badge variant="outline" className={cn("h-5 shrink-0 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[lvl.tone])}>
              {lvl.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Actor</span>
              <div className="text-mono mt-0.5 text-sm break-all">{event.actor}</div>
              <div className="text-[10px] capitalize text-muted-foreground">{event.actorRole}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Surface</span>
              <div className="mt-0.5 text-sm">{event.surface}</div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Target</span>
              <div className="text-mono mt-0.5 break-all text-sm">{event.target}</div>
            </div>
            <div>
              <span className="text-muted-foreground">When</span>
              <div className="mt-0.5 text-sm">{fmtRelFrom(event.at)}</div>
              <div className="text-mono text-[10px] text-muted-foreground">{fmtTs(event.at)}</div>
            </div>
            {event.ip && (
              <div>
                <span className="text-muted-foreground">Source IP</span>
                <div className="text-mono mt-0.5 text-sm">{event.ip}</div>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Details</div>
            <p className="text-sm text-foreground">{event.details}</p>
          </div>

          {event.context && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Context</div>
              <pre className="text-mono overflow-x-auto rounded-md border border-border bg-background/40 p-3 text-[11px] leading-relaxed">
{JSON.stringify(event.context, null, 2)}
              </pre>
            </div>
          )}

          <OpsDrawerFooter note="Read-only view. Activity stream is operator-visible only; mutation controls are not wired in this preview.">
            <Button size="sm" variant="outline" disabled>Pin entry</Button>
            <Button size="sm" variant="outline" disabled>Copy reference</Button>
            <Button size="sm" variant="ghost" disabled>Open owner surface</Button>
          </OpsDrawerFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
