import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Trophy, Sparkles, Repeat2, Gift, Calendar, Layers, Target,
  CheckCircle2, ChevronRight, ChevronDown, Flame, Swords, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collection-missions")({
  head: () => ({ meta: [{ title: "Collection Goals — Radiant" }] }),
  component: CollectionGoals,
});

// ─── Types & Mock Data ──────────────────────────────────────────────────
type CategoryId =
  | "set" | "rarity" | "trade" | "gift" | "weekly" | "other";

type GoalLink = { label: string; to: string };
type Goal = {
  id: string;
  title: string;
  context?: string;     // "2 cards remaining" / "3 days left"
  category: CategoryId;
  progress: number;
  total: number;
  reward: string;
  links?: GoalLink[];   // navigation only — existing routes
};

const CATS: Record<CategoryId, { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  set:    { label: "Set Completion",     icon: Layers,   tint: "text-sky-300 bg-sky-500/10 border-sky-400/20" },
  rarity: { label: "Rarity Milestones",  icon: Sparkles, tint: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/20" },
  trade:  { label: "Trade Goals",        icon: Repeat2,  tint: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20" },
  gift:   { label: "Gift Goals",         icon: Gift,     tint: "text-rose-300 bg-rose-500/10 border-rose-400/20" },
  weekly: { label: "Weekly Goals",       icon: Calendar, tint: "text-amber-300 bg-amber-500/10 border-amber-400/20" },
  other:  { label: "Other Goals",        icon: Swords,   tint: "text-slate-300 bg-slate-500/10 border-slate-400/20" },
};

const GOALS: Goal[] = [
  // Set completion
  { id: "g1", title: "Complete Genesis Echo (rare)", context: "2 cards remaining", category: "set",
    progress: 22, total: 24, reward: "+24 hourglasses",
    links: [{ label: "View Set Progress", to: "/tracker" }, { label: "Open Wishlist", to: "/wishlist" }] },
  { id: "g2", title: "Complete Mythical Island base set", context: "9 cards remaining", category: "set",
    progress: 51, total: 60, reward: "+1 premier ticket",
    links: [{ label: "View Set Progress", to: "/tracker" }, { label: "Open Wishlist", to: "/wishlist" }] },
  { id: "g3", title: "Complete Charizard EX subset", context: "Finished", category: "set",
    progress: 6, total: 6, reward: "+200 shine dust",
    links: [{ label: "View Set Progress", to: "/tracker" }] },

  // Rarity milestones
  { id: "g4", title: "Collect 50 holos", context: "4 holos to go", category: "rarity",
    progress: 46, total: 50, reward: "+1 premier ticket",
    links: [{ label: "Browse Cards", to: "/cards" }] },
  { id: "g5", title: "Pull 5 Immersive cards", context: "Almost there", category: "rarity",
    progress: 4, total: 5, reward: "+150 shine dust",
    links: [{ label: "Browse Cards", to: "/cards" }] },
  { id: "g6", title: "Own one Crown rare", context: "Chase the crown", category: "rarity",
    progress: 0, total: 1, reward: "+1 wonder pick",
    links: [{ label: "Open Wishlist", to: "/wishlist" }] },

  // Trade goals
  { id: "g7", title: "Trade 5 gold flair items", context: "2 trades to go", category: "trade",
    progress: 3, total: 5, reward: "+200 shine dust",
    links: [{ label: "Continue in Trades", to: "/trades" }] },
  { id: "g8", title: "Complete 20 lifetime trades", context: "Steady progress", category: "trade",
    progress: 14, total: 20, reward: "+1 premier ticket",
    links: [{ label: "Continue in Trades", to: "/trades" }] },

  // Gift goals
  { id: "g9", title: "Gift a card to 10 friends", context: "3 gifts to go", category: "gift",
    progress: 7, total: 10, reward: "+50 coins",
    links: [{ label: "Continue in Gifts", to: "/gifts" }] },
  { id: "g10", title: "Receive 5 community gifts", context: "Almost there", category: "gift",
    progress: 4, total: 5, reward: "+25 coins",
    links: [{ label: "Continue in Gifts", to: "/gifts" }] },

  // Weekly
  { id: "g11", title: "Open 50 packs this week", context: "3 days left · 50/50", category: "weekly",
    progress: 50, total: 50, reward: "+1 premier ticket",
    links: [{ label: "Open Packs", to: "/open-pack" }] },
  { id: "g12", title: "Log 5 trades this week", context: "3 days left", category: "weekly",
    progress: 2, total: 5, reward: "+30 hourglasses",
    links: [{ label: "Continue in Trades", to: "/trades" }] },

  // Other (rank / battle-style, deprioritised)
  { id: "g13", title: "Reach battle rank Gold I", context: "Season goal", category: "other",
    progress: 100, total: 100, reward: "+1 wonder pick" },
  { id: "g14", title: "Win 25 battles this season", context: "Season goal", category: "other",
    progress: 11, total: 25, reward: "+15 hourglasses" },
];

const RECENTLY_COMPLETED = [
  { id: "rc1", title: "Open 50 packs this week", reward: "+1 premier ticket", category: "weekly" as CategoryId },
  { id: "rc2", title: "Charizard EX subset", reward: "+200 shine dust", category: "set" as CategoryId },
  { id: "rc3", title: "Reach battle rank Gold I", reward: "+1 wonder pick", category: "other" as CategoryId },
];

// ─── Helpers ────────────────────────────────────────────────────────────
const pct = (g: Goal) => Math.round((g.progress / g.total) * 100);
const isDone = (g: Goal) => g.progress >= g.total;
const isAlmost = (g: Goal) => !isDone(g) && pct(g) >= 75;

function statusOf(g: Goal): "completed" | "almost" | "active" {
  if (isDone(g)) return "completed";
  if (isAlmost(g)) return "almost";
  return "active";
}

// ─── Sub-components ─────────────────────────────────────────────────────
function ProgressBar({ value, tone }: { value: number; tone: "primary" | "amber" | "success" }) {
  const cls = tone === "success" ? "bg-success"
    : tone === "amber" ? "bg-amber-400"
    : "bg-primary";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", cls)} style={{ width: `${value}%` }} />
    </div>
  );
}

function CategoryChip({ category }: { category: CategoryId }) {
  const c = CATS[category];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", c.tint)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function StatusChip({ status }: { status: "completed" | "almost" | "active" }) {
  if (status === "completed") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
      <CheckCircle2 className="h-3 w-3" /> Reward ready
    </span>
  );
  if (status === "almost") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
      <Flame className="h-3 w-3" /> Almost done
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      In progress
    </span>
  );
}

function GoalCard({ g, compact = false }: { g: Goal; compact?: boolean }) {
  const status = statusOf(g);
  const tone = status === "completed" ? "success" : status === "almost" ? "amber" : "primary";
  const Icon = CATS[g.category].icon;
  const primary = g.links?.[0];
  const cta = status === "completed" ? "View Progress" : "Continue";

  return (
    <div className={cn(
      "rounded-xl border bg-card/40 p-3 transition-colors",
      status === "completed" ? "border-success/20" :
      status === "almost"    ? "border-amber-400/30 bg-amber-400/[0.03]" :
                               "border-border hover:border-border/80",
      compact && "p-2.5",
    )}>
      <div className="flex items-start gap-2.5">

        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          CATS[g.category].tint,
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{g.title}</div>
              {g.context && (
                <div className="mt-0.5 text-xs text-muted-foreground">{g.context}</div>
              )}
            </div>
            <StatusChip status={status} />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={pct(g)} tone={tone} />
            <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {g.progress}/{g.total} · {pct(g)}%
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryChip category={g.category} />
              <Badge variant="outline" className="border-transparent bg-muted/60 text-[10px] font-normal text-muted-foreground">
                Reward · {g.reward}
              </Badge>
            </div>
            {primary && (
              <Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary hover:bg-primary/10">
                <Link to={primary.to}>
                  {cta} <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NextBestCard({ g }: { g: Goal }) {
  const Icon = CATS[g.category].icon;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">Next Best Goal</span>
            <CategoryChip category={g.category} />
          </div>
          <h3 className="mt-1 text-lg font-semibold">{g.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            You're {g.total - g.progress} {g.total - g.progress === 1 ? "move" : "moves"} away — {g.context ?? "closest to finish"}.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={pct(g)} tone="amber" />
            <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {g.progress}/{g.total} · {pct(g)}%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
          {g.links?.map((l) => (
            <Button key={l.to} asChild size="sm" variant={l === g.links?.[0] ? "default" : "outline"}>
              <Link to={l.to}>{l.label} <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────
const CATEGORY_FILTERS: { id: CategoryId | "all"; label: string }[] = [
  { id: "all",    label: "All" },
  { id: "set",    label: "Set Completion" },
  { id: "rarity", label: "Rarity Milestones" },
  { id: "trade",  label: "Trade Goals" },
  { id: "gift",   label: "Gift Goals" },
  { id: "weekly", label: "Weekly Goals" },
];

type SortKey = "closest" | "highest" | "newest";

function CollectionGoals() {
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const [sort, setSort] = useState<SortKey>("closest");
  const [showCompleted, setShowCompleted] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);

  // Hero counters
  const active = GOALS.filter((g) => !isDone(g)).length;
  const almost = GOALS.filter(isAlmost).length;
  const ready  = GOALS.filter(isDone).length;
  const completedLifetime = ready + RECENTLY_COMPLETED.length;

  // Almost-done strip
  const almostDone = useMemo(
    () => GOALS.filter(isAlmost).sort((a, b) => pct(b) - pct(a)).slice(0, 6),
    [],
  );

  // Next best goal — highest % among non-completed, non-Other
  const nextBest = useMemo(() => {
    const pool = GOALS.filter((g) => !isDone(g) && g.category !== "other");
    return pool.sort((a, b) => pct(b) - pct(a))[0];
  }, []);

  // Grouped goals (excluding Other)
  const visibleGroups = useMemo(() => {
    const groups: { id: CategoryId; goals: Goal[] }[] = [];
    const order: CategoryId[] = ["set", "rarity", "trade", "gift", "weekly"];
    for (const cat of order) {
      if (filter !== "all" && filter !== cat) continue;
      let items = GOALS.filter((g) => g.category === cat);
      if (!showCompleted) items = items.filter((g) => !isDone(g));
      if (sort === "closest") items.sort((a, b) => (isDone(a) ? 1 : 0) - (isDone(b) ? 1 : 0) || (b.total - b.progress) - (a.total - a.progress));
      if (sort === "highest") items.sort((a, b) => pct(b) - pct(a));
      if (sort === "newest")  items.reverse();
      if (items.length) groups.push({ id: cat, goals: items });
    }
    return groups;
  }, [filter, sort, showCompleted]);

  const otherGoals = GOALS.filter((g) => g.category === "other");

  const isEmpty = visibleGroups.length === 0;

  return (
    <>
      <PageHeader
        title="Collection Goals"
        description="Long-running goals across your whole collection. Pick what to push on next."
      />

      {/* Hero counters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active Goals"  value={String(active)} icon={Target} tone="primary" />
        <StatCard label="Almost Done"   value={String(almost)} icon={Flame}  tone="warning" />
        <StatCard label="Rewards Ready" value={String(ready)}  icon={Trophy} tone="success" />
        <StatCard label="Completed"     value={String(completedLifetime)} icon={CheckCircle2} />
      </div>

      {/* Next Best Goal */}
      {nextBest && (
        <Section title="Next Best Goal" className="mt-6">
          <NextBestCard g={nextBest} />
        </Section>
      )}

      {/* Almost Done strip */}
      {almostDone.length > 0 && (
        <Section
          title="Almost Done"
          description="Goals within reach — finish these first."
          className="mt-6"
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {almostDone.map((g) => <GoalCard key={g.id} g={g} compact />)}
          </div>
        </Section>
      )}

      {/* Sticky filter row */}
      <div className="sticky top-14 z-20 -mx-3 mt-8 border-y border-border/60 bg-background/85 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === f.id
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Show completed
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-md border border-border bg-card/40 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="closest">Sort: Closest to Finish</option>
              <option value="highest">Sort: Highest Completion</option>
              <option value="newest">Sort: Recently Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* All goals grouped */}
      <div className="mt-6 space-y-8">
        {visibleGroups.map((group) => {
          const c = CATS[group.id];
          const Icon = c.icon;
          return (
            <section key={group.id}>
              <header className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</h3>
                <span className="text-xs text-muted-foreground/70">· {group.goals.length}</span>
              </header>
              <div className="grid gap-3 md:grid-cols-2">
                {group.goals.map((g) => <GoalCard key={g.id} g={g} />)}
              </div>
            </section>
          );
        })}

        {isEmpty && (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center">
            <Trophy className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No goals match this filter</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different category or enable completed goals.
            </p>
          </div>
        )}
      </div>

      {/* Other Goals (collapsed) */}
      {otherGoals.length > 0 && (
        <section className="mt-8 rounded-xl border border-border bg-card/30">
          <button
            onClick={() => setOtherOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm"
          >
            {otherOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Swords className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Other Goals</span>
            <span className="text-xs text-muted-foreground">· rank & battle-style ({otherGoals.length})</span>
          </button>
          {otherOpen && (
            <div className="grid gap-3 border-t border-border p-4 md:grid-cols-2">
              {otherGoals.map((g) => <GoalCard key={g.id} g={g} />)}
            </div>
          )}
        </section>
      )}

      {/* Recently completed — compact strip */}
      {RECENTLY_COMPLETED.length > 0 && (
        <section className="mt-8">
          <header className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recently Completed</h3>
          </header>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {RECENTLY_COMPLETED.map((r) => {
              const Icon = CATS[r.category].icon;
              return (
                <div key={r.id} className="flex min-w-[240px] items-center gap-3 rounded-lg border border-success/20 bg-success/[0.04] px-3 py-2">
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-md border", CATS[r.category].tint)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{r.title}</div>
                    <div className="truncate text-[10px] text-muted-foreground">Reward · {r.reward}</div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
