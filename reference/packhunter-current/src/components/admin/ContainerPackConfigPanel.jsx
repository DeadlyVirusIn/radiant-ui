/**
 * ContainerPackConfigPanel — admin per-container pack configuration.
 *
 * Renders one card per container (C1..C4). Each card carries:
 *   - Mode toggle: fixed | pool
 *   - Pack selector:
 *       fixed → single Autocomplete  (exactly 1 pack)
 *       pool  → multi-select chips    (1..maxPoolPacks)
 *   - Save / Clear buttons + inline validation
 *   - Last-updated audit visibility
 *
 * Backend contract (already shipped — webui/routes/containerPackConfig.js):
 *   GET    /api/admin/container-pack-config        list all 4 containers
 *   PUT    /api/admin/container-pack-config/:group set/update
 *   DELETE /api/admin/container-pack-config/:group clear (legacy fallback)
 *
 * The runtime worker resolves packs from this config FIRST (see
 * workers/headless-reroll-instance-worker.js getPackInfo). When a
 * container has NO row, the worker logs source='legacy_fallback' and
 * uses the existing default_pack/DYNAMIC path — backward compat preserved.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Grid,
  ToggleButton, ToggleButtonGroup,
  Autocomplete, TextField, Chip, Button, Alert, Snackbar,
  CircularProgress, Tooltip, Divider,
} from '@mui/material';
import {
  Save as SaveIcon,
  DeleteSweep as ClearIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  WarningAmber as WarnIcon,
  PeopleAlt as PeopleIcon,
} from '@mui/icons-material';
import { fetchWithAuth } from '../../services/api';

const CONTAINER_GROUPS = [1, 2, 3, 4];
const CONTAINER_COLORS = {
  1: '#4caf50',
  2: '#ff9800',
  3: '#2196f3',
  4: '#9c27b0',
};

export default function ContainerPackConfigPanel({ onChange } = {}) {
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [containers, setContainers] = useState([]);   // [{containerGroup, mode, packs, ...}]
  const [availablePacks, setAvailablePacks] = useState([]);
  const [maxPoolPacks, setMaxPoolPacks] = useState(10);
  const [pendingByGroup, setPendingByGroup] = useState({});  // { 1: { mode, packs, dirty } }
  const [savingGroup, setSavingGroup] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Per-container user demand. Map keyed by container_group:
  // { 1: { TOTAL: 9, byPack: { MEGA_SHINE: 9 } }, ... }
  // Used to render user counts next to pack options + flag zero-user picks.
  const [demandByGroup, setDemandByGroup] = useState({});

  const showSnack = (message, severity = 'success') =>
    setSnack({ open: true, message, severity });

  // ── Load all 4 containers + available packs ─────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setReloading(true);
    try {
      const r = await fetchWithAuth('/admin/container-pack-config');
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'load failed');
      setContainers(data.containers || []);
      setAvailablePacks(data.availablePacks || []);
      setMaxPoolPacks(data.maxPoolPacks || 10);
      // Reset pending edits after a successful reload.
      setPendingByGroup({});
    } catch (e) {
      showSnack(e.message || 'Failed to load per-container pack config', 'error');
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch per-container user demand once on mount + after every save
  // (demand can shift if a Bot Hub user joined since the panel opened).
  // Uses the same /api/hunt/distribution?containerGroup=N route the
  // Hunt Monitor uses, so the numbers shown here MATCH what Hunt Monitor
  // uses for alignment computation.
  const loadDemand = useCallback(async () => {
    const next = {};
    await Promise.all([1, 2, 3, 4].map(async g => {
      try {
        const r = await fetchWithAuth(`/hunt/distribution?containerGroup=${g}`);
        if (!r.ok) return;
        const d = await r.json();
        const byPack = {};
        for (const [name, count] of Object.entries(d.userCountByPack || {})) {
          byPack[String(name).toUpperCase()] = Number(count) || 0;
        }
        next[g] = { TOTAL: Number(d.totalUsers) || 0, byPack };
      } catch { /* per-container failure is non-fatal */ }
    }));
    setDemandByGroup(next);
  }, []);
  useEffect(() => { loadDemand(); }, [loadDemand]);

  // ── Per-card helpers (operate on the pending-edit shadow state) ─────
  const cardState = useCallback((group) => {
    const saved = containers.find(c => c.containerGroup === group);
    const pending = pendingByGroup[group];
    return {
      saved,
      // Effective values shown in UI = pending if dirty, else saved.
      mode: pending?.mode ?? saved?.mode ?? 'fixed',
      packs: pending?.packs ?? saved?.packs ?? [],
      isConfigured: !!saved?.mode,  // true when a row exists
      dirty: !!pending?.dirty,
    };
  }, [containers, pendingByGroup]);

  const updateCard = (group, patch) => {
    setPendingByGroup(prev => ({
      ...prev,
      [group]: {
        ...cardState(group),
        ...prev[group],
        ...patch,
        dirty: true,
      },
    }));
  };

  const setMode = (group, nextMode) => {
    if (!nextMode) return;
    const cur = cardState(group);
    let nextPacks = cur.packs;
    if (nextMode === 'fixed' && cur.packs.length > 1) {
      // Mode switch pool→fixed with multiple packs: keep only the first.
      // User has to confirm-by-saving so this isn't destructive without
      // their action; we surface an inline note.
      nextPacks = cur.packs.slice(0, 1);
    }
    updateCard(group, { mode: nextMode, packs: nextPacks });
  };

  const setPacks = (group, nextPacks) => {
    const cur = cardState(group);
    if (cur.mode === 'pool' && nextPacks.length > maxPoolPacks) return;
    if (cur.mode === 'fixed' && nextPacks.length > 1) {
      nextPacks = nextPacks.slice(-1);  // fixed = at most 1; keep latest pick
    }
    updateCard(group, { packs: nextPacks });
  };

  // ── Validation per card ─────────────────────────────────────────────
  const validateCard = (group) => {
    const cur = cardState(group);
    if (!cur.mode) return 'mode is required';
    if (cur.packs.length === 0) return 'select at least 1 pack';
    if (cur.mode === 'fixed' && cur.packs.length !== 1) {
      return `fixed mode requires exactly 1 pack (selected ${cur.packs.length}); remove ${cur.packs.length - 1}`;
    }
    if (cur.mode === 'pool' && cur.packs.length > maxPoolPacks) {
      return `pool mode supports at most ${maxPoolPacks} packs`;
    }
    return null;  // valid
  };

  // ── Save / clear ────────────────────────────────────────────────────
  const save = async (group) => {
    const cur = cardState(group);
    const err = validateCard(group);
    if (err) { showSnack(`C${group}: ${err}`, 'error'); return; }
    setSavingGroup(group);
    try {
      const r = await fetchWithAuth(`/admin/container-pack-config/${group}`, {
        method: 'PUT',
        body: JSON.stringify({ mode: cur.mode, packs: cur.packs }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'save failed');
      showSnack(`C${group} saved: ${cur.mode} (${cur.packs.length} pack${cur.packs.length > 1 ? 's' : ''})`);
      await load(true);
      loadDemand();
      if (typeof onChange === 'function') { try { onChange(); } catch { /* parent refresh is best-effort */ } }
    } catch (e) {
      showSnack(`C${group}: ${e.message}`, 'error');
    } finally {
      setSavingGroup(null);
    }
  };

  const clear = async (group) => {
    if (!window.confirm(`Clear container C${group} pack config? Workers will fall back to legacy default_pack/DYNAMIC behavior on next batch.`)) {
      return;
    }
    setSavingGroup(group);
    try {
      const r = await fetchWithAuth(`/admin/container-pack-config/${group}`, { method: 'DELETE' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || 'clear failed');
      showSnack(`C${group} config cleared — default routing active`);
      await load(true);
      loadDemand();
      if (typeof onChange === 'function') { try { onChange(); } catch { /* parent refresh is best-effort */ } }
    } catch (e) {
      showSnack(`C${group}: ${e.message}`, 'error');
    } finally {
      setSavingGroup(null);
    }
  };

  // ── Find Pack option helpers (Autocomplete needs the option object) ─
  const packOption = useCallback(
    (name) => availablePacks.find(p => p.name === name) || { name, label: name, expansion: '?' },
    [availablePacks]
  );
  const fixedValue = (cur) => (cur.packs[0] ? packOption(cur.packs[0]) : null);
  const poolValues = (cur) => cur.packs.map(packOption);

  // ── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  const anyConfigured = containers.some(c => c.mode);

  return (
    <Paper sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>Per-Container Pack Configuration</Typography>
        <Tooltip title="Workers consult this config FIRST. When a container has no row, runtime falls back to legacy default_pack/DYNAMIC behavior and logs source=legacy_fallback.">
          <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => load(true)}
          disabled={reloading}
        >
          Reload
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Each container resolves its pack INDEPENDENTLY. <b>Fixed</b> = container always opens that one pack.{' '}
        <b>Pool</b> = container picks uniformly at random from the configured list each batch. Cross-container leakage is impossible
        — workers query their own container_group only.
      </Typography>

      {!anyConfigured && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {/* Phase 5.18 — wording fix. The pre-Phase-5.18 copy implied
              "legacy fallback" was a routing prison. Reality: any
              container can run any pack — operator picks via the cards
              below. With no config saved, routing falls back to the
              hardcoded role assignment (still works, but explicit
              config is recommended now that B3 is live). */}
          No per-container pack config set yet — every container can run any pack.
          Pick the packs each container should accept below; saved config takes precedence
          over the default routing.
        </Alert>
      )}

      <Grid container spacing={2}>
        {CONTAINER_GROUPS.map(group => {
          const cur = cardState(group);
          const validationError = validateCard(group);
          const canSave = cur.dirty && !validationError && !savingGroup;
          const containerColor = CONTAINER_COLORS[group];
          return (
            <Grid item xs={12} md={6} key={group}>
              <Card
                variant="outlined"
                sx={{
                  borderLeft: `4px solid ${containerColor}`,
                  opacity: savingGroup === group ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <CardContent>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: containerColor }}>
                      Container C{group}
                    </Typography>
                    {/* Phase 5.18 — neutral "Not configured" chip
                        replaces the misleading "Legacy fallback"
                        which implied this container was locked to
                        legacy packs. Every container can run any
                        operator-selected pack now. */}
                    {cur.isConfigured ? (
                      <Chip label="Configured" size="small" color="success" sx={{ height: 18, fontSize: '0.6rem' }} />
                    ) : (
                      <Chip label="Not configured" size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                    )}
                    {cur.dirty && (
                      <Chip label="Unsaved" size="small" color="warning" sx={{ height: 18, fontSize: '0.6rem' }} />
                    )}
                  </Box>

                  {/* Mode toggle */}
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                      Mode
                    </Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={cur.mode}
                      onChange={(_, v) => setMode(group, v)}
                      aria-label={`C${group} mode`}
                    >
                      <ToggleButton value="fixed" aria-label="fixed mode">
                        Fixed&nbsp;<Typography variant="caption" sx={{ ml: 0.5, opacity: 0.7 }}>(1 pack)</Typography>
                      </ToggleButton>
                      <ToggleButton value="pool" aria-label="pool mode">
                        Pool&nbsp;<Typography variant="caption" sx={{ ml: 0.5, opacity: 0.7 }}>(random of N)</Typography>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {/* Pack selector */}
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                      {cur.mode === 'fixed' ? 'Pack' : `Packs (${cur.packs.length}/${maxPoolPacks})`}
                    </Typography>
                    {(() => {
                      // Per-container demand for THIS card, used to label
                      // each option with its user count and color-flag
                      // zero-user picks. Sorted top-demand first so
                      // operators see the obvious choices at the top.
                      const demand = demandByGroup[group]?.byPack || {};
                      const sortedOptions = [...availablePacks].sort((a, b) => {
                        const ua = Number(demand[String(a.name).toUpperCase()]) || 0;
                        const ub = Number(demand[String(b.name).toUpperCase()]) || 0;
                        return ub - ua;
                      });
                      const renderOption = (props, opt) => {
                        const users = Number(demand[String(opt.name).toUpperCase()]) || 0;
                        const hasUsers = users > 0;
                        return (
                          <li {...props} key={opt.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Typography sx={{ fontSize: '0.8rem', flex: 1 }}>
                                {opt.label || opt.name}
                              </Typography>
                              <Chip
                                icon={hasUsers ? <PeopleIcon sx={{ fontSize: 11 }} /> : <WarnIcon sx={{ fontSize: 11 }} />}
                                label={hasUsers ? `${users} user${users === 1 ? '' : 's'}` : '0 users'}
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.6rem', fontWeight: 700,
                                  bgcolor: hasUsers ? 'rgba(76,175,80,0.15)' : 'rgba(251,191,36,0.15)',
                                  color: hasUsers ? '#4caf50' : '#fbbf24',
                                  '& .MuiChip-icon': { color: hasUsers ? '#4caf50' : '#fbbf24' },
                                }}
                              />
                            </Box>
                          </li>
                        );
                      };

                      return cur.mode === 'fixed' ? (
                        <Autocomplete
                          size="small"
                          options={sortedOptions}
                          getOptionLabel={p => p?.label || p?.name || ''}
                          isOptionEqualToValue={(o, v) => o?.name === v?.name}
                          value={fixedValue(cur)}
                          onChange={(_, v) => setPacks(group, v ? [v.name] : [])}
                          renderOption={renderOption}
                          renderInput={params => (
                            <TextField {...params} placeholder="Select 1 pack…" />
                          )}
                        />
                      ) : (
                        <Autocomplete
                          multiple
                          size="small"
                          options={sortedOptions}
                          getOptionLabel={p => p?.label || p?.name || ''}
                          isOptionEqualToValue={(o, v) => o?.name === v?.name}
                          value={poolValues(cur)}
                          onChange={(_, v) => setPacks(group, v.map(p => p.name))}
                          renderOption={renderOption}
                          renderTags={(value, getTagProps) =>
                            value.map((opt, i) => {
                              const users = Number(demand[String(opt.name).toUpperCase()]) || 0;
                              return (
                                <Chip
                                  key={opt.name}
                                  size="small"
                                  label={`${opt.label || opt.name} · ${users}u`}
                                  {...getTagProps({ index: i })}
                                  sx={{
                                    bgcolor: users > 0 ? 'rgba(76,175,80,0.12)' : 'rgba(251,191,36,0.12)',
                                    color: users > 0 ? '#4caf50' : '#fbbf24',
                                    border: `1px solid ${users > 0 ? 'rgba(76,175,80,0.3)' : 'rgba(251,191,36,0.3)'}`,
                                  }}
                                />
                              );
                            })
                          }
                          renderInput={params => (
                            <TextField {...params} placeholder={cur.packs.length === 0 ? 'Select 1 or more packs…' : ''} />
                          )}
                        />
                      );
                    })()}
                  </Box>

                  {/* Zero-user picks warning — non-blocking. Lists the
                      currently-selected packs that have NO active users
                      in this container so the admin sees the mismatch
                      before saving. They CAN save anyway (sometimes
                      intentional), just with eyes open. */}
                  {(() => {
                    const demand = demandByGroup[group]?.byPack || {};
                    const zeroUserPicks = (cur.packs || []).filter(name => {
                      const u = Number(demand[String(name).toUpperCase()]) || 0;
                      return u === 0;
                    });
                    if (zeroUserPicks.length === 0) return null;
                    const totalUsers = demandByGroup[group]?.TOTAL || 0;
                    return (
                      <Alert
                        severity="warning"
                        icon={<WarnIcon sx={{ fontSize: 16 }} />}
                        sx={{ mb: 1.5, py: 0.5, fontSize: '0.7rem' }}
                      >
                        {zeroUserPicks.length === 1
                          ? <>This pack currently has no active users in this container: <strong>{zeroUserPicks[0].replace(/_/g, ' ')}</strong>.</>
                          : <><strong>{zeroUserPicks.length} packs</strong> have no active users in C{group}: {zeroUserPicks.map(p => p.replace(/_/g, ' ')).join(', ')}.</>}
                        {totalUsers > 0 && <> Workers rolling these will find no friend targets.</>}
                      </Alert>
                    );
                  })()}

                  {/* Inline validation */}
                  {validationError && (
                    <Alert severity="warning" sx={{ mb: 1.5, fontSize: '0.75rem', py: 0.5 }}>
                      {validationError}
                    </Alert>
                  )}

                  {/* Audit visibility */}
                  {cur.saved?.updatedAt && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.5 }}>
                      Last set by {cur.saved.updatedBy || 'unknown'} at{' '}
                      {new Date(cur.saved.updatedAt).toLocaleString()}
                    </Typography>
                  )}

                  {/* Action buttons */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={() => save(group)}
                      disabled={!canSave}
                    >
                      {savingGroup === group ? 'Saving…' : 'Save'}
                    </Button>
                    {cur.isConfigured && (
                      <Button
                        size="small"
                        color="error"
                        startIcon={<ClearIcon />}
                        onClick={() => clear(group)}
                        disabled={savingGroup === group}
                      >
                        Clear config
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
