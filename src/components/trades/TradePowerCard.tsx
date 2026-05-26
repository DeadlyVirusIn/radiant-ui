import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { TradePowerSnapshot } from "@/lib/mock-trades";

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TradePowerCard({ initial }: { initial: TradePowerSnapshot }) {
  const [snap, setSnap] = useState(initial);

  useEffect(() => {
    const id = setInterval(() => {
      setSnap((s) => {
        const next = s.nextPipInMs - 1000;
        if (next <= 0 && s.current < s.max) {
          return { ...s, current: s.current + 1, nextPipInMs: s.pipIntervalMs };
        }
        if (s.current >= s.max) return { ...s, nextPipInMs: s.pipIntervalMs };
        return { ...s, nextPipInMs: next };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pct = (snap.current / snap.max) * 100;
  const atMax = snap.current >= snap.max;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Zap className="h-3 w-3" /> Trade Power
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold tracking-tight">{snap.current}</span>
            <span className="text-sm text-muted-foreground">/ {snap.max}</span>
          </div>
        </div>
        {atMax ? (
          <Badge className="bg-success/15 text-success border-success/30">Max</Badge>
        ) : (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Next pip</div>
            <div className="font-mono text-sm tabular-nums">{fmtCountdown(snap.nextPipInMs)}</div>
          </div>
        )}
      </div>
      <Progress value={pct} className="mt-4 h-1.5" />
      <p className="mt-3 text-xs text-muted-foreground">
        Each completed trade consumes 1 pip. Pips regenerate every 30 minutes.
      </p>
    </div>
  );
}
