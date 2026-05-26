import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, MessageCircle, BookOpen, Mail } from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Section } from "@/components/app-shell/Section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help — Radiant" }] }),
  component: Help,
});

const faqs = [
  { q: "How do I link an account?", a: "Open Accounts → Add account, paste the device token, then verify in the Nintendo callback." },
  { q: "Why is my hunt paused?", a: "Hunts auto-pause when bot health drops or the trade window closes. Resume from Hunts when conditions clear." },
  { q: "Can I export trade history?", a: "Yes — Trades → Export. CSV and JSON formats are supported." },
  { q: "What's the difference between gifts and trades?", a: "Gifts move items one way without consent prompts; trades are reciprocal and require both parties to confirm." },
];

function Help() {
  return (
    <>
      <PageHeader title="Help center" description="Guides, FAQs and ways to reach the team." />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { icon: BookOpen, title: "Read the docs", hint: "Setup, hunts, trading, automation" },
          { icon: MessageCircle, title: "Community chat", hint: "Ask the operator community" },
          { icon: Mail, title: "Contact support", hint: "9am–6pm UTC, Mon–Fri" },
        ].map((c) => (
          <button key={c.title} className="group rounded-xl border border-border bg-card/60 p-5 text-left transition-colors hover:bg-card">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><c.icon className="h-4 w-4" /></div>
            <div className="mt-3 font-display text-sm font-semibold">{c.title}</div>
            <div className="text-xs text-muted-foreground">{c.hint}</div>
          </button>
        ))}
      </div>

      <Section title="Search the knowledge base">
        <div className="flex gap-2">
          <Input placeholder="Search 240+ articles…" className="bg-background/40" />
          <Button>Search</Button>
        </div>
      </Section>

      <Section title="Frequently asked" className="mt-4">
        <div className="divide-y divide-border/60">
          {faqs.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
