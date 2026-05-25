import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "Events — Logs" }] }),
  component: Events,
});

type Level = "all" | "info" | "success" | "warning" | "danger";

const stream = Array.from({ length: 40 }).map((_, i) => {
  const levels: Exclude<Level, "all">[] = ["info", "success", "warning", "danger", "info", "info", "success"];
  const sources = ["fleet-3", "hunt-12", "bot-07", "gifts", "trades", "inventory", "bot-02", "api"];
  const msgs = [
    "Trade settled · +2 gold flair",
    "Hunt session opened on slot B",
    "Rate-limited by upstream, backing off 30s",
    "Gift batch (24 items) delivered",
    "Inventory sync completed in 1.4s",
    "Auth token expired — auto-rotating",
    "Heartbeat ok",
    "Webhook acknowledged",
  ];
  const h = String(14 - Math.floor(i / 8)).padStart(2, "0");
  const m = String((59 - (i * 3) % 60)).padStart(2, "0");
  const s = String((59 - (i * 7) % 60)).padStart(2, "0");
  return {
    id: i,
    time: `${h}:${m}:${s}`,
    level: levels[i % levels.length],
    source: sources[i % sources.length],
    msg: msgs[i % msgs.length],
  };
});

function Events() {
  const [level, setLevel] = useState<Level>("all");
  const [q, setQ] = useState("");

  const filtered = stream.filter((e) =>
    (level === "all" || e.level === level) &&
    (q === "" || (e.msg + e.source).toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <PageHeader title="Events & logs" description="Live, append-only event stream from the fleet and API surfaces." />

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by message or source…" className="h-9 bg-background/40 pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "info", "success", "warning", "danger"] as Level[]).map((lv) => (
            <Button key={lv} variant={level === lv ? "secondary" : "ghost"} size="sm" onClick={() => setLevel(lv)} className="h-8 text-xs capitalize">
              {lv}
            </Button>
          ))}
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card/60">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <ScrollText className="h-3 w-3" />
          <span>Live tail · {filtered.length} events</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Streaming
          </span>
        </div>
        <ul className="divide-y divide-border text-sm">
          {filtered.map((e) => (
            <li key={e.id} className="grid grid-cols-[78px_60px_100px_1fr] items-start gap-3 px-4 py-2 transition-colors hover:bg-accent/40 text-mono text-xs">
              <span className="text-muted-foreground">{e.time}</span>
              <span className={
                "rounded px-1.5 text-[10px] font-semibold uppercase tracking-wider w-fit " +
                (e.level === "success" ? "bg-success/15 text-success"
                  : e.level === "warning" ? "bg-warning/15 text-warning"
                  : e.level === "danger"  ? "bg-destructive/15 text-destructive"
                  : "bg-muted text-muted-foreground")
              }>{e.level}</span>
              <span className="text-muted-foreground truncate">{e.source}</span>
              <span className="font-sans text-foreground">{e.msg}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
