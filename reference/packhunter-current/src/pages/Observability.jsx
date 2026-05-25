/**
 * Observability Dashboard — Phase 1
 * Admin-only page showing PostgreSQL health, aggregation integrity, and hunt stall detection.
 * Auto-refreshes every 30 seconds.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Chip, Alert, LinearProgress, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Storage as DbIcon,
  Speed as PerfIcon,
  Warning as WarnIcon,
  CheckCircle as OkIcon,
  Error as ErrorIcon,
  Sync as SyncIcon,
  DirectionsRun as HuntIcon,
  OpenInNew as ExternalIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import { useSectionStyles } from '../components/SectionCard';

const POLL_INTERVAL = 30000;
const GRAFANA_URL = import.meta.env.VITE_GRAFANA_DASHBOARD_URL || '';

function fetchObs() {
  return fetch('/api/admin/observability', { credentials: 'include' }).then(r => r.json());
}

function fetchExporterStatus() {
  return fetch('/metrics/status', { credentials: 'include' }).then(r => r.json()).catch(() => null);
}

function severityColor(sev) {
  if (sev === 'P1') return 'error';
  if (sev === 'P2') return 'warning';
  return 'info';
}

function statusBadge(status) {
  // Wave 7: route through StatusChip for taxonomy parity.
  if (status === 'critical') return <StatusChip status="critical" label="CRITICAL" />;
  if (status === 'warning')  return <StatusChip status="warning"  label="WARNING" />;
  return <StatusChip status="healthy" label="HEALTHY" />;
}

function MetricRow({ label, value, unit, warn, crit, invert }) {
  let color = 'inherit';
  const num = parseFloat(value);
  if (!isNaN(num)) {
    if (invert) {
      if (crit !== undefined && num < crit) color = '#f44336';
      else if (warn !== undefined && num < warn) color = '#ff9800';
      else color = '#4caf50';
    } else {
      if (crit !== undefined && num > crit) color = '#f44336';
      else if (warn !== undefined && num > warn) color = '#ff9800';
      else color = '#4caf50';
    }
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit ? ` ${unit}` : ''}
      </Typography>
    </Box>
  );
}

function GaugeBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(value / max * 100, 100) : 0;
  const color = pct > 80 ? 'error' : pct > 60 ? 'warning' : 'success';
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="caption" fontWeight={600}>{value} / {max} ({Math.round(pct)}%)</Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}

export default function Observability() {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [exporterStatus, setExporterStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { sectionBox } = useSectionStyles();

  const load = useCallback(async () => {
    try {
      const [result, expStatus] = await Promise.all([fetchObs(), fetchExporterStatus()]);
      if (result.error) throw new Error(result.error);
      setData(result);
      setExporterStatus(expStatus);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const pg = data?.postgres || {};
  const agg = data?.aggregation || {};
  const hunts = data?.hunts || {};
  const alerts = data?.alerts || [];
  const summary = data?.summary || {};

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: 2, pb: 4 }}>
      <PageHeader
        title="Observability"
        subtitle={`Phase 1 — collected in ${data?.collect_ms || '?'}ms`}
      />

      {/* Status + Alerts + Grafana Banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {statusBadge(summary.status)}
        {summary.p1_count > 0 && <Chip label={`${summary.p1_count} P1`} color="error" size="small" variant="outlined" />}
        {summary.p2_count > 0 && <Chip label={`${summary.p2_count} P2`} color="warning" size="small" variant="outlined" />}
        {summary.p3_count > 0 && <Chip label={`${summary.p3_count} P3`} size="small" variant="outlined" />}

        {/* Exporter status */}
        <Tooltip title={exporterStatus?.seconds_since_scrape != null
          ? `Last scraped ${exporterStatus.seconds_since_scrape}s ago · ${exporterStatus.last_collect_ms}ms`
          : 'No scrape data yet'}>
          <Chip
            icon={<DotIcon sx={{ fontSize: 10 }} />}
            label={exporterStatus?.exporter_up ? 'Exporter OK' : 'Exporter'}
            size="small"
            variant="outlined"
            color={exporterStatus?.exporter_up ? 'success' : 'default'}
          />
        </Tooltip>

        {GRAFANA_URL && (
          <Chip
            icon={<ExternalIcon sx={{ fontSize: 14 }} />}
            label="Open in Grafana"
            size="small"
            variant="outlined"
            color="info"
            component="a"
            href={GRAFANA_URL}
            target="_blank"
            rel="noopener"
            clickable
          />
        )}

        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          Refreshes every 30s &middot; {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : ''}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* P1/P2 Alerts */}
      {alerts.filter(a => a.severity === 'P1' || a.severity === 'P2').map((a, i) => (
        <Alert key={i} severity={severityColor(a.severity)} sx={{ mb: 1 }}>
          <strong>[{a.severity}] {a.domain}:</strong> {a.message}
        </Alert>
      ))}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        {/* PostgreSQL Health */}
        <Grid item xs={12} md={6}>
          <Paper sx={sectionBox}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <DbIcon sx={{ color: '#42a5f5' }} />
              <Typography variant="subtitle1" fontWeight={700}>PostgreSQL</Typography>
            </Box>

            <GaugeBar
              value={pg.connections?.total || 0}
              max={pg.max_connections || 500}
              label="Connections"
            />

            <MetricRow label="Active" value={pg.connections?.active || 0} />
            <MetricRow label="Idle" value={pg.connections?.idle || 0} />
            <MetricRow label="Idle in Txn" value={pg.connections?.idle_in_txn || 0} warn={5} crit={10} />
            <MetricRow label="Trend" value={pg.connections?.trend || '—'} />
            <MetricRow label="Cache Hit Ratio (delta)" value={pg.cache_hit_ratio ?? '—'} unit="%" warn={95} crit={90} invert />
            <MetricRow label="Slow Queries (>1s)" value={pg.slow_queries ?? 0} warn={5} crit={10} />
            <MetricRow label="Temp Growth" value={pg.temp_bytes_rate_mb_min ?? 0} unit="MB/min" warn={50} crit={100} />
            <MetricRow label="Temp Total" value={pg.temp_bytes_total ? `${Math.round(pg.temp_bytes_total / 1024 / 1024)}MB` : '0'} />
            <MetricRow label="Checkpoints (timed/req)" value={`${pg.checkpoints?.timed || 0} / ${pg.checkpoints?.requested || 0}`} />
            <MetricRow label="Database Size" value={pg.database_size_gb ?? '—'} unit="GB" />
          </Paper>
        </Grid>

        {/* Aggregation Integrity */}
        <Grid item xs={12} md={6}>
          <Paper sx={sectionBox}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <SyncIcon sx={{ color: '#ab47bc' }} />
              <Typography variant="subtitle1" fontWeight={700}>Aggregation Integrity</Typography>
            </Box>

            <MetricRow label="Last Processed" value={agg.last_processed_at ? new Date(agg.last_processed_at).toLocaleTimeString() : '—'} />
            <MetricRow label="Last Attempt" value={agg.last_attempt_at ? new Date(agg.last_attempt_at).toLocaleTimeString() : '—'} />
            <MetricRow label="Staleness" value={agg.staleness_seconds ?? '—'} unit="s" warn={120} crit={300} />
            <MetricRow label="Rows Processed (total)" value={(agg.rows_processed || 0).toLocaleString()} />
            <MetricRow label="Summary Buckets" value={agg.total_buckets || 0} />
            <MetricRow label="Fallback Active" value={agg.fallback_likely ? 'YES' : 'No'} />
            <MetricRow label="Stuck (running but stale)" value={agg.attempts_without_progress ? 'YES' : 'No'} />

            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" fontWeight={600} gutterBottom>Drift Check (1h window, updated every 5min)</Typography>
              <MetricRow label="Summary Packs" value={(agg.drift?.summary || 0).toLocaleString()} />
              <MetricRow label="Direct Packs" value={(agg.drift?.direct || 0).toLocaleString()} />
              <MetricRow label="Drift" value={agg.drift?.pct ?? '—'} unit="%" warn={10} crit={20} />
            </Box>
          </Paper>
        </Grid>

        {/* Hunt Health */}
        <Grid item xs={12}>
          <Paper sx={sectionBox}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <HuntIcon sx={{ color: '#66bb6a' }} />
              <Typography variant="subtitle1" fontWeight={700}>Hunt Health</Typography>
              {hunts.total_active_instances > 0 && (
                <Chip label={`${hunts.total_active_instances} instances · ${hunts.aggregate_ppm || 0} PPM`} size="small" variant="outlined" sx={{ ml: 'auto' }} />
              )}
            </Box>

            {(!hunts.containers || hunts.containers.length === 0) ? (
              <Typography variant="body2" color="text.secondary">No active hunt containers detected.</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Container</TableCell>
                      <TableCell align="right">Active / Total</TableCell>
                      <TableCell align="right">PPM</TableCell>
                      <TableCell align="right">Total Packs</TableCell>
                      <TableCell align="right">Last Update</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hunts.containers.map((c) => (
                      <TableRow key={c.group}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>C{c.group}</Typography>
                        </TableCell>
                        <TableCell align="right">{c.active} / {c.total}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{c.ppm}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{(c.totalPacks || 0).toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{c.lastUpdateSec}s ago</TableCell>
                        <TableCell align="center">
                          {c.stalled
                            ? <StatusChip status="stalled" label="STALLED" />
                            : c.active > 0
                              ? <StatusChip status="healthy" label="OK" />
                              : <StatusChip status="idle" label="IDLE" />
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {hunts.throughput_imbalance > 2 && (
              <Alert severity={hunts.throughput_imbalance > 3 ? 'warning' : 'info'} sx={{ mt: 1 }}>
                Throughput imbalance: {hunts.throughput_imbalance}x between fastest and slowest hunt
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* P3 Alerts (informational) */}
        {alerts.filter(a => a.severity === 'P3').length > 0 && (
          <Grid item xs={12}>
            <Paper sx={sectionBox}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Informational (P3)</Typography>
              {alerts.filter(a => a.severity === 'P3').map((a, i) => (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ py: 0.3 }}>
                  [{a.domain}] {a.message}
                </Typography>
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
