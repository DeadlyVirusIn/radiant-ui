// Mock data + helpers for /friends — collector-first social surface.

export type FriendStatus = "online" | "away" | "offline";
export type FriendState = "active" | "pending_in" | "pending_out";

export type Friend = {
  id: string;
  name: string;
  status: FriendStatus;
  state: FriendState;
  /** Days since friendship started — drives "Friends ≥ 3d" sharing eligibility. */
  daysFriends: number;
  /** Wishlist cards this friend currently has spare. */
  wishlistMatches: number;
  /** Cards you have that match this friend's wishlist. */
  giftableMatches: number;
  /** Trades completed lifetime with this friend. */
  trades: number;
  /** Hours since last interaction (trade, gift, or message). */
  lastSeenHours: number;
  /** Optional pinned reason for why they appear in "today". */
  reason?: string;
};

export const FRIENDS: Friend[] = [
  { id: "f-nelle", name: "Nelle",  status: "online",  state: "active", daysFriends: 42, wishlistMatches: 3, giftableMatches: 5, trades: 27, lastSeenHours: 0,  reason: "3 of your wishlist cards spare" },
  { id: "f-jules", name: "Jules",  status: "online",  state: "active", daysFriends: 18, wishlistMatches: 1, giftableMatches: 2, trades: 14, lastSeenHours: 1 },
  { id: "f-arden", name: "Arden",  status: "online",  state: "active", daysFriends: 6,  wishlistMatches: 2, giftableMatches: 1, trades: 4,  lastSeenHours: 0 },
  { id: "f-kiera", name: "Kiera",  status: "away",    state: "active", daysFriends: 90, wishlistMatches: 0, giftableMatches: 3, trades: 41, lastSeenHours: 2 },
  { id: "f-soren", name: "Soren",  status: "online",  state: "active", daysFriends: 2,  wishlistMatches: 1, giftableMatches: 0, trades: 1,  lastSeenHours: 0 },
  { id: "f-bree",  name: "Bree",   status: "offline", state: "active", daysFriends: 31, wishlistMatches: 0, giftableMatches: 4, trades: 19, lastSeenHours: 14 },
  { id: "f-onyx",  name: "Onyx",   status: "offline", state: "active", daysFriends: 11, wishlistMatches: 1, giftableMatches: 0, trades: 7,  lastSeenHours: 36 },
  { id: "f-vex",   name: "Vex",    status: "away",    state: "active", daysFriends: 55, wishlistMatches: 0, giftableMatches: 2, trades: 23, lastSeenHours: 8 },
  { id: "f-quill", name: "Quill",  status: "offline", state: "active", daysFriends: 67, wishlistMatches: 0, giftableMatches: 0, trades: 12, lastSeenHours: 72 },
  { id: "f-mira",  name: "Mira",   status: "online",  state: "active", daysFriends: 4,  wishlistMatches: 2, giftableMatches: 1, trades: 2,  lastSeenHours: 0 },
  // Pending
  { id: "f-pi-1",  name: "Halcyon", status: "offline", state: "pending_in",  daysFriends: 0, wishlistMatches: 0, giftableMatches: 0, trades: 0, lastSeenHours: 1 },
  { id: "f-pi-2",  name: "Indigo",  status: "offline", state: "pending_in",  daysFriends: 0, wishlistMatches: 0, giftableMatches: 0, trades: 0, lastSeenHours: 3 },
  { id: "f-po-1",  name: "Cassio",  status: "offline", state: "pending_out", daysFriends: 0, wishlistMatches: 0, giftableMatches: 0, trades: 0, lastSeenHours: 22 },
];

export const STATUS_META: Record<FriendStatus, { label: string; dotClass: string }> = {
  online:  { label: "Online",  dotClass: "bg-success" },
  away:    { label: "Away",    dotClass: "bg-warning" },
  offline: { label: "Offline", dotClass: "bg-muted-foreground/40" },
};

export function formatLastSeen(hours: number, status: FriendStatus): string {
  if (status === "online") return "Online now";
  if (hours < 1) return "Active just now";
  if (hours < 24) return `Active ${hours}h ago`;
  const d = Math.round(hours / 24);
  return `Active ${d}d ago`;
}

export type FriendsSummary = {
  total: number;
  online: number;
  wishlistMatchesToday: number;
  giftReady: number;
  pendingIn: number;
};

export function getFriendsSummary(items: Friend[] = FRIENDS): FriendsSummary {
  const active = items.filter((f) => f.state === "active");
  return {
    total: active.length,
    online: active.filter((f) => f.status === "online").length,
    wishlistMatchesToday: active.reduce((n, f) => n + f.wishlistMatches, 0),
    giftReady: active.reduce((n, f) => n + f.giftableMatches, 0),
    pendingIn: items.filter((f) => f.state === "pending_in").length,
  };
}

/**
 * Best friend to act on today: highest wishlist matches, then online status,
 * then most-recently active. Returns null if no one has matches.
 */
export function recommendedFriend(items: Friend[] = FRIENDS): Friend | null {
  const candidates = items
    .filter((f) => f.state === "active" && f.wishlistMatches > 0)
    .sort((a, b) => {
      if (b.wishlistMatches !== a.wishlistMatches) return b.wishlistMatches - a.wishlistMatches;
      const aOn = a.status === "online" ? 1 : 0;
      const bOn = b.status === "online" ? 1 : 0;
      if (bOn !== aOn) return bOn - aOn;
      return a.lastSeenHours - b.lastSeenHours;
    });
  return candidates[0] ?? null;
}
