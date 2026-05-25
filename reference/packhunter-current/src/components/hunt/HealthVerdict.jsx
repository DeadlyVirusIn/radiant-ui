/**
 * HealthVerdict — Top-level system health banner.
 * Role-aware: admins see technical details, non-admins see softened wording.
 */
import { memo } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { STATUS, getFreshnessTier } from './huntConstants'

const tierConfig = {
  healthy:  { bg: (d) => d ? 'rgba(52, 211, 153, 0.06)' : 'rgba(52, 211, 153, 0.05)', border: (d) => d ? 'rgba(52, 211, 153, 0.15)' : 'rgba(52, 211, 153, 0.2)' },
  warning:  { bg: (d) => d ? 'rgba(251, 191, 36, 0.06)' : 'rgba(251, 191, 36, 0.05)',  border: (d) => d ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.2)' },
  degraded: { bg: (d) => d ? 'rgba(251, 146, 60, 0.06)' : 'rgba(251, 146, 60, 0.05)',  border: (d) => d ? 'rgba(251, 146, 60, 0.15)' : 'rgba(251, 146, 60, 0.2)' },
  critical: { bg: (d) => d ? 'rgba(255, 82, 82, 0.08)'  : 'rgba(255, 82, 82, 0.05)',   border: (d) => d ? 'rgba(255, 82, 82, 0.2)'  : 'rgba(255, 82, 82, 0.25)' },
  off:      { bg: (d) => d ? 'rgba(100, 116, 139, 0.06)' : 'rgba(100, 116, 139, 0.05)', border: (d) => d ? 'rgba(100, 116, 139, 0.15)' : 'rgba(100, 116, 139, 0.2)' },
}

// Non-admin label softening: avoid alarming terms
const USER_SAFE_LABELS = {
  'Degraded': 'Slow',
  'Critical': 'Issue',
  'Imbalanced': 'Adjusting',
}

const HealthVerdict = memo(({ verdict, dataAgeMs, backendAgeMs, isAdmin = false }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  if (!verdict) return null

  const cfg = tierConfig[verdict.tier] || tierConfig.off
  const freshness = getFreshnessTier(dataAgeMs)
  const isFetchStale = dataAgeMs != null && dataAgeMs > 6000

  // Backend data lag: API is fresh but backend data is old
  const hasBackendLag = backendAgeMs != null && backendAgeMs > 30000 && !isFetchStale
  const isAnyStale = isFetchStale || hasBackendLag

  // Role-aware label
  const displayLabel = isAdmin ? verdict.label : (USER_SAFE_LABELS[verdict.label] || verdict.label)

  // Role-aware reason suffix (admin only)
  let reasonSuffix = ''
  if (isAdmin) {
    if (hasBackendLag) {
      reasonSuffix = ` (data lag ${Math.round(backendAgeMs / 1000)}s)`
    } else if (dataAgeMs != null && dataAgeMs > 15000) {
      reasonSuffix = ' (data stale)'
    }
  }

  // Role-aware reason text: non-admins get simplified messages for technical reasons
  // C1 (2026-04-24) — when merged verdict carries `reasons[]`, admins see
  // all contributing causes joined, so "workers fine · 1 container
  // unhealthy (recovery engine)" is visible instead of either cause
  // silently winning. Non-admins still get the single simplified reason
  // (their view prioritizes clarity over completeness).
  const displayReason = isAdmin
    ? (Array.isArray(verdict.reasons) && verdict.reasons.length > 0
        ? verdict.reasons.join(' · ')
        : verdict.reason)
    : simplifyReason(verdict.reason)

  // Freshness badge: show whichever is worse
  const displayAgeMs = (backendAgeMs != null && backendAgeMs > (dataAgeMs || 0)) ? backendAgeMs : dataAgeMs
  const displayAgeSec = displayAgeMs != null ? Math.round(displayAgeMs / 1000) : null
  const badgeFreshness = getFreshnessTier(displayAgeMs)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        mb: 2,
        borderRadius: '10px',
        bgcolor: cfg.bg(isDark),
        border: `1px solid ${cfg.border(isDark)}`,
        transition: 'all 0.3s ease',
        opacity: isAnyStale ? 0.85 : 1,
      }}
    >
      {/* Pulsing dot */}
      <Box sx={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
        {verdict.tier !== 'off' && (
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            bgcolor: verdict.color, opacity: 0.3,
            animation: verdict.tier === 'healthy' ? 'none' : 'statusPulse 2s ease-in-out infinite',
          }} />
        )}
        <Box sx={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', bgcolor: verdict.color }} />
      </Box>

      <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: verdict.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {displayLabel}
      </Typography>

      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3, flex: 1 }}>
        {displayReason}{reasonSuffix}
      </Typography>

      {/* Freshness badge */}
      {displayAgeSec != null && (
        <Typography sx={{
          fontSize: '0.65rem', fontWeight: 600, flexShrink: 0,
          color: badgeFreshness.color,
          opacity: isAnyStale ? 1 : 0.7,
        }}>
          {isAdmin
            ? (hasBackendLag ? `⚠ data ${displayAgeSec}s old` : isAnyStale ? `⚠ ${displayAgeSec}s ago` : `${displayAgeSec}s ago`)
            : `${displayAgeSec}s ago`
          }
        </Typography>
      )}
    </Box>
  )
})

// Simplify technical verdict reasons for non-admin users
function simplifyReason(reason) {
  if (!reason) return ''
  if (reason === 'All systems nominal') return 'Everything is running normally'
  if (reason === 'No active workers') return 'Hunt is not currently running'
  if (reason.includes('Error rate')) return 'Some temporary issues detected'
  if (reason.includes('Low throughput')) return 'Running slower than usual'
  if (reason.includes('Below target')) return 'Running a bit slower than usual'
  if (reason.includes('imbalance') || reason.includes('PPM/worker')) return 'Some containers are adjusting'
  return reason
}

HealthVerdict.displayName = 'HealthVerdict'
export default HealthVerdict
