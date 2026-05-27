import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OpsDrawerHeader } from "@/components/admin/ops/OpsDrawerHeader";
import { OpsDrawerFooter } from "@/components/admin/ops/OpsDrawerFooter";
import { TONE } from "@/components/admin/ops/toneTokens";
import {
  SEVERITY_META, STATUS_META, CATEGORY_META, fmtTs, fmtRelFrom,
  type IntegrityIssue,
} from "@/lib/mock-admin-integrity";

const LIFECYCLE_TONE: Record<string, string> = {
  detected:     "bg-destructive",
  escalated:    "bg-warning",
  acknowledged: "bg-primary",
  muted:        "bg-muted-foreground",
  checked:      "bg-success",
};

export function IntegrityIssueDrawer({
  issue, open, onOpenChange,
}: {
  issue: IntegrityIssue | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!issue) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }

  const sev = SEVERITY_META[issue.severity];
  const stat = STATUS_META[issue.status];
  const cat = CATEGORY_META[issue.category];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-screen max-w-full flex-col gap-0 overflow-y-auto p-0 sm:w-auto sm:max-w-lg"
      >
        <OpsDrawerHeader
          align="start"
          stacked
          badges={
            <>
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[stat.tone])}>
                {stat.label}
              </Badge>
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[sev.tone])}>
                Sev · {sev.label}
              </Badge>
            </>
          }
        >
          <SheetTitle className="font-display text-base leading-snug">{issue.title}</SheetTitle>
          <p className="text-mono mt-1 text-[11px] text-muted-foreground">{issue.id} · {cat.label}</p>
        </OpsDrawerHeader>

        <div className="flex flex-col gap-5 p-5">
          {issue.blocksOperations && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-destructive">Blocks operations</div>
              <div className="text-sm">Downstream work for {issue.owner.toLowerCase()} is held until this clears.</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Owner surface</span>
              <div className="mt-0.5 text-sm">{issue.owner}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Affected records</span>
              <div className="text-mono mt-0.5 text-sm">{issue.affectedRecords.toLocaleString()}</div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Affected entity</span>
              <div className="text-mono mt-0.5 break-all text-sm">{issue.entity}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Detected</span>
              <div className="mt-0.5 text-sm">{fmtRelFrom(issue.detectedAt)}</div>
              <div className="text-mono text-[10px] text-muted-foreground">{fmtTs(issue.detectedAt)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Last checked</span>
              <div className="mt-0.5 text-sm">{fmtRelFrom(issue.lastCheckedAt)}</div>
              <div className="text-mono text-[10px] text-muted-foreground">{fmtTs(issue.lastCheckedAt)}</div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Details</div>
            <p className="text-sm text-foreground">{issue.details}</p>
          </div>

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Evidence</div>
            <ul className="space-y-1 rounded-md border border-border bg-background/40 p-3 text-xs">
              {issue.evidence.map((e, i) => (
                <li key={i} className="text-mono text-foreground">· {e}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-primary">Recommended action</div>
            <div className="text-sm">{issue.recommendedAction}</div>
          </div>

          <Separator />

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Lifecycle</div>
            <ol className="space-y-3">
              {issue.lifecycle.map((ev, i) => (
                <li key={i} className="flex items-start gap-3 text-xs">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", LIFECYCLE_TONE[ev.kind] ?? "bg-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm capitalize">{ev.kind}</span>
                      <span className="text-mono shrink-0 text-[10px] text-muted-foreground">{fmtRelFrom(ev.at)}</span>
                    </div>
                    {ev.note && <div className="mt-0.5 text-muted-foreground">{ev.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <OpsDrawerFooter note="Read-only view. Actions disabled until integrity control surface ships.">
            <Button size="sm" variant="outline" disabled>Acknowledge</Button>
            <Button size="sm" variant="outline" disabled>Mute 1h</Button>
            <Button size="sm" variant="outline" disabled>Re-check now</Button>
            <Button size="sm" variant="ghost" disabled>Open owner surface</Button>
          </OpsDrawerFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
