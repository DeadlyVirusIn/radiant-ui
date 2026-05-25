/**
 * Capacity Verdict — /admin/capacity
 *
 * Shows whether the host has headroom to spin up Hunt-5 (a planned
 * 5th reroll-hunt container with 30 workers and 60+ proxy ports).
 *
 * Verdict tiers:
 *   GO              — green:  spin up Hunt-5
 *   CONDITIONAL_GO  — yellow: address reasons first
 *   NO_GO           — red:    do not spin up Hunt-5
 *
 * All metrics show current + 1m/5m/15m averages + 15m peak + a trend
 * chip (SPIKING / STABLE_HIGH / NORMAL / COOLING). Verdict is computed
 * from rolling avg_5m, NOT current — transient spikes never flip the
 * verdict.
 *
 * Auto-refresh every 15s; manual refresh button forces an immediate
 * fetch. Last-updated timestamp shown in the header.
 *
 * Endpoint is read-only — no buttons mutate state. All container
 * lifecycle remains operator-driven via SSH/docker compose.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Button, Chip, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Divider, useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as GoIcon,
  Warning as ConditionalIcon,
  Error as NoGoIcon,
  TrendingUp as SpikingIcon,
  TrendingFlat as NormalIcon,
  TrendingDown as CoolingIcon,
  HorizontalRule as StableHighIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { fetchWithAuth } from '../../services/api';

const REFRESH_INTERVAL_MS = 15000;

// Tier display labels — title-case the verdict enum so the hero card
// reads cleanly ("Conditional Go" not "CONDITIONAL_GO").
const TIER_META = {
  GO: {
    color: 'success.main', icon: <GoIcon fontSize="large" />,
    label: 'Go',
    blurb: 'System has headroom — Hunt-5 spinup approved',
  },
  CONDITIONAL_GO: {
    color: 'warning.main', icon: <ConditionalIcon fontSize="large" />,
    label: 'Conditional Go',
    blurb: 'Address reasons below before spinning up Hunt-5',
  },
  NO_GO: {
    color: 'error.main', icon: <NoGoIcon fontSize="large" />,
    label: 'No-Go',
    blurb: 'System under pressure — do NOT spin up Hunt-5',
  },
};

const TREND_META = {
  SPIKING:     { color: 'error',   icon: <SpikingIcon fontSize="small" />,    label: 'Spiking' },
  STABLE_HIGH: { color: 'warning', icon: <StableHighIcon fontSize="small" />, label: 'Stable High' },
  COOLING:     { color: 'info',    icon: <CoolingIcon fontSize="small" />,    label: 'Cooling' },
  NORMAL:      { color: 'default', icon: <NormalIcon fontSize="small" />,     label: 'Normal' },
};

function TrendChip({ trend }) {
  const meta = TREND_META[trend] || TREND_META.NORMAL;
  return <Chip size="small" color={meta.color} icon={meta.icon} label={meta.label} />;
}

function fmt(n, suffix = '') {
  if (n == null) return '—';
  return `${n}${suffix}`;
}

/**
 * Format a disk write throughput sample (in KB/s) for display.
 *   < 1024 KB/s  → "847 KB/s"
 *   ≥ 1024 KB/s  → "12.3 MB/s"
 *   ≥ 1024 MB/s  → "4.7 GB/s"
 * Includes thousands separators on the KB tier so 348,950 KB/s
 * doesn't read as 348950 KB/s.
 */
function formatWriteRate(kbs) {
  if (kbs == null || !Number.isFinite(kbs)) return '—';
  if (kbs >= 1024 * 1024) return `${(kbs / 1024 / 1024).toFixed(1)} GB/s`;
  if (kbs >= 1024)        return `${(kbs / 1024).toFixed(1)} MB/s`;
  return `${Math.round(kbs).toLocaleString()} KB/s`;
}

/**
 * Bottleneck-card metric formatter. The k/v pairs in b.metrics carry
 * heterogeneous units (% for cpu/iowait/used, KB/s for write_kbs) so
 * the renderer must dispatch per-key, not blindly append "%".
 */
function formatBottleneckMetric(key, value, fieldName = 'current') {
  if (value == null) return '—';
  if (key === 'write_kbs') {
    return formatWriteRate(typeof value === 'object' ? value[fieldName] : value);
  }
  // Default: percent-typed metric
  return fmt(typeof value === 'object' ? value[fieldName] : value, '%');
}

/**
 * Metric card with current + 1m/5m/15m/peak + trend.
 * Trend payload comes straight from rollingMetricsBuffer.summarize().
 *
 * `unavailableNote` overrides the value rendering with an explanation
 * — used by the disk metric when running inside a container without a
 * /host bind-mount (the value is genuinely unknown, not 0).
 *
 * `formatter` overrides the default `${n}${suffix}` rendering — used
 * by Disk Write to show "348,950 KB/s" / "12.3 MB/s" instead of a
 * naive percent-style number.
 */
function MetricCard({ title, payload, suffix = '%', unavailableNote, formatter }) {
  const renderValue = (n) => formatter ? formatter(n) : fmt(n, suffix);
  if (unavailableNote) {
    return (
      <Paper sx={{ p: 2, height: '100%', borderLeft: 4, borderColor: 'warning.main' }}>
        <Typography variant="overline" color="text.secondary">{title}</Typography>
        <Typography variant="h6" sx={{ mt: 1 }}>Unavailable</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {unavailableNote}
        </Typography>
      </Paper>
    );
  }
  if (!payload) {
    return (
      <Paper sx={{ p: 2, height: '100%' }}>
        <Typography variant="overline" color="text.secondary">{title}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>No data</Typography>
      </Paper>
    );
  }

  const { current, avg_1m, avg_5m, avg_15m, peak_15m, trend, samples } = payload;
  const warming = samples != null && samples < 30; // <5min of data

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="overline" color="text.secondary">{title}</Typography>
        <TrendChip trend={trend} />
      </Box>
      <Typography variant="h3" sx={{ mt: 1, fontWeight: 600 }}>
        {renderValue(current)}
      </Typography>
      <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
        <Typography variant="caption">1m avg: <b>{renderValue(avg_1m)}</b></Typography>
        <Typography variant="caption">5m avg: <b>{renderValue(avg_5m)}</b></Typography>
        <Typography variant="caption">15m avg: <b>{renderValue(avg_15m)}</b></Typography>
        <Typography variant="caption">15m peak: <b>{renderValue(peak_15m)}</b></Typography>
      </Box>
      {warming && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
            Warming up ({samples} samples)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
            Rolling averages become more reliable after 15 minutes.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function VerdictHero({ verdict }) {
  const meta = TIER_META[verdict?.tier] || TIER_META.NO_GO;
  return (
    <Paper sx={{
      p: 3, mb: 3, borderLeft: 8, borderColor: meta.color,
      display: 'flex', alignItems: 'center', gap: 2,
    }}>
      <Box sx={{ color: meta.color }}>{meta.icon}</Box>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h4" sx={{ color: meta.color, fontWeight: 700 }}>
          {meta.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">{meta.blurb}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Hunt-5 (30 workers)</Typography>
      </Box>
    </Paper>
  );
}

function ReasonsList({ reasons }) {
  if (!reasons || reasons.length === 0) {
    return <Alert severity="success" sx={{ mb: 2 }}>No threshold breaches.</Alert>;
  }
  const noGo = reasons.filter(r => r.severity === 'no-go');
  const cond = reasons.filter(r => r.severity === 'conditional');
  return (
    <Box sx={{ mb: 2 }}>
      {noGo.map((r, i) => (
        <Alert key={`ng-${i}`} severity="error" sx={{ mb: 1 }}>
          <b>NO-GO</b> · {r.message}
        </Alert>
      ))}
      {cond.map((r, i) => (
        <Alert key={`cd-${i}`} severity="warning" sx={{ mb: 1 }}>
          <b>CONDITIONAL</b> · {r.message}
        </Alert>
      ))}
    </Box>
  );
}

function Hunt5Card({ hunt5 }) {
  if (!hunt5) return null;
  return (
    <Paper sx={{ p: 2, mb: 3, borderLeft: 6, borderColor: hunt5.currently_running ? 'success.main' : 'info.main' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Hunt-5 Assumption</Typography>
        <Chip
          size="small"
          color={hunt5.currently_running ? 'success' : 'info'}
          label={hunt5.currently_running ? 'RUNNING' : 'PROJECTED — NOT RUNNING'}
        />
      </Box>
      <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Workers</Typography>
          <Typography variant="h6">{hunt5.instance_count}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Ports / worker</Typography>
          <Typography variant="h6">{hunt5.ports_per_worker}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Total ports</Typography>
          <Typography variant="h6">{hunt5.ports_required}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">Proxy ready</Typography>
          <Typography variant="h6" color={hunt5.proxy_ready ? 'success.main' : 'error.main'}>
            {hunt5.proxy_ready ? 'YES' : 'NO'}
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {hunt5.projection_note}
      </Typography>
    </Paper>
  );
}

function NowNextRiskRail({ rail }) {
  if (!rail) return null;
  const items = [
    { label: 'NOW',  value: rail.now,  color: 'primary.main' },
    { label: 'NEXT', value: rail.next, color: 'info.main' },
    { label: 'RISK', value: rail.risk, color: 'warning.main' },
  ];
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {items.map(it => (
        <Grid item xs={12} md={4} key={it.label}>
          <Paper sx={{ p: 2, height: '100%', borderTop: 4, borderColor: it.color }}>
            <Typography variant="overline" color="text.secondary">{it.label}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>{it.value}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function ContainerTable({ containers }) {
  if (!containers || containers.length === 0) return null;
  return (
    <Paper sx={{ mb: 3 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Containers</Typography>
        <Typography variant="caption" color="text.secondary">
          Live container CPU + memory with 5m rolling averages. Projected Hunt-5 row marked.
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Container</TableCell>
              <TableCell align="right">CPU%</TableCell>
              <TableCell align="right">5m avg CPU%</TableCell>
              <TableCell align="right">Memory%</TableCell>
              <TableCell align="right">5m avg Mem%</TableCell>
              <TableCell>Trend</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {containers.map(c => (
              <TableRow key={c.name} sx={{ opacity: c.is_projected ? 0.7 : 1 }}>
                <TableCell>
                  <b>{c.name}</b>
                  {c.is_projected && (
                    <Chip size="small" label="PROJECTED" color="info" sx={{ ml: 1 }} />
                  )}
                </TableCell>
                <TableCell align="right">{fmt(c.cpu_pct, '%')}</TableCell>
                <TableCell align="right">{fmt(c.cpu_pct_trend?.avg_5m, '%')}</TableCell>
                <TableCell align="right">{fmt(c.memory_pct, '%')}</TableCell>
                <TableCell align="right">{fmt(c.memory_pct_trend?.avg_5m, '%')}</TableCell>
                <TableCell>
                  {c.cpu_pct_trend ? <TrendChip trend={c.cpu_pct_trend.trend} /> : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function BottleneckCard({ b }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="overline" color="text.secondary">{b.title}</Typography>
      {b.kind === 'docker_cpu_limits' && (
        <Box sx={{ mt: 1 }}>
          <Chip
            size="small"
            color={b.audit?.found ? 'error' : 'success'}
            label={b.audit?.found ? `${b.audit.violations.length} violation(s)` : 'None found'}
          />
          {b.audit?.audit_error && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
              {b.audit.audit_error}
            </Typography>
          )}
          {b.audit?.violations?.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {b.audit.violations.map(v => (
                <Typography key={v.name} variant="caption" sx={{ display: 'block' }}>
                  • {v.name}: quota={v.cpu_quota || '—'} nano={v.nano_cpus || '—'} cpuset={v.cpuset_cpus || '—'}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
      {b.kind === 'proxy_readiness' && (
        <Box sx={{ mt: 1 }}>
          <Chip
            size="small"
            color={b.ready ? 'success' : 'error'}
            label={b.ready ? 'READY' : 'NOT READY'}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Need {b.ports_required} ports for Hunt-5
          </Typography>
        </Box>
      )}
      {b.metrics && (
        <Box sx={{ mt: 1 }}>
          {Object.entries(b.metrics).map(([k, v]) => {
            if (v == null) return null;
            const isTrend = typeof v === 'object' && 'avg_5m' in v;
            return (
              <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption">{k}</Typography>
                <Typography variant="caption">
                  <b>{formatBottleneckMetric(k, v, 'current')}</b>
                  {isTrend && v.avg_5m != null && (
                    <span style={{ marginLeft: 8, opacity: 0.7 }}>
                      5m: {formatBottleneckMetric(k, v, 'avg_5m')}
                    </span>
                  )}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
      {b.kind === 'disk_io' && b.disk_available === false && (
        <Box sx={{ mt: 1 }}>
          <Chip size="small" color="warning" label="Disk used: Unavailable from container" />
          {b.disk_unavailable_reason && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {b.disk_unavailable_reason}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default function CapacityVerdict({ user }) {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    try {
      const res = await fetchWithAuth('/admin/capacity', { signal: controller.signal });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = await res.json();
      setData(json);
      setLastFetched(new Date());
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  if (loading && !data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">Loading capacity metrics…</Typography>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Capacity Verdict"
        subtitle={`Hunt-5 readiness · last updated ${lastFetched ? lastFetched.toLocaleTimeString() : '—'}`}
        actions={
          <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">
            Refresh
          </Button>
        }
      />

      {error && <Alert severity="warning" sx={{ mb: 2 }}>Last fetch failed: {error}</Alert>}

      {data && (
        <>
          <VerdictHero verdict={data.verdict} />
          <ReasonsList reasons={data.verdict?.reasons} />
          <Hunt5Card hunt5={data.hunt5_projection} />
          <NowNextRiskRail rail={data.now_next_risk} />

          <Typography variant="h6" sx={{ mb: 1.5 }}>System Metrics</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}><MetricCard title="CPU Busy" payload={data.system?.cpu_busy_pct} /></Grid>
            <Grid item xs={12} md={3}><MetricCard title={`Load (vs ${data.system?.cores ?? '?'} cores)`} payload={data.system?.load_pct} /></Grid>
            <Grid item xs={12} md={3}><MetricCard title="iowait" payload={data.system?.iowait_pct} /></Grid>
            <Grid item xs={12} md={3}><MetricCard title="Disk Write" payload={data.system?.disk_write_kbs} formatter={formatWriteRate} /></Grid>
            <Grid item xs={12} md={3}>
              <MetricCard
                title="Disk Used"
                payload={data.disk?.available ? data.disk?.used_pct_trend : null}
                unavailableNote={data.disk?.available ? null : (data.disk?.unavailable_reason || 'Unavailable from container')}
              />
            </Grid>
            <Grid item xs={12} md={3}><MetricCard title="Memory" payload={data.system?.memory_pct} /></Grid>
            <Grid item xs={12} md={3}><MetricCard title="JWT CPU" payload={data.jwt?.cpu_pct_trend} /></Grid>
            <Grid item xs={12} md={3}><MetricCard title="Postgres CPU" payload={data.postgres?.cpu_pct_trend} /></Grid>
            <Grid item xs={12} md={3}><MetricCard title="PG Connections %" payload={data.postgres?.connections_pct_trend} /></Grid>
          </Grid>

          <ContainerTable containers={data.containers} />

          <Typography variant="h6" sx={{ mb: 1.5 }}>Bottleneck Cards</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(data.bottlenecks || []).map(b => (
              <Grid item xs={12} md={6} lg={4} key={b.kind}>
                <BottleneckCard b={b} />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            Read-only endpoint · sample count: {data.sample_count} · collect: {data.collect_ms}ms · {data.timestamp}
          </Typography>
        </>
      )}
    </Box>
  );
}
