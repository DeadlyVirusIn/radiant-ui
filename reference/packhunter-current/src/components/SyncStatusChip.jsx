/**
 * Phase 25D — SyncStatusChip.
 *
 * Small, page-embeddable indicator that tells the user WHEN their
 * tracker last synced AND whether inventory + missions agree. Drops
 * the "always-green" ambiguity from Phase 25C — if missions lag
 * inventory, the chip turns yellow with an explicit explanation.
 *
 * Source of truth is localStorage (keyed by account) written by
 * Tracker.handleSyncFromGame after each unified-sync call. localStorage
 * is fine here: the data is a UI hint for the logged-in session, not
 * authoritative state.
 *
 * Usage:
 *   <SyncStatusChip accountId={selectedAccountId} />
 *
 * Props:
 *   accountId — string or number. If null / 'all', chip shows "—".
 */

import { useEffect, useState } from 'react';
import { Chip, Tooltip, Box, Typography } from '@mui/material';
import {
  CheckCircle as OkIcon,
  WarningAmber as WarnIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import { unifiedSync } from '../services/api';

// Phase 25E — primary source is now the backend (/api/accounts/:id/
// sync-status), which reads user_device_accounts.last_inventory_sync_at
// and last_missions_sync_at. localStorage is kept as a fast-path cache
// for optimistic UI updates (the Tracker page writes immediately after
// clicking Sync; the chip reflects it before the server round-trip
// finishes). If the backend disagrees on refresh, server wins.
const STORAGE_PREFIX = 'trackerSyncStatus:';

/** Persist a sync result for an account. Called by consumers after
 *  unifiedSync.tracker() resolves. */
export function recordSyncStatus(accountId, result) {
  if (!accountId) return;
  try {
    const payload = {
      at: Date.now(),
      inventorySynced: !!result?.inventorySynced,
      missionsSynced:  !!result?.missionsSynced,
      cardsUpdated:    result?.cardsUpdated ?? 0,
      missionsChecked: result?.missionsChecked ?? 0,
      errors:          result?.errors || {},
    };
    localStorage.setItem(STORAGE_PREFIX + accountId, JSON.stringify(payload));
    // Broadcast via storage event so other open tabs / components update.
    window.dispatchEvent(new CustomEvent('tracker-sync-updated', { detail: { accountId } }));
  } catch { /* quota or SSR — safe to ignore */ }
}

export function readSyncStatus(accountId) {
  if (!accountId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + accountId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function timeAgoLabel(ts) {
  const ms = Date.now() - ts;
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export default function SyncStatusChip({ accountId, size = 'small', showLabel = true }) {
  // Two state sources merged:
  //   localCache (localStorage) — optimistic, written by Tracker
  //   server     (API)          — authoritative, trumps local if newer
  const [local, setLocal] = useState(() => readSyncStatus(accountId));
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch from backend. Runs on mount, on accountId change, on sync
  // event, and every 60s to keep the "5m ago" label fresh.
  useEffect(() => {
    let cancelled = false;
    if (!accountId || accountId === 'all') {
      setServer(null);
      return () => { cancelled = true; };
    }
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const body = await unifiedSync.status(accountId);
        if (!cancelled && body && !body.error) setServer(body);
      } catch { /* network failure — fall back to localStorage */ }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchStatus();
    setLocal(readSyncStatus(accountId));
    const onUpdate = (e) => {
      if (!e?.detail?.accountId || String(e.detail.accountId) === String(accountId)) {
        setLocal(readSyncStatus(accountId));
        fetchStatus();   // re-confirm from backend after a sync completes
      }
    };
    window.addEventListener('tracker-sync-updated', onUpdate);
    const t = setInterval(() => {
      setLocal(prev => (prev ? { ...prev } : prev));
      fetchStatus();
    }, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener('tracker-sync-updated', onUpdate);
      clearInterval(t);
    };
  }, [accountId]);

  // Merge: prefer server if it has a non-null inventory timestamp.
  // Server is authoritative; local is a fast-path preview only.
  const status = (() => {
    if (server && (server.lastInventorySyncAt || server.lastMissionsSyncAt)) {
      return {
        at: Date.parse(server.lastInventorySyncAt || server.lastMissionsSyncAt),
        inventorySynced: !!server.lastInventorySyncAt,
        missionsSynced: !!server.lastMissionsSyncAt && !server.partial,
        cardsUpdated: local?.cardsUpdated ?? 0,
        missionsChecked: local?.missionsChecked ?? 0,
        errors: local?.errors || {},
        source: 'server',
      };
    }
    return local;
  })();

  if (!accountId || accountId === 'all') {
    return (
      <Chip size={size} variant="outlined"
            icon={<TimeIcon fontSize="small" />}
            label="No account selected"
            sx={{ fontSize: '0.65rem' }} />
    );
  }
  if (!status) {
    return (
      <Chip size={size} variant="outlined" color="default"
            icon={<TimeIcon fontSize="small" />}
            label="Never synced"
            sx={{ fontSize: '0.65rem' }} />
    );
  }

  // Determine partial-vs-full state. Both true → success green.
  // Inventory only → yellow warning (missions lag).
  // Neither → error red (shouldn't happen if we only record successful
  // syncs, but handle defensively).
  const bothOk = status.inventorySynced && status.missionsSynced;
  const invOnly = status.inventorySynced && !status.missionsSynced;
  const color = bothOk ? 'success' : invOnly ? 'warning' : 'error';
  const Icon = bothOk ? OkIcon : WarnIcon;
  const ago = timeAgoLabel(status.at);
  const headlineLabel = bothOk
    ? `Synced ${ago}`
    : invOnly
    ? `Inventory synced ${ago} · missions stale`
    : `Sync failed ${ago}`;

  const tooltipBody = (
    <Box sx={{ minWidth: 180 }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
        Last tracker sync
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {new Date(status.at).toLocaleString()}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
        Inventory: {status.inventorySynced ? '✓' : '✗'}
        {status.inventorySynced ? ` (${status.cardsUpdated} cards)` : ''}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        Missions: {status.missionsSynced ? '✓' : '✗'}
        {status.missionsSynced ? ` (${status.missionsChecked} checked)` : ''}
      </Typography>
      {status.errors?.inventory && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          Inv error: {status.errors.inventory}
        </Typography>
      )}
      {status.errors?.missions && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
          Mis error: {status.errors.missions}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipBody} arrow>
      <Chip
        size={size}
        color={color}
        variant={bothOk ? 'outlined' : 'filled'}
        icon={<Icon fontSize="small" />}
        label={showLabel ? headlineLabel : ago}
        sx={{ fontSize: '0.65rem' }}
      />
    </Tooltip>
  );
}
