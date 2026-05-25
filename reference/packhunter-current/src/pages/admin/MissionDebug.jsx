/**
 * Phase 34 — Admin-only Mission Debug Panel.
 *
 * GET /admin/mission-debug
 *
 * Form inputs: userId, accountId, missionId.
 * Calls GET /api/admin/mission-integrity/debug and renders the full
 * normalized view, slot breakdown, snapshot-vs-computed comparison,
 * and per-card ownership table.
 *
 * Read-only. No mutation buttons. No data written by this component.
 */

import { useState } from 'react'
import {
  Box, Typography, TextField, Button, Paper, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Accordion, AccordionSummary,
  AccordionDetails, Alert, CircularProgress, Stack,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

const fetchDebug = async ({ userId, accountId, missionId }) => {
  const params = new URLSearchParams({ userId, accountId, missionId })
  const token = localStorage.getItem('vudoo_auth_token') || ''
  const res = await fetch(`/api/admin/mission-integrity/debug?${params}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function MissionDebug() {
  const [form, setForm] = useState({ userId: '', accountId: '', missionId: '' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.userId || !form.accountId || !form.missionId) {
      setError('All three fields are required')
      return
    }
    setLoading(true); setError(null); setData(null)
    try {
      const result = await fetchDebug(form)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Mission Debug Panel</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Read-only admin tool. Inspects how a single mission evaluates for a specific user + account,
        and compares the persisted snapshot against live computation.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <form onSubmit={handleSubmit}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField label="User ID" size="small" value={form.userId}
              onChange={e => setForm({ ...form, userId: e.target.value })} sx={{ width: 120 }} />
            <TextField label="Account ID" size="small" value={form.accountId}
              onChange={e => setForm({ ...form, accountId: e.target.value })} sx={{ width: 120 }} />
            <TextField label="Mission ID" size="small" value={form.missionId}
              onChange={e => setForm({ ...form, missionId: e.target.value })} sx={{ width: 180 }}
              placeholder="e.g. A3B_169" />
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={20} /> : 'Inspect'}
            </Button>
          </Stack>
        </form>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <Stack spacing={2}>
          {/* Snapshot vs computed — headline card */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Snapshot vs Computed
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`snapshot: ${data.snapshot.present
                ? (data.snapshot.completed ? 'complete' : 'incomplete')
                : 'no snapshot'}`}
                color={data.snapshot.present
                  ? (data.snapshot.completed ? 'success' : 'default')
                  : 'warning'} />
              <Chip label={`computed: ${data.evaluation.computedCompleted ? 'complete' : 'incomplete'}`}
                color={data.evaluation.computedCompleted ? 'success' : 'default'} />
              {data.snapshot.mismatch === true && (
                <Chip label="MISMATCH" color="error" />
              )}
              <Chip label={`${data.evaluation.ownedCount}/${data.normalized.requiredCount} collected`} />
              <Chip label={`${Math.round(data.evaluation.progressRatio * 100)}%`} variant="outlined" />
            </Stack>
            <Typography variant="body2" sx={{ mt: 1.5 }}>
              <strong>Completion reason:</strong> {data.evaluation.completionReason}
            </Typography>
            {data.snapshot.syncedAt && (
              <Typography variant="caption" color="text.secondary">
                Last synced: {new Date(data.snapshot.syncedAt).toLocaleString()}
              </Typography>
            )}
          </Paper>

          {/* Definition */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Definition — {data.mission.name}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                <Chip size="small" label={`id: ${data.mission.id}`} />
                <Chip size="small" label={`set: ${data.mission.set_code}`} />
                <Chip size="small" label={`type: ${data.normalized.type}`} color="primary" />
                <Chip size="small" label={`mode: ${data.mission.evaluation_mode}`} />
                {data.mission._requirement_pattern &&
                  <Chip size="small" label={`pattern: ${data.mission._requirement_pattern}`} />}
                {data.mission._verification_status &&
                  <Chip size="small" color="warning" label={`verification: ${data.mission._verification_status}`} />}
              </Stack>
              <pre style={{ margin: 0, fontSize: 12, overflow: 'auto' }}>
                {JSON.stringify(data.mission.groups, null, 2)}
              </pre>
            </AccordionDetails>
          </Accordion>

          {/* Requirement math */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>Requirement Math</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`requiredCount: ${data.normalized.requiredCount}`} />
                <Chip size="small" label={`ownedCount: ${data.evaluation.ownedCount}`} />
                <Chip size="small" label={`progress: ${(data.evaluation.progressRatio * 100).toFixed(1)}%`} />
                {data.normalized.quota != null &&
                  <Chip size="small" label={`quota: ${data.normalized.quota}`} />}
                <Chip size="small" label={`slots: ${data.normalized.slots.length}`} />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Slot breakdown */}
          {data.evaluation.slotBreakdown.length > 0 && (
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>Slot Breakdown</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Operator</TableCell>
                      <TableCell>Lookup</TableCell>
                      <TableCell>Cards</TableCell>
                      <TableCell>Owned</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.evaluation.slotBreakdown.map(s => (
                      <TableRow key={s.index}>
                        <TableCell>{s.index}</TableCell>
                        <TableCell>{s.operator}</TableCell>
                        <TableCell>{s.lookupName || '—'}</TableCell>
                        <TableCell>{s.cards.join(', ')}</TableCell>
                        <TableCell>{s.ownedCards.join(', ') || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small"
                            label={s.satisfied ? 'satisfied' : 'missing'}
                            color={s.satisfied ? 'success' : 'error'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          )}

          {/* Ownership breakdown */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>
                Ownership Breakdown — {data.ownershipBreakdown.filter(c => c.owned).length} / {data.ownershipBreakdown.length}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Card ID</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.ownershipBreakdown.map(c => (
                    <TableRow key={c.cardId} sx={{
                      bgcolor: c.owned ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.06)',
                    }}>
                      <TableCell>{c.cardId}</TableCell>
                      <TableCell>{c.amount}</TableCell>
                      <TableCell>
                        <Chip size="small"
                          label={c.owned ? 'owned' : 'missing'}
                          color={c.owned ? 'success' : 'error'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}
    </Box>
  )
}
