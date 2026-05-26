import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowRight, BarChart3, CheckCircle2, Coins, Download, Layers,
  Lightbulb, Sparkles, Target, TrendingUp, Trophy, Users, XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { Section } from "@/components/app-shell/Section";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import {
  MOCK_TRADE_ANALYTICS, sliceBuckets, sumBuckets, deriveFunnel, suggest,
  type AnalyticsTimeframe,
} from "@/lib/mock-trade-analytics";
import { ACCOUNTS } from "@/lib/mock-accounts";
import { MOCK_USER_REQUESTS, USER_REQUEST_STATUS_META } from "@/lib/mock-card-requests";

type SearchT = { tf?: AnalyticsTimeframe; account?: string; compare?: boolean };

export const Route = createFileRoute("/trade-analytics")({
  head: () => ({
    meta: [
      { title: "Trade analytics — Radiant" },
      { name: "description", content: "Your trading performance over time — volume, outcomes, packs, partners, and Bright Sand." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchT => ({
    tf: (["7d","30d","90d","all"] as const).includes(s.tf as AnalyticsTimeframe) ? (s.tf as AnalyticsTimeframe) : "30d",
    account: typeof s.account === "string" ? s.account : "all",
    compare: s.compare === true || s.compare === "true",
  }),
  component: TradeAnalytics,
});

const TF_LABEL: Record<AnalyticsTimeframe, string> = { "7d": "7d", "30d": "30d", "90d": "90d", all: "All" };

function TradeAnalytics() {
  const { tf = "30d", account = "all", compare = false } = Route.useSearch();
  const navigate = useNavigate({ from: "/trade-analytics" });
  const setTf = (next: AnalyticsTimeframe) => navigate({ search: (s: SearchT) => ({ ...s, tf: next }), replace: true });
  const setAccount = (next: string) => navigate({ search: (s: SearchT) => ({ ...s, account: next }), replace: true });
  const setCompare = (next: boolean) => navigate({ search: (s: SearchT) => ({ ...s, compare: next }), replace: true });

  const data = MOCK_TRADE_ANALYTICS;
  const current = useMemo(() => sliceBuckets(data.buckets, tf), [data.buckets, tf]);
  const prev = useMemo(() => {
    if (tf === "all") return [];
    const days = tf === "7d" ? 7 : tf === "30d" ? 30 : 90;
    const end = data.buckets.length - days;
    return data.buckets.slice(Math.max(0, end - days), end);
  }, [data.buckets, tf]);

  const sum = sumBuckets(current);
  const psum = sumBuckets(prev);
  const funnel = useMemo(() => deriveFunnel(current), [current]);

  const trades = sum.completed + sum.failed + sum.cancelled;
  const successRate = trades ? Math.round((sum.completed / trades) * 100) : 0;
  const prevTrades = psum.completed + psum.failed + psum.cancelled;
  const prevSuccess = prevTrades ? Math.round((psum.completed / prevTrades) * 100) : 0;
  const netSand = sum.sandEarned - sum.sandSpent;
  const prevNetSand = psum.sandEarned - psum.sandSpent;
  const avgTimeToTrade = 18 - Math.min(8, Math.floor(sum.completed / 30)); // 10–18h mock
  const prevAvgTime = 18 - Math.min(8, Math.floor(psum.completed / 30));

  const pendingRequests = MOCK_USER_REQUESTS.filter((r) => !USER_REQUEST_STATUS_META[r.status].terminal).length;
  const suggestion = useMemo(() => suggest(current, data.packs, data.partners, pendingRequests), [current, data.packs, data.partners, pendingRequests]);

  const chartData = current.map((b) => ({
    date: b.date.slice(5),
    completed: b.completed,
    failed: b.failed,
    cancelled: b.cancelled,
    net: b.sandEarned - b.sandSpent,
  }));

  return (
    <>
      <PageHeader
        title="Trade analytics"
        description="How your trading is evolving — volume, outcomes, packs, partners, and Bright Sand."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        }
      />

      {/* ── Control bar ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-2.5">
        <div className="flex items-center gap-1">
          {(["7d","30d","90d","all"] as AnalyticsTimeframe[]).map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                tf === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {TF_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <select
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="all">All accounts</option>
          {ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
        </select>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-primary" />
          Compare vs previous
        </label>
      </div>

      {/* ── Hero KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Trades completed"
          value={sum.completed.toLocaleString()}
          icon={CheckCircle2}
          tone="success"
          delta={delta(sum.completed, psum.completed, compare)}
        />
        <StatCard
          label="Success rate"
          value={`${successRate}%`}
          icon={Target}
          tone="primary"
          delta={delta(successRate, prevSuccess, compare, "pp")}
        />
        <StatCard
          label="Net Bright Sand"
          value={`${netSand >= 0 ? "+" : ""}${netSand.toLocaleString()}`}
          icon={Coins}
          tone={netSand >= 0 ? "success" : "danger"}
          delta={delta(netSand, prevNetSand, compare)}
        />
        <StatCard
          label="Avg time to trade"
          value={`${avgTimeToTrade}h`}
          icon={TrendingUp}
          delta={delta(prevAvgTime, avgTimeToTrade, compare)} // inverted: lower is better
        />
      </div>

      {/* ── Volume trend ───────────────────────────────────────────── */}
      <Section title="Trade volume over time" description={`Daily breakdown · ${TF_LABEL[tf as AnalyticsTimeframe]}`} className="mt-4">
        {chartData.length === 0 ? (
          <Empty msg="Nothing to plot for this window." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={28} />
                <RTooltip content={<ChartTip />} />
                <Bar dataKey="completed" stackId="a" fill="var(--success)" radius={[2,2,0,0]} />
                <Bar dataKey="failed" stackId="a" fill="var(--destructive)" />
                <Bar dataKey="cancelled" stackId="a" fill="var(--muted-foreground)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <Legend swatch="bg-success" label="Completed" value={sum.completed} />
          <Legend swatch="bg-destructive" label="Failed" value={sum.failed} />
          <Legend swatch="bg-muted-foreground" label="Cancelled" value={sum.cancelled} />
        </div>
      </Section>

      {/* ── Outcomes ───────────────────────────────────────────────── */}
      <Section
        title="Outcomes"
        className="mt-4"
        actions={<LinkBtn to="/trades">View ledger →</LinkBtn>}
      >
        {trades === 0 ? (
          <Empty msg="No completed or failed trades yet." />
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
              <div className="bg-success" style={{ width: `${(sum.completed / trades) * 100}%` }} />
              <div className="bg-destructive" style={{ width: `${(sum.failed / trades) * 100}%` }} />
              <div className="bg-muted-foreground" style={{ width: `${(sum.cancelled / trades) * 100}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Readout tone="success" label="Completed" value={sum.completed} pct={Math.round((sum.completed/trades)*100)} />
              <Readout tone="danger" label="Failed" value={sum.failed} pct={Math.round((sum.failed/trades)*100)} />
              <Readout tone="neutral" label="Cancelled" value={sum.cancelled} pct={Math.round((sum.cancelled/trades)*100)} />
              <Readout tone="warning" label="Stuck > 24h" value={2} pct={Math.round((2/trades)*100)} />
            </div>
          </>
        )}
      </Section>

      {/* ── Funnel ─────────────────────────────────────────────────── */}
      <Section
        title="Request → trade funnel"
        description="From request submission to completion"
        className="mt-4"
        actions={<LinkBtn to="/card-request">Open Card Requests →</LinkBtn>}
      >
        <FunnelView snap={funnel} />
        <FunnelInsight snap={funnel} />
      </Section>

      {/* ── Suggested next action ──────────────────────────────────── */}
      <Section className="mt-4" padded={false}>
        <div className="flex items-start gap-3 p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Suggested next action</div>
            <div className="mt-0.5 font-display text-base font-semibold">{suggestion.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{suggestion.body}</p>
          </div>
          <Link to={suggestion.href} className="shrink-0">
            <Button size="sm" className="gap-1.5">{suggestion.cta} <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Link>
        </div>
      </Section>

      {/* ── Collection impact ──────────────────────────────────────── */}
      <Section
        title="Collection impact"
        description="What this period of trading did for your collection"
        className="mt-4"
        actions={<LinkBtn to="/tracker">View Collection Progress →</LinkBtn>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Mini icon={Sparkles} label="Cards acquired via trades" value={data.collection.cardsAcquired} />
          <Mini icon={Trophy} label="Wishlist cards acquired" value={data.collection.wishlistAcquired} tone="primary" />
          <Mini icon={Layers} label="Sets progressed" value={data.collection.setsProgressed} />
          <Mini
            icon={TrendingUp}
            label="Biggest set improvement"
            value={`+${data.collection.biggestSetImprovement.deltaPct}%`}
            hint={data.collection.biggestSetImprovement.set}
            tone="success"
          />
          <Mini
            icon={Coins}
            label="Most valuable acquisition"
            value={data.collection.mostValuableAcquisition.card}
            hint={`${data.collection.mostValuableAcquisition.pack} · ${data.collection.mostValuableAcquisition.sand.toLocaleString()} Sand`}
            tone="warning"
          />
        </div>
      </Section>

      {/* ── Pack performance ───────────────────────────────────────── */}
      <Section title="Pack performance" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/60">
                <Th>Pack</Th><Th right>Trades</Th><Th right>Success</Th><Th right>Avg Sand</Th><Th right>Net Sand</Th><Th>Top card</Th><Th />
              </tr>
            </thead>
            <tbody>
              {data.packs.map((p) => (
                <tr key={p.pack} className="border-b border-border/40 hover:bg-accent/30">
                  <td className="py-2.5 font-medium">{p.pack}</td>
                  <td className="py-2.5 text-right font-mono">{p.trades}</td>
                  <td className="py-2.5 text-right font-mono">
                    <span className={p.successPct >= 90 ? "text-success" : p.successPct >= 82 ? "text-foreground" : "text-warning"}>
                      {p.successPct}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono">{p.avgSand.toLocaleString()}</td>
                  <td className={`py-2.5 text-right font-mono ${p.netSand >= 0 ? "text-success" : "text-destructive"}`}>
                    {p.netSand >= 0 ? "+" : ""}{p.netSand.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-muted-foreground">{p.topCard}</td>
                  <td className="py-2.5 text-right">
                    <Link to="/trades" search={{ pack: p.pack } as never} className="text-primary text-[11px] hover:underline">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Partners ───────────────────────────────────────────────── */}
      <Section title="Top trade partners" description="Ranked by trades completed in this window" className="mt-4">
        <ul className="divide-y divide-border/50">
          {data.partners.slice(0, 10).map((p, i) => (
            <li key={p.handle} className="flex items-center gap-3 py-2.5">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-mono font-bold">{i + 1}</div>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/60 to-primary/20 text-[10px] font-bold uppercase">
                {p.handle.slice(5, 7)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{p.handle}</span>
                  {p.tag && <TagPill tag={p.tag} />}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.trades} trades · {p.successPct}% success · last {daysAgo(p.lastTradeAt)}
                </div>
              </div>
              <div className={`shrink-0 font-mono text-xs font-bold ${p.netSand >= 0 ? "text-success" : "text-destructive"}`}>
                {p.netSand >= 0 ? "+" : ""}{p.netSand.toLocaleString()}
              </div>
              <Link to="/trades" search={{ partner: p.handle } as never} className="shrink-0 text-[11px] text-primary hover:underline">View →</Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Bright Sand flow ───────────────────────────────────────── */}
      <Section title="Bright Sand flow" className="mt-4 mb-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--warning)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={40} />
                  <RTooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="net" stroke="var(--warning)" fill="url(#sandGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Mini icon={Coins} label="Earned" value={sum.sandEarned.toLocaleString()} tone="success" />
            <Mini icon={Coins} label="Spent" value={sum.sandSpent.toLocaleString()} tone="danger" />
            <Mini icon={BarChart3} label="Avg per trade" value={(sum.completed ? Math.round(sum.sandSpent / sum.completed) : 0).toLocaleString()} />
            <Mini
              icon={Trophy}
              label="Most expensive"
              value={data.collection.mostValuableAcquisition.card}
              hint={`${data.collection.mostValuableAcquisition.sand.toLocaleString()} Sand`}
              tone="warning"
              href={`/trades?trade=${data.mostExpensiveTradeId}`}
            />
          </div>
        </div>
      </Section>
    </>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────────

function delta(curr: number, prev: number, compare: boolean, unit: "" | "pp" = "") {
  if (!compare || prev === 0) return undefined;
  const diff = curr - prev;
  const pct = unit === "pp" ? `${diff >= 0 ? "+" : ""}${diff}pp` : `${diff >= 0 ? "+" : ""}${Math.round((diff / Math.abs(prev)) * 100)}%`;
  return { value: pct, direction: diff > 0 ? "up" as const : diff < 0 ? "down" as const : "flat" as const };
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover/95 p-2 text-[11px] shadow-md backdrop-blur">
      <div className="mb-1 font-mono text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}</span>
          <span className="font-mono font-semibold">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      <span className="font-medium text-foreground">{label}</span>
      <span className="font-mono">{value.toLocaleString()}</span>
    </span>
  );
}

function Readout({ label, value, pct, tone }: { label: string; value: number; pct: number; tone: "success"|"danger"|"warning"|"neutral" }) {
  const toneCls = { success: "text-success", danger: "text-destructive", warning: "text-warning", neutral: "text-muted-foreground" }[tone];
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className={`font-display text-xl font-bold ${toneCls}`}>{value.toLocaleString()}</div>
        <div className="text-[11px] text-muted-foreground">{pct}%</div>
      </div>
    </div>
  );
}

const STEPS: Array<{ key: keyof ReturnType<typeof deriveFunnel>; label: string }> = [
  { key: "requested", label: "Requested" },
  { key: "matched", label: "Matched" },
  { key: "friend_sent", label: "Friend sent" },
  { key: "pick_card", label: "Pick card" },
  { key: "completed", label: "Completed" },
];

function FunnelView({ snap }: { snap: ReturnType<typeof deriveFunnel> }) {
  const top = snap.requested || 1;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
      {STEPS.map((s, i) => {
        const v = snap[s.key];
        const pct = Math.round((v / top) * 100);
        const conv = i === 0 ? 100 : Math.round((v / snap[STEPS[i - 1].key]) * 100);
        return (
          <div key={s.key} className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{s.label}</span>
              {i > 0 && <span>{conv}%</span>}
            </div>
            <div className="mt-1 font-display text-xl font-bold">{v.toLocaleString()}</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FunnelInsight({ snap }: { snap: ReturnType<typeof deriveFunnel> }) {
  let weakest = { label: "—", drop: 0 };
  for (let i = 1; i < STEPS.length; i++) {
    const drop = snap[STEPS[i - 1].key] - snap[STEPS[i].key];
    if (drop > weakest.drop) weakest = { label: `${STEPS[i - 1].label} → ${STEPS[i].label}`, drop };
  }
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Weakest step:</span> {weakest.label} — {weakest.drop} request{weakest.drop === 1 ? "" : "s"} dropped.
    </p>
  );
}

function Mini({ icon: Icon, label, value, hint, tone = "default", href }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint?: string; tone?: "default"|"primary"|"success"|"warning"|"danger"; href?: string;
}) {
  const ic = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
  }[tone];
  const inner = (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:bg-accent/30">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${ic}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-0.5 truncate font-display text-base font-bold">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/30 py-8 text-center text-xs text-muted-foreground">
      {msg}
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`py-2 ${right ? "text-right" : "text-left"} font-medium`}>{children}</th>;
}

function LinkBtn({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="text-xs font-semibold text-primary hover:underline">{children}</Link>;
}

function TagPill({ tag }: { tag: "new" | "repeat" | "top5" }) {
  const meta = {
    new: { label: "New", cls: "bg-primary/15 text-primary border-primary/30" },
    repeat: { label: "Repeat", cls: "bg-muted text-muted-foreground border-border" },
    top5: { label: "Top 5", cls: "bg-success/15 text-success border-success/30" },
  }[tag];
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.cls}`}>{meta.label}</span>;
}

function daysAgo(ms: number) {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

// Suppress unused icon import warning (Users may be needed when extending)
void Users;
