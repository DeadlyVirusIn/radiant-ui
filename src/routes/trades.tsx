import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, BarChart3, CheckCircle2, Plus, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNTS, DEFAULT_ACCOUNT_ID } from "@/lib/mock-accounts";
import {
  ACTIVE_STATUSES,
  MOCK_PARTNERS,
  MOCK_TRADES,
  MOCK_TRADE_POWER,
  type TradeRecord,
} from "@/lib/mock-trades";
import { TradePowerCard } from "@/components/trades/TradePowerCard";
import { PartnerRail } from "@/components/trades/PartnerRail";
import {
  TradeFilters,
  type DirectionFilter,
  type StatusTab,
  type TimeframeFilter,
} from "@/components/trades/TradeFilters";
import { TradeHistoryTable } from "@/components/trades/TradeHistoryTable";
import { TradeDetailDrawer } from "@/components/trades/TradeDetailDrawer";

export const Route = createFileRoute("/trades")({
  head: () => ({ meta: [{ title: "Trades — Radiant" }] }),
  component: Trades,
});

const TIMEFRAME_MS: Record<TimeframeFilter, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
};

function Trades() {
  const [accountId, setAccountId] = useState<string>(DEFAULT_ACCOUNT_ID);
  const [status, setStatus] = useState<StatusTab>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [partnerId, setPartnerId] = useState<string | "all">("all");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("7d");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const accountTrades = useMemo(
    () => MOCK_TRADES.filter((t) => t.accountId === accountId),
    [accountId],
  );

  const partnersForAccount = useMemo(() => {
    const ids = new Set(accountTrades.map((t) => t.partner.id));
    return MOCK_PARTNERS.filter((p) => ids.has(p.partner.id));
  }, [accountTrades]);

  const matchesNonStatus = (t: TradeRecord) => {
    if (direction !== "all" && t.direction !== direction) return false;
    if (partnerId !== "all" && t.partner.id !== partnerId) return false;
    const tfMs = TIMEFRAME_MS[timeframe];
    if (Number.isFinite(tfMs) && Date.now() - t.completedAt > tfMs) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [
        t.id,
        t.requestId,
        t.partner.handle,
        ...t.gave.map((c) => c.name),
        ...t.got.map((c) => c.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const matchesStatus = (t: TradeRecord, s: StatusTab) => {
    if (s === "all") return true;
    if (s === "active") return ACTIVE_STATUSES.includes(t.status);
    return t.status === s;
  };

  const filtered = useMemo(
    () => accountTrades.filter((t) => matchesNonStatus(t) && matchesStatus(t, status)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountTrades, direction, partnerId, timeframe, search, status],
  );

  const counts = useMemo(() => {
    const base = accountTrades.filter(matchesNonStatus);
    const c: Record<StatusTab, number> = {
      all: base.length,
      active: base.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
      completed: base.filter((t) => t.status === "completed").length,
      failed: base.filter((t) => t.status === "failed").length,
      cancelled: base.filter((t) => t.status === "cancelled").length,
    };
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTrades, direction, partnerId, timeframe, search]);

  const hero = useMemo(() => {
    const completed = filtered.filter((t) => t.status === "completed").length;
    const failed = filtered.filter((t) => t.status === "failed").length;
    const settled = completed + failed;
    const successRate = settled > 0 ? Math.round((completed / settled) * 100) : 0;
    return { total: filtered.length, completed, failed, successRate };
  }, [filtered]);

  const anyActive =
    direction !== "all" ||
    partnerId !== "all" ||
    timeframe !== "7d" ||
    search.trim() !== "" ||
    status !== "all";

  const onReset = () => {
    setDirection("all");
    setPartnerId("all");
    setTimeframe("7d");
    setSearch("");
    setStatus("all");
  };

  const selectedTrade = useMemo(
    () => MOCK_TRADES.find((t) => t.id === selectedId) ?? null,
    [selectedId],
  );

  return (
    <>
      <PageHeader
        title="Trades"
        description="Your personal trade ledger — power, partners, and history across accounts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="font-mono">{a.handle}</span>{" "}
                    <span className="text-muted-foreground">· {a.displayName}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/card-request">
                <Plus className="h-3.5 w-3.5" /> New trade
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Trades" value={String(hero.total)} icon={ArrowLeftRight} />
        <StatCard label="Completed" value={String(hero.completed)} icon={CheckCircle2} tone="success" />
        <StatCard label="Failed" value={String(hero.failed)} icon={XCircle} tone="danger" />
        <StatCard label="Success rate" value={`${hero.successRate}%`} tone="primary" />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <TradePowerCard initial={MOCK_TRADE_POWER} />
        </div>
        <div>
          <PartnerRail
            partners={partnersForAccount}
            activePartnerId={partnerId}
            onSelect={setPartnerId}
          />
        </div>
      </section>

      <section className="mt-6">
        <TradeFilters
          status={status}
          onStatusChange={setStatus}
          direction={direction}
          onDirectionChange={setDirection}
          partnerId={partnerId}
          onPartnerChange={setPartnerId}
          partners={partnersForAccount}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          search={search}
          onSearchChange={setSearch}
          onReset={onReset}
          counts={counts}
          anyActive={anyActive}
        />
      </section>

      <section className="mt-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            {anyActive ? (
              <>
                <p className="text-sm font-medium">No trades match these filters</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting status, timeframe, or partner.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={onReset}>
                  Reset filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No trades yet on this account</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start trading from the Card Request marketplace.
                </p>
                <Button asChild size="sm" className="mt-4 gap-1.5">
                  <Link to="/card-request">
                    <Plus className="h-3.5 w-3.5" /> New trade
                  </Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          <TradeHistoryTable
            trades={filtered}
            onSelect={(id) => setSelectedId(id)}
          />
        )}
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-border pt-5 text-xs">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/card-request">
            Start a new trade <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
        <span className="text-muted-foreground">·</span>
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/trade-analytics">
            <BarChart3 className="h-3 w-3" /> See aggregate analytics
          </Link>
        </Button>
      </footer>

      <TradeDetailDrawer
        trade={selectedTrade}
        open={selectedId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
        onViewPartner={(pid) => {
          setPartnerId(pid);
          setSelectedId(null);
        }}
      />
    </>
  );
}
