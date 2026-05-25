/**
 * SystemHealthMini — Compact system health indicator using debug bridge data.
 *
 * Shows: socket status, events processed, guard rejections, last event age.
 * Visible to all users as a subtle chip row — not debug-only.
 * Uses debugBridge.getSnapshot() which is already populated by the guard layer.
 */

import { useMemo } from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import ShieldIcon from '@mui/icons-material/Shield';
import { useSocket } from '../contexts/SocketContext';
import { getSnapshot } from '../utils/debugBridge';

function formatAge(isoString) {
  if (!isoString) return 'never';
  const ms = Date.now() - new Date(isoString).getTime();
  if (ms < 1000) return 'now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}

export default function SystemHealthMini({ sx }) {
  const { isConnected, isReconnecting, lastConnected } = useSocket();

  // Read debug bridge snapshot (non-reactive — shows last-known state, not live updates)
  const snap = useMemo(() => {
    const s = getSnapshot();
    const eventsTotal = s.events.length;
    const rejectionsTotal = s.rejections.length;
    const errorsTotal = s.errors.length;
    const lastEvent = s.events[s.events.length - 1];
    const reconnects = s.events.filter(e => e.eventName === '_socket_reconnect').length;
    return { eventsTotal, rejectionsTotal, errorsTotal, lastEvent, reconnects };
  }, [isConnected]); // Recompute when connection state changes

  const socketColor = isConnected ? 'success' : isReconnecting ? 'warning' : 'error';
  const socketLabel = isConnected ? 'Connected' : isReconnecting ? 'Reconnecting' : 'Disconnected';

  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', ...sx }}>
      {/* Socket status */}
      <Tooltip title={`Last connected: ${lastConnected ? new Date(lastConnected).toLocaleTimeString() : 'never'}`} arrow>
        <Chip
          icon={isConnected ? <WifiIcon sx={{ fontSize: 14 }} /> : <WifiOffIcon sx={{ fontSize: 14 }} />}
          label={socketLabel}
          size="small"
          color={socketColor}
          variant="outlined"
          sx={{ height: 22, fontSize: '0.65rem' }}
        />
      </Tooltip>

      {/* Events processed */}
      {snap.eventsTotal > 0 && (
        <Tooltip title={`Last event: ${snap.lastEvent ? `${snap.lastEvent.eventName} (${formatAge(snap.lastEvent.receivedAt)})` : 'none'}`} arrow>
          <Chip
            icon={<ShieldIcon sx={{ fontSize: 12 }} />}
            label={`${snap.eventsTotal} events`}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.65rem', color: 'text.secondary', borderColor: 'divider' }}
          />
        </Tooltip>
      )}

      {/* Guard rejections */}
      {snap.rejectionsTotal > 0 && (
        <Tooltip title={`${snap.rejectionsTotal} duplicate/stale events filtered by guard layer`} arrow>
          <Chip
            label={`${snap.rejectionsTotal} filtered`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.65rem' }}
          />
        </Tooltip>
      )}

      {/* Reconnects */}
      {snap.reconnects > 0 && (
        <Tooltip title={`Socket reconnected ${snap.reconnects} time(s) this session`} arrow>
          <Chip
            label={`${snap.reconnects} reconnect${snap.reconnects > 1 ? 's' : ''}`}
            size="small"
            color="info"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.65rem' }}
          />
        </Tooltip>
      )}

      {/* Errors */}
      {snap.errorsTotal > 0 && (
        <Tooltip title={`${snap.errorsTotal} guard/system errors detected this session`} arrow>
          <Chip
            label={`${snap.errorsTotal} error${snap.errorsTotal > 1 ? 's' : ''}`}
            size="small"
            color="error"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.65rem' }}
          />
        </Tooltip>
      )}
    </Box>
  );
}
