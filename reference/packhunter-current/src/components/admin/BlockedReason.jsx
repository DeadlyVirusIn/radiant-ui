/**
 * BlockedReason — shared UI for "why is this action disabled?".
 *
 * Two render flavours:
 *
 *   <BlockedReasonChip reason={…} />
 *     Compact lock-icon + label chip with a tooltip carrying the full
 *     reason. Use inline next to (or in place of) a disabled control.
 *     Color and severity come from kindMeta(reason.kind). Always-visible
 *     (no hover required) — works on touch.
 *
 *   <BlockedReasonInline reason={…} />
 *     One-line caption. Shown under a disabled row so mobile / keyboard
 *     users see the reason without needing a hover tooltip.
 *
 * Both render NULL when reason.allowed === true. Safe to drop in next to
 * every disabled button without conditional wrappers.
 *
 * Spec: utils/blockedActions — single source of truth for reason objects.
 */

import { Box, Chip, Tooltip, Typography, alpha } from '@mui/material';
import {
  Lock as LockIcon,
  HourglassBottom as CooldownIcon,
  Person as PersonIcon,
  Shield as ShieldIcon,
  CloudOff as StaleIcon,
  HelpOutline as UnknownIcon,
  CircularProgress as Spinner,
} from '@mui/icons-material';
import CircularProgress from '@mui/material/CircularProgress';
import { kindMeta, REASON_KINDS } from '../../utils/blockedActions';

function iconFor(kind) {
  switch (kind) {
    case REASON_KINDS.COOLDOWN:        return CooldownIcon;
    case REASON_KINDS.STALE_DATA:      return StaleIcon;
    case REASON_KINDS.IN_FLIGHT:       return null; // spinner instead
    case REASON_KINDS.SELF_PROTECTED:  return PersonIcon;
    case REASON_KINDS.OWNER_PROTECTED: return ShieldIcon;
    case REASON_KINDS.ADMIN_PROTECTED: return ShieldIcon;
    case REASON_KINDS.INSUFFICIENT_DATA: return UnknownIcon;
    default:                           return LockIcon;
  }
}

export function BlockedReasonChip({ reason, size = 'small', showLabel = true, sx }) {
  if (!reason || reason.allowed) return null;
  const meta = kindMeta(reason.kind);
  const Icon = iconFor(reason.kind);

  const chipIcon = reason.kind === REASON_KINDS.IN_FLIGHT
    ? <CircularProgress size={11} sx={{ ml: '4px', color: meta.color }} />
    : Icon ? <Icon sx={{ fontSize: 11 }} /> : <LockIcon sx={{ fontSize: 11 }} />;

  return (
    <Tooltip title={reason.fullReason || reason.shortReason || meta.label} placement="top" arrow>
      <Chip
        icon={chipIcon}
        label={showLabel ? (reason.label || meta.label) : undefined}
        size={size}
        sx={{
          height: 16,
          fontSize: '0.55rem',
          fontWeight: 700,
          bgcolor: alpha(meta.color, 0.15),
          color: meta.color,
          border: `1px solid ${alpha(meta.color, 0.3)}`,
          '& .MuiChip-icon': { color: meta.color, ml: '4px' },
          flexShrink: 0,
          ...sx,
        }}
      />
    </Tooltip>
  );
}

export function BlockedReasonInline({ reason, sx }) {
  if (!reason || reason.allowed) return null;
  const meta = kindMeta(reason.kind);
  return (
    <Typography
      variant="caption"
      sx={{
        fontSize: '0.6rem', lineHeight: 1.2, display: 'block',
        color: meta.color, fontWeight: 500, ...sx,
      }}
    >
      {reason.shortReason || reason.fullReason}
      {reason.suggestedFix && (
        <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
          · {reason.suggestedFix}
        </Box>
      )}
    </Typography>
  );
}

/**
 * BlockedReasonHelp — used inside drawers / dialogs where the full
 * reason should sit beside its action button without a tooltip.
 */
export function BlockedReasonHelp({ reason, sx }) {
  if (!reason || reason.allowed) return null;
  const meta = kindMeta(reason.kind);
  return (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', ...sx }}>
      <BlockedReasonChip reason={reason} showLabel />
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
        {reason.fullReason}
        {reason.suggestedFix && (
          <Box component="span" sx={{ display: 'block', color: meta.color, mt: 0.25 }}>
            → {reason.suggestedFix}
          </Box>
        )}
      </Typography>
    </Box>
  );
}

export default BlockedReasonChip;
