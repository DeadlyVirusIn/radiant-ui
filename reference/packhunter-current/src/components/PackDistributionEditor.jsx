/**
 * Phase 24 Part 1 — Pack Distribution editor.
 *
 * Weighted allocation UI. User picks 2-5 packs and slides a weight for
 * each; totals must reach 100. Backend is /api/pack-distribution.
 *
 * Additive — NOT a replacement for the existing pack Autocomplete in
 * Bot Hub. Operators can use either:
 *   - Global checkbox selection (legacy — all selected packs treated
 *     equally at runtime)
 *   - Weighted distribution (this component — when set, workers for
 *     this container prefer higher-weighted packs proportionally)
 *
 * The distribution containerId is composed from user + accountType so
 * the user's "main" and "alt" accounts each have their own
 * distribution (independent rotations on one user's account set).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Slider, IconButton, Button, Chip, Alert, Stack,
  Autocomplete, TextField, CircularProgress, Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  AutoFixHigh as AutoIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Balance as BalanceIcon,
} from '@mui/icons-material';
import { fetchWithAuth } from '../services/api';

const MIN_PACKS = 2;
const MAX_PACKS = 5;
const WEIGHT_SUM = 100;

/**
 * @param {object} props
 * @param {string} props.containerId     e.g. `user_${userId}_${accountType}`
 * @param {Array<{name, expansion}>} props.availablePacks  full pack catalogue
 * @param {string} [props.title]         optional section title override
 */
export default function PackDistributionEditor({ containerId, availablePacks = [], title = 'Pack Distribution' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);   // [{ packId, weight }]
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [dirty, setDirty] = useState(false);

  // ─── Load current distribution ───────────────────────────────
  const load = useCallback(async () => {
    if (!containerId) return;
    setLoading(true); setError('');
    try {
      const r = await fetchWithAuth(`/pack-distribution?containerId=${encodeURIComponent(containerId)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'load failed');
      setRows(data.packs || []);
      setDirty(false);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [containerId]);
  useEffect(() => { load(); }, [load]);

  // ─── Row ops ──────────────────────────────────────────────────
  const addRow = () => {
    if (rows.length >= MAX_PACKS) return;
    // Pick the first unused pack by default so users don't see empty rows.
    const used = new Set(rows.map(r => r.packId));
    const unused = availablePacks.find(p => !used.has(p.name));
    if (!unused) { setError('No more available packs'); return; }
    let nextRows = [...rows, { packId: unused.name, weight: 0 }];
    // Phase 24 bug-fix: auto-equalize the moment we reach the minimum
    // pack count with an all-zero distribution. Without this, the Save
    // button is disabled with "total 0%" the instant the second row
    // appears — confusing because the user hasn't touched any slider
    // yet. Auto-equalize only triggers when no weights have been set,
    // so it never overrides intentional edits.
    if (nextRows.length >= MIN_PACKS && nextRows.every(r => !r.weight)) {
      const base = Math.floor(WEIGHT_SUM / nextRows.length);
      const remainder = WEIGHT_SUM - base * nextRows.length;
      nextRows = nextRows.map((r, i) => ({ ...r, weight: base + (i < remainder ? 1 : 0) }));
    }
    setRows(nextRows);
    setDirty(true);
    setError('');
  };
  const removeRow = (idx) => {
    setRows(rows.filter((_, i) => i !== idx));
    setDirty(true);
  };
  const updateRow = (idx, patch) => {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const validPackCount = rows.length >= MIN_PACKS && rows.length <= MAX_PACKS;
  const validSum = total === WEIGHT_SUM;
  const hasEmptyRow = rows.some(r => !r.packId);
  const canSave = dirty && validPackCount && validSum && !hasEmptyRow;

  // Phase 24 bug-fix: build a human-readable list of reasons the Save
  // button is disabled so the user never has to guess. Consumed by the
  // inline Alert next to Save.
  const disabledReasons = [];
  if (rows.length < MIN_PACKS) {
    disabledReasons.push(`Add at least ${MIN_PACKS} packs (currently ${rows.length}).`);
  } else if (rows.length > MAX_PACKS) {
    disabledReasons.push(`Remove packs — at most ${MAX_PACKS} allowed (currently ${rows.length}).`);
  }
  if (rows.length >= MIN_PACKS && !validSum) {
    disabledReasons.push(`Weights must total ${WEIGHT_SUM}% (currently ${total}%).`);
  }
  if (hasEmptyRow) {
    disabledReasons.push('Each row must select a pack.');
  }

  // ─── Fix-up helpers ──────────────────────────────────────────
  const normalizeToEqual = () => {
    if (rows.length === 0) return;
    const base = Math.floor(WEIGHT_SUM / rows.length);
    const remainder = WEIGHT_SUM - base * rows.length;
    setRows(rows.map((r, i) => ({ ...r, weight: base + (i < remainder ? 1 : 0) })));
    setDirty(true);
    setInfo('Weights normalized to equal distribution.');
  };

  const autoCalc = async () => {
    if (rows.length < MIN_PACKS) { setError(`Select at least ${MIN_PACKS} packs first`); return; }
    setSaving(true); setError('');
    try {
      // v1 backend autoWeights returns an equal-fallback when no
      // signals are provided. When future phases wire wishlist/success
      // data, pass it here.
      const r = await fetchWithAuth('/pack-distribution/auto', {
        method: 'POST',
        body: JSON.stringify({ packIds: rows.map(x => x.packId) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'auto-calc failed');
      setRows(data.packs || []);
      setDirty(true);
      setInfo('Auto-weights computed (v1 uses equal distribution — richer heuristics coming).');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true); setError(''); setInfo('');
    try {
      const r = await fetchWithAuth('/pack-distribution', {
        method: 'PUT',
        body: JSON.stringify({ containerId, packs: rows }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'save failed');
      setRows(data.packs || rows);
      setDirty(false);
      setInfo('Distribution saved.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const clearAll = async () => {
    setSaving(true); setError('');
    try {
      const r = await fetchWithAuth(`/pack-distribution?containerId=${encodeURIComponent(containerId)}`, { method: 'DELETE' });
      if (!r.ok) { const data = await r.json(); throw new Error(data.error); }
      setRows([]);
      setDirty(false);
      setInfo('Distribution cleared.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <Box sx={{
      p: 2, borderRadius: '12px',
      border: (t) => `1px solid ${t.palette.divider}`,
      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <BalanceIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
        <Chip size="small" label={`${rows.length}/${MAX_PACKS} packs`} variant="outlined" />
        <Chip
          size="small"
          label={`total ${total}%`}
          color={validSum ? 'success' : 'warning'}
          variant={validSum ? 'filled' : 'outlined'}
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={load} disabled={loading || saving}>
            {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Assign a percentage to each pack. Workers assigned to this container
        will be routed proportionally. Must total 100% with 2-5 packs.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
      {info  && <Alert severity="info"  sx={{ mb: 1 }} onClose={() => setInfo('')}>{info}</Alert>}

      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
          No distribution configured. Add 2-5 packs to start.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {rows.map((row, idx) => {
            const used = new Set(rows.map((r, i) => (i === idx ? null : r.packId)).filter(Boolean));
            const options = availablePacks.filter(p => !used.has(p.name));
            const currentPack = availablePacks.find(p => p.name === row.packId) || { name: row.packId };
            return (
              <Stack key={idx} direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
                <Autocomplete
                  size="small"
                  options={options}
                  value={currentPack}
                  onChange={(_, v) => updateRow(idx, { packId: v?.name || '' })}
                  getOptionLabel={(p) => p?.name || ''}
                  isOptionEqualToValue={(a, b) => a?.name === b?.name}
                  sx={{ minWidth: 260 }}
                  disableClearable
                  renderInput={(params) => <TextField {...params} label={`Pack ${idx + 1}`} />}
                />
                <Box sx={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Slider
                    value={row.weight}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(_, v) => updateRow(idx, { weight: v })}
                    valueLabelDisplay="auto"
                    size="small"
                    aria-label={`Weight for ${row.packId}`}
                  />
                  <Chip size="small" label={`${row.weight}%`} sx={{ minWidth: 54 }} />
                </Box>
                <IconButton size="small" color="error" onClick={() => removeRow(idx)} aria-label="Remove pack">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={addRow} disabled={rows.length >= MAX_PACKS}>
          + Add pack
        </Button>
        <Button size="small" variant="outlined" startIcon={<AutoIcon />} onClick={autoCalc} disabled={rows.length < MIN_PACKS || saving}>
          Auto weights
        </Button>
        <Button size="small" variant="outlined" onClick={normalizeToEqual} disabled={rows.length < MIN_PACKS}>
          Equalize
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" color="error" onClick={clearAll} disabled={saving || rows.length === 0}>
          Clear
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={save}
          disabled={!canSave || saving}
        >
          Save
        </Button>
      </Stack>

      {/*
       * Phase 24 bug-fix: comprehensive "why is Save disabled" hint.
       * Replaces the earlier sum-only caption. Only shown when there's
       * *something* blocking save AND the user has rows to reason about
       * (empty-state message handles the pre-add case).
       */}
      {disabledReasons.length > 0 && rows.length > 0 && (
        <Alert
          severity="warning"
          icon={false}
          sx={{ mt: 1, py: 0.5, '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, display: 'block', mb: disabledReasons.length > 1 ? 0.25 : 0 }}
          >
            Save disabled:
          </Typography>
          {disabledReasons.length === 1 ? (
            <Typography variant="caption" sx={{ display: 'block' }}>
              {disabledReasons[0]} Use "Equalize" to fix quickly.
            </Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {disabledReasons.map((reason, i) => (
                <li key={i}>
                  <Typography variant="caption">{reason}</Typography>
                </li>
              ))}
            </Box>
          )}
        </Alert>
      )}
    </Box>
  );
}
