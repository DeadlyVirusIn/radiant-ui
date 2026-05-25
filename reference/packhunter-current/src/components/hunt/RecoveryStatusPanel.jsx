/**
 * Recovery Status Panel — admin-only, mounted on Hunt Monitor.
 *
 * Reads /api/admin/recovery/container-status every 30s and renders
 * four things:
 *   1. Engine status (mode / audit-only / last tick)
 *   2. Per-container health table (state, reason, last productive,
 *      ABORTED-storm flag, retry eligibility)
 *   3. Active incident summary (attempts, last skip reason)
 *   4. Recent audit trail (last 10 container_recovery events)
 *
 * Design contract: operator should be able to answer "why is C4
 * still dead" from this panel alone, without shell access.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Stack,
  Alert, AlertTitle, Tooltip, LinearProgress, useTheme,
} from '@mui/material'
import {
  CheckCircle as OkIcon,
  WarningAmber as WarnIcon,
  ErrorOutline as ErrIcon,
  AutorenewOutlined as RetryIcon,
  PauseCircleOutlined as IdleIcon,
  Shield as AuditIcon,
} from '@mui/icons-material'
import { fetchWithAuth } from '../../services/api'
import { formatRecoveryLabels } from './huntConstants'
import { computeAutoRestartState, AUTO_RESTART_TOOLTIP } from '../../utils/autoRestartState'

const STATE_COLOR = {
  RUNNING_HEALTHY:         'success',
  RUNNING_DEGRADED:        'warning',
  WORKERS_ZERO_PRODUCTIVE: 'error',
  WORKERS_ZERO_UNEXPECTED: 'error',
  BOOTSTRAP_FAILED:        'error',
  FAILED_START:            'error',
  STALE_RUNTIME:           'warning',
  IDLE:                    'default',
  STOPPED:                 'default',
}
const STATE_ICON = {
  RUNNING_HEALTHY:         OkIcon,
  RUNNING_DEGRADED:        WarnIcon,
  WORKERS_ZERO_PRODUCTIVE: ErrIcon,
  WORKERS_ZERO_UNEXPECTED: ErrIcon,
  BOOTSTRAP_FAILED:        ErrIcon,
  FAILED_START:            ErrIcon,
  STALE_RUNTIME:           WarnIcon,
  IDLE:                    IdleIcon,
  STOPPED:                 IdleIcon,
}

function timeAgo(ms) {
  if (!ms) return '—'
  const delta = Date.now() - ms
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`
  return `${Math.round(delta / 86_400_000)}d ago`
}
function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round(ms / 3_600_000)}h`
}

export default function RecoveryStatusPanel() {
  const theme = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/recovery/container-status')
      if (!r.ok) {
        if (r.status === 403) { setError('Admin-only panel'); return }
        throw new Error(`HTTP ${r.status}`)
      }
      const body = await r.json()
      setData(body)
      setError(null)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return <LinearProgress sx={{ my: 2 }} />
  if (error)   return <Alert severity="warning" sx={{ my: 2 }}>Recovery panel: {error}</Alert>
  if (!data)   return null

  const { engine, containers = [], recentAudit = [], stormSnapshot } = data
  const activeStormsCount = Object.keys(stormSnapshot?.activeStorms || {}).length

  // Apr 2026 — canonical mode + label from backend resolver.
  // C5 (2026-04-24) — ALSO compute the new two-field wording via the
  // shared formatRecoveryLabels() helper so the detail-panel chip, the
  // summary banner, and OpsHealthSummary's compact strip never drift.
  const canonicalModeLabel = data.recoveryModeLabel || 'Unknown mode'
  const currentUnhealthyCount = data.currentUnhealthyCount ?? 0
  const recoveryLabels = formatRecoveryLabels(data)
  // 2026-04-24 — canonical auto-restart state (env OR mode). Prior
  // banner read engine.autoRetryFlag (env-only) and contradicted
  // Fleet Health whenever recovery mode overrode env=OFF. Now every
  // consumer on this page flows through computeAutoRestartState.
  const autoRestart = computeAutoRestartState(data)

  // Headline warning — only fire when there are CURRENT unhealthy
  // containers AND the container-action authority (autoRetryFlag) is
  // off. Note: this is about whether docker-restart will execute,
  // distinct from the canonical recovery mode label above.
  const unhealthy = containers.filter(c =>
    c.health.state !== 'RUNNING_HEALTHY' &&
    c.health.state !== 'IDLE' &&
    c.health.state !== 'STOPPED'
  )
  const banner = (() => {
    // 2026-04-24 — banner now fires ONLY when the effective
    // authority is actually off (env=0 AND mode doesn't authorize).
    // Previous logic checked env only → shouted "auto-restart is OFF"
    // even while Fleet Health correctly showed "ENABLED" via mode
    // override. That was the UI contradiction operators flagged.
    if (!autoRestart.effective && currentUnhealthyCount > 0) {
      return (
        <Alert severity="warning" icon={<AuditIcon />} sx={{ mb: 2 }}>
          <AlertTitle>Container auto-restart is OFF</AlertTitle>
          <strong>{currentUnhealthyCount} container{currentUnhealthyCount > 1 ? 's' : ''} unhealthy</strong> — recovery mode is{' '}
          <strong>{canonicalModeLabel}</strong> and does not authorize automatic restarts. Set recovery mode to Live (safe)
          OR set <code>CONTAINER_AUTO_RETRY=1</code> on the webui container.
        </Alert>
      )
    }
    // Explicit-override surface — env=0 but mode authorizes. Keeps
    // the conflict visible (never hidden) without scaring operators
    // with an "OFF" banner when restarts are actually running.
    if (autoRestart.isOverride && currentUnhealthyCount > 0) {
      return (
        <Alert severity="info" icon={<AuditIcon />} sx={{ mb: 2 }}>
          <AlertTitle>Container auto-restart: ENABLED (Recovery Mode Override)</AlertTitle>
          Env flag <code>CONTAINER_AUTO_RETRY</code> is OFF but recovery mode <strong>{canonicalModeLabel}</strong>
          {' '}authorizes restart actions. Restarts WILL run for the <strong>{currentUnhealthyCount}</strong>{' '}
          unhealthy container{currentUnhealthyCount > 1 ? 's' : ''}.
        </Alert>
      )
    }
    if (!engine.active) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Recovery engine inactive</AlertTitle>
          Recovery mode is OFF. No tick is running. Set mode via <code>/admin/recovery/mode</code>.
        </Alert>
      )
    }
    if (activeStormsCount > 0) {
      return (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>{activeStormsCount} active ABORTED storm{activeStormsCount > 1 ? 's' : ''}</AlertTitle>
          Workers are hitting sustained Friend/* ABORTED responses. Session reset + retry should handle it — if
          storms persist, check Decodo subscription health.
        </Alert>
      )
    }
    return null
  })()

  return (
    <Card sx={{ my: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <AuditIcon fontSize="small" color="primary" />
          <Typography variant="h6" fontWeight={700}>Recovery System Status</Typography>
          {/* Apr 2026 — primary chip is the canonical recovery mode
              label from the backend resolver. The second chip surfaces
              the container-action authority (CONTAINER_AUTO_RETRY)
              independently so operators can see both signals without
              the mode label being misleadingly overridden. */}
          {/* C5 (2026-04-24) — paired Mode + Impact chips using shared
              huntConstants.formatRecoveryLabels(). Replaces the single
              "Mode: Live (safe)" chip with explicit two-field output
              so operators see the behavior implication at a glance. */}
          <Chip
            size="small"
            label={`Recovery Mode: ${recoveryLabels.modeLabel}`}
            color={data.recoveryMode === 'live_safe' ? 'success' : data.recoveryMode === 'assist' ? 'info' : 'warning'}
            sx={{ ml: 'auto' }}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`Impact: ${recoveryLabels.impactLabel}`}
            color={recoveryLabels.tier === 'ok' ? 'success'
                 : recoveryLabels.tier === 'info' ? 'info'
                 : recoveryLabels.tier === 'warn' ? 'warning' : 'error'}
          />
          {/* 2026-04-24 — chip now reads the canonical computed
              state. Three explicit cases (ENABLED / ENABLED (Override)
              / OFF) via computeAutoRestartState. Tooltip explains
              env-vs-mode interaction so operators can see WHY the
              chip shows what it does. */}
          <Tooltip title={AUTO_RESTART_TOOLTIP} arrow>
            <Chip
              size="small"
              label={
                autoRestart.state === 'override'
                  ? 'Auto-restart: ENABLED (override)'
                  : autoRestart.state === 'enabled'
                    ? 'Auto-restart: ENABLED'
                    : autoRestart.state === 'off'
                      ? 'Auto-restart: OFF'
                      : 'Auto-restart: UNKNOWN'
              }
              color={autoRestart.effective ? (autoRestart.isOverride ? 'info' : 'success') : 'warning'}
              variant="outlined"
            />
          </Tooltip>
          {engine.tick?.lastTickAt && (
            <Chip
              size="small"
              label={`Last tick: ${timeAgo(Date.parse(engine.tick.lastTickAt) || engine.tick.lastTickAt)}`}
              variant="outlined"
            />
          )}
        </Box>

        {banner}

        {/* Per-container health table */}
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Container</TableCell>
                <TableCell>Docker</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Last productive</TableCell>
                <TableCell>Beat phase</TableCell>
                <TableCell>Storm</TableCell>
                <TableCell>Retry eligible?</TableCell>
                <TableCell>Incident</TableCell>
                {/* 2026-04-24 — canonical "next action" column. Data
                    comes straight from backend nextRecoveryAction —
                    no React-side policy logic. */}
                <TableCell>Next action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {containers.map((c) => {
                const color = STATE_COLOR[c.health.state] || 'default'
                const Icon = STATE_ICON[c.health.state] || WarnIcon
                const productiveAt = c.beat?.lastProductiveAt
                return (
                  <TableRow key={c.group}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{c.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.container}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={c.dockerStatus} variant="outlined"
                            color={c.dockerStatus === 'running' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" icon={<Icon fontSize="small" />} label={c.health.state} color={color} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{c.health.reason}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{timeAgo(productiveAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {c.beat?.phase || '—'}
                        {c.beat?.lastBeatAgeMs != null && (
                          <> ({fmtMs(c.beat.lastBeatAgeMs)} ago)</>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {c.abortedStormActive
                        ? <Chip size="small" color="error" label="ACTIVE" />
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell>
                      {c.health.autoRetryEligible
                        ? <Chip size="small" color="info" icon={<RetryIcon />} label="Yes" />
                        : <Typography variant="caption" color="text.secondary">No</Typography>}
                    </TableCell>
                    <TableCell>
                      {c.incident
                        ? <Tooltip title={`Started ${timeAgo(c.incident.incidentStartedAt)}`}>
                            <Chip size="small" color={c.incident.escalatedAt ? 'error' : 'warning'}
                                  label={`attempts ${c.incident.attempts}`} />
                          </Tooltip>
                        : <Typography variant="caption" color="text.secondary">none</Typography>}
                    </TableCell>
                    {/* 2026-04-24 — canonical next-action chip. Uses
                        ONLY the backend-computed field (no policy
                        logic here). Tooltip shows reason + actionType
                        + auto-restart context. */}
                    <TableCell>
                      {c.nextRecoveryAction ? (
                        <Tooltip
                          arrow
                          title={
                            <Box>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                {c.nextRecoveryAction.subtext || c.nextRecoveryAction.reason}
                              </Typography>
                              {/* Phase 3 — advanced signal breakdown */}
                              {c.nextRecoveryAction.signals && (
                                <>
                                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                                    confidence: {c.nextRecoveryAction.confidence || '—'} · escalation: {c.nextRecoveryAction.escalation || '—'} · restart: {c.nextRecoveryAction.restartLikelihood || '—'}
                                    {c.nextRecoveryAction.predictedEtaSeconds != null && ` (eta ~${c.nextRecoveryAction.predictedEtaSeconds}s)`}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                                    retries: {c.nextRecoveryAction.signals.retryCount} · degraded: {c.nextRecoveryAction.signals.timeDegradedSec}s
                                  </Typography>
                                </>
                              )}
                              <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, mt: 0.5 }}>
                                action: {c.nextRecoveryAction.actionType} ·{' '}
                                {autoRestart.isOverride
                                  ? 'Auto-restart: enabled via recovery mode override'
                                  : autoRestart.envEnabled
                                    ? 'Auto-restart: enabled by env'
                                    : 'Auto-restart: disabled'}
                              </Typography>
                            </Box>
                          }
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'flex-start' }}>
                            <Chip
                              size="small"
                              label={c.nextRecoveryAction.label}
                              color={
                                c.nextRecoveryAction.severity === 'success' ? 'success'
                                : c.nextRecoveryAction.severity === 'info' ? 'info'
                                : c.nextRecoveryAction.severity === 'warning' ? 'warning'
                                : c.nextRecoveryAction.severity === 'error' ? 'error'
                                : 'default'
                              }
                              variant="outlined"
                            />
                            {/* Phase 3 — inline predictive caption.
                                Shown for every container row so the
                                operator sees confidence + what-if in
                                the same glance as the status label. */}
                            {c.nextRecoveryAction.confidence && (
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
                                (confidence: {c.nextRecoveryAction.confidence})
                              </Typography>
                            )}
                            {c.nextRecoveryAction.restartLikelihood
                              && c.nextRecoveryAction.restartLikelihood !== 'none' && (
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
                                {c.nextRecoveryAction.restartLikelihood === 'imminent'
                                  ? (c.nextRecoveryAction.predictedEtaSeconds != null
                                      ? `Restart imminent (~${c.nextRecoveryAction.predictedEtaSeconds}s)`
                                      : 'Restart imminent')
                                  : c.nextRecoveryAction.restartLikelihood === 'likely'
                                    ? (c.nextRecoveryAction.predictedEtaSeconds != null
                                        ? `Restart likely if no progress in ~${c.nextRecoveryAction.predictedEtaSeconds}s`
                                        : 'Restart likely')
                                    : 'Restart possible if degradation persists'}
                              </Typography>
                            )}
                          </Box>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Recent audit trail */}
        {recentAudit.length > 0 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Recent recovery decisions
            </Typography>
            <Stack spacing={0.5}>
              {recentAudit.slice(0, 10).map((row) => (
                <Box key={row.id} sx={{
                  display: 'flex', gap: 1, alignItems: 'center',
                  fontFamily: 'monospace', fontSize: '0.7rem',
                  color: row.outcome === 'recovered' ? 'success.main'
                       : row.outcome === 'triggered' ? 'info.main'
                       : row.outcome === 'skipped' ? 'text.secondary'
                       : row.outcome === 'escalated' ? 'warning.main'
                       : 'text.primary',
                }}>
                  <Typography variant="caption" sx={{ opacity: 0.6, minWidth: 100 }}>
                    {new Date(row.at).toLocaleTimeString()}
                  </Typography>
                  <Typography variant="caption" sx={{ minWidth: 40 }}>
                    C{row.containerGroup}
                  </Typography>
                  <Typography variant="caption" sx={{ minWidth: 180 }}>
                    {row.event}
                  </Typography>
                  <Typography variant="caption" sx={{ flex: 1 }}>
                    {row.reason || row.outcome}
                    {row.payload?.state && ` — ${row.payload.state}`}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
