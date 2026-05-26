import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PackageOpen, Sparkles, Heart, Lock, ArrowRight, Trophy,
  Wand2, Crosshair, Check, Star, Layers,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { CardArt } from "@/components/home/CardArt";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { cn } from "@/lib/utils";
import { SETS } from "@/lib/mock-cards";
import {
  PACKS, RECENT_PULLS, getCardById, getQuickStats,
  groupPacksByExpansion, pullImpact, rankedPacks,
  type Pack, type PackScore,
} from "@/lib/mock-open-pack";

type Search = { set?: string };

export const Route = createFileRoute("/open-pack")({
  head: () => ({ meta: [{ title: "Open pack — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    set: typeof s.set === "string" && SETS.some((x) => x.id === s.set) ? s.set : undefined,
  }),
  component: OpenPack,
});

function OpenPack() {
  const { set: deepSet } = Route.useSearch();
  const [openPack, setOpenPack] = useState<Pack | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const ranked = useMemo(() => rankedPacks(deepSet), [deepSet]);
  const recommendation: PackScore = ranked[0];
  const stats = getQuickStats();
  const groups = useMemo(() => groupPacksByExpansion(PACKS), []);

  // Scroll to highlighted expansion when deep-linked
  useEffect(() => {
    if (!deepSet) return;
    const el = groupRefs.current[deepSet];
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [deepSet]);

  return (
    <>
      <PageHeader
        title="Open pack"
        description="Pick the pack that gets you closer to a complete collection — not the prettiest art."
      />

      {/* RECOMMENDATION HERO */}
      <RecommendationHero rec={recommendation} onOpen={() => setOpenPack(recommendation.pack)} />

      {/* QUICK STATS */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Packs available" value={String(stats.available)} icon={PackageOpen} tone="primary" />
        <StatCard label="Opened this week" value={String(stats.openedThisWeek)} tone="default" />
        <StatCard label="Unique cards added" value={String(stats.uniqueAdded)} tone="success" />
        <StatCard label="Wishlist hits" value={String(stats.wishlistHits)} icon={Heart} tone="warning" />
      </div>

      {/* PACK PICKER */}
      <div className="mt-6 space-y-6">
        {groups.map((g) => {
          const isHi = g.expansion === deepSet;
          return (
            <div
              key={g.expansion}
              ref={(el) => { groupRefs.current[g.expansion] = el; }}
              className={cn(
                "rounded-xl border bg-card/60 transition-colors",
                isHi ? "border-primary/60 ring-1 ring-primary/40" : "border-border",
              )}
            >
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display text-sm font-semibold tracking-tight">{g.setName}</h2>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{g.expansion}</Badge>
                  {isHi && (
                    <Badge className="bg-primary/15 text-primary border-transparent text-[10px] uppercase tracking-wider">
                      From My Cards
                    </Badge>
                  )}
                </div>
                <Link
                  to="/tracker"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  View set progress <ArrowRight className="h-3 w-3" />
                </Link>
              </header>
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
                {g.packs.map((p) => (
                  <PackTile key={p.id} pack={p} onOpen={() => setOpenPack(p)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* RECENT PULLS */}
      <Section title="Recent pulls" className="mt-6" description="Last 5 sessions across all packs.">
        <ul className="divide-y divide-border/60">
          {RECENT_PULLS.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.packName}</div>
                <div className="text-[11px] text-muted-foreground">{r.when} · 5 cards</div>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {r.newToCollection > 0 ? (
                  <Badge className="bg-success/15 text-success border-transparent">+{r.newToCollection} new</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">No new cards</Badge>
                )}
                {r.wishlistHits > 0 && (
                  <Badge className="bg-warning/15 text-warning border-transparent inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {r.wishlistHits} wishlist
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* CROSS-LINKS */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/card-request" icon={Crosshair} title="Card request" hint="Ask the community for a specific card." />
        <CrossLink to="/wonder-pick" icon={Wand2} title="Wonder pick" hint="Pick 1 of 5 from someone else's pack." />
        <CrossLink to="/hunt" icon={Star} title="Hunt" hint="Open many packs back-to-back." />
      </div>

      {/* PULL REVEAL */}
      <PullRevealDialog pack={openPack} onClose={() => setOpenPack(null)} />
    </>
  );
}

/* ───────────────────────── components ───────────────────────── */

function RecommendationHero({ rec, onOpen }: { rec: PackScore; onOpen: () => void }) {
  const featured = rec.pack.featuredCardIds.map(getCardById).filter(Boolean);
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-5 ring-1 ring-primary/20">
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Trophy className="h-3 w-3" /> Best pack for you
          </div>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight md:text-2xl">{rec.pack.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rec.setName} · {rec.setCompletion}% complete · {rec.missingInSet} cards left
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rec.reasons.map((r) => (
              <li key={r} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onOpen}>
              <Sparkles className="mr-1 h-4 w-4" /> Open this pack
            </Button>
            <Link to="/tracker">
              <Button size="sm" variant="outline">View set progress</Button>
            </Link>
          </div>
        </div>
        <div className="flex -space-x-3">
          {featured.map((c, i) => (
            <div key={c!.id + i} className="w-20 rotate-[-4deg] transition-transform hover:z-10 hover:rotate-0 md:w-24" style={{ zIndex: 10 - i }}>
              <CardArt name={c!.name} type={c!.type} rarity={c!.rarity as never} set={c!.number} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PackTile({ pack, onOpen }: { pack: Pack; onOpen: () => void }) {
  const featured = pack.featuredCardIds.map(getCardById).filter(Boolean);
  const score = useMemo(() => {
    const all = rankedPacks();
    return all.find((s) => s.pack.id === pack.id)!;
  }, [pack.id]);

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background/60 transition-colors hover:border-primary/50">
      <div className="relative flex items-end gap-2 bg-gradient-to-br from-muted/40 via-card to-card p-4">
        {featured.map((c, i) => (
          <div key={c!.id + i} className="w-1/3">
            <CardArt name={c!.name} type={c!.type} rarity={c!.rarity as never} set={c!.number} />
          </div>
        ))}
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning backdrop-blur">
          <Star className="h-3 w-3 fill-warning" /> {Math.max(1, Math.round(score.score / 12))}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="font-display text-sm font-semibold">{pack.name}</div>
          {pack.odds === "Boosted" && (
            <Badge className="bg-warning/15 text-warning border-transparent text-[10px]">Boosted</Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{pack.cost}</div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
          <Stat label="Missing" value={score.missingInPack} tone={score.missingInPack > 0 ? "warn" : "muted"} />
          <Stat label="Wishlist" value={score.wishlistInPack} tone={score.wishlistInPack > 0 ? "warn" : "muted"} />
          <Stat label="Gain" value={`+${score.completionGain}%`} tone={score.completionGain > 0 ? "good" : "muted"} />
        </dl>

        <Button size="sm" className="mt-3 w-full" onClick={onOpen}>
          <Sparkles className="mr-1 h-4 w-4" /> Open
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "good" | "warn" | "muted" }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-1.5">
      <div className={cn(
        "font-display text-sm font-semibold",
        tone === "good" && "text-success",
        tone === "warn" && "text-warning",
        tone === "muted" && "text-muted-foreground",
      )}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}


function PullRevealDialog({ pack, onClose }: { pack: Pack | null; onClose: () => void }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (pack) setRevealed(new Set());
  }, [pack?.id]);

  if (!pack) return null;
  const cards = pack.pullResultIds.map(getCardById).filter(Boolean);
  const revealedIds = pack.pullResultIds.filter((_, i) => revealed.has(i));
  const impact = pullImpact(revealedIds);
  const allRevealed = revealed.size === cards.length;
  const hasRevealed = revealed.size > 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">{pack.name}</DialogTitle>
          <DialogDescription>
            Tap each card to reveal. Results are mock and deterministic.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {cards.map((c, i) => {
            const isOpen = revealed.has(i);
            return (
              <button
                key={i}
                onClick={() => setRevealed((s) => new Set(s).add(i))}
                className={cn(
                  "relative aspect-[3/4] overflow-hidden rounded-lg transition-transform",
                  !isOpen && "border border-border bg-gradient-to-br from-primary/30 via-card to-card hover:-translate-y-1",
                )}
              >
                {isOpen ? (
                  <div className="relative h-full w-full">
                    <CardArt name={c!.name} type={c!.type} rarity={c!.rarity as never} set={c!.number} />
                    {c!.owned === 0 && (
                      <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-success/90 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        New
                      </span>
                    )}
                    {c!.wishlist && (
                      <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-warning/90 px-1 py-0.5 text-[9px] font-bold text-white">
                        <Heart className="h-2.5 w-2.5 fill-white" />
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center">
                    <Lock className="h-5 w-5 text-primary/70" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Collection impact
            </div>
            {hasRevealed && (
              <div className="text-[10px] text-muted-foreground">
                {revealed.size} of {cards.length} revealed
              </div>
            )}
          </div>
          {hasRevealed ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
              <ImpactStat label="New" value={impact.newToCollection} tone="good" />
              <ImpactStat label="Duplicates" value={impact.duplicates} tone="muted" />
              <ImpactStat label="Wishlist" value={impact.wishlistHits} tone="warn" />
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
              Reveal cards to see collection impact
            </div>
          )}
          {!allRevealed && (
            <div className="mt-3 text-center">
              <Button size="sm" variant="outline" onClick={() => setRevealed(new Set(cards.map((_, i) => i)))}>
                Reveal all
              </Button>
            </div>
          )}
          {allRevealed && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Link to="/cards"><Button size="sm" variant="outline">View My Cards</Button></Link>
              <Button size="sm" onClick={onClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImpactStat({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "muted" }) {
  return (
    <div>
      <div className={cn(
        "font-display text-lg font-bold",
        tone === "good" && "text-success",
        tone === "warn" && "text-warning",
        tone === "muted" && "text-muted-foreground",
      )}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
