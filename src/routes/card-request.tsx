import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Section } from "@/components/app-shell/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/card-request")({
  head: () => ({ meta: [{ title: "Card requests — Radiant" }] }),
  component: CardRequest,
});

const reqs = [
  { card: "Solar Crown",   from: "Nelle Park",  status: "open", age: "2h" },
  { card: "Halcyon Mark",  from: "Jules Ferris",status: "matched", age: "5h" },
  { card: "Gilded Pact",   from: "Arden Holt",  status: "fulfilled", age: "1d" },
  { card: "Quiet Lantern", from: "Kiera Vance", status: "open", age: "1d" },
];

const status: Record<string, string> = {
  open: "bg-warning/15 text-warning",
  matched: "bg-primary/15 text-primary",
  fulfilled: "bg-success/15 text-success",
};

function CardRequest() {
  return (
    <>
      <PageHeader title="Card requests" description="Open asks from the community and your active responses." actions={<Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New request</Button>} />

      <Section title="Open a request">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input placeholder="Card name…" className="bg-background/40" />
          <Input placeholder="Set (optional)" className="bg-background/40 md:max-w-[200px]" />
          <Button>Post</Button>
        </div>
      </Section>

      <Section title="Active requests" className="mt-4" padded={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-5 py-3">Card</th>
              <th className="px-5 py-3">From</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Age</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reqs.map((r, i) => (
              <tr key={i} className="hover:bg-accent/40">
                <td className="px-5 py-3 font-medium">{r.card}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{r.from}</td>
                <td className="px-5 py-3"><Badge variant="outline" className={"h-5 border-transparent text-[10px] uppercase " + status[r.status]}>{r.status}</Badge></td>
                <td className="px-5 py-3 text-right text-mono text-xs text-muted-foreground">{r.age}</td>
                <td className="px-5 py-3 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs">Respond</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
