/**
 * DataFreshness - Shows when data was last updated with auto-refresh countdown
 *
 * Usage:
 *   <DataFreshness
 *     lastUpdated={lastFetchTime}
 *     onRefresh={handleRefresh}
 *     loading={isLoading}
 *   />
 */

import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

// Format relative time (e.g., "2m ago", "just now")
function formatRelativeTime(date) {
  if (!date) return 'Never'

  const now = new Date()
  const then = new Date(date)
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return `${diffDay}d ago`
}

// Get staleness level for styling
function getStalenessLevel(date, thresholds = { fresh: 60, stale: 300 }) {
  if (!date) return 'unknown'

  const diffSec = Math.floor((new Date() - new Date(date)) / 1000)

  if (diffSec < thresholds.fresh) return 'fresh'
  if (diffSec < thresholds.stale) return 'moderate'
  return 'stale'
}

export function DataFreshness({
  lastUpdated,
  onRefresh,
  loading = false,
  showIcon = true,
  variant = 'default', // 'default', 'compact', 'minimal'
  autoRefreshInterval = null, // Auto-refresh interval in ms (null = disabled)
  thresholds = { fresh: 60, stale: 300 }, // Seconds
}) {
  const [, forceUpdate] = useState(0)

  // Update display every 10 seconds for relative time
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate((n) => n + 1)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // Auto-refresh if configured
  useEffect(() => {
    if (!autoRefreshInterval || !onRefresh) return

    const timer = setInterval(() => {
      if (!loading) {
        onRefresh()
      }
    }, autoRefreshInterval)

    return () => clearInterval(timer)
  }, [autoRefreshInterval, onRefresh, loading])

  const staleness = getStalenessLevel(lastUpdated, thresholds)
  const relativeTime = formatRelativeTime(lastUpdated)

  const getColor = () => {
    switch (staleness) {
      case 'fresh':
        return 'success.main'
      case 'moderate':
        return 'warning.main'
      case 'stale':
        return 'error.main'
      default:
        return 'text.secondary'
    }
  }

  const handleRefresh = useCallback(() => {
    if (onRefresh && !loading) {
      onRefresh()
    }
  }, [onRefresh, loading])

  if (variant === 'minimal') {
    return (
      <Tooltip title={`Last updated: ${relativeTime}`}>
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: getColor(),
            cursor: onRefresh ? 'pointer' : 'default',
          }}
          onClick={handleRefresh}
        >
          {loading ? (
            <CircularProgress size={12} color="inherit" />
          ) : (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'currentColor',
              }}
            />
          )}
        </Box>
      </Tooltip>
    )
  }

  if (variant === 'compact') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: getColor(), display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          {showIcon && <AccessTimeIcon sx={{ fontSize: 14 }} />}
          {relativeTime}
        </Typography>
        {onRefresh && (
          <IconButton
            size="small"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh data"
            sx={{ p: 0.25 }}
          >
            {loading ? (
              <CircularProgress size={14} />
            ) : (
              <RefreshIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        )}
      </Box>
    )
  }

  // Default variant
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        color: 'text.secondary',
      }}
    >
      {showIcon && <AccessTimeIcon sx={{ fontSize: 16, color: getColor() }} />}
      <Typography variant="body2" sx={{ color: getColor() }}>
        Updated {relativeTime}
      </Typography>
      {onRefresh && (
        <Tooltip title="Refresh data">
          <IconButton
            size="small"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh data"
            sx={{ ml: 0.5 }}
          >
            {loading ? (
              <CircularProgress size={18} />
            ) : (
              <RefreshIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

/**
 * useDataFreshness - Hook for managing data freshness state
 *
 * Usage:
 *   const { lastUpdated, markUpdated, DataFreshnessIndicator } = useDataFreshness({
 *     onRefresh: fetchData,
 *   })
 *
 *   // In your fetch function:
 *   const fetchData = async () => {
 *     await api.getData()
 *     markUpdated()
 *   }
 */
export function useDataFreshness({ onRefresh, ...props } = {}) {
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(false)

  const markUpdated = useCallback(() => {
    setLastUpdated(new Date())
  }, [])

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return
    setLoading(true)
    try {
      await onRefresh()
      markUpdated()
    } finally {
      setLoading(false)
    }
  }, [onRefresh, markUpdated])

  const DataFreshnessIndicator = (extraProps) => (
    <DataFreshness
      lastUpdated={lastUpdated}
      onRefresh={onRefresh ? handleRefresh : undefined}
      loading={loading}
      {...props}
      {...extraProps}
    />
  )

  return {
    lastUpdated,
    markUpdated,
    loading,
    setLoading,
    handleRefresh,
    DataFreshnessIndicator,
  }
}

export default DataFreshness
