/**
 * Live Pack Retention Panel — admin-only.
 *
 * Mounted on Hunt Monitor alongside the Recovery Status Panel.
 * Reads /api/admin/live-packs/active every 60s.
 *
 * Surfaces:
 *   - aggregate counts (total protected, LIVE-96h, recent-48h, at-risk)
 *   - per-pack table: status, canonical timestamp, friendProtectionUntil,
 *     time remaining, protection reason, at-risk flag
 *   - at-risk rows highlighted red — means the host account was
 *     re-hunted during the protection window (the exact symptom of
 *     the bug this panel exists to prevent)
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Alert, AlertTitle, LinearProgress, Tooltip, Stack, useTheme,
} from '@mui/material'
import {
  Shield as ShieldIcon,
  WarningAmber as WarnIcon,
  CheckCircleOutline as OkIcon,
  Whatshot as LiveIcon,
  AccessTime as ClockIcon,
} from '@mui/icons-material'
import { fetchWithAuth } from '../../services/api'

function fmtHours(h) {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}
function fmtRelative(iso) {
  if (!iso) return '—'
  const ms = Date.now() - Date.parse(iso)
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}

export default function LivePackRetentionPanel() {
  const theme = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/live-packs/active')
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
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return <LinearProgress sx={{ my: 2 }} />
  if (error)   return <Alert severity="warning" sx={{ my: 2 }}>Live pack panel: {error}</Alert>
  if (!data)   return null

  const { windows, totals, packs = [] } = data

  return (
    <Card sx={{ my: 2 }} id="live-retention">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <ShieldIcon fontSize="small" color="primary" />
          <Typography variant="h6" fontWeight={700}>Live Pack Retention</Typography>
          <Chip
            size="small" variant="outlined"
            label={`48h / 96h windows`}
            title={`Any god pack: ${windows?.recent48hHours ?? 48}h. LIVE god pack: ${windows?.live96hHours ?? 96}h.`}
          />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" icon={<ShieldIcon fontSize="small" />}
                  label={`${totals.protectedNow} protected`} color="primary" variant="outlined" />
            <Chip size="small" icon={<OkIcon fontSize="small" />}
                  label={`${totals.intact} intact`}
                  color={totals.intact > 0 ? 'success' : 'default'} variant="outlined" />
            {totals.atRisk > 0 && (
              <Chip size="small" icon={<WarnIcon fontSize="small" />}
                    label={`${totals.atRisk} at risk`} color="warning" />
            )}
            {totals.likelySevered > 0 && (
              <Chip size="small" icon={<WarnIcon fontSize="small" />}
                    label={`${totals.likelySevered} likely severed`} color="error" />
            )}
            {totals.live96h > 0 && (
              <Chip size="small" icon={<LiveIcon fontSize="small" />}
                    label={`${totals.live96h} LIVE`} color="success" variant="outlined" />
            )}
          </Box>
        </Box>

        {/* At-risk banner — fires when any pack is in-window but the
            hunt-container code running for its group hasn't been
            updated yet. Auto-dismisses once hunts are restarted. */}
        {totals.atRisk > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>{totals.atRisk} pack{totals.atRisk > 1 ? 's' : ''} at risk — hunt restart required</AlertTitle>
            The hunt-container code running for one or more container groups predates the April eligibility
            fix. Currently-intact packs will be severed the next time each host account's 24h cooldown
            elapses. Restart hunts to activate the protection. After restart the panel will auto-flip these
            to "protected-intact" on the next refresh.
          </Alert>
        )}

        {/* Likely-severed banner — non-auto-recoverable; operator
            decides whether to notify affected users in Discord. */}
        {totals.likelySevered > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>{totals.likelySevered} pack{totals.likelySevered > 1 ? 's' : ''} likely severed</AlertTitle>
            Host account was re-hunted during the protection window. Friend links on the game server are
            almost certainly already removed; DB/Discord status is now cosmetic for these packs. Cannot be
            auto-repaired. Consider notifying affected Discord users to re-add friends if still within window.
          </Alert>
        )}

        {packs.length === 0 ? (
          <Alert severity="success" icon={<OkIcon />}>
            No packs currently inside a protection window.
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pack</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Canonical start</TableCell>
                  <TableCell>Protection until</TableCell>
                  <TableCell>Remaining</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Host account</TableCell>
                  <TableCell>Last hunted</TableCell>
                  <TableCell>State</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {packs.map(p => {
                  // Phase 5.7 — Decision Language: Title Case state
                  // labels (Intact / At risk / Likely severed /
                  // Expired). Underlying p.protectionState enum is
                  // unchanged; this is display-string only.
                  const stateMeta = (() => {
                    switch (p.protectionState) {
                      case 'protected-intact':
                        return { color: 'success',  label: 'Intact',         Icon: OkIcon,   rowTint: undefined }
                      case 'protected-at-risk':
                        return { color: 'warning',  label: 'At risk',        Icon: WarnIcon, rowTint: theme.palette.mode === 'dark' ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.08)' }
                      case 'protected-but-likely-severed':
                        return { color: 'error',    label: 'Likely severed', Icon: WarnIcon, rowTint: theme.palette.mode === 'dark' ? 'rgba(255,82,82,0.12)' : 'rgba(255,82,82,0.08)' }
                      case 'expired':
                        return { color: 'default',  label: 'Expired',        Icon: ClockIcon, rowTint: undefined }
                      default:
                        return { color: 'default',  label: p.protectionState || '?', Icon: WarnIcon, rowTint: undefined }
                    }
                  })()
                  const StateIcon = stateMeta.Icon
                  return (
                    <TableRow
                      key={p.godPackId}
                      sx={{ bgcolor: stateMeta.rowTint }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>#{p.godPackId}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.packNickname || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {/* Phase 5.7 finalize — Decision Language labels:
                            ALIVE → 'Live', PICKED → 'Awaiting
                            confirmation', otherwise Title Case. ALL
                            CAPS enum echoes never reach the user. */}
                        <Chip size="small"
                              label={(() => {
                                const s = String(p.packStatus || 'pending').toUpperCase();
                                if (s === 'ALIVE')   return 'Live';
                                if (s === 'PICKED')  return 'Awaiting confirmation';
                                if (s === 'EXPIRED') return 'Expired';
                                return s ? s[0] + s.slice(1).toLowerCase() : 'Pending';
                              })()}
                              color={p.packStatus === 'ALIVE' ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={p.canonicalProtectionStart || ''}>
                          <Typography variant="caption">{fmtRelative(p.canonicalProtectionStart)}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={p.friendProtectionUntil || ''}>
                          <Typography variant="caption">{p.friendProtectionUntil ? new Date(p.friendProtectionUntil).toLocaleString() : '—'}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{fmtHours(p.hoursRemaining)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined"
                              color={p.protectionReason === 'live-96h' ? 'success' : 'default'}
                              label={p.protectionReason === 'live-96h' ? 'LIVE / 96h' : '48h'} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {p.accountId}
                        </Typography>
                        {p.containerGroup && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            C{p.containerGroup}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color={p.protectionState === 'protected-but-likely-severed' ? 'error' : 'text.secondary'}>
                          {fmtRelative(p.accountLastHuntedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={p.protectionStateReason || ''} arrow>
                          <Chip size="small"
                                color={stateMeta.color}
                                icon={<StateIcon fontSize="small" />}
                                label={stateMeta.label}
                                variant={stateMeta.color === 'success' ? 'outlined' : 'filled'}
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            48h rule: any god pack on an account blocks re-hunt for 48h.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · 96h rule: a LIVE god pack extends the block to 96h.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · Panel refreshes every 60s.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
