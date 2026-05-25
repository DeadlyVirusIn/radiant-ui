/**
 * Trade Host Health Panel — admin-only.
 *
 * Mounted on Hunt Ops. Shows every trade host with current state,
 * recent counters, failure breakdown, and manual override actions.
 *
 * Reads /api/admin/trade-host-health/list every 60s.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Alert, AlertTitle, LinearProgress, Tooltip, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, useTheme,
} from '@mui/material'
import {
  HealthAndSafety as HealthIcon,
  CheckCircleOutline as OkIcon,
  WarningAmber as WarnIcon,
  ErrorOutline as ErrIcon,
  Block as BlockIcon,
  School as TutorialIcon,
  RestartAlt as ResetIcon,
  PlayCircleOutline as UnsuppressIcon,
  PauseCircleOutline as SuppressIcon,
} from '@mui/icons-material'
import { fetchWithAuth } from '../../services/api'

const STATE_META = {
  healthy:           { color: 'success', label: 'HEALTHY',           Icon: OkIcon },
  watch:             { color: 'info',    label: 'WATCH',             Icon: WarnIcon },
  degraded:          { color: 'warning', label: 'DEGRADED',          Icon: WarnIcon },
  suppressed:        { color: 'error',   label: 'SUPPRESSED',        Icon: ErrIcon },
  manually_blocked:  { color: 'error',   label: 'MANUALLY BLOCKED',  Icon: BlockIcon },
  tutorial_blocked:  { color: 'error',   label: 'TUTORIAL BLOCKED',  Icon: TutorialIcon },
}

function fmtRelative(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return `in ${Math.abs(Math.round(ms / 60000))}m`
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`
  return `${Math.round(ms / 86_400_000)}d ago`
}
function fmtUntil(iso) {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m left`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h left`
  return `${Math.round(ms / 86_400_000)}d left`
}

export default function TradeHostHealthPanel() {
  const theme = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionDialog, setActionDialog] = useState(null) // { type, accountId } | null
  const [actionReason, setActionReason] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/trade-host-health/list')
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

  const performAction = async (type, accountId, body = {}) => {
    try {
      const r = await fetchWithAuth(`/admin/trade-host-health/${accountId}/${type}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      await load()
    } catch (e) {
      setError(`Action failed: ${e.message}`)
    }
  }

  const closeDialog = () => { setActionDialog(null); setActionReason('') }

  if (loading) return <LinearProgress sx={{ my: 2 }} />
  if (error)   return <Alert severity="warning" sx={{ my: 2 }}>Trade Host Health: {error}</Alert>
  if (!data)   return null

  const { totals, hosts = [] } = data
  const hasUnhealthy = (totals.degraded + totals.suppressed + totals.tutorialBlocked + totals.manuallyBlocked) > 0

  return (
    <Card sx={{ my: 2 }} id="trade-host-health">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <HealthIcon fontSize="small" color="primary" />
          <Typography variant="h6" fontWeight={700}>Trade Host Health</Typography>
          <Chip size="small" variant="outlined" label={`${totals.total} hosts tracked`} />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" color={totals.healthy > 0 ? 'success' : 'default'} variant="outlined" label={`${totals.healthy} healthy`} />
            {totals.watch > 0 && <Chip size="small" color="info" variant="outlined" label={`${totals.watch} watch`} />}
            {totals.degraded > 0 && <Chip size="small" color="warning" label={`${totals.degraded} degraded`} />}
            {totals.suppressed > 0 && <Chip size="small" color="error" label={`${totals.suppressed} suppressed`} />}
            {totals.tutorialBlocked > 0 && <Chip size="small" color="error" icon={<TutorialIcon fontSize="small" />} label={`${totals.tutorialBlocked} tutorial-blocked`} />}
            {totals.manuallyBlocked > 0 && <Chip size="small" color="error" icon={<BlockIcon fontSize="small" />} label={`${totals.manuallyBlocked} manually blocked`} />}
          </Box>
        </Box>

        {totals.tutorialBlocked > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>{totals.tutorialBlocked} host{totals.tutorialBlocked > 1 ? 's' : ''} need tutorial completion</AlertTitle>
            These hosts caused tutorial-not-completed failures and have been removed from the matching pool.
            Complete the trade tutorial in-game on the affected accounts, then click "Clear Tutorial Block".
          </Alert>
        )}

        {!hasUnhealthy && hosts.length === 0 && (
          <Alert severity="success" icon={<OkIcon />}>
            No trade host failures recorded yet. Counters populate after each trade outcome.
          </Alert>
        )}

        {hosts.length > 0 && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Suppressed until</TableCell>
                  <TableCell>Recent (att/succ/fail/host-att)</TableCell>
                  <TableCell>Consec.</TableCell>
                  <TableCell>Top failure reasons</TableCell>
                  <TableCell>Last success</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hosts.map(h => {
                  const meta = STATE_META[h.state] || STATE_META.healthy
                  const StateIcon = meta.Icon
                  const breakdown = Object.entries(h.failureBreakdown || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(' · ')
                  return (
                    <TableRow key={h.matchedAccountId}>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                          {h.matchedAccountId.substring(0, 16)}…
                        </Typography>
                        {h.playerId && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                            {h.playerId.substring(0, 12)}…
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={h.suppressionReason || ''} arrow>
                          <Chip size="small" color={meta.color} icon={<StateIcon fontSize="small" />} label={meta.label} />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{fmtUntil(h.suppressedUntil)}</Typography>
                        {h.suppressionReason && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                            {h.suppressionReason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {h.recentAttempts}/{h.recentSuccesses}/{h.recentFailures}/{h.recentHostAttributedFailures}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={600}
                          color={h.consecutiveHostAttributedFailures >= 3 ? 'error' : h.consecutiveHostAttributedFailures >= 2 ? 'warning.main' : 'text.primary'}>
                          {h.consecutiveHostAttributedFailures}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                          {breakdown || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{fmtRelative(h.lastSuccessAt)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {h.tutorialBlocked && (
                            <Tooltip title="Clear tutorial block (after completing tutorial in-game)" arrow>
                              <IconButton size="small" color="primary"
                                onClick={() => performAction('clear-tutorial', h.matchedAccountId)}>
                                <TutorialIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {(h.state === 'suppressed' || h.state === 'manually_blocked') ? (
                            <Tooltip title="Manual unsuppress" arrow>
                              <IconButton size="small" color="success"
                                onClick={() => performAction('unsuppress', h.matchedAccountId)}>
                                <UnsuppressIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Manual suppress (2h)" arrow>
                              <IconButton size="small"
                                onClick={() => setActionDialog({ type: 'suppress', accountId: h.matchedAccountId })}>
                                <SuppressIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Manual block (permanent until cleared)" arrow>
                            <IconButton size="small" color="error"
                              onClick={() => setActionDialog({ type: 'block', accountId: h.matchedAccountId })}>
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reset rolling counters" arrow>
                            <IconButton size="small"
                              onClick={() => performAction('reset-counters', h.matchedAccountId)}>
                              <ResetIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      <Dialog open={!!actionDialog} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog?.type === 'suppress' ? 'Manual suppress (2 hours)' : 'Manual block'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Account: {actionDialog?.accountId}
          </Typography>
          <TextField autoFocus fullWidth label="Reason (recorded in audit log)"
            value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" color={actionDialog?.type === 'block' ? 'error' : 'warning'}
            onClick={() => {
              const body = actionDialog.type === 'suppress'
                ? { durationMs: 2 * 60 * 60 * 1000, reason: actionReason || 'manual_suppress' }
                : { reason: actionReason || 'manual_block' }
              performAction(actionDialog.type, actionDialog.accountId, body)
              closeDialog()
            }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
