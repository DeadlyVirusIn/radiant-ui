import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { OpsDrawerHeader } from "@/components/admin/ops/OpsDrawerHeader";
import { OpsDrawerFooter } from "@/components/admin/ops/OpsDrawerFooter";
import { TONE } from "@/components/admin/ops/toneTokens";
import {
  SEVERITY_META, STATUS_META, KIND_META, fmtTs, fmtRelFrom, fmtDuration,
  type AuditEvent,
} from "@/lib/mock-admin-audit";

function PayloadBlock({ label, payload }: { label: string; payload: Record<string, unknown> | null | undefined }) {
  if (!payload) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <pre className="text-mono overflow-x-auto rounded-md border border-border bg-background/40 p-3 text-[11px] leading-relaxed text-foreground">
{JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

export function AuditEventDrawer({
  event, open, onOpenChange,
}: {
  event: AuditEvent | null;
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

  const sev = SEVERITY_META[event.severity];
  const stat = STATUS_META[event.status];
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
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[stat.tone])}>
                {stat.label}
              </Badge>
              <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", TONE[sev.tone])}>
                Sev · {sev.label}
              </Badge>
            </div>
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
              <span className="text-muted-foreground">Entity</span>
              <div className="text-mono mt-0.5 break-all text-sm">{event.entity}</div>
            </div>
            <div>
              <span className="text-muted-foreground">When</span>
              <div className="mt-0.5 text-sm">{fmtRelFrom(event.at)}</div>
              <div className="text-mono text-[10px] text-muted-foreground">{fmtTs(event.at)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Duration</span>
              <div className="text-mono mt-0.5 text-sm">{fmtDuration(event.durationMs)}</div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Details</div>
            <p className="text-sm text-foreground">{event.details}</p>
          </div>

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Request / source</div>
            <ul className="space-y-1 rounded-md border border-border bg-background/40 p-3 text-[11px]">
              <li className="text-mono"><span className="text-muted-foreground">request_id:</span> {event.source.requestId}</li>
              {event.source.ip && <li className="text-mono"><span className="text-muted-foreground">ip:</span> {event.source.ip}</li>}
              {event.source.region && <li className="text-mono"><span className="text-muted-foreground">region:</span> {event.source.region}</li>}
              {event.source.userAgent && <li className="text-mono break-all"><span className="text-muted-foreground">ua:</span> {event.source.userAgent}</li>}
            </ul>
          </div>

          {(event.before || event.after) && (
            <div className="space-y-3">
              <PayloadBlock label="Before" payload={event.before} />
              <PayloadBlock label="After" payload={event.after} />
            </div>
          )}

          {event.evidence && event.evidence.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Evidence</div>
              <ul className="space-y-1 rounded-md border border-border bg-background/40 p-3 text-xs">
                {event.evidence.map((e, i) => (
                  <li key={i} className="text-mono text-foreground">· {e}</li>
                ))}
              </ul>
            </div>
          )}

          {event.related && event.related.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Related events</div>
                <ol className="space-y-2">
                  {event.related.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="text-sm">{r.label}</div>
                        <div className="text-mono text-[10px] text-muted-foreground">{r.id}</div>
                      </div>
                      <span className="text-mono shrink-0 text-[10px] text-muted-foreground">{fmtRelFrom(r.at)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          <OpsDrawerFooter note="Read-only view. Audit entries are immutable; export and deep-link controls ship in P8.5.">
            <Button size="sm" variant="outline" disabled>Export entry</Button>
            <Button size="sm" variant="outline" disabled>Copy payload</Button>
            <Button size="sm" variant="ghost" disabled>Open owner surface</Button>
          </OpsDrawerFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
