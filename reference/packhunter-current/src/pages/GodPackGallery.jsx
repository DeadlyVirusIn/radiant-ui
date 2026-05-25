import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Typography,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
  Tooltip as MuiTooltip,
} from '@mui/material'
import {
  Star as StarIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  CatchingPokemon as PokeballIcon,
  BarChart as ChartIcon,
  Collections as GalleryIcon,
  TrendingUp as TrendingIcon,
  PieChart as PieIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cards as cardsApi, hunt, godpacksFeed } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import { RARITY_COLORS } from '../constants/gameData'
import { formatDateTime } from '../utils/dateFormat'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem, CountUp } from '../components/Animations'
import StatCardV2 from '../components/StatCardV2'
import { CardGridSkeleton } from '../components/LoadingSkeleton'
import PageHeader from '../components/PageHeader'
// Phase 3 (Apr 2026) — shared status/source chips + freshness pill +
// godpack:updated socket listener.
import StatusChip from '../components/StatusChip'
import FreshnessIndicator from '../components/FreshnessIndicator'
import { onGodpackUpdated, offGodpackUpdated } from '../services/socket'
// Phase 4.6 — brand tokens (gold accent for godpack surfaces).
import { designTokens } from '../theme/designTokens'
// Phase 4.8 — unified snackbar styling/duration/anchor.
import { getSnackbarProps, getAlertSx } from '../utils/snackbarConfig'
// Phase 5.0 — shared source-attribution labels (single source of truth
// across WebUI + Discord). See utils/sourceLabels.js — thin ESM proxy
// that re-exports the canonical CommonJS module at repo-root/lib/.
import { SOURCE_LABELS, classifySource } from '../utils/sourceLabels'

const GOLD       = designTokens.brand.gold
const GOLD_DEEP  = designTokens.brand.goldDeep
const goldGlow   = designTokens.brand.goldGlow
const GOLD_GRAD  = designTokens.brand.goldGradient
// Phase 4.5 (Apr 2026) — modal redesign needs Snackbar for copy feedback +
// FavoriteBorder/Favorite icons + ContentCopy icon.
import Snackbar from '@mui/material/Snackbar'
import MuiAlert from '@mui/material/Alert'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GroupIcon from '@mui/icons-material/Group'
import StorageIcon from '@mui/icons-material/Storage'

// Phase 4.5 — container colour map (C1 blue / C2 green / C3 orange / C4 purple)
const CONTAINER_COLOR_MAP = {
  C1: '#2196f3', C2: '#4caf50', C3: '#ff9800', C4: '#9c27b0',
}
function containerColor(container) {
  return CONTAINER_COLOR_MAP[container] || '#7c8aff'
}

// Phase 4.5 — relative-time formatter for "X min ago"
function formatRelative(dateStr) {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return null
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diff < 60)        return 'just now'
  if (diff < 3600)      return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)} h ago`
  return `${Math.floor(diff / 86400)} d ago`
}

// Phase 4.5 — rarity glow color for card hover
// Phase 4.6 — gold uses brand.goldGlow() helper; non-gold rarities stay
// hardcoded since they map to MUI palette.secondary/error tones that
// already differ between light/dark.
function rarityGlowColor(rarity) {
  if (!rarity) return goldGlow(0.4)
  const r = String(rarity).toUpperCase()
  if (r === 'SR' || r === 'SAR') return goldGlow(0.55)              // gold
  if (r === 'AR' || r === 'IM')  return 'rgba(168, 85, 247, 0.55)'  // purple
  if (r === 'UR' || r === 'CHR') return 'rgba(244, 114, 182, 0.55)' // pink
  return 'rgba(124, 138, 255, 0.35)'                                // subtle blue
}

// Chart colors - primary/secondary resolved at render time via getChartColors(theme)
const getChartColors = (theme) => [
  theme.palette.primary.main,
  theme.palette.secondary.light,
  '#34D399', // Success
  '#F59E0B', // Warning
  GOLD, // Gold
  '#ff6b6b', // Red
  '#4ecdc4', // Teal
  '#45b7d1', // Blue
  '#96ceb4', // Green
  '#ff9f43', // Orange
]

// Format short date for chart
const formatShortDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// God Pack Card Component
const GodPackCard = ({ godpack, onClick }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Box
        // Phase 4.8 — interactive-card class wires global hover/press
        // contract from theme/globalStyles.js. Local sx still controls
        // gold-tinted shadow on hover (brand-specific).
        className="interactive-card"
        sx={{
          cursor: 'pointer',
          borderRadius: '14px',
          border: `2px solid ${GOLD}`,
          bgcolor: isDark ? goldGlow(0.03) : goldGlow(0.04),
          p: 2,
          // Phase 4.5 — combined hover: stronger glow + subtle elevation +
          // gold border accent. transition covers both shadow + border.
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease',
          '&:hover': {
            boxShadow: `0 12px 36px ${goldGlow(0.45)}, 0 0 0 1px ${goldGlow(0.5)}`,
            borderColor: '#ffe066',
          },
        }}
        onClick={() => onClick(godpack)}
      >
        {/* Phase 3 (Apr 2026) — chip rail: GOD PACK + status + source +
            container. All chips wrap on narrow screens (no fixed widths). */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
            <Chip
              icon={<StarIcon sx={{ color: `${GOLD} !important` }} />}
              label="GOD PACK"
              size="small"
              sx={{
                background: GOLD_GRAD,
                color: 'black',
                fontWeight: 700,
                height: 22,
              }}
            />
            {godpack.status && godpack.status !== 'PENDING' && (
              <StatusChip status={godpack.status} size="small" />
            )}
            {godpack.source && godpack.source !== 'unknown' && (
              <StatusChip status={godpack.source} size="small" />
            )}
            {(() => {
              // Phase 4.5 — color-coded container chip (always visible).
              // Phase 4.8 — wrapped in Tooltip explaining what the
              // container code means (region/worker group).
              const c = godpack.owner?.container || (godpack.containerGroup ? `C${godpack.containerGroup}` : null)
              if (!c) return null
              const col = containerColor(c)
              return (
                <MuiTooltip title={`Container ${c} — region / worker group that owns this account`} arrow>
                <Chip
                  label={c}
                  size="small"
                  sx={{
                    fontSize: '0.6rem',
                    height: 18,
                    fontWeight: 700,
                    bgcolor: col,
                    color: '#fff',
                    border: `1px solid ${col}`,
                  }}
                />
                </MuiTooltip>
              )
            })()}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            #{godpack.id}
          </Typography>
        </Box>

        {/* Card preview - show first 5 cards in mini fan */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, height: 160, position: 'relative' }}>
          {(godpack.cards || []).slice(0, 5).map((card, i) => (
            <Box
              key={i}
              sx={{
                width: 90,
                height: 126,
                position: 'absolute',
                transform: `rotate(${(i - 2) * 7}deg) translateX(${(i - 2) * 38}px)`,
                transformOrigin: 'bottom center',
                borderRadius: 1,
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                transition: 'box-shadow 0.2s ease',
                '&:hover': {
                  boxShadow: `0 4px 16px ${goldGlow(0.5)}`,
                },
              }}
            >
              {/* Phase 4.6 hotfix — Phase 3's /api/godpacks/feed returns
                  camelCase fields (backendId / cardId). Old snake_case
                  lookup resolved to undefined → /cards/undefined/image
                  → 404 → onError fired for every card → entire fan
                  rendered as gold-gradient placeholders. Defensive
                  chain matches the modal at line 547+.
                  Phase 4.8 — `image-fade-in` className adds a 120ms
                  opacity transition on first paint via globalStyles
                  keyframe; respects prefers-reduced-motion. */}
              <Box
                component="img"
                className="image-fade-in"
                src={cardsApi.getImageUrl(card.backendId || card.cardId || card.backend_id || card.id)}
                alt={card.name || 'Card'}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'scale(1.03)' },
                }}
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.parentElement.style.background = `linear-gradient(145deg, ${GOLD}40, ${GOLD_DEEP}20)`
                }}
              />
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 1.5, borderColor: 'divider' }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonIcon sx={{ fontSize: 14 }} />
              {/* Phase 3 — friend.playerName from /api/godpacks/feed normalized
                  shape; falls back to legacy playerName field. Never shows
                  literal "Unknown" — uses humanized "Hunt Pool" when shared. */}
              {godpack.friend?.playerName || godpack.playerName || 'Hunt Pool friend'}
            </Typography>
          </Box>
          <Chip
            label={godpack.packType || godpack.setCode || 'Pack'}
            size="small"
            sx={{ fontSize: '0.65rem' }}
          />
        </Box>

        {/* Phase 3 — attribution row: "Added by {username}" when known,
            "Source: Shared Hunt Pool" when null+source=hunt, otherwise
            "Source: Unknown". Renders ONLY when feed shape provides
            attribution (legacy /hunt/godpacks rows skip this row). */}
        {godpack.attribution && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {godpack.attribution.addedByUsername ? (
              <>Added by: <strong>{godpack.attribution.addedByUsername}</strong></>
            ) : (
              // Phase 5.0 — classified label from shared SOURCE_LABELS
              // module (matches Discord embed phrasing exactly).
              <>Source: <strong>{classifySource(godpack.source)}</strong></>
            )}
          </Typography>
        )}

        {/* Phase 3 — friend code copy block (only when present in feed) */}
        {godpack.friend?.friendCode && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 'fit-content' }}>
              Code:
            </Typography>
            <Box
              component="code"
              sx={{
                px: 0.75, py: 0.25, borderRadius: 0.5,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                fontSize: '0.7rem', fontFamily: 'monospace',
              }}
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard?.writeText(godpack.friend.friendCode).catch(() => {})
              }}
              title="Click to copy friend code"
            >
              {godpack.friend.friendCode}
            </Box>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <CalendarIcon sx={{ fontSize: 12 }} />
          {formatDateTime(godpack.discoveredAt || godpack.createdAt)}
        </Typography>
      </Box>
    </motion.div>
  )
}

// God Pack Detail Dialog
const GodPackDetailDialog = ({ godpack, open, onClose }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  // Phase 4.7 — anchor copy-feedback Snackbar at top on mobile so it
  // doesn't overlap the fixed MobileBottomNav (--mobile-nav-offset).
  // Desktop keeps the existing bottom-center placement.
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('sm'))

  // Phase 4.5 (Apr 2026) — copy feedback + favorite toggle (UI-only).
  const [snack, setSnack] = useState(null)   // {message, severity}
  const [favorited, setFavorited] = useState(false)

  if (!godpack) return null

  const container = godpack.owner?.container || (godpack.containerGroup ? `C${godpack.containerGroup}` : null)
  const friendCode = godpack.friend?.friendCode || null
  const playerName = godpack.friend?.playerName || godpack.playerName || null
  // Phase 5.6.1 (Apr 2026) — Members display fix.
  //
  // The /api/godpacks/feed resolver always returns `members: []` because
  // the schema doesn't store per-pack member metadata. The UI used to
  // render "No members recorded" which read like a system bug — users
  // mistrusted Smart Clear etc. when they saw it.
  //
  // Resolution: prefer the member-name list when populated; fall back
  // to the thread-claim count from metrics.currentClaims (the number
  // of users who reacted ALIVE on the Discord thread); when neither
  // is available, swap the headline + subtext for the source-aware
  // explainer described in the Phase 5.6.1 spec.
  //
  // Pure presentation. No backend / API / schema change.
  // Phase 5.12 — Member Context ladder.
  //
  // The /api/godpacks/feed response now ships an additive
  // `memberContext` field with type ∈ {captured, inferred_container,
  // unavailable}, sourced from discord_hunt_participants (same table
  // the Discord "📋 Hunt Participants" message reads). Backwards
  // compatible: when memberContext is absent (older clients / cached
  // responses) we fall through to the pre-Phase-5.12 derivation from
  // godpack.members + metrics.currentClaims so the page never crashes.
  const members = Array.isArray(godpack.members) ? godpack.members : []
  const memberClaimCount = Number(godpack.metrics?.currentClaims) || 0
  const hasMemberNames = members.length > 0
  const hasMemberCount = !hasMemberNames && memberClaimCount > 0
  const memberSummary = hasMemberNames
    ? members.slice(0, 3).map(m => m.name || m.username || m).join(', ') +
      (members.length > 3 ? ` +${members.length - 3}` : '')
    : null
  const allMembersTooltip = hasMemberNames
    ? members.map(m => m.name || m.username || m).join(', ')
    : ''
  const memberContext = (godpack && typeof godpack.memberContext === 'object' && godpack.memberContext !== null)
    ? godpack.memberContext
    : null
  // Defensive — names list may be missing on truncated responses.
  const memberContextNames = Array.isArray(memberContext?.names) ? memberContext.names : []
  const memberContextDisplay = memberContextNames.slice(0, 8)
  const memberContextOverflow = Math.max(0, (memberContext?.totalCount || memberContextNames.length) - memberContextDisplay.length)

  // Phase 5.0 — classified source label sourced from the shared
  // sourceLabels module so the modal phrasing matches Discord embeds
  // verbatim. Personal "Added by X" attribution still wins.
  const attribution = godpack.attribution
  const sourceLine = attribution?.addedByUsername
    ? `Added by ${attribution.addedByUsername}`
    : classifySource(godpack.source)

  // Phase 4.5 — copy helpers
  const copyText = (text, label) => {
    if (!text) return
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setSnack({ message: `Copied ${label}`, severity: 'success' }),
        () => setSnack({ message: 'Copy failed', severity: 'error' })
      )
    } else {
      setSnack({ message: 'Clipboard unavailable', severity: 'warning' })
    }
  }
  const copyAllCards = () => {
    const list = (godpack.cards || []).map(c => `${c.name || c.cardId || ''} (${c.rarity || '?'})`).join('\n')
    copyText(list, `${(godpack.cards || []).length} cards`)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      // Phase 4.5 — modal open animation: fade+scale (Material default
      // Grow/Fade combo via TransitionProps).
      // Phase 4.8 — split enter/exit so close feels snappier (140ms)
      // while open stays at 180ms (premium ease-curve sourced from
      // theme.custom.motion.modalIn / modalOut).
      TransitionProps={{ timeout: { enter: 180, exit: 140 } }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: isDark
            ? `linear-gradient(180deg, ${goldGlow(0.04)} 0%, rgba(0, 0, 0, 0) 240px), #1c1c20`
            : `linear-gradient(180deg, ${goldGlow(0.06)} 0%, rgba(255, 255, 255, 0) 240px), #fff`,
          boxShadow: `0 20px 50px rgba(0, 0, 0, 0.45), 0 0 60px ${goldGlow(0.05)}`,
        },
      }}
      // Phase 4.8 — soft backdrop blur so the modal feels weighted
      // against the gallery beneath. 4px keeps the page legible (no
      // crashing context switch) while clearly demoting it.
      BackdropProps={{
        sx: {
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      {/* Phase 4.5 — Sticky header with chip rail. Subtle gold→dark gradient. */}
      <DialogTitle
        sx={{
          background: GOLD_GRAD,
          color: 'black',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          py: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <StarIcon sx={{ color: 'rgba(0,0,0,0.85)' }} />
            <Typography variant="h6" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
              God Pack #{godpack.id}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {godpack.status && godpack.status !== 'PENDING' && (
              <StatusChip status={godpack.status} size="small" />
            )}
            {godpack.source && godpack.source !== 'unknown' && (
              <StatusChip status={godpack.source} size="small" />
            )}
            {container && (
              <Tooltip title={`Container ${container}`} arrow>
                <Chip
                  label={container}
                  size="small"
                  icon={<StorageIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    bgcolor: containerColor(container),
                    color: '#fff',
                    fontWeight: 700,
                    height: 22,
                    '& .MuiChip-icon': { color: '#fff' },
                  }}
                />
              </Tooltip>
            )}
            <IconButton onClick={onClose} sx={{ color: 'black' }} aria-label="Close" size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Phase 4.5 — Meta row */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">👤 Player</Typography>
              <Typography variant="body1" fontWeight={700}>
                {playerName || 'Hunt Pool friend'}
              </Typography>
              {friendCode && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">Friend code:</Typography>
                  <Box
                    component="code"
                    onClick={() => copyText(friendCode, 'friend code')}
                    sx={{
                      px: 0.75, py: 0.25, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.75rem',
                      cursor: 'pointer',
                      bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                    }}
                    title="Click to copy"
                  >
                    {friendCode}
                  </Box>
                </Box>
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">📦 Pack</Typography>
              <Typography variant="body1" fontWeight={700}>
                {godpack.packLabel || godpack.packType || 'Pack'}
                {(godpack.setCode || godpack.setName) && (
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 0.5 }}>
                    ({godpack.setCode || godpack.setName})
                  </Box>
                )}
              </Typography>
              {!godpack.setCode && !godpack.setName && godpack._meta?.diagnostics?.unknownReason && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {godpack._meta.diagnostics.unknownReason === 'no-cards' && 'No cards recorded'}
                  {godpack._meta.diagnostics.unknownReason === 'cards-missing-set-code' && 'Cards not indexed yet'}
                  {godpack._meta.diagnostics.unknownReason === 'ambiguous-set' && 'Cards span multiple sets'}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">🕒 Found</Typography>
              <Typography variant="body1" fontWeight={700}>
                {formatDateTime(godpack.discoveredAt || godpack.createdAt)}
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 1 }}>
                  · {formatRelative(godpack.discoveredAt || godpack.createdAt) || ''}
                </Box>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">⚡ Source</Typography>
              <Typography variant="body1" fontWeight={700}>
                {sourceLine}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">🖥 Container</Typography>
              <Box sx={{ mt: 0.25 }}>
                {container ? (
                  <Chip
                    label={container}
                    size="small"
                    icon={<StorageIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      bgcolor: containerColor(container),
                      color: '#fff',
                      fontWeight: 700,
                      '& .MuiChip-icon': { color: '#fff' },
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">Unknown</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">👥 Members</Typography>
              {/* Phase 5.12 — Member Context ladder.
                  Priority:
                    1. godpack.members[] (legacy direct members) →
                       compact summary chip with tooltip.
                    2. metrics.currentClaims (Discord "ALIVE" reactions
                       count without names) → "N members in pack".
                    3. memberContext.type === 'captured' →
                       "Captured members" + chips.
                    4. memberContext.type === 'inferred_container' →
                       "Likely hunt members" + container/pool tag +
                       chips (first 8) + "+N more" + note.
                    5. memberContext.type === 'unavailable' or absent →
                       "Member details unavailable" + truthful note. */}
              {memberSummary ? (
                <Tooltip title={allMembersTooltip} arrow>
                  <Typography variant="body1" fontWeight={700} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <GroupIcon sx={{ fontSize: 16 }} /> {memberSummary}
                  </Typography>
                </Tooltip>
              ) : hasMemberCount ? (
                <Typography variant="body1" fontWeight={700} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <GroupIcon sx={{ fontSize: 16 }} /> {memberClaimCount} member{memberClaimCount !== 1 ? 's' : ''} in pack
                </Typography>
              ) : memberContext && memberContext.type !== 'unavailable' && memberContextNames.length > 0 ? (
                <Box sx={{ mt: 0.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                    <GroupIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2" fontWeight={700}>
                      {memberContext.label}
                    </Typography>
                    {memberContext.container && (
                      <Chip
                        size="small"
                        label={memberContext.pool
                          ? `${memberContext.container} · ${memberContext.pool} pool`
                          : memberContext.container}
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    {memberContextDisplay.map((name, i) => (
                      <Chip
                        key={i}
                        size="small"
                        label={name}
                        sx={{ height: 22, fontSize: '0.65rem', fontWeight: 600 }}
                      />
                    ))}
                    {memberContextOverflow > 0 && (
                      <Chip
                        size="small"
                        label={`+${memberContextOverflow} more`}
                        sx={{ height: 22, fontSize: '0.65rem', fontStyle: 'italic' }}
                      />
                    )}
                  </Box>
                  {memberContext.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', lineHeight: 1.4 }}>
                      {memberContext.note}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {memberContext?.label || 'Member details unavailable'}
                  </Typography>
                  {memberContext?.container && (
                    <Chip
                      size="small"
                      label={memberContext.pool
                        ? `${memberContext.container} · ${memberContext.pool} pool`
                        : memberContext.container}
                      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, mt: 0.5 }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', lineHeight: 1.4, mt: 0.25 }}>
                    {memberContext?.note
                      || 'This pack was found in the shared hunt pool, but participant details were not captured for this discovery.'}
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Phase 4.5 — Cards section: visual focus, rarity glow on hover */}
        <Typography variant="h6" fontWeight={700} gutterBottom>
          🎴 Cards Pulled
        </Typography>
        <Box sx={{
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          // Mobile: horizontal scroll instead of wrap when narrow
          '@media (max-width: 600px)': {
            flexWrap: 'nowrap',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            pb: 1,
          },
        }}>
          {(godpack.cards || []).map((card, i) => {
            const glow = rarityGlowColor(card.rarity)
            const cardKey = card.backend_id || card.backendId || card.id || card.cardId || i
            return (
              <Box
                key={i}
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 140, sm: 160, md: 170 },
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: `0 6px 24px ${glow}`,
                  },
                }}
              >
                <Box sx={{ height: 220, overflow: 'hidden', bgcolor: 'background.default' }}>
                  <Box
                    component="img"
                    // Phase 4.5 — image render fallback fix: try card.imageUrl
                    // (future feed shape), then cardsApi.getImageUrl(backendId).
                    // onError swaps in placeholder instead of hiding so card
                    // metadata stays visible even when image fetch fails.
                    src={card.imageUrl || cardsApi.getImageUrl(cardKey)}
                    alt={card.name || `Card ${i + 1}`}
                    loading="lazy"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transition: 'transform 0.2s ease',
                    }}
                    onError={(e) => {
                      // Swap to placeholder; don't hide entirely.
                      if (!e.target.dataset.fallbackTried) {
                        e.target.dataset.fallbackTried = '1'
                        e.target.src = '/placeholder-card.png'
                      } else {
                        e.target.style.display = 'none'
                      }
                    }}
                  />
                </Box>
                <Box sx={{ py: 1, px: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                  <Typography variant="caption" fontWeight={600} noWrap title={card.name}>
                    {card.name || `Card ${i + 1}`}
                  </Typography>
                  {card.rarity && (
                    <Chip
                      label={card.rarity}
                      size="small"
                      sx={{
                        fontSize: '0.6rem',
                        height: 18,
                        fontWeight: 700,
                        bgcolor: glow,
                        color: theme.palette.getContrastText(glow.replace('rgba', 'rgb').replace(/,\s*[\d.]+\)/, ')')),
                      }}
                    />
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>

        {(!godpack.cards || godpack.cards.length === 0) && (
          <EmptyState
            title="No Card Data"
            description="Card data not available for this god pack"
            minHeight={150}
          />
        )}
      </DialogContent>

      {/* Phase 4.5 — Footer actions */}
      <Box sx={{ display: 'flex', gap: 1, px: 3, pb: 2, flexWrap: 'wrap' }}>
        {friendCode && (
          <Tooltip title={`Copy friend code: ${friendCode}`} arrow>
            <Box
              component="button"
              onClick={() => copyText(friendCode, 'friend code')}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                border: 1, borderColor: 'divider', borderRadius: 1,
                bgcolor: 'background.default', px: 1.5, py: 0.75,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 16 }} /> Copy Friend Code
            </Box>
          </Tooltip>
        )}
        <Tooltip title={favorited ? 'Remove from favorites (UI-only state)' : 'Mark favorite (UI-only state)'} arrow>
          <Box
            component="button"
            onClick={() => { setFavorited(f => !f); setSnack({ message: favorited ? 'Removed favorite' : 'Marked favorite', severity: 'info' }) }}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              border: 1, borderColor: favorited ? 'warning.main' : 'divider',
              borderRadius: 1,
              bgcolor: favorited ? 'warning.lighter' : 'background.default',
              px: 1.5, py: 0.75, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
              color: favorited ? 'warning.main' : 'text.primary',
              '&:hover': { bgcolor: favorited ? 'warning.lighter' : 'action.hover' },
            }}
          >
            {favorited
              ? <FavoriteIcon sx={{ fontSize: 16 }} />
              : <FavoriteBorderIcon sx={{ fontSize: 16 }} />}
            {favorited ? 'Favorited' : 'Favorite'}
          </Box>
        </Tooltip>
        {(godpack.cards || []).length > 0 && (
          <Tooltip title="Copy all card names + rarities" arrow>
            <Box
              component="button"
              onClick={copyAllCards}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                border: 1, borderColor: 'divider', borderRadius: 1,
                bgcolor: 'background.default', px: 1.5, py: 0.75,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 16 }} /> Copy All Cards
            </Box>
          </Tooltip>
        )}
      </Box>

      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        {...getSnackbarProps({ severity: snack?.severity, isMobile: isMobileViewport })}
      >
        <MuiAlert
          severity={snack?.severity || 'info'}
          variant="filled"
          elevation={6}
          sx={getAlertSx(theme)}
        >
          {snack?.message}
        </MuiAlert>
      </Snackbar>
    </Dialog>
  )
}

// Stats Charts Component
const GodPackCharts = ({ stats }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const CHART_COLORS = getChartColors(theme)
  const textColor = theme.palette.text.primary
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'

  // Prepare timeline data with all dates filled
  const prepareTimelineData = () => {
    if (!stats?.timeline?.length) return []

    const data = stats.timeline.map(item => ({
      date: formatShortDate(item.date),
      count: item.count || 0,
    }))

    return data
  }

  // Prepare pack distribution data
  const preparePackData = () => {
    if (!stats?.byPack?.length) return []

    return stats.byPack.slice(0, 8).map((item, index) => ({
      name: item.pack_type || 'Unknown',
      value: item.count || 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }))
  }

  // Prepare rarity distribution data
  const prepareRarityData = () => {
    if (!stats?.byRarity?.length) return []

    return stats.byRarity.map(item => ({
      name: item.rarity || 'Unknown',
      count: item.count || 0,
      color: RARITY_COLORS[item.rarity] || '#666',
    }))
  }

  const timelineData = prepareTimelineData()
  const packData = preparePackData()
  const rarityData = prepareRarityData()

  if (!stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const chartBoxSx = {
    p: 2.5,
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  }

  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${GOLD}`,
    borderRadius: 8,
  }

  return (
    <FadeIn>
      <Grid container spacing={3}>
        {/* Timeline Chart */}
        <Grid item xs={12}>
          <Box sx={{ ...chartBoxSx, borderLeft: `3px solid ${GOLD}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TrendingIcon sx={{ color: GOLD, fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                God Packs Over Time (Last 30 Days)
              </Typography>
            </Box>
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis
                    dataKey="date"
                    stroke={textColor}
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={textColor}
                    fontSize={12}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={GOLD}
                    strokeWidth={3}
                    dot={{ fill: GOLD, strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: GOLD }}
                    name="God Packs"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No Timeline Data"
                description="No timeline data available yet"
                minHeight={200}
              />
            )}
          </Box>
        </Grid>

        {/* Pack Distribution Pie Chart */}
        <Grid item xs={12} md={6}>
          <Box sx={chartBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PieIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Distribution by Pack Type
              </Typography>
            </Box>
            {packData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={packData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {packData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No Data"
                description="No pack distribution data"
                minHeight={200}
              />
            )}
          </Box>
        </Grid>

        {/* Rarity Distribution Bar Chart */}
        <Grid item xs={12} md={6}>
          <Box sx={chartBoxSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ChartIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Rarity Distribution
              </Typography>
            </Box>
            {rarityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rarityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis type="number" stroke={textColor} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={textColor}
                    fontSize={11}
                    width={100}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Cards">
                    {rarityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="No Data"
                description="No rarity data available"
                minHeight={200}
              />
            )}
          </Box>
        </Grid>

        {/* Luck Analysis */}
        <Grid item xs={12}>
          <Box sx={{ ...chartBoxSx, borderLeft: `3px solid ${GOLD}` }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Luck Analysis
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <StatCardV2
                  icon={<StarIcon />}
                  label="Total God Packs"
                  value={stats.total || 0}
                  color={GOLD}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCardV2
                  icon={<TrendingIcon />}
                  label="This Week"
                  value={stats.last7d || 0}
                  color="success"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCardV2
                  icon={<ChartIcon />}
                  label="Daily Average"
                  value={((stats.last7d || 0) / 7).toFixed(1)}
                  color="info"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <StatCardV2
                  icon={<PieIcon />}
                  label="Top Pack Type"
                  value={stats.byPack?.[0]?.pack_type || 'N/A'}
                  color="secondary"
                />
              </Grid>
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </FadeIn>
  )
}

function GodPackGallery() {
  const { t } = useLanguage()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isDark = theme.palette.mode === 'dark'
  const [godpacks, setGodpacks] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedGodpack, setSelectedGodpack] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [liveFilter, setLiveFilter] = useState(false)
  const [selectedContainers, setSelectedContainers] = useState([]) // empty = all
  // Phase 3 — freshness state populated by /api/godpacks/feed response.
  const [feedLastUpdatedAt, setFeedLastUpdatedAt] = useState(null)
  // Phase 4 (Apr 2026) — client-side filters/sort/group over the
  // already-fetched feed payload. NOTHING here changes backend behavior.
  const [sourceFilter, setSourceFilter]     = useState('all')   // 'all' | 'hunt' | 'wonderpick' | 'manual'
  const [attribFilter, setAttribFilter]     = useState('all')   // 'all' | 'attributed' | 'shared'
  const [sortBy, setSortBy]                 = useState('newest') // 'newest' | 'expiringSoon' | 'mostMembers'
  const [groupByStatus, setGroupByStatus]   = useState(false)
  const limit = 12

  const CONTAINER_OPTIONS = [1, 2, 3, 4]
  const CONTAINER_COLORS = { 1: '#4caf50', 2: '#ff9800', 3: '#2196f3', 4: '#9c27b0' }

  const toggleContainer = (c) => {
    setSelectedContainers(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
    setPage(1) // reset to page 1 on filter change
  }

  useEffect(() => {
    fetchGodpacks()
    fetchStats()
  }, [page, liveFilter, selectedContainers])

  // Phase 3 (Apr 2026) — primary feed source is now the normalized
  // /api/godpacks/feed endpoint (Phase 1 read model). It returns the
  // same data plus normalized status/source chips + attribution +
  // lastUpdatedAt. We adapt to the legacy {godpacks, total} shape so
  // the rest of this page stays unchanged.
  //
  // If the feed call fails for any reason (e.g. backend rolled back),
  // we fall through to the legacy /api/hunt/godpacks endpoint as a
  // safety net. NO destructive behavior change.
  const fetchGodpacks = async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * limit
      const containers = selectedContainers.length > 0 ? selectedContainers : undefined
      const status     = liveFilter ? 'LIVE' : undefined
      let data
      try {
        // Phase 3 — feed endpoint uses opaque cursor; we still need
        // page-based UX. Server accepts cursor=base64({o:offset}) so
        // we encode it client-side for parity with the existing pager.
        const cursor = offset > 0
          ? btoa(JSON.stringify({ o: offset }))
          : undefined
        const feed = await godpacksFeed.getFeed({ status, containers, limit, cursor })
        // Adapt to legacy {godpacks, total} shape consumed downstream.
        data = {
          godpacks: (feed.items || []).map(it => ({
            // Legacy fields still expected by GodPackCard + DetailDialog
            id:               it.id,
            playerId:         it.friend?.playerId || null,
            playerName:       it.friend?.playerName || null,
            packType:         it.packType || it.cards?.[0]?.setName || null,
            setCode:          it.cards?.[0]?.setCode || null,
            setName:          it.cards?.[0]?.setName || null,
            discoveredAt:     it.createdAt,
            cards:            it.cards || [],
            status:           it.status,
            containerGroup:   null,                // partition number not in feed; container chip used instead
            // Phase 3 normalized fields (consumed by new card chrome)
            source:           it.source,
            owner:            it.owner,
            friend:           it.friend,
            attribution:      it.attribution,
            members:          it.members,
            metrics:          it.metrics,
          })),
          total: feed.total || 0,
        }
        setFeedLastUpdatedAt(feed.lastUpdatedAt || null)
      } catch (feedErr) {
        console.warn('[GodPackGallery] /api/godpacks/feed failed, falling back to /api/hunt/godpacks:', feedErr.message)
        data = await hunt.getGodpacks(limit, offset, liveFilter ? 'ALIVE' : undefined, containers)
        setFeedLastUpdatedAt(null)
      }
      setGodpacks(data.godpacks || [])
      setTotal(data.total || 0)
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to fetch god packs')
    } finally {
      setLoading(false)
    }
  }

  // Phase 3 — godpack:updated socket listener. On any GP status flip
  // (from this WebUI's hunt.js status writeback), refetch the feed.
  // Debounced 500ms so a burst of events triggers one refetch.
  useEffect(() => {
    let timer = null
    const handler = (_payload) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fetchGodpacks()
        fetchStats()
      }, 500)
    }
    onGodpackUpdated(handler)
    return () => {
      if (timer) clearTimeout(timer)
      offGodpackUpdated(handler)
    }
    // Only re-bind when the page/filters change (so refetch picks up
    // the right query). fetchGodpacks closes over those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, liveFilter, selectedContainers])

  const fetchStats = async () => {
    try {
      const data = await hunt.getGodpackStats()
      setStats(data)
    } catch (err) {
      // Ignore stats errors
    }
  }

  return (
    <FadeIn duration={0.4}>
    <Box>
      <PageHeader
        icon={<StarIcon />}
        title="God Pack Gallery"
        subtitle="Showcase and statistics of discovered god packs"
        accent={GOLD}
      />

      {/* ═══ SUMMARY STRIP — 3 key numbers at a glance ═══ */}
      {stats && (
        <Box sx={{
          display: 'flex', gap: 2, mt: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {/* Phase 3 — freshness pill (only renders when feed delivered
              a lastUpdatedAt; legacy fallback hides it). */}
          {feedLastUpdatedAt && (
            <FreshnessIndicator lastUpdatedAt={feedLastUpdatedAt} variant="detail" />
          )}
          <Chip
            icon={<StarIcon sx={{ fontSize: 14 }} />}
            label={`${stats.total || 0} total`}
            sx={{ fontWeight: 700, fontSize: '0.75rem', height: 28 }}
          />
          <Chip
            icon={<StarIcon sx={{ fontSize: 14, color: '#34D399' }} />}
            label={`${stats.last24h || 0} today`}
            color="success"
            variant="outlined"
            sx={{ fontWeight: 700, fontSize: '0.75rem', height: 28 }}
          />
          {stats.byPack?.[0] && (
            <Chip
              label={`Top: ${stats.byPack[0].pack_type}`}
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 28 }}
            />
          )}
        </Box>
      )}

      {/* Tabs */}
      <Box
        sx={{
          mt: 1,
          mb: 3,
          borderRadius: '14px',
          border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          overflow: 'hidden',
        }}
      >
        <Tabs value={activeTab} onChange={(e, v) => {
          setActiveTab(v)
          if (v === 2) {
            setLiveFilter(true)
            setPage(1)
          } else {
            setLiveFilter(false)
            setPage(1)
          }
        }} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto">
          <Tab
            icon={<GalleryIcon />}
            iconPosition="start"
            label="Gallery"
            sx={{ minHeight: 48 }}
          />
          <Tab
            icon={<ChartIcon />}
            iconPosition="start"
            label="Statistics"
            sx={{ minHeight: 48 }}
          />
          <Tab
            icon={<DotIcon sx={{ color: theme.palette.success.main, fontSize: 14 }} />}
            iconPosition="start"
            label="Live Packs"
            sx={{ minHeight: 48 }}
          />
        </Tabs>
      </Box>

      {/* Container Filter Chips (Gallery + Live Packs tabs only) */}
      {(activeTab === 0 || activeTab === 2) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', mr: 0.5 }}>
            Container:
          </Typography>
          <Chip
            label="All"
            size="small"
            variant={selectedContainers.length === 0 ? 'filled' : 'outlined'}
            onClick={() => setSelectedContainers([])}
            sx={{
              fontWeight: 600,
              cursor: 'pointer',
              ...(selectedContainers.length === 0 && {
                bgcolor: GOLD,
                color: 'black',
                '&:hover': { bgcolor: '#e6c200' },
              }),
            }}
          />
          {CONTAINER_OPTIONS.map((c) => {
            const isSelected = selectedContainers.includes(c)
            const color = CONTAINER_COLORS[c]
            return (
              <Chip
                key={c}
                label={`C${c}`}
                size="small"
                variant={isSelected ? 'filled' : 'outlined'}
                onClick={() => toggleContainer(c)}
                sx={{
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderColor: color,
                  ...(isSelected ? {
                    bgcolor: color,
                    color: '#fff',
                    '&:hover': { bgcolor: color, filter: 'brightness(0.85)' },
                  } : {
                    color,
                    '&:hover': { bgcolor: `${color}18` },
                  }),
                }}
              />
            )
          })}
          {selectedContainers.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              ({total} pack{total !== 1 ? 's' : ''})
            </Typography>
          )}
        </Box>
      )}

      {/* Phase 4 (Apr 2026) — Source / Attribution / Sort / Group chips.
          All client-side over the same feed payload. No backend impact. */}
      {(activeTab === 0 || activeTab === 2) && godpacks.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>
            Source:
          </Typography>
          {[
            ['all', 'All'],
            ['hunt', 'Hunt'],
            ['wonderpick', 'Wonderpick'],
            ['manual', 'Manual'],
          ].map(([k, label]) => (
            <Chip key={k} label={label} size="small"
              variant={sourceFilter === k ? 'filled' : 'outlined'}
              onClick={() => setSourceFilter(k)}
              sx={{ fontWeight: 600, cursor: 'pointer', height: 22 }}
            />
          ))}
          <Box sx={{ width: 12 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>
            Attribution:
          </Typography>
          {[
            ['all', 'All'],
            ['attributed', 'Attributed'],
            ['shared', 'Shared Pool'],
          ].map(([k, label]) => (
            <Chip key={k} label={label} size="small"
              variant={attribFilter === k ? 'filled' : 'outlined'}
              onClick={() => setAttribFilter(k)}
              sx={{ fontWeight: 600, cursor: 'pointer', height: 22 }}
            />
          ))}
          <Box sx={{ width: 12 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>
            Sort:
          </Typography>
          {[
            ['newest', 'Newest'],
            ['expiringSoon', 'Expiring soon'],
            ['mostMembers', 'Most members'],
          ].map(([k, label]) => (
            <Chip key={k} label={label} size="small"
              variant={sortBy === k ? 'filled' : 'outlined'}
              onClick={() => setSortBy(k)}
              sx={{ fontWeight: 600, cursor: 'pointer', height: 22 }}
            />
          ))}
          <Box sx={{ width: 12 }} />
          <Chip
            label={groupByStatus ? 'Grouped' : 'Group'}
            size="small"
            color={groupByStatus ? 'info' : 'default'}
            variant={groupByStatus ? 'filled' : 'outlined'}
            onClick={() => setGroupByStatus(g => !g)}
            sx={{ fontWeight: 600, cursor: 'pointer', height: 22 }}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Banner (always shown) */}
      {stats && (
        <FadeIn delay={0.1}>
          <Box
            sx={{
              p: 2.5,
              mb: 4,
              borderRadius: '14px',
              border: `2px solid ${goldGlow(0.3)}`,
              background: isDark
                ? `linear-gradient(135deg, ${goldGlow(0.05)}, rgba(255, 140, 0, 0.03))`
                : `linear-gradient(135deg, ${goldGlow(0.08)}, rgba(255, 140, 0, 0.04))`,
              boxShadow: `0 4px 20px ${goldGlow(0.12)}`,
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={700} sx={{ color: GOLD }}>
                    <CountUp value={stats.total} duration={1} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Total God Packs</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    <CountUp value={stats.last24h} duration={0.8} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Last 24 Hours</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="info.main">
                    <CountUp value={stats.last7d} duration={0.8} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Last 7 Days</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="secondary.main">
                    <CountUp value={stats.last30d} duration={0.8} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Last 30 Days</Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </FadeIn>
      )}

      {/* Tab Content */}
      {(activeTab === 0 || activeTab === 2) ? (
        // Gallery View (All or Live Packs)
        loading ? (
          <CardGridSkeleton count={12} />
        ) : godpacks.length === 0 ? (
          <EmptyState
            icon={<PokeballIcon sx={{ fontSize: 64 }} />}
            title="No God Packs Found Yet"
            description="Keep hunting! God packs will appear here when discovered."
          />
        ) : (
          <FadeIn>
            <>
              {/* Phase 4 (Apr 2026) — apply client-side filters/sort/group
                  to the already-fetched godpacks list. NO refetch. */}
              {(() => {
                let view = godpacks.slice();
                // Source filter
                if (sourceFilter !== 'all') {
                  view = view.filter(gp => gp.source === sourceFilter);
                }
                // Attribution filter
                if (attribFilter === 'attributed') {
                  view = view.filter(gp => gp.attribution?.addedByUserId != null);
                } else if (attribFilter === 'shared') {
                  view = view.filter(gp => gp.attribution?.addedByUserId == null);
                }
                // Sort
                view.sort((a, b) => {
                  if (sortBy === 'expiringSoon') {
                    const aE = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
                    const bE = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
                    return aE - bE;
                  }
                  if (sortBy === 'mostMembers') {
                    return (b.members?.length || 0) - (a.members?.length || 0);
                  }
                  // newest
                  const aD = new Date(a.discoveredAt || a.createdAt || 0).getTime();
                  const bD = new Date(b.discoveredAt || b.createdAt || 0).getTime();
                  return bD - aD;
                });

                // Empty after filter — show a friendly note instead of nothing.
                if (view.length === 0) {
                  return (
                    <EmptyState
                      icon={<PokeballIcon sx={{ fontSize: 64 }} />}
                      title="No matching god packs"
                      description="Try a different Source / Attribution / Container combination."
                    />
                  );
                }

                // Group view (LIVE / EXPIRING SOON / RECENT)
                if (groupByStatus) {
                  const now = Date.now();
                  const groups = { LIVE: [], EXPIRING_SOON: [], RECENT: [] };
                  for (const gp of view) {
                    const expMs  = gp.expiresAt ? new Date(gp.expiresAt).getTime() - now : null;
                    const isLive = (gp.status || '').toUpperCase() === 'LIVE';
                    const isExpSoon = expMs != null && expMs > 0 && expMs < 1000 * 60 * 60 * 6; // <6h
                    if (isLive)         groups.LIVE.push(gp);
                    else if (isExpSoon) groups.EXPIRING_SOON.push(gp);
                    else                groups.RECENT.push(gp);
                  }
                  return (
                    <>
                      {/* Phase 5.7 — Decision Language: section headers
                          use Title Case ("Live", "Expiring soon",
                          "Recent") + remove the textTransform:uppercase
                          override so chips below render without
                          ALL-CAPS shouting at the user. */}
                      {[
                        ['LIVE',          'Live',           'success.main'],
                        ['EXPIRING_SOON', 'Expiring soon',  'warning.main'],
                        ['RECENT',        'Recent',         'text.secondary'],
                      ].map(([key, label, color]) => (
                        groups[key].length > 0 && (
                          <Box key={key} sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color, mb: 1, letterSpacing: 0.3 }}>
                              {label} ({groups[key].length})
                            </Typography>
                            <StaggerContainer staggerDelay={0.05}>
                              {/* Phase 5.8 mobile pass — Grid breakpoints:
                                  2 cols mobile / 3 tablet / 4 desktop /
                                  5 large. lg=2.4 = 12/5 (MUI v1 fractional). */}
                              <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
                                {groups[key].map(gp => (
                                  <Grid item xs={6} sm={4} md={3} lg={2.4} key={gp.id}>
                                    <StaggerItem>
                                      <GodPackCard godpack={gp} onClick={setSelectedGodpack} />
                                    </StaggerItem>
                                  </Grid>
                                ))}
                              </Grid>
                            </StaggerContainer>
                          </Box>
                        )
                      ))}
                    </>
                  );
                }

                return (
                  <StaggerContainer staggerDelay={0.05}>
                    {/* Phase 5.8 mobile pass — same 2/3/4/5 ladder as the
                        groupByStatus branch above. Tighter spacing on
                        mobile so 2 cards per row don't clip. */}
                    <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
                      {view.map((godpack) => (
                        <Grid item xs={6} sm={4} md={3} lg={2.4} key={godpack.id}>
                          <StaggerItem>
                            <GodPackCard godpack={godpack} onClick={setSelectedGodpack} />
                          </StaggerItem>
                        </Grid>
                      ))}
                    </Grid>
                  </StaggerContainer>
                );
              })()}

              {total > limit && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={Math.ceil(total / limit)}
                    page={page}
                    onChange={(e, p) => setPage(p)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          </FadeIn>
        )
      ) : (
        // Statistics View
        <GodPackCharts stats={stats} />
      )}

      {/* Detail Dialog */}
      <GodPackDetailDialog
        godpack={selectedGodpack}
        open={!!selectedGodpack}
        onClose={() => setSelectedGodpack(null)}
      />
    </Box>
    </FadeIn>
  )
}

export default GodPackGallery
