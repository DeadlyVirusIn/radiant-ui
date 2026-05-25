/**
 * Phase 25B — Action Review Panel.
 *
 * Renders the operator-approval queue for medium-risk recovery actions.
 * Embedded in Fleet Health (AdminFleetHealth.jsx). Admin can approve,
 * reject, or force-expire pending proposals. Each card shows:
 *   - human-friendly title
 *   - risk + subsystem chips
 *   - confidence meter
 *   - reason + expected impact
 *   - before/after summary
 *   - approve / reject buttons
 *
 * Recently-handled actions (executed/rejected/failed) show as a
 * collapsible history so the panel doesn't accumulate clutter.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Button, IconButton, Tooltip,
  Alert, CircularProgress, Collapse, Stack, Divider,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Refresh as RefreshIcon,
  Schedule as PendingIcon,
  Gavel as ReviewIcon,
} from '@mui/icons-material';
import { actionReview } from '../../services/api';
import { RISK_LABEL, RISK_COLOR, ACTION_LABEL } from '../../utils/recoveryStatus';

const STATUS_CHIP = {
  pending:  { color: 'warning',  label: 'Pending review' },
  approved: { color: 'info',     label: 'Approved' },
  executed: { color: 'success',  label: 'Executed' },
  rejected: { color: 'default',  label: 'Rejected' },
  failed:   { color: 'error',    label: 'Failed' },
  expired:  { color: 'default',  label: 'Expired' },
};

export default function ActionReviewPanel() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});           // { [id]: true }
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        actionReview.list({ status: 'pending', limit: 20 }),
        actionReview.list({ status: 'executed', limit: 10 }),
      ]);
      setPending(pendingRes?.actions || []);
      // Merge executed + rejected + failed for the history section.
      const rejRes = await actionReview.list({ status: 'rejected', limit: 5 }).catch(() => ({ actions: [] }));
      const failRes = await actionReview.list({ status: 'failed', limit: 5 }).catch(() => ({ actions: [] }));
      setHistory([
        ...(historyRes?.actions || []),
        ...(rejRes?.actions || []),
        ...(failRes?.actions || []),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 15));
    } catch (err) {
      setError(err?.message || 'Failed to load action reviews');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const onApprove = async (id) => {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      const res = await actionReview.approve(id);
      if (res.status === 'expired') {
        setError(`Action #${id} expired: ${res.reason}`);
      }
      await load();
    } catch (err) { setError(err?.message || 'Approve failed'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  const onReject = async (id) => {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await actionReview.reject(id, 'Manually rejected by admin');
      await load();
    } catch (err) { setError(err?.message || 'Reject failed'); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  if (loading && pending.length === 0 && history.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReviewIcon fontSize="small" color="action" />
        <Typography variant="subtitle2">Action Review</Typography>
        <CircularProgress size={16} sx={{ ml: 1 }} />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: pending.length > 0 ? 1 : 0 }}>
        <ReviewIcon fontSize="small" color="action" />
        <Typography variant="subtitle2">Action Review</Typography>
        <Chip size="small" label={`${pending.length} pending`}
              color={pending.length > 0 ? 'warning' : 'default'}
              variant={pending.length > 0 ? 'filled' : 'outlined'}
              sx={{ height: 20, fontSize: '0.65rem' }} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1, py: 0.25 }} onClose={() => setError(null)}>
          <Typography variant="caption">{error}</Typography>
        </Alert>
      )}

      {/* ── Pending actions ────────────────────────────────────── */}
      {pending.length === 0 && !loading && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          No actions pending review. Medium-risk proposals from Assist mode will appear here.
        </Typography>
      )}

      <Stack spacing={1}>
        {pending.map(action => (
          <ActionCard key={action.id} action={action}
                      busy={!!busy[action.id]}
                      onApprove={() => onApprove(action.id)}
                      onReject={() => onReject(action.id)} />
        ))}
      </Stack>

      {/* ── History (collapsed) ────────────────────────────────── */}
      {history.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
               onClick={() => setHistoryOpen(v => !v)}>
            <Typography variant="overline" color="text.secondary">
              Recent history ({history.length})
            </Typography>
            <IconButton size="small">
              {historyOpen ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={historyOpen} unmountOnExit>
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              {history.map(a => (
                <HistoryRow key={a.id} action={a} />
              ))}
            </Stack>
          </Collapse>
        </>
      )}
    </Paper>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function ActionCard({ action, busy, onApprove, onReject }) {
  const risk = action.risk_level || 'medium';
  const statusChip = STATUS_CHIP[action.status] || STATUS_CHIP.pending;
  const title = action.title || ACTION_LABEL[action.action_type] || action.action_type;
  const ago = action.created_at ? timeAgo(action.created_at) : '';
  const beforeJson = typeof action.before_state === 'string'
    ? tryParse(action.before_state)
    : (action.before_state_json || action.before_state);
  const afterJson = typeof action.proposed_after_state === 'string'
    ? tryParse(action.proposed_after_state)
    : (action.proposed_after_state_json || action.proposed_after_state);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5, borderRadius: 1,
        border: '1px solid',
        borderColor: risk === 'high' ? 'error.main' : 'divider',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
        <PendingIcon fontSize="small" color="warning" sx={{ mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {action.subsystem} · {action.entity_type}:{action.entity_id} · {ago}
          </Typography>
          {action.reason && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              <strong>Why:</strong> {action.reason}
            </Typography>
          )}
          {action.expected_impact && (
            <Typography variant="caption" sx={{ display: 'block' }}>
              <strong>Impact:</strong> {action.expected_impact}
            </Typography>
          )}
          {(beforeJson || afterJson) && (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {beforeJson && (
                <Typography variant="caption" component="pre"
                            sx={{ m: 0, p: 0.5, bgcolor: 'action.hover', borderRadius: 0.5, fontSize: '0.6rem', maxWidth: 300, overflow: 'auto' }}>
                  <strong>Before:</strong> {JSON.stringify(beforeJson, null, 1)}
                </Typography>
              )}
              {afterJson && (
                <Typography variant="caption" component="pre"
                            sx={{ m: 0, p: 0.5, bgcolor: 'action.hover', borderRadius: 0.5, fontSize: '0.6rem', maxWidth: 300, overflow: 'auto' }}>
                  <strong>Proposed:</strong> {JSON.stringify(afterJson, null, 1)}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Right side: chips + buttons */}
        <Stack spacing={0.5} alignItems="flex-end">
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Chip size="small" label={RISK_LABEL[risk] || risk}
                  color={RISK_COLOR[risk] || 'default'} variant="outlined"
                  sx={{ height: 18, fontSize: '0.6rem' }} />
            <Chip size="small" label={statusChip.label}
                  color={statusChip.color} variant="filled"
                  sx={{ height: 18, fontSize: '0.6rem' }} />
            {action.confidence != null && (
              <Chip size="small" label={`${Math.round(action.confidence * 100)}%`}
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.6rem' }} />
            )}
          </Box>
          {action.status === 'pending' && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Approve and execute this action">
                <span>
                  <Button size="small" variant="contained" color="success"
                          startIcon={busy ? <CircularProgress size={12} /> : <ApproveIcon />}
                          onClick={onApprove} disabled={busy}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}>
                    Approve
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Reject — action will not be executed">
                <span>
                  <Button size="small" variant="outlined" color="error"
                          startIcon={<RejectIcon />}
                          onClick={onReject} disabled={busy}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}>
                    Reject
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}

function HistoryRow({ action }) {
  const statusChip = STATUS_CHIP[action.status] || STATUS_CHIP.expired;
  const title = action.title || ACTION_LABEL[action.action_type] || action.action_type;
  const ago = action.executed_at || action.rejected_at || action.created_at;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5 }}>
      <Chip size="small" label={statusChip.label} color={statusChip.color}
            variant="outlined" sx={{ height: 16, fontSize: '0.55rem', minWidth: 64 }} />
      <Typography variant="caption" sx={{ flex: 1 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem' }}>
        {ago ? timeAgo(ago) : ''}
      </Typography>
    </Box>
  );
}

// ─── Utilities ──────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.round(ms / 3600_000)}h ago`;
  return `${Math.round(ms / 86400_000)}d ago`;
}

function tryParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}
