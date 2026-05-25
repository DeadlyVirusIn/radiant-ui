/**
 * RecoveryStrip — compact Fleet Health recovery status surface.
 *
 *  [Mode: dry-run] [3 pending] [1 failed] [0 escalated]  [Kill switch] [Manage]
 *
 * Expands on click to show the latest N audit entries so ops can see
 * exactly what the engine has been recommending/doing without leaving
 * Fleet Health. No prompt()/confirm(); everything is direct buttons.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Button, IconButton, Tooltip,
  Collapse, Alert, CircularProgress, List, ListItem, ListItemText,
  FormControl, Select, MenuItem,
} from '@mui/material';
import {
  HealthAndSafety as RecoveryIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  PowerSettingsNew as KillIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import StatusDot from './StatusDot';
import { computeAutoRestartState, AUTO_RESTART_TOOLTIP } from '../../utils/autoRestartState';
import {
  MODE_LABEL, MODE_LABEL_CANONICAL, IMPACT_LABEL, MODE_COLOR, ACTION_LABEL, RISK_LABEL, RISK_COLOR,
  ACTION_CATEGORY, CATEGORY_LABEL,
  summarizeRecoveryState,
} from '../../utils/recoveryStatus';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getJson(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function RecoveryStrip() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);       // /recovery/state response
  const [audit, setAudit] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Last tick outcome — surfaced inline so Dry-run is never a silent
  // no-op. Shape mirrors the runRecoveryTick() return value:
  //   { mode, considered, planned, executed, suppressedByActiveGroup,
  //     activeGroups, decisions: [{entityId, issueType, action, reason}],
  //     skipped?: 'startup-grace'|'mode-off'|'overlap', error? }
  const [tickResult, setTickResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Phase 25G — backend returns 503 with { ready: false } during
      // boot restore. Treat that as a distinct "initializing" state
      // (not as data) so the UI does NOT default to Off while the
      // persisted mode is still being read.
      const res = await fetch('/api/admin/recovery/state', { credentials: 'include' });
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        setData({ __initializing: true, ...body });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const st = await res.json();
      setData(st);
      if (expanded) {
        const a = await getJson('/api/admin/recovery/audit?limit=25');
        setAudit(a.audit || []);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load recovery state');
    } finally {
      setLoading(false);
    }
  }, [expanded]);

  useEffect(() => { load(); }, [load]);

  // Refresh every 30s. Mode changes + actions land inside 2 ticks anyway.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const onSetMode = async (mode) => {
    setBusy(true);
    try {
      await postJson('/api/admin/recovery/mode', { mode });
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to set mode');
    } finally { setBusy(false); }
  };
  const onKill = async () => {
    setBusy(true);
    try {
      await postJson('/api/admin/recovery/kill');
      await load();
    } catch (err) { setError(err?.message || 'Kill failed'); }
    finally { setBusy(false); }
  };
  const onAck = async (entry) => {
    setBusy(true);
    try {
      await postJson('/api/admin/recovery/ack', {
        entityType: entry.entityType, entityId: entry.entityId, issueType: entry.issueType,
      });
      await load();
    } catch (err) { setError(err?.message || 'Ack failed'); }
    finally { setBusy(false); }
  };
  const onTick = async () => {
    setBusy(true);
    setError(null);
    try {
      // Capture tick response so we can render a concrete outcome.
      // Previously this was `await postJson(...)` with the return
      // value discarded — so admins saw nothing after clicking Tick,
      // which looked broken even when the engine had evaluated every
      // participant.
      const res = await postJson('/api/admin/recovery/tick');
      setTickResult({ ...res, at: Date.now() });
      // Auto-expand so freshly-recorded audit rows are visible.
      setExpanded(true);
      await load();
    } catch (err) {
      setError(err?.message || 'Tick failed');
      setTickResult({ error: err?.message || 'Tick failed', at: Date.now() });
    }
    finally { setBusy(false); }
  };

  // Phase 25G — initializing means boot restore hasn't finished;
  // do NOT fall back to 'off' (that's the bug we're fixing). Show
  // an explicit initializing pill until ready=true.
  const initializing = !!data?.__initializing;
  const mode = initializing ? null : (data?.mode || 'off');
  const counts = summarizeRecoveryState(data?.entries || []);
  const escalated = (data?.entries || []).filter(e => e.escalated);

  // Phase 25G — persistence/boot truth fields. Used for the banner
  // that explains *why* the mode is what it is (restored vs fresh
  // vs restore-failed).
  const restoredFromPersistence = data?.restored_from_persistence === true;
  const restoredAt              = data?.restored_at || null;
  const lastChangedAt           = data?.last_changed_at || null;
  const lastChangedBy           = data?.last_changed_by || null;
  const lastRestoreError        = data?.last_restore_error || null;
  const initSource              = data?.init_source || null;
  // Phase 25H — auto-retry authority truth fields.
  // 2026-04-24 — also flow through the shared selector so this
  // component and Hunt Ops compute identical state from the same
  // payload. Kept the explicit named reads above for back-compat with
  // downstream code in this file that still references them verbatim.
  const effectiveAutoRetryEnabled = data?.effectiveAutoRetryEnabled === true;
  const envAutoRetryFlag          = data?.envAutoRetryFlag === true;
  const autoRetryConflict         = data?.autoRetryConflict || null;
  const autoRestart               = computeAutoRestartState(data);
  const containerGroups           = data?.containerRecovery?.groups || {};
  const lastEvalAt                = data?.lastEvalAt || null;
  // Render an explicit explanation when mode is OFF so OFF is never
  // implicitly assumed to be "operator intent".
  const offReason =
    !initializing && mode === 'off' && initSource === 'restore-failed'
      ? 'restore_failed'
    : !initializing && mode === 'off' && initSource === 'fresh-default'
      ? 'never_persisted'
    : !initializing && mode === 'off' && initSource === 'persistence'
      ? 'operator_set'
    : null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mb: 2, borderRadius: 1.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <RecoveryIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ mr: 0.5 }}>Self-healing</Typography>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select
            value={initializing ? '' : mode}
            displayEmpty
            disabled={busy || loading || initializing}
            onChange={(e) => onSetMode(e.target.value)}
            renderValue={(v) => {
              if (initializing) return <em>Initializing…</em>;
              return v ? (MODE_LABEL[v] || v) : '';
            }}
          >
            <MenuItem value="off">Off</MenuItem>
            <MenuItem value="dry-run">Dry-run</MenuItem>
            {/* Phase 25A — Assist Mode: executes ONLY low-risk actions;
                medium/high-risk decisions remain recommendations. */}
            <MenuItem value="assist">Assist</MenuItem>
            <MenuItem value="live-safe">Live (safe)</MenuItem>
          </Select>
        </FormControl>

        {initializing ? (
          <Chip
            size="small"
            color="info"
            variant="outlined"
            label="Restoring mode…"
            icon={<CircularProgress size={10} sx={{ ml: 0.5 }} />}
          />
        ) : (
          <>
            {/* C5 (2026-04-24) — two-field status: Mode (canonical upper-
                case) + Impact, mirroring OpsHealthSummary and
                RecoveryStatusPanel so all three surfaces read the same. */}
            <Chip
              size="small"
              label={`Recovery Mode: ${MODE_LABEL_CANONICAL[mode] || MODE_LABEL[mode] || '—'}`}
              color={MODE_COLOR[mode]}
              variant={mode === 'off' ? 'outlined' : 'filled'}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Impact: ${IMPACT_LABEL[mode] || 'Unknown'}`}
              color={MODE_COLOR[mode] === 'default' ? 'default' : MODE_COLOR[mode]}
            />
          </>
        )}

        {/* Phase 25G — persistence-source pill. Visible whenever the
         * mode came from durable storage (vs. fresh default or failed
         * restore). Lets operators verify "yes, my last selection
         * survived the reboot". */}
        {!initializing && restoredFromPersistence && (
          <Tooltip title={
            `Restored from durable storage at ${restoredAt ? new Date(restoredAt).toLocaleTimeString() : 'boot'}`
            + (lastChangedBy ? ` · last changed by ${lastChangedBy}` : '')
          }>
            <Chip size="small" color="success" variant="outlined"
                  label="Restored on boot" sx={{ height: 22 }} />
          </Tooltip>
        )}

        {/* Phase 25H — derived auto-retry authority pill. The C4
         * incident root cause was that this state was hidden behind
         * an env var. Now it's a first-class UI signal.
         *
         * 2026-04-24 — consumes the shared computeAutoRestartState
         * selector so Fleet Health and Hunt Ops agree. Three explicit
         * states: ENABLED / ENABLED (override) / OFF. */}
        {!initializing && (
          <Tooltip title={AUTO_RESTART_TOOLTIP}>
            <Chip
              size="small"
              color={autoRestart.effective ? (autoRestart.isOverride ? 'info' : 'success') : 'warning'}
              variant={autoRestart.effective && !autoRestart.isOverride ? 'filled' : 'outlined'}
              label={
                autoRestart.state === 'override'
                  ? 'Auto-restart: ENABLED (override)'
                  : autoRestart.state === 'enabled'
                    ? 'Auto-restart: ENABLED'
                    : 'Auto-restart: OFF'
              }
              sx={{ height: 22, fontWeight: 600 }}
            />
          </Tooltip>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 1, flexWrap: 'wrap' }}>
          <MiniCount state="warning"  label="pending"    value={counts.pending} />
          <MiniCount state="warning"  label="failed"     value={counts.failed}  />
          <MiniCount state="error"    label="escalated"  value={counts.escalated} />
          <MiniCount state="idle"     label="tracked"    value={counts.total} />
        </Box>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Run tick now (dry-run will record recommendations; live-safe will execute)">
          <span>
            <Button size="small" variant="outlined" onClick={onTick}
                    disabled={busy || mode === 'off'}
                    startIcon={busy ? <CircularProgress size={12} /> : <RefreshIcon />}>
              Tick
            </Button>
          </span>
        </Tooltip>

        <Tooltip title="Force mode to Off (kill switch)">
          <span>
            <Button size="small" variant="outlined" color="error" onClick={onKill}
                    disabled={busy || mode === 'off'}
                    startIcon={<KillIcon />}>
              Kill
            </Button>
          </span>
        </Tooltip>

        <IconButton size="small" onClick={() => setExpanded(v => !v)} aria-label="Toggle audit">
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 2026-04-24 — WHAT HAPPENS NEXT line. Single canonical line
          driven by the backend fleet-level summary. Identical source
          to Hunt Ops per-container chips, worst-of across the fleet.
          Never recomputes policy in React.
          Phase 3 — adds confidence badge + predictive caption. */}
      {data?.nextRecoveryActionSummary && (
        <Box sx={{
          mt: 1, px: 1.5, py: 0.6, borderRadius: 1,
          border: 1, borderColor: 'divider',
          display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap',
        }}>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary' }}>
            What happens next
          </Typography>
          <Chip
            size="small"
            label={data.nextRecoveryActionSummary.label}
            color={
              data.nextRecoveryActionSummary.severity === 'success' ? 'success'
              : data.nextRecoveryActionSummary.severity === 'info' ? 'info'
              : data.nextRecoveryActionSummary.severity === 'warning' ? 'warning'
              : data.nextRecoveryActionSummary.severity === 'error' ? 'error'
              : 'default'
            }
            variant="outlined"
          />
          {data.nextRecoveryActionSummary.confidence && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              (confidence: {data.nextRecoveryActionSummary.confidence})
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {data.nextRecoveryActionSummary.subtext || data.nextRecoveryActionSummary.reason}
          </Typography>
          {/* Phase 3 — predictive enhancement. Only shown when there
              is actual forward-looking signal (likely/imminent). */}
          {data.nextRecoveryActionSummary.restartLikelihood
            && data.nextRecoveryActionSummary.restartLikelihood !== 'none'
            && data.nextRecoveryActionSummary.restartLikelihood !== 'possible' && (
            <Typography variant="caption" sx={{
              fontWeight: 600,
              color: data.nextRecoveryActionSummary.restartLikelihood === 'imminent' ? 'error.main' : 'warning.main',
            }}>
              {data.nextRecoveryActionSummary.restartLikelihood === 'imminent'
                ? (data.nextRecoveryActionSummary.predictedEtaSeconds != null
                    ? `Restart imminent (~${data.nextRecoveryActionSummary.predictedEtaSeconds}s)`
                    : 'Restart imminent')
                : (data.nextRecoveryActionSummary.predictedEtaSeconds != null
                    ? `Restart likely if no progress in ~${data.nextRecoveryActionSummary.predictedEtaSeconds}s`
                    : 'Restart likely')}
            </Typography>
          )}
        </Box>
      )}

      {/* Phase 25G — boot-restore degraded banner. Surfaced when the
       * persistence layer failed at boot. Loud + non-dismissable so
       * the operator cannot mistake silent OFF for "I selected OFF". */}
      {lastRestoreError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          <Typography variant="subtitle2">
            Self-healing mode boot restore FAILED
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {lastRestoreError} — current mode is a fallback, not your
            last selection. Fix the underlying error and restart, or
            re-set the mode manually.
          </Typography>
        </Alert>
      )}

      {/* Phase 25G — explain WHY mode is OFF. The bug we're fixing
       * was that a transient OFF was indistinguishable from an
       * operator-chosen OFF. Now every OFF state has a reason. */}
      {!initializing && mode === 'off' && offReason === 'never_persisted' && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Self-healing is OFF because no persisted value exists yet.
          Choose Dry-run / Assist / Live (safe) to start; the choice
          will be remembered across restarts.
        </Alert>
      )}
      {!initializing && mode === 'off' && offReason === 'operator_set' && lastChangedBy && (
        <Typography variant="caption" color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, ml: 1 }}>
          Off — set by <strong>{lastChangedBy}</strong>
          {lastChangedAt && <> at {new Date(lastChangedAt).toLocaleString()}</>}.
        </Typography>
      )}

      {!initializing && lastChangedAt && mode !== 'off' && (
        <Typography variant="caption" color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, ml: 1 }}>
          Last changed {new Date(lastChangedAt).toLocaleString()}
          {lastChangedBy && <> by <strong>{lastChangedBy}</strong></>}.
        </Typography>
      )}

      {/* Phase 25H — env vs mode conflict warning. Visible when env
       * CONTAINER_AUTO_RETRY=OFF but mode authorizes restarts. The
       * mode wins (Option A), but the operator must be told the env
       * disagrees so the next deploy can be cleaned up. */}
      {!initializing && autoRetryConflict === 'override' && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="caption">
            ⚠ Env <code>CONTAINER_AUTO_RETRY</code> is OFF but overridden by
            recovery mode <strong>{mode}</strong>. Restarts will run from mode authority.
            Update <code>docker-compose.yml</code> on next deploy to remove the stale env entry.
          </Typography>
        </Alert>
      )}

      {/* Phase 25H — per-container observability table. Always present
       * when expanded; renders the latest decision the engine made for
       * each hunt container. Eliminates "engine is silent" mystery. */}
      {expanded && Object.keys(containerGroups).length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Container recovery — last evaluation
            {lastEvalAt && <> ({new Date(lastEvalAt).toLocaleTimeString()})</>}
          </Typography>
          <List dense disablePadding>
            {Object.keys(containerGroups).sort().map(g => {
              const d = containerGroups[g] || {};
              const eligibleColor = d.eligible ? 'success' : 'default';
              const executedColor = d.executed ? 'success'
                                  : (d.blockedReasons?.length > 0 ? 'warning' : 'default');
              return (
                <ListItem key={g} disablePadding sx={{ py: 0.25, alignItems: 'flex-start' }}>
                  <ListItemText
                    primary={
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        <strong>G{g}</strong>
                        {' · '}<Chip size="small" label={d.state || 'unknown'}
                                     sx={{ height: 16, fontSize: '0.6rem' }} />
                        {d.eligible !== undefined && (
                          <> · <Chip size="small" color={eligibleColor}
                                     label={d.eligible ? 'eligible' : 'not-eligible'}
                                     sx={{ height: 16, fontSize: '0.6rem' }} /></>
                        )}
                        {d.executed !== undefined && (
                          <> · <Chip size="small" color={executedColor}
                                     label={d.executed ? `executed: ${d.action}` : 'no-action'}
                                     sx={{ height: 16, fontSize: '0.6rem' }} /></>
                        )}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary"
                                  sx={{ display: 'block', fontFamily: 'monospace' }}>
                        {d.reason && <>reason: {d.reason} · </>}
                        {d.heartbeatAgeSec != null && <>beat {d.heartbeatAgeSec}s · </>}
                        {d.dataAgeSec != null && <>data {d.dataAgeSec}s · </>}
                        {Array.isArray(d.blockedReasons) && d.blockedReasons.length > 0 && (
                          <>blocked: {d.blockedReasons.join(', ')} · </>
                        )}
                        {d.cooldownRemainingMs > 0 && (
                          <>cooldown {Math.round(d.cooldownRemainingMs / 1000)}s · </>
                        )}
                        {d.error && <>error: {d.error}</>}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}

      {/* Tick outcome — rendered after clicking Tick so dry-run /
       * assist are never silent no-ops. Surfaces the full engine
       * return shape so admins can see exactly what ran, what was
       * suppressed, and why. Self-dismisses when replaced. */}
      {tickResult && !error && (() => {
        // Phase 25A — severity reflects assist's primary axis:
        //   executedLowRisk > 0   → success (low-risk auto-actions landed)
        //   suppressedHighRisk>0  → warning (operator-grade decisions held back)
        //   skipped               → warning
        //   error                 → error
        //   else                  → info (neutral / nothing to do)
        const lowExec = tickResult.executedLowRisk ?? 0;
        const highSup = tickResult.suppressedHighRisk ?? 0;
        const sev = tickResult.error ? 'error'
                  : tickResult.skipped ? 'warning'
                  : lowExec > 0 ? 'success'
                  : highSup > 0 ? 'warning'
                  : 'info';
        return (
        <Alert
          severity={sev}
          sx={{ mt: 1 }}
          onClose={() => setTickResult(null)}
        >
          <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
            Tick — {new Date(tickResult.at).toLocaleTimeString()}
          </Typography>
          {tickResult.skipped ? (
            <Typography variant="caption" sx={{ display: 'block' }}>
              Skipped: <strong>{tickResult.skipped}</strong>
              {tickResult.skipped === 'startup-grace' && ' — engine is still inside its startup grace window; try again shortly.'}
              {tickResult.skipped === 'mode-off' && ' — self-healing mode is Off. Switch to Dry-run or Assist to evaluate.'}
              {tickResult.skipped === 'overlap' && ' — another tick is still running; this one was coalesced.'}
            </Typography>
          ) : tickResult.error ? (
            <Typography variant="caption">Error: {tickResult.error}</Typography>
          ) : (
            <>
              <Typography variant="caption" sx={{ display: 'block' }}>
                Mode <strong>{tickResult.mode}</strong>
                {' · '}considered <strong>{tickResult.considered ?? 0}</strong>
                {' · '}planned <strong>{tickResult.planned ?? 0}</strong>
                {' · '}executed <strong>{tickResult.executed ?? 0}</strong>
                {(tickResult.suppressedByActiveGroup ?? tickResult.suppressed ?? 0) > 0 && (
                  <> · suppressed <strong>{tickResult.suppressedByActiveGroup ?? tickResult.suppressed}</strong> (busy container)</>
                )}
              </Typography>

              {/* Phase 25A / 25A.1 — Assist-specific counters. Only
               * rendered when the engine reports them, so other modes
               * are unchanged visually. Two rows: the low/high risk
               * split (what Assist chose to do vs hold back) and the
               * resolved/refreshed breakdown (what that work actually
               * produced for the fleet). */}
              {(lowExec > 0 || highSup > 0) && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                  {lowExec > 0 && (
                    <Chip size="small" color="success" variant="outlined"
                          label={`Low-risk executed: ${lowExec}`}
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                  )}
                  {highSup > 0 && (
                    <Chip size="small" color="warning" variant="outlined"
                          label={`High-risk suppressed: ${highSup}`}
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                  )}
                </Box>
              )}

              {/* Phase 25A.1 — value-delivered chips. These are the
               * numbers that answer "did Assist do anything useful?"
               * in plain language: issues resolved + states refreshed.
               * Phase 25A.2 adds a third chip for REAL improvements
               * (state transitions) so admins can see a signal that
               * excludes pure observational probes. */}
              {((tickResult.resolvedCount ?? 0) > 0
                || (tickResult.refreshedCount ?? 0) > 0
                || (tickResult.improvedCount ?? 0) > 0) && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
                  {(tickResult.resolvedCount ?? 0) > 0 && (
                    <Chip size="small" color="success" variant="filled"
                          label={`Issues resolved: ${tickResult.resolvedCount}`}
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                  )}
                  {(tickResult.improvedCount ?? 0) > 0 && (
                    <Chip size="small" color="success" variant="outlined"
                          label={`System improved: ${tickResult.improvedCount}`}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }} />
                  )}
                  {(tickResult.refreshedCount ?? 0) > 0 && (
                    <Chip size="small" color="info" variant="filled"
                          label={`State refreshed: ${tickResult.refreshedCount}`}
                          sx={{ height: 20, fontSize: '0.65rem' }} />
                  )}
                </Box>
              )}

              {/* Phase 25A.2 — human-readable headline. "System
               * improved" is the leading signal when Assist actually
               * transitioned state (not just observed). Falls back
               * to the 25A.1 language when nothing improved but
               * something still happened. */}
              {(tickResult.mode === 'assist' &&
                ((tickResult.resolvedCount ?? 0) > 0
                 || (tickResult.refreshedCount ?? 0) > 0
                 || (tickResult.improvedCount ?? 0) > 0)) && (
                <Typography variant="caption" color="success.main"
                            sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                  {(tickResult.improvedCount ?? 0) > 0
                    ? `Assist improved ${tickResult.improvedCount} system ${tickResult.improvedCount === 1 ? 'state' : 'states'}`
                    : `Assist executed ${tickResult.executedLowRisk ?? 0} low-risk ${((tickResult.executedLowRisk ?? 0) === 1) ? 'recovery' : 'recoveries'}`}
                  {(tickResult.resolvedCount ?? 0) > 0 && (
                    <> · {tickResult.resolvedCount} {(tickResult.resolvedCount === 1) ? 'issue' : 'issues'} resolved</>
                  )}
                  {(tickResult.refreshedCount ?? 0) > 0 && (
                    <> · {tickResult.refreshedCount} {(tickResult.refreshedCount === 1) ? 'state' : 'states'} refreshed</>
                  )}
                </Typography>
              )}

              {Array.isArray(tickResult.activeGroups) && tickResult.activeGroups.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Active container groups: {tickResult.activeGroups.sort().map(g => `G${g}`).join(', ')}
                </Typography>
              )}

              {Array.isArray(tickResult.decisions) && tickResult.decisions.length > 0 ? (
                <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
                  {tickResult.decisions.slice(0, 5).map((d, i) => {
                    const actionKey = d.actionType || d.action;
                    const risk = d.riskLevel || 'none';
                    // Phase 25A.2 — category pill ("Fixed" / "Improved"
                    // / "Checked") is rendered only when the action
                    // was actually executed, so recommendations don't
                    // claim credit for work they didn't do.
                    const category = d.executed ? ACTION_CATEGORY[actionKey] : null;
                    const categoryColor =
                      category === 'fixed'    ? 'success'
                    : category === 'improved' ? 'success'
                    : category === 'checked'  ? 'info'
                    : 'default';
                    return (
                      <li key={i}>
                        <Typography variant="caption">
                          <strong>{d.entityId}</strong> · {d.issueType}
                          {' → '}
                          {ACTION_LABEL[actionKey] || actionKey}
                          {' '}
                          <Chip size="small"
                                label={d.executed ? `${RISK_LABEL[risk] || risk} · executed` : (RISK_LABEL[risk] || risk)}
                                color={d.executed ? 'success' : (RISK_COLOR[risk] || 'default')}
                                variant={d.executed ? 'filled' : 'outlined'}
                                sx={{ height: 16, fontSize: '0.55rem', ml: 0.5 }} />
                          {category && (
                            <Chip size="small"
                                  label={CATEGORY_LABEL[category]}
                                  color={categoryColor}
                                  variant={category === 'improved' ? 'filled' : 'outlined'}
                                  sx={{ height: 16, fontSize: '0.55rem', ml: 0.5 }} />
                          )}
                          {d.reason && <> · <em>{d.reason}</em></>}
                        </Typography>
                      </li>
                    );
                  })}
                  {tickResult.decisions.length > 5 && (
                    <li><Typography variant="caption" color="text.secondary">
                      …{tickResult.decisions.length - 5} more
                    </Typography></li>
                  )}
                </Box>
              ) : (
                (tickResult.planned ?? 0) === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    No actions needed — every hunter evaluated is either healthy or in a busy container group.
                  </Typography>
                )
              )}
            </>
          )}
        </Alert>
        );
      })()}

      {/* Escalations — always visible when present */}
      {escalated.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }} icon={<HistoryIcon />}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {escalated.length} escalated · manual review required
          </Typography>
          <List dense disablePadding>
            {escalated.slice(0, 5).map(e => (
              <ListItem key={`${e.entityType}:${e.entityId}:${e.issueType}`} disablePadding sx={{ py: 0.25 }}>
                <ListItemText
                  primary={
                    <Typography variant="caption">
                      <strong>{e.entityId}</strong> · {e.issueType} · {e.attempts?.length || 0} attempts
                    </Typography>
                  }
                />
                <Button size="small" onClick={() => onAck(e)}>Acknowledge</Button>
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Audit log */}
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="overline" color="text.secondary">Recent audit</Typography>
          {audit.length === 0 ? (
            <Typography variant="caption" color="text.secondary" display="block">
              No audit entries yet. Flip mode to Dry-run and run a tick to see recommendations.
            </Typography>
          ) : (
            <List dense disablePadding>
              {audit.map((row, i) => (
                <ListItem key={i} disablePadding sx={{ py: 0.1 }}>
                  <ListItemText
                    primary={
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                          {new Date(row.ts).toLocaleTimeString()}
                        </Box>
                        {' · '}
                        <Box component="span" sx={{ fontWeight: 600 }}>{row.event}</Box>
                        {row.entityId && <> · {row.entityType}/{row.entityId}</>}
                        {row.issueType && <> · {row.issueType}</>}
                        {row.action && <> · {ACTION_LABEL[row.action] || row.action}</>}
                        {row.mode && <> · [{row.mode}]</>}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

function MiniCount({ state, label, value }) {
  return (
    <Tooltip title={label} arrow>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
        <StatusDot state={state} size={8} glow={false} label={label} />
        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      </Box>
    </Tooltip>
  );
}
