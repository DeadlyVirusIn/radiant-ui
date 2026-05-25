/**
 * BattleHistory — Compact inline table showing recent battle results.
 * Mounts below battle tabs in Battles.jsx.
 * Auto-refreshes on batch completion via socket event.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Typography,
  Chip,
  Skeleton,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  History as HistoryIcon,
  Refresh as RefreshIcon,
  SportsEsports as BattleIcon,
} from '@mui/icons-material'
import { battleHistory } from '../services/api'
import { onBattleProgress, offBattleProgress } from '../services/socket'
import { EmptyState } from './EmptyState'
import { useSectionStyles } from './SectionCard'

// Type display labels
const TYPE_LABELS = { solo: 'Solo', event: 'Event', random: 'Random' }
const TYPE_COLORS = { solo: 'primary', event: 'warning', random: 'info' }

export default function BattleHistory({ accountId }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const { sectionBox } = useSectionStyles()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    if (!accountId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await battleHistory.getHistory(accountId, { limit: 10 })
      setRows(data.battles || [])
    } catch (err) {
      console.error('[BattleHistory] Fetch error:', err)
      setRows([])
    }
    setLoading(false)
  }, [accountId])

  // Fetch on mount and when account changes
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Auto-refresh on batch completion via socket
  // Use ref to avoid re-registering listener on every render
  const fetchRef = useRef(fetchHistory)
  fetchRef.current = fetchHistory

  useEffect(() => {
    const handler = (data) => {
      if (data.phase === 'complete') {
        // Small delay to let the DB write settle
        setTimeout(() => fetchRef.current(), 500)
      }
    }
    onBattleProgress(handler)
    return () => offBattleProgress(handler)
  }, [accountId])

  // Format timestamp to short time
  const formatTime = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  if (!accountId) return null

  return (
    <Box sx={{ ...sectionBox, mt: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25,
        borderBottom: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{
          fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'text.secondary',
        }}>
          Recent Battles
        </Typography>
        {rows.length > 0 && (
          <Chip label={rows.length} size="small" sx={{
            height: 18, fontSize: '0.6rem', fontWeight: 700,
            bgcolor: isDark ? 'rgba(124,138,255,0.1)' : 'rgba(92,106,196,0.08)',
          }} />
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetchHistory} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Content */}
      <Box sx={{ px: 0.5, py: 0.5 }}>
        {loading ? (
          <Box sx={{ px: 1.5, py: 1 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={36} sx={{ borderRadius: '8px', mb: 0.5 }} />
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BattleIcon sx={{ fontSize: 40 }} />}
            title="No battle history"
            description="Run some battles to see results here."
            minHeight={120}
          />
        ) : (
          rows.map((row, i) => {
            const isWin = row.result === 'win'
            return (
              <Box
                key={row.id || i}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.5, py: 0.75,
                  borderRadius: '8px',
                  transition: 'background 0.15s ease',
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(124,138,255,0.04)' : 'rgba(0,0,0,0.02)',
                  },
                  // Subtle separator
                  ...(i < rows.length - 1 && {
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  }),
                }}
              >
                {/* Time */}
                <Box sx={{ minWidth: isMobile ? 50 : 80, flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary' }}>
                    {formatTime(row.created_at)}
                  </Typography>
                  {!isMobile && (
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', display: 'block' }}>
                      {formatDate(row.created_at)}
                    </Typography>
                  )}
                </Box>

                {/* Type chip */}
                <Chip
                  label={TYPE_LABELS[row.battle_type] || row.battle_type}
                  size="small"
                  color={TYPE_COLORS[row.battle_type] || 'default'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, minWidth: 48 }}
                />

                {/* Tier */}
                {!isMobile && (
                  <Typography variant="caption" sx={{
                    fontSize: '0.62rem', color: 'text.secondary',
                    minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.battle_tier || '—'}
                  </Typography>
                )}

                {/* Result */}
                <Chip
                  label={isWin ? 'W' : 'L'}
                  size="small"
                  sx={{
                    height: 20, width: 28, fontSize: '0.65rem', fontWeight: 800,
                    bgcolor: isWin ? theme.palette.success.main : theme.palette.error.main,
                    color: '#fff',
                    '& .MuiChip-label': { px: 0 },
                  }}
                />

                {/* Duration */}
                {!isMobile && (
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', minWidth: 35 }}>
                    {row.duration_seconds ? `${row.duration_seconds}s` : '—'}
                  </Typography>
                )}

                {/* Rewards */}
                <Box sx={{ flex: 1, textAlign: 'right' }}>
                  {row.hourglasses_earned > 0 && (
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: theme.palette.warning.main, fontWeight: 600 }}>
                      +{row.hourglasses_earned} HG
                    </Typography>
                  )}
                </Box>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}
