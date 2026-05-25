/**
 * AttentionPanel — Auto-surfaces problem workers ranked by impact.
 *
 * Reason labels: ERROR BURST | STALE | NO PACKS | LOW PPM
 * Ranking: critical severity first, then by impact score.
 * Cap at 15 items to prevent overload.
 * Just-started workers (< 60s runtime) are excluded to avoid false positives.
 */
import { memo, useState, useMemo } from 'react'
import { Box, Typography, Chip, Collapse, IconButton, useTheme } from '@mui/material'
import {
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { getContainerColor, STATUS, FONT } from './huntConstants'
import { tabularNumStyle } from '../../utils/formatNumber'

// Reason label config: tag name, color, tooltip
const REASON_TAGS = {
  ERROR_BURST: { label: 'ERROR BURST', color: STATUS.CRITICAL },
  STALE:       { label: 'STALE',       color: STATUS.DEGRADED },
  NO_PACKS:    { label: 'NO PACKS',    color: STATUS.WARNING },
  LOW_PPM:     { label: 'LOW PPM',     color: STATUS.WARNING },
}

function categorizeIssues(instances, containerHealthMap) {
  const issues = []
  const now = Date.now()

  // Pre-compute per-container median recentPPM for peer comparison
  const containerRecentPPMs = {}
  const byGroup = {}
  for (const inst of instances) {
    if (!inst.isActive || !inst.recentWindow || inst.recentWindow.accounts < 3) continue
    const g = inst.containerGroup || '0'
    if (!byGroup[g]) byGroup[g] = []
    byGroup[g].push(inst.recentWindow.packs) // packs in 60s = PPM
  }
  for (const [g, ppmValues] of Object.entries(byGroup)) {
    if (ppmValues.length < 5) continue // need enough peers for meaningful median
    const sorted = [...ppmValues].sort((a, b) => a - b)
    containerRecentPPMs[g] = sorted[Math.floor(sorted.length / 2)] // median
  }

  for (const inst of instances) {
    // Skip just-started workers (< 60s runtime) to avoid false positives
    if (inst.startTime && (now - inst.startTime) < 60000) continue
    // Skip inactive workers — they're already idle, no surprise there
    if (!inst.isActive) continue

    const reasons = []
    let impactScore = 0
    let severity = 'warning'

    // 1. High error workers — prefer recentWindow error rate when available,
    //    fall back to cumulative with runtime-scaled thresholds
    const runtimeHours = inst.startTime ? (now - inst.startTime) / 3600000 : 0
    const instRW = inst.recentWindow
    if (instRW && instRW.accounts >= 3 && instRW.errors >= 2) {
      // Recent window available: use real recent error rate
      // Require >= 2 errors to avoid single-error noise in small windows
      const recentRate = instRW.errors / instRW.accounts
      if (recentRate > 0.15) {
        reasons.push(REASON_TAGS.ERROR_BURST)
        impactScore += instRW.errors * 5
        severity = 'critical'
      } else if (recentRate > 0.05) {
        reasons.push(REASON_TAGS.ERROR_BURST)
        impactScore += instRW.errors * 3
      }
    } else {
      // Fallback: cumulative errors with runtime-scaled thresholds
      const warnThreshold = Math.max(5, Math.floor(runtimeHours * 3))
      const critThreshold = Math.max(20, Math.floor(runtimeHours * 10))
      if (inst.errors > warnThreshold) {
        reasons.push(REASON_TAGS.ERROR_BURST)
        impactScore += inst.errors
        if (inst.errors > critThreshold) severity = 'critical'
      }
    }

    // 2. Zero-PPM active workers (running + processing accounts but no packs)
    if ((inst.packsOpened || 0) === 0 && inst.accountsProcessed > 10) {
      reasons.push(REASON_TAGS.NO_PACKS)
      impactScore += 30
      severity = 'critical'
    }
    // 2b. Worker WAS producing packs but stopped (lastPackTimestamp available and > 60s ago)
    // Only flag if worker has been running >2 min and has produced packs before
    else if (inst.lastPackTimestamp && (inst.packsOpened || 0) > 0) {
      const packIdleSec = (now - inst.lastPackTimestamp) / 1000
      if (packIdleSec > 60 && runtimeHours > 0.033) { // > 60s idle, > 2 min runtime
        reasons.push(REASON_TAGS.NO_PACKS)
        impactScore += Math.min(packIdleSec, 300)
        if (packIdleSec > 180) severity = 'critical'
      }
    }

    // 3. Stale workers — active but haven't updated recently
    if (inst.lastUpdated) {
      const staleSec = (now - inst.lastUpdated) / 1000
      if (staleSec > 30) {
        reasons.push(REASON_TAGS.STALE)
        impactScore += Math.min(staleSec, 300) // cap influence at 5 min
        if (staleSec > 120) severity = 'critical'
      }
    }

    // 4. Low PPM vs container peers — real peer comparison using recentWindow
    const rw = inst.recentWindow
    const g = inst.containerGroup || '0'
    const containerMedian = containerRecentPPMs[g]
    if (rw && rw.accounts >= 3 && containerMedian != null && containerMedian >= 2 && runtimeHours > 0.033) {
      const workerRecentPPM = rw.packs // packs in 60s = PPM
      if (workerRecentPPM < containerMedian * 0.35) {
        reasons.push(REASON_TAGS.LOW_PPM)
        impactScore += Math.max(0, containerMedian - workerRecentPPM)
      }
    }

    // 5. Workers in degraded/critical containers get a boost
    const containerTier = containerHealthMap?.[inst.containerGroup]
    if (containerTier === 'critical') impactScore += 20
    else if (containerTier === 'degraded') impactScore += 10

    if (reasons.length > 0) {
      issues.push({
        worker: inst.id,
        container: inst.containerGroup,
        severity,
        impactScore,
        reasons,
        detail: buildDetail(inst, now),
      })
    }
  }

  // Rank: critical first, then by impact score descending
  issues.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1
    if (a.severity !== 'critical' && b.severity === 'critical') return 1
    return b.impactScore - a.impactScore
  })

  return issues.slice(0, 15)
}

function buildDetail(inst, now) {
  const parts = []
  if (inst.errors > 0) parts.push(`${inst.errors} errors`)
  if (inst.lastUpdated) {
    const age = Math.round((now - inst.lastUpdated) / 1000)
    if (age > 10) parts.push(`${age}s since update`)
  }
  if ((inst.packsOpened || 0) === 0 && inst.accountsProcessed > 0) {
    parts.push(`${inst.accountsProcessed} accts, 0 packs`)
  }
  return parts.join(' · ') || null
}

const AttentionPanel = memo(({ instances, onFilterErrors, containerHealthMap }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  // 2026-04-24 (C2) — default collapsed. Prior default `true` auto-
  // expanded the panel on every mount, which was noisy and pushed the
  // main content downward even when admins had already dismissed it
  // mentally. Operators now explicitly click to expand. The header
  // still shows the count inline (e.g. "Attention Required (1)") so
  // the signal is never hidden.
  const [open, setOpen] = useState(false)

  const issues = useMemo(
    () => categorizeIssues(instances || [], containerHealthMap),
    [instances, containerHealthMap]
  )
  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const hasIssues = issues.length > 0

  if (!hasIssues) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, mb: 2,
        borderRadius: '10px',
        bgcolor: isDark ? 'rgba(52, 211, 153, 0.04)' : 'rgba(52, 211, 153, 0.03)',
        border: `1px solid ${isDark ? 'rgba(52, 211, 153, 0.1)' : 'rgba(52, 211, 153, 0.12)'}`,
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS.HEALTHY }} />
        <Typography sx={{ fontSize: FONT.value, color: 'text.secondary', fontWeight: 500 }}>
          No major issues detected
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{
      mb: 2, borderRadius: '12px', overflow: 'hidden',
      bgcolor: isDark
        ? (criticalCount > 0 ? 'rgba(255, 82, 82, 0.04)' : 'rgba(251, 191, 36, 0.04)')
        : (criticalCount > 0 ? 'rgba(255, 82, 82, 0.02)' : 'rgba(251, 191, 36, 0.02)'),
      border: `1px solid ${isDark
        ? (criticalCount > 0 ? 'rgba(255, 82, 82, 0.12)' : 'rgba(251, 191, 36, 0.12)')
        : (criticalCount > 0 ? 'rgba(255, 82, 82, 0.1)' : 'rgba(251, 191, 36, 0.1)')}`,
    }}>
      {/* Header */}
      <Box
        onClick={() => setOpen(prev => !prev)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25,
          cursor: 'pointer',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        }}
      >
        <WarningIcon sx={{ fontSize: 18, color: criticalCount > 0 ? STATUS.CRITICAL : STATUS.WARNING }} />
        {/* 2026-04-24 (C2) — count inlined into the header text so the
            signal is visible while collapsed. Critical-only callout
            stays as a separate chip when present; a plain count chip
            would duplicate "(N)" in the title. */}
        <Typography sx={{ fontSize: FONT.section, fontWeight: 700, color: 'text.primary', flex: 1 }}>
          Attention Required ({issues.length})
        </Typography>
        {criticalCount > 0 && (
          <Chip
            label={`${criticalCount} critical`}
            size="small"
            sx={{
              height: 20, fontSize: '0.65rem', fontWeight: 700,
              bgcolor: `${STATUS.CRITICAL}18`,
              color: STATUS.CRITICAL,
            }}
          />
        )}
        {onFilterErrors && (
          <Typography
            onClick={(e) => { e.stopPropagation(); onFilterErrors() }}
            sx={{
              fontSize: FONT.label, fontWeight: 600, cursor: 'pointer',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary', textDecoration: 'underline' },
            }}
          >
            Show in table ↓
          </Typography>
        )}
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {issues.map((issue, idx) => {
            const containerColor = getContainerColor(issue.container)
            const sevColor = issue.severity === 'critical' ? STATUS.CRITICAL : STATUS.WARNING
            return (
              <Box
                key={`${issue.worker}-${idx}`}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
                  borderBottom: idx < issues.length - 1
                    ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
                    : 'none',
                  flexWrap: 'wrap',
                }}
              >
                {/* Severity dot */}
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: sevColor, flexShrink: 0 }} />

                {/* Container chip */}
                <Chip
                  label={`C${issue.container}`}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.6rem', fontWeight: 700, minWidth: 28,
                    bgcolor: `${containerColor}15`, color: containerColor,
                    border: `1px solid ${containerColor}25`,
                  }}
                />

                {/* Worker ID */}
                <Typography sx={{ fontSize: FONT.value, fontWeight: 600, color: 'text.primary', ...tabularNumStyle, minWidth: 36 }}>
                  #{issue.worker}
                </Typography>

                {/* Reason tags */}
                <Box sx={{ display: 'flex', gap: 0.5, flex: 1, flexWrap: 'wrap' }}>
                  {issue.reasons.map((r, ri) => (
                    <Chip
                      key={ri}
                      label={r.label}
                      size="small"
                      sx={{
                        height: 16, fontSize: '0.55rem', fontWeight: 700,
                        bgcolor: `${r.color}12`, color: r.color,
                        border: `1px solid ${r.color}20`,
                        letterSpacing: '0.03em',
                      }}
                    />
                  ))}
                </Box>

                {/* Detail text */}
                {issue.detail && (
                  <Typography sx={{ fontSize: FONT.label, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {issue.detail}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </Collapse>
    </Box>
  )
})

AttentionPanel.displayName = 'AttentionPanel'
export default AttentionPanel
