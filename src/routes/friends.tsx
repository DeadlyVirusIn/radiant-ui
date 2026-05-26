import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Users, UserPlus, Gift, Heart, Sparkles, ArrowRight, Check, X,
  Repeat2, Share2, Wand2, MessageCircle,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/PageHeader";
import { StatCard } from "@/components/app-shell/StatCard";
import { CrossLink } from "@/components/app-shell/CrossLink";
import { Hero } from "@/components/app-shell/Hero";
import { HandoffStrip } from "@/components/app-shell/HandoffStrip";
import { ProgressBar } from "@/components/app-shell/ProgressBar";
import { RewardChip } from "@/components/app-shell/RewardChip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  FRIENDS, STATUS_META, getFriendsSummary, recommendedFriend, formatLastSeen,
  type Friend, type FriendStatus,
} from "@/lib/mock-friends";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [{ title: "Friends — Radiant" }] }),
  component: FriendsPage,
});

function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>(FRIENDS);
  const summary = useMemo(() => getFriendsSummary(friends), [friends]);
  const featured = useMemo(() => recommendedFriend(friends), [friends]);

  const active = friends.filter((f) => f.state === "active");
  const online = active.filter((f) => f.status === "online");
  const offline = active.filter((f) => f.status !== "online");
  const pending = friends.filter((f) => f.state !== "active");

  const acceptPending = (id: string) => {
    setFriends((prev) => prev.map((f) => (f.id === id ? { ...f, state: "active" as const } : f)));
    toast.success("Friend added");
  };
  const declinePending = (id: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
    toast("Request dismissed");
  };

  const giftReadyTotal = summary.giftReady;

  return (
    <>
      <PageHeader
        title="Friends"
        description="Who can help you finish your collection today?"
        actions={
          <Button size="sm" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Add friend
          </Button>
        }
      />

      <Hero
        eyebrow="Best to act on"
        eyebrowIcon={Sparkles}
        title={featured ? `Trade with ${featured.name}` : "No wishlist matches in your network"}
        subtitle={
          featured
            ? `${featured.wishlistMatches} of your wishlist card${featured.wishlistMatches === 1 ? "" : "s"} sitting in their dupes · ${formatLastSeen(featured.lastSeenHours, featured.status)}`
            : "Add friends or refresh your wishlist to see live matches."
        }
        right={
          featured ? (
            <FriendAvatar name={featured.name} status={featured.status} size={72} />
          ) : undefined
        }
      >
        {featured && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to="/trades">
              <Button size="sm">
                Open trade <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link to="/wishlist">
              <Button size="sm" variant="outline">View wishlist</Button>
            </Link>
            <span className="text-[11px] text-muted-foreground">
              {featured.giftableMatches} of their wishlist match your dupes too.
            </span>
          </div>
        )}
      </Hero>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Friends"          value={String(summary.total)}                icon={Users}  />
        <StatCard label="Online"           value={String(summary.online)}               tone="success" />
        <StatCard label="Wishlist matches" value={String(summary.wishlistMatchesToday)} icon={Heart}  tone="warning" />
        <StatCard label="Gift-ready"       value={String(summary.giftReady)}            icon={Gift}   tone="primary" />
      </div>

      <Tabs defaultValue="online" className="mt-6">
        <TabsList>
          <TabsTrigger value="online">
            Online<span className="ml-1.5 text-[10px] text-muted-foreground">{online.length}</span>
          </TabsTrigger>
          <TabsTrigger value="all">
            All<span className="ml-1.5 text-[10px] text-muted-foreground">{active.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending<span className="ml-1.5 text-[10px] text-muted-foreground">{pending.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="online" className="mt-4">
          <FriendGrid items={online} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <FriendGrid items={[...online, ...offline]} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <PendingList items={pending} onAccept={acceptPending} onDecline={declinePending} />
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <HandoffStrip
          to="/sharing-cards"
          icon={Share2}
          tone={giftReadyTotal > 0 ? "primary" : "success"}
          title={
            giftReadyTotal > 0
              ? `${giftReadyTotal} duplicate${giftReadyTotal === 1 ? "" : "s"} ready to auto-gift`
              : "Auto-gift rules are caught up"
          }
          hint="Route duplicates to friends automatically in Sharing cards."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <CrossLink to="/trades"        icon={Repeat2}       title="Trades"        hint="Open or settle a live trade." />
        <CrossLink to="/wonder-pick"   icon={Wand2}         title="Wonder pick"   hint="Pick from a friend's pack." />
        <CrossLink to="/wishlist"      icon={Heart}         title="Wishlist"      hint="Update what you're chasing." />
      </div>
    </>
  );
}

function FriendGrid({ items }: { items: Friend[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Nobody here right now.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {items.map((f) => <FriendRow key={f.id} friend={f} />)}
    </div>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const hasMatch = friend.wishlistMatches > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-background/30 p-3 transition-colors sm:flex-row sm:items-center",
        hasMatch ? "border-warning/40 bg-warning/5" : "border-border",
      )}
    >
      <FriendAvatar name={friend.name} status={friend.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{friend.name}</span>
          {hasMatch && (
            <Badge variant="outline" className="h-5 border-warning/40 bg-warning/10 text-[10px] font-semibold text-warning">
              <Heart className="mr-1 h-3 w-3" /> {friend.wishlistMatches} wishlist match
            </Badge>
          )}
          {friend.reason && !hasMatch && (
            <Badge variant="outline" className="h-5 border-border bg-muted/40 text-[10px] font-normal text-muted-foreground">
              {friend.reason}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {formatLastSeen(friend.lastSeenHours, friend.status)} · {friend.trades} trades · {friend.daysFriends}d friends
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:flex-col sm:items-end">
        <Link to="/trades">
          <Button size="sm" className="h-7 text-xs">
            Trade <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          <MessageCircle className="mr-1 h-3 w-3" /> Message
        </Button>
      </div>
    </div>
  );
}

function PendingList({
  items, onAccept, onDecline,
}: { items: Friend[]; onAccept: (id: string) => void; onDecline: (id: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        No pending requests.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/30 p-3">
          <FriendAvatar name={f.name} status="offline" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{f.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {f.state === "pending_in" ? "Wants to be friends" : "Request sent"}
            </div>
          </div>
          {f.state === "pending_in" ? (
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={() => onAccept(f.id)}>
                <Check className="mr-1 h-3 w-3" /> Accept
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onDecline(f.id)}>
                <X className="mr-1 h-3 w-3" /> Decline
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onDecline(f.id)}>
              Cancel
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function FriendAvatar({
  name, status, size = 36,
}: { name: string; status: FriendStatus; size?: number }) {
  const meta = STATUS_META[status];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="grid place-items-center rounded-full bg-gradient-to-br from-primary/30 via-card to-card text-xs font-semibold ring-1 ring-border"
        style={{ width: size, height: size, fontSize: Math.round(size / 2.6) }}
      >
        {name[0]}
      </div>
      <span
        className={cn("absolute bottom-0 right-0 rounded-full ring-2 ring-card", meta.dotClass)}
        style={{ height: Math.max(8, Math.round(size / 4)), width: Math.max(8, Math.round(size / 4)) }}
        aria-label={meta.label}
      />
    </div>
  );
}

// Suppress unused-import warnings for ProgressBar/RewardChip in case future iterations reuse them.
void ProgressBar; void RewardChip;
