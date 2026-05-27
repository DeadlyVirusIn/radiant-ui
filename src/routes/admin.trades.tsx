import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Repeat2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AdminTradeDetailDrawer } from "@/components/admin/AdminTradeDetailDrawer";
import { ReadOnlyBadge } from "@/components/admin/ops/ReadOnlyBadge";
import {
  ADMIN_TRADES, DISPUTES, STATUS_LABEL,
  type AdminTrade,
} from "@/lib/mock-trades-admin";

type Tab = "ledger" | "settlement" | "disputes";
type Search = { tab?: Tab; id?: string };

export const Route = createFileRoute("/admin/trades")({
  head: () => ({ meta: [{ title: "Admin · Trades — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: (s.tab as Tab) ?? undefined,
    id:  typeof s.id === "string" ? s.id : undefined,
  }),
  component: AdminTrades,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
};

function fmtAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function TradesTable({
  rows,
  onOpen,
}: { rows: AdminTrade[]; onOpen: (id: string) => void }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
        No trades match this view.
      </div>
    );
  }
  return (
    <Section padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Trade</th>
              <th className="px-5 py-3">Partner</th>
              <th className="px-5 py-3">Exchange</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Retries</th>
              <th className="px-5 py-3">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((t) => {
              const m = STATUS_LABEL[t.status];
              return (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-accent/40"
                  onClick={() => onOpen(t.id)}
                >
                  <td className="px-5 py-3 text-mono whitespace-nowrap text-xs">{t.id}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{t.partner}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{t.gave} → {t.got}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>
                      {m.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-mono text-xs">{t.retries}</td>
                  <td className="px-5 py-3 text-mono text-xs">{fmtAge(t.openedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function AdminTrades() {
  const navigate = useNavigate({ from: "/admin/trades" });
  const search = useSearch({ from: "/admin/trades" }) as Search;
  const tab: Tab = search.tab ?? "ledger";

  const counts = useMemo(() => ({
    inFlight: ADMIN_TRADES.filter((t) => t.status === "in_flight").length,
    settled:  ADMIN_TRADES.filter((t) => t.status === "settled").length,
    failed:   ADMIN_TRADES.filter((t) => t.status === "failed").length,
    disputed: ADMIN_TRADES.filter((t) => t.status === "disputed").length,
  }), []);

  const selected = useMemo(
    () => ADMIN_TRADES.find((t) => t.id === search.id) ?? null,
    [search.id],
  );

  const setOpen = (id: string | undefined) =>
    navigate({ search: { ...search, id } });

  const ledger = ADMIN_TRADES;
  const settlement = ADMIN_TRADES.filter((t) => t.settlement !== "settled");
  const disputed = ADMIN_TRADES.filter((t) => t.status === "disputed");

  return (
    <>
      <PageHeader
        title="Trades"
        description="Operator ledger, settlement queue and disputes. Mock data; controls are read-only in this preview."
        actions={<ReadOnlyBadge />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="In flight" value={String(counts.inFlight)} icon={Repeat2} tone="primary" />
        <StatCard label="Settled 24h" value={String(counts.settled)} tone="success" />
        <StatCard label="Failed" value={String(counts.failed)} tone="danger" />
        <StatCard label="Disputed" value={String(counts.disputed)} tone="warning" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { ...search, tab: v as Tab } })}
        className="mt-6"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <TradesTable rows={ledger} onOpen={setOpen} />
        </TabsContent>

        <TabsContent value="settlement">
          <TradesTable rows={settlement} onOpen={setOpen} />
        </TabsContent>

        <TabsContent value="disputes">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Dispute</th>
                    <th className="px-5 py-3">Trade</th>
                    <th className="px-5 py-3">Opened by</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {DISPUTES.map((d) => (
                    <tr
                      key={d.id}
                      className="cursor-pointer hover:bg-accent/40"
                      onClick={() => setOpen(d.tradeId)}
                    >
                      <td className="px-5 py-3 text-mono text-xs">{d.id}</td>
                      <td className="px-5 py-3 text-mono text-xs">{d.tradeId}</td>
                      <td className="px-5 py-3">{d.openedBy}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{d.reason}</td>
                      <td className="px-5 py-3 text-xs capitalize">{d.status}</td>
                      <td className="px-5 py-3 text-mono text-xs">{d.ageH}h</td>
                    </tr>
                  ))}
                  {!disputed.length && DISPUTES.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No disputes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      <AdminTradeDetailDrawer
        trade={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setOpen(undefined); }}
      />
    </>
  );
}
