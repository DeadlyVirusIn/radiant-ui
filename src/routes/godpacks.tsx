import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Sparkle, Sparkles, Calendar, Layers, Star, PackageOpen,
  Lock, CheckCircle2, ArrowRight, X, Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/godpacks")({
  head: () => ({ meta: [{ title: "God Pack Gallery — Radiant" }] }),
  component: GodPackGallery,
});

// ─── Mock data ──────────────────────────────────────────────────────────
type Pack = {
  id: string;
  set: string;
  pulledAt: string;     // ISO-ish display date
  daysAgo: number;
  opened: boolean;
  highlight: string;    // featured card in the pack
  cards: { name: string; rarity: "Holo" | "Full Art" | "Immersive" | "Crown" }[];
};

const SETS = ["Genesis Echo", "Sovereign Loop", "Aurora Pact", "Mythical Island"];

const PACKS: Pack[] = [
  { id: "p1",  set: "Genesis Echo",    pulledAt: "May 24",  daysAgo: 2,   opened: false, highlight: "Charizard ex (Immersive)", cards: [
    { name: "Charizard ex", rarity: "Immersive" }, { name: "Pikachu", rarity: "Full Art" }, { name: "Bulbasaur", rarity: "Holo" } ] },
  { id: "p2",  set: "Sovereign Loop",  pulledAt: "May 20",  daysAgo: 6,   opened: true,  highlight: "Mewtwo (Crown)",            cards: [
    { name: "Mewtwo", rarity: "Crown" }, { name: "Alakazam", rarity: "Full Art" }, { name: "Gengar", rarity: "Holo" } ] },
  { id: "p3",  set: "Aurora Pact",     pulledAt: "May 18",  daysAgo: 8,   opened: true,  highlight: "Lugia (Full Art)",          cards: [
    { name: "Lugia", rarity: "Full Art" }, { name: "Ho-Oh", rarity: "Holo" }, { name: "Wailord", rarity: "Holo" } ] },
  { id: "p4",  set: "Genesis Echo",    pulledAt: "May 14",  daysAgo: 12,  opened: false, highlight: "Venusaur ex (Full Art)",    cards: [
    { name: "Venusaur ex", rarity: "Full Art" }, { name: "Ivysaur", rarity: "Holo" } ] },
  { id: "p5",  set: "Mythical Island", pulledAt: "May 11",  daysAgo: 15,  opened: true,  highlight: "Mew (Immersive)",           cards: [
    { name: "Mew", rarity: "Immersive" }, { name: "Celebi", rarity: "Full Art" } ] },
  { id: "p6",  set: "Genesis Echo",    pulledAt: "May 06",  daysAgo: 20,  opened: true,  highlight: "Blastoise ex (Full Art)",   cards: [
    { name: "Blastoise ex", rarity: "Full Art" }, { name: "Squirtle", rarity: "Holo" } ] },
  { id: "p7",  set: "Aurora Pact",     pulledAt: "May 03",  daysAgo: 23,  opened: false, highlight: "Rayquaza (Crown)",          cards: [
    { name: "Rayquaza", rarity: "Crown" }, { name: "Salamence", rarity: "Holo" } ] },
  { id: "p8",  set: "Sovereign Loop",  pulledAt: "Apr 28",  daysAgo: 28,  opened: true,  highlight: "Dragonite (Full Art)",      cards: [
    { name: "Dragonite", rarity: "Full Art" }, { name: "Dragonair", rarity: "Holo" } ] },
  { id: "p9",  set: "Genesis Echo",    pulledAt: "Apr 22",  daysAgo: 34,  opened: true,  highlight: "Snorlax (Full Art)",        cards: [
    { name: "Snorlax", rarity: "Full Art" }, { name: "Munchlax", rarity: "Holo" } ] },
  { id: "p10", set: "Mythical Island", pulledAt: "Apr 19",  daysAgo: 37,  opened: true,  highlight: "Jirachi (Immersive)",       cards: [
    { name: "Jirachi", rarity: "Immersive" }, { name: "Celebi", rarity: "Holo" } ] },
  { id: "p11", set: "Aurora Pact",     pulledAt: "Apr 12",  daysAgo: 44,  opened: true,  highlight: "Kyogre (Full Art)",         cards: [
    { name: "Kyogre", rarity: "Full Art" }, { name: "Sharpedo", rarity: "Holo" } ] },
  { id: "p12", set: "Genesis Echo",    pulledAt: "Apr 05",  daysAgo: 51,  opened: true,  highlight: "Gyarados (Holo)",           cards: [
    { name: "Gyarados", rarity: "Holo" }, { name: "Magikarp", rarity: "Holo" } ] },
];

const RARITY_TINT: Record<Pack["cards"][number]["rarity"], string> = {
  "Holo":      "text-sky-300 border-sky-400/30 bg-sky-500/10",
  "Full Art":  "text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-500/10",
  "Immersive": "text-amber-300 border-amber-400/30 bg-amber-500/10",
  "Crown":     "text-warning border-warning/40 bg-warning/10",
};

// ─── Helpers ────────────────────────────────────────────────────────────
type StatusFilter = "all" | "opened" | "sealed";
type SortKey = "newest" | "oldest" | "recently-opened" | "by-set";

function setCounts(packs: Pack[]) {
  const m = new Map<string, number>();
  for (const p of packs) m.set(p.set, (m.get(p.set) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ─── Sub-components ─────────────────────────────────────────────────────
function PackArt({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "lg" ? "h-56" : size === "sm" ? "h-24" : "aspect-square";
  return (
    <div className={cn("relative w-full overflow-hidden bg-gradient-to-br from-warning/40 via-primary/15 to-card", h)}>
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-warning/30 blur-3xl" />
      <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
      <div className="absolute inset-0 grid place-items-center">
        <Sparkles className="h-8 w-8 text-warning/80 drop-shadow" />
      </div>
    </div>
  );
}

function StatusBadge({ opened }: { opened: boolean }) {
  return opened ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
      <CheckCircle2 className="h-3 w-3" /> Opened
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Lock className="h-3 w-3" /> Sealed
    </span>
  );
}

function PackTile({ pack, onOpen }: { pack: Pack; onOpen: (p: Pack) => void }) {
  return (
    <button
      onClick={() => onOpen(pack)}
      className="group overflow-hidden rounded-xl border border-border bg-card/60 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:ring-1 hover:ring-primary/30"
    >
      <div className="relative">
        <PackArt />
        <Badge className="absolute left-2 top-2 border-transparent bg-warning/90 text-[10px] uppercase tracking-wider text-warning-foreground">
          <Sparkle className="mr-1 h-3 w-3" /> God Pack
        </Badge>
        <div className="absolute right-2 top-2">
          <StatusBadge opened={pack.opened} />
        </div>
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold">{pack.set}</div>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {pack.pulledAt}</span>
          <span className="truncate text-right">{pack.opened ? pack.highlight : "—"}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────
function GodPackGallery() {
  const [setFilter, setSetFilter] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Pack | null>(null);

  // Counters
  const total = PACKS.length;
  const recent = PACKS.filter((p) => p.daysAgo <= 30).length;
  const sealed = PACKS.filter((p) => !p.opened).length;
  const counts = useMemo(() => setCounts(PACKS), []);
  const favorite = counts[0];

  // Featured = most recent
  const featured = useMemo(() => [...PACKS].sort((a, b) => a.daysAgo - b.daysAgo)[0], []);

  // Filter + sort
  const visible = useMemo(() => {
    let list = [...PACKS];
    if (setFilter !== "all") list = list.filter((p) => p.set === setFilter);
    if (status === "opened") list = list.filter((p) => p.opened);
    if (status === "sealed") list = list.filter((p) => !p.opened);
    if (sort === "newest")          list.sort((a, b) => a.daysAgo - b.daysAgo);
    if (sort === "oldest")          list.sort((a, b) => b.daysAgo - a.daysAgo);
    if (sort === "recently-opened") list.sort((a, b) => Number(b.opened) - Number(a.opened) || a.daysAgo - b.daysAgo);
    if (sort === "by-set")          list.sort((a, b) => a.set.localeCompare(b.set) || a.daysAgo - b.daysAgo);
    return list;
  }, [setFilter, status, sort]);

  const SETS_FOR_CHIPS = useMemo(() => ["all", ...SETS], []);

  return (
    <>
      <PageHeader
        title="God Pack Gallery"
        description="Every god pack you've pulled — a trophy case of your luckiest moments."
      />

      {/* Hero counters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total God Packs" value={String(total)}   icon={Sparkle}     tone="warning" />
        <StatCard label="Recent Pulls"    value={String(recent)}  icon={Sparkles}    tone="success" hint="Last 30 days" />
        <StatCard label="Sealed Packs"    value={String(sealed)}  icon={Lock}        tone="primary" />
        <StatCard label="Favorite Set"    value={favorite?.[0] ?? "—"} icon={Star}   hint={favorite ? `${favorite[1]} pulls` : undefined} />
      </div>

      {/* Featured Pull */}
      {featured && (
        <Section title="Featured Pull" className="mt-5">
          <div className="relative overflow-hidden rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/10 via-primary/5 to-transparent">
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="relative">
                <PackArt size="lg" />
                <Badge className="absolute left-3 top-3 border-transparent bg-warning/90 text-[10px] uppercase tracking-wider text-warning-foreground">
                  <Sparkle className="mr-1 h-3 w-3" /> God Pack
                </Badge>
                <div className="absolute right-3 top-3"><StatusBadge opened={featured.opened} /></div>
              </div>
              <div className="flex flex-col justify-center gap-3 p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-warning/90">Latest Pull</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <Layers className="h-3 w-3" /> {featured.set}
                  </span>
                </div>
                <h3 className="font-display text-2xl font-bold tracking-tight">{featured.set}</h3>
                <p className="text-sm text-muted-foreground">
                  Pulled {featured.daysAgo === 0 ? "today" : `${featured.daysAgo} ${featured.daysAgo === 1 ? "day" : "days"} ago`} · {featured.pulledAt}
                </p>
                <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Biggest hit</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-warning" />
                    <span className="font-medium">{featured.highlight}</span>
                  </div>
                </div>
                <div>
                  <Button size="sm" onClick={() => setSelected(featured)} className="gap-1">
                    View Pack <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Sticky filter row */}
      <div className="sticky top-14 z-20 -mx-3 mt-6 border-y border-border/60 bg-background/85 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {SETS_FOR_CHIPS.map((s) => (
              <button
                key={s}
                onClick={() => setSetFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  setFilter === s
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All Sets" : s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-md border border-border bg-card/40 text-xs">
              {(["all", "opened", "sealed"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "px-2.5 py-1 capitalize transition-colors",
                    status === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-md border border-border bg-card/40 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="recently-opened">Sort: Recently Opened</option>
              <option value="by-set">Sort: By Set</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gallery grid */}
      <Section title="Gallery" description={`${visible.length} ${visible.length === 1 ? "pack" : "packs"}`} className="mt-5">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
            <Sparkle className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No god packs match this filter</p>
            <button
              onClick={() => { setSetFilter("all"); setStatus("all"); }}
              className="mt-2 text-xs text-primary hover:underline"
            >Reset filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((p) => <PackTile key={p.id} pack={p} onOpen={setSelected} />)}
          </div>
        )}
      </Section>

      {/* Set Breakdown strip */}
      <section className="mt-6">
        <header className="mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Set Breakdown</h3>
        </header>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {counts.map(([set, n]) => {
            const active = setFilter === set;
            return (
              <button
                key={set}
                onClick={() => setSetFilter(active ? "all" : set)}
                className={cn(
                  "flex min-w-[180px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-card/40 hover:border-border/80",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{set}</div>
                  <div className="text-[10px] text-muted-foreground">{n} {n === 1 ? "pull" : "pulls"}</div>
                </div>
                <div className={cn("h-2 w-2 rounded-full", active ? "bg-primary" : "bg-warning/70")} />
              </button>
            );
          })}
        </div>
      </section>

      {/* Pack Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          {selected && (
            <div>
              <div className="relative">
                <PackArt size="lg" />
                <Badge className="absolute left-3 top-3 border-transparent bg-warning/90 text-[10px] uppercase tracking-wider text-warning-foreground">
                  <Sparkle className="mr-1 h-3 w-3" /> God Pack
                </Badge>
                <div className="absolute right-3 top-3"><StatusBadge opened={selected.opened} /></div>
                <button
                  onClick={() => setSelected(null)}
                  className="absolute right-3 bottom-3 grid h-8 w-8 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pack Detail</div>
                  <h3 className="mt-1 font-display text-xl font-bold tracking-tight">{selected.set}</h3>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Set</dt>
                    <dd className="mt-1 font-medium">{selected.set}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pulled</dt>
                    <dd className="mt-1 font-medium">{selected.pulledAt}</dd>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</dt>
                    <dd className="mt-1"><StatusBadge opened={selected.opened} /></dd>
                  </div>
                  <div className="rounded-lg border border-border bg-card/40 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cards</dt>
                    <dd className="mt-1 font-medium">{selected.cards.length}</dd>
                  </div>
                </dl>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cards Contained</h4>
                    {!selected.opened && (
                      <span className="text-[10px] text-muted-foreground">Sealed — contents hidden</span>
                    )}
                  </div>
                  {selected.opened ? (
                    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {selected.cards.map((c, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 bg-card/40 px-3 py-2.5 text-sm">
                          <span className="truncate font-medium">{c.name}</span>
                          <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", RARITY_TINT[c.rarity])}>
                            {c.rarity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card/30 p-4 text-sm text-muted-foreground">
                      <PackageOpen className="h-5 w-5 text-warning/80" />
                      <div>
                        <div className="font-medium text-foreground">This pack is still sealed</div>
                        <div className="text-xs">Open it in-game to reveal {selected.cards.length} cards.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
