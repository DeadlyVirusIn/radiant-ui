import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ReadOnlyBadge } from "@/components/admin/ops/ReadOnlyBadge";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — Radiant" }] }),
  component: AdminUsers,
});

const users = [
  { name: "Alex Morrow",  email: "alex@radiant.app",  role: "owner",    plan: "premium", last: "2m" },
  { name: "Jules Ferris", email: "jules@radiant.app", role: "admin",    plan: "premium", last: "11m" },
  { name: "Nelle Park",   email: "nelle@radiant.app", role: "operator", plan: "trade",   last: "1h" },
  { name: "Kiera Vance",  email: "kiera@radiant.app", role: "operator", plan: "trade",   last: "3h" },
  { name: "Arden Holt",   email: "arden@radiant.app", role: "viewer",   plan: "free",    last: "1d" },
];

const role: Record<string, string> = { owner: "bg-warning/15 text-warning", admin: "bg-primary/15 text-primary", operator: "bg-success/15 text-success", viewer: "bg-muted text-muted-foreground" };

function AdminUsers() {
  return (
    <>
      <PageHeader
        title="Users"
        description="Workspace members and their plans. Mock data; controls are read-only in this preview."
        actions={
          <>
            <ReadOnlyBadge />
            <Button size="sm" disabled>Invite</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value="42" icon={UserCog} />
        <StatCard label="Premium" value="14" tone="primary" />
        <StatCard label="Active 24h" value="22" tone="success" />
        <StatCard label="Suspended" value="1" tone="danger" />
      </div>

      <Section title="Members" className="mt-6" padded={false} actions={<Input placeholder="Search…" className="h-8 w-48 bg-background/40" disabled />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Last</th><th className="px-5 py-3 text-right"></th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-5 py-3 text-mono text-xs text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + role[u.role]}>{u.role}</Badge></td>
                  <td className="px-5 py-3 text-xs uppercase text-muted-foreground">{u.plan}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{u.last}</td>
                  <td className="px-5 py-3 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs" disabled>Manage</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
