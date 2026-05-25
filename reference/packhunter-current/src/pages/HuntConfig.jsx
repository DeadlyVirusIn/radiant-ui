/**
 * Hunt Config - Admin page for hunt system mode control
 *
 * Controls: global_mode, custom_container_groups, notify_only,
 * current_expansion, max_custom_instances_pct, pack whitelist, fallback
 *
 * Config changes propagate to containers within ~30 seconds (cache TTL).
 * Pack selection behavior changes take effect at the next 12-hour batch boundary.
 */

import { useState, useEffect, useCallback } from 'react';
import { FadeIn } from '../components/Animations';
import {
  Box, Typography, Button, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Slider, TextField, Chip, Alert, Snackbar,
  Paper, CircularProgress, Divider, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Checkbox, ListItemText, OutlinedInput,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Settings as SettingsIcon,
  Restore as ResetIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import { useSectionStyles } from '../components/SectionCard';
import { huntConfig as huntConfigApi } from '../services/api';
import adminApi from './admin/adminUsersApi';
import ContainerPackConfigPanel from '../components/admin/ContainerPackConfigPanel';

export default function HuntConfig({ user }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [config, setConfig] = useState(null);
  const [raw, setRaw] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [packs, setPacks] = useState([]); // available pack list for default pack selector
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // key being saved, or null
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const showSnack = (message, severity = 'success') => setSnack({ open: true, message, severity });

  const loadConfig = useCallback(async () => {
    try {
      const data = await huntConfigApi.get();
      setConfig(data.config);
      setRaw(data.raw || []);
    } catch (err) {
      showSnack(err.message || 'Failed to load config', 'error');
    } finally {
      setLoading(false);
    }
    // Load recommendations and pack list (non-blocking)
    refreshRecommendations();
    adminApi.getAvailablePacks().then(data => setPacks(data.packs || [])).catch(() => {});
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const refreshRecommendations = async () => {
    try {
      const recs = await huntConfigApi.getRecommendations();
      setRecommendations(recs.recommendations || []);
    } catch (e) { /* advisory only — OK if this fails */ }
  };

  const updateKey = async (key, value) => {
    setSaving(key);
    try {
      const data = await huntConfigApi.update(key, value);
      if (data.success) {
        setConfig(data.config);
        showSnack(`${key} updated`);
        // Refresh recommendations after any config change
        refreshRecommendations();
      } else {
        showSnack(data.error || 'Update failed', 'error');
      }
    } catch (err) {
      showSnack(err.message || 'Update failed', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset ALL hunt config to defaults? This cannot be undone.')) return;
    setSaving('reset');
    try {
      const data = await huntConfigApi.reset();
      if (data.success) {
        setConfig(data.config);
        showSnack('All config reset to defaults');
        loadConfig(); // refresh raw metadata
      } else {
        showSnack(data.error || 'Reset failed', 'error');
      }
    } catch (err) {
      showSnack(err.message || 'Reset failed', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  if (!config) {
    return <Alert severity="error" sx={{ m: 2 }}>Failed to load hunt config</Alert>;
  }

  const { sectionBox } = useSectionStyles();

  const modeColors = { standard_only: '#4CAF50', b2b_only: '#4CAF50', hybrid: '#FF9800', custom_enabled: '#F44336' };
  const isStdMode = config.global_mode === 'standard_only' || config.global_mode === 'b2b_only';

  return (
    <FadeIn>
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <PageHeader title="Hunt Config" subtitle="Admin control for hunt system modes" />

      <Alert severity="info" sx={{ mb: 2 }} icon={<InfoIcon />}>
        Config changes propagate to containers within ~30 seconds.
        Pack selection changes take effect at the next <strong>12-hour batch boundary</strong> — running hunts will not change packs mid-batch.
        Routing changes (notify-only, group assignment) apply immediately to new registrations.
      </Alert>

      {/* Mode Selection */}
      <Paper sx={sectionBox}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>System Mode</Typography>
        <FormControl fullWidth size="small" sx={{ maxWidth: 300 }}>
          <InputLabel>Global Mode</InputLabel>
          <Select
            value={config.global_mode}
            label="Global Mode"
            onChange={(e) => updateKey('global_mode', e.target.value)}
            disabled={saving === 'global_mode'}
          >
            <MenuItem value="standard_only">
              <Chip label="Standard" size="small" sx={{ bgcolor: modeColors.standard_only, color: '#fff', mr: 1 }} />
              All containers run the default pack
            </MenuItem>
            <MenuItem value="hybrid">
              <Chip label="Hybrid" size="small" sx={{ bgcolor: modeColors.hybrid, color: '#fff', mr: 1 }} />
              Custom containers run mixed default + legacy
            </MenuItem>
            <MenuItem value="custom_enabled">
              <Chip label="Custom" size="small" sx={{ bgcolor: modeColors.custom_enabled, color: '#fff', mr: 1 }} />
              Custom containers run legacy only
            </MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Current: <Chip label={config.global_mode} size="small" sx={{ bgcolor: modeColors[config.global_mode], color: '#fff' }} />
        </Typography>
      </Paper>

      {/* Per-Container Pack Configuration — primary control surface.
          Workers consult this FIRST; the legacy "Default Pack" below is
          used only when a container has no row in container_pack_config. */}
      <ContainerPackConfigPanel />

      {/* Default Pack Selection — LEGACY fallback only. Per-container
          config above takes precedence; this remains as a global default
          for any container that has no per-container row set. */}
      <Paper sx={sectionBox}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Default Pack&nbsp;
          <Chip label="Legacy fallback" size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
        </Typography>
        <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.75rem', py: 0.5 }}>
          This is a fallback only. Containers configured in <strong>Per-Container Pack Configuration</strong> above ignore this
          value and use their own list. Set this for containers you have NOT configured per-container.
        </Alert>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          The pack that all standard containers run when they have no per-container config. Empty = use DYNAMIC weighted voting
          from user preferences.
        </Typography>
        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Default Pack</InputLabel>
          <Select
            value={config.default_pack || ''}
            label="Default Pack"
            onChange={(e) => updateKey('default_pack', e.target.value)}
            disabled={saving === 'default_pack'}
          >
            <MenuItem value="">
              <em>DYNAMIC (weighted voting)</em>
            </MenuItem>
            {packs.map(p => (
              <MenuItem key={p.name} value={p.name}>
                {p.label || p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {config.default_pack && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            All standard container instances will run <strong>{config.default_pack}</strong> at next batch boundary.
          </Typography>
        )}
      </Paper>

      {/* Custom Routing (hybrid/custom only) */}
      <Paper sx={{
        ...sectionBox,
        opacity: isStdMode ? 0.5 : 1,
        pointerEvents: isStdMode ? 'none' : 'auto',
      }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Custom Routing
          {isStdMode && (
            <Chip label="inactive in standard mode" size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          These settings only apply in hybrid or custom_enabled mode.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TextField
            label="Custom Container Groups"
            size="small"
            defaultValue={JSON.stringify(config.custom_container_groups)}
            onBlur={(e) => updateKey('custom_container_groups', e.target.value)}
            helperText="Which containers run legacy packs, e.g. [4]"
            sx={{ width: 200 }}
            disabled={saving === 'custom_container_groups' || isStdMode}
          />
          <TextField
            label="Legacy Boundary (expansion code)"
            size="small"
            defaultValue={config.current_expansion}
            onBlur={(e) => updateKey('current_expansion', e.target.value)}
            helperText="Packs outside this expansion are 'legacy'"
            sx={{ width: 220 }}
            disabled={saving === 'current_expansion' || isStdMode}
          />
        </Box>
      </Paper>

      {/* Instance Cap & Fallback */}
      <Paper sx={{
        ...sectionBox,
        opacity: isStdMode ? 0.5 : 1,
        pointerEvents: isStdMode ? 'none' : 'auto',
      }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Custom Container Limits
          {isStdMode && (
            <Chip label="inactive in standard mode" size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />
          )}
        </Typography>
        <Box sx={{ maxWidth: 400 }}>
          <Typography variant="body2">
            Max custom instances: {config.max_custom_instances_pct}%
          </Typography>
          <Slider
            value={config.max_custom_instances_pct}
            onChange={(e, val) => setConfig(prev => ({ ...prev, max_custom_instances_pct: val }))}
            onChangeCommitted={(e, val) => updateKey('max_custom_instances_pct', String(val))}
            min={0} max={100} step={10} marks
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            disabled={saving === 'max_custom_instances_pct'}
          />
          <Typography variant="caption" color="text.secondary">
            0% = all instances run default pack. 100% = all instances use scoped distribution.
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={config.fallback_to_b2b}
              onChange={(e) => updateKey('fallback_to_b2b', e.target.checked ? 'true' : 'false')}
              disabled={saving === 'fallback_to_b2b'}
              size="small"
            />
          }
          label={<Typography variant="body2">Fall back to default pack when no legacy demand</Typography>}
          sx={{ mt: 1 }}
        />
      </Paper>

      {/* Notify-Only & Pack Whitelist */}
      <Paper sx={sectionBox}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Notify-Only & Whitelist</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={config.notify_only_enabled}
              onChange={(e) => updateKey('notify_only_enabled', e.target.checked ? 'true' : 'false')}
              disabled={saving === 'notify_only_enabled'}
              size="small"
            />
          }
          label={<Typography variant="body2">Allow notify-only registrations</Typography>}
        />
        <TextField
          label="Custom Pack Whitelist"
          size="small"
          fullWidth
          defaultValue={JSON.stringify(config.custom_pack_whitelist)}
          onBlur={(e) => updateKey('custom_pack_whitelist', e.target.value)}
          helperText='Empty [] = all legacy packs. Or specific: ["MEWTWO","BLAZIKEN"]'
          sx={{ mt: 1.5 }}
          disabled={saving === 'custom_pack_whitelist'}
        />
      </Paper>

      {/* Bot Hub Visible Packs */}
      <Paper sx={sectionBox}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>Bot Hub Visible Packs</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Controls which packs Bot Hub users can see and select. If none selected, defaults to B-series only.
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Visible Packs</InputLabel>
          <Select
            multiple
            value={config.visible_packs || []}
            onChange={(e) => {
              const val = e.target.value;
              setConfig(prev => ({ ...prev, visible_packs: val }));
              updateKey('visible_packs', JSON.stringify(val));
            }}
            input={<OutlinedInput label="Visible Packs" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map(name => {
                  const pack = packs.find(p => p.name === name);
                  return <Chip key={name} label={pack?.label || name} size="small" />;
                })}
              </Box>
            )}
            disabled={saving === 'visible_packs'}
          >
            {packs.map((pack) => (
              <MenuItem key={pack.name} value={pack.name}>
                <Checkbox checked={(config.visible_packs || []).includes(pack.name)} size="small" />
                <ListItemText primary={pack.label} secondary={pack.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {(config.visible_packs || []).length === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No packs selected — Bot Hub will show B-series packs only by default.
          </Alert>
        )}
      </Paper>

      {/* Audit Trail */}
      {raw.length > 0 && (
        <Paper sx={sectionBox}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Config State</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Last Updated</TableCell>
                  <TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {raw.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell><Typography variant="caption" fontFamily="monospace">{row.key}</Typography></TableCell>
                    <TableCell><Typography variant="caption" fontFamily="monospace">{row.value}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{row.updated_by || '—'}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Recommendations (advisory only) */}
      {recommendations.length > 0 && (
        <Paper sx={sectionBox}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Recommendations</Typography>
          {recommendations.map((rec, idx) => {
            const sevColors = { warning: '#FF9800', info: '#2196F3', error: '#F44336' };
            const sevIcons = { warning: <WarningIcon sx={{ fontSize: 16, color: sevColors.warning, verticalAlign: 'middle' }} />, info: <InfoIcon sx={{ fontSize: 16, color: sevColors.info, verticalAlign: 'middle' }} />, error: <ErrorIcon sx={{ fontSize: 16, color: sevColors.error, verticalAlign: 'middle' }} /> };
            return (
              <Box key={idx} sx={{
                p: 1.5, mb: 1, borderRadius: '8px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                borderLeft: `3px solid ${sevColors[rec.severity] || '#999'}`,
              }}>
                <Typography variant="body2">
                  {sevIcons[rec.severity] || '•'} {rec.message}
                </Typography>
                {rec.context && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontFamily: 'monospace' }}>
                    {Object.entries(rec.context).map(([k, v]) => `${k}=${typeof v === 'number' ? v : JSON.stringify(v)}`).join(' · ')}
                  </Typography>
                )}
                {rec.action && (
                  <Button
                    size="small"
                    variant="text"
                    sx={{ mt: 0.5, textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                    onClick={() => updateKey(rec.action.key, rec.action.suggestedValue)}
                    disabled={saving === rec.action.key}
                  >
                    Apply: set {rec.action.key} = {rec.action.suggestedValue}
                  </Button>
                )}
              </Box>
            );
          })}
        </Paper>
      )}

      {/* Reset */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Tooltip title="Reset all config to safe defaults (standard mode)">
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleReset}
            disabled={saving === 'reset'}
            startIcon={saving === 'reset' ? <CircularProgress size={14} /> : <ResetIcon />}
          >
            Reset to Defaults
          </Button>
        </Tooltip>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  );
}
