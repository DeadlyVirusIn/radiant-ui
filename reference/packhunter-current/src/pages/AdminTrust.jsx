/**
 * Phase 26 Stage 1 — Admin Trust Dashboard.
 *
 * Read-mostly view of drift_events. Admin actions (acknowledge /
 * resolve / ignore / reconcile) work; containment toggle is exposed
 * but defaults audit_only.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Chip, Button, IconButton, Tooltip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Drawer, Divider, MenuItem, Select,
  FormControl, InputLabel, TextField, Switch, FormControlLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon, OpenInNew as OpenIcon,
  CheckCircle as ResolveIcon, VisibilityOff as IgnoreIcon,
  Done as AckIcon, BugReport as DriftIcon,
} from '@mui/icons-material';

const SEVERITY_COLOR = { critical: 'error', high: 'warning', medium: 'info', low: 'default' };
const STATUS_COLOR   = { open: 'error', contained: 'warning', resolved: 'success', ignored: 'default' };
const SYSTEM_LABEL   = {
  gp_discord:        'GP / Discord',
  gift_fill_missing: 'Fill Missing',
  specific_sharing:  'Specific Sharing',
};

async function getJson(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${r.status}`);
  }
  return r.json();
}

export default function AdminTrust() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    system: '', severity: '', status: 'open', drift_type: '', only_user_impact: false,
  });
  const [selected, setSelected] = useState(null);    // event for drawer
  const [busy, setBusy] = useState(false);
  // Phase 26 Stage 2 Part D — operator toggles
  const [hideLegacy, setHideLegacy]                 = useState(true);
  const [hideAutoResolved, setHideAutoResolved]     = useState(true);
  const [showContainedOnly, setShowContainedOnly]   = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const s = await getJson('/api/admin/drift/summary');
      setSummary(s);
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v !== '' && v !== false) params.set(k, String(v));
      }
      params.set('limit', '200');
      const e = await getJson(`/api/admin/drift/events?${params.toString()}`);
      let rows = e.events || [];
      if (hideLegacy)        rows = rows.filter(r => !r.is_legacy);
      if (hideAutoResolved)  rows = rows.filter(r => !r.auto_resolved);
      if (showContainedOnly) rows = rows.filter(r => r.auto_contained || r.containment_action);
      setEvents(rows);
      setTotal(e.total || 0);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [filters, hideLegacy]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) reload(); }, 60_000);
    return () => clearInterval(t);
  }, [reload]);
  // Reload whenever any of the new toggles change.
  useEffect(() => { reload(); }, [hideLegacy, hideAutoResolved, showContainedOnly, reload]);

  const onAction = async (id, kind, reason) => {
    setBusy(true);
    try {
      await postJson(`/api/admin/drift/events/${id}/${kind}`, reason ? { reason } : null);
      await reload();
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err?.message || `${kind} failed`);
    } finally { setBusy(false); }
  };
  const onReconcile = async () => {
    setBusy(true);
    try {
      const r = await postJson(`/api/admin/drift/reconcile/all`);
      await reload();
      console.log('[trust] reconcile summary:', r.summary);
    } catch (err) {
      setError(err?.message || 'reconcile failed');
    } finally { setBusy(false); }
  };

  const cards = useMemo(() => summary?.counts || {}, [summary]);
  const systemTrust = summary?.systemTrust || {};
  const containmentMode = summary?.containmentMode || 'audit_only';

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <DriftIcon color="action" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Trust</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          Mode: <strong>{containmentMode}</strong> {containmentMode === 'audit_only' && '(detect-only — no mutations)'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <FormControlLabel
          control={<Switch checked={hideLegacy} onChange={(e) => setHideLegacy(e.target.checked)} size="small" />}
          label={<Typography variant="caption">Hide legacy</Typography>}
        />
        <FormControlLabel
          control={<Switch checked={hideAutoResolved} onChange={(e) => setHideAutoResolved(e.target.checked)} size="small" />}
          label={<Typography variant="caption">Hide auto-resolved</Typography>}
        />
        <FormControlLabel
          control={<Switch checked={showContainedOnly} onChange={(e) => setShowContainedOnly(e.target.checked)} size="small" />}
          label={<Typography variant="caption">Containment-applied only</Typography>}
        />
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />}
                onClick={onReconcile} disabled={busy}>
          Run reconcile now
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {/* Summary cards — Stage 2 set. New post-deploy is the most
          important card; auto-contained / auto-resolved show the trust
          layer doing useful work; blocked-inconsistent surfaces things
          requiring operator review. */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <SummaryCard label="New (post-deploy)" value={cards.open_new} severity="info" />
        <SummaryCard label="Open" value={cards.open_total} severity="default" />
        <SummaryCard label="Critical" value={cards.open_critical} severity="error" />
        <SummaryCard label="High" value={cards.open_high} severity="warning" />
        <SummaryCard label="User-impact risk" value={cards.open_user_impact} severity="error" />
        <SummaryCard label="Auto-contained 24h" value={cards.auto_contained_24h} severity="success" />
        <SummaryCard label="Auto-resolved legacy 24h" value={cards.auto_resolved_legacy_24h} severity="success" />
        <SummaryCard label="BLOCKED packs" value={cards.blocked_inconsistent_open} severity="warning" />
        <SummaryCard label="Unresolved >1h" value={cards.unresolved_over_1h} severity="warning" />
        <SummaryCard label="Legacy" value={cards.open_legacy} severity="default" />
      </Stack>

      {/* System trust panel */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="overline" color="text.secondary">System Trust</Typography>
        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
          {Object.entries(systemTrust).map(([sys, st]) => (
            <Chip key={sys}
                  size="small"
                  label={`${SYSTEM_LABEL[sys] || sys}: ${st.status}${st.open ? ` (${st.open} open)` : ''}`}
                  color={
                    st.status === 'critical' ? 'error'
                    : st.status === 'warning' ? 'warning'
                    : 'success'
                  }
                  variant={st.status === 'healthy' ? 'outlined' : 'filled'}
            />
          ))}
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>System</InputLabel>
            <Select label="System" value={filters.system}
                    onChange={(e) => setFilters({ ...filters, system: e.target.value })}>
              <MenuItem value="">all</MenuItem>
              <MenuItem value="gp_discord">GP / Discord</MenuItem>
              <MenuItem value="gift_fill_missing">Fill Missing</MenuItem>
              <MenuItem value="specific_sharing">Specific Sharing</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Severity</InputLabel>
            <Select label="Severity" value={filters.severity}
                    onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
              <MenuItem value="">all</MenuItem>
              <MenuItem value="critical">critical</MenuItem>
              <MenuItem value="high">high</MenuItem>
              <MenuItem value="medium">medium</MenuItem>
              <MenuItem value="low">low</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <MenuItem value="">all</MenuItem>
              <MenuItem value="open">open</MenuItem>
              <MenuItem value="contained">contained</MenuItem>
              <MenuItem value="resolved">resolved</MenuItem>
              <MenuItem value="ignored">ignored</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Drift type</InputLabel>
            <Select label="Drift type" value={filters.drift_type}
                    onChange={(e) => setFilters({ ...filters, drift_type: e.target.value })}>
              <MenuItem value="">all</MenuItem>
              {['IDENTITY_DRIFT','AGGREGATE_DRIFT','STATE_DRIFT','TIMING_DRIFT','PAYLOAD_DRIFT','FALLBACK_DRIFT']
                .map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={filters.only_user_impact}
                            onChange={(e) => setFilters({ ...filters, only_user_impact: e.target.checked })}
                            size="small" />}
            label={<Typography variant="caption">User-impact only</Typography>}
          />
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">{events.length} of {total}</Typography>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>System</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Detector</TableCell>
                <TableCell align="right">Occur.</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>User-impact</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map(ev => (
                <TableRow key={ev.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(ev)}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {new Date(ev.last_seen_at).toLocaleString()}
                    {ev.is_legacy && <Chip size="small" label="legacy" sx={{ ml: 0.5, height: 14, fontSize: '0.55rem' }} />}
                  </TableCell>
                  <TableCell>{SYSTEM_LABEL[ev.system] || ev.system}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{ev.drift_type}</TableCell>
                  <TableCell>
                    <Chip size="small" label={ev.severity}
                          color={SEVERITY_COLOR[ev.severity] || 'default'} />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {ev.entity_type}#{ev.entity_id}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{ev.detector_name}</TableCell>
                  <TableCell align="right">{ev.occurrence_count}</TableCell>
                  <TableCell>
                    <Chip size="small" label={ev.status}
                          color={STATUS_COLOR[ev.status] || 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {/* Phase 26 Stage 2 — user_impact_risk is now a
                          string enum ('userImpact'|'noUserImpact').
                          Compare against the literal, not truthiness. */}
                      {ev.user_impact_risk === 'userImpact'
                        ? <Chip size="small" label="USER" color="error" />
                        : <Chip size="small" label="internal" variant="outlined" />}
                      {ev.user_impact_reason && (
                        <Chip size="small" label={ev.user_impact_reason}
                              variant="outlined"
                              sx={{ fontSize: '0.55rem', height: 18 }} />
                      )}
                      {ev.auto_contained && <Chip size="small" label="AUTO-CONTAINED" color="success" sx={{ fontSize: '0.55rem', height: 18 }} />}
                      {ev.auto_resolved  && <Chip size="small" label="AUTO-RESOLVED"  color="default" sx={{ fontSize: '0.55rem', height: 18 }} />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelected(ev); }}>
                      <OpenIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="caption" color="text.secondary">
                      No drift events match these filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Detail drawer */}
      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)}
              PaperProps={{ sx: { width: 520, p: 2 } }}>
        {selected && (
          <Box>
            <Typography variant="h6">Drift event #{selected.id}</Typography>
            <Typography variant="caption" color="text.secondary">
              {selected.detector_name} · {selected.system}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip size="small" label={selected.severity}
                    color={SEVERITY_COLOR[selected.severity] || 'default'} />
              <Chip size="small" label={selected.drift_type} />
              <Chip size="small" label={selected.status}
                    color={STATUS_COLOR[selected.status] || 'default'} variant="outlined" />
              {selected.user_impact_risk === 'userImpact' && <Chip size="small" label="USER IMPACT" color="error" />}
              {selected.is_legacy && <Chip size="small" label="legacy" variant="outlined" />}
            </Stack>

            <Typography variant="overline" color="text.secondary">Entity</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1.5 }}>
              {selected.entity_type}#{selected.entity_id}
            </Typography>

            <Typography variant="overline" color="text.secondary">Timing</Typography>
            <Typography variant="caption" sx={{ display: 'block' }}>
              First seen: {new Date(selected.first_seen_at).toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mb: 1.5 }}>
              Last seen: {new Date(selected.last_seen_at).toLocaleString()} ({selected.occurrence_count} times)
            </Typography>

            {selected.containment_action && (
              <>
                <Typography variant="overline" color="text.secondary">Containment</Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 1.5 }}>
                  {selected.containment_action}: {selected.containment_result || '—'}
                </Typography>
              </>
            )}

            {/* Stage 2 Part D — eligibility hints */}
            <Typography variant="overline" color="text.secondary">Eligibility</Typography>
            <Stack spacing={0.25} sx={{ mb: 1.5 }}>
              <Typography variant="caption">
                <strong>Containment:</strong>{' '}
                {selected.containment_action
                  ? '✓ applied'
                  : (containmentMode === 'audit_only'
                     ? '— audit_only mode (no mutations)'
                     : `— detector "${selected.detector_name}" not in active allowlist`)}
              </Typography>
              <Typography variant="caption">
                <strong>Auto-resolve:</strong>{' '}
                {selected.auto_resolved
                  ? `✓ resolved (${selected.evidence_json?.auto_resolved_reason || 'allowlisted legacy'})`
                  : !selected.is_legacy ? '— not legacy'
                  : selected.severity === 'critical' ? '— critical events never auto-resolve'
                  : ['IDENTITY_DRIFT','PAYLOAD_DRIFT'].includes(selected.drift_type) ? '— IDENTITY/PAYLOAD never auto-resolve'
                  : selected.user_impact_risk === 'userImpact' ? '— user-impact-risk never auto-resolve'
                  : selected.occurrence_count > 1 ? '— recurring (occurrence > 1)'
                  : '— pending check'}
              </Typography>
            </Stack>

            <Typography variant="overline" color="text.secondary">Evidence</Typography>
            <Paper variant="outlined" sx={{ p: 1, mb: 2, maxHeight: 280, overflow: 'auto' }}>
              <pre style={{ margin: 0, fontSize: '0.7rem' }}>
                {JSON.stringify(selected.evidence_json || {}, null, 2)}
              </pre>
            </Paper>

            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<AckIcon />}
                      disabled={busy || selected.status !== 'open'}
                      onClick={() => onAction(selected.id, 'acknowledge')}>
                Acknowledge
              </Button>
              <Button size="small" variant="outlined" color="success" startIcon={<ResolveIcon />}
                      disabled={busy || selected.status === 'resolved'}
                      onClick={() => onAction(selected.id, 'resolve')}>
                Resolve
              </Button>
              <IgnoreActionButton busy={busy} onIgnore={(reason) => onAction(selected.id, 'ignore', reason)} />
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

function SummaryCard({ label, value, severity }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 130 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5"
                  color={severity === 'error' ? 'error.main'
                       : severity === 'warning' ? 'warning.main'
                       : severity === 'success' ? 'success.main'
                       : 'text.primary'}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {Number(value || 0).toLocaleString()}
      </Typography>
    </Paper>
  );
}

function IgnoreActionButton({ busy, onIgnore }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) {
    return (
      <Button size="small" variant="outlined" color="warning" startIcon={<IgnoreIcon />}
              disabled={busy} onClick={() => setOpen(true)}>
        Ignore
      </Button>
    );
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField size="small" placeholder="reason (required)" value={reason}
                 onChange={(e) => setReason(e.target.value)} sx={{ width: 200 }} />
      <Button size="small" disabled={!reason.trim() || busy}
              onClick={() => { onIgnore(reason.trim()); setOpen(false); setReason(''); }}>OK</Button>
      <Button size="small" onClick={() => { setOpen(false); setReason(''); }}>cancel</Button>
    </Stack>
  );
}
