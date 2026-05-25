/**
 * StatusDot — compact 4-state status indicator.
 *
 * One visual signal, one tooltip. No wordy chip. Used in:
 *   - Hunters table rows
 *   - Fleet Health tiles
 *   - (future) any operational list that has a binary-plus-degraded state
 *
 * States map 1:1 to utils/hunterStatus.HUNTER_STATES:
 *   healthy → theme.palette.success.main
 *   warning → theme.palette.warning.main
 *   error   → theme.palette.error.main
 *   idle    → theme.palette.action.disabled
 */

import { Box, Tooltip, useTheme } from '@mui/material';

const STATE_TOKEN = {
  healthy: 'success',
  warning: 'warning',
  error:   'error',
  idle:    'action',
};

export default function StatusDot({ state = 'idle', label, size = 10, glow = true }) {
  const theme = useTheme();
  const token = STATE_TOKEN[state] || 'action';
  const color = token === 'action'
    ? theme.palette.action.disabled
    : theme.palette[token].main;

  const tooltip = label || (state.charAt(0).toUpperCase() + state.slice(1));

  return (
    <Tooltip title={tooltip} arrow>
      <Box
        aria-label={`status: ${state}`}
        role="status"
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: color,
          boxShadow: glow ? `0 0 ${Math.round(size * 0.6)}px ${color}` : 'none',
          flexShrink: 0,
          transition: 'background-color 0.2s ease',
          display: 'inline-block',
        }}
      />
    </Tooltip>
  );
}
