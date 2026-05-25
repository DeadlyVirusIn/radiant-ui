/**
 * ActivityFeed — compact list of last 20 trade/gift actions for selected account.
 * Real-time via socket events. Deduplicates by (type, id).
 */
import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Chip, Divider, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useAccount } from '../contexts/AccountContext'
import { getDisplayStatus, formatRelativeTime, getErrorDisplay } from '../utils/errorDisplay'
import { useSocket } from '../contexts/SocketContext'

const TYPE_ICON = { trade: '🔄', gift: '🎁' }

const TRADE_EVENTS = ['trade_request_created', 'trade_request_matching', 'trade_request_friend_sent',
  'trade_request_completed', 'trade_request_failed', 'trade_request_cancelled']
const GIFT_EVENTS = ['gift_request_created', 'gift_request_matching', 'gift_request_friend_sent',
  'gift_request_completed', 'gift_request_failed', 'gift_request_cancelled']

export default function ActivityFeed() {
  const theme = useTheme()
  const { selectedAccountId } = useAccount()
  const { subscribe, isConnected } = useSocket()
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const seenIds = useRef(new Set()) // dedup: "trade:123" or "gift:456"

  // Load from API
  useEffect(() => {
    if (!selectedAccountId) { setActions([]); setLoading(false); return }
    setLoading(true)
    seenIds.current.clear()
    fetch(`/api/activity/recent?accountId=${selectedAccountId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const items = data.actions || []
        items.forEach(a => seenIds.current.add(`${a.type}:${a.id}`))
        setActions(items)
      })
      .catch(() => setActions([]))
      .finally(() => setLoading(false))
  }, [selectedAccountId])

  // Real-time socket updates — prepend new events (dedup by type:id).
  // Wave 2: use SocketContext's subscribe() — this handles the
  // connected-gate + returns proper cleanups. Previously raw getSocket()
  // via the legacy service caused duplicate subscriptions when both this
  // component and the legacy layer attached handlers.
  useEffect(() => {
    if (!isConnected) return

    const handleEvent = (type) => (data) => {
      if (!data.requestId) return
      if (selectedAccountId && data.accountId && String(data.accountId) !== String(selectedAccountId)) return
      const key = `${type}:${data.requestId}`
      setActions(prev => {
        const exists = prev.findIndex(a => a.type === type && a.id === data.requestId)
        if (exists >= 0) {
          const updated = [...prev]
          updated[exists] = { ...updated[exists], status: data.status, errorMessage: data.error || updated[exists].errorMessage, timestamp: data.timestamp || updated[exists].timestamp }
          return updated
        }
        if (seenIds.current.has(key)) return prev
        seenIds.current.add(key)
        const newItem = { type, id: data.requestId, cardName: data.cardName, status: data.status, accountId: data.accountId, timestamp: data.timestamp, errorMessage: data.error }
        return [newItem, ...prev].slice(0, 20)
      })
    }

    const tradeHandler = handleEvent('trade')
    const giftHandler = handleEvent('gift')
    const unsubs = [
      ...TRADE_EVENTS.map(e => subscribe(e, tradeHandler)),
      ...GIFT_EVENTS.map(e => subscribe(e, giftHandler)),
    ]
    return () => { for (const off of unsubs) off() }
  }, [subscribe, isConnected, selectedAccountId])

  if (loading) return <CircularProgress size={20} />
  if (actions.length === 0) return <Typography variant="caption" color="text.secondary">No recent activity</Typography>

  return (
    <Box>
      {actions.map((action, i) => {
        const ds = getDisplayStatus(action.status, action.type)
        const errorInfo = ds.state === 'failed' && action.errorMessage ? getErrorDisplay(action.errorMessage, action.status) : null
        return (
          <Box key={`${action.type}-${action.id}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, minHeight: 40 }}>
              <Typography sx={{ fontSize: '0.9rem', width: 20, textAlign: 'center', flexShrink: 0 }}>{TYPE_ICON[action.type] || '📋'}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.78rem', lineHeight: 1.3 }} noWrap>
                  {action.type === 'trade' ? 'Trade' : 'Gift'}: {action.cardName || 'Unknown'}
                </Typography>
                {errorInfo && (
                  <Typography variant="caption" sx={{ color: '#ef4444', fontSize: '0.65rem' }}>
                    {errorInfo.icon} {errorInfo.message}
                  </Typography>
                )}
              </Box>
              <Chip
                label={ds.label}
                size="small"
                color={ds.color}
                variant={ds.state === 'done' ? 'filled' : 'outlined'}
                sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, flexShrink: 0 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                {formatRelativeTime(action.timestamp)}
              </Typography>
            </Box>
            {i < actions.length - 1 && <Divider sx={{ opacity: 0.3 }} />}
          </Box>
        )
      })}
    </Box>
  )
}
