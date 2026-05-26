import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleStop,
  Eraser,
  Filter as FilterIcon,
  Layers,
  Play,
  Save,
  Sparkles,
  Sliders,
  Terminal,
  Users,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { Section } from "@/components/app-shell/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bot-hub")({
  head: () => ({ meta: [{ title: "Bot Hub — Radiant" }] }),
  component: BotHub,
});

// ─── mock data (preserves the current placeholder approach) ────────────────
const ACCOUNTS = [
  { id: "main", name: "MainAccount", accepted: 142, friends: 38, errors: 2, lastActivity: "32s ago" },
  { id: "alt-1", name: "AltHunter-01", accepted: 87, friends: 21, errors: 0, lastActivity: "4m ago" },
  { id: "alt-2", name: "AltHunter-02", accepted: 53, friends: 14, errors: 5, lastActivity: "1h ago" },
];

type StatusKey = "running" | "starting" | "stopped" | "error";
const STATUS_META: Record<StatusKey, { label: string; tone: string; dot: string }> = {
  running:  { label: "Running",  tone: "bg-success/15 text-success border-success/30",     dot: "bg-success" },
  starting: { label: "Starting", tone: "bg-primary/15 text-primary border-primary/30",     dot: "bg-primary animate-pulse" },
  stopped:  { label: "Stopped",  tone: "bg-muted text-muted-foreground border-border",     dot: "bg-muted-foreground" },
  error:    { label: "Error",    tone: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
};

const ERAS = ["A1", "A2", "A3", "A4"] as const;
type Era = typeof ERAS[number];

const EXPANSIONS: Record<Era, { id: string; name: string; packs: { id: string; name: string }[] }[]> = {
  A1: [
    { id: "a1-base",   name: "Genetic Apex",      packs: [{ id: "ga-mew", name: "Mewtwo" }, { id: "ga-cha", name: "Charizard" }, { id: "ga-pik", name: "Pikachu" }] },
    { id: "a1-myst",   name: "Mythical Island",   packs: [{ id: "mi-mew", name: "Mew" }] },
  ],
  A2: [
    { id: "a2-space",  name: "Space-Time Smackdown", packs: [{ id: "sts-dia", name: "Dialga" }, { id: "sts-pal", name: "Palkia" }] },
    { id: "a2-tri",    name: "Triumphant Light",  packs: [{ id: "tl-arc", name: "Arceus" }] },
  ],
  A3: [
    { id: "a3-cel",    name: "Celestial Guardians", packs: [{ id: "cg-sol", name: "Solgaleo" }, { id: "cg-lun", name: "Lunala" }] },
    { id: "a3-ext",    name: "Extradimensional Crisis", packs: [{ id: "ec-buz", name: "Buzzwole" }] },
  ],
  A4: [
    { id: "a4-wis",    name: "Wisdom of Sea & Sky", packs: [{ id: "wss-ho", name: "Ho-Oh" }, { id: "wss-lu", name: "Lugia" }] },
    { id: "a4-eev",    name: "Eevee Grove",        packs: [{ id: "eg-syl", name: "Sylveon" }, { id: "eg-umb", name: "Umbreon" }, { id: "eg-esp", name: "Espeon" }] },
  ],
};

const TIERS = [0, 1, 2, 3, 4, 5] as const;

const MOCK_LOGS = [
  { t: "14:02:11", level: "info",  msg: "Bot started for MainAccount" },
  { t: "14:02:14", level: "info",  msg: "Connected to hunt server (ws)" },
  { t: "14:02:18", level: "debug", msg: "Subscribed to 12 packs across A4 era" },
  { t: "14:03:02", level: "info",  msg: "Accepted invite from trainer #4821" },
  { t: "14:03:47", level: "warn",  msg: "Pack 'Eevee Grove · Sylveon' temporarily unavailable, retrying" },
  { t: "14:04:09", level: "info",  msg: "Friend kept: trainer #4821 (3/5 god pack hit)" },
  { t: "14:05:33", level: "error", msg: "Network timeout while polling pack 'Lunala' — backoff 30s" },
  { t: "14:06:04", level: "info",  msg: "Recovered, resuming hunt loop" },
  { t: "14:07:21", level: "info",  msg: "Wishlist match: 'Mewtwo ex' detected, alert dispatched" },
];

// ─── component ─────────────────────────────────────────────────────────────
function BotHub() {
  const [accountId, setAccountId] = useState(ACCOUNTS[0].id);
  const account = ACCOUNTS.find((a) => a.id === accountId)!;
  const [status, setStatus] = useState<StatusKey>("running");
  const [tab, setTab] = useState("packs");

  // packs state
  const [era, setEra] = useState<Era>("A4");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(
    () => new Set(["wss-ho", "wss-lu", "eg-syl", "eg-umb"]),
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // settings state
  const [gpAlerts, setGpAlerts] = useState(true);
  const [pseudoPacks, setPseudoPacks] = useState(false);
  const [keepFriend, setKeepFriend] = useState(true);
  const [tiers, setTiers] = useState<Set<number>>(() => new Set([3, 4, 5]));
  const [settingsDirty, setSettingsDirty] = useState(false);

  // filters state
  const [keep31, setKeep31] = useState(true);
  const [keep22, setKeep22] = useState(true);
  const [twoStar, setTwoStar] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [filtersDirty, setFiltersDirty] = useState(false);

  // logs
  const [autoScroll, setAutoScroll] = useState(true);
  const [logs, setLogs] = useState(MOCK_LOGS);
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll, tab]);

  const meta = STATUS_META[status];
  const running = status === "running" || status === "starting";

  const totalPacksInEra = EXPANSIONS[era].reduce((n, g) => n + g.packs.length, 0);
  const selectedInEra = EXPANSIONS[era].reduce(
    (n, g) => n + g.packs.filter((p) => selectedPacks.has(p.id)).length,
    0,
  );

  const togglePack = (id: string) =>
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const joinAll = () =>
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      EXPANSIONS[era].forEach((g) => g.packs.forEach((p) => next.add(p.id)));
      return next;
    });
  const leaveAll = () =>
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      EXPANSIONS[era].forEach((g) => g.packs.forEach((p) => next.delete(p.id)));
      return next;
    });

  const toggleTier = (n: number) => {
    setTiers((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
    setSettingsDirty(true);
  };

  const tierSummary = useMemo(
    () =>
      [...tiers]
        .sort((a, b) => a - b)
        .map((t) => `${t}/5`)
        .join(" · ") || "None",
    [tiers],
  );

  const jumpTo = (t: string) => setTab(t);

  return (
    <>
      <PageHeader
        title="Bot Hub"
        description="Configure and run the hunt bot for a single account."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 w-[180px] bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTS.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant="outline"
              className={cn("h-9 gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-wider", meta.tone)}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
              {meta.label}
            </Badge>
            {running ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStatus("stopped")}>
                <CircleStop className="h-3.5 w-3.5" /> Stop bot
              </Button>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => { setStatus("starting"); setTimeout(() => setStatus("running"), 800); }}>
                <Play className="h-3.5 w-3.5" /> Start bot
              </Button>
            )}
          </div>
        }
      />

      {/* hero metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Accepted"      value={String(account.accepted)} icon={CheckCircle2} tone="success" />
        <StatCard label="Friends"       value={String(account.friends)}  icon={Users}        tone="primary" />
        <StatCard label="Errors"        value={String(account.errors)}   icon={AlertTriangle} tone={account.errors > 0 ? "warning" : "default"} />
        <StatCard label="Last activity" value={account.lastActivity}     icon={Activity} />
      </div>

      {/* active configuration summary */}
      <Section title="Active configuration" description="Live snapshot of what the bot is hunting for this account." className="mt-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <SummaryChip label="Selected packs" value={String(selectedPacks.size)} onClick={() => jumpTo("packs")} />
          <SummaryChip label="Era"            value={era}                         onClick={() => jumpTo("packs")} />
          <SummaryChip label="Tiers"          value={tierSummary}                 onClick={() => jumpTo("settings")} />
          <SummaryChip label="God Pack alerts" value={gpAlerts ? "ON" : "OFF"}    tone={gpAlerts ? "primary" : "muted"} onClick={() => jumpTo("settings")} />
          <SummaryChip label="Pseudo packs"   value={pseudoPacks ? "ON" : "OFF"} tone={pseudoPacks ? "primary" : "muted"} onClick={() => jumpTo("settings")} />
          <SummaryChip label="Keep as friend" value={keepFriend ? "ON" : "OFF"}  tone={keepFriend ? "primary" : "muted"} onClick={() => jumpTo("settings")} />
          <SummaryChip label="Wishlist filter" value={wishlistOnly ? "ON" : "OFF"} tone={wishlistOnly ? "primary" : "muted"} onClick={() => jumpTo("filters")} />
          <SummaryChip label="Pattern filters" value={[keep31 && "3+1", keep22 && "2x2", twoStar && "2★"].filter(Boolean).join(" · ") || "None"} onClick={() => jumpTo("filters")} />
        </div>
      </Section>

      {/* tabs */}
      <div className="mt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4 md:w-auto md:inline-flex">
            <TabsTrigger value="packs" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Packs</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Sliders className="h-3.5 w-3.5" /> Settings</TabsTrigger>
            <TabsTrigger value="filters" className="gap-1.5"><FilterIcon className="h-3.5 w-3.5" /> Hunt Filters</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><Terminal className="h-3.5 w-3.5" /> Logs</TabsTrigger>
          </TabsList>

          {/* PACKS */}
          <TabsContent value="packs" className="mt-4 space-y-4">
            {/* sticky action row */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Era</span>
                <div className="flex rounded-md border border-border bg-background/40 p-0.5">
                  {ERAS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEra(e)}
                      className={cn(
                        "h-7 rounded px-2.5 text-xs font-semibold transition-colors",
                        era === e ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >{e}</button>
                  ))}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-mono text-xs text-muted-foreground">{selectedInEra}/{totalPacksInEra} selected in {era}</span>
                <Button size="sm" variant="outline" onClick={leaveAll}>Leave all</Button>
                <Button size="sm" onClick={joinAll}>Join all</Button>
              </div>
            </div>

            {/* expansion groups */}
            <div className="space-y-3">
              {EXPANSIONS[era].map((group) => {
                const open = openGroups[group.id] ?? true;
                const groupSelected = group.packs.filter((p) => selectedPacks.has(p.id)).length;
                return (
                  <div key={group.id} className="overflow-hidden rounded-xl border border-border bg-card/60">
                    <button
                      onClick={() => setOpenGroups((g) => ({ ...g, [group.id]: !open }))}
                      className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-accent/40"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                        <span className="font-display text-sm font-semibold">{group.name}</span>
                        <Badge variant="outline" className="h-5 border-transparent bg-muted text-[10px] text-muted-foreground">{group.packs.length} packs</Badge>
                      </div>
                      <span className="text-mono text-xs text-muted-foreground">{groupSelected}/{group.packs.length}</span>
                    </button>
                    {open && (
                      <div className="grid grid-cols-1 gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {group.packs.map((p) => {
                          const on = selectedPacks.has(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePack(p.id)}
                              className={cn(
                                "flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                                on
                                  ? "border-primary/40 bg-primary/10 hover:bg-primary/15"
                                  : "border-border bg-background/30 hover:bg-accent/40",
                              )}
                            >
                              <div>
                                <div className="text-sm font-semibold">{p.name}</div>
                                <div className="text-[11px] text-muted-foreground">{group.name}</div>
                              </div>
                              <Badge variant="outline" className={cn("h-5 border text-[10px] uppercase", on ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground")}>
                                {on ? "Joined" : "Off"}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* advanced distribution */}
            <div className="overflow-hidden rounded-xl border border-border bg-card/60">
              <button
                onClick={() => setAdvancedOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-accent/40"
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span className="font-display text-sm font-semibold">Advanced distribution</span>
                  <span className="text-[11px] text-muted-foreground">Per-pack weighting</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !advancedOpen && "-rotate-90")} />
              </button>
              {advancedOpen && (
                <div className="border-t border-border p-5">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Fine-tune relative weights for selected packs. Defaults to uniform distribution.
                  </p>
                  <div className="space-y-2">
                    {[...selectedPacks].slice(0, 5).map((id) => (
                      <div key={id} className="flex items-center gap-3 rounded-md border border-border bg-background/30 px-3 py-2">
                        <span className="text-mono text-xs text-muted-foreground w-24">{id}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${100 / selectedPacks.size}%` }} />
                        </div>
                        <span className="text-mono text-xs w-12 text-right">{(100 / Math.max(1, selectedPacks.size)).toFixed(0)}%</span>
                      </div>
                    ))}
                    {selectedPacks.size === 0 && (
                      <p className="text-sm text-muted-foreground">Join at least one pack to configure distribution.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="mt-4 space-y-4">
            <Section title="Bot behavior">
              <div className="space-y-1">
                <ToggleRow icon={Sparkles} label="God Pack alerts" hint="Notify when a god pack is detected during a hunt." checked={gpAlerts} onChange={(v) => { setGpAlerts(v); setSettingsDirty(true); }} />
                <ToggleRow icon={Layers}   label="Pseudo packs"     hint="Include pseudo-pack opportunities in hunt loop."  checked={pseudoPacks} onChange={(v) => { setPseudoPacks(v); setSettingsDirty(true); }} />
                <ToggleRow icon={Users}    label="Keep as friend"   hint="Auto-keep trainers that yield a qualifying pull."  checked={keepFriend} onChange={(v) => { setKeepFriend(v); setSettingsDirty(true); }} />
              </div>
            </Section>

            <Section title="Tier selection" description="Pulls matching any selected tier will be kept.">
              <div className="flex flex-wrap gap-2">
                {TIERS.map((n) => {
                  const on = tiers.has(n);
                  return (
                    <button
                      key={n}
                      onClick={() => toggleTier(n)}
                      className={cn(
                        "h-9 min-w-[58px] rounded-lg border px-3 text-sm font-semibold transition-colors",
                        on
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border bg-background/30 text-muted-foreground hover:text-foreground",
                      )}
                    >{n}/5</button>
                  );
                })}
              </div>
              {tiers.size === 0 && (
                <p className="mt-3 text-xs text-warning">Select at least one tier to keep the bot productive.</p>
              )}
            </Section>

            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" disabled={!settingsDirty || tiers.size === 0} onClick={() => setSettingsDirty(false)}>
                <Save className="h-3.5 w-3.5" /> Save settings
              </Button>
            </div>
          </TabsContent>

          {/* HUNT FILTERS */}
          <TabsContent value="filters" className="mt-4 space-y-4">
            <Section title="Pattern filters" description="Keep packs that match specific reveal patterns.">
              <div className="space-y-1">
                <ToggleRow label="Keep 3+1 packs"   hint="Three matching rarities plus one bonus."     checked={keep31}  onChange={(v) => { setKeep31(v);  setFiltersDirty(true); }} />
                <ToggleRow label="Keep 2x2 packs"   hint="Two pairs of matching rarities."             checked={keep22}  onChange={(v) => { setKeep22(v);  setFiltersDirty(true); }} />
                <ToggleRow label="2-star variants"  hint="Include 2★ alternate art reveals."           checked={twoStar} onChange={(v) => { setTwoStar(v); setFiltersDirty(true); }} />
              </div>
            </Section>

            <Section title="Wishlist filter">
              <ToggleRow label="Only notify if wishlisted cards found" hint="Suppresses alerts that don't match your wishlist." checked={wishlistOnly} onChange={(v) => { setWishlistOnly(v); setFiltersDirty(true); }} />
            </Section>

            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" disabled={!filtersDirty} onClick={() => setFiltersDirty(false)}>
                <Save className="h-3.5 w-3.5" /> Save filters
              </Button>
            </div>
          </TabsContent>

          {/* LOGS */}
          <TabsContent value="logs" className="mt-4">
            <Section
              title="Live logs"
              actions={
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
                    Auto-scroll
                  </label>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLogs([])}>
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </Button>
                </div>
              }
              padded={false}
            >
              <ScrollArea className="h-[420px]">
                <div className="text-mono space-y-0.5 p-4 text-xs leading-relaxed">
                  {logs.length === 0 && <div className="text-muted-foreground">No logs yet — start the bot to stream activity.</div>}
                  {logs.map((l, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-muted-foreground/70">{l.t}</span>
                      <span className={cn(
                        "uppercase",
                        l.level === "error" && "text-destructive",
                        l.level === "warn"  && "text-warning",
                        l.level === "info"  && "text-primary",
                        l.level === "debug" && "text-muted-foreground",
                      )}>{l.level.padEnd(5)}</span>
                      <span className="text-foreground/90">{l.msg}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// ─── small subcomponents ───────────────────────────────────────────────────
function SummaryChip({
  label, value, tone = "default", onClick,
}: { label: string; value: string; tone?: "default" | "primary" | "muted"; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-1 rounded-lg border border-border bg-background/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className={cn(
        "text-mono text-sm font-semibold",
        tone === "primary" && "text-primary",
        tone === "muted"   && "text-muted-foreground",
      )}>{value}</span>
    </button>
  );
}

function ToggleRow({
  icon: Icon, label, hint, checked, onChange,
}: {
  icon?: typeof Bot;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />}
        <div>
          <div className="text-sm font-medium">{label}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
