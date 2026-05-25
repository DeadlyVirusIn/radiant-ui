/**
 * AdminFleetHealth — Phase 5 landing + Phase 7/8/9 polish.
 *
 *  Phase 5  — 6 operational tiles.
 *  Phase 7  — in-app alert strip (deterministic, persistent `since`).
 *  Phase 8  — compact sparkline per tile (from /fleet-summary history).
 *  Phase 9  — deterministic insight list (max 3, non-overlapping with alerts).
 *  Phase 10 — mobile tile spacing + stacked alert/insight rendering.
 *
 * Auto-refresh every 30s (paused when the tab is hidden). Alerts use
 * the previous render's alert list to preserve `firstSeenAt` across
 * refreshes — prevents flicker.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, IconButton, Tooltip,
  Alert, CircularProgress, Button, useTheme, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Accordion, AccordionSummary, AccordionDetails,
  LinearProgress, Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as BackIcon,
  MonitorHeart as FleetIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as HealthyIcon,
  Warning as DegradedIcon,
  Error as CriticalIcon,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import StatusDot from '../components/admin/StatusDot';
import Sparkline, { trendDirection } from '../components/admin/Sparkline';
import AlertStrip from '../components/admin/AlertStrip';
import InsightList from '../components/admin/InsightList';
import RecoveryStrip from '../components/admin/RecoveryStrip';
import ActionReviewPanel from '../components/admin/ActionReviewPanel';
import RebalanceRecommendationStrip from '../components/admin/RebalanceRecommendationStrip';
import NowNextRiskRail from '../components/admin/NowNextRiskRail';
import useRecoveryStatus from '../hooks/useRecoveryStatus';
import { formatRecoveryLabels, mergeHealthVerdicts } from '../components/hunt/huntConstants';
import { deriveAlerts } from '../utils/fleetAlerts';
import { deriveInsights } from '../utils/fleetInsights';
import { FadeIn } from '../components/Animations';
// Phase 4 (Apr 2026) — Source attribution + freshness on Account Pool panel
import FreshnessIndicator from '../components/FreshnessIndicator';

const TILE_ORDER = [
  'activeHunters', 'idleHunters', 'errorHunters',
  'recentGodPacks', 'paidActive', 'flags',
];

// Phase 4 (Apr 2026) — humanize internal tile keys when the backend
// fails to provide a tile.title. Prevents raw "activeHunters" from
// leaking into the UI on partial fetch failure.
const TILE_LABEL_FALLBACK = {
  activeHunters:  'Active hunters',
  idleHunters:    'Idle hunters',
  errorHunters:   'Hunters with errors',
  recentGodPacks: 'God packs (24h)',
  paidActive:     'Paid subscribers',
  flags:          'Attention items',
};

export default function AdminFleetHealth({ user }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  // Persist alerts across refreshes so `firstSeenAt` is carried over.
  const alertsRef = useRef([]);
  const [alerts, setAlerts] = useState([]);
  const [insights, setInsights] = useState([]);
  const [now, setNow] = useState(Date.now());

  // 2026-04-24 — Account pool truth-table merged into Fleet Status. Same
  // refresh button drives both. Endpoint runs raw SQL on accounts (no
  // cached views) and surfaces is_banned↔account_status drift + bans
  // bypassing the Phase 39 audit channel.
  const [accountPool, setAccountPool] = useState(null);
  const [accountPoolError, setAccountPoolError] = useState(null);
  // C6 — recovery state drives the NOW / NEXT / RISK rail. Admin-only
  // page; hook owns its own 30s polling to match FleetHealth cadence.
  // Called unconditionally BEFORE any early return to respect hooks rules.
  const { recovery: fleetRecovery } = useRecoveryStatus({ enabled: user?.isAdmin });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccountPoolError(null);
    try {
      const [fleetRes, poolRes] = await Promise.all([
        fetch('/api/admin/fleet-summary',  { credentials: 'include' }),
        fetch('/api/admin/account-pool',   { credentials: 'include' }),
      ]);
      if (!fleetRes.ok) throw new Error(`fleet-summary HTTP ${fleetRes.status}`);
      const data = await fleetRes.json();
      setSummary(data);
      const stalenessMs = data.generatedAt
        ? Math.max(0, Date.now() - new Date(data.generatedAt).getTime())
        : 0;
      const nextAlerts = deriveAlerts({
        tiles: data.tiles,
        previousAlerts: alertsRef.current,
        stalenessMs,
      });
      alertsRef.current = nextAlerts;
      setAlerts(nextAlerts);
      setInsights(deriveInsights({
        tiles: data.tiles,
        alerts: nextAlerts,
        rebalanceHeadline: data.rebalanceHeadline,
      }));
      // Account pool is a non-fatal addition — surface its own error
      // inline; never block the fleet view if it fails.
      if (poolRes.ok) setAccountPool(await poolRes.json());
      else setAccountPoolError(`account-pool HTTP ${poolRes.status}`);
    } catch (err) {
      setError(err?.message || 'Failed to load fleet summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 30s auto-refresh, paused while tab is hidden.
  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => { if (!document.hidden) load(); schedule(); }, 30000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [load]);

  // Re-render `since` labels every 30s so "2m ago" keeps counting without
  // re-deriving alerts (which would reset their `firstSeenAt`).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!user?.isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Admin access required</Alert>
      </Box>
    );
  }

  const tiles = summary?.tiles || {};

  return (
    <FadeIn>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <IconButton size="small" onClick={() => navigate('/admin')} aria-label="Go back to admin">
            <BackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <PageHeader
              icon={<FleetIcon />}
              title="Fleet Health"
              subtitle="What needs attention right now"
              action={
                <Button size="small" variant="outlined"
                        startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
                        onClick={load} disabled={loading}>
                  Refresh
                </Button>
              }
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={
            <Button size="small" onClick={load}>Retry</Button>
          }>
            {error}
          </Alert>
        )}

        {/* C6 (2026-04-24) — NOW / NEXT / RISK rail synthesizes
            unified health + recovery state for admins. Pool-aware
            balance isn't exposed via /api/admin/fleet-summary, so
            that input is null here — rail correctly falls through to
            health/recovery signals without fabricating pool data. */}
        <NowNextRiskRail
          inputs={{
            unifiedVerdict: mergeHealthVerdicts(
              { tier: 'healthy', color: '#22C55E', label: 'Healthy', reason: 'All systems nominal' },
              fleetRecovery
            ),
            balanceStatus: null,
            recoveryLabels: formatRecoveryLabels(fleetRecovery),
            metrics: {
              currentLivePpm: Number(tiles?.activeHunters?.meta?.currentPpm || 0),
              unhealthyWorkers: Number(tiles?.errorHunters?.value || 0),
              totalWorkers: Number(tiles?.activeHunters?.value || 0) + Number(tiles?.idleHunters?.value || 0),
              errorRate: Number(tiles?.errorHunters?.meta?.errorRate || 0),
              errorThreshold: 0.03,
            },
          }}
        />

        {/* Phase 14 — rebalance awareness (recommended / blocked / applied) */}
        <RebalanceRecommendationStrip headline={summary?.rebalanceHeadline} />

        {/* Self-healing engine — dry-run / live-safe / assist controls + audit */}
        <RecoveryStrip />

        {/* Phase 25B — operator approval queue for medium-risk actions */}
        <ActionReviewPanel />

        {/* Phase 7 — active alerts (compact, stackable) */}
        <AlertStrip alerts={alerts} now={now} />

        {/* Phase 9 — operational narratives */}
        <InsightList insights={insights} />

        {/* Phase 5/8 — tiles + sparklines */}
        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
          {TILE_ORDER.map((key) => {
            const t = tiles[key];
            // Phase 4 — humanize fallback so raw key never leaks to UI.
            const tile = t ? { ...t, title: t.title || TILE_LABEL_FALLBACK[key] || key } : t;
            return (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <FleetTile
                  loading={loading && !tile}
                  tile={tile}
                  onClick={() => tile?.href && navigate(tile.href)}
                  theme={theme}
                />
              </Grid>
            );
          })}
        </Grid>

        {/* 2026-04-24 — Account Pool truth-table (raw SQL). Drill-down
            for "why isn't the fleet making packs": eligibility waterfall,
            is_banned↔account_status drift, audit-bypass detection. */}
        <AccountPoolPanel data={accountPool} error={accountPoolError} />

        {summary?.generatedAt && (
          <Typography variant="caption" color="text.secondary"
                      sx={{ display: 'block', mt: 2, textAlign: 'right' }}>
            Updated {new Date(summary.generatedAt).toLocaleTimeString()} · auto-refresh every 30s
          </Typography>
        )}
      </Box>
    </FadeIn>
  );
}

function FleetTile({ tile, loading, onClick, theme }) {
  if (loading || !tile) {
    return (
      <Paper elevation={0} sx={{
        p: 2.5, border: 1, borderColor: 'divider', borderRadius: 2,
        minHeight: 124, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  const bgAccent = {
    healthy: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error:   theme.palette.error.main,
  }[tile.status] || theme.palette.divider;

  const history = Array.isArray(tile.history) ? tile.history : [];
  const dir = trendDirection(history);
  const TrendIcon = dir === 'up'
    ? TrendingUpIcon
    : dir === 'down'
      ? TrendingDownIcon
      : TrendingFlatIcon;
  const trendColor = dir === 'flat'
    ? 'disabled'
    : (tile.status === 'error' ? 'error'
       : tile.status === 'warning' ? 'warning'
       : 'action');

  return (
    <Tooltip title={tile.hint || ''} arrow disableInteractive>
      <Paper
        elevation={0}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        sx={{
          p: { xs: 2, sm: 2.5 },
          border: 1, borderColor: 'divider', borderRadius: 2,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s ease, transform 0.1s ease',
          minHeight: { xs: 112, sm: 124 },
          '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: 4,
            bgcolor: bgAccent,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <StatusDot state={tile.status} size={10} label={tile.status} />
            <Typography variant="overline" color="text.secondary" noWrap>
              {tile.title}
            </Typography>
          </Box>
          <ArrowForwardIcon fontSize="small" sx={{ opacity: 0.4 }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 1, gap: 1 }}>
          <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            {typeof tile.value === 'number' ? tile.value.toLocaleString() : tile.value}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Sparkline
              values={history}
              state={tile.status}
              width={72}
              height={20}
              label={`${tile.title} trend`}
            />
            <TrendIcon fontSize="small" color={trendColor} aria-label={`trend ${dir}`} />
          </Box>
        </Box>

        {tile.hint && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {tile.hint}
          </Typography>
        )}
      </Paper>
    </Tooltip>
  );
}

// ── Account Pool truth-table panel ───────────────────────────────────
// Migrated from /admin/account-pool standalone page (2026-04-24). Lives
// here as a Fleet Status drill-down because admins land on Fleet first
// when "fleet not making packs" — the eligibility waterfall + truth
// mismatches answer that directly. Source endpoint runs raw SQL on the
// accounts table (no cached views).

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString();
}

function StatTile({ label, value, color, sub }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: color || 'text.primary', lineHeight: 1.2 }}>
        {fmtNum(value)}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

function AccountPoolPanel({ data, error }) {
  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 3 }}>
        Account pool truth-table unavailable: {error}
      </Alert>
    );
  }
  if (!data) return null;

  // ── Phase WP-FixG (Apr 2026) — mission-control redesign ────────
  // Decision-first layout: status bar → 4 KPI cards → collapsible
  // detail accordions. Backend untouched.

  // Risk signal aggregation
  const truthMismatchN = (data.truthMismatch?.isBannedButStatusNot || 0)
                       + (data.truthMismatch?.statusBannedButFlagNot || 0);
  const auditBypassN   = data.bansBypassingPhase39?.last24hWithoutAuditEvents || 0;
  const bans1h         = data.recentBans?.last1h  || 0;
  const bans24h        = data.recentBans?.last24h || 0;
  const retryDueN      = data.health?.retryDue    || 0;

  // System status compute (UI-only, no backend logic)
  let systemStatus, systemColor, SystemIcon;
  if (auditBypassN > 0 || truthMismatchN > 1000 || bans1h > 100) {
    systemStatus = 'Critical'; systemColor = 'error';   SystemIcon = CriticalIcon;
  } else if (truthMismatchN > 0 || bans24h > 100 || retryDueN > 50) {
    systemStatus = 'Degraded'; systemColor = 'warning'; SystemIcon = DegradedIcon;
  } else {
    systemStatus = 'Healthy';  systemColor = 'success'; SystemIcon = HealthyIcon;
  }

  // Topline numbers (legacy-only, mirror hunt eligibility)
  const op            = data.operational || {};
  const totalAcc      = op.total          || data.totalRows || 0;
  const eligibleNow   = op.eligibleNow    || 0;
  const validUsable   = op.validUsable    || 0;
  const cooldownN     = op.cooldown       || 0;
  const dailyCapHit   = op.dailyCapHit    || 0;
  const bannedLegacy  = op.bannedLegacy   || 0;
  const invalidLogin  = op.invalidLogin   || 0;
  const utilization   = validUsable > 0 ? +((eligibleNow / validUsable) * 100).toFixed(1) : 0;
  const pressure      = validUsable > 0 ? +(((cooldownN + dailyCapHit) / validUsable) * 100).toFixed(1) : 0;

  // Coverage
  const covered       = data.coverage?.evaluated   || 0;
  const coverPct      = data.coverage?.pctEvaluated || 0;

  // Phase 40 health detail (post-login capability)
  const softBanned    = data.health?.softBanned     || 0;
  const permBanned    = data.health?.permanentBanned || 0;
  const degradedH     = data.health?.degraded       || 0;
  const errorVol48h   = Array.isArray(data.health?.topErrors)
    ? data.health.topErrors.reduce((s, e) => s + (e.count || 0), 0)
    : 0;
  // Authentication failures = invalid_login (legacy) — credentials rejected.
  const authFailures  = invalidLogin;
  const totalProblems = softBanned + permBanned + authFailures;

  // ── Phase WP-FixG.1 — interpretation labels ──
  // Pressure: how much of usable pool is occupied (cooldown + cap).
  let pressureLabel, pressureColor;
  if (pressure < 40)      { pressureLabel = 'LOW';      pressureColor = 'success'; }
  else if (pressure < 80) { pressureLabel = 'MODERATE'; pressureColor = 'warning'; }
  else                    { pressureLabel = 'HIGH';     pressureColor = 'error';   }

  // Health: composite of soft_banned + perm_banned + auth failures + error volume.
  let healthLabel, healthColor;
  if (totalProblems === 0 && errorVol48h === 0) {
    healthLabel = 'STABLE';   healthColor = 'success';
  } else if (softBanned > 50 || errorVol48h > 200 || authFailures > 50) {
    healthLabel = 'DEGRADED'; healthColor = 'error';
  } else {
    healthLabel = 'WARNING';  healthColor = 'warning';
  }

  // Coverage: binary low-visibility flag at <1%, partial up to 50%, full above.
  let coverageLabel, coverageColor;
  if (coverPct < 1)        { coverageLabel = 'LOW VISIBILITY'; coverageColor = 'warning'; }
  else if (coverPct < 50)  { coverageLabel = 'PARTIAL';        coverageColor = 'info';    }
  else                     { coverageLabel = 'FULL';           coverageColor = 'success'; }

  // ── Trend signals (use what data we have) ──
  // Ban velocity vs 7-day daily average. >2x avg ⇒ trending up (bad).
  const bans7d         = data.recentBans?.last7d || 0;
  const dailyAvgBans   = bans7d > 0 ? bans7d / 7 : 0;
  let banTrend         = null, banTrendDir = null, banTrendTip = null;
  if (bans7d >= 7) {  // need ~a week of data to make the trend meaningful
    if (bans24h > dailyAvgBans * 2) {
      banTrend = `↑ ${(bans24h / Math.max(dailyAvgBans, 1)).toFixed(1)}x avg`;
      banTrendDir = 'up';   // up is BAD for bans
      banTrendTip = `Bans last 24h (${fmtNum(bans24h)}) vs 7-day daily avg (${fmtNum(Math.round(dailyAvgBans))})`;
    } else if (bans24h < dailyAvgBans * 0.5) {
      banTrend = `↓ ${(bans24h / Math.max(dailyAvgBans, 1)).toFixed(1)}x avg`;
      banTrendDir = 'down'; // down is GOOD for bans (down arrow + green here)
      banTrendTip = `Bans last 24h below 7-day average — improving`;
    } else {
      banTrend = 'flat';
      banTrendDir = 'flat';
      banTrendTip = `Bans steady vs 7-day average`;
    }
  }
  // Eligible NOW + Pressure historical data: NOT available — ring buffer
  // is per-process and not exposed here. Trends omitted by design.

  // ── Phase WP-FixG.2 — system-context aggregate (sum partitions) ──
  const huntedLast1h  = (data.partitions || []).reduce((s, p) => s + (p.huntedLast1h  || 0), 0);
  const huntedLast24h = (data.partitions || []).reduce((s, p) => s + (p.huntedLast24h || 0), 0);
  const partitionN    = (data.partitions || []).length;

  // Health normalization — % of total pool
  const healthPctOfTotal = totalAcc > 0 ? ((totalProblems / totalAcc) * 100).toFixed(2) : '0.00';

  // ── Phase WP-FixG.2 — recommended actions (lightweight, rule-based) ──
  const actions = [];
  if (pressureLabel === 'HIGH') actions.push('Pressure high — wait for cooldown or expand bot pool');
  if (softBanned > 50)          actions.push('Many soft bans — review proxy/IP rotation');
  if (coverPct < 1)             actions.push('Run validator to improve visibility');
  if (banTrendDir === 'up')     actions.push('Ban velocity surging — investigate recent changes');
  if (errorVol48h > 200)        actions.push('High error volume — check health-check logs');

  return (
    <Box sx={{ mt: 3 }}>
      {/* Phase 4 (Apr 2026) — Source attribution + freshness pill so
          operators see at a glance which authoritative endpoint these
          numbers come from. Account Pool is the SINGLE source of truth
          for totalRows / banned / valid / eligibleNow / recentBans24h.
          Any future Fleet endpoint that reports overlapping counts
          MUST consume the same accountPool helpers — see
          lib/fleetTruthAlignment.js for the drift-detector contract. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Source: <strong>Account Pool</strong> (authoritative)
        </Typography>
        {data.generatedAt && (
          <FreshnessIndicator lastUpdatedAt={data.generatedAt} variant="detail" />
        )}
      </Box>
      {/* Phase 4.7 — explain the large unevaluated bucket up-front so
          operators don't read it as "system broken". The Phase 39
          incremental classifier intentionally leaves accounts unscored
          until they become candidates for hunt/trade — NULL ≠ error. */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1.5, fontSize: '0.72rem' }}
      >
        Note: <strong>NULL account status</strong> = not yet classified by the
        incremental scanner. This is normal — the classifier scores accounts
        on-demand rather than scanning the full pool every cycle.
      </Typography>

      {/* ─── TOP STATUS BAR ────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        p: 2, mb: 2, border: 1, borderColor: 'divider', borderRadius: 1.5,
        borderLeft: 4, borderLeftColor: `${systemColor}.main`,
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
          {/* Status pill */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SystemIcon sx={{ color: `${systemColor}.main`, fontSize: 28 }} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                SYSTEM
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: `${systemColor}.main`, lineHeight: 1.2 }}>
                {systemStatus}
              </Typography>
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Eligible NOW */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
              ELIGIBLE NOW
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {fmtNum(eligibleNow)}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Utilization */}
          <Box sx={{ minWidth: 140, flexGrow: 1, maxWidth: 240 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
              UTILIZATION
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, minWidth: 56 }}>
                {utilization}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, utilization)}
                color={utilization > 80 ? 'success' : utilization > 30 ? 'info' : 'warning'}
                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
              />
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Phase WP-FixG.1 — always-on signal chips. Replaces the
              "No active risks" placeholder with meaningful operational
              signals that surface even when nothing is acutely wrong:
              pressure level, coverage visibility, soft-banned volume,
              ban velocity. Risk chips (mismatch / audit / etc) layered
              on top when present. */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {/* Always show: pressure level */}
            <Tooltip title={`Pool pressure: cooldown + cap hit = ${pressure}% of valid usable`} arrow>
              <Chip
                size="small"
                color={pressureColor}
                variant={pressureColor === 'success' ? 'outlined' : 'filled'}
                label={`Pressure: ${pressureLabel}`}
              />
            </Tooltip>
            {/* Always show: coverage label */}
            <Tooltip title={`Validation coverage: ${coverPct}% (${fmtNum(covered)} of ${fmtNum(totalAcc)})`} arrow>
              <Chip
                size="small"
                color={coverageColor}
                variant={coverageColor === 'success' ? 'outlined' : 'filled'}
                label={`Coverage: ${coverageLabel}`}
              />
            </Tooltip>
            {/* Always show when present: soft-banned volume */}
            {softBanned > 0 && (
              <Tooltip title={`${fmtNum(softBanned)} accounts in soft-ban quarantine. Retry due: ${fmtNum(retryDueN)}`} arrow>
                <Chip size="small" color={softBanned > 50 ? 'error' : 'warning'} label={`Soft-banned: ${fmtNum(softBanned)}`} />
              </Tooltip>
            )}
            {/* Ban-velocity trend signal */}
            {banTrendDir === 'up' && (
              <Tooltip title={banTrendTip} arrow>
                <Chip size="small" color="error" icon={<TrendingUpIcon sx={{ fontSize: 14 }} />} label={`Bans surging ${banTrend}`} />
              </Tooltip>
            )}
            {/* Risk chips (existing — only when non-zero) */}
            {truthMismatchN > 0 && (
              <Tooltip
                title={`Ban flag and account-status field disagree on ${fmtNum(truthMismatchN)} accounts. Indicates a data-integrity drift between the legacy ban column and the Phase 39 incremental classifier.`}
                arrow
              >
                <Chip size="small" color="warning" label={`Mismatch: ${fmtNum(truthMismatchN)}`} />
              </Tooltip>
            )}
            {auditBypassN > 0 && (
              <Tooltip title={`${fmtNum(auditBypassN)} bans in last 24h written without an audit-trail entry. Investigate before relying on these numbers.`} arrow>
                <Chip size="small" color="error" label={`Audit bypass: ${fmtNum(auditBypassN)}`} />
              </Tooltip>
            )}
            {bans1h > 0 && (
              <Tooltip title={`Bans recorded in last 1 hour`} arrow>
                <Chip size="small" color="error" variant="outlined" label={`Bans 1h: ${fmtNum(bans1h)}`} />
              </Tooltip>
            )}
            {retryDueN > 0 && (
              <Tooltip title={`Soft-banned accounts whose retry window has passed`} arrow>
                <Chip size="small" color="info" label={`Retry due: ${fmtNum(retryDueN)}`} />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Phase WP-FixG.2 — system-context line + recommended actions.
            Single bottom row inside the same status Paper to keep
            visual hierarchy compact. */}
        <Divider sx={{ mt: 2, mb: 1.5 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, rowGap: 0.5 }}>
          {/* System context */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              CONTEXT
            </Typography>
            <Typography variant="caption" color="text.primary">
              Hunted 1h: <strong>{fmtNum(huntedLast1h)}</strong>
              {' · '}24h: <strong>{fmtNum(huntedLast24h)}</strong>
              {' · '}{partitionN} partitions
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Recommended actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', maxWidth: '100%' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              RECOMMENDED
            </Typography>
            {actions.length === 0 ? (
              <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                ✓ All systems nominal — no actions recommended
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {actions.map((a, i) => (
                  <Chip key={i} size="small" variant="outlined" color="warning"
                    label={a} sx={{ height: 22, fontSize: '0.7rem' }} />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      {/* ─── KPI CARDS ─────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* CAPACITY */}
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="CAPACITY"
            big={fmtNum(totalAcc)}
            color="text.primary"
            sub={`Valid usable: ${fmtNum(validUsable)}`}
            tooltip="Total accounts in pool · Valid usable = active accounts (excluding banned)"
          />
        </Grid>
        {/* PRESSURE — Phase WP-FixG.2: clearer cooldown/cap labels */}
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="PRESSURE"
            big={`${pressure}%`}
            color={pressure > 80 ? 'warning.main' : 'text.primary'}
            interpretation={pressureLabel}
            interpretationColor={pressureColor}
            sub={`In cooldown 24h: ${fmtNum(cooldownN)} · Cap hit today: ${fmtNum(dailyCapHit)}`}
            tooltip={
              `Pressure = (cooldown + dailyCapHit) / validUsable.\n` +
              `• Cooldown 24h: hunted within last 24h, must wait.\n` +
              `• Cap today: opened ≥2 packs since pack_day_reset_at — capped until next reset.\n` +
              `Counts MAY OVERLAP (an account can be both). Eligible NOW excludes both.`
            }
            progress={pressure}
            progressColor={pressureColor}
          />
        </Grid>
        {/* HEALTH — Phase WP-FixG.2: % of total pool normalization */}
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="HEALTH"
            big={`${fmtNum(totalProblems)} (${healthPctOfTotal}%)`}
            color={healthLabel === 'STABLE' ? 'success.main' : healthLabel === 'WARNING' ? 'warning.main' : 'error.main'}
            interpretation={healthLabel}
            interpretationColor={healthColor}
            sub={`Soft ${fmtNum(softBanned)} · Errors 48h ${fmtNum(errorVol48h)} · Auth fail ${fmtNum(authFailures)}`}
            tooltip="Composite: soft-banned + permanent-banned + invalid-login. Big number shows count + % of total accounts. Sub-line: soft-ban count, total Phase 40 health-error events in last 48h, and authentication-failed accounts (login rejected by game server)."
            trend={banTrend}
            trendDir={banTrendDir}
            trendTip={banTrendTip}
          />
        </Grid>
        {/* COVERAGE — Phase WP-FixG.2: micro-hint to the validator */}
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="COVERAGE"
            big={`${coverPct}%`}
            color={coverPct < 1 ? 'text.secondary' : 'info.main'}
            interpretation={coverageLabel}
            interpretationColor={coverageColor}
            sub={
              <>
                Evaluated: {fmtNum(covered)} / {fmtNum(totalAcc)}
                {coverPct < 50 && (
                  <Box component="span" sx={{ display: 'block', color: 'warning.main', fontWeight: 600 }}>
                    Run validator to improve visibility
                  </Box>
                )}
              </>
            }
            tooltip="Validation coverage. Low is expected — validator runs incrementally."
            progress={coverPct}
            progressColor={coverageColor}
          />
        </Grid>
      </Grid>

      {/* ─── COLLAPSIBLE DETAILS ───────────────────────────────── */}

      {/* Per-partition table */}
      <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, mb: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Per-partition (C1–C4)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Phase 4.7 — wrap wide partition table so 375px viewports
              scroll the table horizontally instead of overflowing the
              page. Desktop unaffected (table is narrower than container). */}
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Partition</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">94+ packs</TableCell>
                  <TableCell align="right">Valid 94+</TableCell>
                  <TableCell align="right">Banned</TableCell>
                  <TableCell align="right">Past cooldown</TableCell>
                  <TableCell align="right">Daily-cap hit</TableCell>
                  <TableCell align="right">Eligible NOW</TableCell>
                  <TableCell align="right">Hunted 1h</TableCell>
                  <TableCell align="right">Hunted 24h</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.partitions || []).map(p => (
                  <TableRow key={p.partition}>
                    <TableCell><Chip size="small" label={p.containerLabel} /></TableCell>
                    <TableCell align="right">{fmtNum(p.total)}</TableCell>
                    <TableCell align="right">{fmtNum(p.has94plus)}</TableCell>
                    <TableCell align="right">{fmtNum(p.valid94plus)}</TableCell>
                    <TableCell align="right" sx={{ color: 'warning.main' }}>{fmtNum(p.banned)}</TableCell>
                    <TableCell align="right">{fmtNum(p.pastCooldown)}</TableCell>
                    <TableCell align="right">{fmtNum(p.dailyCapHit)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: p.eligibleNow > 0 ? 'success.main' : 'error.main' }}>
                      {fmtNum(p.eligibleNow)}
                    </TableCell>
                    <TableCell align="right">{fmtNum(p.huntedLast1h)}</TableCell>
                    <TableCell align="right">{fmtNum(p.huntedLast24h)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* Evaluated account status (3-tier) */}
      <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, mb: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Evaluated status
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5, alignSelf: 'center' }}>
            ({fmtNum(covered)} of {fmtNum(totalAcc)} · {coverPct}%)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {(() => {
            const validN     = Number(data.status?.valid || 0);
            const tempN      = Number(data.status?.tempUnreachable || 0);
            const unknownN   = Number(data.status?.unknown || 0);
            const invalidN   = Number(data.status?.invalidLogin || 0);
            const bannedN    = Number(data.status?.banned || 0);
            const evaluated  = validN + tempN + unknownN + invalidN + bannedN;
            const pe = (n) => evaluated > 0 ? ((n / evaluated) * 100).toFixed(1) : '0.0';
            if (evaluated === 0) {
              return <Typography variant="body2" color="text.secondary">No accounts evaluated yet.</Typography>;
            }
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip size="small" color="success" variant="outlined" label={`Valid ${fmtNum(validN)} (${pe(validN)}%)`} />
                <Chip size="small" color="warning" variant="outlined" label={`Temp unreachable ${fmtNum(tempN)} (${pe(tempN)}%)`} />
                <Chip size="small" color="warning" variant="outlined" label={`Unknown ${fmtNum(unknownN)} (${pe(unknownN)}%)`} />
                <Chip size="small" color="error"   variant="outlined" label={`Invalid ${fmtNum(invalidN)} (${pe(invalidN)}%)`} />
                <Chip size="small" color="error"   variant="outlined" label={`Banned ${fmtNum(bannedN)} (${pe(bannedN)}%)`} />
              </Box>
            );
          })()}
        </AccordionDetails>
      </Accordion>

      {/* Health status (Phase 40, name scrubbed) */}
      {data.health && (
        <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, mb: 1, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Post-login health
            </Typography>
            {retryDueN > 0 && (
              <Chip size="small" color="info" label={`retry due ${fmtNum(retryDueN)}`} sx={{ ml: 1.5, height: 20 }} />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: data.health.topErrors?.length ? 1.5 : 0 }}>
              <Chip color="success" size="small" label={`healthy ${fmtNum(data.health.healthy)}`} />
              <Chip color="warning" size="small" label={`degraded ${fmtNum(data.health.degraded)}`} />
              <Chip color="error"   size="small" label={`soft-banned ${fmtNum(data.health.softBanned)}`} />
              <Chip color="error"   variant="outlined" size="small" label={`permanent-banned ${fmtNum(data.health.permanentBanned)}`} />
              <Chip                 size="small" label={`restricted ${fmtNum(data.health.restricted)}`} />
              <Chip variant="outlined" size="small" label={`unknown ${fmtNum(data.health.unknown)}`} />
            </Box>
            {Array.isArray(data.health.topErrors) && data.health.topErrors.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Top errors (48h):
                </Typography>
                {data.health.topErrors.map(e => (
                  <Chip key={e.code} variant="outlined" size="small" label={`${e.code}: ${fmtNum(e.count)}`} />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Ban chronology */}
      <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, mb: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Ban chronology
          </Typography>
          {bans24h > 0 && (
            <Chip size="small" color="warning" label={`${fmtNum(bans24h)} in 24h`} sx={{ ml: 1.5, height: 20 }} />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip color="error"   size="small" label={`1h ${fmtNum(bans1h)}`} />
            <Chip color="warning" size="small" label={`24h ${fmtNum(bans24h)}`} />
            <Chip                 size="small" label={`7d ${fmtNum(data.recentBans?.last7d)}`} />
            <Chip variant="outlined" size="small" label={`No timestamp ${fmtNum(data.recentBans?.noTimestamp)}`} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Oldest: {data.recentBans?.oldest || '—'} · Newest: {data.recentBans?.newest || '—'}
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

// Reusable KPI card component
// Phase WP-FixG.1 — interpretation badge + trend arrow on KPI card.
function KpiCard({ label, big, sub, color, tooltip, progress, progressColor, interpretation, interpretationColor, trend, trendDir, trendTip }) {
  const card = (
    <Paper elevation={0} sx={{
      p: 2, height: '100%', border: 1, borderColor: 'divider', borderRadius: 1.5,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 130,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1, letterSpacing: 1 }}>
          {label}
        </Typography>
        {trend != null && (
          <Tooltip title={trendTip || trend} arrow>
            <Chip
              size="small"
              icon={trendDir === 'up' ? <TrendingUpIcon sx={{ fontSize: 14 }} />
                  : trendDir === 'down' ? <TrendingDownIcon sx={{ fontSize: 14 }} />
                  : <TrendingFlatIcon sx={{ fontSize: 14 }} />}
              label={trend}
              sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-icon': { ml: 0.25, mr: -0.5 } }}
              color={trendDir === 'up' ? 'success' : trendDir === 'down' ? 'error' : 'default'}
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>
      <Box>
        <Typography variant="h3" sx={{ fontWeight: 700, color: color || 'text.primary', lineHeight: 1.1, my: 0.5 }}>
          {big}
        </Typography>
        {interpretation && (
          <Typography variant="caption" sx={{
            fontWeight: 700, letterSpacing: 0.8, fontSize: '0.65rem',
            color: `${interpretationColor || 'text.secondary'}.main`,
          }}>
            {interpretation}
          </Typography>
        )}
      </Box>
      {progress != null && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, progress)}
          color={progressColor || 'primary'}
          sx={{ height: 4, borderRadius: 2, my: 0.5 }}
        />
      )}
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
  return tooltip ? <Tooltip title={tooltip} arrow>{card}</Tooltip> : card;
}

