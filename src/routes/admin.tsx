import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, UserCog, Activity } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Radiant" }] }),
  component: Admin,
});

const users = [
  { name: "Alex Morrow",    email: "alex@radiant.app",   role: "owner",    last: "2m ago" },
  { name: "Jules Ferris",   email: "jules@radiant.app",  role: "admin",    last: "11m ago" },
  { name: "Nelle Park",     email: "nelle@radiant.app",  role: "operator", last: "1h ago" },
  { name: "Kiera Vance",    email: "kiera@radiant.app",  role: "operator", last: "3h ago" },
  { name: "Arden Holt",     email: "arden@radiant.app",  role: "viewer",   last: "Yesterday" },
];

const roleStyle: Record<string, string> = {
  owner: "bg-warning/15 text-warning",
  admin: "bg-primary/15 text-primary",
  operator: "bg-success/15 text-success",
  viewer: "bg-muted text-muted-foreground",
};

function Admin() {
  return (
    <>
      <PageHeader title="Admin" description="Workspace governance, members and policy controls." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Members"     value="12" icon={UserCog} tone="primary" />
        <StatCard label="Admins"      value="3"  icon={ShieldCheck} />
        <StatCard label="Active 24h"  value="9"  tone="success" />
        <StatCard label="Audit events" value="2,103" icon={Activity} hint="Last 7 days" />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-display text-base font-semibold">Members</h2>
            <p className="text-xs text-muted-foreground">Manage roles and access to the workspace</p>
          </div>
          <Button size="sm">Invite member</Button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Last active</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.email} className="hover:bg-accent/40">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3 text-muted-foreground text-mono text-xs">{u.email}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={"h-5 border-transparent text-[10px] font-semibold uppercase tracking-wider " + roleStyle[u.role]}>
                    {u.role}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{u.last}</td>
                <td className="px-5 py-3 text-right">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Policies</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>· Two-factor authentication required for admins</li>
            <li>· Session timeout: 12h</li>
            <li>· Trade approval threshold: legendary</li>
            <li>· Bot rotation cadence: 24h</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h3 className="font-display text-base font-semibold">Danger zone</h3>
          <p className="mt-2 text-sm text-muted-foreground">Destructive actions. Each requires re-authentication.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm">Pause fleet</Button>
            <Button variant="outline" size="sm">Rotate all tokens</Button>
            <Button variant="destructive" size="sm">Wipe staging data</Button>
          </div>
        </div>
      </section>
    </>
  );
}
