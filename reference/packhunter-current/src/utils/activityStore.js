/**
 * Activity Store — module-level bounded event store for real-time activity.
 *
 * Account-scoped: events partitioned by accountId, cross-account mixing impossible.
 * Deduped: events keyed by (type, requestId), updates in-place on status change.
 * Bounded: max 20 events per account, oldest trimmed on overflow.
 * Subscribable: components re-render on push via callback set.
 */

const MAX_EVENTS = 20
const SESSION_KEY_PREFIX = 'vudoo_activity_'
const SESSION_MAX = 10
const stores = new Map() // accountId → { events: [], seen: Set }
const subscribers = new Set()

function getStore(accountId) {
  const key = String(accountId || 'default')
  if (!stores.has(key)) {
    // Hydrate from sessionStorage on first access
    let saved = []
    try {
      const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + key)
      if (raw) saved = JSON.parse(raw)
    } catch {}
    const seen = new Set(saved.map(e => e.key))
    stores.set(key, { events: saved, seen })
  }
  return stores.get(key)
}

function persistToSession(accountId) {
  try {
    const key = String(accountId || 'default')
    const store = stores.get(key)
    if (!store) return
    sessionStorage.setItem(SESSION_KEY_PREFIX + key, JSON.stringify(store.events.slice(0, SESSION_MAX)))
  } catch {}
}

function notify() {
  for (const cb of subscribers) {
    try { cb() } catch {}
  }
}

/**
 * Push a socket event into the store.
 * @param {string|number} accountId
 * @param {'trade'|'gift'} type
 * @param {Object} data — must have requestId, status; optionally cardName, error, timestamp
 */
export function pushEvent(accountId, type, data) {
  if (!accountId || !data?.requestId) return
  const store = getStore(accountId)
  const key = `${type}:${data.requestId}`

  // Dedup: update existing entry if same (type, requestId)
  const idx = store.events.findIndex(e => e.key === key)
  const entry = {
    key,
    type,
    id: data.requestId,
    cardName: data.cardName || (idx >= 0 ? store.events[idx].cardName : 'Unknown'),
    status: data.status,
    error: data.error || null,
    timestamp: data.timestamp || new Date().toISOString(),
    accountId,
  }

  if (idx >= 0) {
    // Update in-place (status change)
    store.events[idx] = entry
  } else {
    // New event — prepend and trim
    store.events.unshift(entry)
    if (store.events.length > MAX_EVENTS) {
      const removed = store.events.pop()
      store.seen.delete(removed.key)
    }
    store.seen.add(key)
  }

  persistToSession(accountId)
  notify()
}

/**
 * Get events for a specific account.
 * @param {string|number} accountId
 * @param {number} limit
 * @returns {Array}
 */
export function getEvents(accountId, limit = 5) {
  if (!accountId) return []
  const store = getStore(accountId)
  return store.events.slice(0, limit)
}

/**
 * Check if the store has any events for an account.
 */
export function hasEvents(accountId) {
  if (!accountId) return false
  return stores.has(String(accountId)) && stores.get(String(accountId)).events.length > 0
}

/**
 * Subscribe to store changes. Returns unsubscribe function.
 */
export function subscribe(callback) {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}
