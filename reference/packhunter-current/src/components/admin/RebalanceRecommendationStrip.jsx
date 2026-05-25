/**
 * RebalanceRecommendationStrip — Fleet Health awareness band.
 *
 * Shown only when status is 'recommended' | 'blocked' | 'applied'.
 * Never shown for 'none' or 'weak' — those don't need top-level attention.
 *
 * Clicking the strip navigates to Hybrid Control for full detail + Apply.
 */

import { Box, Paper, Typography, Chip, Button, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  AutoFixHigh as RebalanceIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as AppliedIcon,
  Block as BlockedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import LastActionStrip from './LastActionStrip';
import { summarizeFleetHeadline } from '../../utils/lastActionSummary';

const STATUS_META = {
  recommended: { color: 'warning', icon: WarningIcon,  label: 'Recommended' },
  blocked:     { color: 'error',   icon: BlockedIcon,  label: 'Blocked' },
  applied:     { color: 'success', icon: AppliedIcon,  label: 'Applied' },
};

export default function RebalanceRecommendationStrip({ headline }) {
  const navigate = useNavigate();
  const theme = useTheme();

  if (!headline) return null;
  const meta = STATUS_META[headline.status];
  if (!meta) return null; // none / weak → silent

  const Icon = meta.icon;
  const accent = theme.palette[meta.color]?.main || theme.palette.divider;

  // Phase 17 — deep-link with context. Hybrid Control reads ?focus= on
  // mount, scrolls to the matching panel, and replaces the URL so the
  // back-button stays clean.
  const focusParam =
    headline.status === 'recommended' ? 'recommendation' :
    headline.status === 'blocked'     ? 'blocker' :
    headline.status === 'applied'     ? 'recommendation' :
    null;
  const linkHref = headline.href
    ? (focusParam ? `${headline.href}${headline.href.includes('?') ? '&' : '?'}focus=${focusParam}` : headline.href)
    : null;

  return (
    <Paper
      elevation={0}
      onClick={() => linkHref && navigate(linkHref)}
      role={headline.href ? 'button' : undefined}
      tabIndex={headline.href ? 0 : undefined}
      onKeyDown={(e) => {
        if (linkHref && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          navigate(linkHref);
        }
      }}
      sx={{
        p: 1.25, pl: 2, mb: 2,
        border: 1, borderColor: 'divider', borderRadius: 1.5,
        cursor: headline.href ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        transition: 'box-shadow 0.15s ease',
        '&:hover': headline.href ? { boxShadow: 2 } : undefined,
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, bgcolor: accent,
        },
        display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
      }}
    >
      <Icon fontSize="small" sx={{ color: accent }} />
      <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
        Rebalance: {meta.label}
      </Typography>

      {/* Status-specific summary */}
      {headline.status === 'recommended' && (
        <Typography variant="caption" color="text.secondary">
          imbalance {headline.currentImbalance} → {headline.projectedImbalance}
        </Typography>
      )}
      {headline.status === 'blocked' && (
        <Typography variant="caption" color="text.secondary">
          imbalance {headline.currentImbalance}; {headline.blockers?.join(', ') || 'no movable users'}
        </Typography>
      )}
      {headline.status === 'applied' && headline.lastApply && (
        <Typography variant="caption" color="text.secondary">
          imbalance {headline.lastApply.imbalanceBefore} → {headline.lastApply.imbalanceAfter}
        </Typography>
      )}

      <Chip
        size="small"
        label={`mode: ${headline.mode || 'recommend-only'}`}
        variant="outlined"
        sx={{ ml: 0.5, height: 20, fontSize: '0.65rem' }}
      />

      <Box sx={{ flex: 1 }} />

      {linkHref && (
        <Button size="small" endIcon={<ArrowIcon fontSize="small" />}>
          Open Hybrid Control
        </Button>
      )}

      {/* Phase 17 — last-action summary so operators see "what just happened"
          on Fleet Health without click-through. Lines hidden when none. */}
      <Box sx={{ flexBasis: '100%' }}>
        <LastActionStrip lines={summarizeFleetHeadline({ rebalanceHeadline: headline })} title="Recent" />
      </Box>
    </Paper>
  );
}
