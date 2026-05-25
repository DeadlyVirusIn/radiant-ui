/**
 * InlineActivityStrip — compact horizontal bar showing last 5 actions.
 * Account-scoped. Hidden until first event arrives. Click scrolls to request card.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Box, Chip, Typography, Snackbar, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useAccount } from '../contexts/AccountContext'
import { getEvents, hasEvents, subscribe } from '../utils/activityStore'
import { getDisplayStatus, formatRelativeTime } from '../utils/errorDisplay'

const TYPE_ICON = { trade: '🔄', gift: '🎁' }
const TYPE_PAGE = { trade: '/trade', gift: '/auto-gift' }

/**
 * Scroll to a request card. Returns true if found, false if not.
 */
export function scrollToRequest(type, id) {
  const el = document.getElementById(`request-${type}-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('highlight-pulse')
    setTimeout(() => el.classList.remove('highlight-pulse'), 2000)
    return true
  }
  return false
}

export default function InlineActivityStrip() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedAccountId } = useAccount()
  const [, forceUpdate] = useState(0)
  const [toast, setToast] = useState(null)

  // Re-render on store changes
  useEffect(() => {
    return subscribe(() => forceUpdate(v => v + 1))
  }, [])

  // On mount: if ?highlight=trade:123 in URL, attempt scroll after short delay
  useEffect(() => {
    const hl = searchParams.get('highlight')
    if (!hl) return
    const [type, id] = hl.split(':')
    if (!type || !id) return
    // Delay to let cards render
    const timer = setTimeout(() => {
      scrollToRequest(type, id)
      // Clean up URL param
      searchParams.delete('highlight')
      setSearchParams(searchParams, { replace: true })
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const handleClick = (ev) => {
    const found = scrollToRequest(ev.type, ev.id)
    if (!found) {
      const page = TYPE_PAGE[ev.type]
      if (page) {
        setToast({ message: `This item is on the ${ev.type === 'trade' ? 'Trade' : 'Gift'} page`, page, type: ev.type, id: ev.id })
      }
    }
  }

  if (!hasEvents(selectedAccountId)) return null
  const events = getEvents(selectedAccountId, 5)

  return (
    <>
      <style>{`
        @keyframes highlightPulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 0 3px ${theme.palette.primary.main}60; }
        }
        .highlight-pulse {
          animation: highlightPulse 0.6s ease-in-out 3;
        }
      `}</style>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75, py: 0.75, px: 1.5,
        mb: 1.5, borderRadius: '10px', overflowX: 'auto',
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
      }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.6rem', flexShrink: 0 }}>
          RECENT
        </Typography>
        {events.map(ev => {
          const ds = getDisplayStatus(ev.status, ev.type)
          return (
            <Chip
              key={ev.key}
              label={`${TYPE_ICON[ev.type] || ''} ${ev.cardName || '?'} · ${ds.label} · ${formatRelativeTime(ev.timestamp)}`}
              size="small"
              color={ds.color}
              variant="outlined"
              onClick={() => handleClick(ev)}
              sx={{
                height: 22, fontSize: '0.6rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.03)' },
              }}
            />
          )
        })}
      </Box>
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast?.message}
        action={toast?.page ? (
          <Button size="small" color="primary" onClick={() => { navigate(`${toast.page}?highlight=${toast.type}:${toast.id}`); setToast(null) }}>
            Open
          </Button>
        ) : null}
      />
    </>
  )
}
