import { Chip, Tooltip, useTheme } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import StarsIcon from '@mui/icons-material/Stars'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EditNoteIcon from '@mui/icons-material/EditNote'
import VerifiedIcon from '@mui/icons-material/Verified'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

/**
 * StatusChip — color-coded status chip using theme palette colors.
 * Replaces hardcoded hex status chips in DailyScheduler, AutoGift, AutomationScheduler, etc.
 *
 * Usage:
 *   <StatusChip status="completed" />
 *   <StatusChip status="running" label="In Progress" />
 *   <StatusChip status="error" label="Failed" size="small" />
 */

const STATUS_CONFIG = {
  // Success states
  completed:  { color: 'success', icon: CheckCircleOutlineIcon },
  success:    { color: 'success', icon: CheckCircleOutlineIcon },
  active:     { color: 'success', icon: CheckCircleOutlineIcon },
  healthy:    { color: 'success', icon: CheckCircleOutlineIcon },

  // Warning states
  running:    { color: 'warning', icon: PlayCircleOutlineIcon },
  pending:    { color: 'warning', icon: HourglassEmptyIcon },
  waiting:    { color: 'warning', icon: HourglassEmptyIcon },
  in_progress: { color: 'warning', icon: PlayCircleOutlineIcon },

  // Error states
  failed:     { color: 'error', icon: ErrorOutlineIcon },
  error:      { color: 'error', icon: ErrorOutlineIcon },
  critical:   { color: 'error', icon: ErrorOutlineIcon },
  stopped:    { color: 'error', icon: CancelOutlinedIcon },
  cancelled:  { color: 'error', icon: CancelOutlinedIcon },
  // Wave 7: per-container/operational states (taxonomy parity with HuntIntelligence)
  stalled:    { color: 'error', icon: WarningAmberIcon },
  stale:      { color: 'warning', icon: WarningAmberIcon },
  degraded:   { color: 'warning', icon: WarningAmberIcon },
  warning:    { color: 'warning', icon: WarningAmberIcon },
  low_activity: { color: 'info', icon: HourglassEmptyIcon },
  starting:   { color: 'info', icon: HourglassEmptyIcon },

  // Neutral states
  idle:       { color: 'default', icon: PauseCircleOutlineIcon },
  inactive:   { color: 'default', icon: PauseCircleOutlineIcon },
  unknown:    { color: 'default', icon: HourglassEmptyIcon },

  // ── Phase 3 (Apr 2026) — Godpack/Wonderpick + Smart Clear vocabulary ──
  // Phase 5.7 (Apr 2026) — labels normalized via lib/decisionLanguage.js.
  // Lowercase enum keys (live/picked/expired/high_safe/...) are
  // unchanged so callers don't need to refactor; only the visible
  // strings switch from ALL CAPS / operator wording to the calmer
  // Decision Language vocabulary. Tooltip text also updated to match.
  //
  // Status (godpack lifecycle)
  live:        { color: 'success', icon: StarsIcon,             tip: 'Active right now',                                                  label: 'Live'                  },
  // Phase 5.7 finalize — display "Awaiting confirmation" instead of
  // "Picked" everywhere a user reads it. The PICKED enum stays
  // unchanged in the DB / API / detection layer; only the label the
  // user sees is friendlier.
  picked:      { color: 'warning', icon: CheckCircleOutlineIcon, tip: 'Awaiting confirmation — pending verification', label: 'Awaiting confirmation' },
  expired:     { color: 'error',   icon: CancelOutlinedIcon,    tip: 'Window closed',                                                     label: 'Expired'               },
  // 'pending' already exists above — Phase-3 reuses it (warning + hourglass)
  // 'unknown' already exists above — Phase-3 reuses it (default + hourglass)

  // Source
  hunt:        { color: 'info',      icon: StarsIcon,        tip: 'Found by hunt bot',          label: 'Hunt' },
  wonderpick:  { color: 'secondary', icon: AutoAwesomeIcon,  tip: 'Found via Wonder Pick',      label: 'Wonderpick' },
  manual:      { color: 'default',   icon: EditNoteIcon,     tip: 'Manually recorded',          label: 'Manual' },

  // Confidence (Smart Clear) — Phase 5.7: matches the Decision
  // Language CONFIDENCE ladder (High / Medium / Protected). Phase 5.1
  // already shipped these strings on the Friends.jsx accordion
  // headers; StatusChip now agrees so chip + accordion read identical.
  high_safe:        { color: 'success', icon: VerifiedIcon,    tip: 'Safe to remove — every available check passed',                   label: 'High confidence'   },
  medium_safe:      { color: 'warning', icon: WarningAmberIcon, tip: 'Safe per evaluator but not every optional check could be done', label: 'Medium confidence' },
  blocked_unknown:  { color: 'error',   icon: LockOutlinedIcon, tip: 'Protected — kept by safety rules and cannot be auto-removed',   label: 'Protected'         },
}

export default function StatusChip({ status, label, size = 'small', showIcon = true, title = null, sx, ...props }) {
  const theme = useTheme()
  // Normalize: lowercase + collapse separators ("/", "-", " ") to "_"
  // so "HIGH_SAFE", "high safe", "high-safe" all map to the same key.
  const key = (status || 'unknown').toString().toLowerCase().replace(/[\s/-]+/g, '_')
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.unknown
  const paletteColor = theme.palette[config.color]?.main || theme.palette.text.secondary
  const Icon = config.icon

  // Phase 3 — config may carry a curated label and tooltip. label prop
  // still wins so callers can override per-instance.
  const displayLabel = label || config.label || status?.replace(/_/g, ' ') || 'Unknown'
  const displayTitle = title || config.tip || null

  // Phase 4.6 — adopt theme.custom.chip + theme.custom.radius tokens so
  // every StatusChip instance picks up future design-system changes
  // automatically. Falls back to MUI defaults if a consumer renders
  // outside ThemeProvider (defensive — should never happen in app).
  const chipTokens   = theme.custom?.chip   || { fontWeight: 600, fontSize: '0.6875rem' }
  const radiusTokens = theme.custom?.radius || { sm: 8 }
  const motion       = theme.custom?.transitions?.normal || '0.2s ease'

  const chip = (
    <Chip
      size={size}
      label={displayLabel}
      icon={showIcon ? <Icon sx={{ fontSize: '0.9rem !important' }} /> : undefined}
      sx={{
        fontWeight: chipTokens.fontWeight,
        textTransform: config.label ? 'none' : 'capitalize',  // Phase-3 labels carry their own casing
        borderRadius: `${radiusTokens.sm}px`,
        transition: `background-color ${motion}, border-color ${motion}`,
        bgcolor: `${paletteColor}18`,
        color: paletteColor,
        border: `1px solid ${paletteColor}30`,
        '& .MuiChip-icon': { color: paletteColor },
        ...sx,
      }}
      {...props}
    />
  )
  return displayTitle ? <Tooltip title={displayTitle} arrow>{chip}</Tooltip> : chip
}

// Exported for tests + future consumers.
export const STATUS_CONFIG_KEYS = Object.keys(STATUS_CONFIG)
