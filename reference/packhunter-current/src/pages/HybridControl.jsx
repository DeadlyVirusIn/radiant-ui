/**
 * Hybrid Mode Control — Elite operator experience
 *
 * Final polish pass:
 *  1. Action feedback: rich toasts with before/after impact
 *  2. Empty states: friendly copy for every blank area
 *  3. Block reasons: consistent tooltips explaining WHY
 *  4. Mini audit trail: last 8 actions with actor/time/outcome
 *  5. Freshness indicators: last refreshed + age + auto-refresh
 *  6. Consistency: spacing, color hierarchy, typography
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Paper, Chip, Tooltip, Alert,
  Snackbar, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Divider, LinearProgress,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import {
  PushPin as PinIcon,
  Lock as LockIcon,
  AutoFixHigh as RebalanceIcon,
  Sync as ReconcileIcon,
  DragIndicator as DragIcon,
  Visibility as PreviewIcon,
  TipsAndUpdates as SuggestIcon,
  ArrowForward as ArrowIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  History as HistoryIcon,
  Schedule as ClockIcon,
} from '@mui/icons-material'
import PageHeader from '../components/PageHeader'
import { hybridControl } from '../services/api'
import {
  STALENESS, SOURCE,
  classifyStaleness, projectedLoadAfterMove, currentImbalance,
  moveWorsensImbalance, sourceOfPlacement, sourceLabel, sourceColor,
  evaluateActionSafety, isDuplicateAction,
} from '../utils/hybridControlSafety'
import { canMoveHunter, kindMeta } from '../utils/blockedActions'
import { BlockedReasonChip, BlockedReasonInline } from '../components/admin/BlockedReason'
import LastActionStrip from '../components/admin/LastActionStrip'
import { summarizeHybridControl } from '../utils/lastActionSummary'
import {
  FormControl, Select, MenuItem,
} from '@mui/material'
import { computeBalance, computeBalanceByPools, formatBalanceReason } from '../utils/balance'
import NowNextRiskRail from '../components/admin/NowNextRiskRail'
import useRecoveryStatus from '../hooks/useRecoveryStatus'
import { formatRecoveryLabels, mergeHealthVerdicts, getSystemHealthVerdict } from '../components/hunt/huntConstants'

const GROUP_COLORS = { 1: '#22C55E', 2: '#F59E0B', 3: '#3B82F6', 4: '#8B5CF6', 0: '#6B7280' }
// Phase 5.18-B — drop hardcoded "C4 Legacy" label. All containers
// can run any operator-configured pack; legacy classification is a
// per-pack derivation, not a per-container label.
const GROUP_LABELS = { 1: 'C1', 2: 'C2', 3: 'C3', 4: 'C4' }
// 2026-04-24 C3 follow-up — pool definitions mirror
// lib/containerPolicy.js. Balance is computed per-pool because legacy
// users can't move to standard containers and vice versa.
const POOLS = [
  { name: 'standard', groups: [1, 2] },
  { name: 'legacy',   groups: [3, 4] },
]
// Kept for back-compat with callers that expect a flat standard list.
const STD_GROUPS = [1, 2, 3]

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * C3 (2026-04-24) — per-container label now reflects the strict rule:
 *   target = floor(total_participating / n_participating)
 *   this container is "Balanced" iff |count - target| <= 1, else
 *   "Over" (delta > +1) or "Under" (delta < -1).
 *
 * Prior behavior (soft `avgLoad` band with a "Slight" middle tier)
 * could label C3=10 vs target=8 as "Slight" when it should be a hard
 * mismatch. Rule now agrees with backend lib/balance.js — tested by
 * tests/balanceStrict.test.js.
 */
function getLoadStatus(userCount, target) {
  if (target === 0 && userCount === 0) return { label: 'Empty', color: '#6B7280' }
  const delta = userCount - target
  if (Math.abs(delta) <= 1) return { label: 'Balanced', color: '#22C55E' }
  if (delta > 1)  return { label: `Over (+${delta})`,  color: '#EF4444' }
  return { label: `Under (${delta})`,  color: '#EF4444' }
}

function getHealthPercent(s) {
  if (!s?.totalUsers) return 100
  return Math.round(((s.totalUsers - (s.misassigned || 0) - (s.unassigned || 0)) / s.totalUsers) * 100)
}

function computeSuggestedMove(grouped) {
  const sc = STD_GROUPS.map(g => ({ group: g, count: (grouped[g] || []).length })).sort((a, b) => b.count - a.count)
  if (sc[0].count - sc[sc.length - 1].count <= 1) return null
  const cands = (grouped[sc[0].group] || []).filter(u => !u.pinned && !u.isLegacy && u.assignmentMode !== 'manual')
  if (!cands.length) return null
  return { user: cands[0], from: sc[0].group, to: sc[sc.length - 1].group,
    improvement: `${sc[0].count}/${sc[sc.length - 1].count} \u2192 ${sc[0].count - 1}/${sc[sc.length - 1].count + 1}` }
}

/**
 * Resolve why a user can't be dragged. Thin adapter over the shared
 * blockedActions.canMoveHunter resolver — kept here so existing call
 * sites keep their `{ kind, label, reason }` consumer shape but the
 * underlying logic is unified across pages.
 */
function getBlockReason(user, isLegacyContainer, moveCooldownMinutes = 30, now = Date.now()) {
  const r = canMoveHunter({ user, isLegacyContainer, moveCooldownMinutes, now })
  if (r.allowed) return null
  return { ...r, reason: r.fullReason } // alias `reason` for legacy callers
}

function timeAgo(ts) {
  if (!ts) return 'never'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ── User Card ────────────────────────────────────────────────────────────────

function UserCard({ user, onPin, onClearManual, isDragDisabled, isLegacyContainer, pendingKey, moveCooldownMinutes }) {
  const theme = useTheme()
  const blockReason = isDragDisabled ? getBlockReason(user, isLegacyContainer, moveCooldownMinutes) : null
  const source = sourceOfPlacement(user)
  const pinBusy = pendingKey === `pin:${user.id}`
  const clearBusy = pendingKey === `clear:${user.id}`

  // Colour palette comes from the shared blockedActions kindMeta so
  // every disabled surface in the app uses the same color per reason.
  const lockColor = blockReason ? kindMeta(blockReason.kind).color : null

  const handleDragStart = (e) => {
    if (isDragDisabled) { e.preventDefault(); return }
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: user.id, discordId: user.discordId, accountType: user.accountType,
      fromGroup: user.containerGroup, username: user.username,
      isLegacy: user.isLegacy, pinned: user.pinned,
    }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const card = (
    <Paper
      draggable={!isDragDisabled}
      onDragStart={handleDragStart}
      elevation={0}
      sx={{
        p: 0.8, mb: 0.4,
        cursor: isDragDisabled ? 'default' : 'grab',
        opacity: isDragDisabled ? 0.5 : 1,
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        '&:hover': isDragDisabled ? {} : { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: alpha(theme.palette.primary.main, 0.2) },
        '&:active': isDragDisabled ? {} : { cursor: 'grabbing' },
        display: 'flex', alignItems: 'center', gap: 0.8,
        borderLeft: user.isLegacy ? '3px solid #8B5CF6' : user.pinned ? '3px solid #F59E0B' : '3px solid transparent',
        borderRadius: 1, transition: 'all 0.15s ease',
      }}
    >
      {/* Drag handle when movable; lock chip with reason when blocked.
          The lock is always-visible (no hover required) so mobile / touch
          operators see WHY a card is disabled at a glance. */}
      {isDragDisabled
        ? (
          <Tooltip title={blockReason?.reason || 'Move blocked'} placement="top" arrow>
            <Chip
              icon={<LockIcon sx={{ fontSize: 11 }} />}
              label={blockReason?.label || 'Blocked'}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.55rem',
                fontWeight: 700,
                bgcolor: alpha(lockColor || '#6B7280', 0.15),
                color: lockColor || '#6B7280',
                border: `1px solid ${alpha(lockColor || '#6B7280', 0.3)}`,
                '& .MuiChip-icon': { color: lockColor || '#6B7280', ml: '4px' },
                flexShrink: 0,
              }}
            />
          </Tooltip>
        )
        : <DragIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
      }
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.78rem' }}>
            {user.username}
          </Typography>
          {user.isLegacy && <Chip label="L" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: '#8B5CF6', color: '#fff', minWidth: 0 }} />}
          {user.pinned && <PinIcon sx={{ fontSize: 11, color: '#F59E0B' }} />}
        </Box>
        {/* Always-visible inline reason caption when blocked — no hover required. */}
        {blockReason && (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6rem', lineHeight: 1.2, mt: 0.1, display: 'block',
              color: lockColor || 'text.disabled', fontWeight: 500,
            }}
          >
            {blockReason.reason}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.2, mt: 0.2, alignItems: 'center' }}>
          {/* Phase 13 — source-of-placement badge. One tiny chip per row. */}
          <Tooltip title={
            source === SOURCE.MANUAL ? `Manual override${user.movedBy ? ` by ${user.movedBy}` : ''}${user.lastMovedAt ? ` · ${timeAgo(user.lastMovedAt)}` : ''}`
            : source === SOURCE.PINNED ? 'Pinned — excluded from auto-rebalance'
            : source === SOURCE.RECENT_OVERRIDE ? `Recently moved${user.lastMovedAt ? ` (${timeAgo(user.lastMovedAt)})` : ''}`
            : source === SOURCE.AUTO ? 'Placed by auto-rebalancer'
            : 'Default placement'
          } arrow>
            <Chip
              label={sourceLabel(source)}
              size="small"
              sx={{
                fontSize: '0.55rem', height: 14,
                bgcolor: alpha(sourceColor(source), 0.15),
                color: sourceColor(source),
                fontWeight: 600, minWidth: 0,
              }}
            />
          </Tooltip>
          {user.packs?.map(p => (
            <Chip key={p.name} label={p.name} size="small" sx={{
              fontSize: '0.6rem', height: 16,
              bgcolor: p.packClass === 'legacy' ? alpha('#8B5CF6', 0.15) : alpha('#22C55E', 0.1),
              color: p.packClass === 'legacy' ? '#C4B5FD' : '#86EFAC',
            }} />
          ))}
        </Box>
      </Box>
      {/* Phase 13 — hand-back-to-auto when user is in manual override */}
      {source === SOURCE.MANUAL && (
        <Tooltip title="Hand back to auto-rebalancer">
          <IconButton size="small" onClick={() => onClearManual?.(user)}
                      disabled={clearBusy} sx={{ p: 0.2 }}>
            <ReconcileIcon sx={{ fontSize: 13, color: clearBusy ? 'text.disabled' : sourceColor(SOURCE.AUTO) }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={user.pinned ? 'Unpin (allow auto-rebalance)' : 'Pin (exclude from auto-rebalance)'}>
        <IconButton size="small" onClick={() => onPin(user)} disabled={pinBusy} sx={{ p: 0.2 }}>
          {pinBusy
            ? <CircularProgress size={11} />
            : <PinIcon sx={{ fontSize: 13, color: user.pinned ? '#F59E0B' : alpha(theme.palette.text.disabled, 0.3) }} />}
        </IconButton>
      </Tooltip>
    </Paper>
  )

  // Whole-card tooltip for desktop hover; the inline lock chip + caption
  // already cover mobile/touch where hover doesn't fire.
  return blockReason
    ? <Tooltip title={blockReason.reason} placement="left" arrow>{card}</Tooltip>
    : card
}

// ── Container Column ─────────────────────────────────────────────────────────

function ContainerColumn({ groupId, users, loads, avgLoad, onPin, onClearManual, onDrop, dragState, pendingKey, moveCooldownMinutes }) {
  const theme = useTheme()
  const color = GROUP_COLORS[groupId]
  const label = GROUP_LABELS[groupId]
  const load = loads?.containers?.[groupId]
  const isLegacy = groupId === 4
  const userCount = users.length
  const loadStatus = isLegacy ? null : getLoadStatus(userCount, avgLoad)

  const isDragging = dragState?.active
  const isSource = isDragging && dragState.fromGroup === groupId
  const isValidTarget = isDragging && !isSource && (isLegacy ? dragState.isLegacy : !dragState.isLegacy && STD_GROUPS.includes(groupId))
  const isInvalidTarget = isDragging && !isSource && !isValidTarget
  const deltaCount = isDragging ? (isSource ? -1 : isValidTarget ? +1 : 0) : 0

  const handleDragOver = (e) => {
    if (isInvalidTarget) { e.dataTransfer.dropEffect = 'none'; return }
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e) => {
    e.preventDefault()
    try { const d = JSON.parse(e.dataTransfer.getData('application/json')); if (d.fromGroup !== groupId) onDrop(d, groupId) } catch {}
  }

  const packCounts = {}
  for (const u of users) for (const p of (u.packs || [])) packCounts[p.name] = (packCounts[p.name] || 0) + 1
  const packEntries = Object.entries(packCounts).sort((a, b) => b[1] - a[1])

  return (
    <Paper onDragOver={handleDragOver} onDrop={handleDrop} sx={{
      flex: 1, minWidth: 240, maxWidth: 340,
      border: `2px solid ${isValidTarget ? '#22C55E' : isInvalidTarget ? alpha('#EF4444', 0.4) : isSource ? alpha(color, 0.6) : alpha(color, 0.25)}`,
      borderRadius: 2, overflow: 'hidden', transition: 'all 0.2s ease',
      boxShadow: isValidTarget ? `0 0 12px ${alpha('#22C55E', 0.25)}` : isSource ? `0 0 8px ${alpha(color, 0.2)}` : 'none',
      opacity: isInvalidTarget ? 0.5 : 1,
    }}>
      <Box sx={{ bgcolor: alpha(color, 0.08), px: 1.5, py: 1, borderBottom: `1px solid ${alpha(color, 0.15)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color, fontSize: '0.9rem' }}>{label}</Typography>
          {loadStatus && <Chip label={loadStatus.label} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: alpha(loadStatus.color, 0.15), color: loadStatus.color }} />}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography variant="caption" fontWeight={600} sx={{ color: 'text.secondary' }}>
            {userCount} users
            {deltaCount !== 0 && <Typography component="span" sx={{ color: deltaCount > 0 ? '#22C55E' : '#EF4444', fontWeight: 700, ml: 0.5, fontSize: '0.75rem' }}>{deltaCount > 0 ? `+${deltaCount}` : deltaCount}</Typography>}
          </Typography>
          {load && <Typography variant="caption" color="text.disabled">{load.packCount} packs</Typography>}
          {/* Phase 5.18-B — drop hardcoded "legacy" chip on C4. Era
              classification is derived per-user from the operator's
              container_pack_config, not from the container number. */}
        </Box>
        {packEntries.length > 0 && (
          <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
            {packEntries.slice(0, 5).map(([name, count]) => (
              <Chip key={name} label={`${name} (${count})`} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: alpha(color, 0.1), color: alpha(theme.palette.text.primary, 0.7) }} />
            ))}
            {packEntries.length > 5 && <Chip label={`+${packEntries.length - 5}`} size="small" sx={{ height: 16, fontSize: '0.55rem' }} />}
          </Box>
        )}
      </Box>

      {isInvalidTarget && (
        <Box sx={{ px: 1.5, py: 0.4, bgcolor: alpha('#EF4444', 0.06) }}>
          <Typography variant="caption" sx={{ color: '#EF4444', fontSize: '0.65rem' }}>
            {/* Phase 5.18-B — invalid-target message generic now that
                routing is config-driven, not C4-prison. */}
            User's selected pack is not supported by this container's config.
          </Typography>
        </Box>
      )}

      <Box sx={{ p: 0.5, maxHeight: 450, overflowY: 'auto', minHeight: 80 }}>
        {users.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            {/* Phase 5.18 — generic "no users assigned" copy. The
                pre-Phase-5.18 string "Users with A-series packs are
                automatically routed here" was wrong:
                  - implied A-series-only routing (legacy hardcoded);
                  - C4 isn't a legacy prison — operators decide which
                    packs each container runs via the per-container
                    pack config panel.
                Routing is now config-driven via lib/containerEligibility. */}
            <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.8rem', mb: 0.5 }}>
              No users assigned to this container
            </Typography>
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.disabled, 0.5) }}>
              Users are assigned here when their selected pack is supported by this container and balancing allows it.
            </Typography>
          </Box>
        )}
        {users.map(u => {
          // Recompute the disabled flag so cooldown-protected users render
          // as blocked too. Server enforces the same rule in
          // selectRebalanceCandidates (last_moved_at < NOW - cooldown).
          const cooldownActive = u.lastMovedAt && Number.isFinite(moveCooldownMinutes)
            && (Date.now() - new Date(u.lastMovedAt).getTime()) < moveCooldownMinutes * 60_000
          const isDragDisabled = u.pinned || u.isLegacy || (isLegacy && !u.isLegacy)
            || u.assignmentMode === 'manual' || cooldownActive
          return (
            <UserCard key={`${u.discordId}-${u.accountType}`} user={u}
              onPin={onPin} onClearManual={onClearManual}
              isDragDisabled={isDragDisabled}
              isLegacyContainer={isLegacy}
              pendingKey={pendingKey}
              moveCooldownMinutes={moveCooldownMinutes} />
          )
        })}
      </Box>
    </Paper>
  )
}

// ── Suggested Move Panel ─────────────────────────────────────────────────────

function SuggestedMovePanel({ suggestion, onPreview, onApply, loading }) {
  const theme = useTheme()
  if (!suggestion) {
    return (
      <Paper sx={{ p: 1.2, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, bgcolor: alpha('#22C55E', 0.03), border: `1px solid ${alpha('#22C55E', 0.1)}` }}>
        <CheckIcon sx={{ color: '#22C55E', fontSize: 16 }} />
        <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.6), fontSize: '0.8rem' }}>
          All containers are balanced. No moves needed.
        </Typography>
      </Paper>
    )
  }
  return (
    <Paper sx={{ p: 1.2, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', bgcolor: alpha('#F59E0B', 0.04), border: `1px solid ${alpha('#F59E0B', 0.2)}` }}>
      <SuggestIcon sx={{ color: '#F59E0B', fontSize: 16 }} />
      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>Suggested move:</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Chip label={suggestion.user.username} size="small" sx={{ fontWeight: 600, height: 22 }} />
        <Chip label={`C${suggestion.from}`} size="small" sx={{ height: 20, bgcolor: alpha(GROUP_COLORS[suggestion.from], 0.15), color: GROUP_COLORS[suggestion.from] }} />
        <ArrowIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Chip label={`C${suggestion.to}`} size="small" sx={{ height: 20, bgcolor: alpha(GROUP_COLORS[suggestion.to], 0.15), color: GROUP_COLORS[suggestion.to] }} />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{suggestion.improvement}</Typography>
      </Box>
      <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
        <Button size="small" variant="outlined" onClick={onPreview} disabled={loading} sx={{ fontSize: '0.7rem', py: 0.3 }}>Preview</Button>
        <Button size="small" variant="contained" onClick={onApply} disabled={loading} sx={{ fontSize: '0.7rem', py: 0.3 }}>Apply</Button>
      </Box>
    </Paper>
  )
}

// ── Mini Audit Trail ─────────────────────────────────────────────────────────

function AuditTrail({ actions }) {
  const theme = useTheme()
  if (!actions.length) {
    return (
      <Paper sx={{ p: 1.2, mt: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <HistoryIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" fontWeight={600} color="text.secondary">Recent Actions</Typography>
        </Box>
        <Typography variant="caption" sx={{ color: alpha(theme.palette.text.disabled, 0.5) }}>
          No actions taken yet this session. Moves, rebalances, and pin changes will appear here.
        </Typography>
      </Paper>
    )
  }
  return (
    <Paper sx={{ p: 1.2, mt: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <HistoryIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="caption" fontWeight={600} color="text.secondary">Recent Actions ({actions.length})</Typography>
      </Box>
      {actions.slice(0, 8).map((a, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.2, borderTop: i > 0 ? `1px solid ${alpha(theme.palette.divider, 0.05)}` : 'none' }}>
          <Chip label={a.type} size="small" sx={{
            height: 16, fontSize: '0.55rem', fontWeight: 600, minWidth: 50,
            bgcolor: a.severity === 'success' ? alpha('#22C55E', 0.1) : a.severity === 'error' ? alpha('#EF4444', 0.1) : alpha('#3B82F6', 0.1),
            color: a.severity === 'success' ? '#22C55E' : a.severity === 'error' ? '#EF4444' : '#3B82F6',
          }} />
          <Typography variant="caption" sx={{ flex: 1, fontSize: '0.7rem' }} noWrap>{a.message}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', flexShrink: 0 }}>{timeAgo(a.time)}</Typography>
        </Box>
      ))}
    </Paper>
  )
}

// ── Health Bar ────────────────────────────────────────────────────────────────

function HealthBar({ value }) {
  const color = value >= 90 ? '#22C55E' : value >= 70 ? '#F59E0B' : '#EF4444'
  return (
    <Box sx={{ minWidth: 110 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Health</Typography>
        <Typography variant="caption" fontWeight={700} sx={{ color, fontSize: '0.75rem' }}>{value}%</Typography>
      </Box>
      <LinearProgress variant="determinate" value={value} sx={{
        height: 5, borderRadius: 3, bgcolor: alpha(color, 0.12),
        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
      }} />
    </Box>
  )
}

function StatChip({ label, value, color }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 45 }}>
      <Typography variant="h6" fontWeight={700} sx={{ color: color || 'text.primary', lineHeight: 1, fontSize: '1rem' }}>{value ?? '-'}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>{label}</Typography>
    </Box>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function HybridControl() {
  const theme = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [snack, setSnack] = useState(null)
  const [previewDialog, setPreviewDialog] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [dragState, setDragState] = useState({ active: false })
  const [lastRefresh, setLastRefresh] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  // Phase 13 — safety state.
  const [generatedAt, setGeneratedAt] = useState(null)          // server response timestamp
  const [now, setNow] = useState(Date.now())                    // drives live staleness class
  const [pendingKey, setPendingKey] = useState(null)            // per-entity lock; null | `${action}:${id}`
  const lastActionRef = useRef(null)                            // dup-click guard
  // Phase 17 — deep-link focus (?focus=recommendation|blocker). Highlights
  // the relevant panel briefly when arriving from Fleet Health.
  const [focusedPanel, setFocusedPanel] = useState(null)
  const recommendationPanelRef = useRef(null)
  const routerLocation = useLocation()
  const routerNavigate = useRouterNavigate()

  const addAudit = (type, message, severity = 'success') => {
    setAuditLog(prev => [{ type, message, severity, time: new Date().toISOString() }, ...prev].slice(0, 15))
  }

  const loadData = useCallback(async () => {
    try {
      const result = await hybridControl.getData()
      setData(result)
      setError(null)
      setLastRefresh(new Date())
      setGeneratedAt(result?.generatedAt || null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const end = () => setDragState({ active: false })
    document.addEventListener('dragend', end)
    return () => document.removeEventListener('dragend', end)
  }, [])

  // Phase 13 — tick the staleness clock every 5s so the banner updates
  // without requiring a full data refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  // Phase 17 — read ?focus= from the URL once on mount. Scroll to the
  // relevant panel and highlight it for a few seconds, then strip the
  // param so back-navigation works cleanly.
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search)
    const focus = params.get('focus')
    if (!focus) return
    setFocusedPanel(focus)
    // Scroll once data is rendered.
    setTimeout(() => {
      recommendationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 250)
    // Drop the param so refresh / back doesn't re-trigger.
    params.delete('focus')
    params.delete('reason')
    routerNavigate({ pathname: routerLocation.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true })
    // Fade the highlight after 5s.
    const t = setTimeout(() => setFocusedPanel(null), 5000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Phase 13 — cheap dup-click guard wrapper used by every mutation
  // handler. Also applies per-entity pendingKey so the specific button
  // shows a spinner while others stay usable.
  const guardedAction = async ({ actionKey, onRun }) => {
    if (isDuplicateAction({ actionKey, lastAction: lastActionRef.current, windowMs: 1200 })) {
      return { blocked: 'duplicate' }
    }
    if (pendingKey === actionKey) return { blocked: 'in-flight' }
    lastActionRef.current = { key: actionKey, at: Date.now() }
    setPendingKey(actionKey)
    try {
      return await onRun()
    } finally {
      setPendingKey(null)
    }
  }

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(loadData, 60000)
    return () => clearInterval(iv)
  }, [loadData])

  const grouped = { 1: [], 2: [], 3: [], 4: [], 0: [] }
  if (data?.users) for (const u of data.users) { if (!grouped[u.containerGroup]) grouped[u.containerGroup] = []; grouped[u.containerGroup].push(u) }

  const summary = data?.summary || {}
  const rebalance = data?.rebalanceStatus || {}
  const stdCounts = STD_GROUPS.map(g => (grouped[g] || []).length)
  // C3 follow-up (2026-04-24) — pool-aware balance. Standard pool
  // {C1,C2} and legacy pool {C3,C4} balance independently. Overall
  // balanced iff every pool balanced. Counts come from live `grouped`
  // (not from the backend rebalanceStatus snapshot) so a drag/drop
  // between policy-compatible containers updates the chip immediately.
  const poolCounts = {
    1: (grouped[1] || []).length,
    2: (grouped[2] || []).length,
    3: (grouped[3] || []).length,
    4: (grouped[4] || []).length,
  }
  // C6 — recovery state for the NOW / NEXT / RISK rail. Admin-only
  // page, always fetched. Hook handles its own 30s polling.
  const { recovery: hybridRecovery } = useRecoveryStatus({ enabled: true })
  const localBalance = computeBalanceByPools({ counts: poolCounts, pools: POOLS })
  const balanceStatus = rebalance.balanceStatus && rebalance.balanceStatus.pools
    ? rebalance.balanceStatus
    : localBalance
  // Per-container target lookup: each container uses ITS OWN pool's
  // target. A C3 user is compared against the legacy pool's target,
  // not a global mean.
  const targetByGroup = {}
  for (const p of balanceStatus.pools || []) {
    for (const row of p.counts || []) targetByGroup[row.group] = p.target
  }
  const healthPct = getHealthPercent(summary)
  const suggestion = computeSuggestedMove(grouped)

  const handlePin = async (user) => {
    const result = await guardedAction({
      actionKey: `pin:${user.id}`,
      onRun: async () => {
        try {
          await hybridControl.pinParticipant(user.id, !user.pinned)
          const action = user.pinned ? 'unpinned' : 'pinned'
          setSnack({ message: `${user.username} ${action}`, severity: 'success' })
          addAudit('pin', `${user.username} ${action}`)
          loadData()
          return { ok: true }
        } catch (err) { setSnack({ message: err.message, severity: 'error' }); return { ok: false } }
      },
    })
    if (result?.blocked === 'duplicate') {
      setSnack({ message: 'Duplicate click ignored', severity: 'info' })
    }
  }

  // Phase 13 — return a user to auto-rebalancer control without moving them.
  const handleClearManual = async (user) => {
    await guardedAction({
      actionKey: `clear:${user.id}`,
      onRun: async () => {
        try {
          await hybridControl.clearManual(user.id)
          setSnack({ message: `${user.username} returned to auto-rebalancer control`, severity: 'success' })
          addAudit('clear_manual', `${user.username} → auto`)
          loadData()
          return { ok: true }
        } catch (err) { setSnack({ message: err.message, severity: 'error' }); return { ok: false } }
      },
    })
  }

  const handleDrop = async (dragData, toGroup) => {
    setDragState({ active: false })
    if (dragData.isLegacy && toGroup !== 4) { setSnack({ message: 'Legacy users are routed to C4 by assignment policy', severity: 'warning' }); return }
    if (dragData.pinned) { setSnack({ message: `${dragData.username} is pinned \u2014 unpin first to allow moves`, severity: 'warning' }); return }
    try {
      setActionLoading(true)
      const preview = await hybridControl.moveParticipant(dragData.id, toGroup, false)
      setPreviewDialog({ ...preview, dragData, toGroup })
    } catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  const handleConfirmMove = async () => {
    if (!previewDialog) return
    const { dragData, toGroup } = previewDialog
    try {
      setActionLoading(true)
      await hybridControl.moveParticipant(dragData.id, toGroup, true)
      setSnack({ message: `Moved ${dragData.username}: C${dragData.fromGroup} \u2192 C${toGroup}`, severity: 'success' })
      addAudit('move', `${dragData.username} C${dragData.fromGroup}\u2192C${toGroup}`)
      setPreviewDialog(null); loadData()
    } catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  const handleSuggestedPreview = async () => {
    if (!suggestion) return
    try {
      setActionLoading(true)
      const preview = await hybridControl.moveParticipant(suggestion.user.id, suggestion.to, false)
      setPreviewDialog({ ...preview, dragData: { ...suggestion.user, fromGroup: suggestion.from }, toGroup: suggestion.to })
    } catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  const handleSuggestedApply = async () => {
    if (!suggestion) return
    try {
      setActionLoading(true)
      await hybridControl.moveParticipant(suggestion.user.id, suggestion.to, true)
      setSnack({ message: `Applied: ${suggestion.user.username} C${suggestion.from} \u2192 C${suggestion.to} (${suggestion.improvement})`, severity: 'success' })
      addAudit('move', `${suggestion.user.username} C${suggestion.from}\u2192C${suggestion.to}`)
      loadData()
    } catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  const handleSimulateRebalance = async () => {
    try { setActionLoading(true); const r = await hybridControl.simulateRebalance(); setPreviewDialog({ simulation: r, type: 'rebalance' }) }
    catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  const handleRunRebalance = async () => {
    try {
      setActionLoading(true); const r = await hybridControl.runRebalance()
      // 2026-04-24 follow-up — /rebalance/run now calls the pool-aware
      // apply which returns {status, move?, pool?, reason?, message?}
      // (singular `move`). The old moves[] array shape is kept as a
      // fallback for any legacy caller. Toast must REFLECT the actual
      // backend status, never default to "Already balanced" when the
      // response shape isn't recognized — that's the bug this patch
      // fixes.
      const legacyMoveCount = r.moves?.length
      if (r.status === 'moved' && r.move) {
        setSnack({
          message: r.message || `Moved 1 user from C${r.move.fromGroup} → C${r.move.toGroup} (${r.pool || 'pool'} pool)`,
          severity: 'success',
        })
        addAudit('rebalance', `C${r.move.fromGroup} → C${r.move.toGroup} (${r.pool || 'pool'})`)
      } else if (r.status === 'blocked') {
        setSnack({
          message: r.message || `Rebalance blocked — ${r.reason || 'unknown reason'}`,
          severity: 'warning',
        })
        addAudit('rebalance', `blocked: ${r.reason || 'unknown'}`)
      } else if (r.status === 'failed') {
        setSnack({
          message: r.message || `Rebalance failed — ${r.reason || 'unknown error'}`,
          severity: 'error',
        })
        addAudit('rebalance', `failed: ${r.reason || 'unknown'}`)
      } else if (r.status === 'balanced') {
        setSnack({
          message: r.message || 'All pools balanced — no move needed',
          severity: 'info',
        })
        addAudit('rebalance', 'no-op (balanced)')
      } else if (typeof legacyMoveCount === 'number') {
        // Legacy shape — if any other path still returns {moves:[...]}.
        setSnack({
          message: legacyMoveCount > 0
            ? `Rebalanced: ${legacyMoveCount} move(s), imbalance ${r.imbalanceBefore}\u2192${r.imbalanceAfter}`
            : 'Already balanced',
          severity: 'success',
        })
        addAudit('rebalance', `${legacyMoveCount} move(s)`)
      } else {
        // Unrecognized shape — don't lie. Surface the raw status.
        setSnack({
          message: `Rebalance returned unexpected status: ${r.status || 'unknown'}`,
          severity: 'warning',
        })
        console.warn('[HybridControl] runRebalance returned unrecognized shape:', r)
      }
      setPreviewDialog(null); loadData()
    } catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  const handleReconcile = async (dryRun) => {
    try {
      setActionLoading(true); const r = await hybridControl.reconcile(dryRun)
      if (dryRun) { setPreviewDialog({ simulation: r, type: 'reconcile' }) }
      else {
        setSnack({ message: `Reconciled: ${r.fixed} fixed, ${r.correct} already correct`, severity: 'success' })
        addAudit('reconcile', `${r.fixed} fixed`)
        setPreviewDialog(null); loadData()
      }
    } catch (err) { setSnack({ message: err.message, severity: 'error' }) }
    finally { setActionLoading(false) }
  }

  if (loading && !data) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box sx={{ p: 2, maxWidth: 1500, mx: 'auto' }}>
      {/* Header + refresh */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <PageHeader title="Hybrid Mode Control" subtitle="Container assignment management" />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {lastRefresh && (
            <Tooltip title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}. Auto-refreshes every 60s.`}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                <ClockIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>{timeAgo(lastRefresh)}</Typography>
              </Box>
            </Tooltip>
          )}
          <Tooltip title="Refresh now">
            <IconButton size="small" onClick={loadData} disabled={loading}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      {/* C6 (2026-04-24) — NOW / NEXT / RISK rail. HybridControl has
          the richest pool data of any admin page, so the rail here
          surfaces pool-imbalance in NOW, within-pool rebalance
          suggestions in NEXT, and pool-imbalance-based PPM efficiency
          risk in RISK (deterministic formulas per user spec). */}
      {(() => {
        const rlabels = formatRecoveryLabels(hybridRecovery)
        const workerVerdict = { tier: 'healthy', color: '#22C55E', label: 'Healthy', reason: 'All systems nominal' }
        const unified = mergeHealthVerdicts(workerVerdict, hybridRecovery)
        const blockers = []
        if ((summary.pinnedCount || 0) > 0) blockers.push(`${summary.pinnedCount} pinned`)
        if ((summary.manualOverrides || 0) > 0) blockers.push(`${summary.manualOverrides} manual`)
        return (
          <NowNextRiskRail
            inputs={{
              unifiedVerdict: unified,
              balanceStatus: balanceStatus,
              recoveryLabels: rlabels,
              counts: poolCounts,
              // Phase 5.18-B — prefer server-provided dynamic pools
              // (derived from packPoolMap on the backend). Falls back
              // to legacy hardcoded POOLS only when the server didn't
              // ship a balanceStatus (older response shape).
              pools: (balanceStatus?.pools || []).map(p => ({ name: p.name, groups: p.groups })) || POOLS,
              blockers,
              metrics: {
                currentLivePpm: 0, // HybridControl does not expose live PPM
                unhealthyWorkers: 0,
                totalWorkers: 0,
                errorRate: 0,
                errorThreshold: 0.03,
              },
            }}
          />
        )
      })()}

      {/* Phase 13 — staleness banner. Red = block, amber = soft warn.
          Refresh action is primary. */}
      {(() => {
        const staleness = classifyStaleness(generatedAt, now)
        if (staleness === STALENESS.FRESH) return null
        const stale = staleness === STALENESS.STALE
        return (
          <Alert
            severity={stale ? 'error' : 'warning'}
            sx={{ mb: 1.5 }}
            action={
              <Button size="small" color="inherit" onClick={loadData} startIcon={<RefreshIcon fontSize="small" />}>
                Refresh
              </Button>
            }
          >
            {stale
              ? 'Data is more than 2 minutes old. Refresh before making changes — live actions are blocked.'
              : 'Data is more than 45 seconds old. Refresh for the freshest state before making changes.'}
          </Alert>
        )
      })()}

      {/* Phase 13 — rebalancer-awareness strip (compact, one line). */}
      {data?.rebalancerInfo && (
        <Box sx={{
          mb: 1.5, px: 1.2, py: 0.6, borderRadius: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Auto-rebalancer
          </Typography>
          {/* C4 (2026-04-24) — env-controlled engine status. When the
              flag is OFF, the per-cycle auto-move in the hunt manager
              + the webui scheduler tick are both no-ops; only manual
              Suggest / Apply actions still run. */}
          {data?.microRebalanceEngine && (
            <Tooltip
              arrow
              title={data.microRebalanceEngine.enabled
                ? `Auto-rebalance engine is ON. Env flag ${data.microRebalanceEngine.envVar}=true (default). Flip to false to disable automatic moves.`
                : `Auto-rebalance engine is OFF. Env flag ${data.microRebalanceEngine.envVar}=false. Only manual Suggest / Apply actions move users.`}
            >
              <Chip
                size="small"
                variant="outlined"
                label={`Engine: ${data.microRebalanceEngine.enabled ? 'ON' : 'OFF'} (env)`}
                sx={{
                  height: 18, fontSize: '0.6rem', fontWeight: 700,
                  color: data.microRebalanceEngine.enabled ? '#22C55E' : '#EF4444',
                  borderColor: data.microRebalanceEngine.enabled ? '#22C55E' : '#EF4444',
                }}
              />
            </Tooltip>
          )}
          <Typography variant="caption" color="text.secondary">
            Last rebalance: {data.rebalancerInfo.lastRebalanceAt
              ? timeAgo(data.rebalancerInfo.lastRebalanceAt)
              : 'never'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Move cooldown: {data.rebalancerInfo.moveCooldownMinutes ?? 30}m
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.pinnedCount || 0} pinned · {summary.manualOverrides || 0} manual overrides (skipped by rebalancer)
          </Typography>
        </Box>
      )}

      {/* Summary bar */}
      <Paper sx={{ p: 1.5, mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <HealthBar value={healthPct} />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.3 }} />
        <StatChip label="Total" value={summary.totalUsers} />
        <StatChip label="Standard" value={summary.standardUsers} color="#22C55E" />
        <StatChip label="Legacy" value={summary.legacyUsers} color="#8B5CF6" />
        <StatChip label="Misassigned" value={summary.misassigned} color={summary.misassigned > 0 ? '#EF4444' : '#22C55E'} />
        <StatChip label="Pinned" value={summary.pinnedCount} color="#F59E0B" />
        {/* C3 follow-up (2026-04-24) — pool-aware balance. Each pool
            (standard / legacy) evaluates independently. Overall
            balanced iff every pool balanced. Tooltip shows per-pool
            status, and explicitly calls out which pool is imbalanced
            with its offenders. This prevents the prior bug where
            "Not Balanced" status + "Already balanced" Rebalance button
            disagreed. */}
        <Tooltip
          arrow
          title={(balanceStatus.pools || []).length === 0
            ? 'No pool data'
            : (balanceStatus.pools || []).map(p => {
                const name = p.name === 'standard' ? 'Latest pool' : 'Legacy pool'
                if (p.balanced) return `${name}: Balanced (target ${p.target})`
                const reasons = (p.reasons || []).map(formatBalanceReason).join(', ')
                return `${name}: Not Balanced — ${reasons}`
              }).join('\n')}
        >
          <span>
            <StatChip
              label="Balance"
              value={balanceStatus.balanced ? 'Balanced' : 'Not Balanced'}
              color={balanceStatus.balanced ? '#22C55E' : '#EF4444'}
            />
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.3 }} />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Tooltip title="Preview rebalance without applying changes">
            <Button size="small" variant="outlined" startIcon={<PreviewIcon sx={{ fontSize: 14 }} />} onClick={handleSimulateRebalance} disabled={actionLoading} sx={{ fontSize: '0.7rem', py: 0.3 }}>
              Simulate
            </Button>
          </Tooltip>
          <Tooltip title={
            classifyStaleness(generatedAt, now) === STALENESS.STALE
              ? 'Data is stale \u2014 refresh before rebalancing'
              : balanceStatus.balanced
                ? 'All pools balanced'
                : 'One or more pools imbalanced \u2014 click to rebalance within affected pool(s)'
          }>
            <span>
              <Button size="small" variant="contained" startIcon={<RebalanceIcon sx={{ fontSize: 14 }} />}
                onClick={handleRunRebalance}
                disabled={actionLoading || classifyStaleness(generatedAt, now) === STALENESS.STALE}
                color={balanceStatus.balanced ? 'primary' : 'warning'} sx={{ fontSize: '0.7rem', py: 0.3 }}>
                Rebalance
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Fix users assigned to the wrong container by policy">
            <Button size="small" variant="outlined" startIcon={<ReconcileIcon sx={{ fontSize: 14 }} />} onClick={() => handleReconcile(true)} disabled={actionLoading} sx={{ fontSize: '0.7rem', py: 0.3 }}>
              Reconcile
            </Button>
          </Tooltip>
        </Box>
      </Paper>

      {/* Phase 14 — policy-driven recommendation panel (superior to the
          client-side SuggestedMovePanel when server returns a recommendation).
          Phase 17 — adds ref + focused-highlight border when arrived via
          Fleet Health deep link with ?focus=recommendation|blocker. */}
      {data?.recommendation && data.recommendation.status !== 'none' && (
        <Paper
          ref={recommendationPanelRef}
          elevation={0}
          sx={{
            p: 1.5, mb: 1.5, borderRadius: 1.5,
            border: `1px solid ${
              data.recommendation.status === 'recommended' ? alpha('#F59E0B', 0.4)
              : data.recommendation.status === 'blocked' ? alpha('#EF4444', 0.4)
              : data.recommendation.status === 'applied' ? alpha('#22C55E', 0.4)
              : alpha(theme.palette.divider, 0.2)
            }`,
            bgcolor:
              data.recommendation.status === 'recommended' ? alpha('#F59E0B', 0.05)
              : data.recommendation.status === 'blocked' ? alpha('#EF4444', 0.05)
              : data.recommendation.status === 'applied' ? alpha('#22C55E', 0.05)
              : 'transparent',
            // Deep-link focus glow — fades after 5s via setFocusedPanel(null).
            boxShadow: focusedPanel ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.45)}` : 'none',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={data.recommendation.status.toUpperCase()}
              size="small"
              color={
                data.recommendation.status === 'recommended' ? 'warning'
                : data.recommendation.status === 'blocked' ? 'error'
                : data.recommendation.status === 'applied' ? 'success'
                : 'default'
              }
              sx={{ fontWeight: 700, fontSize: '0.65rem' }}
            />
            <Typography variant="subtitle2" sx={{ fontSize: '0.85rem' }}>
              {data.recommendation.reason}
            </Typography>
            <Box sx={{ flex: 1 }} />

            {/* Policy mode toggle lives inside this panel — operator sees
                mode + recommendation in one context. */}
            {data?.rebalancePolicy && (
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                  value={data.rebalancePolicy.mode}
                  onChange={async (e) => {
                    try {
                      await hybridControl.setRebalancePolicy(e.target.value)
                      setSnack({ message: `Policy: ${e.target.value}`, severity: 'success' })
                      addAudit('policy', `mode → ${e.target.value}`)
                      loadData()
                    } catch (err) {
                      setSnack({ message: err.message, severity: 'error' })
                    }
                  }}
                  sx={{ fontSize: '0.75rem', height: 30 }}
                >
                  {/* C4 (2026-04-24) — 'auto-apply' is removed from the
                      selectable modes. Only 'off' and 'recommend-only'
                      are operator-selectable. The backend still knows
                      'auto-apply' exists (backward-compat) but filters
                      it out of `rebalancePolicy.modes`. Fallback list
                      here also excludes it so the UI can never offer
                      that mode even during a partial rollout. */}
                  {(data.rebalancePolicy.modes || ['off','recommend-only'])
                    .filter(m => m !== 'auto-apply')
                    .map(m =>
                    <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{m}</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* Projected counts grid + explicit imbalance delta */}
          {['recommended', 'weak'].includes(data.recommendation.status) && data.recommendation.suggestedMove && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                imbalance {data.recommendation.currentImbalance} → {data.recommendation.projectedImbalance}
              </Typography>
              {data.recommendation.pinnedExcluded > 0 && (
                <Chip size="small" variant="outlined" label={`${data.recommendation.pinnedExcluded} pinned excluded`}
                      sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
              {data.recommendation.manualExcluded > 0 && (
                <Chip size="small" variant="outlined" label={`${data.recommendation.manualExcluded} manual excluded`}
                      sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
              <Box sx={{ flex: 1 }} />
              {data.recommendation.status === 'recommended' && data.rebalancePolicy?.mode !== 'off' && (
                <Button
                  size="small" variant="contained" color="warning"
                  startIcon={<RebalanceIcon sx={{ fontSize: 14 }} />}
                  disabled={actionLoading || classifyStaleness(generatedAt, now) === STALENESS.STALE}
                  onClick={handleRunRebalance}
                >
                  Apply recommendation
                </Button>
              )}
            </Box>
          )}

          {/* Blocker explanation */}
          {data.recommendation.status === 'blocked' && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Blockers: {(data.recommendation.blockers || []).join(', ') || 'no movable candidates'}
              </Typography>
            </Box>
          )}

          {/* Phase 17 — unified "what just happened" summary. Pulls from the
              same payload (no extra fetch) and stays bounded to 3 lines. */}
          <LastActionStrip
            lines={summarizeHybridControl({ hybridControl: data, now })}
            title="What just happened"
          />

          {/* Recent auto-apply attempts — last 3 */}
          {data?.rebalancePolicy?.recentAttempts?.length > 0 && (
            <Box sx={{ mt: 1, pt: 0.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Recent auto-apply attempts
              </Typography>
              {data.rebalancePolicy.recentAttempts.slice(0, 3).map((a, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip
                    size="small"
                    label={a.outcome}
                    color={a.outcome === 'ok' ? 'success' : a.outcome === 'skipped' ? 'warning' : a.outcome === 'no-op' ? 'default' : 'error'}
                    sx={{ height: 16, fontSize: '0.6rem', fontWeight: 600 }}
                  />
                  <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                    {a.reason || a.kind}
                    {a.move && ` · ${a.move.username} C${a.move.fromGroup}→C${a.move.toGroup}`}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                    {timeAgo(a.ts)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* Legacy client-side suggested move — kept for fallback when server
          recommendation is 'none' but fleet is imbalanced (should be rare). */}
      {(!data?.recommendation || data.recommendation.status === 'none') && (
        <SuggestedMovePanel suggestion={suggestion} onPreview={handleSuggestedPreview} onApply={handleSuggestedApply} loading={actionLoading} />
      )}

      {/* Container board */}
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
        {[1, 2, 3, 4].map(g => (
          <ContainerColumn key={g} groupId={g} users={grouped[g] || []} loads={rebalance}
            avgLoad={targetByGroup[g] ?? 0} onPin={handlePin} onClearManual={handleClearManual}
            onDrop={handleDrop} dragState={dragState} pendingKey={pendingKey}
            moveCooldownMinutes={data?.rebalancerInfo?.moveCooldownMinutes} />
        ))}
      </Box>

      {/* Unassigned */}
      {(grouped[0]?.length > 0) ? (
        <Paper sx={{ p: 1.2, mt: 1, border: `1px solid ${alpha('#EF4444', 0.25)}`, bgcolor: alpha('#EF4444', 0.02) }}>
          <Typography variant="subtitle2" sx={{ color: '#EF4444', fontSize: '0.8rem' }} gutterBottom>
            Unassigned ({grouped[0].length})
          </Typography>
          <Typography variant="caption" sx={{ color: alpha('#EF4444', 0.7), display: 'block', mb: 0.5 }}>
            These users need container assignment. Run Reconcile to fix automatically.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {grouped[0].map(u => <Chip key={u.discordId} label={u.username} size="small" color="error" variant="outlined" />)}
          </Box>
        </Paper>
      ) : null}

      {/* Phase 13 — audit trail merges the session log with server-side
          hunt_assignment_audit so refreshes don't lose context AND cross-admin
          actions are visible. */}
      <AuditTrail actions={(() => {
        const serverRows = (data?.recentAudit || []).map(r => ({
          type: (r.action_type || '').replace('_', ' '),
          message: r.username
            ? `${r.username}${r.from_group != null && r.to_group != null ? ` C${r.from_group}→C${r.to_group}` : ''}${r.actor_id ? ` · by ${r.actor_id}` : ''}`
            : (r.reason || r.actor_id || ''),
          severity: r.action_type === 'clear_manual' || r.action_type === 'unpin' ? 'info' : 'success',
          time: r.created_at,
          source: 'server',
        }))
        const clientRows = auditLog.map(a => ({ ...a, source: 'session' }))
        return [...clientRows, ...serverRows]
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 10)
      })()} />

      {/* Preview dialog */}
      <Dialog open={!!previewDialog} onClose={() => setPreviewDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem' }}>
          {previewDialog?.type === 'rebalance' ? 'Rebalance Preview' : previewDialog?.type === 'reconcile' ? 'Reconciliation Preview' : 'Move Preview'}
        </DialogTitle>
        <DialogContent>
          {previewDialog?.participant && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Chip label={previewDialog.participant.discord_username} sx={{ fontWeight: 600 }} />
                <Chip label={`C${previewDialog.participant.container_group}`} size="small" sx={{ bgcolor: alpha(GROUP_COLORS[previewDialog.participant.container_group], 0.15), color: GROUP_COLORS[previewDialog.participant.container_group] }} />
                <ArrowIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Chip label={`C${previewDialog.toGroup}`} size="small" sx={{ bgcolor: alpha(GROUP_COLORS[previewDialog.toGroup], 0.15), color: GROUP_COLORS[previewDialog.toGroup] }} />
              </Box>

              {/* Phase 13 — full 4-container projection + explicit imbalance delta */}
              {(() => {
                const from = previewDialog.participant.container_group
                const to = previewDialog.toGroup
                const before = currentImbalance(data?.users || [])
                const after = projectedLoadAfterMove(data?.users || [], from, to)
                const delta = after.imbalance - before.imbalance
                const worsens = delta > 0
                return (
                  <>
                    <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Before</Typography>
                        <Typography variant="body2" fontFamily="monospace">
                          {[1,2,3,4].map(g => `C${g}=${before.counts[g]}`).join('  ')}  ·  Δ={before.imbalance}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">After</Typography>
                        <Typography variant="body2" fontFamily="monospace">
                          {[1,2,3,4].map(g => `C${g}=${after.counts[g]}`).join('  ')}  ·  Δ={after.imbalance}
                        </Typography>
                      </Box>
                    </Box>
                    <Alert severity={worsens ? 'error' : delta < 0 ? 'success' : 'info'} sx={{ mt: 0.5, py: 0 }}>
                      {worsens
                        ? `This move worsens imbalance (${before.imbalance} → ${after.imbalance}). Prefer a different move.`
                        : delta < 0
                          ? `Imbalance improves: ${before.imbalance} → ${after.imbalance}`
                          : `Imbalance unchanged (${before.imbalance}).`}
                    </Alert>
                  </>
                )
              })()}

              {previewDialog.simulation?.warnings?.map((w, i) => <Alert key={i} severity="warning" sx={{ mt: 0.5, py: 0 }}>{w}</Alert>)}
            </Box>
          )}
          {previewDialog?.simulation && !previewDialog?.participant && (
            <Box>
              {previewDialog.type === 'rebalance' && previewDialog.simulation.moves && (
                <>
                  <Typography variant="body2" gutterBottom>{previewDialog.simulation.status === 'balanced' ? 'All containers are balanced. No moves needed.' : `${previewDialog.simulation.moves.length} move(s) planned:`}</Typography>
                  {previewDialog.simulation.moves.map((m, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label={m.username} size="small" sx={{ fontWeight: 600 }} />
                      <Chip label={`C${m.fromGroup}`} size="small" sx={{ bgcolor: alpha(GROUP_COLORS[m.fromGroup], 0.15) }} />
                      <ArrowIcon sx={{ fontSize: 14 }} />
                      <Chip label={`C${m.toGroup}`} size="small" sx={{ bgcolor: alpha(GROUP_COLORS[m.toGroup], 0.15) }} />
                    </Box>
                  ))}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Imbalance: {previewDialog.simulation.imbalanceBefore} \u2192 {previewDialog.simulation.imbalanceAfter}</Typography>
                </>
              )}
              {previewDialog.type === 'reconcile' && (
                <>
                  <Typography variant="body2" gutterBottom>
                    {previewDialog.simulation.total} users scanned: {previewDialog.simulation.correct} correct, {previewDialog.simulation.fixed || previewDialog.simulation.skipped || 0} to fix
                  </Typography>
                  {(previewDialog.simulation.details || []).length === 0 && (
                    <Typography variant="body2" sx={{ color: '#22C55E' }}>All users are correctly assigned. No changes needed.</Typography>
                  )}
                  {previewDialog.simulation.details?.map((d, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label={d.discordId?.substring(0, 12)} size="small" />
                      <Typography variant="caption" sx={{ flex: 1 }}>{d.reason}</Typography>
                      <Chip label={d.action} size="small" color={d.action === 'error' ? 'error' : 'default'} />
                    </Box>
                  ))}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(null)}>Cancel</Button>
          {previewDialog?.type === 'rebalance' && previewDialog.simulation?.moves?.length > 0 && (
            <Button variant="contained" color="warning" onClick={handleRunRebalance} disabled={actionLoading}>Execute {previewDialog.simulation.moves.length} Move(s)</Button>
          )}
          {previewDialog?.type === 'reconcile' && (previewDialog.simulation?.details?.length > 0 || previewDialog.simulation?.skipped > 0) && (
            <Button variant="contained" color="secondary" onClick={() => handleReconcile(false)} disabled={actionLoading}>Execute Reconcile</Button>
          )}
          {previewDialog?.participant && previewDialog.simulation?.allowed && (() => {
            const from = previewDialog.participant.container_group
            const to = previewDialog.toGroup
            const safety = evaluateActionSafety({
              action: 'move', generatedAt, now,
              context: { users: data?.users || [], fromGroup: from, toGroup: to },
            })
            const after = projectedLoadAfterMove(data?.users || [], from, to)
            const beforeImb = currentImbalance(data?.users || []).imbalance
            const worsens = moveWorsensImbalance(data?.users || [], from, to)
            const buttonLabel =
              worsens ? `Move anyway · imbalance ${beforeImb}→${after.imbalance}` :
              after.imbalance !== beforeImb ? `Move to C${to} · imbalance ${beforeImb}→${after.imbalance}` :
              `Move to C${to}`
            return (
              <Button
                variant="contained"
                color={worsens ? 'error' : 'primary'}
                onClick={handleConfirmMove}
                disabled={actionLoading || !safety.allowed}
              >
                {!safety.allowed ? 'Refresh to proceed' : buttonLabel}
              </Button>
            )
          })()}
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack && <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ minWidth: 300 }}>{snack.message}</Alert>}
      </Snackbar>
    </Box>
  )
}
