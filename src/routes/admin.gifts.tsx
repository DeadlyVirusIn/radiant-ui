import { useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { GiftDetailDrawer } from "@/components/admin/GiftDetailDrawer";
import { ADMIN_GIFTS, GIFT_STATUS } from "@/lib/mock-gifts-admin";

type Search = { id?: string };

export const Route = createFileRoute("/admin/gifts")({
  head: () => ({ meta: [{ title: "Admin · Gifts — Radiant" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: AdminGifts,
});

const TONE: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  danger:  "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  muted:   "bg-muted text-muted-foreground",
};

function fmtAge(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function AdminGifts() {
  const navigate = useNavigate({ from: "/admin/gifts" });
  const search = useSearch({ from: "/admin/gifts" }) as Search;

  const counts = useMemo(() => ({
    queued:    ADMIN_GIFTS.filter((g) => g.status === "queued").length,
    sent:      ADMIN_GIFTS.filter((g) => g.status === "sent").length,
    delivered: ADMIN_GIFTS.filter((g) => g.status === "delivered").length,
    failed:    ADMIN_GIFTS.filter((g) => g.status === "failed").length,
    refunded:  ADMIN_GIFTS.filter((g) => g.status === "refunded").length,
  }), []);

  const selected = useMemo(
    () => ADMIN_GIFTS.find((g) => g.id === search.id) ?? null,
    [search.id],
  );

  const setOpen = (id: string | undefined) =>
    navigate({ search: { ...search, id } });

  return (
    <>
      <PageHeader
        title="Gifts"
        description="Operator-facing gift queue. (Collectors continue to use /gifts.)"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Queued"    value={String(counts.queued)}    icon={Gift} />
        <StatCard label="Sent"      value={String(counts.sent)}      tone="primary" />
        <StatCard label="Delivered" value={String(counts.delivered)} tone="success" />
        <StatCard label="Failed"    value={String(counts.failed)}    tone="danger" />
        <StatCard label="Refunded"  value={String(counts.refunded)}  tone="warning" />
      </div>

      <Section padded={false} className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-3">Gift</th>
                <th className="px-5 py-3">Recipient</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Retries</th>
                <th className="px-5 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ADMIN_GIFTS.map((g) => {
                const m = GIFT_STATUS[g.status];
                return (
                  <tr
                    key={g.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setOpen(g.id)}
                  >
                    <td className="px-5 py-3 text-mono text-xs">{g.id}</td>
                    <td className="px-5 py-3">{g.recipient}</td>
                    <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{g.sku}</td>
                    <td className="px-5 py-3 text-xs capitalize">{g.source.replace("-", " ")}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className={cn("h-5 border-transparent text-[10px]", TONE[m.tone])}>
                        {m.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-mono text-xs">{g.retries}</td>
                    <td className="px-5 py-3 text-mono text-xs">{fmtAge(g.sentAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <GiftDetailDrawer
        gift={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setOpen(undefined); }}
      />
    </>
  );
}
