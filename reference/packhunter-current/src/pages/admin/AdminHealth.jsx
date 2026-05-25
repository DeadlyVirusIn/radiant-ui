/**
 * Phase 19/20 — Admin Data Health panel.
 *
 * Mounted at /admin/health under the Diagnostics submenu.
 *
 * Layout (Phase 20):
 *   1. Summary strip — counts + top-3 priority insights
 *   2. Insights panel — derived from findings, prioritized, with state
 *      (new/ongoing/worsening/recovered), why-it-matters, suggested actions
 *   3. Findings table — raw findings (Phase 19 surface, kept for drill-down)
 *   4. Drawer — click an insight to see its grouped findings + ack/resolve
 *
 * Defaults:
 *   - status = open
 *   - hide test-entity findings (engine still surfaces non-suppressible)
 *   - sorted by priority desc
 *
 * Each row reuses HealthChip + LastActionStrip so the trust/reason layer
 * stays visually coherent with Phase 17.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, CircularProgress,
  Collapse, Switch, FormControlLabel, MenuItem, Select, FormControl, InputLabel,
  Drawer, Divider, List, ListItem, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  TextField, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  CheckCircle as ResolveIcon,
  PersonAdd as AckIcon,
  Insights as InsightsIcon,
  Close as CloseIcon,
  TrendingUp as WorseningIcon,
  TrendingFlat as OngoingIcon,
  FiberNew as NewIcon,
  CheckCircleOutline as RecoveredIcon,
  PlayArrow as RunIcon,
  Science as DryRunIcon,
  Warning as GuardedIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { fetchWithAuth } from '../../services/api';
import HealthChip from '../../components/admin/HealthChip';
import LastActionStrip from '../../components/admin/LastActionStrip';

const STATE_META = {
  new:       { color: 'error',   icon: NewIcon,       label: 'NEW' },
  worsening: { color: 'error',   icon: WorseningIcon, label: 'WORSENING' },
  ongoing:   { color: 'warning', icon: OngoingIcon,   label: 'ONGOING' },
  recovered: { color: 'success', icon: RecoveredIcon, label: 'RECOVERED' },
};

const CATEGORY_LABEL = {
  integrity:      'Integrity',
  performance:    'Performance',
  destructive_op: 'Destructive op',
  config:         'Configuration',
};

export default function AdminHealth() {
  const navigate = useNavigate();
  const [findings, setFindings] = useState([]);
  const [summary, setSummary] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [includeTest, setIncludeTest] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [eventsCache, setEventsCache] = useState({});
  // Phase 20 — intelligence layer state
  const [insights, setInsights] = useState([]);
  const [intelSummary, setIntelSummary] = useState({ counts: {}, top: [] });
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [drawerInsight, setDrawerInsight] = useState(null);
  // Phase 21 — actions
  const [actionsForRule, setActionsForRule] = useState([]);
  const [actionRuns, setActionRuns] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);  // { action, dryRun, params }
  const [actionRunning, setActionRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState(null);

  const loadFindings = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (includeTest) params.set('includeTest', '1');
      const r = await fetchWithAuth(`/admin/health/findings?${params}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'load failed');
      setFindings(data.findings || []);
      setSummary(data.summary || { total: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Phase 20 — load intelligence (insights + summary) alongside findings.
  const loadIntelligence = async () => {
    setInsightsLoading(true);
    try {
      const params = includeTest ? '?includeTest=1' : '';
      const [insR, sumR] = await Promise.all([
        fetchWithAuth(`/admin/health/insights${params}`),
        fetchWithAuth(`/admin/health/summary${params}`),
      ]);
      const insData = await insR.json();
      const sumData = await sumR.json();
      if (insR.ok) setInsights(insData.insights || []);
      if (sumR.ok) setIntelSummary(sumData);
    } catch (e) {
      // Degrade gracefully — findings panel still works without intelligence.
      console.error('[AdminHealth] intelligence load failed:', e);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => { loadFindings(); loadIntelligence(); }, [statusFilter, categoryFilter, includeTest]);

  const handleInsightAck = async (insightKey) => {
    try {
      const r = await fetchWithAuth(`/admin/health/insights/${insightKey}/acknowledge`, {
        method: 'POST', body: JSON.stringify({}),
      });
      if (r.ok) loadIntelligence();
    } catch (e) { setError(e.message); }
  };
  const handleInsightResolve = async (insightKey) => {
    try {
      const r = await fetchWithAuth(`/admin/health/insights/${insightKey}/resolve`, {
        method: 'POST', body: JSON.stringify({}),
      });
      if (r.ok) { loadIntelligence(); setDrawerInsight(null); }
    } catch (e) { setError(e.message); }
  };

  // Phase 21 — load actions + run history when an insight is opened.
  useEffect(() => {
    if (!drawerInsight) {
      setActionsForRule([]); setActionRuns([]); setLastRunResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [aR, hR] = await Promise.all([
          fetchWithAuth(`/admin/health/actions?rule=${encodeURIComponent(drawerInsight.rule)}`),
          fetchWithAuth(`/admin/health/actions/runs?insightKey=${encodeURIComponent(drawerInsight.insightKey)}&limit=20`),
        ]);
        const aData = await aR.json();
        const hData = await hR.json();
        if (cancelled) return;
        if (aR.ok) setActionsForRule(aData.actions || []);
        if (hR.ok) setActionRuns(hData.runs || []);
      } catch (e) {
        if (!cancelled) console.error('[AdminHealth] action load failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [drawerInsight?.insightKey]);

  const inferActionParams = (action, insight) => {
    // For DELETE_FAILURE_CLUSTER actions, the underlying findings carry
    // entity_id = userId. We default to the highest-priority finding's user.
    if (action.supportedRules.includes('DELETE_FAILURE_CLUSTER')) {
      const f = (insight.findings || [])[0];
      if (f?.entity_id) return { userId: parseInt(f.entity_id, 10) };
    }
    return {};
  };

  const runAction = async (action, dryRun = false) => {
    if (action.requiresConfirmation && !dryRun) {
      // Open confirmation dialog instead of running directly.
      setConfirmAction({ action, dryRun: false, params: inferActionParams(action, drawerInsight) });
      return;
    }
    await executeAction(action, dryRun, inferActionParams(action, drawerInsight));
  };

  const executeAction = async (action, dryRun, params) => {
    setActionRunning(true);
    setLastRunResult(null);
    try {
      const r = await fetchWithAuth(`/admin/health/actions/${action.actionKey}/run`, {
        method: 'POST',
        body: JSON.stringify({
          dryRun, confirmed: true,
          insightKey: drawerInsight?.insightKey,
          params,
        }),
      });
      const data = await r.json();
      setLastRunResult({ ok: r.ok, data });
      // Refresh run history + insights (state may have changed).
      const hR = await fetchWithAuth(`/admin/health/actions/runs?insightKey=${encodeURIComponent(drawerInsight.insightKey)}&limit=20`);
      const hData = await hR.json();
      if (hR.ok) setActionRuns(hData.runs || []);
      loadIntelligence();
    } catch (e) {
      setLastRunResult({ ok: false, data: { error: e.message } });
    } finally {
      setActionRunning(false);
      setConfirmAction(null);
    }
  };

  const loadEvents = async (id) => {
    if (eventsCache[id]) return;
    try {
      const r = await fetchWithAuth(`/admin/health/findings/${id}`);
      const data = await r.json();
      if (r.ok) setEventsCache(prev => ({ ...prev, [id]: data.events || [] }));
    } catch { /* silent */ }
  };

  const handleExpand = (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadEvents(id);
  };

  const handleResolve = async (id) => {
    try {
      const r = await fetchWithAuth(`/admin/health/findings/${id}/resolve`, {
        method: 'POST', body: JSON.stringify({}),
      });
      if (r.ok) loadFindings();
    } catch (e) { setError(e.message); }
  };

  const handleAck = async (id) => {
    try {
      const r = await fetchWithAuth(`/admin/health/findings/${id}/acknowledge`, {
        method: 'POST', body: JSON.stringify({}),
      });
      if (r.ok) loadFindings();
    } catch (e) { setError(e.message); }
  };

  const visibleFindings = useMemo(() => findings, [findings]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          {/* Renamed from "Data Health" for clarity. This panel is the
           * true platform-wide view: delete failures, perf signals,
           * validation, and nav integrity across ALL users/endpoints.
           * "System Health (Platform)" matches its scope. The old
           * user-scoped "System Health" page was renamed to
           * "Account Health" to remove the mismatch.
           */}
          <Typography variant="h5">System Health (Platform)</Typography>
          <Typography variant="caption" color="text.secondary">
            Platform-wide structured findings from delete failures, perf signals, validation, and nav integrity.
            Covers all users, endpoints, and validators. Phase 17 trust layer reused for explanations.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh">
            <IconButton onClick={loadFindings} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Cross-nav hint — this page is platform-wide; sibling is the
       * user-scoped "Account Health" page (trade/gift/battle executors
       * for the viewer's own linked device accounts).
       */}
      <Alert
        severity="info"
        variant="outlined"
        sx={{ mb: 2, py: 0.5 }}
        action={
          <Button size="small" onClick={() => navigate('/admin/system-health')}>
            Open Account Health (My Accounts)
          </Button>
        }
      >
        <Typography variant="caption">
          Showing <strong>platform-wide data health insights</strong> across all users, accounts, and endpoints.
          Looking for your own account executors (trade / gift / battle) instead?
        </Typography>
      </Alert>

      {/* Phase 20 — intelligence summary strip */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <InsightsIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>INTELLIGENCE</Typography>
          </Stack>
          <Chip label={`${intelSummary.counts?.total ?? 0} insights`} size="small" />
          {(intelSummary.counts?.critical || 0) > 0 && (
            <HealthChip severity="critical" label={`${intelSummary.counts.critical} crit`} />
          )}
          {(intelSummary.counts?.error || 0) > 0 && (
            <HealthChip severity="error" label={`${intelSummary.counts.error} err`} />
          )}
          {(intelSummary.counts?.warning || 0) > 0 && (
            <HealthChip severity="warning" label={`${intelSummary.counts.warning} warn`} />
          )}
          <Box sx={{ flex: 1 }} />
          {(intelSummary.counts?.new || 0) > 0 && (
            <Chip size="small" icon={<NewIcon />} label={`${intelSummary.counts.new} new`} color="error" variant="outlined" />
          )}
          {(intelSummary.counts?.worsening || 0) > 0 && (
            <Chip size="small" icon={<WorseningIcon />} label={`${intelSummary.counts.worsening} worsening`} color="error" variant="outlined" />
          )}
          {(intelSummary.counts?.ongoing || 0) > 0 && (
            <Chip size="small" icon={<OngoingIcon />} label={`${intelSummary.counts.ongoing} ongoing`} color="warning" variant="outlined" />
          )}
          {(intelSummary.counts?.recovered || 0) > 0 && (
            <Chip size="small" icon={<RecoveredIcon />} label={`${intelSummary.counts.recovered} recovered`} color="success" variant="outlined" />
          )}
        </Stack>
        {intelSummary.top && intelSummary.top.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            {intelSummary.top.map((t) => {
              const stateMeta = STATE_META[t.state] || STATE_META.ongoing;
              return (
                <Chip
                  key={t.insightKey}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const full = insights.find(i => i.insightKey === t.insightKey);
                    if (full) setDrawerInsight(full);
                  }}
                  label={
                    <span>
                      <strong>p{t.priorityScore}</strong> · {stateMeta.label} · {t.title}
                    </span>
                  }
                  sx={{ cursor: 'pointer' }}
                />
              );
            })}
          </Stack>
        )}
      </Paper>

      {/* Phase 20 — insights panel */}
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <InsightsIcon fontSize="small" sx={{ mr: 0.5 }} />
          <Typography variant="subtitle2">Insights ({insights.length})</Typography>
          {insightsLoading && <CircularProgress size={14} sx={{ ml: 1 }} />}
        </Stack>
        {insights.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              No active insights. Either the system is clean, or all insights are below the
              priority threshold.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Severity</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Title</TableCell>
                <TableCell align="right">Priority</TableCell>
                <TableCell align="right">Findings</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {insights.map((i) => {
                const stateMeta = STATE_META[i.state] || STATE_META.ongoing;
                const StateIcon = stateMeta.icon;
                return (
                  <TableRow
                    key={i.insightKey}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setDrawerInsight(i)}
                  >
                    <TableCell><HealthChip severity={i.severity} /></TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={<StateIcon fontSize="small" />}
                        label={stateMeta.label}
                        color={stateMeta.color}
                        variant={i.state === 'recovered' ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{i.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {i.rule}{i.acknowledgedBy && ` · ack by ${i.acknowledgedBy}`}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={`confidence ${i.confidence} (${i.confidenceScore}/100)`}>
                        <Chip size="small" label={i.priorityScore} color={i.priorityScore > 100 ? 'error' : 'default'} />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">{(i.findings || []).length}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      {i.status !== 'acknowledged' && i.status !== 'resolved' && (
                        <Tooltip title="Acknowledge">
                          <IconButton size="small" onClick={() => handleInsightAck(i.insightKey)}>
                            <AckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {i.status !== 'resolved' && (
                        <Tooltip title="Resolve">
                          <IconButton size="small" color="success" onClick={() => handleInsightResolve(i.insightKey)}>
                            <ResolveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Findings summary chips (Phase 19, kept for raw view) */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', fontWeight: 700 }}>
          RAW FINDINGS:
        </Typography>
        <Chip label={`${summary.total} total`} size="small" />
        {summary.critical > 0 && <HealthChip severity="critical" label={`${summary.critical} critical`} />}
        {summary.error > 0 && <HealthChip severity="error" label={`${summary.error} error`} />}
        {summary.warning > 0 && <HealthChip severity="warning" label={`${summary.warning} warn`} />}
        {summary.info > 0 && <HealthChip severity="info" label={`${summary.info} info`} />}
        {summary.suppressed > 0 && (
          <Chip label={`${summary.suppressed} test-entity`} size="small" variant="outlined" />
        )}
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="acknowledged">Acknowledged</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Category</InputLabel>
          <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="integrity">Integrity</MenuItem>
            <MenuItem value="performance">Performance</MenuItem>
            <MenuItem value="destructive_op">Destructive op</MenuItem>
            <MenuItem value="config">Configuration</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} size="small" />}
          label="Include test entities"
        />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={32}></TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Issue</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Last seen</TableCell>
              <TableCell align="right">Count</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && visibleFindings.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center">
                <Typography variant="caption" color="text.secondary">
                  {statusFilter === 'open' ? 'No open findings — system clean.' : 'No findings.'}
                </Typography>
              </TableCell></TableRow>
            )}
            {visibleFindings.map((f) => {
              const isExpanded = expandedId === f.id;
              return (
                <>
                  <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleExpand(f.id)}>
                    <TableCell>{isExpanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}</TableCell>
                    <TableCell><HealthChip severity={f.severity} /></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {f.issue_code} · {CATEGORY_LABEL[f.category] || f.category}
                        {f.is_test_entity && ' · TEST'}
                        {f.acknowledged_by && ` · ack by ${f.acknowledged_by}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {f.entity_type}{f.entity_id ? ` #${f.entity_id}` : ' (system)'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{new Date(f.last_seen_at).toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell align="right">{f.occurrence_count}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      {f.status !== 'acknowledged' && f.status !== 'resolved' && (
                        <Tooltip title="Acknowledge">
                          <IconButton size="small" onClick={() => handleAck(f.id)}><AckIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {f.status !== 'resolved' && (
                        <Tooltip title="Resolve">
                          <IconButton size="small" color="success" onClick={() => handleResolve(f.id)}>
                            <ResolveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                          {f.why_it_matters && (
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>WHY IT MATTERS</Typography>
                              <Typography variant="body2" sx={{ mb: 1.5 }}>{f.why_it_matters}</Typography>
                            </>
                          )}
                          {Array.isArray(f.suggested_actions) && f.suggested_actions.length > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>SUGGESTED ACTIONS</Typography>
                              <ul style={{ marginTop: 4, marginBottom: 12 }}>
                                {f.suggested_actions.map((a, i) => (
                                  <li key={i}><Typography variant="body2">{a}</Typography></li>
                                ))}
                              </ul>
                            </>
                          )}
                          {f.evidence && Object.keys(f.evidence).length > 0 && (
                            <>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>EVIDENCE</Typography>
                              <Box component="pre" sx={{
                                fontSize: '0.7rem', overflow: 'auto', m: 0, mt: 0.5, p: 1,
                                bgcolor: 'background.paper', borderRadius: 1,
                              }}>{JSON.stringify(f.evidence, null, 2)}</Box>
                            </>
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                            confidence: {f.confidence} ({f.confidence_score}/100) · source: {f.source} · first seen {new Date(f.first_seen_at).toLocaleString()}
                          </Typography>
                          {/* Reuse Phase 17's LastActionStrip for the event timeline */}
                          {eventsCache[f.id] && eventsCache[f.id].length > 0 && (
                            <Box sx={{ mt: 1.5 }}>
                              <LastActionStrip
                                title="Event timeline"
                                lines={eventsCache[f.id].slice(0, 6).map((ev) => ({
                                  kind: ev.event_type,
                                  severity: ev.severity || 'info',
                                  text: `${ev.event_type}${ev.actor ? ` by ${ev.actor}` : ''} — ${new Date(ev.occurred_at).toLocaleString()}`,
                                }))}
                              />
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* Phase 20 — insight drawer */}
      <Drawer
        anchor="right"
        open={!!drawerInsight}
        onClose={() => setDrawerInsight(null)}
        PaperProps={{ sx: { width: { xs: '100%', md: 480 } } }}
      >
        {drawerInsight && (() => {
          const stateMeta = STATE_META[drawerInsight.state] || STATE_META.ongoing;
          const StateIcon = stateMeta.icon;
          return (
            <Box sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6">{drawerInsight.title}</Typography>
                <IconButton onClick={() => setDrawerInsight(null)} size="small"><CloseIcon /></IconButton>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2, flexWrap: 'wrap' }}>
                <HealthChip severity={drawerInsight.severity} />
                <Chip
                  size="small"
                  icon={<StateIcon fontSize="small" />}
                  label={stateMeta.label}
                  color={stateMeta.color}
                  variant={drawerInsight.state === 'recovered' ? 'outlined' : 'filled'}
                />
                <Chip size="small" label={`priority ${drawerInsight.priorityScore}`} />
                <Chip size="small" label={`confidence ${drawerInsight.confidence} (${drawerInsight.confidenceScore})`} variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {drawerInsight.rule}
                {drawerInsight.firstSeenAt && ` · first seen ${new Date(drawerInsight.firstSeenAt).toLocaleString()}`}
                {drawerInsight.acknowledgedBy && ` · ack by ${drawerInsight.acknowledgedBy}`}
              </Typography>

              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>WHY IT MATTERS</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, mb: 2 }}>{drawerInsight.whyItMatters}</Typography>

              {Array.isArray(drawerInsight.suggestedActions) && drawerInsight.suggestedActions.length > 0 && (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>SUGGESTED NEXT ACTION</Typography>
                  <List dense sx={{ pt: 0.5 }}>
                    {drawerInsight.suggestedActions.map((a, i) => (
                      <ListItem key={i} sx={{ pl: 1, pr: 0, py: 0.25 }}>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`${i + 1}. ${a}`} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {drawerInsight.evidence && Object.keys(drawerInsight.evidence).length > 0 && (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mt: 1.5, display: 'block' }}>EVIDENCE</Typography>
                  <Box component="pre" sx={{
                    fontSize: '0.7rem', overflow: 'auto', m: 0, mt: 0.5, p: 1,
                    bgcolor: 'background.paper', borderRadius: 1,
                  }}>{JSON.stringify(drawerInsight.evidence, null, 2)}</Box>
                </>
              )}

              {Array.isArray(drawerInsight.findings) && drawerInsight.findings.length > 0 && (
                <>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mt: 2, display: 'block' }}>
                    UNDERLYING FINDINGS ({drawerInsight.findings.length})
                  </Typography>
                  <List dense>
                    {drawerInsight.findings.slice(0, 8).map((f) => (
                      <ListItem key={f.id} sx={{ pl: 1, pr: 0 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2">
                              {f.entity_type}{f.entity_id ? ` #${f.entity_id}` : ''} — {f.issue_code}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {f.occurrence_count} obs · last {new Date(f.last_seen_at).toLocaleString()}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                {drawerInsight.status !== 'acknowledged' && drawerInsight.status !== 'resolved' && (
                  <Button startIcon={<AckIcon />} onClick={() => handleInsightAck(drawerInsight.insightKey)}>Acknowledge</Button>
                )}
                {drawerInsight.status !== 'resolved' && (
                  <Button color="success" variant="contained" startIcon={<ResolveIcon />} onClick={() => handleInsightResolve(drawerInsight.insightKey)}>Resolve</Button>
                )}
              </Stack>
              {drawerInsight.cooldownUntil && new Date(drawerInsight.cooldownUntil) > new Date() && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Alert cooldown until {new Date(drawerInsight.cooldownUntil).toLocaleString()}
                  {' · '}{drawerInsight.alertCount || 0} alerts sent total
                </Typography>
              )}

              {/* Phase 21 — actions panel */}
              {actionsForRule.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    ACTIONS ({actionsForRule.length})
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {actionsForRule.map((a) => (
                      <Box key={a.actionKey} sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        p: 1, border: 1, borderColor: 'divider', borderRadius: 1,
                      }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {a.label}
                            {a.safetyClass === 'guarded' && (
                              <Tooltip title="Requires confirmation">
                                <GuardedIcon fontSize="inherit" sx={{ ml: 0.5, color: 'warning.main' }} />
                              </Tooltip>
                            )}
                            {a.safetyClass === 'manual_only' && (
                              <Chip label="MANUAL" size="small" sx={{ ml: 0.75, height: 16, fontSize: '0.6rem' }} />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {a.description}
                          </Typography>
                        </Box>
                        {a.supportsDryRun && (
                          <Tooltip title="Dry run (no side effects)">
                            <span><IconButton
                              size="small"
                              disabled={actionRunning}
                              onClick={() => runAction(a, true)}
                            ><DryRunIcon fontSize="small" /></IconButton></span>
                          </Tooltip>
                        )}
                        <Button
                          size="small"
                          variant={a.safetyClass === 'guarded' ? 'outlined' : 'contained'}
                          color={a.safetyClass === 'guarded' ? 'warning' : 'primary'}
                          startIcon={<RunIcon />}
                          disabled={actionRunning}
                          onClick={() => runAction(a, false)}
                        >Run</Button>
                      </Box>
                    ))}
                  </Stack>

                  {actionRunning && (
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                      <CircularProgress size={14} />
                      <Typography variant="caption">Running…</Typography>
                    </Stack>
                  )}

                  {lastRunResult && (
                    <Alert
                      severity={
                        lastRunResult.ok && lastRunResult.data?.status === 'success' ? 'success'
                        : lastRunResult.ok && lastRunResult.data?.status === 'denied' ? 'warning'
                        : 'error'
                      }
                      sx={{ mt: 1 }}
                      onClose={() => setLastRunResult(null)}
                    >
                      <Typography variant="caption">
                        {lastRunResult.data?.status || 'error'}
                        {lastRunResult.data?.outcome?.outcome && ` · outcome: ${lastRunResult.data.outcome.outcome}`}
                        {lastRunResult.data?.runId && ` · run #${lastRunResult.data.runId}`}
                      </Typography>
                      <Box component="pre" sx={{
                        fontSize: '0.65rem', m: 0, mt: 0.5, maxHeight: 220, overflow: 'auto',
                      }}>{JSON.stringify(lastRunResult.data?.result || lastRunResult.data, null, 2)}</Box>
                    </Alert>
                  )}
                </>
              )}

              {/* Phase 21 — run history */}
              {actionRuns.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandIcon />} sx={{ px: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <HistoryIcon fontSize="small" color="action" />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          RUN HISTORY ({actionRuns.length})
                        </Typography>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 0 }}>
                      <List dense>
                        {actionRuns.slice(0, 12).map((r) => {
                          const lastOutcome = (r.outcomes || [])[0];
                          return (
                            <ListItem key={r.id} sx={{ pl: 0, pr: 0 }}>
                              <ListItemText
                                primary={
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2">{r.action_key}</Typography>
                                    {r.dry_run && <Chip size="small" label="dry" sx={{ height: 16, fontSize: '0.6rem' }} />}
                                    <Chip
                                      size="small"
                                      label={r.status}
                                      color={r.status === 'success' ? 'success'
                                            : r.status === 'denied'  ? 'warning'
                                            : r.status === 'error' || r.status === 'failure' ? 'error'
                                            : 'default'}
                                      sx={{ height: 16, fontSize: '0.6rem' }}
                                    />
                                    {lastOutcome && (
                                      <Chip
                                        size="small"
                                        label={lastOutcome.outcome}
                                        variant="outlined"
                                        color={
                                          lastOutcome.outcome === 'resolved' ? 'success'
                                          : lastOutcome.outcome === 'improved' ? 'info'
                                          : lastOutcome.outcome === 'worsened' ? 'error'
                                          : 'default'
                                        }
                                        sx={{ height: 16, fontSize: '0.6rem' }}
                                      />
                                    )}
                                  </Stack>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary">
                                    {r.actor} · {new Date(r.started_at).toLocaleString()}
                                    {r.duration_ms != null && ` · ${r.duration_ms}ms`}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </>
              )}
            </Box>
          );
        })()}
      </Drawer>

      {/* Phase 21 — confirmation dialog for guarded actions */}
      <Dialog open={!!confirmAction} onClose={() => !actionRunning && setConfirmAction(null)}>
        <DialogTitle>Confirm action: {confirmAction?.action.label}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction?.action.description}
          </DialogContentText>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This is a <strong>guarded</strong> action. It will perform real side effects.
            {confirmAction?.action.supportsDryRun && (
              <> Consider running a <strong>dry run</strong> first if you haven't.</>
            )}
          </Alert>
          {confirmAction?.params && Object.keys(confirmAction.params).length > 0 && (
            <>
              <Typography variant="caption" sx={{ display: 'block', mt: 2, fontWeight: 700, color: 'text.secondary' }}>
                PARAMETERS
              </Typography>
              <Box component="pre" sx={{ fontSize: '0.75rem', m: 0, mt: 0.5, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                {JSON.stringify(confirmAction.params, null, 2)}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={actionRunning}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={actionRunning}
            onClick={() => executeAction(confirmAction.action, false, confirmAction.params)}
          >
            {actionRunning ? 'Running…' : 'Confirm & Run'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
