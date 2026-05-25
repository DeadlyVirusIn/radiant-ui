/**
 * GlobalActivityBridge — Wave 2
 *
 * Invisible component (returns null) that forwards global trade/gift
 * socket events into the client-side activity store. Previously this
 * wiring lived in App.jsx's getMe() callback, using the legacy
 * services/socket.js getSocket() helper. That pattern:
 *   - raced the socket connect (listeners attached before connect →
 *     missed events)
 *   - used the legacy socket layer directly (bypassed the context-owned
 *     connection, contributing to the dual-socket problem)
 *   - had no cleanup (listeners leaked on logout/remount)
 *
 * This component fixes all three: subscribes via SocketContext's
 * subscribe(), which handles the connected-gate + returns a proper
 * cleanup function. Mounted exactly once inside <SocketProvider>.
 */

import { useEffect } from 'react'
import { useSocket } from '../contexts/SocketContext'
import { pushEvent as pushActivityEvent } from '../utils/activityStore'

const TRADE_EVENTS = [
  'trade_request_created',
  'trade_request_matching',
  'trade_request_friend_sent',
  'trade_request_completed',
  'trade_request_failed',
  'trade_request_cancelled',
]

const GIFT_EVENTS = [
  'gift_request_created',
  'gift_request_matching',
  'gift_request_friend_sent',
  'gift_request_completed',
  'gift_request_failed',
  'gift_request_cancelled',
]

export default function GlobalActivityBridge() {
  const { subscribe, isConnected } = useSocket()

  useEffect(() => {
    if (!isConnected) return

    const unsubscribers = []

    const makeHandler = (kind) => (data) => {
      if (data?.accountId) pushActivityEvent(data.accountId, kind, data)
    }

    const tradeHandler = makeHandler('trade')
    const giftHandler = makeHandler('gift')

    for (const ev of TRADE_EVENTS) unsubscribers.push(subscribe(ev, tradeHandler))
    for (const ev of GIFT_EVENTS)  unsubscribers.push(subscribe(ev, giftHandler))

    return () => {
      for (const off of unsubscribers) off()
    }
  }, [subscribe, isConnected])

  return null
}
