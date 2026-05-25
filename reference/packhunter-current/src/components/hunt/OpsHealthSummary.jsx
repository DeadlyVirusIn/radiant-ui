/**
 * Ops Health Summary — compact admin-only strip for Hunt Monitor.
 *
 * Replaces the full RecoveryStatusPanel + LivePackRetentionPanel
 * mounts on Hunt Monitor with two small chips that:
 *   - surface current status + counts at a glance
 *   - link to the dedicated Hunt Ops admin page for the full view
 *
 * Polls both endpoints independently so a slow/failing endpoint
 * doesn't block the other chip from updating.
 *
 * Hidden entirely for non-admins (caller passes isAdmin).
 */

import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Chip, Skeleton, Tooltip, useTheme } from '@mui/material'
import {
  Shield as ShieldIcon,
  WarningAmber as WarnIcon,
  ErrorOutline as ErrIcon,
  CheckCircleOutline as OkIcon,
  ChevronRight as ChevronIcon,
} from '@mui/icons-material'
import { fetchWithAuth } from '../../services/api'
import { formatRecoveryLabels } from './huntConstants'

const RECOVERY_POLL_MS  = 30_000
const RETENTION_POLL_MS = 60_000

// Apr 2026 — recoveryMode + recoveryModeLabel come from the
// canonical resolver (lib/recoveryModeResolver.js) on the backend.
// Do NOT re-derive a mode label from autoRetryFlag here — that
// produced the false "Audit-only" while Fleet Health correctly
// showed "Live (safe)". currentUnhealthyCount is also computed
// server-side from the (now-correct) per-container evaluator state.
//
// C1 (2026-04-24) — when parent passes unifiedVerdict, the chip color
// is driven by the unified tier (same source as the top HealthVerdict
// pill). This closes the "header HEALTHY / sub-pill 1 unhealthy"
// contradiction. Fallback to local derivation preserves standalone
// behavior for any future embed that doesn't pass the verdict.
function statusChipColor(recovery, unifiedVerdict) {
  if (unifiedVerdict?.tier) {
    switch (unifiedVerdict.tier) {
      case 'critical': return 'error'
      case 'degraded': return 'warning'
      case 'warning':  return 'warning'
      case 'off':      return 'default'
      default:         return 'success'
    }
  }
  if (!recovery) return 'default'
  const unhealthy = recovery.currentUnhealthyCount ?? 0
  if (unhealthy > 0) return 'warning'
  if (recovery.recoveryMode === 'unknown' || !recovery.engine?.active) return 'error'
  return 'success'
}

function recoverySummaryLabel(recovery) {
  if (!recovery) return '—'
  // C5 (2026-04-24) — shared two-field format. Replaces the old
  // "Recovery: Live (safe) · N unhealthy" single-line with the
  // canonical "Recovery Mode: <MODE> · Impact: <phrase>" wording.
  // See huntConstants.formatRecoveryLabels() for mode → impact map.
  return formatRecoveryLabels(recovery).summaryLine
}

function retentionSummaryLabel(retention) {
  if (!retention) return '—'
  const parts = []
  if (retention.totals?.atRisk > 0)         parts.push(`${retention.totals.atRisk} at risk`)
  if (retention.totals?.likelySevered > 0)  parts.push(`${retention.totals.likelySevered} likely severed`)
  if (parts.length === 0) {
    return retention.totals?.protectedNow > 0
      ? `Retention: ${retention.totals.protectedNow} intact`
      : 'Retention: 0 active'
  }
  return `Retention: ${parts.join(' · ')}`
}

function retentionChipColor(retention) {
  if (!retention) return 'default'
  if (retention.totals?.likelySevered > 0) return 'error'
  if (retention.totals?.atRisk > 0)        return 'warning'
  if (retention.totals?.protectedNow > 0)  return 'success'
  return 'default'
}

export default function OpsHealthSummary({
  isAdmin = false,
  // C1 (2026-04-24) — shared health inputs from the parent. When both
  // are provided, the recovery fetch is skipped (parent owns it) and
  // the chip color comes from unifiedVerdict (same source as top
  // HealthVerdict pill). Props-less callers fall back to self-fetch.
  recovery: recoveryProp = null,
  unifiedVerdict = null,
}) {
  const theme = useTheme()
  const [recoveryLocal, setRecoveryLocal] = useState(null)
  const [retention, setRetention] = useState(null)
  const [loading, setLoading]     = useState(true)
  const recovery = recoveryProp ?? recoveryLocal
  const parentOwnsRecovery = recoveryProp != null

  const loadRecovery = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/recovery/container-status')
      if (r.ok) setRecoveryLocal(await r.json())
    } catch { /* silent — chip shows — fallback */ }
  }, [])
  const loadRetention = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/live-packs/active')
      if (r.ok) setRetention(await r.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    // When parent passes recovery via prop, skip our own fetch — parent
    // owns the single source of truth (C1). Retention is still fetched
    // locally; it's independent of health SSoT.
    const tasks = [loadRetention()]
    if (!parentOwnsRecovery) tasks.push(loadRecovery())
    Promise.all(tasks).finally(() => setLoading(false))
    const tRet = setInterval(loadRetention, RETENTION_POLL_MS)
    const tRec = parentOwnsRecovery ? null : setInterval(loadRecovery, RECOVERY_POLL_MS)
    return () => { clearInterval(tRet); if (tRec) clearInterval(tRec) }
  }, [isAdmin, loadRecovery, loadRetention, parentOwnsRecovery])

  if (!isAdmin) return null

  // Compact one-row strip. Fixed height to prevent layout shift
  // between skeleton → loaded states.
  return (
    <Box sx={{
      display: 'flex',
      gap: 1.5,
      alignItems: 'center',
      flexWrap: 'wrap',
      px: 1.5, py: 1, mb: 2,
      borderRadius: '10px',
      border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(124,138,255,0.12)' : 'rgba(0,0,0,0.06)'}`,
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(124,138,255,0.03)' : 'rgba(92,106,196,0.02)',
      minHeight: 44,
    }}>
      {loading ? (
        <>
          <Skeleton variant="rounded" width={200} height={24} />
          <Skeleton variant="rounded" width={260} height={24} />
        </>
      ) : (
        <>
          <Tooltip title="Container recovery system — mode, engine status, and unhealthy count. Click for full panel." arrow>
            <Chip
              component={RouterLink}
              to="/admin/hunt-ops#recovery"
              clickable
              size="small"
              icon={<ShieldIcon fontSize="small" />}
              deleteIcon={<ChevronIcon fontSize="small" />}
              onDelete={() => { /* renders the chevron; RouterLink handles navigation */ }}
              color={statusChipColor(recovery, unifiedVerdict)}
              label={recoverySummaryLabel(recovery)}
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>
          <Tooltip title="God pack friend-retention — protected / at-risk / likely-severed counts. Click for full panel." arrow>
            <Chip
              component={RouterLink}
              to="/admin/hunt-ops#live-retention"
              clickable
              size="small"
              icon={
                retention?.totals?.likelySevered > 0
                  ? <ErrIcon fontSize="small" />
                  : retention?.totals?.atRisk > 0
                    ? <WarnIcon fontSize="small" />
                    : <OkIcon fontSize="small" />
              }
              deleteIcon={<ChevronIcon fontSize="small" />}
              onDelete={() => { /* chevron only */ }}
              color={retentionChipColor(retention)}
              label={retentionSummaryLabel(retention)}
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>
        </>
      )}
    </Box>
  )
}
