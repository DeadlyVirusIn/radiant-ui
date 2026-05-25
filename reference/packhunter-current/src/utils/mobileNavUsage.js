/**
 * Adaptive mobile-nav usage tracker — Phase 16, mobile More menu only.
 *
 * Two localStorage keys:
 *   mobileNavUsage_v1   — { [path]: { clicks: number, lastUsed: ms } }
 *   mobileNavPinned_v1  — string[]  (max 4 paths)
 *
 * Scoring is intentionally simple and EXPLAINABLE so the operator can
 * understand why an item rose. No ML, no opaque heuristics.
 *
 *   score = clicks_norm * 0.7 + recency_score * 0.3
 *     clicks_norm    = min(clicks, 50) / 50   (capped — one spammer can't dominate)
 *     recency_score  = exp(-ageDays / 7)      (≈1.0 within last day, ≈0.5 at 7d, ≈0.13 at 14d)
 *
 * Stability rules (caller responsibility but enforced by sortByScore):
 *   - reorder only if score delta exceeds STABILITY_THRESHOLD vs default order
 *   - tie-break by the item's index in the original array (preserves default
 *     order so 0-click items don't churn each refresh)
 *
 * The sort is computed ONCE on drawer open; the component caches the result
 * for the session and re-computes only on the next open. This eliminates
 * flicker.
 */

'use strict';

export const USAGE_KEY  = 'mobileNavUsage_v1';
export const PINNED_KEY = 'mobileNavPinned_v1';
export const PIN_MAX    = 4;
export const SUGGESTED_LIMIT = 2;
export const STABILITY_THRESHOLD = 0.10;  // 10% — small score deltas keep default order
export const RECENCY_HALFLIFE_DAYS = 7;
export const CLICK_CAP = 50;

/* ── Storage I/O — fail silent so private/incognito browsers still work ── */

export function readUsage() {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch { return {}; }
}

export function writeUsage(usage) {
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(usage || {})); }
  catch { /* fail silent */ }
}

export function readPinned() {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(s => typeof s === 'string').slice(0, PIN_MAX);
  } catch { return []; }
}

export function writePinned(paths) {
  try {
    const safe = (paths || []).filter(s => typeof s === 'string').slice(0, PIN_MAX);
    localStorage.setItem(PINNED_KEY, JSON.stringify(safe));
  } catch { /* fail silent */ }
}

/** Increment clicks + lastUsed for `path`, persist, return the next usage map. */
export function recordClick(path, now = Date.now()) {
  if (!path) return readUsage();
  const usage = readUsage();
  const prev = usage[path] || { clicks: 0, lastUsed: 0 };
  const next = { ...usage, [path]: { clicks: (prev.clicks || 0) + 1, lastUsed: now } };
  writeUsage(next);
  return next;
}

/**
 * Toggle pin for `path`. Returns next pinned array. Caps at PIN_MAX.
 * `validPaths` (optional) filters out paths that aren't currently in the
 * MORE menu — e.g. ribbon paths or removed items.
 */
export function togglePin(path, { validPaths = null } = {}) {
  if (!path) return readPinned();
  if (validPaths && !validPaths.includes(path)) return readPinned();
  const cur = readPinned();
  let next;
  if (cur.includes(path)) next = cur.filter(p => p !== path);
  else if (cur.length >= PIN_MAX) return cur;          // capped — no-op
  else next = [...cur, path];
  writePinned(next);
  return next;
}

/** Hard reset — clears both usage and pinned. Used by the Reset shortcuts UI. */
export function resetShortcuts() {
  try { localStorage.removeItem(USAGE_KEY); } catch { /* */ }
  try { localStorage.removeItem(PINNED_KEY); } catch { /* */ }
}

/* ── Scoring + adaptive sort (pure) ──────────────────────────────────── */

/**
 * Compute the adaptive score for a single item's usage entry.
 * Range: [0, 1]. Items with no usage record return 0.
 */
export function scoreItem(usage, now = Date.now()) {
  if (!usage) return 0;
  const clicks = Number(usage.clicks) || 0;
  const lastUsed = Number(usage.lastUsed) || 0;

  const clicksNorm = Math.min(clicks, CLICK_CAP) / CLICK_CAP;
  const ageMs = Math.max(0, now - lastUsed);
  const ageDays = ageMs / (24 * 3600 * 1000);
  const recency = lastUsed > 0
    ? Math.exp(-ageDays / RECENCY_HALFLIFE_DAYS)
    : 0;

  return clicksNorm * 0.7 + recency * 0.3;
}

/**
 * Stable adaptive sort.
 *
 * Strategy: compute a score per item, then sort by score descending.
 * Stability guard: a pair-swap only happens when the score gap is greater
 * than STABILITY_THRESHOLD * maxScore. Otherwise the original order wins.
 *
 * `items` MUST already be deduped + filtered (no ribbon overlaps, no pinned
 * — caller filters pinned out before calling).
 *
 * Returns a NEW array; never mutates the input.
 */
export function sortByScore(items, usage = {}, { now = Date.now(), threshold = STABILITY_THRESHOLD } = {}) {
  if (!Array.isArray(items) || items.length <= 1) return items ? [...items] : [];

  const scored = items.map((item, idx) => ({
    item, idx, score: scoreItem(usage[item.path], now),
  }));

  const maxScore = scored.reduce((m, s) => Math.max(m, s.score), 0);
  // No data yet — return default order.
  if (maxScore <= 0) return items.slice();

  const minDelta = maxScore * threshold;

  // Selection-sort-ish stable pass: only swap when score gap is meaningful.
  // O(n^2) but n is tiny (mobile More menu = ≤ ~6 items).
  const out = scored.slice();
  for (let i = 0; i < out.length - 1; i++) {
    let bestIdx = i;
    for (let j = i + 1; j < out.length; j++) {
      const gap = out[j].score - out[bestIdx].score;
      if (gap > minDelta) bestIdx = j;
    }
    if (bestIdx !== i) {
      const tmp = out[i]; out[i] = out[bestIdx]; out[bestIdx] = tmp;
    }
  }
  return out.map(s => s.item);
}

/**
 * Build the three-section More menu output:
 *   { pinned, suggested, remaining }
 *
 * - pinned: user-pinned items in the order the user pinned them
 *   (preserves intent — newest pin appears last)
 * - suggested: top SUGGESTED_LIMIT non-pinned items by adaptive score
 * - remaining: everything else, in default array order
 *
 * `safeMoreItems` MUST already exclude any ribbon-overlap paths.
 */
export function buildMoreSections(safeMoreItems, {
  pinned = [],
  usage = {},
  now = Date.now(),
  suggestedLimit = SUGGESTED_LIMIT,
  threshold = STABILITY_THRESHOLD,
} = {}) {
  const items = Array.isArray(safeMoreItems) ? safeMoreItems : [];
  const validPaths = items.map(i => i.path);

  // Pinned section: only paths that are still valid + present in items.
  const pinnedItems = (pinned || [])
    .filter(p => validPaths.includes(p))
    .map(p => items.find(i => i.path === p))
    .filter(Boolean);

  const pinnedSet = new Set(pinnedItems.map(i => i.path));
  const unpinned = items.filter(i => !pinnedSet.has(i.path));

  // Adaptive sort over the unpinned remainder.
  const ranked = sortByScore(unpinned, usage, { now, threshold });
  const suggested = ranked.slice(0, suggestedLimit);
  const remaining = ranked.slice(suggestedLimit);

  return { pinned: pinnedItems, suggested, remaining };
}
