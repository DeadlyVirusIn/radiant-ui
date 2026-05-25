/**
 * Admin Users API service — extracted from AdminUsers.jsx
 * All admin user management API calls in one place.
 */

const json = (r) => r.json();
const opts = { credentials: 'include' };
const postOpts = (body) => ({
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...(body !== undefined && { body: JSON.stringify(body) }),
});
const putOpts = (body) => ({
  method: 'PUT',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const delOpts = { method: 'DELETE', credentials: 'include' };

const adminApi = {
  // ── Users ───────────────────────────────────────────────────────────
  getUsers: () => fetch('/api/admin/users', opts).then(json),

  toggleAdmin: (userId, isAdmin) =>
    fetch(`/api/admin/users/${userId}/admin`, putOpts({ isAdmin })).then(json),

  toggleActive: (userId, isActive) =>
    fetch(`/api/admin/users/${userId}/active`, putOpts({ isActive })).then(json),

  updateUser: (userId, updates) =>
    fetch(`/api/admin/users/${userId}`, putOpts(updates)).then(json),

  deleteUser: (userId) =>
    fetch(`/api/admin/users/${userId}`, delOpts).then(json),

  editUser: (userId, fields) =>
    fetch(`/api/admin/users/${userId}/edit`, putOpts(fields)).then(json),

  grantTrial: (userId, days, notes) =>
    fetch(`/api/admin/users/${userId}/grant-trial`, postOpts({ days, notes })).then(json),

  // ── Accounts ────────────────────────────────────────────────────────
  getUserAccounts: (userId) =>
    fetch(`/api/admin/users/${userId}/accounts`, opts).then(json),

  editAccount: (userId, accountId, fields) =>
    fetch(`/api/admin/users/${userId}/accounts/${accountId}/edit`, putOpts(fields)).then(json),

  fetchPlayerIdAdmin: (userId, accountId) =>
    fetch(`/api/admin/users/${userId}/accounts/${accountId}/fetch-player-id`, postOpts()).then(json),

  createAccount: (userId, fields) =>
    fetch(`/api/admin/users/${userId}/accounts/create`, postOpts(fields)).then(json),

  deleteAccount: (accountId) =>
    fetch(`/api/accounts/${accountId}`, delOpts).then(json),

  // ── Subscribers ─────────────────────────────────────────────────────
  getSubscribers: () => fetch('/api/admin/subscribers', opts).then(json),

  addSubscriber: (data) =>
    fetch('/api/admin/subscribers', postOpts(data)).then(json),

  // Phase 39.5 — discordId is the stable lookup key. DELETE has no body
  // so it passes discord_id via query param; PUT passes lookup_discord_id
  // in the body alongside any other update fields.
  removeSubscriber: (discordUsername, discordId) => {
    const qs = discordId ? `?discord_id=${encodeURIComponent(discordId)}` : '';
    return fetch(`/api/admin/subscribers/${encodeURIComponent(discordUsername)}${qs}`, delOpts).then(json);
  },

  updateSubscriber: (discordUsername, data, discordId) => {
    // Pass discord_id as a dedicated lookup hint; keeps any body.discord_id
    // meant as an UPDATE value semantically separate.
    const body = discordId != null ? { ...data, lookup_discord_id: discordId } : data;
    return fetch(`/api/admin/subscribers/${encodeURIComponent(discordUsername)}`, putOpts(body)).then(json);
  },

  findDuplicateSubscribers: () =>
    fetch('/api/admin/subscribers/duplicates', opts).then(json),

  mergeSubscribers: (keepId, removeId) =>
    fetch('/api/admin/subscribers/merge', postOpts({ keepId, removeId })).then(json),

  linkSubscriber: (subscriberUsername, userId) =>
    fetch('/api/admin/link-subscriber', postOpts({ subscriberUsername, userId })).then(json),

  // ── Hunt Participants ───────────────────────────────────────────────
  getHuntParticipants: () =>
    fetch('/api/admin/hunt-participants', opts).then(json),

  toggleHuntParticipant: (discordId, packName, isActive, accountType) =>
    fetch(`/api/admin/hunt-participants/${encodeURIComponent(discordId)}/${encodeURIComponent(packName)}/toggle`, putOpts({ isActive, accountType })).then(json),

  getAvailablePacks: () =>
    fetch('/api/admin/available-packs', opts).then(json),

  addHuntPack: (discordId, packName, accountType) =>
    fetch(`/api/admin/hunt-participants/${encodeURIComponent(discordId)}/add-pack`, postOpts({ packName, accountType })).then(json),

  changeHuntGroup: (userId, group) =>
    fetch(`/api/admin/users/${userId}/hunt-group`, postOpts({ group })).then(json),

  changeProxySlot: (userId, slotId) =>
    fetch(`/api/admin/users/${userId}/proxy-slot`, postOpts({ slotId })).then(json),

  getProxySlots: () =>
    fetch('/api/admin/proxy-slots', opts).then(json),

  // ── Bot Management ──────────────────────────────────────────────────
  getBotStatus: (playerId, accountType = 'main', discordId = null) => {
    let url = `/api/admin/bots/${encodeURIComponent(playerId)}/status?accountType=${encodeURIComponent(accountType)}`;
    if (discordId) url += `&discordId=${encodeURIComponent(discordId)}`;
    return fetch(url, opts).then(json);
  },

  startBot: (playerId, accountType = 'main', discordId = null) =>
    fetch(`/api/admin/bots/${encodeURIComponent(playerId)}/start`, postOpts({ accountType, ...(discordId && { discordId }) })).then(json),

  stopBot: (playerId, accountType = 'main', discordId = null) =>
    fetch(`/api/admin/bots/${encodeURIComponent(playerId)}/stop`, postOpts({ accountType, ...(discordId && { discordId }) })).then(json),

  getFriendCount: (playerId, accountType = 'main') =>
    fetch(`/api/admin/bots/${encodeURIComponent(playerId)}/friends?accountType=${encodeURIComponent(accountType)}`, opts).then(json),

  clearFriends: (playerId) =>
    fetch(`/api/admin/bots/${encodeURIComponent(playerId)}/clear-friends`, postOpts()).then(json),

  forceStopAllBots: () =>
    fetch('/api/admin/bots/force-stop-all', postOpts()).then(json),

  startAllActiveBots: () =>
    fetch('/api/admin/bots/start-all-active', postOpts()).then(json),

  // ── Debug ───────────────────────────────────────────────────────────
  getUserBotStatus: (userId) =>
    fetch(`/api/admin/users/${userId}/bot-status`, opts).then(json),

  getUserFriends: (userId, accountId) =>
    fetch(`/api/admin/users/${userId}/friends/${accountId}`, opts).then(json),

  clearUserFriends: (userId, accountId) =>
    fetch(`/api/admin/users/${userId}/friends/${accountId}/clear`, postOpts()).then(json),

  getDataIssues: () =>
    fetch('/api/admin/data-issues', opts).then(json),
};

export default adminApi;
