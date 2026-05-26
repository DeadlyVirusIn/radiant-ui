export function RingGauge({
  pct,
  label,
  sublabel,
}: {
  pct: number;
  label: string;
  sublabel?: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-border" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="fill-none stroke-primary transition-[stroke-dasharray]"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-sm font-bold">{label}</div>
          {sublabel && (
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}
