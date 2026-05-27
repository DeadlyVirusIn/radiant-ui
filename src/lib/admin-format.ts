/**
 * Canonical formatter helpers for admin ops surfaces.
 *
 * These are the union of the per-mock-lib helpers that have accumulated across
 * audit / activity / integrity / scheduler. They are introduced as a shared
 * module so new surfaces can pick a single source of truth; existing mock-lib
 * helpers are intentionally left in place to preserve byte-for-byte output of
 * already-frozen drawers (their signatures and edge cases vary subtly).
 *
 * Migration of existing call sites is deferred.
 */

/** Bidirectional relative time ("5m ago", "in 12m", "—"). Matches integrity/scheduler. */
export function fmtRelFrom(ts: number | null): string {
  if (ts == null) return "—";
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60_000);
  const tag = diff >= 0 ? "in " : "";
  const suffix = diff >= 0 ? "" : " ago";
  if (m < 60) return `${tag}${m}m${suffix}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${tag}${h}h${suffix}`;
  return `${tag}${Math.floor(h / 24)}d${suffix}`;
}

/** Past-only relative time ("5s ago" … "3d ago"). Matches audit/activity. */
export function fmtRelPast(ts: number, ref: number = Date.now()): string {
  const diff = Math.max(0, ref - ts);
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Locale timestamp, null-safe. Matches integrity/scheduler. */
export function fmtTs(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString() : "—";
}

/** ISO-ish timestamp ("YYYY-MM-DD HH:MM:SSZ"). Matches activity. */
export function fmtTsIso(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + "Z";
}

/** Duration in ms → human string. Matches scheduler `fmtDurMs`. */
export function fmtDurMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Duration in ms → human string. Matches audit `fmtDuration` (2-dp under 10s). */
export function fmtDuration(ms?: number): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

/** Short age ("12m", "3h") used by mini list rows. */
export function fmtAgeShort(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}
