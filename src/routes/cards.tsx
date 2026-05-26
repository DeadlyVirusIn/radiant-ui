import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Heart, Lock, Sparkles, Crosshair, Repeat2,
  SlidersHorizontal, LayoutGrid, Rows3, X, ArrowRight,
  Download, Wand2, PackageOpen,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CardArt, type EnergyType } from "@/components/home/CardArt";
import {
  SETS, CARDS, RARITIES, TYPES,
  getSet, getCardByName, getCollectionSummary,
  type Card, type Rarity,
} from "@/lib/mock-cards";

type OwnFilter = "all" | "owned" | "missing" | "duplicates" | "wishlist" | "recent";
type SortKey = "name" | "set" | "rarity" | "dupes" | "recent";
type ViewMode = "grid" | "list";

const OWN_VALUES: OwnFilter[] = ["all","owned","missing","duplicates","wishlist","recent"];

type Search = {
  card?: string;
  set?: string;
  own?: OwnFilter;
};

export const Route = createFileRoute("/cards")({
  head: () => ({ meta: [{ title: "My Cards — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    card: typeof s.card === "string" ? s.card : undefined,
    set: typeof s.set === "string" && SETS.some((x) => x.id === s.set) ? s.set : undefined,
    own: typeof s.own === "string" && (OWN_VALUES as string[]).includes(s.own)
      ? (s.own as OwnFilter) : undefined,
  }),
  component: MyCards,
});

const RARITY_ORDER: Record<Rarity, number> = {
  Common: 0, Uncommon: 1, Rare: 2, EX: 3, "Full Art": 4, Star: 5, Immersive: 6, Crown: 7,
};
const rarityChip: Record<Rarity, string> = {
  Common: "bg-muted text-muted-foreground",
  Uncommon: "bg-muted text-muted-foreground",
  Rare: "bg-sky-500/15 text-sky-300",
  EX: "bg-orange-500/15 text-orange-300",
  "Full Art": "bg-sky-500/15 text-sky-300",
  Star: "bg-amber-400/15 text-amber-300",
  Immersive: "bg-fuchsia-500/15 text-fuchsia-300",
  Crown: "bg-yellow-400/15 text-yellow-300",
};

function MyCards() {
  const { card: deepCard, set: deepSet, own: deepOwn } = Route.useSearch();
  const navigate = useNavigate({ from: "/cards" });

  // Local state — wishlist is mock; toggling shows toast & updates in-memory.
  const [wishlist, setWishlist] = useState<Set<string>>(
    () => new Set(CARDS.filter((c) => c.wishlist).map((c) => c.id)),
  );
  const [owned, setOwned] = useState<Record<string, number>>(
    () => Object.fromEntries(CARDS.map((c) => [c.id, c.owned])),
  );

  const [search, setSearch] = useState("");
  const [activeSet, setActiveSet] = useState<string | "ALL">(deepSet ?? "ALL");
  const [own, setOwn] = useState<OwnFilter>(deepOwn ?? "all");
  const [rarity, setRarity] = useState<Rarity | "ALL">("ALL");
  const [type, setType] = useState<EnergyType | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("set");
  const [view, setView] = useState<ViewMode>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picked, setPicked] = useState<Card | null>(null);

  // Deep-link: open drawer for ?card=
  useEffect(() => {
    if (deepCard) {
      const found = getCardByName(deepCard);
      if (found) setPicked(found);
    }
  }, [deepCard]);

  const summary = useMemo(() => {
    const ownedCount = Object.values(owned).filter((n) => n > 0).length;
    const missing = CARDS.length - ownedCount;
    const duplicates = Object.values(owned).reduce((a, n) => a + Math.max(0, n - 1), 0);
    const completion = Math.round((ownedCount / CARDS.length) * 100);
    return { owned: ownedCount, missing, duplicates, completion, total: CARDS.length };
  }, [owned]);

  const filtered = useMemo(() => {
    const list = CARDS.filter((c) => {
      const n = owned[c.id] ?? 0;
      if (activeSet !== "ALL" && c.set !== activeSet) return false;
      if (rarity !== "ALL" && c.rarity !== rarity) return false;
      if (type !== "ALL" && c.type !== type) return false;
      if (own === "owned" && n <= 0) return false;
      if (own === "missing" && n > 0) return false;
      if (own === "duplicates" && n < 2) return false;
      if (own === "wishlist" && !wishlist.has(c.id)) return false;
      if (own === "recent" && !c.acquiredAt) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.number.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case "name": return a.name.localeCompare(b.name);
        case "rarity": return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        case "dupes": return (owned[b.id] ?? 0) - (owned[a.id] ?? 0);
        case "recent": {
          const da = a.acquiredAt ?? "";
          const db = b.acquiredAt ?? "";
          return db.localeCompare(da);
        }
        case "set":
        default:
          return a.set === b.set ? a.numberIndex - b.numberIndex : a.set.localeCompare(b.set);
      }
    });
    return list;
  }, [activeSet, rarity, type, own, search, sort, owned, wishlist]);

  // Sync own filter into URL (preserve other params)
  useEffect(() => {
    navigate({
      search: (prev: Search) => ({
        ...prev,
        own: own === "all" ? undefined : own,
        set: activeSet === "ALL" ? undefined : activeSet,
      }),
      replace: true,
    });
  }, [own, activeSet, navigate]);

  const toggleWishlist = (c: Card) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) { next.delete(c.id); toast(`${c.name} removed from wishlist`); }
      else                { next.add(c.id);    toast(`${c.name} added to wishlist`); }
      return next;
    });
  };
  const adjust = (c: Card, delta: number) => {
    setOwned((prev) => ({ ...prev, [c.id]: Math.max(0, (prev[c.id] ?? 0) + delta) }));
  };

  const handleExport = () => {
    const rows = [
      ["id","name","set","number","rarity","type","owned","wishlist"],
      ...CARDS.map((c) => [
        c.id, c.name, c.set, c.number, c.rarity, c.type,
        String(owned[c.id] ?? 0),
        wishlist.has(c.id) ? "yes" : "no",
      ]),
    ];
    const csv = rows.map((r) =>
      r.map((v) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "my-cards.csv"; document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
    toast("Exported my-cards.csv");
  };

  return (
    <div className="relative">
      <PageHeader
        title="My Cards"
        description="Your complete binder and collection."
        actions={
          <>
            <div className="hidden rounded-md border border-border bg-card/40 p-0.5 md:flex">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm"
                className="h-7 px-2" onClick={() => setView("grid")}
                aria-label="Grid view">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="sm"
                className="h-7 px-2" onClick={() => setView("list")}
                aria-label="List view">
                <Rows3 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      {/* ── Summary strip ─────────────────────────────────────────────── */}
      <section className="mt-1 rounded-xl border border-border bg-card/60 p-3 md:p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryStat label="Complete" value={`${summary.completion}%`} tone="primary" />
          <SummaryStat label="Owned" value={summary.owned} tone="success" />
          <SummaryStat label="Missing" value={summary.missing} tone="warning" />
          <SummaryStat label="Duplicates" value={summary.duplicates} tone="muted" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60"
              style={{ width: `${summary.completion}%` }}
            />
          </div>
          <Link
            to="/tracker"
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            View Progress <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* ── Sticky binder controls ───────────────────────────────────── */}
      <div className="sticky top-12 z-20 -mx-4 mt-4 border-y border-border bg-background/85 px-4 backdrop-blur md:-mx-6 md:px-6">
        {/* set chips */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto pt-3 pb-2">
          {(["ALL", ...SETS.map((s) => s.id)] as const).map((id) => {
            const s = id === "ALL" ? null : getSet(id)!;
            const active = activeSet === id;
            const setOwned = s
              ? CARDS.filter((c) => c.set === s.id && (owned[c.id] ?? 0) > 0).length
              : summary.owned;
            const setTotal = s ? CARDS.filter((c) => c.set === s.id).length : CARDS.length;
            return (
              <button
                key={id}
                onClick={() => setActiveSet(id as string)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/60 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {s ? s.short : "All"}
                <span className="ml-1.5 text-[10px] opacity-70">{setOwned}/{setTotal}</span>
              </button>
            );
          })}
        </div>

        {/* ownership chips */}
        <div className="flex flex-wrap gap-1.5 pb-2">
          {([
            ["all","All"], ["owned","Owned"], ["missing","Missing"],
            ["duplicates","Duplicates"], ["wishlist","Wishlist"], ["recent","Recent"],
          ] as Array<[OwnFilter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOwn(key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                own === key
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* search + sort + filters + view */}
        <div className="flex items-center gap-2 pb-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cards or number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-background/40 pl-8"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="hidden h-9 w-[160px] bg-background/40 sm:flex">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set">Set order</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="rarity">Rarity</SelectItem>
              <SelectItem value="dupes">Duplicates ↓</SelectItem>
              <SelectItem value="recent">Recently acquired</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {(rarity !== "ALL" || type !== "ALL") && (
              <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {(rarity !== "ALL" ? 1 : 0) + (type !== "ALL" ? 1 : 0)}
              </span>
            )}
          </Button>
          <div className="flex rounded-md border border-border bg-card/40 p-0.5 md:hidden">
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm"
              className="h-7 px-2" onClick={() => setView("grid")}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm"
              className="h-7 px-2" onClick={() => setView("list")}>
              <Rows3 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Grid / List ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyBinder onClear={() => { setSearch(""); setOwn("all"); setRarity("ALL"); setType("ALL"); }} />
      ) : view === "grid" ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((c) => {
            const n = owned[c.id] ?? 0;
            const wl = wishlist.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setPicked(c)}
                className={cn(
                  "group relative text-left transition-all hover:-translate-y-1",
                  n <= 0 && "opacity-80",
                )}
              >
                <CardArt name={c.name} type={c.type} rarity={c.rarity} set={getSet(c.set)?.short} />

                {/* Owned badge */}
                {n > 0 && (
                  <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-success-foreground shadow-md ring-1 ring-success-foreground/20">
                    ×{n}
                  </span>
                )}
                {/* Missing overlay tag */}
                {n <= 0 && (
                  <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-warning/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground shadow-md">
                    <Lock className="h-2.5 w-2.5" /> Missing
                  </span>
                )}
                {/* Duplicates ribbon */}
                {n >= 2 && (
                  <span className="absolute bottom-12 left-1.5 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                    +{n - 1} spare
                  </span>
                )}
                {/* Wishlist heart */}
                {wl && (
                  <span className="absolute -left-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-rose-500/95 text-white shadow-lg ring-2 ring-background">
                    <Heart className="h-3 w-3 fill-current" />
                  </span>
                )}
              </button>
            );
          })}
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-card/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2.5">Card</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Set</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Rarity</th>
                <th className="px-4 py-2.5 text-right">Owned</th>
                <th className="px-4 py-2.5 text-right hidden md:table-cell">Acquired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const n = owned[c.id] ?? 0;
                return (
                  <tr key={c.id} onClick={() => setPicked(c)} className="cursor-pointer hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-8 shrink-0">
                          <CardArt name={c.name} type={c.type} rarity={c.rarity} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold flex items-center gap-1.5">
                            {c.name}
                            {wishlist.has(c.id) && <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />}
                          </div>
                          <div className="text-mono text-[11px] text-muted-foreground">{c.number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {getSet(c.set)?.name}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", rarityChip[c.rarity])}>
                        {c.rarity}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {n > 0
                        ? <span className="text-mono text-success">×{n}</span>
                        : <span className="text-mono text-warning">missing</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground hidden md:table-cell">
                      {c.acquiredAt ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Showing <span className="text-mono text-foreground">{filtered.length}</span> of {CARDS.length} cards
      </p>

      {/* ── Filter sheet ─────────────────────────────────────────────── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[300px] bg-background p-0 sm:w-[340px]">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-display text-base font-bold">Filter binder</h3>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
              onClick={() => { setRarity("ALL"); setType("ALL"); }}>
              Reset
            </Button>
          </div>
          <div className="space-y-5 p-4">
            <FilterGroup label="Rarity">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={rarity === "ALL"} onClick={() => setRarity("ALL")}>All</FilterChip>
                {RARITIES.map((r) => (
                  <FilterChip key={r} active={rarity === r} onClick={() => setRarity(r)} className={rarityChip[r]}>
                    {r}
                  </FilterChip>
                ))}
              </div>
            </FilterGroup>
            <FilterGroup label="Energy">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={type === "ALL"} onClick={() => setType("ALL")}>All</FilterChip>
                {TYPES.map((t) => (
                  <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                    <span className="capitalize">{t}</span>
                  </FilterChip>
                ))}
              </div>
            </FilterGroup>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Detail drawer ────────────────────────────────────────────── */}
      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-[440px]">
          {picked && (
            <CardDetail
              card={picked}
              ownedCount={owned[picked.id] ?? 0}
              wishlisted={wishlist.has(picked.id)}
              onClose={() => setPicked(null)}
              onToggleWishlist={() => toggleWishlist(picked)}
              onInc={() => adjust(picked, 1)}
              onDec={() => adjust(picked, -1)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function SummaryStat({
  label, value, tone,
}: { label: string; value: string | number; tone: "primary" | "success" | "warning" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-success"
    : tone === "warning" ? "text-warning"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 font-display text-2xl font-bold tabular-nums", toneCls)}>{value}</div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
function FilterChip({
  children, active, onClick, className,
}: { children: React.ReactNode; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
        !active && className,
      )}
    >
      {children}
    </button>
  );
}

function EmptyBinder({ onClear }: { onClear: () => void }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 font-display text-sm font-bold">No cards match those filters</p>
      <p className="mt-1 text-xs text-muted-foreground">Try clearing filters or switching set.</p>
      <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onClear}>Clear filters</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CardDetail({
  card, ownedCount, wishlisted, onClose, onToggleWishlist, onInc, onDec,
}: {
  card: Card; ownedCount: number; wishlisted: boolean;
  onClose: () => void; onToggleWishlist: () => void;
  onInc: () => void; onDec: () => void;
}) {
  const set = getSet(card.set)!;
  const isOwned = ownedCount > 0;
  const spares = Math.max(0, ownedCount - 1);
  const cardParam = encodeURIComponent(card.name);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider", rarityChip[card.rarity])}>
            {card.rarity}
          </Badge>
          <span className="text-mono text-[11px] text-muted-foreground">{card.number}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-6 pt-5">
        <div className="mx-auto w-[220px]">
          <CardArt name={card.name} type={card.type} rarity={card.rarity} set={set.short} />
        </div>
      </div>

      <div className="px-5 pt-4">
        <h2 className="font-display text-xl font-bold tracking-tight">{card.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {set.name} · <span className="capitalize">{card.type}</span>
        </p>

        <div className={cn(
          "mt-4 rounded-lg border p-3",
          isOwned ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10",
        )}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.16em]",
                isOwned ? "text-success" : "text-warning",
              )}>
                {isOwned ? "Owned" : "Missing"}
              </div>
              <div className="mt-0.5 font-display text-base font-bold">
                {isOwned ? `Owned ×${ownedCount}` : "Not in your binder yet"}
              </div>
              {isOwned && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Spare copies: <span className="text-mono">{spares}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={onDec} aria-label="Decrease">−</Button>
              <span className="w-6 text-center text-mono text-sm font-bold">{ownedCount}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={onInc} aria-label="Increase">+</Button>
            </div>
          </div>
        </div>

        {spares >= 1 && (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Duplicate leverage</div>
            <p className="mt-0.5 text-sm">You have <span className="text-mono font-bold">{spares}</span> spare {spares === 1 ? "copy" : "copies"}.</p>
            <Link
              to="/card-request" search={{ card: card.name }}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              Request trades <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Acquisition paths */}
      <div className="mt-5 px-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          How can I get it
        </div>
        <div className="space-y-1.5">
          <AcquireLink
            href={`/open-pack?set=${set.id}`}
            icon={<PackageOpen className="h-3.5 w-3.5" />}
            label={`Open ${set.name}`}
            value={card.pullOdds ? `${card.pullOdds} per pack` : "Pull source"}
            tone="primary"
          />
          <AcquireLink
            href={`/card-request?card=${cardParam}`}
            icon={<Repeat2 className="h-3.5 w-3.5" />}
            label="Request a trade"
            value="Browse partners"
            tone="success"
          />
          <AcquireLink
            href={`/hunt?card=${cardParam}`}
            icon={<Crosshair className="h-3.5 w-3.5" />}
            label="Join a hunt"
            value="Community sessions"
            tone="warning"
          />
          <AcquireLink
            href={`/wonder-pick?card=${cardParam}`}
            icon={<Wand2 className="h-3.5 w-3.5" />}
            label="Wonder Pick"
            value="Pick from recent pulls"
            tone="muted"
          />
        </div>
      </div>

      {/* Sticky actions: wishlist toggle + manage in wishlist link */}
      <div className="sticky bottom-0 mt-5 grid grid-cols-2 gap-2 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button
          variant={wishlisted ? "secondary" : "outline"}
          size="sm" className="h-9 gap-1.5"
          onClick={onToggleWishlist}
        >
          <Heart className={cn("h-3.5 w-3.5", wishlisted && "fill-rose-400 text-rose-400")} />
          {wishlisted ? "Wishlisted" : "Add to wishlist"}
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
          <Link to="/wishlist">
            Manage in Wishlist <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AcquireLink({
  href, icon, label, value, tone,
}: { href: string; icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "warning" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-success bg-success/10 border-success/20"
    : tone === "warning" ? "text-warning bg-warning/10 border-warning/20"
    : tone === "primary" ? "text-primary bg-primary/10 border-primary/20"
    : "text-muted-foreground bg-muted/40 border-border";
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-md border border-border bg-card/40 px-3 py-2 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid h-6 w-6 place-items-center rounded-md border", toneCls)}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="inline-flex items-center gap-1 text-mono text-[11px] text-muted-foreground">
        {value} <ArrowRight className="h-3 w-3" />
      </span>
    </a>
  );
}
