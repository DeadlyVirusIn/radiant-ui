/**
 * System Integrity Dashboard — 2026-04-20.
 *
 *   Route: /admin/integrity   (admin only)
 *   API:   GET /api/admin/integrity/overview?window=24h|7d
 *
 * Integrity-first monitoring for Gift and Trade. Every metric panel
 * reflects VERIFIED outcomes — never scheduler activity, never
 * "last-run" timestamps, never "no exception = success". Metrics
 * that cannot yet be computed from hard signals are labelled
 * explicitly as `provisional`.
 *
 * Adapted to the existing WebUI stack (MUI + recharts). The
 * attached shadcn/ui prototype informed the intent; the components
 * here are the ones already in use elsewhere in this project so the
 * page feels native (matches AdminHealth / HuntMonitor idiom).
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, CircularProgress,
  MenuItem, Select, FormControl, InputLabel, TextField, InputAdornment,
  Switch, FormControlLabel, Tabs, Tab, LinearProgress, Grid, Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Shield as ShieldIcon,
  Favorite as HeartIcon,
  AccountTree as TreeIcon,
  NotificationsActive as BellIcon,
  ReportProblem as WarnIcon,
  CheckCircle as OkIcon,
  HelpOutline as InfoIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  TrendingFlat as TrendFlatIcon,
  // 2026-04-20 Phase 4A — Context Navigation CTAs
  OpenInNew as OpenInNewIcon,
  // 2026-04-20 Phase 8B — Alert hygiene + why-detail
  VolumeOff as MuteIcon,
  AccessTime as SnoozeIcon,
  ExpandMore as ExpandMoreIcon,
  Lock as LockIcon,
  // 2026-04-20 Phase 8C — Ack / Resolve workflow
  CheckCircleOutline as AckIcon,
  TaskAlt as ResolveIcon,
} from '@mui/icons-material';
import Collapse from '@mui/material/Collapse';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip,
  BarChart, Bar, Cell,
} from 'recharts';
import { fetchWithAuth } from '../../services/api';

const WINDOWS = [
  { value: '1h',  label: 'Last 1 hour' },
  { value: '6h',  label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
];

const SEVERITY_COLOR = { high: 'error', medium: 'warning', low: 'info' };

const TRUTH_COLOR = {
  'verified-delivery':            'success',
  'settlement-verified':          'success',
  'honest-fail':                  'warning',
  'awaiting-proof':               'warning',
  'completed-suspect':            'error',
  'completed-no-delivery-evidence': 'error',
  'skip':                         'default',
  'cancelled':                    'default',
  'in_flight':                    'info',
};

const fmtAge = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60)     return `${s}s ago`;
  if (s < 3600)   return `${Math.round(s / 60)}m ago`;
  if (s < 86400)  return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

function scoreTone(score) {
  if (score == null) return { label: '—', color: 'default' };
  if (score >= 90)   return { label: 'Strong', color: 'success' };
  if (score >= 75)   return { label: 'Watch',  color: 'warning' };
  return { label: 'At risk', color: 'error' };
}

// ── 2026-04-20 Phase 4A — Context Navigation helpers ───────────────
// Produce a contextual "open in {page} →" destination for each
// execution / incident row. NEVER introduces a new route — every
// `to` returned here is a page that already exists in the app.
// Returns null when no useful destination exists (better silence
// than mislead).
const CTA_ALLOWED_ROUTES = new Set([
  '/sharing-cards',
  '/card-request',
  '/admin/trust',
  '/admin/hunt-ops',
  '/admin/observability',
  '/admin/integrity',
]);

function ctaForExecution(row) {
  if (!row || !row.system) return null;
  if (row.system === 'Gift')  return { label: 'View in Sharing',   to: '/sharing-cards' };
  if (row.system === 'Trade') return { label: 'View Trade request', to: '/card-request' };
  return null;
}

function ctaForIncident(inc) {
  if (!inc) return null;
  const owner = String(inc.owner || '').toLowerCase();
  const system = String(inc.system || '').toLowerCase();

  // Workflow-entry specific: Gift incidents lead back to the page
  // where an operator can actually pause / edit / inspect the rule
  // that owns the failing executions. Keep pointing there.
  if (owner.includes('autogiftengine'))               return { label: 'View in Sharing',          to: '/sharing-cards' };
  if (owner.includes('specificcardsharingscheduler')) return { label: 'View in Sharing',          to: '/sharing-cards' };

  // 2026-04-20 Phase 4A refinement — trade incidents are aggregate
  // diagnostic signals, not workflow-entry-specific. The Integrity
  // Dashboard itself is the definitive surface, so default every
  // trade-owned incident there. Future workflow-entry-specific
  // incidents (e.g., a particular failing trade request) can still
  // override to /card-request if needed.
  if (owner.includes('finalizeusersidetrade'))        return { label: 'Open Integrity Dashboard', to: '/admin/integrity' };
  if (owner.includes('webuitradeexecutor'))           return { label: 'Open Integrity Dashboard', to: '/admin/integrity' };
  if (owner.includes('webuitradematchservice'))       return { label: 'Open Integrity Dashboard', to: '/admin/integrity' };

  // System-based fallback.
  if (system === 'gift')  return { label: 'View in Sharing',          to: '/sharing-cards' };
  if (system === 'trade') return { label: 'Open Integrity Dashboard', to: '/admin/integrity' };

  return null;
}

// ── 2026-04-20 Phase 7B — Intelligence Signals CTA mapping ─────────
// Closed allowlist — every CTA target MUST be a route that already
// exists in the app. Same pattern as ctaForExecution / ctaForIncident.
const SIGNAL_CTA_ALLOWLIST = new Set([
  '/sharing-cards',
  '/card-request',
  '/admin/integrity',
  '/admin/fleet',
  '/admin/hunt-ops',
]);

function mapSignalToCta(signal) {
  if (!signal || !signal.id) return null;
  const id = String(signal.id);

  if (id.startsWith('gift.'))                      return { label: 'Open Sharing',          to: '/sharing-cards' };

  if (id === 'trade.truthful_terminal_rate')       return { label: 'Open Diagnostics',      to: '/admin/integrity' };
  if (id === 'trade.stuck_rate')                   return { label: 'Open Diagnostics',      to: '/admin/integrity' };
  if (id === 'trade.auto_cancel_rate')             return { label: 'Open Diagnostics',      to: '/admin/integrity' };

  if (id === 'hunt.ppm_recent_vs_baseline')        return { label: 'Open Fleet',            to: '/admin/fleet' };
  if (id === 'hunt.session_null_rate')             return { label: 'Open Ops Recovery',     to: '/admin/hunt-ops' };
  if (id === 'hunt.gift_delivery_1h_vs_24h')       return { label: 'Open Diagnostics',      to: '/admin/integrity' };

  // Domain-based fallback. Keeps the panel useful if a new signal id
  // lands before this switch is updated.
  const domain = String(signal.domain || '').toLowerCase();
  if (domain === 'gift')  return { label: 'Open Sharing',          to: '/sharing-cards' };
  if (domain === 'trade') return { label: 'Open Diagnostics',      to: '/admin/integrity' };
  if (domain === 'hunt')  return { label: 'Open Fleet',            to: '/admin/fleet' };
  return null;
}

// Severity rank for deterministic sort: crit → warn → ok → insufficient_data
const SIGNAL_SEVERITY_RANK = {
  crit: 0, warn: 1, ok: 2, insufficient_data: 3,
};

// Sort helper — crit first, then warn; within a tier, worsening trend
// (direction === 'worse') surfaces above steady / improving. Never
// mutates source.
function sortAttentionSignals(signals) {
  return [...(signals || [])].sort((a, b) => {
    const ra = SIGNAL_SEVERITY_RANK[a.severity] ?? 9;
    const rb = SIGNAL_SEVERITY_RANK[b.severity] ?? 9;
    if (ra !== rb) return ra - rb;
    // Trend worseness: depends on thresholds.direction.
    // For direction='lower' worse = trend.direction === 'down'.
    // For direction='higher' worse = trend.direction === 'up'.
    const worse = (sig) => {
      if (!sig.trend) return 0;
      if (sig.thresholds?.direction === 'lower') return sig.trend.direction === 'down' ? -1 : 0;
      return sig.trend.direction === 'up' ? -1 : 0;
    };
    return worse(a) - worse(b);
  });
}

// Severity → MUI color mapping (subtle accent, no full-red panels).
const SIGNAL_SEVERITY_COLOR = {
  crit: 'error',
  warn: 'warning',
  ok: 'success',
  insufficient_data: 'default',
};

// Render helper — convert a signal's value + unit into a human string.
function formatSignalValue(signal) {
  if (signal.value == null) return '—';
  if (signal.unit === 'percent') {
    // Ratio → %. Two decimal places for ratios under 0.10, one decimal above.
    const pct = signal.value * 100;
    return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
  }
  if (signal.unit === 'points') {
    const pp = signal.value * 100;
    const sign = pp > 0 ? '+' : '';
    return `${sign}${pp.toFixed(1)}pp`;
  }
  return String(signal.value);
}

// Threshold column formatter.
function formatThreshold(th) {
  if (!th) return '—';
  const fmt = (x) => (Math.abs(x) < 1 ? `${(x * 100).toFixed(0)}%` : String(x));
  const arrow = th.direction === 'lower' ? '<' : '>';
  return `warn ${arrow} ${fmt(th.warn)} · crit ${arrow} ${fmt(th.crit)}`;
}

// ── 2026-04-20 Phase 8B — Confidence label + alert hygiene ─────────
//
// Confidence is computed by the backend (intelligenceSignals) from
// the signal's denominator. UI only renders + colors it.
const CONFIDENCE_COLOR = { high: 'success', medium: 'info', low: 'warning' };

// Mute / snooze use sessionStorage so they reset when the tab closes.
// Crit alerts NEVER respect either — see isAlertSilenced().
const MUTE_KEY    = (signalId) => `intel.mute.${signalId}`;
const SNOOZE_KEY  = (signalId) => `intel.snooze.${signalId}`;
const SNOOZE_DEFAULT_MS = 60 * 60 * 1000; // 1h per spec

function safeSession() {
  try { return window.sessionStorage; } catch { return null; }
}

function isMuted(signalId) {
  const ss = safeSession();
  if (!ss || !signalId) return false;
  try { return ss.getItem(MUTE_KEY(signalId)) === '1'; } catch { return false; }
}
function setMuted(signalId, muted) {
  const ss = safeSession();
  if (!ss || !signalId) return;
  try {
    if (muted) ss.setItem(MUTE_KEY(signalId), '1');
    else       ss.removeItem(MUTE_KEY(signalId));
  } catch {/* silent */}
}
function isSnoozed(signalId, nowMs = Date.now()) {
  const ss = safeSession();
  if (!ss || !signalId) return false;
  try {
    const v = ss.getItem(SNOOZE_KEY(signalId));
    if (!v) return false;
    const until = Number(v);
    if (!Number.isFinite(until) || until <= nowMs) {
      ss.removeItem(SNOOZE_KEY(signalId)); // self-cleaning
      return false;
    }
    return true;
  } catch { return false; }
}
function snoozeFor(signalId, durationMs = SNOOZE_DEFAULT_MS) {
  const ss = safeSession();
  if (!ss || !signalId) return;
  try { ss.setItem(SNOOZE_KEY(signalId), String(Date.now() + durationMs)); } catch {/* silent */}
}
function clearSnooze(signalId) {
  const ss = safeSession();
  if (!ss || !signalId) return;
  try { ss.removeItem(SNOOZE_KEY(signalId)); } catch {/* silent */}
}

// Single source of truth: should this alert be visible right now?
// CRIT alerts are NEVER silenced — operator must see them. Warn
// alerts can be muted (session) or snoozed (1h, session).
function isAlertSilenced(alert) {
  if (!alert) return false;
  if (alert.severity === 'crit') return false; // crit always shown
  if (isMuted(alert.signalId))   return true;
  if (isSnoozed(alert.signalId)) return true;
  return false;
}

// ── 2026-04-20 Phase 8C — Ack / Resolve UI helpers ────────────────
const ALERT_STATUS_COLOR = { open: 'default', acked: 'info', resolved: 'success' };
const ALERT_STATUS_LABEL = { open: 'Open', acked: 'Acked', resolved: 'Resolved' };

function alertStatus(alert) {
  return alert?.state?.status || 'open';
}

// ── Reusable stat tile ─────────────────────────────────────────────
function StatCard({ title, value, subtitle, Icon, warn, tooltip }) {
  const body = (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, lineHeight: 1 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {subtitle}
          </Typography>
        </Box>
        <Box sx={{
          p: 1, borderRadius: 1.5,
          bgcolor: warn ? 'error.main' : 'action.hover',
          color:  warn ? 'error.contrastText' : 'text.primary',
          opacity: warn ? 0.9 : 0.8,
        }}>
          <Icon fontSize="small" />
        </Box>
      </Stack>
    </Paper>
  );
  return tooltip ? <Tooltip title={tooltip}>{body}</Tooltip> : body;
}

// ── Progress row (metric label + percent + bar + hint). Optional
// provisional flag attaches an info icon and tooltip. ──────────────
function MetricRow({ label, value, hint, provisional }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          {provisional && (
            <Tooltip title="Provisional metric — honest best-effort calculation until stronger instrumentation lands. See dashboard docs.">
              <InfoIcon sx={{ fontSize: 12, color: 'warning.main' }} />
            </Tooltip>
          )}
        </Stack>
        <Typography variant="caption" fontWeight={600}>{safe}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={safe}
        sx={{
          height: 6, borderRadius: 3,
          '& .MuiLinearProgress-bar': {
            bgcolor: safe >= 90 ? 'success.main' : safe >= 75 ? 'warning.main' : 'error.main',
          },
        }}
      />
      {hint && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{hint}</Typography>}
    </Box>
  );
}

// ── Health card for one system (Gift / Trade). ────────────────────
function SystemHealthCard({ title, subtitle, data, icon: Icon }) {
  const tone = scoreTone(data?.integrityScore);
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {Icon && <Icon color="primary" />}
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          </Box>
        </Stack>
        <Chip
          label={`${data?.integrityScore ?? '—'} · ${tone.label}`}
          color={tone.color}
          size="small"
          sx={{ fontWeight: 700 }}
        />
      </Stack>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <MetricRow
            label="Delivery rate"
            value={data?.deliveryRate}
            hint="Verified completions only (per-bot SUCCESS or settlement-verified)."
          />
          <MetricRow
            label="Truthful terminal states"
            value={data?.truthfulTerminalRate}
            hint="Zero false-success on COMPLETED rows."
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <MetricRow
            label="Session stability"
            value={data?.sessionStability}
            hint="assertLiveSession catches before critical gRPC calls."
          />
          <MetricRow
            label="Cleanup success"
            value={data?.cleanupSuccess}
            hint="Unfriend / friendship-leak prevention."
            provisional={data?.provisional?.cleanupSuccess}
          />
          <MetricRow
            label="Stuck pressure (inverse)"
            value={100 - (data?.stuckRate || 0)}
            hint="Lower stuck-state count = higher score component."
          />
        </Grid>
      </Grid>
    </Paper>
  );
}

// ── Main page ─────────────────────────────────────────────────────
// ── 2026-04-20 Phase 7B — Intelligence Signals section ────────────
// Renders the Attention panel + All Signals table at the top of the
// dashboard. All filtering / sorting / CTA logic is delegated to the
// pure helpers above so the table stays drift-guardable. ──────────
function IntelligenceSection({
  signalsData, signalsError,
  attentionSignals, filteredSignals,
  alertsData, metricsData,
  externalStatus,
  markSeen, markClicked,
  ackAlert, resolveAlert,
  signalWin, setSignalWin,
  signalDomainFilter, setSignalDomainFilter,
  signalSeverityFilter, setSignalSeverityFilter,
  signalFiltersActive, resetSignalFilters,
}) {
  const navigate = useNavigate();

  // Build a quick lookup so attention rows can show usage tooltips.
  const metricsBySignal = useMemo(() => {
    const m = new Map();
    for (const row of (metricsData?.metrics || [])) m.set(row.signalId, row);
    return m;
  }, [metricsData]);

  // Phase 8A — fire `seen` once per alert in the history panel.
  // Defensive: if alertsData is null or markSeen is undefined the
  // effect short-circuits.
  useEffect(() => {
    if (!alertsData || !Array.isArray(alertsData.alerts) || !markSeen) return;
    for (const a of alertsData.alerts) {
      markSeen(a.id, a.signalId, a.severity);
    }
  }, [alertsData, markSeen]);

  // 2026-04-20 Phase 8B — alert hygiene + why-detail local state.
  // hygieneTick forces a re-render after sessionStorage mutations
  // (mute / snooze toggles) since storage events don't fire in the
  // same tab. expandedAlertId tracks which "why this fired" Collapse
  // is open. revealSilenced toggles the silenced-list inline view.
  const [hygieneTick, setHygieneTick]       = useState(0);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [revealSilenced, setRevealSilenced]  = useState(false);
  const bumpHygiene = useCallback(() => setHygieneTick(t => t + 1), []);

  // Partition alert history into visible vs silenced (crit always visible).
  // hygieneTick is in deps so toggles re-evaluate. Phase 8C: resolved
  // alerts move to a third bucket so they don't clutter the live view.
  const { visibleAlerts, silencedAlerts, resolvedAlerts } = useMemo(() => {
    const all = (alertsData?.alerts || []);
    const visible  = [];
    const silenced = [];
    const resolved = [];
    for (const a of all) {
      if (alertStatus(a) === 'resolved') { resolved.push(a); continue; }
      if (isAlertSilenced(a)) silenced.push(a);
      else                    visible.push(a);
    }
    return { visibleAlerts: visible, silencedAlerts: silenced, resolvedAlerts: resolved };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsData, hygieneTick]);

  // Phase 8C — index of resolved signalIds (most-recent alert per
  // signal). Used to filter the attention panel: a signal whose
  // most-recent alert was resolved should disappear from the live
  // attention view (operator already handled it).
  const resolvedSignalIds = useMemo(() => {
    const map = new Map(); // signalId → latest createdAt
    const set = new Set();
    for (const a of (alertsData?.alerts || [])) {
      const t = a.createdAt ? Date.parse(a.createdAt) : 0;
      const prev = map.get(a.signalId) || 0;
      if (t >= prev) {
        map.set(a.signalId, t);
        if (alertStatus(a) === 'resolved') set.add(a.signalId);
        else                                set.delete(a.signalId);
      }
    }
    return set;
  }, [alertsData]);

  // Same partition for the attention panel rows (signal previews).
  const visibleAttention = useMemo(() => {
    return attentionSignals.filter(s => {
      // Phase 8C: hide if the most recent dispatched alert for this
      // signal has been resolved by an operator.
      if (resolvedSignalIds.has(s.id)) return false;
      // Crit cannot be silenced.
      if (s.severity === 'crit') return true;
      if (isMuted(s.id))   return false;
      if (isSnoozed(s.id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionSignals, hygieneTick, resolvedSignalIds]);

  if (signalsError) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Failed to load intelligence signals: {signalsError}. Integrity metrics below still reflect the 24h window.
      </Alert>
    );
  }

  const total     = (signalsData?.signals || []).length;
  const critCount = (signalsData?.signals || []).filter(s => s.severity === 'crit').length;
  const warnCount = (signalsData?.signals || []).filter(s => s.severity === 'warn').length;
  const okCount   = (signalsData?.signals || []).filter(s => s.severity === 'ok').length;

  return (
    <Box data-intel-section sx={{ mb: 3 }}>
      {/* ── Attention panel ─────────────────────────────────────── */}
      <Paper
        variant="outlined"
        data-intel-attention
        sx={{ p: 2.5, mb: 2, borderRadius: 2,
              borderColor: attentionSignals.length ? 'warning.main' : 'divider',
              borderLeftWidth: 4, borderLeftColor: attentionSignals.length
                ? (critCount > 0 ? 'error.main' : 'warning.main')
                : 'success.main',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {attentionSignals.length > 0
              ? <WarnIcon color={critCount > 0 ? 'error' : 'warning'} fontSize="small" />
              : <OkIcon color="success" fontSize="small" />}
            <Typography variant="subtitle1" fontWeight={700}>
              {attentionSignals.length > 0 ? 'Needs attention' : 'All systems healthy'}
            </Typography>
            <Chip
              size="small"
              label={`${critCount} crit · ${warnCount} warn · ${okCount} ok`}
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem' }}
            />
            {(attentionSignals.length - visibleAttention.length) > 0 && (
              <Chip
                size="small"
                variant="outlined"
                color="info"
                data-intel-silenced-count
                label={`${attentionSignals.length - visibleAttention.length} silenced`}
                onClick={() => setRevealSilenced(v => !v)}
                sx={{ fontSize: '0.65rem', cursor: 'pointer' }}
              />
            )}
          </Stack>
        </Stack>

        {attentionSignals.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No signals currently breaching warn/crit thresholds in the selected window.
            {total > 0 && ` ${okCount}/${total} signals are ok.`}
          </Typography>
        ) : visibleAttention.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            All breaching signals are currently muted or snoozed for this session.
            {' '}
            <Box component="span"
              role="button" tabIndex={0}
              onClick={() => setRevealSilenced(true)}
              onKeyDown={(e) => { if (e.key === 'Enter') setRevealSilenced(true); }}
              sx={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reveal silenced
            </Box>
          </Typography>
        ) : (
          <Stack spacing={1}>
            {visibleAttention.map((sig) => {
              const cta = mapSignalToCta(sig);
              const trendIcon = !sig.trend ? null
                : sig.trend.direction === 'up'   ? <TrendUpIcon   fontSize="inherit" />
                : sig.trend.direction === 'down' ? <TrendDownIcon fontSize="inherit" />
                : <TrendFlatIcon fontSize="inherit" />;
              return (
                <Stack
                  key={sig.id}
                  data-intel-attention-row
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover' }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                    <Chip
                      size="small"
                      label={sig.severity.toUpperCase()}
                      color={SIGNAL_SEVERITY_COLOR[sig.severity] || 'default'}
                      sx={{ fontWeight: 700, minWidth: 56 }}
                    />
                    {sig.confidence && (
                      <Tooltip title={`Confidence: ${sig.confidence} (sample size: ${sig.denominator ?? '?'})`}>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={sig.confidence}
                          color={CONFIDENCE_COLOR[sig.confidence] || 'default'}
                          data-intel-confidence={sig.confidence}
                          sx={{ fontWeight: 600, fontSize: '0.65rem' }}
                        />
                      </Tooltip>
                    )}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={600}>{sig.label}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>
                          {formatSignalValue(sig)}
                        </Typography>
                        {trendIcon && (
                          <Tooltip title={`Trend vs previous window: ${sig.trend.direction}`}>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', fontSize: 16,
                              color: sig.trend.direction === 'flat' ? 'text.secondary'
                                : ((sig.thresholds?.direction === 'lower' && sig.trend.direction === 'down')
                                   || (sig.thresholds?.direction !== 'lower' && sig.trend.direction === 'up'))
                                  ? 'error.main' : 'success.main',
                            }}>
                              {trendIcon}
                            </Box>
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{
                        display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {sig.reason}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={0.5} alignItems="center" data-intel-attention-actions>
                    {/* Phase 8B — hygiene buttons (warn only). Crit gets a
                        locked shield so operator knows it cannot be silenced. */}
                    {sig.severity === 'crit' ? (
                      <Tooltip title="Crit alerts cannot be silenced">
                        <LockIcon fontSize="small" color="action" sx={{ opacity: 0.6 }} />
                      </Tooltip>
                    ) : (
                      <>
                        <Tooltip title="Mute this signal for this browser session">
                          <IconButton
                            size="small"
                            data-intel-mute={sig.id}
                            onClick={(e) => { e.stopPropagation(); setMuted(sig.id, true); bumpHygiene(); }}
                          >
                            <MuteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Snooze warn alerts for 1 hour (this tab)">
                          <IconButton
                            size="small"
                            data-intel-snooze={sig.id}
                            onClick={(e) => { e.stopPropagation(); snoozeFor(sig.id); bumpHygiene(); }}
                          >
                            <SnoozeIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {cta && (() => {
                      // Phase 8A — usage hint, only when we have ≥3 alerts
                      // recorded for this signal. Insufficient data is silent.
                      const m = metricsBySignal.get(sig.id);
                      const usage = (m && m.alerts >= 3)
                        ? (m.clickRate >= 0.6 ? 'Frequently acted on'
                           : m.ignoreRate >= 0.6 ? 'Rarely acted on'
                           : null)
                        : null;
                      return (
                        <Tooltip title={usage ? `Recent usage: ${usage} (${Math.round((m.clickRate || 0) * 100)}% clicked)` : ''}>
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<OpenInNewIcon fontSize="small" />}
                            onClick={() => {
                              // No alertId on attention-panel rows — these are
                              // signal previews, not dispatched alert events.
                              // Clicked telemetry only fires from the alert
                              // history panel which has real alertIds.
                              navigate(cta.to);
                            }}
                            data-intel-cta={cta.to}
                          >
                            {cta.label}
                          </Button>
                        </Tooltip>
                      );
                    })()}
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}

        {/* 2026-04-20 Phase 8B — silenced list (collapsible). Lets the
            operator restore individual signals without leaving the
            page. Crit signals are never in this list. */}
        <Collapse in={revealSilenced && (attentionSignals.length - visibleAttention.length) > 0}>
          <Box data-intel-silenced-list sx={{
            mt: 1.5, pt: 1.5,
            borderTop: '1px dashed', borderColor: 'divider',
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Silenced this session — restore to make alerts visible again
            </Typography>
            <Stack spacing={0.5}>
              {attentionSignals.filter(s =>
                s.severity !== 'crit' && (isMuted(s.id) || isSnoozed(s.id))
              ).map((sig) => (
                <Stack key={sig.id} direction="row" alignItems="center" spacing={1}
                  sx={{ py: 0.25 }}
                  data-intel-silenced-row>
                  <Chip size="small" variant="outlined"
                    label={isMuted(sig.id) ? 'muted' : 'snoozed'}
                    sx={{ minWidth: 70, fontSize: '0.65rem' }} />
                  <Typography variant="caption" sx={{ flex: 1, fontFamily: '"JetBrains Mono", monospace' }}>
                    {sig.id}
                  </Typography>
                  <Button
                    size="small" variant="text"
                    data-intel-restore={sig.id}
                    onClick={() => {
                      setMuted(sig.id, false);
                      clearSnooze(sig.id);
                      bumpHygiene();
                    }}
                  >Restore</Button>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Collapse>
      </Paper>

      {/* ── 2026-04-20 Phase 7C — Alert history (in-product only) */}
      {alertsData && alertsData.count > 0 && (
        <Paper variant="outlined" data-intel-alert-history sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
            <BellIcon fontSize="small" color="warning" />
            <Typography variant="subtitle2" fontWeight={700}>
              Recent alerts
            </Typography>
            <Chip
              size="small"
              label={`${alertsData.count} dispatched`}
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem' }}
            />
            {/* Phase 7D — external dispatcher status (Discord, crit only).
                Only renders if we got status data back; the chip color
                reflects operational state. */}
            {externalStatus && (() => {
              const operational = !!externalStatus.operational;
              const hasError = !!externalStatus.lastError;
              const color = !externalStatus.configured ? 'default'
                : (operational && !hasError) ? 'success'
                : (operational && hasError)  ? 'warning'
                : 'default';
              const label = !externalStatus.configured
                ? 'External: NOT CONFIGURED'
                : operational
                  ? `External: ON · ${externalStatus.dispatchedCount} sent${externalStatus.failedCount > 0 ? ` · ${externalStatus.failedCount} failed` : ''}`
                  : 'External: OFF';
              const tip = !externalStatus.configured
                ? 'Set INTEL_DISCORD_WEBHOOK_URL to enable Discord dispatch'
                : operational
                  ? `Discord crit-only dispatch is ON. Last sent: ${externalStatus.lastDispatchAt || 'never'}${hasError ? `. Last error: ${externalStatus.lastError}` : ''}`
                  : 'Discord dispatch is opt-in. Toggle via POST /admin/intelligence/external/enable';
              return (
                <Tooltip title={tip}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={color}
                    data-intel-external-status={operational ? 'on' : 'off'}
                    label={label}
                    sx={{ fontSize: '0.65rem' }}
                  />
                </Tooltip>
              );
            })()}
            <Tooltip title="Alert state is in-memory only — resets on server restart. Discord dispatch is opt-in (Phase 7D).">
              <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Tooltip>
          </Stack>

          <Stack spacing={0.75}>
            {visibleAlerts.slice(0, 6).map((a) => {
              const rec = a.recommendation;
              const isExpanded = expandedAlertId === a.id;
              // Phase 8C — workflow status (always defined; defaults to "open").
              const status = alertStatus(a);
              return (
                <Box
                  key={a.id}
                  data-intel-alert-row
                  data-intel-alert-status={status}
                  sx={{ py: 0.75, borderBottom: '1px dashed', borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                        opacity: status === 'resolved' ? 0.55 : 1 }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <Chip
                        size="small"
                        label={a.severity.toUpperCase()}
                        color={SIGNAL_SEVERITY_COLOR[a.severity] || 'default'}
                        sx={{ fontWeight: 700, minWidth: 52 }}
                      />
                      {/* Phase 8C — workflow status chip */}
                      <Tooltip title={
                        status === 'acked'    ? `Acked by ${a.state?.ackedBy || 'unknown'} · ${a.state?.ackedAt ? fmtAge(Date.now() - Date.parse(a.state.ackedAt)) : ''}`
                      : status === 'resolved' ? `Resolved by ${a.state?.resolvedBy || 'unknown'} · ${a.state?.resolvedAt ? fmtAge(Date.now() - Date.parse(a.state.resolvedAt)) : ''}`
                      : 'Awaiting acknowledgement'
                      }>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={ALERT_STATUS_COLOR[status] || 'default'}
                          data-intel-alert-state-chip={status}
                          label={ALERT_STATUS_LABEL[status] || 'Open'}
                          sx={{ fontSize: '0.6rem', fontWeight: 700, minWidth: 60 }}
                        />
                      </Tooltip>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                          <Typography variant="caption" fontWeight={600}>{a.label}</Typography>
                          <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                            {formatSignalValue(a)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            · {fmtAge(Date.now() - Date.parse(a.createdAt))}
                          </Typography>
                        </Stack>
                        {rec && (
                          <Tooltip title={rec.rationale || ''}>
                            <Typography variant="caption" color="text.secondary" sx={{
                              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              → {rec.action}
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center" data-intel-alert-actions>
                      {/* Phase 8B — why-this-fired toggle */}
                      <Tooltip title={isExpanded ? 'Hide details' : 'Why this fired'}>
                        <IconButton
                          size="small"
                          data-intel-why-toggle={a.id}
                          onClick={() => setExpandedAlertId(isExpanded ? null : a.id)}
                          sx={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s' }}
                        >
                          <ExpandMoreIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {/* Phase 8B — hygiene controls (warn only). Crit shows lock. */}
                      {a.severity === 'crit' ? (
                        <Tooltip title="Crit alerts cannot be silenced">
                          <LockIcon fontSize="small" color="action" sx={{ opacity: 0.6 }} />
                        </Tooltip>
                      ) : (
                        <>
                          <Tooltip title="Mute this signal for this browser session">
                            <IconButton
                              size="small"
                              data-intel-alert-mute={a.signalId}
                              onClick={() => { setMuted(a.signalId, true); bumpHygiene(); }}
                            >
                              <MuteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Snooze warn alerts for 1 hour">
                            <IconButton
                              size="small"
                              data-intel-alert-snooze={a.signalId}
                              onClick={() => { snoozeFor(a.signalId); bumpHygiene(); }}
                            >
                              <SnoozeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {rec && SIGNAL_CTA_ALLOWLIST.has(rec.route) && (
                        <Button
                          size="small"
                          variant="text"
                          endIcon={<OpenInNewIcon fontSize="small" />}
                          onClick={() => {
                            if (markClicked) markClicked(a.id, a.signalId, rec.route, a.severity);
                            navigate(rec.route);
                          }}
                          data-intel-alert-cta={rec.route}
                        >
                          Open
                        </Button>
                      )}
                      {/* Phase 8C — ack / resolve workflow actions.
                          Open    → Acknowledge + Resolve
                          Acked   → Resolve only
                          Resolved → no buttons (terminal state) */}
                      {status === 'open' && ackAlert && (
                        <Tooltip title="Acknowledge — mark you've seen this alert">
                          <IconButton
                            size="small"
                            data-intel-ack={a.id}
                            onClick={() => ackAlert(a.id)}
                            sx={{ color: 'info.main' }}
                          >
                            <AckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(status === 'open' || status === 'acked') && resolveAlert && (
                        <Tooltip title="Resolve — close out this alert">
                          <IconButton
                            size="small"
                            data-intel-resolve={a.id}
                            onClick={() => resolveAlert(a.id)}
                            sx={{ color: 'success.main' }}
                          >
                            <ResolveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                  {/* 2026-04-20 Phase 8D — compact always-visible
                      timeline + audit context strip. Renders only the
                      events that actually happened — no placeholders.
                      Note preview lives below as its own line. */}
                  <Stack
                    direction="row" spacing={0.75} alignItems="center"
                    data-intel-alert-timeline
                    sx={{ mt: 0.5, ml: 7, flexWrap: 'wrap', rowGap: 0.5 }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      Created {fmtAge(Date.now() - Date.parse(a.createdAt))}
                    </Typography>
                    {a.dispatchReason && /^escalated_/.test(String(a.dispatchReason)) && (
                      <Tooltip title={`Severity escalation: ${a.dispatchReason.replace(/^escalated_/, '').replace('_', ' → ')}`}>
                        <Chip
                          size="small" variant="outlined" color="error"
                          data-intel-timeline-escalated
                          label="↑ escalated"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      </Tooltip>
                    )}
                    {a.externallyDispatched && (
                      <Tooltip title="Sent to Discord (crit-only external dispatcher)">
                        <Chip
                          size="small" variant="outlined" color="info"
                          data-intel-timeline-dispatched
                          label="📡 Discord"
                          sx={{ height: 18, fontSize: '0.6rem' }}
                        />
                      </Tooltip>
                    )}
                    {a.state?.ackedAt && (
                      <Typography variant="caption" color="text.secondary"
                        data-intel-timeline-acked
                        sx={{ fontSize: '0.65rem' }}>
                        · Acked by <strong>{a.state.ackedBy || 'unknown'}</strong> {fmtAge(Date.now() - Date.parse(a.state.ackedAt))}
                      </Typography>
                    )}
                    {a.state?.resolvedAt && (
                      <Typography variant="caption" color="text.secondary"
                        data-intel-timeline-resolved
                        sx={{ fontSize: '0.65rem' }}>
                        · Resolved by <strong>{a.state.resolvedBy || 'unknown'}</strong> {fmtAge(Date.now() - Date.parse(a.state.resolvedAt))}
                      </Typography>
                    )}
                  </Stack>
                  {/* 8D — note preview (truncated, full text in tooltip) */}
                  {a.state?.note && (
                    <Tooltip title={a.state.note}>
                      <Typography
                        variant="caption" color="text.secondary"
                        data-intel-alert-note-preview
                        sx={{ display: 'block', mt: 0.25, ml: 7, fontStyle: 'italic',
                              maxWidth: '100%', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontSize: '0.65rem' }}
                      >
                        📝 “{a.state.note.length > 80 ? a.state.note.slice(0, 80) + '…' : a.state.note}”
                      </Typography>
                    </Tooltip>
                  )}
                  {/* Phase 8B — expandable "why this fired" detail */}
                  <Collapse in={isExpanded}>
                    <Box data-intel-why-detail
                      sx={{ mt: 1, p: 1.25, borderRadius: 1, bgcolor: 'action.hover',
                            fontSize: '0.7rem', fontFamily: '"JetBrains Mono", monospace' }}
                    >
                      <Box><strong>formula:</strong> {a.formula || '—'}</Box>
                      <Box><strong>threshold:</strong> {formatThreshold(a.thresholds)}</Box>
                      <Box><strong>current value:</strong> {formatSignalValue(a)}</Box>
                      <Box><strong>trend:</strong> {a.trend ? `${a.trend.direction} (Δ ${(a.trend.delta * 100).toFixed(2)}pp vs prev)` : 'no prior window'}</Box>
                      <Box><strong>windows observed:</strong> {a.windowsObserved ?? 1}</Box>
                      <Box><strong>destination:</strong> {rec?.route || '—'}</Box>
                      <Box sx={{ mt: 0.5, fontFamily: 'inherit', fontSize: '0.7rem' }}>
                        <strong>dispatch reason:</strong> {a.dispatchReason || '—'}
                      </Box>
                      <Box><strong>externally dispatched:</strong> {a.externallyDispatched ? 'yes (Discord)' : 'no'}</Box>
                      {a.state?.note && (
                        <Box sx={{ mt: 0.5 }}><strong>note:</strong> {a.state.note}</Box>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Stack>

          {/* Phase 8B — silenced count + reveal in alert history */}
          {silencedAlerts.length > 0 && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.25 }}
              data-intel-alert-silenced-summary>
              <Chip
                size="small"
                variant="outlined"
                color="info"
                label={`${silencedAlerts.length} alert${silencedAlerts.length === 1 ? '' : 's'} silenced`}
                sx={{ fontSize: '0.65rem' }}
              />
              <Button
                size="small"
                variant="text"
                onClick={() => setRevealSilenced(v => !v)}
              >
                {revealSilenced ? 'Hide silenced' : 'Show silenced'}
              </Button>
            </Stack>
          )}
          <Collapse in={revealSilenced && silencedAlerts.length > 0}>
            <Stack spacing={0.5} sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
              {silencedAlerts.slice(0, 6).map((a) => (
                <Stack key={a.id} direction="row" alignItems="center" spacing={1}
                  data-intel-alert-silenced-row>
                  <Chip size="small" variant="outlined"
                    label={isMuted(a.signalId) ? 'muted' : 'snoozed'}
                    sx={{ minWidth: 70, fontSize: '0.65rem' }} />
                  <Typography variant="caption" sx={{ flex: 1 }}>
                    {a.label} — {formatSignalValue(a)}
                  </Typography>
                  <Button size="small" variant="text"
                    onClick={() => { setMuted(a.signalId, false); clearSnooze(a.signalId); bumpHygiene(); }}
                  >Restore</Button>
                </Stack>
              ))}
            </Stack>
          </Collapse>
        </Paper>
      )}

      {/* ── All Signals table ───────────────────────────────────── */}
      <Paper variant="outlined" data-intel-all sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle1" fontWeight={700}>All Signals</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="intel-window-label">Window</InputLabel>
              <Select
                labelId="intel-window-label"
                value={signalWin}
                label="Window"
                onChange={(e) => setSignalWin(e.target.value)}
              >
                <MenuItem value="1h">Last 1h</MenuItem>
                <MenuItem value="6h">Last 6h</MenuItem>
                <MenuItem value="24h">Last 24h</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="intel-domain-label">Domain</InputLabel>
              <Select
                labelId="intel-domain-label"
                value={signalDomainFilter}
                label="Domain"
                onChange={(e) => setSignalDomainFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="gift">Gift</MenuItem>
                <MenuItem value="trade">Trade</MenuItem>
                <MenuItem value="hunt">Hunt</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="intel-sev-label">Severity</InputLabel>
              <Select
                labelId="intel-sev-label"
                value={signalSeverityFilter}
                label="Severity"
                onChange={(e) => setSignalSeverityFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="alerts">Warn + Crit only</MenuItem>
              </Select>
            </FormControl>
            {signalFiltersActive && (
              <Tooltip title="Reset window, domain and severity to defaults">
                <Chip
                  label="Clear filters"
                  size="small"
                  variant="outlined"
                  onClick={resetSignalFilters}
                  onDelete={resetSignalFilters}
                />
              </Tooltip>
            )}
          </Stack>
        </Stack>

        <Table size="small" data-intel-table>
          <TableHead>
            <TableRow>
              <TableCell>Signal</TableCell>
              <TableCell>Value</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Threshold</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Trend</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Reason</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSignals.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    <Typography variant="body2" fontWeight={600}>No signals match the current filters</Typography>
                    <Typography variant="caption">
                      Adjust the window, domain or severity filters to see more.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {filteredSignals.map((sig) => {
              const cta = mapSignalToCta(sig);
              return (
                <TableRow key={sig.id} hover>
                  <TableCell>
                    <Stack>
                      <Typography variant="body2" fontWeight={600}>{sig.label}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        {sig.id}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>
                      {formatSignalValue(sig)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatThreshold(sig.thresholds)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={sig.severity}
                      color={SIGNAL_SEVERITY_COLOR[sig.severity] || 'default'}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {sig.trend ? (
                      <Tooltip title={`prev: ${sig.trend.prevValue?.toFixed?.(3) ?? sig.trend.prevValue}`}>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={sig.trend.direction}
                        />
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 360 }}>
                    <Tooltip title={sig.reason || ''}>
                      <Typography variant="caption" color="text.secondary" sx={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {sig.reason}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {cta ? (
                      <Button
                        size="small"
                        variant="text"
                        endIcon={<OpenInNewIcon fontSize="small" />}
                        onClick={() => navigate(cta.to)}
                      >
                        {cta.label}
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* ── 2026-04-20 Phase 8A — Intelligence Insights (secondary) */}
      {metricsData && Array.isArray(metricsData.metrics) && metricsData.metrics.length > 0 && (
        <Paper variant="outlined" data-intel-insights sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Intelligence Insights
            </Typography>
            <Tooltip title="Lightweight observability — measures alert usefulness from operator interaction. In-memory, resets on server restart.">
              <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Tooltip>
            <Chip
              size="small"
              variant="outlined"
              label={`${metricsData.metrics.length} signals tracked`}
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem' }}
            />
          </Stack>

          {/* Phase 8B — telemetry-informed tuning summary. Counts of
              each tuning bucket; tooltip lists the signal IDs in
              that bucket for context. Compact, secondary, no actions
              (suggestions only — no auto-tune in this phase). */}
          {(() => {
            const groups = { useful: [], noisy: [], critical: [], neutral: [] };
            for (const row of metricsData.metrics) {
              if (groups[row.status]) groups[row.status].push(row.signalId);
            }
            const high = metricsData.metrics.filter(r => r.escalations >= 3);
            const tuningPill = (key, label, color) => groups[key].length > 0 && (
              <Tooltip key={key} title={groups[key].length ? groups[key].join(', ') : ''}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={color}
                  data-intel-tuning-pill={key}
                  label={`${groups[key].length} ${label}`}
                  sx={{ fontSize: '0.65rem' }}
                />
              </Tooltip>
            );
            return (
              <Stack
                direction="row" spacing={0.75} alignItems="center"
                data-intel-tuning-summary
                sx={{ mb: 1.25, flexWrap: 'wrap' }}
              >
                {tuningPill('useful',   'useful',     'success')}
                {tuningPill('noisy',    'noisy',      'warning')}
                {tuningPill('critical', 'critical',   'error')}
                {tuningPill('neutral',  'neutral',    'default')}
                {high.length > 0 && (
                  <Tooltip title={`Escalated ≥ 3 times: ${high.map(r => r.signalId).join(', ')}`}>
                    <Chip
                      size="small"
                      variant="outlined"
                      color="error"
                      data-intel-tuning-pill="escalated"
                      label={`${high.length} high-escalation`}
                      sx={{ fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                )}
                {groups.noisy.length > 0 && (
                  <Tooltip title="Signals classified noisy fire often but operators rarely click. Consider raising their warn threshold (no auto-tune in this phase).">
                    <Typography variant="caption" color="text.secondary"
                      sx={{ ml: 0.5, fontStyle: 'italic' }}
                      data-intel-tuning-suggestion>
                      Suggestion: review thresholds for noisy signals
                    </Typography>
                  </Tooltip>
                )}
              </Stack>
            );
          })()}

          <Table size="small" data-intel-insights-table>
            <TableHead>
              <TableRow>
                <TableCell>Signal</TableCell>
                <TableCell align="right">Alerts</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Click %</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Avg Response</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metricsData.metrics.slice(0, 5).map((row) => {
                const statusColor = row.status === 'critical' ? 'error'
                  : row.status === 'useful'  ? 'success'
                  : row.status === 'noisy'   ? 'warning'
                  : 'default';
                const statusLabel = row.status === 'critical' ? 'Critical'
                  : row.status === 'useful'  ? 'Useful'
                  : row.status === 'noisy'   ? 'Noisy'
                  : 'Neutral';
                const statusTip = row.status === 'critical'
                    ? `Escalated ${row.escalations} time${row.escalations === 1 ? '' : 's'}`
                  : row.status === 'useful'
                    ? `${Math.round(row.clickRate * 100)}% of alerts clicked`
                  : row.status === 'noisy'
                    ? `${Math.round(row.ignoreRate * 100)}% of alerts ignored`
                  : `Insufficient interaction data (${row.alerts} alert${row.alerts === 1 ? '' : 's'})`;
                return (
                  <TableRow key={row.signalId} hover>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
                        {row.signalId}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" fontWeight={600}>{row.alerts}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="caption">{Math.round(row.clickRate * 100)}%</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="caption">
                        {row.avgResponseMs == null ? '—' : fmtAge(row.avgResponseMs)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={statusTip}>
                        <Chip size="small" label={statusLabel} color={statusColor} sx={{ fontWeight: 700 }} />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}

export default function SystemIntegrity() {
  const [win, setWin] = useState('24h');
  const [systemFilter, setSystemFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // fetchWithAuth prepends API_BASE ('/api') — pass the path as
      // '/admin/...', NOT '/api/admin/...'. Matches AdminHealth idiom.
      const res = await fetchWithAuth(`/admin/integrity/overview?window=${win}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [win]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // ── 2026-04-20 Phase 7B — Intelligence signals ───────────────────
  // Independent poll loop because the signal window (1h/6h/24h) is
  // separate from the incident window (1h/6h/24h/7d). Shares the same
  // 30s cadence so server-side 30s caching stays warm across tabs.
  const [signalWin, setSignalWin] = useState('1h');
  const [signalDomainFilter, setSignalDomainFilter] = useState('all');
  const [signalSeverityFilter, setSignalSeverityFilter] = useState('all');
  const [signalsData, setSignalsData] = useState(null);
  const [signalsError, setSignalsError] = useState(null);
  // 2026-04-20 Phase 7C — alert history (in-product channel).
  const [alertsData, setAlertsData] = useState(null);
  // 2026-04-20 Phase 8A — derived telemetry metrics (in-memory backend).
  const [metricsData, setMetricsData] = useState(null);
  // 2026-04-20 Phase 7D — external dispatcher status (Discord crit alerts).
  const [externalStatus, setExternalStatus] = useState(null);

  const loadSignals = useCallback(async () => {
    setSignalsError(null);
    try {
      const res = await fetchWithAuth(`/admin/intelligence/signals?window=${signalWin}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSignalsData(json);
    } catch (e) {
      setSignalsError(e.message || String(e));
    }
  }, [signalWin]);

  useEffect(() => {
    loadSignals();
    const t = setInterval(loadSignals, 30_000);
    return () => clearInterval(t);
  }, [loadSignals]);

  // Phase 7C — poll alert history on the same cadence. Server-side
  // ring buffer updates synchronously inside /signals, so a 1s delay
  // after a signal poll is enough to see the new alerts.
  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/admin/intelligence/alerts?limit=20');
      if (!res.ok) return; // non-fatal — panel just doesn't update
      const json = await res.json();
      setAlertsData(json);
    } catch {
      // Silent — alert history is informational; never blocks the page.
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 30_000);
    return () => clearInterval(t);
  }, [loadAlerts]);

  // Phase 8A — telemetry metrics (60s cadence, slower than alerts).
  // Defensive: any failure leaves metricsData null and the panel
  // simply doesn't render.
  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/admin/intelligence/metrics');
      if (!res.ok) return;
      const json = await res.json();
      setMetricsData(json);
    } catch {
      // Silent — observability layer must never break the page.
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    const t = setInterval(loadMetrics, 60_000);
    return () => clearInterval(t);
  }, [loadMetrics]);

  // Phase 7D — external dispatcher status (slow poll, status panel only).
  // Defensive: any failure leaves the chip absent.
  const loadExternalStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/admin/intelligence/external/status');
      if (!res.ok) return;
      const json = await res.json();
      setExternalStatus(json);
    } catch {
      // Silent — external status is informational; never blocks the page.
    }
  }, []);

  useEffect(() => {
    loadExternalStatus();
    const t = setInterval(loadExternalStatus, 60_000);
    return () => clearInterval(t);
  }, [loadExternalStatus]);

  // Phase 8A — seen-dedupe Set lives across renders so each unique
  // alertId fires the seen POST exactly once per browser session.
  const seenAlertsRef = useRef(new Set());

  // Both helpers are fire-and-forget. They MUST never throw, never
  // delay UI, never log to console under normal operation.
  const markSeen = useCallback((alertId, signalId, severity) => {
    if (!alertId || !signalId) return;
    if (seenAlertsRef.current.has(alertId)) return;
    seenAlertsRef.current.add(alertId);
    fetchWithAuth('/admin/intelligence/telemetry/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, signalId, severity }),
    }).catch(() => {/* silent */});
  }, []);

  const markClicked = useCallback((alertId, signalId, route, severity) => {
    if (!alertId) return;
    fetchWithAuth('/admin/intelligence/telemetry/clicked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId, signalId, route, severity }),
    }).catch(() => {/* silent */});
  }, []);

  // 2026-04-20 Phase 8C — optimistic ack / resolve. Update local
  // alertsData immediately so the UI feels instant; POST in
  // background. On failure, refetch to recover the truth.
  const optimisticUpdateAlert = useCallback((alertId, partialState) => {
    setAlertsData(prev => {
      if (!prev || !Array.isArray(prev.alerts)) return prev;
      return {
        ...prev,
        alerts: prev.alerts.map(a => a.id === alertId
          ? { ...a, state: { ...(a.state || {}), ...partialState } }
          : a
        ),
      };
    });
  }, []);

  const ackAlert = useCallback((alertId) => {
    if (!alertId) return;
    optimisticUpdateAlert(alertId, {
      status: 'acked',
      ackedBy: 'you',
      ackedAt: new Date().toISOString(),
    });
    fetchWithAuth(`/admin/intelligence/alerts/${encodeURIComponent(alertId)}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => {
      if (!r.ok) loadAlerts(); // recover truth on failure
    }).catch(() => loadAlerts());
  }, [optimisticUpdateAlert, loadAlerts]);

  const resolveAlert = useCallback((alertId) => {
    if (!alertId) return;
    optimisticUpdateAlert(alertId, {
      status: 'resolved',
      resolvedBy: 'you',
      resolvedAt: new Date().toISOString(),
    });
    fetchWithAuth(`/admin/intelligence/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => {
      if (!r.ok) loadAlerts();
    }).catch(() => loadAlerts());
  }, [optimisticUpdateAlert, loadAlerts]);

  const signalFiltersActive =
    signalDomainFilter !== 'all' ||
    signalSeverityFilter !== 'all' ||
    signalWin !== '1h';
  const resetSignalFilters = useCallback(() => {
    setSignalDomainFilter('all');
    setSignalSeverityFilter('all');
    setSignalWin('1h');
  }, []);

  const allSignals = signalsData?.signals || [];

  const attentionSignals = useMemo(() => {
    const attn = allSignals.filter(s => s.severity === 'crit' || s.severity === 'warn');
    return sortAttentionSignals(attn);
  }, [allSignals]);

  const filteredSignals = useMemo(() => {
    return allSignals.filter(s => {
      const domainOk = signalDomainFilter === 'all' || s.domain === signalDomainFilter;
      const sevOk = signalSeverityFilter === 'all'
        || (signalSeverityFilter === 'alerts' && (s.severity === 'crit' || s.severity === 'warn'));
      return domainOk && sevOk;
    });
  }, [allSignals, signalDomainFilter, signalSeverityFilter]);

  // 2026-04-20 Phase 6A — severity priority for incident ordering.
  // Sort high → medium → low → (unlabelled), then newest detectedAt
  // within each tier so a spike always surfaces at the top.
  const SEVERITY_RANK = useMemo(
    () => ({ high: 0, medium: 1, low: 2 }),
    []
  );

  // Client-side filter application
  const incidents = useMemo(() => {
    if (!data) return [];
    const filtered = data.incidents.filter(i => {
      const sysOk = systemFilter === 'all' || i.system.toLowerCase() === systemFilter;
      const openOk = !openOnly || i.status !== 'resolved';
      const qOk = !query || `${i.id} ${i.title} ${i.signal} ${i.owner || ''}`.toLowerCase().includes(query.toLowerCase());
      return sysOk && openOk && qOk;
    });
    // Stable severity-first sort. high → medium → low → unlabelled;
    // newer detectedAt within the same tier. Never mutates source.
    return [...filtered].sort((a, b) => {
      const ra = SEVERITY_RANK[a.severity] ?? 3;
      const rb = SEVERITY_RANK[b.severity] ?? 3;
      if (ra !== rb) return ra - rb;
      const ta = a.detectedAt ? Date.parse(a.detectedAt) : 0;
      const tb = b.detectedAt ? Date.parse(b.detectedAt) : 0;
      return tb - ta;
    });
  }, [data, systemFilter, query, openOnly, SEVERITY_RANK]);

  // 2026-04-20 Phase 6A — "Clear filters" affordance. A filter is
  // "active" when it diverges from its default (all / empty / ON).
  // openOnly defaults to TRUE so leaving it checked is NOT an active
  // filter; unchecking it is.
  const filtersActive =
    systemFilter !== 'all' ||
    !!query ||
    !openOnly;
  const resetFilters = useCallback(() => {
    setSystemFilter('all');
    setQuery('');
    setOpenOnly(true);
  }, []);

  const executions = useMemo(() => {
    if (!data) return [];
    return data.executionRows.filter(r => {
      const sysOk = systemFilter === 'all' || r.system.toLowerCase() === systemFilter;
      const qOk = !query || `${r.id} ${r.flow} ${r.subject} ${r.reason || ''}`.toLowerCase().includes(query.toLowerCase());
      return sysOk && qOk;
    });
  }, [data, systemFilter, query]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const openCount = (data?.incidents || []).filter(i => i.status !== 'resolved').length;
  const stuckPressure = (data?.gift?.stuckRate || 0) + (data?.trade?.stuckRate || 0);

  return (
    <Box data-page-root sx={{ p: { xs: 2, md: 3 } }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <ShieldIcon fontSize="small" color="primary" />
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Integrity-first monitoring for Gift and Trade
            </Typography>
          </Stack>
          <Typography variant="h4" fontWeight={700}>System Integrity Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, mt: 1 }}>
            Separates real delivery from surface-level success. Verified outcomes, cleanup health,
            settlement integrity, stuck-state prevention, and failure-cluster visibility.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Search incidents, flows, reasons"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ width: { xs: '100%', md: 260 } }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>System</InputLabel>
            <Select label="System" value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="gift">Gift</MenuItem>
              <MenuItem value="trade">Trade</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Window</InputLabel>
            <Select label="Window" value={win} onChange={(e) => setWin(e.target.value)}>
              {WINDOWS.map(w => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} size="small" />}
            label={<Typography variant="caption">Open only</Typography>}
          />
          {/*
            2026-04-20 Phase 6A — "Clear filters" affordance. Only shown
            when at least one filter has diverged from its default. Kills
            the "why is nothing showing?" moment in one click.
          */}
          {filtersActive && (
            <Tooltip title="Reset system, window, search and Open-only to defaults">
              <Chip
                label="Clear filters"
                size="small"
                variant="outlined"
                onClick={resetFilters}
                onDelete={resetFilters}
                sx={{ ml: 0.5 }}
              />
            </Tooltip>
          )}
          <Tooltip title="Refresh now">
            <IconButton onClick={load} disabled={loading}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load integrity data: {error}</Alert>}

      {/* ── 2026-04-20 Phase 7B + 7C + 7D + 8A + 8C — Signals, Alerts, Insights, External, Ack/Resolve */}
      <IntelligenceSection
        signalsData={signalsData}
        signalsError={signalsError}
        attentionSignals={attentionSignals}
        filteredSignals={filteredSignals}
        alertsData={alertsData}
        metricsData={metricsData}
        externalStatus={externalStatus}
        markSeen={markSeen}
        markClicked={markClicked}
        ackAlert={ackAlert}
        resolveAlert={resolveAlert}
        signalWin={signalWin}
        setSignalWin={setSignalWin}
        signalDomainFilter={signalDomainFilter}
        setSignalDomainFilter={setSignalDomainFilter}
        signalSeverityFilter={signalSeverityFilter}
        setSignalSeverityFilter={setSignalSeverityFilter}
        signalFiltersActive={signalFiltersActive}
        resetSignalFilters={resetSignalFilters}
      />

      {/* ── Top stat tiles ─────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Gift integrity score"
            value={data?.gift?.integrityScore ?? '—'}
            subtitle="Unified engine + truthful terminal states"
            Icon={HeartIcon}
            warn={(data?.gift?.integrityScore ?? 100) < 85}
            tooltip={data?.scoreFormula?.description}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Trade integrity score"
            value={data?.trade?.integrityScore ?? '—'}
            subtitle="Settlement verification on hot paths"
            Icon={TreeIcon}
            warn={(data?.trade?.integrityScore ?? 100) < 85}
            tooltip={data?.scoreFormula?.description}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Open integrity incidents"
            value={openCount}
            subtitle="Truth-gap, cleanup, delivery regressions"
            Icon={BellIcon}
            warn={openCount > 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Stuck-state pressure"
            value={`${stuckPressure}%`}
            subtitle="Across both systems in current window"
            Icon={WarnIcon}
            warn={stuckPressure >= 3}
          />
        </Grid>
      </Grid>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Overview" />
        <Tab label="Gift" />
        <Tab label="Trade" />
        <Tab label={`Incidents (${incidents.length})`} />
      </Tabs>

      {tab === 0 && <OverviewPane data={data} executions={executions} />}
      {tab === 1 && <SystemPane data={data} which="gift"  buckets={data?.giftFailureBuckets}  executions={executions.filter(e => e.system === 'Gift')} />}
      {tab === 2 && <SystemPane data={data} which="trade" buckets={data?.tradeFailureBuckets} executions={executions.filter(e => e.system === 'Trade')} />}
      {tab === 3 && <IncidentsPane incidents={incidents} />}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'right' }}>
        Auto-refreshes every 30s · window {data?.windowLabel} · last updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
      </Typography>
    </Box>
  );
}

// ── Overview pane ─────────────────────────────────────────────────
function OverviewPane({ data, executions }) {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Integrity score trend</Typography>
            <Typography variant="caption" color="text.secondary">
              Hourly delivery rate per system over the selected window. Same engine that backs the integrity score but broken out so operators can spot regressions within the day.
            </Typography>
            <Box sx={{ height: 280, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.integritySeries || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Line type="monotone" dataKey="gift"  stroke="#7C8AFF" strokeWidth={2} dot={false} name="Gift" />
                  <Line type="monotone" dataKey="trade" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="4 4" name="Trade" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Integrity priorities</Typography>
            <Typography variant="caption" color="text.secondary">What operators should watch first.</Typography>
            <Box sx={{ mt: 2 }}>
              <MetricRow label="Gift truthful terminal rate" value={data?.gift?.truthfulTerminalRate} hint="COMPLETED must mean verified delivery." />
              <MetricRow label="Trade truthful terminal rate" value={data?.trade?.truthfulTerminalRate} hint="Settlement verification + clean error_message." />
              <MetricRow label="Gift session stability" value={data?.gift?.sessionStability} hint="Catches null/stale sessions before gRPC." />
              <MetricRow label="Trade session stability" value={data?.trade?.sessionStability} hint="Catches null/stale sessions before gRPC." />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={6}>
          <SystemHealthCard
            title="Gift system health"
            subtitle="AutoGiftEngine · Fill Missing · Shinedust · Specific Card Sharing"
            icon={HeartIcon}
            data={data?.gift}
          />
        </Grid>
        <Grid item xs={12} lg={6}>
          <SystemHealthCard
            title="Trade system health"
            subtitle="webuiTradeExecutor · finalizeUserSideTrade · verifyUserSideSettlement"
            icon={TreeIcon}
            data={data?.trade}
          />
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Recent execution truth table</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Last 20 executions across both systems. "Truth" column is authoritative — derived from verified-delivery evidence, not status alone.
        </Typography>
        <ExecutionTable rows={executions.slice(0, 20)} />
      </Paper>
    </Stack>
  );
}

// ── Per-system pane (gift | trade) ────────────────────────────────
function SystemPane({ data, which, buckets, executions }) {
  const sys = data?.[which];
  const title = which === 'gift' ? 'Gift' : 'Trade';
  return (
    <Stack spacing={3}>
      <SystemHealthCard
        title={`${title} system health`}
        subtitle={which === 'gift'
          ? 'AutoGiftEngine across Fill Missing, Shinedust, and Specific Card Sharing'
          : 'Core trade engine + settlement verification + boot-recovery gate'}
        icon={which === 'gift' ? HeartIcon : TreeIcon}
        data={sys}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Failure clusters</Typography>
            <Typography variant="caption" color="text.secondary">
              Top-5 failure reasons in {data?.windowLabel}. Grouped by canonical bucket so a regression is one bar, not 50 rows.
            </Typography>
            <Box sx={{ height: 260, mt: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets || []} layout="vertical" margin={{ left: 40, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                  <RTooltip />
                  <Bar dataKey="count" fill={which === 'gift' ? '#7C8AFF' : '#22c55e'} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Totals ({data?.windowLabel})</Typography>
            <Box sx={{ mt: 1.5 }}>
              {Object.entries(sys?.totals || {}).map(([k, v]) => (
                <Stack key={k} direction="row" justifyContent="space-between" sx={{ py: 0.5, borderBottom: '1px dashed', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">{k}</Typography>
                  <Typography variant="caption" fontWeight={600}>{v}</Typography>
                </Stack>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Recent {title.toLowerCase()} executions</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Last 20 filtered to {title}. Truth column exposes real outcome, not just status.
        </Typography>
        <ExecutionTable rows={executions.slice(0, 20)} />
      </Paper>
    </Stack>
  );
}

// ── Incidents pane ────────────────────────────────────────────────
function IncidentsPane({ incidents }) {
  const navigate = useNavigate();
  if (incidents.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <OkIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
        <Typography variant="h6">No open integrity incidents</Typography>
        <Typography variant="caption" color="text.secondary">All threshold-derived checks are within bounds for the current window.</Typography>
      </Paper>
    );
  }
  return (
    <Stack spacing={2}>
      {incidents.map(inc => {
        // Phase 4A Context Navigation — compute contextual CTA per card.
        const cta = ctaForIncident(inc);
        return (
          <Paper key={inc.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Chip label={inc.system} size="small" color={inc.system === 'Gift' ? 'primary' : 'success'} variant="outlined" />
                  <Chip label={(inc.severity || 'low').toUpperCase()} size="small" color={SEVERITY_COLOR[inc.severity] || 'default'} />
                  <Chip label={inc.status} size="small" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">{inc.id}</Typography>
                </Stack>
                <Typography variant="subtitle2" fontWeight={600}>{inc.title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {inc.signal}
                </Typography>
                {inc.owner && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontFamily: 'monospace' }}>
                    owner: {inc.owner}
                  </Typography>
                )}
              </Box>
              {/*
                Phase 4A Context Navigation — secondary action only
                (ghost button). No new route; linked page is always one
                that already exists (CTA_ALLOWED_ROUTES). Silent when
                no clear destination applies.
              */}
              {cta && (
                <Button
                  size="small"
                  variant="text"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigate(cta.to)}
                  sx={{ flexShrink: 0, textTransform: 'none', fontSize: '0.75rem' }}
                >
                  {cta.label}
                </Button>
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

// ── Execution rows table (reused across tabs) ─────────────────────
function ExecutionTable({ rows }) {
  const navigate = useNavigate();
  if (!rows || rows.length === 0) {
    // 2026-04-20 Phase 6A — friendly empty state (icon + hint) in
    // place of the bare caption that was there before.
    return (
      <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
        <OkIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2">No executions in the selected window</Typography>
        <Typography variant="caption" color="text.secondary">
          Adjust the window (top-right) or the system / search filters to see more.
        </Typography>
      </Box>
    );
  }
  // 2026-04-20 Phase 6A — responsive column hiding. The 9-column
  // layout overflows on narrow admin screens; hide the two
  // lowest-signal columns (Stage + Age) below md. Subject / Result /
  // Truth / Reason (the ones operators scan) stay visible everywhere.
  const HIDE_ON_NARROW = { display: { xs: 'none', md: 'table-cell' } };
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>System</TableCell>
            <TableCell>Flow</TableCell>
            <TableCell>Subject</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Truth</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell sx={HIDE_ON_NARROW}>Age</TableCell>
            {/*
              Phase 4A Context Navigation — icon-button column at the
              far right that opens the row's contextually-best existing
              page. Pure link, no backend action.
            */}
            <TableCell align="right" sx={{ width: 44 }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{r.id}</TableCell>
              <TableCell>
                <Chip label={r.system} size="small" color={r.system === 'Gift' ? 'primary' : 'success'} variant="outlined" />
              </TableCell>
              <TableCell>{r.flow}</TableCell>
              <TableCell>
                {/*
                  2026-04-20 — show human-readable subjectName (first
                  available of web_users.username / discord_username /
                  "User {id}") with raw ID + card context as secondary.
                  Falls back to the old `subject` string if an older
                  cached payload is still in flight.
                */}
                <Stack direction="column" spacing={0} sx={{ minWidth: 0 }}>
                  <Tooltip title={r.subjectId != null ? `ID: ${r.subjectId}` : (r.subject || '')}>
                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.25 }}>
                      {r.subjectName || r.subject}
                    </Typography>
                  </Tooltip>
                  {(r.subjectId != null || r.cardName) && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', lineHeight: 1.1 }}>
                      {r.subjectId != null ? `ID: ${r.subjectId}` : ''}
                      {r.subjectId != null && r.cardName ? ' · ' : ''}
                      {r.cardName || ''}
                    </Typography>
                  )}
                </Stack>
              </TableCell>
              <TableCell>
                <Chip
                  label={r.result}
                  size="small"
                  color={
                    r.result === 'completed'    ? 'success'
                  : r.result === 'failed'       ? 'error'
                  : r.result === 'skipped'      ? 'default'
                  : r.result === 'cancelled'    ? 'default'
                  : r.result === 'trade_stuck_finalization' ? 'warning'
                  : 'info'
                  }
                />
              </TableCell>
              <TableCell>
                <Chip label={r.truth} size="small" color={TRUTH_COLOR[r.truth] || 'default'} variant="outlined" />
              </TableCell>
              <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Tooltip title={r.reason || ''}><span>{r.reason || ''}</span></Tooltip>
              </TableCell>
              <TableCell sx={{ ...HIDE_ON_NARROW, whiteSpace: 'nowrap' }}>{fmtAge(r.ageMs)}</TableCell>
              <TableCell align="right" sx={{ pl: 0, pr: 1 }}>
                {(() => {
                  const cta = ctaForExecution(r);
                  if (!cta) return null;
                  return (
                    <Tooltip title={cta.label}>
                      <IconButton
                        size="small"
                        onClick={() => navigate(cta.to)}
                        sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                        aria-label={cta.label}
                      >
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  );
                })()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
