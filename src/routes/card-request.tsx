import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight, CheckCircle2, Coins, Filter, HelpCircle, Info, Loader2,
  Plus, Repeat2, RotateCcw, Search, Sparkles, X, XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CardArt } from "@/components/home/CardArt";
import {
  MOCK_CARD_REQUESTS, MOCK_USER_REQUESTS, MARKETPLACE_PACKS, MARKETPLACE_RARITIES,
  USER_REQUEST_STATUS_META, PENDING_REQUEST_CAP,
  type CardRequest, type CardRequestAvailability, type MarketplaceRarity, type UserCardRequest,
} from "@/lib/mock-card-requests";

type Search = { card?: string };

export const Route = createFileRoute("/card-request")({
  head: () => ({ meta: [{ title: "Card requests — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    card: typeof s.card === "string" ? s.card : undefined,
  }),
  component: CardRequestPage,
});

const availabilityMeta: Record<CardRequestAvailability, { label: string; cls: string; disabled: boolean }> = {
  available: { label: "Available", cls: "bg-success/15 text-success border-success/30", disabled: false },
  limited:   { label: "Limited",   cls: "bg-warning/15 text-warning border-warning/30", disabled: false },
  sold_out:  { label: "Sold out",  cls: "bg-muted text-muted-foreground border-border", disabled: true  },
};

function CardRequestPage() {
  const { card: deepLinkCard } = Route.useSearch();
  const navigate = useNavigate({ from: "/card-request" });

  // Filters
  const [pack, setPack] = useState<string | "all">("all");
  const [rarity, setRarity] = useState<MarketplaceRarity | "all">("all");
  const [type, setType] = useState<"all" | "regular" | "premium">("all");
  const [query, setQuery] = useState("");

  // User requests — local state so cancel/again/confirm are not no-ops.
  const [userRequests, setUserRequests] = useState<UserCardRequest[]>(MOCK_USER_REQUESTS);

  // Confirmation dialog
  const [tradeTarget, setTradeTarget] = useState<CardRequest | null>(null);

  // Deep-link highlight (scroll + pulse ~5s + "Showing:" pill, NO auto-open)
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [highlightName, setHighlightName] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    if (!deepLinkCard) return;
    const match = MOCK_CARD_REQUESTS.find(
      (c) => c.card.name.toLowerCase() === deepLinkCard.toLowerCase(),
    );
    if (!match) return;
    setHighlightId(match.id);
    setHighlightName(match.card.name);
    requestAnimationFrame(() => {
      cardRefs.current.get(match.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = setTimeout(() => setHighlightId(null), 5000);
    return () => clearTimeout(t);
  }, [deepLinkCard]);

  const clearDeepLink = () => {
    setHighlightId(null);
    setHighlightName(null);
    navigate({ search: {}, replace: true });
  };

  const filtered = useMemo(() => {
    return MOCK_CARD_REQUESTS.filter((c) => {
      if (pack !== "all" && c.card.pack !== pack) return false;
      if (rarity !== "all" && c.card.rarity !== rarity) return false;
      if (type === "premium" && !["Crown", "Immersive", "Star", "Full Art"].includes(c.card.rarity)) return false;
      if (type === "regular" && !["EX"].includes(c.card.rarity)) return false;
      if (query && !c.card.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [pack, rarity, type, query]);

  // Metrics — derived from local state
  const stats = useMemo(() => {
    const m: Record<string, number> = { total: userRequests.length, pending: 0, completed: 0, failed: 0 };
    for (const r of userRequests) {
      const meta = USER_REQUEST_STATUS_META[r.status];
      if (!meta.terminal) m.pending += 1;
      else if (r.status === "completed") m.completed += 1;
      else if (r.status === "failed") m.failed += 1;
    }
    return m;
  }, [userRequests]);

  const atCap = stats.pending >= PENDING_REQUEST_CAP;
  const capCopy = `${stats.pending}/${PENDING_REQUEST_CAP} request cap reached — cancel or complete a request first.`;

  const handleCancel = (id: string) => {
    setUserRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: "cancelled" as const } : r)));
    toast.success("Request cancelled", { description: "Demo mock — no real trade was affected." });
  };

  const handleAgain = (id: string) => {
    if (atCap) {
      toast.error("Can't requeue", { description: capCopy });
      return;
    }
    setUserRequests((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, status: "matching" as const, createdAt: Date.now(), ageLabel: "just now" }
          : r,
      ),
    );
    toast.success("Request requeued", { description: "Looking for a matching partner." });
  };

  const handleConfirm = (req: CardRequest) => {
    if (atCap) {
      toast.error("Request cap reached", { description: capCopy });
      return;
    }
    const newReq: UserCardRequest = {
      id: `UR-${Math.random().toString(36).slice(2, 7)}`,
      card: req.card,
      cost: req.cost,
      status: "matching",
      createdAt: Date.now(),
      ageLabel: "just now",
    };
    setUserRequests((rs) => [newReq, ...rs]);
    setTradeTarget(null);
    toast.success(`Requested ${req.card.name}`, {
      description: `Bright Sand ${req.cost.toLocaleString()} will be spent on completion.`,
    });
  };

  const handleNewRequest = () => {
    if (atCap) {
      toast.error("Request cap reached", { description: capCopy });
      return;
    }
    toast("Pick a card below", { description: "Use the marketplace grid to start a new request." });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <PageHeader
        title="Card requests"
        description="Spend Bright Sand to request cards from the community. Trade matches handled automatically."
        actions={
          atCap ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Span wrapper so tooltip works on disabled button */}
                <span tabIndex={0} className="inline-flex">
                  <Button size="sm" className="gap-1.5 pointer-events-none opacity-60" disabled>
                    <Plus className="h-3.5 w-3.5" />
                    New request · {stats.pending}/{PENDING_REQUEST_CAP}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{capCopy}</TooltipContent>
            </Tooltip>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={handleNewRequest}>
              <Plus className="h-3.5 w-3.5" />
              New request
            </Button>
          )
        }
      />

      {/* Deep-link pill */}
      {highlightName && (
        <div className="mb-3 flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary w-fit">
          <Sparkles className="h-3 w-3" />
          <span className="font-semibold">Showing:</span>
          <span>{highlightName}</span>
          <button
            type="button"
            onClick={clearDeepLink}
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
            aria-label="Clear deep link"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Metrics strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile label="Total" value={stats.total} icon={<Sparkles className="h-3.5 w-3.5" />} />
        <MetricTile label="Pending" value={`${stats.pending}/${PENDING_REQUEST_CAP}`} icon={<Loader2 className="h-3.5 w-3.5" />} tone={atCap ? "warning" : "info"} />
        <MetricTile label="Completed" value={stats.completed} icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="success" />
        <MetricTile label="Failed" value={stats.failed} icon={<XCircle className="h-3.5 w-3.5" />} tone="danger" />
      </div>

      {/* Your Requests — ABOVE marketplace (blueprint mod #1) */}
      <YourRequestsPanel requests={userRequests} onCancel={handleCancel} onAgain={handleAgain} />

      {/* How it works */}
      <HowItWorks />

      {/* Filters */}
      <Section
        title="Marketplace"
        description={`${filtered.length} card${filtered.length === 1 ? "" : "s"} available`}
        className="mt-4"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search card…"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
        }
      >
        <div className="mb-4 space-y-2.5">
          <FilterRow label="Pack">
            <Chip active={pack === "all"} onClick={() => setPack("all")}>All</Chip>
            {MARKETPLACE_PACKS.map((p) => (
              <Chip key={p} active={pack === p} onClick={() => setPack(p)}>{p}</Chip>
            ))}
          </FilterRow>
          <FilterRow label="Type">
            <Chip active={type === "all"} onClick={() => setType("all")}>All</Chip>
            <Chip active={type === "regular"} onClick={() => setType("regular")}>Regular</Chip>
            <Chip active={type === "premium"} onClick={() => setType("premium")}>Premium</Chip>
          </FilterRow>
          <FilterRow label="Rarity">
            <Chip active={rarity === "all"} onClick={() => setRarity("all")}>All</Chip>
            {MARKETPLACE_RARITIES.map((r) => (
              <Chip key={r} active={rarity === r} onClick={() => setRarity(r)}>{r}</Chip>
            ))}
          </FilterRow>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/40 py-10 text-center">
            <Filter className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">No cards match these filters</p>
            <p className="mt-1 text-xs text-muted-foreground">Try clearing a filter or search above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((r) => (
              <MarketplaceCard
                key={r.id}
                request={r}
                highlighted={highlightId === r.id}
                onTrade={() => setTradeTarget(r)}
                refCallback={(el) => cardRefs.current.set(r.id, el)}
              />
            ))}
          </div>
        )}
      </Section>

      <TradeConfirmDialog
        request={tradeTarget}
        onOpenChange={(open) => { if (!open) setTradeTarget(null); }}
        atCap={atCap}
        onConfirm={handleConfirm}
      />
    </TooltipProvider>
  );
}

// ── Marketplace card ────────────────────────────────────────────────────────

function MarketplaceCard({
  request: r, highlighted, onTrade, refCallback,
}: {
  request: CardRequest;
  highlighted: boolean;
  onTrade: () => void;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  const a = availabilityMeta[r.availability];
  return (
    <div
      ref={refCallback}
      className={[
        "group flex flex-col overflow-hidden rounded-2xl border bg-background/40 transition-all",
        "hover:-translate-y-1 hover:border-primary/40",
        highlighted
          ? "border-primary ring-2 ring-primary/60 shadow-[0_0_0_4px_hsl(var(--primary)/0.18)] animate-pulse"
          : "border-border/60",
      ].join(" ")}
    >
      <div className="p-2.5 pb-0">
        <CardArt
          name={r.card.name}
          set={r.card.pack}
          type={r.card.type}
          rarity={r.card.rarity as Parameters<typeof CardArt>[0]["rarity"]}
        />
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <p className="truncate font-display text-xs font-semibold text-foreground">{r.card.name}</p>
          <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${a.cls}`}>
            {a.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{r.card.pack}</p>

        {/* Bright Sand cost — REQUIRED on every tile */}
        <div className="mt-2 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-2 py-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
            <Coins className="h-3 w-3" /> Sand
          </span>
          <span className="font-mono text-sm font-bold text-warning">{r.cost.toLocaleString()}</span>
        </div>

        <p className="mt-1 text-[10px] text-muted-foreground">
          {r.stockLabel}{r.ownedByUser > 0 ? ` · You own ${r.ownedByUser}` : ""}
        </p>

        <div className="mt-auto pt-2.5">
          {/* Trade button — REQUIRED on every tile */}
          <button
            type="button"
            disabled={a.disabled}
            onClick={onTrade}
            className={[
              "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              a.disabled
                ? "border border-border bg-muted/40 text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            ].join(" ")}
          >
            <Repeat2 className="h-3.5 w-3.5" />
            {a.disabled ? "Unavailable" : "Trade"}
            {!a.disabled && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Your requests panel (ABOVE marketplace) ─────────────────────────────────

function YourRequestsPanel({ requests, onCancel, onAgain }: { requests: UserCardRequest[]; onCancel: (id: string) => void; onAgain: (id: string) => void }) {
  const [tab, setTab] = useState<"active" | "completed" | "failed">("active");

  const filtered = requests.filter((r) => {
    const meta = USER_REQUEST_STATUS_META[r.status];
    if (tab === "active") return !meta.terminal;
    if (tab === "completed") return r.status === "completed";
    return r.status === "failed" || r.status === "cancelled";
  });

  const counts = {
    active: requests.filter((r) => !USER_REQUEST_STATUS_META[r.status].terminal).length,
    completed: requests.filter((r) => r.status === "completed").length,
    failed: requests.filter((r) => r.status === "failed" || r.status === "cancelled").length,
  };

  return (
    <Section title="Your requests" description="Lifecycle of trades you've initiated.">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <TabChip active={tab === "active"} onClick={() => setTab("active")} count={counts.active}>Active</TabChip>
        <TabChip active={tab === "completed"} onClick={() => setTab("completed")} count={counts.completed}>Completed</TabChip>
        <TabChip active={tab === "failed"} onClick={() => setTab("failed")} count={counts.failed}>Failed</TabChip>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background/40 py-8 text-center">
          <p className="text-sm font-medium">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Pick a card below to start a request.</p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {filtered.map((r) => {
            const meta = USER_REQUEST_STATUS_META[r.status];
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-2.5"
              >
                <div className="h-12 w-9 shrink-0">
                  <CardArt
                    name={r.card.name}
                    type={r.card.type}
                    rarity={r.card.rarity as Parameters<typeof CardArt>[0]["rarity"]}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{r.card.name}</p>
                    <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {meta.description}
                    {r.partner ? ` · ${r.partner}` : ""}
                    {" · "}{r.ageLabel} ago
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/40 px-1.5 py-1 text-[10px] font-mono font-bold text-warning">
                    <Coins className="h-2.5 w-2.5" /> {r.cost.toLocaleString()}
                  </span>
                  {meta.terminal ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-accent"
                    >
                      <RotateCcw className="h-3 w-3" /> Again
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          <HelpCircle className="h-3.5 w-3.5 text-primary" />
          How card requests work
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ol className="grid gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground md:grid-cols-3">
          <li><span className="font-semibold text-foreground">1. Pick a card</span> — choose any available card from the marketplace grid below.</li>
          <li><span className="font-semibold text-foreground">2. Spend Bright Sand</span> — the cost is locked when your request is matched with a partner.</li>
          <li><span className="font-semibold text-foreground">3. Auto-trade</span> — friend-add, proposal, and confirmation are handled for you. Track progress in <span className="font-semibold text-foreground">Your requests</span>.</li>
        </ol>
      )}
    </div>
  );
}

// ── Trade confirmation dialog ───────────────────────────────────────────────

function TradeConfirmDialog({
  request, onOpenChange, atCap,
}: {
  request: CardRequest | null;
  onOpenChange: (open: boolean) => void;
  atCap: boolean;
}) {
  const open = !!request;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm trade request</DialogTitle>
              <DialogDescription>
                A partner will be matched automatically. Bright Sand is only spent when the trade completes.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="h-28 w-20 shrink-0">
                <CardArt
                  name={request.card.name}
                  type={request.card.type}
                  rarity={request.card.rarity as Parameters<typeof CardArt>[0]["rarity"]}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold">{request.card.name}</p>
                <p className="text-[11px] text-muted-foreground">{request.card.pack} · {request.card.rarity}</p>
                <div className="mt-2 flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Bright Sand</span>
                  <span className="font-mono text-base font-bold text-warning">{request.cost.toLocaleString()}</span>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">{request.stockLabel}</p>
              </div>
            </div>
            {atCap && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                You're at the {PENDING_REQUEST_CAP}-request cap. Cancel or complete a pending request first.
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={atCap} onClick={() => onOpenChange(false)}>
                <Repeat2 className="mr-1.5 h-3.5 w-3.5" /> Confirm request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Small UI atoms ──────────────────────────────────────────────────────────

function MetricTile({
  label, value, icon, tone = "neutral",
}: { label: string; value: string | number; icon: React.ReactNode; tone?: "neutral" | "info" | "success" | "warning" | "danger" }) {
  const toneCls = {
    neutral: "text-foreground",
    info: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-1 font-mono text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TabChip({ active, onClick, count, children }: { active: boolean; onClick: () => void; count: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${active ? "bg-primary/20" : "bg-muted"}`}>
        {count}
      </span>
    </button>
  );
}
