import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Gem, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section, DataRow } from "@/components/app-shell/Section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GoldFlairRequestDrawer } from "@/components/admin/GoldFlairRequestDrawer";
import { MintBatchDrawer } from "@/components/admin/MintBatchDrawer";
import {
  MINT_QUEUE, GF_REQUESTS, SUPPLY, CATALOG, BACKLOG, SIGNER_POOL,
  GF_STATUS, GF_BLOCK_LABEL, GF_REQUEST_BY_ID, MINT_BATCH_BY_ID,
  goldFlairKpis,
} from "@/lib/mock-gold-flair-admin";

type Tab = "mint" | "fulfillment" | "catalog" | "supply" | "demand";
type DrawerKind = "request" | "batch";
type Search = { tab?: Tab; id?: string; drawer?: DrawerKind };

export const Route = createFileRoute("/admin/gold-flair")({
  head: () => ({ meta: [{ title: "Admin · Gold Flair — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab:    (s.tab as Tab) ?? undefined,
    id:     typeof s.id === "string" ? s.id : undefined,
    drawer: (s.drawer as DrawerKind) ?? undefined,
  }),
  component: AdminGoldFlair,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

const CATALOG_TONE = {
  verified: { dot: "bg-success",    chip: "bg-success/15 text-success border-success/30",        icon: ShieldCheck },
  drift:    { dot: "bg-warning",    chip: "bg-warning/15 text-warning border-warning/30",        icon: AlertTriangle },
  missing:  { dot: "bg-destructive",chip: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
} as const;

const TABS: { key: Tab; label: string }[] = [
  { key: "mint",        label: "Mint Queue" },
  { key: "fulfillment", label: "Fulfillment" },
  { key: "catalog",     label: "Catalog Health" },
  { key: "supply",      label: "Supply" },
  { key: "demand",      label: "Demand Backlog" },
];

function fmtRel(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}
function fmtTs(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : "—";
}

// ─────────────────────────────────────────────────────────────────────────
function AdminGoldFlair() {
  const navigate = useNavigate({ from: "/admin/gold-flair" });
  const search = useSearch({ from: "/admin/gold-flair" }) as Search;
  const tab: Tab = search.tab ?? "mint";

  const kpis = useMemo(() => goldFlairKpis(), []);

  const openRequest = (id: string | undefined) =>
    navigate({ search: { ...search, drawer: id ? "request" : undefined, id } });
  const openBatch = (id: string | undefined) =>
    navigate({ search: { ...search, drawer: id ? "batch" : undefined, id } });

  const selectedRequest = search.drawer === "request" && search.id
    ? GF_REQUEST_BY_ID[search.id] ?? null : null;
  const selectedBatch = search.drawer === "batch" && search.id
    ? MINT_BATCH_BY_ID[search.id] ?? null : null;

  return (
    <>
      <PageHeader
        title="Gold Flair"
        description="Mint queue health, fulfillment readiness, catalog integrity, supply pressure and demand backlog."
      />

      {/* KPI ROW — canonical terms */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Queue depth"  value={String(kpis.queueDepth)}    icon={Gem}      tone={kpis.queueDepth >= 10 ? "warning" : "primary"} />
        <StatCard label="In flight"    value={String(kpis.inFlight)}      tone="primary" />
        <StatCard label="Blocked"      value={String(kpis.blocked)}       tone={kpis.blocked > 0 ? "warning" : "default"} />
        <StatCard label="Failed"       value={String(kpis.failed)}        tone={kpis.failed > 0 ? "danger" : "default"} />
        <StatCard label="Delivered 24h" value={String(kpis.delivered24h)} tone="success" />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { ...search, tab: v as Tab } })}
        className="mt-6"
      >
        <TabsList className="mb-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* ─── MINT QUEUE ─────────────────────────────────────────── */}
        <TabsContent value="mint">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <Section padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-5 py-3">Batch</th>
                      <th className="px-5 py-3">Size</th>
                      <th className="px-5 py-3">Signer</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Retries</th>
                      <th className="px-5 py-3">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {MINT_QUEUE.map((b) => {
                      const m = GF_STATUS[b.status];
                      return (
                        <tr key={b.id} className="cursor-pointer hover:bg-accent/40" onClick={() => openBatch(b.id)}>
                          <td className="px-5 py-3 text-mono text-xs">{b.id}</td>
                          <td className="px-5 py-3 text-mono text-xs">{b.size}</td>
                          <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{b.signer}</td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>
                              {m.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-mono text-xs">{b.retries}</td>
                          <td className="px-5 py-3 text-mono text-xs">{fmtRel(b.ageMin)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title="Signer pool">
              <DataRow label="Active"        value={`${SIGNER_POOL.active} / ${SIGNER_POOL.capacity}`} />
              <DataRow label="Rejections 1h" value={String(SIGNER_POOL.rejections1h)} />
              <DataRow label="Throughput"    value={`${kpis.throughput}/h`} />
              <DataRow label="P95 wait"      value={`${kpis.p95Wait}s`} />
              <DataRow label="Errors 1h"     value={String(kpis.errors1h)} />
            </Section>
          </div>
        </TabsContent>

        {/* ─── FULFILLMENT ────────────────────────────────────────── */}
        <TabsContent value="fulfillment">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Request</th>
                    <th className="px-5 py-3">Recipient</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Block reason</th>
                    <th className="px-5 py-3">Retries</th>
                    <th className="px-5 py-3">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {GF_REQUESTS.map((r) => {
                    const m = GF_STATUS[r.status];
                    return (
                      <tr key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => openRequest(r.id)}>
                        <td className="px-5 py-3 text-mono text-xs">{r.id}</td>
                        <td className="px-5 py-3">{r.recipient}</td>
                        <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{r.sku}</td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>
                            {m.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {r.blockReason ? GF_BLOCK_LABEL[r.blockReason] : "—"}
                        </td>
                        <td className="px-5 py-3 text-mono text-xs">{r.retries}</td>
                        <td className="px-5 py-3 text-mono text-xs">{fmtRel(r.ageMin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ─── CATALOG HEALTH ─────────────────────────────────────── */}
        <TabsContent value="catalog">
          <Section padded={false}>
            <ul className="divide-y divide-border">
              {CATALOG.map((c) => {
                const t = CATALOG_TONE[c.state];
                const Icon = t.icon;
                return (
                  <li key={c.sku} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", t.dot)} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{c.label}</p>
                        <p className="text-mono mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{c.sku}</p>
                        {c.note && <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pl-5 sm:pl-0">
                      <span className="text-mono hidden text-[10px] text-muted-foreground sm:inline">
                        verified {fmtTs(c.lastVerifiedAt)}
                      </span>
                      <Badge variant="outline" className={cn("h-6 gap-1 border text-[10px] font-bold uppercase tracking-wider", t.chip)}>
                        <Icon className="h-3 w-3" />
                        {c.state}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        </TabsContent>

        {/* ─── SUPPLY ─────────────────────────────────────────────── */}
        <TabsContent value="supply">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">On hand</th>
                    <th className="px-5 py-3">Reserved</th>
                    <th className="px-5 py-3">Available</th>
                    <th className="px-5 py-3">Burn / h</th>
                    <th className="px-5 py-3">Hours left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SUPPLY.map((s) => {
                    const critical = s.available <= 0;
                    const pressured = !critical && s.hoursLeft < 6;
                    return (
                      <tr key={s.sku} className="hover:bg-accent/30">
                        <td className="px-5 py-3">
                          <div className="text-sm font-semibold">{s.label}</div>
                          <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.sku}</div>
                        </td>
                        <td className="px-5 py-3 text-mono text-xs">{s.onHand}</td>
                        <td className="px-5 py-3 text-mono text-xs">{s.reserved}</td>
                        <td className={cn("px-5 py-3 text-mono text-xs", critical && "text-destructive")}>{s.available}</td>
                        <td className="px-5 py-3 text-mono text-xs">{s.burnPerH}</td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={cn(
                            "h-5 border-transparent text-[10px]",
                            critical && TONE.danger,
                            pressured && TONE.warning,
                            !critical && !pressured && "bg-muted text-muted-foreground",
                          )}>
                            {s.hoursLeft.toFixed(1)}h
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ─── DEMAND BACKLOG ─────────────────────────────────────── */}
        <TabsContent value="demand">
          <Section padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Pending</th>
                    <th className="px-5 py-3">Oldest item</th>
                    <th className="px-5 py-3">P95 wait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {BACKLOG.map((b) => (
                    <tr key={b.sku} className="hover:bg-accent/30">
                      <td className="px-5 py-3">
                        <div className="text-sm font-semibold">{b.label}</div>
                        <div className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">{b.sku}</div>
                      </td>
                      <td className="px-5 py-3 text-mono text-xs">{b.pending}</td>
                      <td className="px-5 py-3 text-mono text-xs">{fmtRel(b.oldestAgeMin)}</td>
                      <td className="px-5 py-3 text-mono text-xs">{b.p95WaitSec}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      <GoldFlairRequestDrawer
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(o) => { if (!o) openRequest(undefined); }}
      />
      <MintBatchDrawer
        batch={selectedBatch}
        open={!!selectedBatch}
        onOpenChange={(o) => { if (!o) openBatch(undefined); }}
      />

      {/* unused-import guard for Sparkles (kept for future header icon) */}
      <Sparkles className="hidden" />
    </>
  );
}
