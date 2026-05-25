/**
 * AdminUserDetailDrawer — right-side drawer with full per-user detail
 * and subscriber management actions (Phase 2/3 merge).
 *
 * Replaces the standalone Subscribers tab: every paid-subscriber action
 * (Extend 1 month, Set end date, Set Discord ID, Remove) is reached from
 * here via proper MUI dialogs. No native prompt() / confirm().
 */

import { useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Chip, Divider, Button, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  AddCircle as AddCircleIcon,
  Event as EventIcon,
  Link as LinkIcon,
  DeleteForever as RemoveSubIcon,
  OpenInNew as ExternalIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import adminApi from './adminUsersApi';
import { formatRelativeTime } from '../../utils/dateFormat';

// Plan label/color config — single source of truth shared with the table.
export const PLAN_CONFIG = {
  premium:  { label: 'Premium',  color: 'secondary', variant: 'filled'   },
  trade:    { label: 'Trade',    color: 'info',      variant: 'filled'   },
  trial:    { label: 'Trial',    color: 'warning',   variant: 'filled'   },
  free:     { label: 'Free',     color: 'default',   variant: 'outlined' },
  expired:  { label: 'Expired',  color: 'error',     variant: 'filled'   },
  admin:    { label: 'Admin',    color: 'secondary', variant: 'filled'   },
};

export function getUserPlan(u) {
  if (!u) return 'free';
  const tier = u.subscription_tier;
  if (u.trial_granted_by) return 'trial';
  if (u.subscription_source && !u.subscription_active) return 'expired';
  if (tier === 'premium' || tier === 'admin') return tier;
  if (tier === 'trade') return 'trade';
  return 'free';
}

function KV({ label, value, mono }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>{label}</Typography>
      <Typography
        variant="caption"
        sx={{ fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}
      >
        {value == null || value === '' ? '—' : value}
      </Typography>
    </Box>
  );
}

export default function AdminUserDetailDrawer({
  open,
  user,
  onClose,
  refreshUsers,
  refreshSubscribers,
  handleRemoveSubscriber,
  setError,
  setSuccess,
}) {
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendSaving, setExtendSaving] = useState(false);

  const [setDateOpen, setSetDateOpen] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [setDateSaving, setSetDateSaving] = useState(false);

  const [setIdOpen, setSetIdOpen] = useState(false);
  const [discordId, setDiscordId] = useState('');
  const [setIdSaving, setSetIdSaving] = useState(false);

  const [removeOpen, setRemoveOpen] = useState(false);

  if (!user) return null;

  const plan = getUserPlan(user);
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  const hasSub = !!user.subscription_source;
  const anyDcbin = user.accounts?.some(a => a.has_dcbin);
  const anyXml = user.accounts?.some(a => a.has_xml);
  const anyBotRunning = user.accounts?.some(a => a.bot_running);
  const lastActiveSrc = user.last_login || user.last_seen || user.updated_at || user.created_at;

  const copy = (value) => {
    if (!value) return;
    try {
      navigator.clipboard?.writeText(String(value));
      setSuccess?.('Copied to clipboard');
    } catch {
      /* no-op */
    }
  };

  // ---- subscriber mutations (MUI dialogs, no prompt/confirm) ----

  const doExtendMonth = async () => {
    if (!user.discord_username) return;
    setExtendSaving(true);
    try {
      const res = await adminApi.updateSubscriber(user.discord_username, { extendMonths: 1 }, user.discord_id);
      if (res?.error) { setError?.(res.error); return; }
      setSuccess?.(res?.message || `Extended ${user.discord_username} by 1 month`);
      setExtendOpen(false);
      refreshUsers?.();
      refreshSubscribers?.();
    } catch (err) {
      setError?.(`Failed to extend subscription: ${err.message}`);
    } finally {
      setExtendSaving(false);
    }
  };

  const openSetDate = () => {
    setEndDate(user.subscription_end ? new Date(user.subscription_end).toISOString().split('T')[0] : '');
    setSetDateOpen(true);
  };
  const doSetDate = async () => {
    if (!user.discord_username || !endDate) return;
    setSetDateSaving(true);
    try {
      const iso = `${endDate}T23:59:59.000Z`;
      const res = await adminApi.updateSubscriber(user.discord_username, { subscriptionEnd: iso }, user.discord_id);
      if (res?.error) { setError?.(res.error); return; }
      setSuccess?.(`End date set to ${endDate} for ${user.discord_username}`);
      setSetDateOpen(false);
      refreshUsers?.();
      refreshSubscribers?.();
    } catch (err) {
      setError?.(`Failed to set end date: ${err.message}`);
    } finally {
      setSetDateSaving(false);
    }
  };

  const openSetId = () => {
    setDiscordId(user.discord_id || '');
    setSetIdOpen(true);
  };
  const doSetId = async () => {
    if (!user.discord_username) return;
    setIdSaving(true);
    try {
      // Phase 39.5 — user.discord_id is the CURRENT lookup key (may be null
      // if subscriber has no id yet). body.discord_id is the NEW value to set.
      const res = await adminApi.updateSubscriber(user.discord_username, { discord_id: discordId }, user.discord_id);
      if (res?.error) { setError?.(res.error); return; }
      setSuccess?.(res?.message || `Discord ID updated for ${user.discord_username}`);
      setSetIdOpen(false);
      refreshUsers?.();
      refreshSubscribers?.();
    } catch (err) {
      setError?.(`Failed to update Discord ID: ${err.message}`);
    } finally {
      setIdSaving(false);
    }
  };

  const doRemove = async () => {
    if (!user.discord_username) return;
    // Phase 39.5 — pass discord_id so backend can resolve via stable
    // ID even when the handle format differs between tables.
    await handleRemoveSubscriber?.(user.discord_username, user.discord_id);
    setRemoveOpen(false);
    refreshUsers?.();
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100%' } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>{user.username}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user.discord_username || 'no discord linked'} · {user.is_owner ? 'Owner' : user.is_admin ? 'Admin' : 'User'}
            </Typography>
          </Box>
          <Chip label={planCfg.label} color={planCfg.color} variant={planCfg.variant} size="small" />
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          {/* Identity */}
          <Typography variant="overline" color="text.secondary">Identity</Typography>
          <KV label="User ID" value={user.id} mono />
          <KV label="Discord ID" value={user.discord_id} mono />
          <KV label="Email" value={user.email} />
          <KV label="Created" value={user.created_at ? formatRelativeTime(user.created_at) : null} />
          <KV label="Last active" value={lastActiveSrc ? formatRelativeTime(lastActiveSrc) : null} />

          <Divider sx={{ my: 2 }} />

          {/* Subscription */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="overline" color="text.secondary">Subscription</Typography>
            <Chip label={planCfg.label} color={planCfg.color} variant={planCfg.variant} size="small" />
          </Box>
          <KV label="Source" value={user.subscription_source} />
          <KV label="Tier" value={user.subscription_tier} />
          <KV label="Status" value={user.subscription_active ? 'Active' : (user.subscription_source ? 'Expired' : 'None')} />
          <KV label="Expires" value={user.subscription_end ? new Date(user.subscription_end).toLocaleString() : null} />
          {user.trial_granted_by && <KV label="Trial granted by" value={user.trial_granted_by} />}

          {hasSub ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
              <Button size="small" variant="outlined" startIcon={<AddCircleIcon />} onClick={() => setExtendOpen(true)}>
                Extend 1 month
              </Button>
              <Button size="small" variant="outlined" startIcon={<EventIcon />} onClick={openSetDate}>
                Set end date
              </Button>
              <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={openSetId}>
                Set Discord ID
              </Button>
              <Button size="small" variant="outlined" color="error" startIcon={<RemoveSubIcon />} onClick={() => setRemoveOpen(true)}>
                Remove
              </Button>
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">Free plan — no subscription actions.</Typography>
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Accounts */}
          <Typography variant="overline" color="text.secondary">Accounts ({user.accounts?.length || 0})</Typography>
          {!user.accounts?.length ? (
            <Typography variant="caption" color="text.secondary" display="block">No linked accounts</Typography>
          ) : (
            user.accounts.map((a, i) => (
              <Box key={i} sx={{ my: 1, p: 1.25, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={600}>
                    {a.account_type === 'alt' ? 'Alt' : 'Main'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={a.has_dcbin ? 'DC.bin ✓' : 'DC.bin missing'}>
                      {a.has_dcbin ? <CheckIcon fontSize="small" color="success" /> : <CancelIcon fontSize="small" color="disabled" />}
                    </Tooltip>
                    <Tooltip title={a.has_xml ? 'XML ✓' : 'XML missing'}>
                      {a.has_xml ? <CheckIcon fontSize="small" color="success" /> : <CancelIcon fontSize="small" color="disabled" />}
                    </Tooltip>
                    <Tooltip title={a.bot_running ? 'Bot running' : 'Bot off'}>
                      {a.bot_running ? <CheckIcon fontSize="small" color="primary" /> : <CancelIcon fontSize="small" color="disabled" />}
                    </Tooltip>
                  </Box>
                </Box>
                <KV label="Friend ID" value={a.friend_id} mono />
                <KV label="Player ID" value={a.player_id} mono />
                {a.player_id && (
                  <Tooltip title="Copy Player ID">
                    <IconButton size="small" onClick={() => copy(a.player_id)} aria-label="Copy player id">
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))
          )}

          <Divider sx={{ my: 2 }} />

          {/* Hunt & Proxy */}
          <Typography variant="overline" color="text.secondary">Hunt & Proxy</Typography>
          <KV label="Hunt group" value={user.hunt_group != null ? `C${user.hunt_group}` : null} />
          <KV label="Proxy slot" value={user.proxy_slot_id != null ? `S${user.proxy_slot_id}` : null} />
          <KV label="Any bot running" value={anyBotRunning ? 'yes' : 'no'} />
          <KV label="Any DC.bin" value={anyDcbin ? 'yes' : 'no'} />
          <KV label="Any XML" value={anyXml ? 'yes' : 'no'} />
        </Box>
      </Drawer>

      {/* Extend 1 month — confirmation dialog */}
      <Dialog open={extendOpen} onClose={() => !extendSaving && setExtendOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Extend subscription</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Extend <strong>{user.discord_username}</strong> by 1 month from the current end date.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtendOpen(false)} disabled={extendSaving}>Cancel</Button>
          <Button variant="contained" color="success" onClick={doExtendMonth} disabled={extendSaving}
                  startIcon={extendSaving ? <CircularProgress size={14} /> : <AddCircleIcon />}>
            {extendSaving ? 'Extending…' : 'Extend 1 month'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set end date dialog */}
      <Dialog open={setDateOpen} onClose={() => !setDateSaving && setSetDateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Set subscription end date</DialogTitle>
        <DialogContent>
          <TextField
            type="date"
            label="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            InputLabelProps={{ shrink: true }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Subscription will expire at 23:59:59 UTC on the chosen date.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetDateOpen(false)} disabled={setDateSaving}>Cancel</Button>
          <Button variant="contained" onClick={doSetDate} disabled={!endDate || setDateSaving}
                  startIcon={setDateSaving ? <CircularProgress size={14} /> : <EventIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Discord ID dialog */}
      <Dialog open={setIdOpen} onClose={() => !setIdSaving && setSetIdOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Set Discord ID for subscription</DialogTitle>
        <DialogContent>
          <TextField
            label="Discord ID"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            placeholder="e.g. 123456789012345678"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetIdOpen(false)} disabled={setIdSaving}>Cancel</Button>
          <Button variant="contained" onClick={doSetId} disabled={setIdSaving}
                  startIcon={setIdSaving ? <CircularProgress size={14} /> : <LinkIcon />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove subscription dialog */}
      <Dialog open={removeOpen} onClose={() => setRemoveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            Remove subscription?
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Remove the paid subscription record for <strong>{user.discord_username}</strong>. This does not delete the user account.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={doRemove} startIcon={<RemoveSubIcon />}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
