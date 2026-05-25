/**
 * AlertStrip — compact stacked admin alerts.
 *
 * Each alert row: severity dot + title + short body + since.
 * Whole row is clickable when the alert has an `href`.
 *
 * Rendered above the Fleet Health tiles. Intentionally small — this is
 * "what needs attention right now", not a notification centre.
 */

import { Box, Typography, Paper, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import StatusDot from './StatusDot';
import { formatSince } from '../../utils/fleetAlerts';

const SEVERITY_TO_STATE = {
  info:     'healthy', // info alerts use the healthy dot colour
  warning:  'warning',
  critical: 'error',
};

const SEVERITY_LABEL = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export default function AlertStrip({ alerts, now }) {
  const navigate = useNavigate();
  const theme = useTheme();

  if (!alerts || alerts.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      {alerts.map((alert) => {
        const state = SEVERITY_TO_STATE[alert.severity] || 'healthy';
        const dotColor = {
          healthy: theme.palette.info?.main || theme.palette.primary.main,
          warning: theme.palette.warning.main,
          error:   theme.palette.error.main,
        }[state];
        const clickable = Boolean(alert.href);

        return (
          <Paper
            key={alert.id}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => navigate(alert.href) : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(alert.href); }
            } : undefined}
            elevation={0}
            sx={{
              position: 'relative',
              p: 1.25,
              pl: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              cursor: clickable ? 'pointer' : 'default',
              transition: 'box-shadow 0.15s ease, transform 0.1s ease',
              overflow: 'hidden',
              '&:hover': clickable ? { boxShadow: 2 } : undefined,
              '&:focus-visible': clickable ? {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              } : undefined,
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: 3,
                bgcolor: dotColor,
              },
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.25,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
              <StatusDot state={state} size={10} glow={false} label={SEVERITY_LABEL[alert.severity]} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }} noWrap>
                  {alert.title}
                </Typography>
                {alert.body && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {alert.body}
                  </Typography>
                )}
              </Box>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, ml: { sm: 1 }, fontVariantNumeric: 'tabular-nums' }}
            >
              since {formatSince(alert.firstSeenAt, now)}
            </Typography>
          </Paper>
        );
      })}
    </Box>
  );
}
