/**
 * Phase 17 — cross-device nav preferences (pinned shortcuts).
 *
 * Sync model:
 *
 *   On hydrate (app load / login)
 *     - GET /api/user/prefs/nav
 *     - if server has pinnedShortcuts.length > 0 → use server, mirror to local
 *     - if server is empty AND local has pins → push local up to server
 *     - if both empty → no-op
 *
 *   On toggle (user pin/unpin)
 *     - update local immediately (snappy UX)
 *     - debounced PUT to server
 *
 *   On any failure (offline, 401, 5xx)
 *     - silently fall back to local — the menu MUST keep working
 *
 *   On logout / 401
 *     - keep local data; nothing destructive
 *
 * The helper is API-shaped, not React-shaped, so the existing
 * MobileBottomNav can keep its current state model. Pure I/O.
 */

'use strict';

import { readPinned, writePinned, PIN_MAX } from './mobileNavUsage';

const ENDPOINT = '/api/user/prefs/nav';
const SYNC_DEBOUNCE_MS = 1500;
const HYDRATE_TIMEOUT_MS = 4000;
const RIBBON_PATHS = new Set(['/', '/hunt', '/friends', '/wonder-pick']);

let pendingSaveTimer = null;
let lastHydratedAt = 0;
let inFlightSave = null;

function safeFetch(url, init = {}) {
  // AbortController so a stuck server can't hang hydration forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HYDRATE_TIMEOUT_MS);
  return fetch(url, { credentials: 'include', signal: ctrl.signal, ...init })
    .finally(() => clearTimeout(timer));
}

function sanitizeClient(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    if (!v.startsWith('/')) continue;
    if (RIBBON_PATHS.has(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= PIN_MAX) break;
  }
  return out;
}

/**
 * Hydrate pinned shortcuts from server. Returns the canonical pinned array.
 * Caller should call this once on app load (after auth resolves) and use
 * the returned array as the initial state.
 *
 * Promotion rule: if the server has empty prefs but local has pins, push
 * local up so the user doesn't lose their pins after first login on a
 * fresh device.
 */
export async function hydratePinned() {
  const localPins = readPinned();
  try {
    const res = await safeFetch(ENDPOINT, { method: 'GET' });
    if (!res.ok) {
      // Auth or server failure — keep local. Silent.
      return sanitizeClient(localPins);
    }
    const data = await res.json();
    const serverPins = sanitizeClient(data?.pinnedShortcuts);
    lastHydratedAt = Date.now();

    if (serverPins.length > 0) {
      // Server wins — mirror to local cache so offline reload is consistent.
      writePinned(serverPins);
      return serverPins;
    }
    // Server empty but local has pins → promote local up.
    if (localPins.length > 0) {
      // Fire-and-forget; do not block hydration on the promotion PUT.
      saveToServer(localPins);
    }
    return localPins;
  } catch {
    // Offline / abort / parse error — local fallback.
    return sanitizeClient(localPins);
  }
}

/**
 * Save pinned shortcuts to server. Debounced to avoid flooding the API
 * when the user toggles several pins in quick succession.
 *
 * Always writes the local cache immediately (callers already do this via
 * mobileNavUsage.togglePin). This function is only the network leg.
 */
export function saveToServer(pinnedShortcuts) {
  const safe = sanitizeClient(pinnedShortcuts);
  if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
  pendingSaveTimer = setTimeout(async () => {
    pendingSaveTimer = null;
    inFlightSave = (async () => {
      try {
        await safeFetch(ENDPOINT, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinnedShortcuts: safe }),
        });
      } catch {
        // Silent fallback — local cache already holds the value, the next
        // successful save will reconcile.
      } finally {
        inFlightSave = null;
      }
    })();
  }, SYNC_DEBOUNCE_MS);
}

/** Immediate save, awaitable — used by the explicit Reset action. */
export async function saveToServerNow(pinnedShortcuts) {
  const safe = sanitizeClient(pinnedShortcuts);
  if (pendingSaveTimer) { clearTimeout(pendingSaveTimer); pendingSaveTimer = null; }
  try {
    await safeFetch(ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinnedShortcuts: safe }),
    });
  } catch { /* silent */ }
}

/** Test / debug. */
export function _internalState() {
  return { pendingSaveTimer: !!pendingSaveTimer, lastHydratedAt, inFlight: !!inFlightSave };
}

export { sanitizeClient as _sanitize };
