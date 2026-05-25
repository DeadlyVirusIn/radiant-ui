/**
 * API Service - HTTP requests to backend
 *
 * Wave 1 upgrades:
 *   - In-flight GET dedup: identical GETs made in the same tick share one
 *     network call. Response is cloned per caller so each gets its own
 *     readable Response body.
 *   - Single retry on 429 with Retry-After + jitter. One retry only —
 *     never blind loops.
 *   - Telemetry hooks into requestTelemetry for validation visibility.
 *
 * Compatible with all existing callers: the return type is still a Response
 * object (or throws on error).
 */

import * as telemetry from './requestTelemetry';

const API_BASE = '/api';

// Legacy localStorage token helpers (kept for migration — cookie is primary)
export function setToken() {
  // No-op: token is now stored as httpOnly cookie by the server
}

export function clearToken() {
  localStorage.removeItem('token');
}

// ── In-flight GET dedup ────────────────────────────────────────────────
// Key: `${method}:${fullUrl}` for GET only (mutations must not share).
// Value: Promise<Response> — first caller kicks off the real fetch, all
// subsequent callers in the same tick receive a .clone() of the same
// Response. Entry is cleared as soon as the underlying promise settles.
const inflight = new Map();

function inflightKey(method, url, body) {
  // Only dedup GET/HEAD — mutations with the same URL can be legitimately
  // distinct (two simultaneous PATCHes on different cards, etc.)
  if (method !== 'GET' && method !== 'HEAD') return null;
  return `${method}:${url}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Single-retry on 429 respecting Retry-After (seconds) + small jitter.
// Returns the final Response or throws.
async function fetchWithRetry(fullUrl, fetchOpts, url) {
  const response = await fetch(fullUrl, fetchOpts);
  if (response.status !== 429) return response;

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSec = Number(retryAfterHeader) || 2;
  telemetry.recordRateLimit(url, retryAfterSec);
  telemetry.recordRetry();

  // Clamp: 1-10 seconds. Add 0-500ms jitter to avoid herd re-retry.
  const delayMs = Math.min(10000, Math.max(1000, retryAfterSec * 1000)) + Math.floor(Math.random() * 500);
  await sleep(delayMs);

  // One retry only. If this still fails with 429, bubble up — never loop.
  return fetch(fullUrl, fetchOpts);
}

// Fetch with httpOnly cookie auth, dedup, retry, and error handling.
export async function fetchWithAuth(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const fullUrl = `${API_BASE}${url}`;
  const fetchOpts = { ...options, method, headers, credentials: 'include' };

  const dedupKey = inflightKey(method, url);
  if (dedupKey && inflight.has(dedupKey)) {
    telemetry.recordDedup(url);
    // All dedup callers share the underlying Response — clone so each can
    // read its body independently.
    return inflight.get(dedupKey).then(r => r.clone());
  }

  telemetry.record(url);

  const promise = (async () => {
    const response = await fetchWithRetry(fullUrl, fetchOpts, url);

    if (response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        clearToken();
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      let parsedErrorData = null;
      try {
        parsedErrorData = await response.clone().json();
        if (parsedErrorData.error) errorMessage = parsedErrorData.error;
        else if (parsedErrorData.message) errorMessage = parsedErrorData.message;
      } catch {}
      // Phase v3.2 (May 14 2026) — attach the full parsed response body to
      // the thrown Error so callers (e.g. handleSmartClearPreview) can read
      // structured errorDetail. Prefix with _ to indicate non-standard
      // property + avoid colliding with any Error subclass conventions.
      const err = new Error(errorMessage);
      if (parsedErrorData) err._responseData = parsedErrorData;
      err._status = response.status;
      throw err;
    }

    return response;
  })();

  if (dedupKey) {
    inflight.set(dedupKey, promise);
    // Always remove from inflight map once settled (success OR failure) so
    // subsequent calls get a fresh request, not a cached error.
    promise.finally(() => {
      if (inflight.get(dedupKey) === promise) inflight.delete(dedupKey);
    });
    // Return a clone for the first caller too so all callers are symmetric.
    return promise.then(r => r.clone());
  }

  return promise;
}

// Auth API
export const auth = {
  async register(username, password, email, kofiEmail, discordUsername = null) {
    const response = await fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, kofiEmail, discordUsername }),
    });
    return response.json();
  },

  async login(username, password) {
    const response = await fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // Server sets httpOnly cookie automatically — no client-side token storage
    return response.json();
  },

  async logout() {
    try {
      await fetchWithAuth('/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  },

  async getMe() {
    const response = await fetchWithAuth('/auth/me');
    return response.json();
  },

  async changePassword(currentPassword, newPassword) {
    const response = await fetchWithAuth('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.json();
  },

  async updateKofiEmail(kofiEmail) {
    const response = await fetchWithAuth('/auth/kofi-email', {
      method: 'PUT',
      body: JSON.stringify({ kofiEmail }),
    });
    return response.json();
  },

  isLoggedIn() {
    // With httpOnly cookies, we can't check from JS — always try /auth/me
    return true;
  },
};

// Accounts API
export const accounts = {
  async list() {
    const response = await fetchWithAuth('/accounts');
    return response.json();
  },

  // Admin-only fleet listing. Consumed by the Account Health page to
  // render platform-wide executor health for every linked account
  // (not just the caller's own). Backend guard: requireAdmin. Non-
  // admin callers will receive 403 and must not reach this method
  // in practice (UI gates /admin/system-health to admins).
  async listAllFleet() {
    const response = await fetchWithAuth('/accounts/admin/all');
    return response.json();
  },

  async add(deviceAccount, devicePassword, nickname) {
    const response = await fetchWithAuth('/accounts/add', {
      method: 'POST',
      body: JSON.stringify({ deviceAccount, devicePassword, nickname }),
    });
    return response.json();
  },

  async uploadDcBin(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/accounts/dcbin`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return response.json();
  },

  async uploadXml(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/accounts/xml`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return response.json();
  },

  // Unified upload - requires BOTH XML and dc.bin files
  // accountType: 'main' or 'alt' (defaults to 'main')
  async linkAccount(xmlFile, dcbinFile, accountType = 'main') {
    const formData = new FormData();
    formData.append('xml', xmlFile);
    formData.append('dcbin', dcbinFile);
    formData.append('account_type', accountType);

    const response = await fetch(`${API_BASE}/accounts/link`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return response.json();
  },

  async linkFriendCode(friendCode) {
    const response = await fetchWithAuth('/accounts/link-friend-code', {
      method: 'POST',
      body: JSON.stringify({ friendCode }),
    });
    return response.json();
  },

  async get(id) {
    const response = await fetchWithAuth(`/accounts/${id}`);
    return response.json();
  },

  async update(id, data) {
    const response = await fetchWithAuth(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(id) {
    const response = await fetchWithAuth(`/accounts/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async verify(id) {
    const response = await fetchWithAuth(`/accounts/${id}/verify`, {
      method: 'POST',
    });
    return response.json();
  },

  // Nintendo OAuth methods
  async getNintendoAuthUrl() {
    const response = await fetchWithAuth('/accounts/nintendo/auth-url');
    return response.json();
  },

  async linkNintendo(redirectUrl, codeVerifier, nickname) {
    const response = await fetchWithAuth('/accounts/nintendo/link', {
      method: 'POST',
      body: JSON.stringify({ redirectUrl, codeVerifier, nickname }),
    });
    return response.json();
  },

  async parseNintendoUrl(redirectUrl) {
    const response = await fetchWithAuth('/accounts/nintendo/parse', {
      method: 'POST',
      body: JSON.stringify({ redirectUrl }),
    });
    return response.json();
  },

  // Dashboard stats
  async getStats(accountId = null) {
    const url = accountId
      ? `/accounts/stats?accountId=${accountId}`
      : '/accounts/stats';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  // Activity log
  async getActivity(limit = 50, offset = 0, type = null) {
    let url = `/accounts/activity?limit=${limit}&offset=${offset}`;
    if (type) url += `&type=${type}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  // Log activity
  async logActivity(accountId, actionType, actionDetails = null, status = 'success') {
    const response = await fetchWithAuth('/accounts/activity', {
      method: 'POST',
      body: JSON.stringify({ accountId, actionType, actionDetails, status }),
    });
    return response.json();
  },
};

// Bots API
export const bots = {
  async getStatus(accountId) {
    const response = await fetchWithAuth(`/bots/${accountId}`);
    return response.json();
  },

  async start(accountId, botType = 'FRIEND_ACCEPTOR') {
    const response = await fetchWithAuth(`/bots/${accountId}/start`, {
      method: 'POST',
      body: JSON.stringify({ botType }),
    });
    return response.json();
  },

  async stop(accountId) {
    const response = await fetchWithAuth(`/bots/${accountId}/stop`, {
      method: 'POST',
    });
    return response.json();
  },

  async getLogs(accountId, limit = 100) {
    const url = accountId
      ? `/bots/logs/${accountId}?limit=${limit}`
      : `/bots/logs?limit=${limit}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },
};

// Cards API
export const cards = {
  async list(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.set) searchParams.set('set', params.set);
    if (params.rarity) searchParams.set('rarity', params.rarity);
    if (params.search) searchParams.set('search', params.search);
    if (params.type) searchParams.set('type', params.type);
    if (params.missing) searchParams.set('missing', 'true');

    const url = `/cards?${searchParams.toString()}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getSets() {
    const response = await fetchWithAuth('/cards/sets');
    return response.json();
  },

  async getRarities() {
    const response = await fetchWithAuth('/cards/rarities');
    return response.json();
  },

  async get(backendId) {
    const response = await fetchWithAuth(`/cards/${backendId}`);
    return response.json();
  },

  getImageUrl(backendId, language = 'en') {
    // v=5 cache buster — bumped 2026-04-28 to flush stale browser-cached
    // B3 godpack images after gamestore had wrong PK_20 files (now
    // replaced by correct cardstore copies that match DB image_data).
    return `${API_BASE}/cards/${backendId}/image?lang=${language}&v=5`;
  },

  async getCollectionStats() {
    const response = await fetchWithAuth('/cards/collection-stats');
    return response.json();
  },

  async quickSearch(query) {
    const response = await fetchWithAuth(`/cards/search/quick?q=${encodeURIComponent(query)}`);
    return response.json();
  },
};

// Friends API
export const friends = {
  async list() {
    const response = await fetchWithAuth('/friends');
    return response.json();
  },

  async add(friendCode, friendName, nickname, notes, accountId) {
    const response = await fetchWithAuth('/friends', {
      method: 'POST',
      body: JSON.stringify({ friendCode, friendName, nickname, notes, accountId }),
    });
    return response.json();
  },

  async update(id, data) {
    const response = await fetchWithAuth(`/friends/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(id) {
    const response = await fetchWithAuth(`/friends/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async toggleFavorite(id) {
    const response = await fetchWithAuth(`/friends/${id}/favorite`, {
      method: 'POST',
    });
    return response.json();
  },

  async markPresent(id) {
    const response = await fetchWithAuth(`/friends/${id}/present`, {
      method: 'POST',
    });
    return response.json();
  },

  async bulkImport(friends) {
    const response = await fetchWithAuth('/friends/import', {
      method: 'POST',
      body: JSON.stringify({ friends }),
    });
    return response.json();
  },

  // NEW: Real game API functions
  async getGameFriends(accountId) {
    const response = await fetchWithAuth(`/friends/game/${accountId}`);
    return response.json();
  },

  async searchPlayer(accountId, friendCode) {
    const response = await fetchWithAuth(`/friends/game/search/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ friendCode }),
    });
    return response.json();
  },

  async sendGameRequest(accountId, playerId) {
    const response = await fetchWithAuth(`/friends/game/add/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
    return response.json();
  },

  async acceptGameRequest(accountId, playerId) {
    const response = await fetchWithAuth(`/friends/game/accept/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
    return response.json();
  },

  async smartClearPreview(accountId, {
    friendList = [],
    gameFavoritePlayerIds = null,
    filters = {},
    // Phase v3 (May 2026) — GodPack tier cleanup mode (0..3).
    // 0 = keep all GodPacks (default). 1/2/3 = allow Smart Clear to remove
    // friends whose ONLY protection is GP tier 1, 1+2, or 1+2+3 respectively.
    // Tier 4, 5, and pseudo-high-value remain manual-only regardless.
    gpClearMaxTier = 0,
  } = {}) {
    // Phase WP-FixC — preview-only Smart Clear. NEVER removes; returns preview JSON.
    // Backend categorizes friendList into kept / removable / cannotEvaluate.
    const response = await fetchWithAuth(`/friends/smart-clear-preview/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ friendList, gameFavoritePlayerIds, filters, gpClearMaxTier }),
    });
    return safeJsonParse(response, 'Smart Clear preview failed');
  },

  async getRemovalStatus() {
    // Apr 2026 — checks backend FRIEND_REMOVAL_ENABLED flag.
    // Frontend uses this to disable Smart Clear / bulk / single delete + show banner.
    try {
      const response = await fetchWithAuth('/friends/removal-status');
      return await response.json();
    } catch (e) {
      // Fail closed — assume disabled if status can't be fetched
      return { enabled: false, reason: 'Unable to verify removal status — assuming disabled.' };
    }
  },

  async deleteGameFriend(accountId, playerId, {
    force = false,                  // legacy back-compat
    skipFavoriteCheck = false,
    // Phase WP-FixE — explicit source + override semantics
    source = 'manual_single',
    overrideProtected = false,
    overrideReason = null,
    playerName = null,
  } = {}) {
    // Use raw fetch instead of fetchWithAuth so that 403 (favorite warning)
    // and 409 (PROTECTED_FRIEND / SYSTEM_BLOCKED_FRIEND) responses are
    // returned as data for the confirmation flow, rather than thrown as errors.
    const response = await fetch(`${API_BASE}/friends/game/delete/${accountId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId, force, skipFavoriteCheck,
        source, overrideProtected, overrideReason, playerName,
      }),
      credentials: 'include',
    });

    if (response.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        clearToken();
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    // 403 (favorite) and 409 (god pack) are warnings needing user confirmation — return as data
    if (response.status === 403 || response.status === 409) {
      return response.json();
    }

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.clone().json();
        if (errorData.error) errorMessage = errorData.error;
        else if (errorData.message) errorMessage = errorData.message;
      } catch { /* non-JSON response */ }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  async bulkRemoveGameFriends(accountId, playerIds, {
    force = false,
    // Phase WP-FixD3 — Smart Clear callers MUST pass source='smart_clear'
    // plus the same filters + gameFavoritePlayerIds used to build the
    // preview, so the server can re-classify each id and reject any
    // non-admitted-tier friend.
    source = 'manual_bulk',
    gameFavoritePlayerIds = null,
    filters = {},
    // Phase WP-FixD4 — when true, server admits MEDIUM_SAFE in addition
    // to HIGH_SAFE. Caller MUST have shown the user the partial-confidence
    // warning + collected explicit risk-accept before sending.
    acceptMediumSafe = false,
    // Phase WP-FixE — explicit override of overrideable protections
    // (god_pack_history, favorite_game) for manual_single / manual_bulk /
    // gp_clear / admin_clear. Server rejects this for source=smart_clear.
    overrideProtected = false,
    overrideReason = null,
    // Phase v3 (May 2026) — GodPack tier cleanup mode (0..3, clamped
    // server-side). MUST match what was sent to the preview endpoint;
    // any deeper mode on the bulk-remove call than was previewed is a
    // contract violation that the operator's UI flow must prevent.
    gpClearMaxTier = 0,
  } = {}) {
    const response = await fetchWithAuth(`/friends/game/bulk-remove/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({
        playerIds, force, source, gameFavoritePlayerIds, filters,
        acceptMediumSafe, overrideProtected, overrideReason,
        gpClearMaxTier,
      }),
    });
    return safeJsonParse(response, 'Failed to start bulk friend removal');
  },

  async rejectGameRequest(accountId, playerId) {
    const response = await fetchWithAuth(`/friends/game/reject/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
    return response.json();
  },

  // Bulk accept multiple friend requests in one API call
  async bulkAcceptGameRequests(accountId, playerIds) {
    const response = await fetchWithAuth(`/friends/game/accept/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ playerIds }),
    });
    return response.json();
  },

  // Bulk reject multiple friend requests in one API call
  async bulkRejectGameRequests(accountId, playerIds) {
    const response = await fetchWithAuth(`/friends/game/reject/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ playerIds }),
    });
    return response.json();
  },

  // Get all player IDs that have found god packs and/or pseudo packs
  async getGodpackPlayerIds(options = {}) {
    const params = new URLSearchParams();
    if (options.hours) params.set('hours', options.hours);
    if (options.includePseudo) params.set('includePseudo', 'true');
    if (options.pseudoOnly) params.set('pseudoOnly', 'true');
    const queryString = params.toString();
    const url = queryString ? `/friends/godpack-player-ids?${queryString}` : '/friends/godpack-player-ids';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  // Get favorite friend player IDs from game API
  async getGameFavorites(accountId) {
    const response = await fetchWithAuth(`/friends/game/favorites/${accountId}`);
    return response.json();
  },

  // Add or remove a friend from in-game favorites
  async setGameFavorite(accountId, playerId, add = true) {
    const response = await fetchWithAuth(`/friends/game/favorite/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ playerId, add }),
    });
    return response.json();
  },
};

// Presents API
export const presents = {
  async list(accountId) {
    const response = await fetchWithAuth(`/presents/list/${accountId}`);
    return response.json();
  },

  async claim(accountId, presentIds) {
    const response = await fetchWithAuth(`/presents/claim/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ presentIds }),
    });
    return response.json();
  },

  async claimAll(accountId, filter = null) {
    const response = await fetchWithAuth(`/presents/claim-all/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ filter }),
    });
    return response.json();
  },

  async history(limit = 50, offset = 0, accountId = null) {
    let url = `/presents/history?limit=${limit}&offset=${offset}`;
    if (accountId) url += `&accountId=${accountId}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async stats(accountId = null) {
    const url = accountId
      ? `/presents/stats?accountId=${accountId}`
      : '/presents/stats';
    const response = await fetchWithAuth(url);
    return response.json();
  },
};

// Missions API
export const missions = {
  async getDaily(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/missions/daily?accountId=${accountId}`
      : '/missions/daily';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getWeekly(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/missions/weekly?accountId=${accountId}`
      : '/missions/weekly';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async completeMission(missionId, accountId = null) {
    const body = {};
    if (accountId && accountId !== 'all') body.accountId = accountId;
    const response = await fetchWithAuth(`/missions/${missionId}/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async redeemMission(missionId, accountId = null) {
    const body = {};
    if (accountId && accountId !== 'all') body.accountId = accountId;
    const response = await fetchWithAuth(`/missions/${missionId}/redeem`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async redeemAll(accountId = null) {
    const body = {};
    if (accountId && accountId !== 'all') body.accountId = accountId;
    const response = await fetchWithAuth('/missions/redeem-all', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async getHistory(limit = 30, accountId = null) {
    let url = `/missions/history?limit=${limit}`;
    if (accountId && accountId !== 'all') url += `&accountId=${accountId}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  // Real game API sync
  // Wave C — include ok + status so the UI can distinguish a successful
  // sync (even if the game returned zero completions) from an upstream
  // failure that used to look identical in the old silent-catch path.
  // We still return the parsed body, but merge in ok/status so callers
  // that look at the top-level shape see the transport outcome too.
  async syncFromGame(accountId) {
    const response = await fetchWithAuth(`/missions/sync/${accountId}`, {
      method: 'POST',
    });
    const body = await response.json().catch(() => ({}));
    // Preserve the transport outcome so Missions.jsx can distinguish
    // real zeros from silent-failure zeros. The backend also sets
    // succeeded:true on the happy path; we normalize here so old-style
    // callers that just read top-level fields still work.
    return {
      ...body,
      ok: response.ok,
      httpStatus: response.status,
      succeeded: typeof body.succeeded === 'boolean'
        ? body.succeeded
        : response.ok && body.success !== false,
    };
  },

  async claimAllRewards(accountId) {
    const response = await fetchWithAuth(`/missions/claim-all/${accountId}`, {
      method: 'POST',
    });
    return response.json();
  },

  // Hourglass API methods
  async getHourglasses(accountId) {
    const response = await fetchWithAuth(`/missions/hourglasses/${accountId}`);
    return response.json();
  },

  async useHourglass(accountId, count = 1) {
    const response = await fetchWithAuth(`/missions/hourglasses/use/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
    return response.json();
  },

  async getResources(accountId) {
    const response = await fetchWithAuth(`/missions/resources/${accountId}`);
    return response.json();
  },
};

// Collection API
export const collection = {
  async getSummary(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/collection/summary?accountId=${accountId}`
      : '/collection/summary';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getOwnedCards(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/collection/owned-cards?accountId=${accountId}`
      : '/collection/owned-cards';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getCardDetails(cardIds, accountId = null) {
    const body = { cardIds };
    if (accountId && accountId !== 'all') body.accountId = parseInt(accountId);
    const response = await fetchWithAuth('/collection/card-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async getMissionProgress(cardIds, accountId = null) {
    const body = { cardIds };
    if (accountId && accountId !== 'all') body.accountId = parseInt(accountId);
    const response = await fetchWithAuth('/collection/mission-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async getGameMissionCompletion(accountId, { force = false, reason = '' } = {}) {
    const params = new URLSearchParams({ accountId });
    if (force) params.set('force', '1');
    if (reason) params.set('reason', reason);
    const response = await fetchWithAuth(`/collection/mission-completion?${params}`);
    return response.json();
  },

  /**
   * Phase 31 — load persisted per-account mission snapshot (pure DB
   * read, no gRPC). Used by CollectionMissions on mount so refresh
   * restores the last synced truth without hitting the game server.
   * Returns { hasSnapshot: true, completedMissionIds, syncedAt, ...}
   * or { hasSnapshot: false } on 404.
   */
  async getMissionSnapshot(accountId) {
    if (!accountId) return { hasSnapshot: false };
    const params = new URLSearchParams({ accountId });
    const response = await fetchWithAuth(`/collection/mission-snapshot?${params}`);
    if (response.status === 404) return { hasSnapshot: false };
    if (!response.ok) throw new Error(`mission-snapshot failed: ${response.status}`);
    return response.json();
  },

  async getSet(setCode, accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/collection/${setCode}?accountId=${accountId}`
      : `/collection/${setCode}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async updateCard(cardId, amount, accountId = null) {
    const body = { cardId, amount };
    if (accountId && accountId !== 'all') body.accountId = accountId;
    const response = await fetchWithAuth('/collection', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async bulkUpdate(cards, accountId = null) {
    const body = { cards };
    if (accountId && accountId !== 'all') body.accountId = accountId;
    const response = await fetchWithAuth('/collection/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async markSetComplete(setCode, accountId = null) {
    const body = {};
    if (accountId && accountId !== 'all') body.accountId = accountId;
    const response = await fetchWithAuth(`/collection/mark-set-complete/${setCode}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async getRarityStats(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/collection/stats/rarity?accountId=${accountId}`
      : '/collection/stats/rarity';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async syncFromGame(accountId) {
    const response = await fetchWithAuth(`/collection/sync/${accountId}`, {
      method: 'POST',
    });
    return response.json();
  },

  async getByAccountSet(accountId, setCode) {
    const response = await fetchWithAuth(`/collection/by-account-set/${accountId}/${setCode}`);
    return response.json();
  },

  async resetCollection(accountId = null) {
    const params = accountId ? `?accountId=${accountId}` : '';
    const response = await fetchWithAuth(`/collection/reset${params}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};

// Tasks API
export const tasks = {
  async openPacks(accountId) {
    const response = await fetchWithAuth('/tasks/open-packs', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    return response.json();
  },

  async wonderPick(accountId) {
    const response = await fetchWithAuth('/tasks/wonder-pick', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    return response.json();
  },

  async claimMissions(accountId) {
    const response = await fetchWithAuth('/tasks/claim-missions', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    return response.json();
  },

  async battle(accountId, battleType = 'BEGINNER') {
    const response = await fetchWithAuth('/tasks/battle', {
      method: 'POST',
      body: JSON.stringify({ accountId, battleType }),
    });
    return response.json();
  },

  async runAll(accountId, taskList) {
    const response = await fetchWithAuth('/tasks/all', {
      method: 'POST',
      body: JSON.stringify({ accountId, tasks: taskList }),
    });
    return response.json();
  },

  async getHistory(limit = 50, accountId = null) {
    let url = `/tasks/history?limit=${limit}`;
    if (accountId) url += `&accountId=${accountId}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getStatus(taskId) {
    const response = await fetchWithAuth(`/tasks/status/${taskId}`);
    return response.json();
  },

  // NEW: Real Wonder Pick data APIs
  async getWonderPicks(accountId) {
    const response = await fetchWithAuth(`/tasks/wonder-picks/${accountId}`);
    return response.json();
  },

  async getResources(accountId) {
    const response = await fetchWithAuth(`/tasks/resources/${accountId}`);
    return response.json();
  },

  async performWonderPick(accountId, feedId, feedType = 'SOMEONE', cards = []) {
    const response = await fetchWithAuth(`/tasks/wonder-pick/perform/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ feedId, feedType, cards }),
    });
    return response.json();
  },

  async openPackReal(accountId, packId, paymentType = 'HOURGLASS', doShare = false) {
    const response = await fetchWithAuth(`/tasks/open-pack/perform/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ packId, paymentType, doShare }),
    });
    return response.json();
  },

  async openPackBulk(accountId, packId, doShare = false) {
    const response = await fetchWithAuth(`/tasks/open-pack/bulk/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ packId, paymentType: 'HOURGLASS', doShare }),
    });
    return response.json();
  },

  async openPackPremium(accountId, packId, doShare = false) {
    const response = await fetchWithAuth(`/tasks/open-pack/premium/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ packId, doShare }),
    });
    return response.json();
  },

  async healChallengePower(accountId, chargersAmount = 0, vcAmount = 0) {
    const response = await fetchWithAuth(`/tasks/wonder-pick/heal/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ chargersAmount, vcAmount }),
    });
    return response.json();
  },

  async getShopSummaries(accountId) {
    const response = await fetchWithAuth(`/tasks/shop/summaries/${accountId}`);
    return response.json();
  },

  async shopPurchase(accountId, productType) {
    const response = await fetchWithAuth(`/tasks/shop/purchase/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ productType }),
    });
    return response.json();
  },
};

// Profile API
export const profile = {
  async get(accountId) {
    const response = await fetchWithAuth(`/profile/${accountId}`);
    return response.json();
  },

  async getIcons() {
    const response = await fetchWithAuth('/profile/icons');
    return response.json();
  },

  async getMessages() {
    const response = await fetchWithAuth('/profile/messages');
    return response.json();
  },

  async update(accountId, { nickname, iconId, messageId }) {
    const response = await fetchWithAuth(`/profile/${accountId}`, {
      method: 'PUT',
      body: JSON.stringify({ nickname, iconId, messageId }),
    });
    return response.json();
  },

  async updateName(accountId, nickname) {
    const response = await fetchWithAuth(`/profile/${accountId}/name`, {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    });
    return response.json();
  },

  async updateIcon(accountId, iconId) {
    const response = await fetchWithAuth(`/profile/${accountId}/icon`, {
      method: 'PUT',
      body: JSON.stringify({ iconId }),
    });
    return response.json();
  },

  async updateMessage(accountId, messageId) {
    const response = await fetchWithAuth(`/profile/${accountId}/message`, {
      method: 'PUT',
      body: JSON.stringify({ messageId }),
    });
    return response.json();
  },
};

// Helper to safely parse JSON response and handle errors
async function safeJsonParse(response, defaultError = 'Request failed') {
  // If response is not OK, try to get error details
  if (!response.ok) {
    let errorMessage = defaultError;
    try {
      // Try to parse as JSON first (server may return { error: '...' })
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.details || errorData.message || defaultError;
    } catch {
      // If not JSON, try to get text
      try {
        const text = await response.text();
        if (text && text.length < 500) {
          errorMessage = text;
        } else {
          errorMessage = `${defaultError} (HTTP ${response.status})`;
        }
      } catch {
        errorMessage = `${defaultError} (HTTP ${response.status})`;
      }
    }
    throw new Error(errorMessage);
  }

  // Response is OK, try to parse JSON
  try {
    return await response.json();
  } catch (parseError) {
    // JSON parse failed on an OK response - this is unexpected
    console.error('JSON parse error on OK response:', parseError);
    throw new Error('Server returned invalid response');
  }
}

// Solo Battle API
export const soloBattle = {
  async getStages() {
    const response = await fetchWithAuth('/solo-battle/stages');
    return safeJsonParse(response, 'Failed to get stages');
  },

  async getStatus(accountId, difficulty = null) {
    let url = `/solo-battle/status/${accountId}`;
    if (difficulty) url += `?difficulty=${difficulty}`;
    const response = await fetchWithAuth(url);
    return safeJsonParse(response, 'Failed to get battle status');
  },

  async getUncompleted(accountId, difficulty = null, limit = null) {
    let url = `/solo-battle/uncompleted/${accountId}`;
    const params = [];
    if (difficulty) params.push(`difficulty=${difficulty}`);
    if (limit) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    const response = await fetchWithAuth(url);
    return safeJsonParse(response, 'Failed to get uncompleted battles');
  },

  async runBattle(accountId, battleId, useRentalDeck = false) {
    const response = await fetchWithAuth(`/solo-battle/run/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ battleId, useRentalDeck }),
    });
    return safeJsonParse(response, 'Failed to run battle');
  },

  async runBatch(accountId, battleIds, useRentalDeck = false, maxBattles = 10) {
    const response = await fetchWithAuth(`/solo-battle/run-batch/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ battleIds, useRentalDeck, maxBattles }),
    });
    return safeJsonParse(response, 'Failed to run batch battles');
  },

  async getDecks(accountId) {
    const response = await fetchWithAuth(`/solo-battle/decks/${accountId}`);
    return safeJsonParse(response, 'Failed to get decks');
  },

  async completeTutorial(accountId) {
    const response = await fetchWithAuth(`/solo-battle/complete-tutorial/${accountId}`, {
      method: 'POST',
    });
    return safeJsonParse(response, 'Failed to complete tutorial');
  },
};

// System Health API (admin)
export const systemHealth = {
  async getTradeHealth(accountId) {
    const response = await fetchWithAuth(`/auto-trade/health/${accountId}`);
    return safeJsonParse(response, 'Failed to get trade health');
  },
  async getGiftHealth(accountId) {
    const response = await fetchWithAuth(`/auto-gift/health/${accountId}`);
    return safeJsonParse(response, 'Failed to get gift health');
  },
  async getBattleHealth(accountId) {
    const response = await fetchWithAuth(`/battles/health/${accountId}`);
    return safeJsonParse(response, 'Failed to get battle health');
  },
  async reconcileTrades(accountId) {
    const response = await fetchWithAuth(`/auto-trade/reconcile/${accountId}`, { method: 'POST' });
    return safeJsonParse(response, 'Failed to reconcile trades');
  },
  async reconcileGifts(accountId) {
    const response = await fetchWithAuth(`/auto-gift/reconcile/${accountId}`, { method: 'POST' });
    return safeJsonParse(response, 'Failed to reconcile gifts');
  },
  async reconcileBattles(accountId) {
    const response = await fetchWithAuth(`/battles/reconcile/${accountId}`, { method: 'POST' });
    return safeJsonParse(response, 'Failed to reconcile battles');
  },
};

// Phase 25D — unified sync API. Single round-trip from the Tracker
// page; server orchestrates collection + missions and returns a
// combined result with partial-success semantics.
export const unifiedSync = {
  async tracker(accountId) {
    const response = await fetchWithAuth(`/sync/tracker/${accountId}`, { method: 'POST' });
    return safeJsonParse(response, 'Failed to sync tracker');
  },
  // Phase 25E — backend truth layer for SyncStatusChip. Returns
  // per-account lastInventorySyncAt + lastMissionsSyncAt columns
  // from user_device_accounts (not localStorage).
  async status(accountId) {
    const response = await fetchWithAuth(`/accounts/${accountId}/sync-status`);
    return safeJsonParse(response, 'Failed to read sync status');
  },
};

// Phase 25B — Action Review queue API (admin-only).
export const actionReview = {
  async list(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const response = await fetchWithAuth(`/admin/actions/review${qs ? `?${qs}` : ''}`);
    return safeJsonParse(response, 'Failed to list action reviews');
  },
  async approve(id) {
    const response = await fetchWithAuth(`/admin/actions/review/${id}/approve`, { method: 'POST' });
    return safeJsonParse(response, 'Failed to approve action');
  },
  async reject(id, reason) {
    const response = await fetchWithAuth(`/admin/actions/review/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return safeJsonParse(response, 'Failed to reject action');
  },
  async expire(id) {
    const response = await fetchWithAuth(`/admin/actions/review/${id}/expire`, { method: 'POST' });
    return safeJsonParse(response, 'Failed to expire action');
  },
};

// Battle History API
export const battleHistory = {
  async getHistory(accountId, { page = 1, limit = 20, battleType } = {}) {
    let url = `/battles/history/${accountId}?page=${page}&limit=${limit}`;
    if (battleType) url += `&battle_type=${battleType}`;
    const response = await fetchWithAuth(url);
    return safeJsonParse(response, 'Failed to get battle history');
  },

  async getStats(accountId) {
    const response = await fetchWithAuth(`/battles/stats/${accountId}`);
    return safeJsonParse(response, 'Failed to get battle stats');
  },
};

// Event Battle API
export const eventBattle = {
  async getEvents(accountId) {
    const url = accountId ? `/event-battle/events?accountId=${accountId}` : '/event-battle/events';
    const response = await fetchWithAuth(url);
    return safeJsonParse(response, 'Failed to get events');
  },

  async getStatus(accountId) {
    const response = await fetchWithAuth(`/event-battle/status/${accountId}`);
    return safeJsonParse(response, 'Failed to get event battle status');
  },

  async getPower(accountId) {
    const response = await fetchWithAuth(`/event-battle/power/${accountId}`);
    return safeJsonParse(response, 'Failed to get event power');
  },

  async runBattle(accountId, battleId, battleTryId = null, useRentalDeck = false) {
    const response = await fetchWithAuth(`/event-battle/run/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ battleId, battleTryId, useRentalDeck }),
    });
    return safeJsonParse(response, 'Failed to run event battle');
  },

  async runBatch(accountId, battleIds, autoCompleteTries = false, useRentalDeck = false) {
    const response = await fetchWithAuth(`/event-battle/run-batch/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ battleIds, autoCompleteTries, useRentalDeck }),
    });
    return safeJsonParse(response, 'Failed to run batch event battles');
  },

  async getDecks(accountId) {
    const response = await fetchWithAuth(`/event-battle/decks/${accountId}`);
    return safeJsonParse(response, 'Failed to get decks');
  },

  async healPower(accountId, eventId = null, chargersAmount = 0, vcAmount = 0) {
    const response = await fetchWithAuth(`/event-battle/heal/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ eventId, chargersAmount, vcAmount }),
    });
    return safeJsonParse(response, 'Failed to heal event power');
  },
};

// Random Battle API
export const randomBattle = {
  async getConfig() {
    const response = await fetchWithAuth('/random-battle/config');
    return safeJsonParse(response, 'Failed to get random battle config');
  },

  async getStatus(accountId) {
    const response = await fetchWithAuth(`/random-battle/status/${accountId}`);
    return safeJsonParse(response, 'Failed to get random battle status');
  },

  async runBattle(accountId, battleId) {
    const response = await fetchWithAuth(`/random-battle/run/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ battleId }),
    });
    return safeJsonParse(response, 'Failed to run random battle');
  },

  async runBatch(accountId, battleIds) {
    const response = await fetchWithAuth(`/random-battle/run-batch/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ battleIds }),
    });
    return safeJsonParse(response, 'Failed to run batch random battles');
  },
};

// Trade API
export const trade = {
  async getStatus(accountId) {
    const response = await fetchWithAuth(`/trade/status/${accountId}`);
    return response.json();
  },

  async getPower(accountId) {
    const response = await fetchWithAuth(`/trade/power/${accountId}`);
    return response.json();
  },

  async getFriends(accountId) {
    const response = await fetchWithAuth(`/trade/friends/${accountId}`);
    return response.json();
  },

  async submitProposal(accountId, { partnerPlayerId, cardId, expansionId, lang, currencyAmount }) {
    const response = await fetchWithAuth(`/trade/submit/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ partnerPlayerId, cardId, expansionId, lang, currencyAmount }),
    });
    return response.json();
  },

  async acceptProposal(accountId, { tradeSessionId, cardId, expansionId, lang, currencyAmount }) {
    const response = await fetchWithAuth(`/trade/accept/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ tradeSessionId, cardId, expansionId, lang, currencyAmount }),
    });
    return response.json();
  },

  async rejectProposal(accountId, tradeSessionId) {
    const response = await fetchWithAuth(`/trade/reject/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ tradeSessionId }),
    });
    return response.json();
  },

  async confirmTrade(accountId, tradeSessionId) {
    const response = await fetchWithAuth(`/trade/confirm/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ tradeSessionId }),
    });
    return response.json();
  },

  async receiveOutcomes(accountId, tradeSessionId) {
    const response = await fetchWithAuth(`/trade/receive/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ tradeSessionId }),
    });
    return response.json();
  },
};

// Give Card API
export const giveCard = {
  async getFriends(accountId) {
    const response = await fetchWithAuth(`/give-card/friends/${accountId}`);
    return response.json();
  },

  async getEligibleCards(accountId, filters = {}) {
    let url = `/give-card/eligible/${accountId}`;
    const params = new URLSearchParams();
    if (filters.expansion) params.set('expansion', filters.expansion);
    if (filters.rarity) params.set('rarity', filters.rarity);
    if (params.toString()) url += `?${params.toString()}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async sendCard(accountId, { friendPlayerId, cardId, expansionId, lang }) {
    const response = await fetchWithAuth(`/give-card/send/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({ friendPlayerId, cardId, expansionId, lang }),
    });
    return response.json();
  },

  async getHistory(accountId, limit = 50) {
    const response = await fetchWithAuth(`/give-card/history/${accountId}?limit=${limit}`);
    return response.json();
  },
};

// Automation API
export const automation = {
  async getConfig() {
    const response = await fetchWithAuth('/automation/config');
    return response.json();
  },

  async getStatus() {
    const response = await fetchWithAuth('/automation/status');
    return response.json();
  },

  async start(config) {
    const response = await fetchWithAuth('/automation/start', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.json();
  },

  async stop(huntId) {
    const response = await fetchWithAuth(`/automation/stop/${huntId}`, {
      method: 'POST',
    });
    return response.json();
  },

  async getLogs(huntId, limit = 100) {
    const response = await fetchWithAuth(`/automation/logs/${huntId}?limit=${limit}`);
    return response.json();
  },

  async startJwt() {
    const response = await fetchWithAuth('/automation/start-jwt', {
      method: 'POST',
    });
    return response.json();
  },

  // Run History (database-backed)
  async getHistory() {
    const response = await fetchWithAuth('/automation/history');
    return response.json();
  },

  async saveHistory(run) {
    const response = await fetchWithAuth('/automation/history', {
      method: 'POST',
      body: JSON.stringify(run),
    });
    return response.json();
  },

  async updateHistory(runId, update) {
    const response = await fetchWithAuth(`/automation/history/${runId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
    return response.json();
  },

  async clearHistory() {
    const response = await fetchWithAuth('/automation/history', {
      method: 'DELETE',
    });
    return response.json();
  },

  async syncHistory() {
    const response = await fetchWithAuth('/automation/history/sync', {
      method: 'POST',
    });
    return response.json();
  },
};

// Hunt API
export const hunt = {
  async getStats() {
    const response = await fetchWithAuth('/hunt/stats');
    return response.json();
  },

  async getGodpacks(limit = 50, offset = 0, status, containers) {
    let url = `/hunt/godpacks?limit=${limit}&offset=${offset}`;
    if (status) url += `&status=${status}`;
    if (containers && containers.length > 0) url += `&containers=${containers.join(',')}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getGodpacksByPlayers(playerIds, accountId) {
    const params = `playerIds=${playerIds.join(',')}${accountId ? `&accountId=${accountId}` : ''}`;
    const response = await fetchWithAuth(`/hunt/godpacks/by-players?${params}`);
    return response.json();
  },

  async updateGodpackStatus(godPackId, status) {
    const response = await fetchWithAuth(`/hunt/godpacks/${godPackId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  async getAlivePlayers(playerIds) {
    const response = await fetchWithAuth('/hunt/godpacks/alive-players', {
      method: 'POST',
      body: JSON.stringify({ playerIds }),
    });
    const data = await response.json();
    return data.alivePlayers || [];
  },

  async updateGodpackStatusByPlayer(playerId, status) {
    const response = await fetchWithAuth(`/hunt/godpacks/by-player/${playerId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  async getGodpackStats() {
    const response = await fetchWithAuth('/hunt/godpacks/stats');
    return response.json();
  },

  async getSummaryToday() {
    const response = await fetchWithAuth('/hunt/summary/today');
    return response.json();
  },

  async getInsights() {
    const response = await fetchWithAuth('/hunt/insights');
    return response.json();
  },

  async getAccountAnalytics(accountId = null, options = {}) {
    const params = new URLSearchParams();
    if (accountId) params.set('accountId', accountId);
    if (options.page) params.set('page', options.page);
    if (options.limit) params.set('limit', options.limit);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);
    if (options.filter) params.set('filter', options.filter);
    const queryString = params.toString();
    const url = `/hunt/accounts/analytics${queryString ? '?' + queryString : ''}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getPackDistribution() {
    const response = await fetchWithAuth('/hunt/accounts/pack-distribution');
    return response.json();
  },

  async getBattleStats() {
    const response = await fetchWithAuth('/hunt/battles');
    return response.json();
  },

  async getSystemHealth() {
    const response = await fetchWithAuth('/hunt/system/health');
    return response.json();
  },

  async getDistribution(containerGroup = null) {
    // Backend supports ?containerGroup=N to scope Discord-user weighted
    // distribution to a single container. When omitted, returns the
    // global fleet-wide view.
    const qs = containerGroup != null ? `?containerGroup=${encodeURIComponent(containerGroup)}` : '';
    const response = await fetchWithAuth(`/hunt/distribution${qs}`);
    return response.json();
  },

  async refreshDistribution() {
    const response = await fetchWithAuth('/hunt/distribution/refresh', {
      method: 'POST',
    });
    return response.json();
  },

  // Read-only view of container_pack_config for Hunt Monitor.
  // Returns { containers: [{containerGroup, mode, packs, updatedAt, updatedBy}] }
  // one row per container (1..4). mode=null means operator has not
  // configured a per-container override yet (legacy fallback active).
  async getContainerPackConfig() {
    const response = await fetchWithAuth('/hunt/container-pack-config');
    return response.json();
  },

  // Hunt Settings
  async getAccounts() {
    const response = await fetchWithAuth('/hunt/accounts');
    return response.json();
  },

  async getPacks() {
    const response = await fetchWithAuth('/hunt/packs');
    return response.json();
  },

  async getMyStatus(accountType) {
    const response = await fetchWithAuth(`/hunt/my-status/${accountType}`);
    return response.json();
  },

  async joinPack(accountType, packName) {
    const response = await fetchWithAuth('/hunt/join', {
      method: 'POST',
      body: JSON.stringify({ accountType, packName }),
    });
    return response.json();
  },

  async leavePack(accountType, packName) {
    const response = await fetchWithAuth('/hunt/leave', {
      method: 'POST',
      body: JSON.stringify({ accountType, packName }),
    });
    return response.json();
  },

  async leaveAllPacks(accountType) {
    const response = await fetchWithAuth('/hunt/leave-all', {
      method: 'POST',
      body: JSON.stringify({ accountType }),
    });
    return response.json();
  },

  async updateMinStars(accountType, minStars) {
    const response = await fetchWithAuth('/hunt/min-stars', {
      method: 'PUT',
      body: JSON.stringify({ accountType, minStars }),
    });
    return response.json();
  },

  async togglePseudo(accountType, enabled) {
    const response = await fetchWithAuth('/hunt/pseudo', {
      method: 'PUT',
      body: JSON.stringify({ accountType, enabled }),
    });
    return response.json();
  },

  async updateMinRareCards(accountType, minRareCards) {
    const response = await fetchWithAuth('/hunt/min-rare-cards', {
      method: 'PUT',
      body: JSON.stringify({ accountType, minRareCards }),
    });
    return response.json();
  },

  async updateSelectedTiers(accountType, selectedTiers) {
    const response = await fetchWithAuth('/hunt/selected-tiers', {
      method: 'PUT',
      body: JSON.stringify({ accountType, selectedTiers }),
    });
    return response.json();
  },

  async toggleKeepAsFriend(accountType, enabled) {
    const response = await fetchWithAuth('/hunt/keep-as-friend', {
      method: 'PUT',
      body: JSON.stringify({ accountType, enabled }),
    });
    return response.json();
  },

  async joinAllPacks(accountType) {
    const response = await fetchWithAuth('/hunt/join-all', {
      method: 'POST',
      body: JSON.stringify({ accountType }),
    });
    return response.json();
  },
};

// Scheduler API
export const scheduler = {
  async getSchedules() {
    const response = await fetchWithAuth('/scheduler/schedules');
    return response.json();
  },

  async getSchedule(id) {
    const response = await fetchWithAuth(`/scheduler/schedules/${id}`);
    return response.json();
  },

  async createSchedule(data) {
    const response = await fetchWithAuth('/scheduler/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async updateSchedule(id, data) {
    const response = await fetchWithAuth(`/scheduler/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteSchedule(id) {
    const response = await fetchWithAuth(`/scheduler/schedules/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async runNow(id) {
    const response = await fetchWithAuth(`/scheduler/schedules/${id}/run`, {
      method: 'POST',
    });
    return response.json();
  },

  async getLogs(id, limit = 20) {
    const response = await fetchWithAuth(`/scheduler/schedules/${id}/logs?limit=${limit}`);
    return response.json();
  },

  async getAllLogs(limit = 50) {
    const response = await fetchWithAuth(`/scheduler/logs?limit=${limit}`);
    return response.json();
  },

  async getTimezones() {
    const response = await fetchWithAuth('/scheduler/timezones');
    return response.json();
  },
};

// Auto Trade API - Discord-like automated card trading
export const autoTrade = {
  async getRequests(status = null, limit = 50) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    const response = await fetchWithAuth(`/auto-trade/requests${qs ? '?' + qs : ''}`);
    return response.json();
  },

  async searchCards(query, limit = 20) {
    const response = await fetchWithAuth(`/auto-trade/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.json();
  },

  // Get all available packs with card counts
  async getPacks() {
    const response = await fetchWithAuth('/auto-trade/packs');
    return response.json();
  },

  // Get cards by pack with type filter
  async getCards(setCode, cardType = 'all', availableOnly = true, accountId = null) {
    const params = new URLSearchParams();
    params.append('setCode', setCode);
    params.append('cardType', cardType);
    params.append('availableOnly', availableOnly.toString());
    if (accountId) params.append('accountId', accountId);
    const response = await fetchWithAuth(`/auto-trade/cards?${params.toString()}`);
    return response.json();
  },

  async getCard(cardId) {
    const response = await fetchWithAuth(`/auto-trade/card/${cardId}`);
    return response.json();
  },

  async checkAvailability(cardId, rarity = null) {
    const url = rarity
      ? `/auto-trade/availability/${cardId}?rarity=${rarity}`
      : `/auto-trade/availability/${cardId}`;
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async createRequest(cardId, accountId = null) {
    const body = { cardId };
    if (accountId) body.accountId = accountId;
    const response = await fetchWithAuth('/auto-trade/request', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.json();
  },

  async getRequest(id) {
    const response = await fetchWithAuth(`/auto-trade/requests/${id}`);
    return response.json();
  },

  async cancelRequest(id) {
    const response = await fetchWithAuth(`/auto-trade/requests/${id}/cancel`, {
      method: 'POST',
    });
    return response.json();
  },

  async getStats() {
    const response = await fetchWithAuth('/auto-trade/stats');
    return response.json();
  },

  async pickTradeCard(requestId, cardId, expansionId) {
    const response = await fetchWithAuth(`/auto-trade/requests/${requestId}/pick-card`, {
      method: 'POST',
      body: JSON.stringify({ cardId, expansionId }),
    });
    return response.json();
  },

  async getMyCards(requestId) {
    const response = await fetchWithAuth(`/auto-trade/requests/${requestId}/my-cards`);
    return response.json();
  },
};

// Achievements API
export const achievements = {
  async getAll(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/achievements?accountId=${accountId}`
      : '/achievements';
    const response = await fetchWithAuth(url);
    return response.json();
  },

  async getStats(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/achievements/stats?accountId=${accountId}`
      : '/achievements/stats';
    const response = await fetchWithAuth(url);
    return response.json();
  },
};

// Inventory API - Card Skins, Cosmetics, Power Chargers
export const inventory = {
  async getAll(accountId) {
    const response = await fetchWithAuth(`/inventory/${accountId}`);
    return response.json();
  },

  async getSkins(accountId) {
    const response = await fetchWithAuth(`/inventory/${accountId}/skins`);
    return response.json();
  },

  async getCosmetics(accountId) {
    const response = await fetchWithAuth(`/inventory/${accountId}/cosmetics`);
    return response.json();
  },
};

// PVP Rankings API
export const pvp = {
  async getStats(accountId) {
    const response = await fetchWithAuth(`/pvp/${accountId}/stats`);
    return response.json();
  },

  async getLeaderboard(accountId) {
    const response = await fetchWithAuth(`/pvp/${accountId}/leaderboard`);
    return response.json();
  },
};

// ========== Premium Feature APIs ==========

// Collection Sync Settings (Feature #3)
export const collectionSync = {
  async getSettings() {
    const response = await fetchWithAuth('/collection/sync-settings');
    return response.json();
  },
  async updateSettings(data) {
    const response = await fetchWithAuth('/collection/sync-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },
  async syncNow(accountId = null) {
    const response = await fetchWithAuth('/collection/sync-now', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    return response.json();
  },
};

// Missing Cards (Feature #6)
export const missingCards = {
  async getMissing(rarity = null, accountId = null) {
    const params = new URLSearchParams();
    if (rarity) params.set('rarity', rarity);
    if (accountId && accountId !== 'all') params.set('accountId', accountId);
    const qs = params.toString();
    const url = qs ? `/collection/missing?${qs}` : '/collection/missing';
    const response = await fetchWithAuth(url);
    return response.json();
  },
  async getSummary(accountId = null) {
    const url = accountId && accountId !== 'all'
      ? `/collection/missing/summary?accountId=${accountId}`
      : '/collection/missing/summary';
    const response = await fetchWithAuth(url);
    return response.json();
  },
};

// Premium Hunt Settings (Features #4, #5)
export const premiumHunt = {
  async getSettings() {
    const response = await fetchWithAuth('/hunt/premium-settings');
    return response.json();
  },
  async updateSettings(data) {
    const response = await fetchWithAuth('/hunt/premium-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.json();
  },
};

// Auto Gift API (for pages that create gift requests)
export const autoGift = {
  async getRequests(status = null, limit = 50) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    const response = await fetchWithAuth(`/auto-gift/requests${qs ? '?' + qs : ''}`);
    return response.json();
  },

  async createRequest(cardId) {
    const response = await fetchWithAuth('/auto-gift/request', {
      method: 'POST',
      body: JSON.stringify({ cardId }),
    });
    return safeJsonParse(response, 'Failed to create gift request');
  },
};

// Manual Trade (Feature #1)
export const manualTrade = {
  async createOffer(accountId, cardId) {
    const response = await fetchWithAuth('/manual-trade/offer', {
      method: 'POST',
      body: JSON.stringify({ accountId, cardId }),
    });
    return response.json();
  },
  async getOffers(status = null, limit = 50) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit);
    const response = await fetchWithAuth(`/manual-trade/offers?${params.toString()}`);
    return response.json();
  },
  async cancelOffer(id) {
    const response = await fetchWithAuth(`/manual-trade/offers/${id}/cancel`, {
      method: 'POST',
    });
    return response.json();
  },
};

// Shinedust Farm (Feature #2b)
export const shinedustFarm = {
  async enable(accountId, botCount = 12) {
    const response = await fetchWithAuth('/auto-gift/shinedust/enable', {
      method: 'POST',
      body: JSON.stringify({ accountId, botCount }),
    });
    return response.json();
  },
  async disable() {
    const response = await fetchWithAuth('/auto-gift/shinedust/disable', {
      method: 'POST',
    });
    return response.json();
  },
  async getStatus() {
    const response = await fetchWithAuth('/auto-gift/shinedust/status');
    return response.json();
  },
};

// Auto Fill Missing Cards (Feature #2a)
export const autoFillMissing = {
  async getStatus() {
    const response = await fetchWithAuth('/auto-gift/fill-missing/status');
    return response.json();
  },
  async enable(accountId) {
    const response = await fetchWithAuth('/auto-gift/fill-missing/enable', {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    return response.json();
  },
  async disable() {
    const response = await fetchWithAuth('/auto-gift/fill-missing/disable', {
      method: 'POST',
    });
    return response.json();
  },
  async sendNow() {
    const response = await fetchWithAuth('/auto-gift/fill-missing', {
      method: 'POST',
    });
    return response.json();
  },
};

// Wishlist API
export const wishlist = {
  async list(listType = 'main') {
    const response = await fetchWithAuth(`/wishlist?list_type=${listType}`);
    return response.json();
  },
  async add(cardId, cardName, rarity, setCode, priority, notes, listType = 'main') {
    const response = await fetchWithAuth('/wishlist', {
      method: 'POST',
      body: JSON.stringify({ cardId, cardName, rarity, setCode, priority, notes, listType }),
    });
    return response.json();
  },
  async remove(cardId, listType = 'main') {
    const response = await fetchWithAuth(`/wishlist/${cardId}?list_type=${listType}`, {
      method: 'DELETE',
    });
    return response.json();
  },
  async bulkAdd(cardIds, listType = 'main') {
    const response = await fetchWithAuth('/wishlist/bulk', {
      method: 'POST',
      body: JSON.stringify({ cardIds, listType }),
    });
    return response.json();
  },
  async clear(listType = 'main') {
    const response = await fetchWithAuth(`/wishlist?list_type=${listType}`, {
      method: 'DELETE',
    });
    return response.json();
  },
  async search(q, rarity, set, listType = 'main') {
    const params = new URLSearchParams({ q });
    if (rarity) params.append('rarity', rarity);
    if (set) params.append('set', set);
    if (listType) params.append('list_type', listType);
    const response = await fetchWithAuth(`/wishlist/search?${params}`);
    return response.json();
  },
};

export const huntConfig = {
  async get() {
    const response = await fetchWithAuth('/admin/hunt-config');
    return response.json();
  },
  async update(key, value) {
    const response = await fetchWithAuth(`/admin/hunt-config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
    return response.json();
  },
  async reset() {
    const response = await fetchWithAuth('/admin/hunt-config/reset', { method: 'POST' });
    return response.json();
  },
  async getRecommendations() {
    const response = await fetchWithAuth('/admin/hunt-config/recommendations');
    return response.json();
  },
};

export const hybridControl = {
  async getData() {
    const response = await fetchWithAuth('/hunt/hybrid-control');
    return response.json();
  },
  async getRebalanceStatus() {
    const response = await fetchWithAuth('/hunt/rebalance/status');
    return response.json();
  },
  async simulateRebalance() {
    const response = await fetchWithAuth('/hunt/rebalance/simulate', { method: 'POST' });
    return response.json();
  },
  async runRebalance() {
    const response = await fetchWithAuth('/hunt/rebalance/run', { method: 'POST' });
    return response.json();
  },
  async moveParticipant(id, toGroup, confirm = false) {
    const response = await fetchWithAuth(`/hunt/participants/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ toGroup, confirm }),
    });
    return response.json();
  },
  async pinParticipant(id, pinned) {
    const response = await fetchWithAuth(`/hunt/participants/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pinned }),
    });
    return response.json();
  },
  // Phase 13 — hand user back to auto-rebalancer control (clears
  // assignment_mode='manual' without moving the user).
  async clearManual(id) {
    const response = await fetchWithAuth(`/hunt/participants/${id}/clear-manual`, {
      method: 'POST',
    });
    return response.json();
  },
  // Phase 14 — rebalance policy read/write + on-demand auto-apply.
  async getRebalancePolicy() {
    const response = await fetchWithAuth('/hunt/rebalance/policy');
    return response.json();
  },
  async setRebalancePolicy(mode) {
    const response = await fetchWithAuth('/hunt/rebalance/policy', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    return response.json();
  },
  async runAutoApplyTick() {
    const response = await fetchWithAuth('/hunt/rebalance/auto-apply/run', { method: 'POST' });
    return response.json();
  },
  async reconcile(dryRun = false) {
    const response = await fetchWithAuth(`/hunt/participants/reconcile${dryRun ? '?dryRun=true' : ''}`, { method: 'POST' });
    return response.json();
  },
  async simulateMicroRebalance() {
    const response = await fetchWithAuth('/hunt/rebalance/micro/simulate', { method: 'POST' });
    return response.json();
  },
  async runMicroRebalance() {
    const response = await fetchWithAuth('/hunt/rebalance/micro/run', { method: 'POST' });
    return response.json();
  },
  async getAuditHistory(filters = {}) {
    const params = new URLSearchParams();
    if (filters.discordId) params.set('discordId', filters.discordId);
    if (filters.actionType) params.set('actionType', filters.actionType);
    if (filters.since) params.set('since', filters.since);
    if (filters.limit) params.set('limit', String(filters.limit));
    const response = await fetchWithAuth(`/hunt/audit?${params}`);
    return response.json();
  },
};

// ── Phase 3 (Apr 2026) — normalized read-model feeds ─────────────
// Wraps the Phase 1 backend endpoints. Existing callers (GodPackGallery
// using hunt.getGodpacks, WonderPick using tasks.getWonderPicks) keep
// working unchanged — these are additive.
export const godpacksFeed = {
  /**
   * GET /api/godpacks/feed — normalized godpack feed.
   * @param {object} opts
   * @param {string} [opts.status]    'LIVE' | 'EXPIRED' | 'PICKED' | 'PENDING'
   * @param {number[]} [opts.containers]
   * @param {number} [opts.limit]     default 50, max 200
   * @param {string} [opts.cursor]    opaque base64 cursor from previous response
   */
  async getFeed({ status, containers, limit, cursor } = {}) {
    const params = new URLSearchParams();
    if (status)                              params.set('status', status);
    if (Array.isArray(containers) && containers.length > 0) {
      params.set('containers', containers.join(','));
    }
    if (limit != null)                       params.set('limit', String(limit));
    if (cursor)                              params.set('cursor', cursor);
    const qs = params.toString();
    const response = await fetchWithAuth(`/godpacks/feed${qs ? `?${qs}` : ''}`);
    return safeJsonParse(response, 'Failed to load godpack feed');
  },
};

export const wonderpicksFeed = {
  /**
   * GET /api/wonderpicks/feed?accountId=N — normalized wrapper around
   * the existing /api/tasks/wonder-picks/:accountId cache. Cache miss
   * responses include warmHint pointing at the existing endpoint.
   */
  async getFeed(accountId) {
    if (!accountId) throw new Error('accountId required for wonderpicksFeed.getFeed');
    const response = await fetchWithAuth(`/wonderpicks/feed?accountId=${encodeURIComponent(accountId)}`);
    return safeJsonParse(response, 'Failed to load wonderpicks feed');
  },
};

export default { auth, accounts, bots, tasks, cards, friends, missions, collection, presents, profile, soloBattle, eventBattle, randomBattle, battleHistory, systemHealth, trade, giveCard, hunt, automation, scheduler, autoTrade, autoGift, achievements, inventory, pvp, collectionSync, missingCards, premiumHunt, manualTrade, shinedustFarm, autoFillMissing, wishlist, huntConfig, hybridControl, godpacksFeed, wonderpicksFeed };

// ── API Contract Safety (dev-only) ─────────────────────────────────
// Wraps each API namespace in a Proxy that throws descriptive errors
// when a missing method is called. Catches "od.getRequests is not a
// function" style bugs at the call site during development.
// No-op in production builds (import.meta.env.DEV is false).
if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  const wrapNamespace = (name, obj) => new Proxy(obj, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
      throw new Error(
        `[API Contract] ${name}.${String(prop)} does not exist. ` +
        `Available methods: ${Object.keys(target).join(', ')}`
      );
    }
  });

  // Wrap each exported namespace in-place
  const namespaces = { auth, accounts, bots, tasks, cards, friends, missions, collection, presents, profile, soloBattle, eventBattle, randomBattle, battleHistory, systemHealth, trade, giveCard, hunt, automation, scheduler, autoTrade, autoGift, achievements, inventory, pvp, collectionSync, missingCards, premiumHunt, manualTrade, shinedustFarm, autoFillMissing, wishlist, huntConfig, hybridControl };
  for (const [name, ns] of Object.entries(namespaces)) {
    // Replace each namespace's methods with proxy-wrapped access
    Object.setPrototypeOf(ns, new Proxy({}, {
      get(_, prop) {
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;
        throw new Error(
          `[API Contract] ${name}.${String(prop)} does not exist. ` +
          `Available methods: ${Object.keys(ns).join(', ')}`
        );
      }
    }));
  }
}
