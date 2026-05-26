import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Radiant" }] }),
  component: Login,
});

function Login() {
  return (
    <div className="-m-4 grid min-h-[80vh] place-items-center md:-m-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/80 p-8 shadow-[0_24px_80px_-32px_var(--primary)] backdrop-blur">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/60">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-base font-bold">Radiant</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Ops Console</div>
          </div>
        </div>

        <h1 className="font-display text-xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your operator account.</p>

        <form className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@radiant.app" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full">Sign in</Button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          New here? <Link to="/" className="text-primary hover:underline">Request access</Link>
        </div>
      </div>
    </div>
  );
}
