/**
 * Socket.IO Service — legacy compatibility shim + bot-manager socket.
 *
 * Wave 2: the main socket is now owned by contexts/SocketContext.jsx.
 * This file no longer opens its own io('/') connection. Instead:
 *
 *   - SocketContext calls `_setSharedSocket(socket)` on mount.
 *   - All legacy on / off helpers below continue to reference the same
 *     module-level `socket` variable, so existing callers keep working
 *     without duplicate connections.
 *   - `initSocket()` is now a no-op (preserves API for callers not yet
 *     migrated; emits a one-time console deprecation notice).
 *   - `disconnectSocket()` only disconnects the bot socket now — the main
 *     socket is disconnected by SocketProvider's cleanup.
 *
 * The bot-manager socket (`/bot-io/` path) is a separate proxied
 * connection on a different container. It is NOT duplicated with the
 * main socket, so it remains managed here.
 */

import { io } from 'socket.io-client';

let socket = null;         // shared with SocketContext via _setSharedSocket
let userId = null;

// Bot manager socket (separate container on port 3007)
let botSocket = null;
let botUserId = null;

/**
 * Internal: SocketContext calls this with its socket instance (on mount)
 * and null (on unmount) so legacy on / off helpers stay wired to the one
 * real connection.
 */
export function _setSharedSocket(s) {
  socket = s;
}

// Legacy API: intentionally a no-op + deprecation warning. SocketProvider
// is now the authoritative initializer for the main socket. Kept so
// existing imports don't break while pages migrate to useSocket().
let warnedInit = false;
export function initSocket(userIdParam) {
  if (!warnedInit) {
    console.warn('[socket.js] initSocket() is deprecated — SocketProvider now manages the main socket.');
    warnedInit = true;
  }
  userId = userIdParam;
  return socket;
}

export function getSocket() {
  return socket;
}

// Legacy API — only disconnects the bot socket now. The main socket is
// owned by SocketProvider's useEffect cleanup in contexts/SocketContext.
export function disconnectSocket() {
  disconnectBotSocket();
}

// --- Bot Manager Socket (proxied through webui via /bot-io/ path) ---
export function initBotSocket(userIdParam) {
  if (botSocket && botSocket.connected) {
    if (botUserId !== userIdParam) {
      botSocket.emit('leave_user_room', botUserId);
      botSocket.emit('join_user_room', userIdParam);
      botUserId = userIdParam;
    }
    return botSocket;
  }

  // Connect to same origin — webui proxies /bot-io/ to botmanager internally.
  // This works through Cloudflare Tunnel (same port 3005, no extra port needed).
  // Use polling first (more reliable through proxy chain), limit retries to avoid console spam.
  botSocket = io('/', {
    path: '/bot-io/',
    transports: ['polling', 'websocket'],
    withCredentials: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 15000,
  });

  botSocket.on('connect', () => {
    console.log('[BotSocket] Connected:', botSocket.id);
    if (userIdParam) {
      botSocket.emit('join_user_room', userIdParam);
      botUserId = userIdParam;
    }
  });

  botSocket.on('disconnect', () => {
    console.log('[BotSocket] Disconnected');
  });

  botSocket.on('connect_error', (error) => {
    console.error('[BotSocket] Connection error:', error.message);
  });

  return botSocket;
}

export function getBotSocket() {
  return botSocket;
}

export function disconnectBotSocket() {
  if (botSocket) {
    if (botUserId) {
      botSocket.emit('leave_user_room', botUserId);
    }
    botSocket.disconnect();
    botSocket = null;
    botUserId = null;
  }
}

// Bot event listeners — use botSocket (bot manager container)
export function onBotStatus(callback) {
  if (botSocket) {
    botSocket.off('bot_status', callback);
    botSocket.on('bot_status', callback);
  }
}

export function onBotLog(callback) {
  if (botSocket) {
    botSocket.off('bot_log', callback);
    botSocket.on('bot_log', callback);
  }
}

export function onTaskStatus(callback) {
  if (socket) {
    socket.off('task_status', callback);
    socket.on('task_status', callback);
  }
}

export function onTaskLog(callback) {
  if (socket) {
    socket.off('task_log', callback);
    socket.on('task_log', callback);
  }
}

// Remove bot listeners
export function offBotStatus(callback) {
  if (botSocket) {
    botSocket.off('bot_status', callback);
  }
}

export function offBotLog(callback) {
  if (botSocket) {
    botSocket.off('bot_log', callback);
  }
}

export function offTaskStatus(callback) {
  if (socket) {
    socket.off('task_status', callback);
  }
}

export function offTaskLog(callback) {
  if (socket) {
    socket.off('task_log', callback);
  }
}

// Activity feed events
export function onActivity(callback) {
  if (socket) {
    socket.on('activity', callback);
  }
}

export function offActivity(callback) {
  if (socket) {
    socket.off('activity', callback);
  }
}

// Friend events
export function onFriendUpdate(callback) {
  if (socket) {
    socket.on('friend_update', callback);
  }
}

export function offFriendUpdate(callback) {
  if (socket) {
    socket.off('friend_update', callback);
  }
}

// Friend purge progress events (server-side bulk removal)
export function onFriendPurgeProgress(callback) {
  if (socket) {
    socket.on('friend_purge_progress', callback);
  }
}

export function offFriendPurgeProgress(callback) {
  if (socket) {
    socket.off('friend_purge_progress', callback);
  }
}

// God Pack events
export function onGodPackFound(callback) {
  if (socket) {
    socket.on('godpack_found', callback);
  }
}

export function offGodPackFound(callback) {
  if (socket) {
    socket.off('godpack_found', callback);
  }
}

// Phase 3 (Apr 2026) — godpack:updated
//
// Emitted when god_packs.status changes server-side. Payload:
//   { id, status, playerId, updatedAt }
//
// Subscribers MUST refetch the authoritative endpoint
// (/api/godpacks/feed and/or /api/wonderpicks/feed) — do NOT mutate
// UI state directly from the payload. The event is a refetch trigger,
// nothing more.
export function onGodpackUpdated(callback) {
  if (socket) {
    socket.on('godpack:updated', callback);
  }
}

export function offGodpackUpdated(callback) {
  if (socket) {
    socket.off('godpack:updated', callback);
  }
}

// Hunt events
export function onHuntStatus(callback) {
  if (socket) {
    socket.on('hunt_status', callback);
  }
}

export function offHuntStatus(callback) {
  if (socket) {
    socket.off('hunt_status', callback);
  }
}

// Daily events
export function onDailyReady(callback) {
  if (socket) {
    socket.on('daily_ready', callback);
  }
}

export function offDailyReady(callback) {
  if (socket) {
    socket.off('daily_ready', callback);
  }
}

// Error events
export function onCriticalError(callback) {
  if (socket) {
    socket.on('critical_error', callback);
  }
}

export function offCriticalError(callback) {
  if (socket) {
    socket.off('critical_error', callback);
  }
}

// Bot stats events — use botSocket
export function onBotStats(callback) {
  if (botSocket) {
    botSocket.off('bot_stats', callback);
    botSocket.on('bot_stats', callback);
  }
}

export function offBotStats(callback) {
  if (botSocket) {
    botSocket.off('bot_stats', callback);
  }
}

// Hunt instance events
export function onHuntInstanceStarted(callback) {
  if (socket) {
    socket.on('hunt_instance_started', callback);
  }
}

export function offHuntInstanceStarted(callback) {
  if (socket) {
    socket.off('hunt_instance_started', callback);
  }
}

// Pack opened events
export function onPackOpened(callback) {
  if (socket) {
    socket.on('pack_opened', callback);
  }
}

export function offPackOpened(callback) {
  if (socket) {
    socket.off('pack_opened', callback);
  }
}

// Friend accepted events
export function onFriendAccepted(callback) {
  if (socket) {
    socket.on('friend_accepted', callback);
  }
}

export function offFriendAccepted(callback) {
  if (socket) {
    socket.off('friend_accepted', callback);
  }
}

// Daily claimed events
export function onDailyClaimed(callback) {
  if (socket) {
    socket.on('daily_claimed', callback);
  }
}

export function offDailyClaimed(callback) {
  if (socket) {
    socket.off('daily_claimed', callback);
  }
}

// Battle completed events
export function onBattleCompleted(callback) {
  if (socket) {
    socket.on('battle_completed', callback);
  }
}

export function offBattleCompleted(callback) {
  if (socket) {
    socket.off('battle_completed', callback);
  }
}

// Proxy status events
export function onProxyStatus(callback) {
  if (socket) {
    socket.on('proxy_status', callback);
  }
}

export function offProxyStatus(callback) {
  if (socket) {
    socket.off('proxy_status', callback);
  }
}

// Collection update events
export function onCollectionUpdate(callback) {
  if (socket) {
    socket.on('collection_update', callback);
  }
}

export function offCollectionUpdate(callback) {
  if (socket) {
    socket.off('collection_update', callback);
  }
}

// Scheduler events
export function onSchedulerRun(callback) {
  if (socket) {
    socket.on('scheduler_run', callback);
  }
}

export function offSchedulerRun(callback) {
  if (socket) {
    socket.off('scheduler_run', callback);
  }
}

// Account status events
export function onAccountStatus(callback) {
  if (socket) {
    socket.on('account_status', callback);
  }
}

export function offAccountStatus(callback) {
  if (socket) {
    socket.off('account_status', callback);
  }
}

// Trade request events
export function onTradeRequestCreated(callback) {
  if (socket) {
    socket.on('trade_request_created', callback);
  }
}

export function offTradeRequestCreated(callback) {
  if (socket) {
    socket.off('trade_request_created', callback);
  }
}

export function onTradeRequestMatching(callback) {
  if (socket) {
    socket.on('trade_request_matching', callback);
  }
}

export function offTradeRequestMatching(callback) {
  if (socket) {
    socket.off('trade_request_matching', callback);
  }
}

export function onTradeRequestFriendSent(callback) {
  if (socket) {
    socket.on('trade_request_friend_sent', callback);
  }
}

export function offTradeRequestFriendSent(callback) {
  if (socket) {
    socket.off('trade_request_friend_sent', callback);
  }
}

export function onTradeRequestFriendAccepted(callback) {
  if (socket) {
    socket.on('trade_request_friend_accepted', callback);
  }
}

export function offTradeRequestFriendAccepted(callback) {
  if (socket) {
    socket.off('trade_request_friend_accepted', callback);
  }
}

export function onTradeProposalSent(callback) {
  if (socket) {
    socket.on('trade_proposal_sent', callback);
  }
}

export function offTradeProposalSent(callback) {
  if (socket) {
    socket.off('trade_proposal_sent', callback);
  }
}

export function onTradeRequestCompleted(callback) {
  if (socket) {
    socket.on('trade_request_completed', callback);
  }
}

export function offTradeRequestCompleted(callback) {
  if (socket) {
    socket.off('trade_request_completed', callback);
  }
}

export function onTradeRequestFailed(callback) {
  if (socket) {
    socket.on('trade_request_failed', callback);
  }
}

export function offTradeRequestFailed(callback) {
  if (socket) {
    socket.off('trade_request_failed', callback);
  }
}

export function onTradeRequestExpired(callback) {
  if (socket) {
    socket.on('trade_request_expired', callback);
  }
}

export function offTradeRequestExpired(callback) {
  if (socket) {
    socket.off('trade_request_expired', callback);
  }
}

export function onTradeRequestCancelled(callback) {
  if (socket) {
    socket.on('trade_request_cancelled', callback);
  }
}

export function offTradeRequestCancelled(callback) {
  if (socket) {
    socket.off('trade_request_cancelled', callback);
  }
}

export function onTradeRequestProgress(callback) {
  if (socket) {
    socket.on('trade_request_progress', callback);
  }
}

export function offTradeRequestProgress(callback) {
  if (socket) {
    socket.off('trade_request_progress', callback);
  }
}

export function onTradePickCard(callback) {
  if (socket) {
    socket.on('trade_pick_card', callback);
  }
}

export function offTradePickCard(callback) {
  if (socket) {
    socket.off('trade_pick_card', callback);
  }
}

export function onTradeRequestAccepted(callback) {
  if (socket) {
    socket.on('trade_request_accepted', callback);
  }
}

export function offTradeRequestAccepted(callback) {
  if (socket) {
    socket.off('trade_request_accepted', callback);
  }
}

// Battle progress events (for real-time updates during batch battles)
export function onBattleProgress(callback) {
  if (socket) {
    socket.off('battle_progress', callback);
    socket.on('battle_progress', callback);
  }
}

export function offBattleProgress(callback) {
  if (socket) {
    socket.off('battle_progress', callback);
  }
}

export function onEventBattleProgress(callback) {
  if (socket) {
    socket.off('event_battle_progress', callback);
    socket.on('event_battle_progress', callback);
  }
}

export function offEventBattleProgress(callback) {
  if (socket) {
    socket.off('event_battle_progress', callback);
  }
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  initBotSocket,
  getBotSocket,
  disconnectBotSocket,
  onBotStatus,
  onBotLog,
  onTaskStatus,
  onTaskLog,
  offBotStatus,
  offBotLog,
  offTaskStatus,
  offTaskLog,
  onActivity,
  offActivity,
  onFriendUpdate,
  offFriendUpdate,
  onGodPackFound,
  offGodPackFound,
  onHuntStatus,
  offHuntStatus,
  onDailyReady,
  offDailyReady,
  onCriticalError,
  offCriticalError,
  onBotStats,
  offBotStats,
  onHuntInstanceStarted,
  offHuntInstanceStarted,
  onPackOpened,
  offPackOpened,
  onFriendAccepted,
  offFriendAccepted,
  onDailyClaimed,
  offDailyClaimed,
  onBattleCompleted,
  offBattleCompleted,
  onProxyStatus,
  offProxyStatus,
  onCollectionUpdate,
  offCollectionUpdate,
  onSchedulerRun,
  offSchedulerRun,
  onAccountStatus,
  offAccountStatus,
  onTradeRequestCreated,
  offTradeRequestCreated,
  onTradeRequestMatching,
  offTradeRequestMatching,
  onTradeRequestFriendSent,
  offTradeRequestFriendSent,
  onTradeRequestFriendAccepted,
  offTradeRequestFriendAccepted,
  onTradeProposalSent,
  offTradeProposalSent,
  onTradeRequestCompleted,
  offTradeRequestCompleted,
  onTradeRequestFailed,
  offTradeRequestFailed,
  onTradeRequestExpired,
  offTradeRequestExpired,
  onTradeRequestCancelled,
  offTradeRequestCancelled,
  onTradeRequestProgress,
  offTradeRequestProgress,
  onTradePickCard,
  offTradePickCard,
  onTradeRequestAccepted,
  offTradeRequestAccepted,
  onBattleProgress,
  offBattleProgress,
  onEventBattleProgress,
  offEventBattleProgress,
};
