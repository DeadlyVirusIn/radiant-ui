/**
 * AdminHunterDetailDrawer — right-side drawer that opens when an operator
 * clicks a Hunter row. Moves all the secondary metadata, configuration,
 * and historical context out of the scan-first table.
 *
 * Tabs:
 *   Current       — active packs, bot state, last activity. Primary pack
 *                   actions (toggle / add) still available here.
 *   Configuration — per-participant settings: pseudo_godpack_enabled,
 *                   min_rare_cards, keep_as_friend. Read-only for this
 *                   phase (edits still happen via existing flows); values
 *                   are shown so operators can verify quickly.
 *   History       — full pack history (active + inactive + removed)
 *                   loaded on demand via the existing Phase 1 endpoint
 *                   GET /api/admin/hunt-participants/:discordId/history.
 *
 * Keeps strict compatibility with the existing handler props — no new
 * backend endpoints required here.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Tabs, Tab, Divider, Chip, Tooltip,
  Button, CircularProgress, Alert, List, ListItem, ListItemText, Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  SmartToy as BotIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  CheckCircle as HealthyIcon,
} from '@mui/icons-material';

import StatusDot from '../../components/admin/StatusDot';
import PackSummary from '../../components/admin/PackSummary';
import { deriveHunterStatus } from '../../utils/hunterStatus';
import { formatRelativeTime } from '../../utils/dateFormat';
import {
  ACTION_LABEL, formatCooldown, formatAttempts, entryToStatusDotState,
} from '../../utils/recoveryStatus';
import { canRefreshFriendCount } from '../../utils/blockedActions';
import { BlockedReasonChip } from '../../components/admin/BlockedReason';

function InfoRow({ label, value, mono }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.4 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>{label}</Typography>
      <Typography
        variant="caption"
        sx={{ fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}
      >
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Box>
  );
}

export default function AdminHunterDetailDrawer({
  open,
  participant,
  onClose,
  // Shared with the table — reuse existing handlers so actions keep working.
  botStatuses,
  actionLoading,
  handleToggleHuntParticipant,
  handleStartBot,
  handleStopBot,
  handleOpenAddPack,
  fetchBotStatus,
  fetchFriendCount,
  friendCounts,
}) {
  const [tab, setTab] = useState('current');

  // History state — lazy-loaded on first open of the History tab.
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  // Recovery state for this specific hunter (polled lightly when open).
  const [recoveryState, setRecoveryState] = useState(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const entityId = participant
    ? `${participant.discord_id}:${participant.account_type || 'main'}`
    : null;

  const loadRecovery = useCallback(async () => {
    if (!entityId) return;
    try {
      const res = await fetch('/api/admin/recovery/state', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mine = (data.entries || []).filter(e => e.entityType === 'hunter' && e.entityId === entityId);
      setRecoveryState({
        mode: data.mode,
        disabled: (data.disabled || []).includes(entityId),
        entry: mine[0] || null,
      });
    } catch (err) {
      setRecoveryError(err?.message || 'Failed to load recovery state');
    }
  }, [entityId]);

  useEffect(() => {
    if (!open || !entityId) return;
    loadRecovery();
    const t = setInterval(loadRecovery, 30_000);
    return () => clearInterval(t);
  }, [open, entityId, loadRecovery]);

  const toggleDisabled = async () => {
    if (!entityId) return;
    setRecoveryBusy(true);
    try {
      await fetch('/api/admin/recovery/disable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, disabled: !recoveryState?.disabled }),
      });
      await loadRecovery();
    } catch (err) {
      setRecoveryError(err?.message || 'Failed to toggle');
    } finally { setRecoveryBusy(false); }
  };
  const acknowledge = async (issueType) => {
    if (!entityId) return;
    setRecoveryBusy(true);
    try {
      await fetch('/api/admin/recovery/ack', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'hunter', entityId, issueType }),
      });
      await loadRecovery();
    } catch (err) {
      setRecoveryError(err?.message || 'Ack failed');
    } finally { setRecoveryBusy(false); }
  };

  // Reset tab + history when the drawer target changes.
  useEffect(() => {
    setTab('current');
    setHistoryData(null);
    setHistoryError(null);
  }, [participant?.discord_id, participant?.account_type]);

  const loadHistory = useCallback(async () => {
    if (!participant?.discord_id) return;
    const accountType = participant.account_type || 'main';
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const qs = new URLSearchParams({ accountType }).toString();
      const res = await fetch(
        `/api/admin/hunt-participants/${encodeURIComponent(participant.discord_id)}/history?${qs}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistoryData(data);
    } catch (err) {
      setHistoryError(err?.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [participant?.discord_id, participant?.account_type]);

  // Auto-load history the first time the tab is selected.
  useEffect(() => {
    if (tab === 'history' && !historyData && !historyLoading && !historyError) {
      loadHistory();
    }
  }, [tab, historyData, historyLoading, historyError, loadHistory]);

  if (!participant) return null;

  const statusKey = `${participant.player_id}_${participant.account_type || 'main'}`;
  const botStatus = botStatuses?.[statusKey] || {};
  const isRunning = botStatus.status === 'running';
  const friendInfo = friendCounts?.[statusKey];
  const { state, label: statusLabel } = deriveHunterStatus(participant, botStatus);
  const activePacks = (participant.packs || []).filter(p => p.is_active);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, maxWidth: '100%' } }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <StatusDot state={state} label={statusLabel} size={12} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {participant.discord_username}
            {participant.account_type === 'alt' && (
              <Chip label="ALT" size="small" color="secondary" variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }} />
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {statusLabel}
            {participant.is_paid ? ' · Paid' : ''}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab value="current"       label="Current"       icon={<HealthyIcon fontSize="small" />} iconPosition="start" />
        <Tab value="configuration" label="Configuration" icon={<SettingsIcon fontSize="small" />} iconPosition="start" />
        <Tab value="history"       label="History"       icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        {tab === 'current' && (
          <>
            <CurrentTab
              participant={participant}
              activePacks={activePacks}
              botStatus={botStatus}
              isRunning={isRunning}
              friendInfo={friendInfo}
              actionLoading={actionLoading}
              handleToggleHuntParticipant={handleToggleHuntParticipant}
              handleOpenAddPack={handleOpenAddPack}
              handleStartBot={handleStartBot}
              handleStopBot={handleStopBot}
              fetchBotStatus={fetchBotStatus}
              fetchFriendCount={fetchFriendCount}
            />
            <Divider sx={{ my: 2 }} />
            <RecoverySection
              recoveryState={recoveryState}
              recoveryBusy={recoveryBusy}
              recoveryError={recoveryError}
              toggleDisabled={toggleDisabled}
              acknowledge={acknowledge}
            />
          </>
        )}
        {tab === 'configuration' && <ConfigurationTab participant={participant} />}
        {tab === 'history' && (
          <HistoryTab
            loading={historyLoading}
            error={historyError}
            data={historyData}
            onReload={loadHistory}
          />
        )}
      </Box>
    </Drawer>
  );
}

/* -------------------- Tabs -------------------- */

function CurrentTab({
  participant, activePacks, botStatus, isRunning, friendInfo, actionLoading,
  handleToggleHuntParticipant, handleOpenAddPack, handleStartBot, handleStopBot,
  fetchBotStatus, fetchFriendCount,
}) {
  const statusKey = `${participant.player_id}_${participant.account_type || 'main'}`;
  const lastUpdated = participant.lastUpdatedAt || participant.last_updated_at || null;
  const lastActivity = lastUpdated ? formatRelativeTime(lastUpdated) : '—';

  return (
    <>
      <Typography variant="overline" color="text.secondary">Active Packs</Typography>
      <Box sx={{ my: 1 }}>
        <PackSummary packs={activePacks} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
        {activePacks.map((pk) => {
          const loadingKey = `${participant.discord_id}_${pk.pack_name}_${participant.account_type || 'main'}`;
          const isLoading = actionLoading?.[loadingKey];
          const hasFailures = pk.failure_count > 0;
          return (
            <Tooltip key={pk.pack_name}
                     title={isLoading ? 'Updating…' : `Click to disable ${pk.pack_name}${hasFailures ? ` · Failures: ${pk.failure_count}` : ''}`}>
              <Chip
                label={pk.pack_name}
                size="small"
                color={hasFailures ? 'warning' : 'success'}
                icon={isLoading ? <CircularProgress size={12} /> : <ToggleOnIcon />}
                onClick={() => !isLoading && handleToggleHuntParticipant(
                  participant.discord_id, pk.pack_name, pk.is_active, participant.account_type,
                )}
                sx={{ cursor: isLoading ? 'wait' : 'pointer' }}
              />
            </Tooltip>
          );
        })}
        <Tooltip title="Add pack">
          <IconButton size="small" color="primary" onClick={() => handleOpenAddPack(participant)} aria-label="Add pack">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary">Activity</Typography>
      <InfoRow label="Last event"      value={lastActivity} />
      <InfoRow label="Active packs"    value={activePacks.length} />
      <InfoRow label="Friend code"     value={participant.friend_code} mono />

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary">Bot</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
        <Chip
          icon={isRunning ? <BotIcon /> : undefined}
          label={isRunning ? 'Running' : (botStatus.status || (participant.player_id ? 'Off' : 'No account'))}
          size="small"
          color={isRunning ? 'success' : 'default'}
        />
        {participant.player_id && botStatus.status !== 'no_account' && (
          isRunning ? (
            <Tooltip title="Stop friend bot">
              <span>
                <IconButton size="small" color="error"
                  onClick={() => handleStopBot(participant.player_id, participant.account_type || 'main', participant.discord_id)}
                  disabled={botStatus.loading} aria-label="Stop friend bot">
                  <StopIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title="Start friend bot">
              <span>
                <IconButton size="small" color="success"
                  onClick={() => handleStartBot(participant.player_id, participant.account_type || 'main', participant.discord_id)}
                  disabled={botStatus.loading} aria-label="Start friend bot">
                  <PlayIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )
        )}
        <Tooltip title="Refresh bot status">
          <IconButton size="small" onClick={() => fetchBotStatus(participant.player_id, participant.account_type || 'main', participant.discord_id)}
                      disabled={!participant.player_id} aria-label="Refresh bot status">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <InfoRow label="Player ID" value={participant.player_id} mono />
      {botStatus.username && <InfoRow label="Account" value={botStatus.username} />}

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary">Friends</Typography>
      {(() => {
        const refreshGate = canRefreshFriendCount({ participant, botStatus });
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
            <Chip
              label={friendInfo?.count != null ? `${friendInfo.count} friends` : 'Unknown'}
              size="small"
              color={friendInfo?.count > 80 ? 'error' : friendInfo?.count > 50 ? 'warning' : 'default'}
              variant={friendInfo?.count > 80 ? 'filled' : 'outlined'}
            />
            <Tooltip title={refreshGate.allowed ? 'Refresh friend count' : refreshGate.fullReason}>
              <span>
                <IconButton size="small"
                            onClick={() => fetchFriendCount(participant.player_id, participant.account_type || 'main')}
                            disabled={!refreshGate.allowed || friendInfo?.loading}
                            aria-label="Refresh friend count">
                  {friendInfo?.loading ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            {!refreshGate.allowed && <BlockedReasonChip reason={refreshGate} />}
          </Box>
        );
      })()}
      {friendInfo && (friendInfo.sent != null || friendInfo.received != null) && (
        <>
          <InfoRow label="Sent requests"     value={friendInfo.sent} />
          <InfoRow label="Received requests" value={friendInfo.received} />
        </>
      )}
    </>
  );
}

function ConfigurationTab({ participant }) {
  return (
    <>
      <Typography variant="overline" color="text.secondary">Pack Settings</Typography>
      <InfoRow
        label="Pseudo-godpack enabled"
        value={
          <Chip
            size="small"
            label={participant.pseudo_godpack_enabled ? 'Yes' : 'No'}
            color={participant.pseudo_godpack_enabled ? 'success' : 'default'}
            variant={participant.pseudo_godpack_enabled ? 'filled' : 'outlined'}
          />
        }
      />
      <InfoRow label="Min rare cards" value={participant.min_rare_cards ?? '—'} />
      <InfoRow
        label="Keep as friend"
        value={
          <Chip
            size="small"
            label={participant.keep_as_friend ? 'Yes' : 'No'}
            color={participant.keep_as_friend ? 'primary' : 'default'}
            variant={participant.keep_as_friend ? 'filled' : 'outlined'}
          />
        }
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="overline" color="text.secondary">Identity</Typography>
      <InfoRow label="Discord ID" value={participant.discord_id} mono />
      <InfoRow label="Account type" value={participant.account_type || 'main'} />
      <InfoRow label="Friend code" value={participant.friend_code} mono />
      <InfoRow label="Paid" value={participant.is_paid ? 'Yes' : 'No'} />
      {participant.subscription_end && (
        <InfoRow label="Subscription ends" value={new Date(participant.subscription_end).toLocaleDateString()} />
      )}

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          Edits to these settings are made via the user's Discord hunt registration.
          Drawer is read-only in this phase.
        </Typography>
      </Alert>
    </>
  );
}

function HistoryTab({ loading, error, data, onReload }) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error" action={
        <Button size="small" onClick={onReload} startIcon={<RefreshIcon />}>Retry</Button>
      }>
        Failed to load history: {error}
      </Alert>
    );
  }
  if (!data) return null;

  const packs = Array.isArray(data.packs) ? data.packs : [];
  const counts = data.counts || {};

  if (packs.length === 0) {
    return (
      <Alert severity="info">
        No pack history recorded for this user.
      </Alert>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Chip label={`Total: ${counts.total ?? packs.length}`} size="small" variant="outlined" />
        <Chip label={`Active: ${counts.active ?? 0}`} size="small" color="success" variant="outlined" />
        <Chip label={`Inactive: ${counts.inactive ?? 0}`} size="small" color="default" variant="outlined" />
      </Box>
      <List dense disablePadding>
        {packs.map((pk, idx) => (
          <ListItem key={`${pk.pack_name}_${idx}`} disablePadding sx={{ py: 0.25 }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Chip
                    label={pk.pack_name}
                    size="small"
                    color={pk.is_active ? 'success' : 'default'}
                    variant={pk.is_active ? 'filled' : 'outlined'}
                    icon={pk.is_active ? <ToggleOnIcon /> : <ToggleOffIcon />}
                  />
                  {pk.removed_reason && (
                    <Typography variant="caption" color="text.secondary">{pk.removed_reason}</Typography>
                  )}
                </Box>
              }
              secondary={
                <Typography variant="caption" color="text.secondary">
                  {pk.created_at && <>added {formatRelativeTime(pk.created_at)}</>}
                  {pk.updated_at && <> · updated {formatRelativeTime(pk.updated_at)}</>}
                  {pk.failure_count ? <> · failures {pk.failure_count}</> : null}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}

/**
 * Recovery section — rendered under the Current tab. Shows the current
 * auto-healing state for this hunter (if any) + per-entity disable toggle
 * + per-issue acknowledge button. Deliberately compact — the primary
 * recovery surface is the Fleet Health strip.
 */
function RecoverySection({ recoveryState, recoveryBusy, recoveryError, toggleDisabled, acknowledge }) {
  if (!recoveryState) {
    return (
      <>
        <Typography variant="overline" color="text.secondary">Self-healing</Typography>
        <Typography variant="caption" color="text.secondary" display="block">Loading…</Typography>
      </>
    );
  }
  const { mode, disabled, entry } = recoveryState;
  const dotInfo = entryToStatusDotState(entry);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="overline" color="text.secondary">Self-healing</Typography>
        <Chip size="small" label={`mode: ${mode}`}
              color={mode === 'off' ? 'default' : mode === 'dry-run' ? 'warning' : 'success'}
              variant={mode === 'off' ? 'outlined' : 'filled'} />
      </Box>

      {recoveryError && <Alert severity="error" sx={{ my: 1 }}>{recoveryError}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <StatusDot state={dotInfo.state} size={10} label={dotInfo.label} />
        <Typography variant="body2">{dotInfo.label}</Typography>
      </Box>

      {entry ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Issue</Typography>
            <Typography variant="caption">{entry.issueType}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Last action</Typography>
            <Typography variant="caption">{ACTION_LABEL[entry.lastAction] || entry.lastAction || '—'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Last attempt</Typography>
            <Typography variant="caption">
              {entry.lastAttemptAt ? new Date(entry.lastAttemptAt).toLocaleTimeString() : '—'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Attempts</Typography>
            <Typography variant="caption">{formatAttempts(entry)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Cooldown</Typography>
            <Typography variant="caption">{formatCooldown(entry.cooldownUntil) || '—'}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Verification</Typography>
            <Typography variant="caption">{entry.lastVerificationResult || '—'}</Typography>
          </Box>
          {entry.escalated && (
            <Alert severity="warning" sx={{ mt: 1 }} action={
              <Button size="small" disabled={recoveryBusy}
                      onClick={() => acknowledge(entry.issueType)}>
                Acknowledge
              </Button>
            }>
              Escalated — retry budget exhausted. Ack to reset retry state.
            </Alert>
          )}
        </>
      ) : (
        <Typography variant="caption" color="text.secondary" display="block">
          No active recovery entry for this hunter.
        </Typography>
      )}

      <FormControlLabel
        sx={{ mt: 1 }}
        control={
          <Switch
            size="small"
            checked={Boolean(disabled)}
            onChange={toggleDisabled}
            disabled={recoveryBusy}
          />
        }
        label={
          <Typography variant="caption">
            Opt out of self-healing for this hunter
          </Typography>
        }
      />
    </>
  );
}
