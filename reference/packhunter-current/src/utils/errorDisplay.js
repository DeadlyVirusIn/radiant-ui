/**
 * Error Display Utility — maps backend errors to user-friendly messages
 *
 * Categories:
 *   retryable  — system is handling it, user can wait or retry later
 *   actionable — user needs to do something (accept friend, pick card, etc.)
 *   final      — terminal, cannot retry today
 */

/**
 * Error groups for higher-level categorization:
 *   network    — connectivity, proxy, 0-byte responses
 *   timeout    — took too long, server auto-cancelled
 *   execution  — backend failure during trade/gift processing
 *   account    — account mismatch, not found, session issues
 *   validation — user action needed, limits, card unavailable
 *   cancelled  — user or system cancelled
 */
const ERROR_MAP = [
  // ABORTED variants
  { match: /ABORTED/i, message: 'Temporary issue — system is retrying...', category: 'retryable', group: 'execution', icon: '🔄', recommendation: 'No action needed — the system retries automatically' },
  { match: /Assertion/i, message: 'Temporary issue — retrying with fresh session...', category: 'retryable', group: 'execution', icon: '🔄', recommendation: 'Wait a moment — the system is refreshing the connection' },

  // Timeout variants
  { match: /timed?\s*out|auto.?cancel.*timeout/i, message: 'Took too long — please try again', category: 'retryable', group: 'timeout', icon: '⏱️', recommendation: 'Use "Request Again" to retry in a few minutes' },
  { match: /timeout|exceeded.*timeout/i, message: 'Request timed out — please retry', category: 'retryable', group: 'timeout', icon: '⏱️', recommendation: 'Use "Request Again" to retry in a few minutes' },
  { match: /stuck.*intermediate/i, message: 'Request got stuck — server cleaned it up', category: 'retryable', group: 'timeout', icon: '⏱️', recommendation: 'Use "Request Again" — this was a temporary issue' },

  // Friend request issues
  { match: /friend.*not accepted|friend.*expired/i, message: 'Friend request wasn\'t accepted in time', category: 'actionable', group: 'validation', icon: '👥', recommendation: 'Accept the friend request in-game within 10 minutes next time' },
  { match: /friend.*full|friend.*limit/i, message: 'Friend list is full — remove some friends first', category: 'actionable', group: 'validation', icon: '👥', recommendation: 'Remove some friends in-game, then retry' },

  // Daily limits
  { match: /daily.*limit|already.*received.*gift/i, message: 'Daily limit reached — try again after reset', category: 'final', group: 'validation', icon: '📅', recommendation: 'Try again after 6:00 AM UTC (daily reset)' },
  { match: /GIVE_CARD_RECEIVER_DAILY_LIMIT/i, message: 'Already received a gift today — try tomorrow', category: 'final', group: 'validation', icon: '📅', recommendation: 'Try again after 6:00 AM UTC (daily reset)' },

  // Trade-specific
  { match: /trade.*rejected/i, message: 'Trade was rejected by partner', category: 'final', group: 'execution', icon: '❌', recommendation: 'Request the same card again — a different partner will be matched' },
  { match: /trade.*power|stamina.*insufficient/i, message: 'Not enough trade stamina — wait for recharge', category: 'actionable', group: 'validation', icon: '⚡', recommendation: 'Wait for trade stamina to recharge (12h per unit)' },
  { match: /no.*available.*account|card.*not.*available/i, message: 'Card currently unavailable — try again later', category: 'retryable', group: 'validation', icon: '🃏', recommendation: 'Try a different card, or retry later when stock refreshes' },
  { match: /already.*in.*trade/i, message: 'Already in a trade session — complete or cancel it first', category: 'actionable', group: 'validation', icon: '🔄', recommendation: 'Complete or cancel your active trade, then try again' },

  // Proxy / network
  { match: /0-byte|ZERO_BYTE/i, message: 'Network issue — system is retrying...', category: 'retryable', group: 'network', icon: '🌐', recommendation: 'No action needed — automatic retry in progress' },
  { match: /proxy|connection.*refused|ECONNREFUSED|ECONNRESET/i, message: 'Connection issue — retrying...', category: 'retryable', group: 'network', icon: '🌐', recommendation: 'No action needed — automatic retry in progress' },
  { match: /socket.*hang|EHOSTUNREACH|ENETUNREACH/i, message: 'Network unreachable — retrying...', category: 'retryable', group: 'network', icon: '🌐', recommendation: 'No action needed — automatic retry in progress' },

  // Server restart / orphaned
  { match: /server.*restart/i, message: 'Server restarted during operation — please retry', category: 'retryable', group: 'execution', icon: '🔧', recommendation: 'Use "Request Again" — the server is back online' },
  { match: /orphaned|no executor/i, message: 'Request lost during server maintenance — please retry', category: 'retryable', group: 'execution', icon: '🔧', recommendation: 'Use "Request Again" — the server has recovered' },

  // Account issues
  { match: /account.*not.*found|inactive/i, message: 'Account not found or inactive', category: 'final', group: 'account', icon: '🚫', recommendation: 'Check your account settings and re-link if needed' },
  { match: /login.*fail|auth.*fail|unauthorized/i, message: 'Account login failed — re-link your account', category: 'final', group: 'account', icon: '🚫', recommendation: 'Go to Account settings and re-link your device account' },
  { match: /session.*expired|stale.*session/i, message: 'Session expired — system is refreshing...', category: 'retryable', group: 'account', icon: '🔑', recommendation: 'Use "Request Again" — a fresh session will be created' },

  // Cancelled
  { match: /cancelled|reconciled/i, message: 'Cancelled', category: 'final', group: 'cancelled', icon: '✖️', recommendation: null },
]

/**
 * Map a raw error string to a user-friendly display object.
 *
 * Apr 2026 — second arg `requestStatus` lets the mapper suppress
 * "system is retrying..." copy when the request is TERMINAL
 * (FAILED / CANCELLED). On terminal requests we surface the real
 * backend error verbatim instead of misleading the operator into
 * thinking a retry is in progress.
 *
 * @param {string} errorStr      - Raw error message from backend
 * @param {string} [requestStatus] - 'PENDING' | 'EXECUTING' | 'FAILED' | 'CANCELLED' | ...
 * @returns {{ message, category, group, icon, recommendation }}
 */
export function getErrorDisplay(errorStr, requestStatus = null) {
  if (!errorStr) return { message: 'Unknown error', category: 'final', group: 'execution', icon: '❓' }
  const str = String(errorStr)
  const isTerminal = requestStatus === 'FAILED' || requestStatus === 'CANCELLED'

  for (const entry of ERROR_MAP) {
    if (!entry.match.test(str)) continue

    // Terminal requests must NOT show retry-style copy. The request
    // is permanently dead; "system is retrying..." is a lie. Surface
    // the real backend message verbatim and downgrade to 'final' so
    // the UI styling reflects terminality.
    if (isTerminal && entry.category === 'retryable') {
      const cleaned = str.replace(/^(Gift|Trade)\s*(failed|error):\s*/i, '').trim()
      return {
        message: cleaned || str,
        category: 'final',
        group: entry.group,
        icon: '⚠️',
        recommendation: 'Use "Request Again" to try a fresh attempt',
      }
    }

    return { message: entry.message, category: entry.category, group: entry.group, icon: entry.icon, recommendation: entry.recommendation || null }
  }

  // Fallback: clean up the raw error
  const cleaned = str.replace(/^(Gift|Trade)\s*(failed|error):\s*/i, '').trim()
  return { message: cleaned || str, category: 'final', group: 'execution', icon: '⚠️' }
}

/**
 * Group labels for display.
 */
export const ERROR_GROUP_LABELS = {
  network: 'Network',
  timeout: 'Timeout',
  execution: 'Execution',
  account: 'Account',
  validation: 'Action Required',
  cancelled: 'Cancelled',
}

// Groups that are safe to auto-retry (transient failures)
const SAFE_RETRY_GROUPS = new Set(['network', 'timeout', 'execution']);

/**
 * Check if a failed request is safe to retry based on its error message.
 * Safe: network issues, timeouts, backend execution failures (transient).
 * Unsafe: account errors, validation/limit failures, user-cancelled.
 */
export function isRetryable(errorMessage) {
  if (!errorMessage) return false;
  const info = getErrorDisplay(errorMessage);
  return info.category === 'retryable' && SAFE_RETRY_GROUPS.has(info.group);
}

/**
 * Map a DB status to a 4-state display status.
 * @param {string} status - Raw DB status
 * @param {string} type - 'trade' or 'gift'
 * @returns {{ label: string, state: 'queued'|'action_needed'|'processing'|'done'|'failed', color: string }}
 */
export function getDisplayStatus(status, type = 'trade') {
  switch (status) {
    case 'PENDING':
    case 'QUEUED':
      return { label: 'Queued', state: 'queued', color: 'default' }
    case 'MATCHING':
      return { label: 'Finding card...', state: 'processing', color: 'info' }
    case 'FRIEND_REQUEST_SENT':
      return { label: type === 'trade' ? 'Accept friend request' : 'Waiting for friend', state: 'action_needed', color: 'warning' }
    case 'FRIEND_ACCEPTED':
      return { label: 'Friend accepted', state: 'processing', color: 'info' }
    case 'TRADE_PROPOSAL_SENT':
      return { label: 'Accept trade in-game', state: 'action_needed', color: 'warning' }
    case 'WAITING_TRADE_RESPONSE':
      return { label: 'Waiting for response', state: 'processing', color: 'info' }
    case 'PICK_CARD':
      return { label: 'Pick a card to offer', state: 'action_needed', color: 'warning' }
    case 'CONFIRMING_TRADE':
      return { label: 'Confirming trade...', state: 'processing', color: 'info' }
    case 'EXECUTING_GIFT':
      return { label: 'Sending gift...', state: 'processing', color: 'info' }
    case 'COMPLETED':
      return { label: 'Completed', state: 'done', color: 'success' }
    case 'FAILED':
      return { label: 'Failed', state: 'failed', color: 'error' }
    case 'CANCELLED':
      return { label: 'Cancelled', state: 'failed', color: 'default' }
    default:
      return { label: status || 'Unknown', state: 'processing', color: 'info' }
  }
}

/**
 * Format a relative time string.
 * @param {string|Date} timestamp
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.round((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}
