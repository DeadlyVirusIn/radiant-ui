import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { selectCanonicalGP, deriveBadges, getGPSortKey } from '../utils/gpHelpers'
// Phase v3.3 (May 14 2026) — shared partition + sequential override
// helpers. All user-facing bulk-remove paths route through these so
// they cannot diverge again.
import { partitionFriendsForRemoval, runSequentialOverride, MAX_OVERRIDE_BATCH } from '../utils/friendRemovalPartition'
// Phase 5.10 — show a value-tier chip on friend rows linked to a
// high-value pack (ultra / high tier only — never on strong/normal
// so the chip stays meaningful and never adds noise).
import { computeValueTier } from '../utils/valueTier'
import ValueTierChip from '../components/ValueTierChip'
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Chip,
  CircularProgress,
  IconButton,
  Alert,
  AlertTitle,
  Tooltip,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Checkbox,
  Tab,
  Tabs,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActionArea,
  Slider,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  Skeleton,
  Pagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
} from '@mui/material'
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  PersonRemove as PersonRemoveIcon,
  SmartToy as BotIcon,
  CardGiftcard as GiftIcon,
  Close as CloseIcon,
  Stars as GodPackIcon,
  FilterList as FilterIcon,
  Favorite as WishlistIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CheckBox as SelectIcon,
  SelectAll as SelectAllIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Block as BlockIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material'
import { friends as friendsApi, accounts as accountsApi, giveCard as giveCardApi, hunt as huntApi } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { onFriendPurgeProgress, offFriendPurgeProgress } from '../services/socket'
import GlassCard from '../components/GlassCard'
import PageHeader from '../components/PageHeader'
import { FadeIn } from '../components/Animations'
import { EmptyState, NoFriendsEmpty } from '../components/EmptyState'
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons'
import LoadingButton from '../components/LoadingButton'
// Phase 4.8 — unified snackbar styling/duration/anchor.
import MuiAlert from '@mui/material/Alert'
import { getSnackbarProps, getAlertSx } from '../utils/snackbarConfig'
// Phase 5.1 — standardized confirmation-summary block. Used by
// Smart Clear's pre-removal confirm dialog.
import ConfirmationSummary from '../components/ConfirmationSummary'

// Utility to format time estimates for long-running operations
const formatTimeEstimate = (count, secondsPerItem = 1) => {
  const totalSeconds = count * secondsPerItem
  if (totalSeconds < 60) return `~${totalSeconds} seconds`
  const minutes = Math.ceil(totalSeconds / 60)
  if (minutes === 1) return '~1 minute'
  return `~${minutes} minutes`
}

// Inline skeleton for friend list loading — matches actual row layout
function FriendListSkeleton({ rows = 8 }) {
  return (
    <List sx={{ py: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i}>
          {i > 0 && <Divider />}
          <ListItem sx={{ py: 1.5, minHeight: 64 }}>
            <ListItemAvatar>
              <Skeleton variant="circular" width={36} height={36} />
            </ListItemAvatar>
            <ListItemText
              primary={<Skeleton variant="text" width={120} height={22} />}
              secondary={<Skeleton variant="text" width={180} height={16} />}
            />
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton variant="circular" width={28} height={28} />
            </Box>
          </ListItem>
        </Box>
      ))}
    </List>
  )
}

function Friends({ user }) {
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const { isDark } = useThemeMode()
  const { t } = useLanguage()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  // Phase 4.8 — separate `sm` breakpoint controls snackbar re-anchoring.
  // Different from `isMobile` (md) which drives table-vs-list density.
  const isPhone  = useMediaQuery(theme.breakpoints.down('sm'))
  // Phase 4.8 — local snackbar feedback for inline copy actions inside
  // Smart Clear preview rows. Reuses the same setSnack({message,severity})
  // shape used by GodPackGallery so getSnackbarProps() works as-is.
  const [snack, setSnack] = useState(null)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [friendsPage, setFriendsPage] = useState(1)
  const FRIENDS_PER_PAGE = 30
  const searchTimerRef = useRef(null)
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])
  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }, [])

  // Accounts
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(null)
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  // Friends data from game
  const [friendsList, setFriendsList] = useState([])
  const [receivedRequests, setReceivedRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [maxFriends, setMaxFriends] = useState(99)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  // God pack data for friends
  const [godPackMap, setGodPackMap] = useState({})
  const [selectedGodPackFriend, setSelectedGodPackFriend] = useState(null)

  // Favorites from game API
  const [favoritePlayerIds, setFavoritePlayerIds] = useState(new Set())

  // Tab state
  const [activeTab, setActiveTab] = useState(0)

  // Action loading states
  const [actionLoading, setActionLoading] = useState({})

  // Add friend dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchingPlayer, setSearchingPlayer] = useState(false)
  const [friendCodeInput, setFriendCodeInput] = useState('')
  const [foundPlayer, setFoundPlayer] = useState(null)

  // Gift card modal state
  const [giftDialogOpen, setGiftDialogOpen] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [eligibleCards, setEligibleCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [sendingGift, setSendingGift] = useState(false)
  const [cardSearchQuery, setCardSearchQuery] = useState('')

  // ── SAFETY GATE (Apr 2026) — friend removal lockdown state ──────────
  // Backend reports whether FRIEND_REMOVAL_ENABLED is set. While disabled,
  // all delete buttons (Smart Clear, bulk, single) are blocked + banner shown.
  const [removalEnabled, setRemovalEnabled] = useState(true)        // optimistic until status loads
  const [removalReason, setRemovalReason] = useState('')
  useEffect(() => {
    let cancelled = false
    friendsApi.getRemovalStatus().then(s => {
      if (cancelled) return
      setRemovalEnabled(!!s.enabled)
      setRemovalReason(s.reason || '')
    }).catch(() => {
      if (cancelled) return
      // Fail closed
      setRemovalEnabled(false)
      setRemovalReason('Unable to verify removal status — assuming disabled.')
    })
    return () => { cancelled = true }
  }, [])

  // ── PART C — Smart Clear preview-first state (Apr 2026) ────────────
  // Modal opens to show config; click "Preview" → fetches backend preview;
  // click "Confirm Removal" → only enabled if canProceed && removalEnabled.
  const [smartClearPreview, setSmartClearPreview] = useState(null)  // null | { totalScanned, kept, removable, cannotEvaluate, canProceed, blockReason, friendsByConfidence, summary }
  const [smartClearPreviewLoading, setSmartClearPreviewLoading] = useState(false)
  const [smartClearPreviewError, setSmartClearPreviewError] = useState('')
  // Phase WP-FixD3 — remember the favorites list used during preview so
  // confirm passes the SAME data to the server for identical confidence
  // recomputation. null = favorites filter was off / not fetched.
  const [smartClearPreviewFavoritesUsed, setSmartClearPreviewFavoritesUsed] = useState(null)
  // Phase WP-FixD4 — explicit risk-accept toggle for MEDIUM_SAFE removal.
  // When ON, Smart Clear includes MEDIUM_SAFE friends and tells the
  // server acceptMediumSafe=true. When OFF, only HIGH_SAFE removed.
  const [smartClearAcceptMedium, setSmartClearAcceptMedium] = useState(false)
  // Phase v3 (May 2026) — GodPack tier cleanup mode (0..3).
  // 0 = Keep all GodPacks (default, safest). 1/2/3 = allow Smart Clear to
  // remove friends whose ONLY protection is GP tier 1, 1+2, or 1+2+3.
  // Tier 4, 5, and pseudo-high-value friends are NEVER bulk-removable by
  // Smart Clear — they may still be removed manually one-by-one.
  // NOT persisted to localStorage by design: every session defaults back
  // to "Keep all GodPacks" to prevent accidental aggressive cleanup.
  const [gpClearMaxTier, setGpClearMaxTier] = useState(0)

  // Smart Clear state - persist settings to localStorage
  const SMART_CLEAR_STORAGE_KEY = 'smartClearSettings'
  const [smartClearOpen, setSmartClearOpen] = useState(false)
  const [smartClearConfig, setSmartClearConfig] = useState(() => {
    const defaults = {
      minStars: 3,
      minNewCards: 5,
      filterByStar: false,  // Off by default - when ON it keeps too many friends
      filterByNew: false,
      filterLogic: 'OR',
      protectWishlist: false,
      protectGodpackFinders: true,
      protectPseudoPackFinders: false,
      protectFavorites: true,
    }
    try {
      const saved = localStorage.getItem(SMART_CLEAR_STORAGE_KEY)
      if (saved) return { ...defaults, ...JSON.parse(saved) }
    } catch (e) { /* ignore parse errors */ }
    return defaults
  })
  const [includePseudoInRemove, setIncludePseudoInRemove] = useState(true)  // Include pseudo packs in "Remove Except Godpacks"
  // Select mode for manual batch delete
  const [selectMode, setSelectMode] = useState(false)
  const [selectedFriends, setSelectedFriends] = useState(new Set())
  const [deleteSelectedProgress, setDeleteSelectedProgress] = useState(null)
  const [purgeProgress, setPurgeProgress] = useState(null) // Server-side bulk removal progress
  const [smartClearing, setSmartClearing] = useState(false)
  const [smartClearProgress, setSmartClearProgress] = useState({ current: 0, total: 0, kept: 0, removed: 0 })

  // Persist smart clear settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SMART_CLEAR_STORAGE_KEY, JSON.stringify(smartClearConfig))
    } catch (e) { /* ignore write errors */ }
  }, [smartClearConfig])

  // Phase v3 (May 2026) — every time the Smart Clear dialog opens, force
  // GP tier mode back to 0 (Keep all GodPacks). This is intentional:
  // gpClearMaxTier is the most consequential knob on the page and we never
  // want the previous session's aggressive setting silently in effect.
  useEffect(() => {
    if (smartClearOpen) {
      setGpClearMaxTier(0)
      setSmartClearPreview(null)
      setSmartClearPreviewError('')
    }
  }, [smartClearOpen])

  // Phase WP-FixC — invalidate preview whenever filter config changes
  // so user must re-generate before they can confirm removal.
  // Phase WP-FixD4 — also reset the risk-accept toggle so user re-opts-in
  // explicitly each time the preview changes.
  useEffect(() => {
    setSmartClearPreview(null)
    setSmartClearPreviewError('')
    setSmartClearAcceptMedium(false)
    // Phase v3 — also reset the GP tier mode so any prior elevated
    // selection is dropped when filters change. Combined with the
    // "no localStorage persistence" decision, this guarantees every
    // Smart Clear session starts from the safe default.
    setGpClearMaxTier(0)
  }, [smartClearConfig])

  // Load accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Listen for server-side friend purge progress
  // Phase WP-FixE — completion now distinguishes "all skipped" from
  // "real success" so the UI never shows "Server removed 0 friends" as
  // a green success when the user intended actual removals.
  useEffect(() => {
    const handlePurgeProgress = (data) => {
      if (data.accountId !== parseInt(selectedAccountId)) return
      setPurgeProgress(data)
      if (data.phase === 'complete') {
        const removed   = data.removed ?? 0
        const failed    = data.failed  ?? 0
        const requested = data.breakdown?.requested ?? data.total ?? 0
        const skipped   = data.breakdown?.skippedOverrideable ?? 0
        const blocked   = data.breakdown?.blockedSystem ?? 0
        const overridden = data.breakdown?.overridden ?? 0

        if (removed === 0 && requested > 0) {
          // Honest warning — nothing actually removed. Phase v3.1 — replace
          // "system-blocked" jargon with the same humanized phrasing the
          // success branch uses ("protected and could not be removed").
          const blockers = []
          if (skipped > 0) blockers.push(`${skipped} required override and were skipped`)
          if (blocked > 0) blockers.push(`${blocked} were protected and could not be removed`)
          if (failed  > 0) blockers.push(`${failed} failed during deletion`)
          setError(`No friends removed.${blockers.length ? ' ' + blockers.join('. ') + '.' : ''}`)
        } else {
          // Phase v3.1 — humanized result toast. The user-facing message
          // explains the protected-and-skipped count in plain English
          // rather than "N system-blocked" jargon. Failure / override
          // detail still appended for transparency.
          const sentences = [`Removed ${removed}.`]
          const protectedAndSkipped = (skipped || 0) + (blocked || 0)
          if (protectedAndSkipped > 0) {
            sentences.push(`${protectedAndSkipped} were protected and skipped.`)
          }
          if (overridden > 0) sentences.push(`${overridden} removed via override.`)
          if (failed   > 0) sentences.push(`${failed} failed during deletion.`)
          setSuccess(sentences.join(' '))
        }
        setActionLoading(prev => ({ ...prev, removeAll: false, deleteSelected: false, removeExceptGodpacks: false }))
        setSmartClearing(false)
        setTimeout(() => setPurgeProgress(null), 5000)
        loadGameFriends()
      } else if (data.phase === 'error') {
        setError(`Bulk removal error: ${data.error}`)
        setActionLoading(prev => ({ ...prev, removeAll: false, deleteSelected: false, removeExceptGodpacks: false }))
        setSmartClearing(false)
        setTimeout(() => setPurgeProgress(null), 5000)
      }
    }
    onFriendPurgeProgress(handlePurgeProgress)
    return () => offFriendPurgeProgress(handlePurgeProgress)
  }, [selectedAccountId])

  // Load friends when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      loadGameFriends()
    }
  }, [selectedAccountId])

  const loadAccounts = async () => {
    try {
      const data = await accountsApi.list()
      const activeAccounts = (data.accounts || []).filter(a => a.is_active)
      setAccounts(activeAccounts)

      // Auto-select first account
      if (activeAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(activeAccounts[0].id)
      }
    } catch (err) {
      setError('Failed to load accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const loadGameFriends = async () => {
    if (!selectedAccountId) return

    setLoading(true)
    setError('')
    try {
      const [data, favData] = await Promise.all([
        friendsApi.getGameFriends(selectedAccountId),
        friendsApi.getGameFavorites(selectedAccountId).catch(() => ({ favoritePlayerIds: [] })),
      ])
      const friends = data.friends || []
      setFriendsList(friends)
      setReceivedRequests(data.receivedRequests || [])
      setSentRequests(data.sentRequests || [])
      setMaxFriends(data.maxFriends || 30)
      setFavoritePlayerIds(new Set(favData.favoritePlayerIds || []))

      // Fetch god pack data for friends
      if (friends.length > 0) {
        try {
          const playerIds = friends.map(f => f.playerId).filter(Boolean)
          if (playerIds.length > 0) {
            const gpData = await huntApi.getGodpacksByPlayers(playerIds, selectedAccountId)
            setGodPackMap(gpData.godpacks || {})
          }
        } catch (e) {
          // Non-critical - silently ignore
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch friends from game')
    } finally {
      setLoading(false)
    }
  }

  // Toggle favorite status for a friend (in-game)
  const handleToggleGameFavorite = async (playerId) => {
    if (!selectedAccountId) return

    const isFav = favoritePlayerIds.has(playerId)
    setActionLoading(prev => ({ ...prev, [`fav_${playerId}`]: true }))
    try {
      const result = await friendsApi.setGameFavorite(selectedAccountId, playerId, !isFav)
      setFavoritePlayerIds(new Set(result.favoritePlayerIds || []))
      setSuccess(isFav ? 'Removed from favorites' : 'Added to favorites')
    } catch (err) {
      setError(err.message || 'Failed to update favorite')
    } finally {
      setActionLoading(prev => ({ ...prev, [`fav_${playerId}`]: false }))
    }
  }

  // Search for player by friend code
  const handleSearchPlayer = async () => {
    if (!friendCodeInput.trim() || !selectedAccountId) return

    setSearchingPlayer(true)
    setFoundPlayer(null)
    try {
      const result = await friendsApi.searchPlayer(selectedAccountId, friendCodeInput.trim())
      if (result.found && result.player) {
        setFoundPlayer(result.player)
      } else {
        setError('Player not found with that friend code')
      }
    } catch (err) {
      setError(err.message || 'Search failed')
    } finally {
      setSearchingPlayer(false)
    }
  }

  // Send friend request
  const handleSendRequest = async () => {
    if (!foundPlayer || !selectedAccountId) return

    setActionLoading(prev => ({ ...prev, send: true }))
    try {
      await friendsApi.sendGameRequest(selectedAccountId, foundPlayer.playerId)
      setSuccess('Friend request sent!')
      setAddDialogOpen(false)
      setFriendCodeInput('')
      setFoundPlayer(null)
      loadGameFriends()
    } catch (err) {
      setError(err.message || 'Failed to send request')
    } finally {
      setActionLoading(prev => ({ ...prev, send: false }))
    }
  }

  // Accept friend request
  const handleAcceptRequest = async (playerId) => {
    if (!selectedAccountId) return

    setActionLoading(prev => ({ ...prev, [playerId]: true }))
    try {
      await friendsApi.acceptGameRequest(selectedAccountId, playerId)
      setSuccess('Friend request accepted!')
      loadGameFriends()
    } catch (err) {
      setError(err.message || 'Failed to accept request')
    } finally {
      setActionLoading(prev => ({ ...prev, [playerId]: false }))
    }
  }

  // Reject friend request
  const handleRejectRequest = async (playerId) => {
    if (!selectedAccountId) return

    setActionLoading(prev => ({ ...prev, [`reject_${playerId}`]: true }))
    try {
      await friendsApi.rejectGameRequest(selectedAccountId, playerId)
      setSuccess('Friend request rejected')
      loadGameFriends()
    } catch (err) {
      setError(err.message || 'Failed to reject request')
    } finally {
      setActionLoading(prev => ({ ...prev, [`reject_${playerId}`]: false }))
    }
  }

  // Accept all pending friend requests (bulk API - single call with server-side loop)
  const handleAcceptAllRequests = async () => {
    if (!selectedAccountId || receivedRequests.length === 0) return
    const timeEstimate = formatTimeEstimate(receivedRequests.length, 0.5) // Server-side is faster
    // Phase 5.1 — standardized confirmation pattern.
    const confirmed = await confirm({
      title: 'Accept all friend requests',
      body: (
        <ConfirmationSummary
          outcome={`Accept ${receivedRequests.length} friend requests`}
          willHappen={[`${receivedRequests.length} pending requests will be accepted`]}
          willNotHappen={['Existing friends will not be touched']}
          meta={`Estimated time: ${timeEstimate}`}
        />
      ),
      confirmText: `Accept ${receivedRequests.length}`,
      confirmColor: 'success',
      variant: 'info',
    })
    if (!confirmed) return

    setActionLoading(prev => ({ ...prev, acceptAll: true }))
    setError('')
    setSuccess('')

    try {
      // Use bulk accept API - server handles the loop and delays
      const playerIds = receivedRequests.map(req => req.playerId).filter(Boolean)
      const result = await friendsApi.bulkAcceptGameRequests(selectedAccountId, playerIds)
      setSuccess(`Accepted ${result.accepted || playerIds.length} friend requests${result.failed > 0 ? ` (${result.failed} failed)` : ''}`)
    } catch (err) {
      setError(err.message || 'Failed to accept requests')
    }

    setActionLoading(prev => ({ ...prev, acceptAll: false }))
    loadGameFriends()
  }

  // Reject all pending friend requests (bulk API - single call)
  const handleRejectAllRequests = async () => {
    if (!selectedAccountId || receivedRequests.length === 0) return
    const timeEstimate = formatTimeEstimate(receivedRequests.length, 0.5) // Server-side is faster
    // Phase 5.1 — standardized confirmation pattern.
    const confirmed = await confirm({
      title: 'Reject all friend requests',
      body: (
        <ConfirmationSummary
          outcome={`Reject ${receivedRequests.length} friend requests`}
          willHappen={[`${receivedRequests.length} pending requests will be rejected`]}
          willNotHappen={['Existing friends will not be touched']}
          meta={`Estimated time: ${timeEstimate}`}
        />
      ),
      confirmText: `Reject ${receivedRequests.length}`,
      confirmColor: 'error',
      variant: 'warning',
    })
    if (!confirmed) return

    setActionLoading(prev => ({ ...prev, rejectAll: true }))
    setError('')
    setSuccess('')

    try {
      // Use bulk reject API - single call for all requests
      const playerIds = receivedRequests.map(req => req.playerId).filter(Boolean)
      const result = await friendsApi.bulkRejectGameRequests(selectedAccountId, playerIds)
      setSuccess(`Rejected ${result.rejected || playerIds.length} friend requests`)
    } catch (err) {
      setError(err.message || 'Failed to reject requests')
    }

    setActionLoading(prev => ({ ...prev, rejectAll: false }))
    loadGameFriends()
  }

  // Delete friend (with favorite protection)
  // Phase WP-FixE (Apr 2026) — single-delete with explicit override flow.
  // Backend now returns:
  //   200             — friend removed
  //   403 isFavorite  — game-side favorite (override via overrideProtected=true)
  //   409 PROTECTED_FRIEND        — overrideable protection (god_pack_history,
  //                                 favorite_game) — UI shows reasons + checkbox
  //   409 SYSTEM_BLOCKED_FRIEND   — non-overrideable (active_bot_account,
  //                                 hunt_participant, data_error) — refuse
  const handleDeleteFriend = async (playerId, playerName) => {
    if (!removalEnabled) { setError(removalReason || 'Friend removal is temporarily disabled.'); return }
    if (!selectedAccountId) return
    const displayName = playerName || 'this friend'

    // First confirmation — light warning only. We do NOT predict
    // protection client-side; backend is authoritative.
    const confirmed = await confirm({
      title: 'Remove Friend?',
      message: `Will remove: ${displayName}\n\nAll other friends will be kept.`,
      confirmText: 'Remove',
      confirmColor: 'error',
      variant: 'warning',
    })
    if (!confirmed) return

    setActionLoading(prev => ({ ...prev, [`del_${playerId}`]: true }))
    try {
      const result = await friendsApi.deleteGameFriend(selectedAccountId, playerId, {
        source: 'manual_single', playerName,
      })

      // ── Path A — protected, override-eligible ──
      if (result.code === 'PROTECTED_FRIEND' || result.isGodPack) {
        const reasonList = (result.protectionReasons || []).map(r => r.type).filter(Boolean)
        const reasonText = reasonList.length > 0
          ? reasonList.map(t => `  • ${humanizeProtectionReason(t)}`).join('\n')
          : (result.isGodPack ? '  • god_pack_history' : '  • protected')
        const overrideConfirmed = await confirm({
          title: 'Protected friend',
          message:
            `${displayName} is protected.\n\nReasons:\n${reasonText}\n\n` +
            `Removing this friend may lose access to a god pack or favorite ` +
            `that the system was protecting.\n\nThis cannot be undone.`,
          confirmText: 'Yes, remove anyway',
          cancelText: 'Cancel',
          confirmColor: 'error',
          variant: 'danger',
          requireCheckbox: 'I understand this removes access permanently',
        })
        if (!overrideConfirmed) {
          setActionLoading(prev => ({ ...prev, [`del_${playerId}`]: false }))
          return
        }
        const overrideResult = await friendsApi.deleteGameFriend(selectedAccountId, playerId, {
          source: 'manual_single',
          overrideProtected: true,
          overrideReason: 'user_confirmed_manual_removal',
          playerName,
        })
        if (overrideResult.success) {
          setSuccess(`Removed protected friend: ${displayName}`)
          loadGameFriends()
        } else {
          // Backend may still refuse if reason is non-overrideable system block.
          setError(overrideResult.error || `Could not remove ${displayName}`)
        }

      // ── Path B — system-blocked (active bot / hunt / data error / pseudo / anomaly) ──
      // Phase v3.8 (May 15 2026) — show ONLY the dominant reason via
      // pickPrimaryProtectionReason + blockedReasonCopy. Stops raw enum
      // leakage and removes confusing multi-reason concatenation
      // (e.g. "pseudo_high_value, tier_locked_by_mode" → just the pseudo
      // explanation since pseudo dominates). Detailed reasons stay in
      // the underlying `result.protectionReasons` for log/diagnostic use.
      } else if (result.code === 'SYSTEM_BLOCKED_FRIEND') {
        const reasonList = (result.protectionReasons || []).map(r => r.type).filter(Boolean)
        const dominant = pickPrimaryProtectionReason(reasonList)
        setError(blockedReasonCopy(dominant, displayName))
        try {
          console.log(`[FriendsUI] BLOCKED player=${playerId.substring(0, 8)} dominant=${dominant} all_reasons=[${reasonList.join(',')}]`)
        } catch (_) { /* logging must never break */ }

      // ── Path C — game-side favorite (legacy 403 path, kept for back-compat) ──
      } else if (result.isFavorite) {
        const overrideConfirmed = await confirm({
          title: 'This is a Favorite Friend!',
          message: `${displayName} is marked as a favorite in-game.\n\nAre you SURE you want to remove them? This cannot be undone.`,
          confirmText: 'Yes, remove anyway',
          confirmColor: 'error',
          variant: 'danger',
          requireCheckbox: 'I understand this removes access permanently',
        })
        if (overrideConfirmed) {
          const overrideResult = await friendsApi.deleteGameFriend(selectedAccountId, playerId, {
            source: 'manual_single', overrideProtected: true,
            overrideReason: 'user_confirmed_manual_removal', playerName,
          })
          if (overrideResult.success) {
            setSuccess(`Removed favorite: ${displayName}`)
            loadGameFriends()
          } else {
            setError(overrideResult.error || `Could not remove ${displayName}`)
          }
        }

      // ── Path D — clean removal ──
      } else if (result.success) {
        setSuccess(`Friend removed: ${displayName}`)
        loadGameFriends()

      } else {
        setError(result.error || 'Failed to remove friend')
      }
    } catch (err) {
      setError(err.message || 'Failed to remove friend')
    } finally {
      setActionLoading(prev => ({ ...prev, [`del_${playerId}`]: false }))
    }
  }

  // Helper: turn raw evaluator reason types into human-readable labels.
  // Phase v3.8 (May 15 2026) — humanize all protection reason types so
  // raw enum keys never leak into user-facing copy. Pairs with
  // pickPrimaryProtectionReason() below which selects the dominant
  // reason when multiple are present.
  function humanizeProtectionReason(type) {
    switch (type) {
      case 'god_pack_history':           return 'God Pack Finder'
      case 'favorite_game':              return 'In-Game Favorite'
      case 'active_bot_account':         return 'Your own bot account'
      case 'hunt_participant':           return 'Active hunt participant'
      case 'data_error':                 return 'Protection data unavailable'
      case 'data_unavailable':           return 'Required data not stored'
      case 'evaluator_error':            return 'Internal evaluator error'
      case 'invalid_input':              return 'Invalid request'
      case 'god_pack_pseudo_high_value': return 'Potentially high-value or ambiguous God Pack'
      case 'god_pack_anomaly':           return 'Incomplete God Pack data'
      case 'god_pack_5of5_manual_only':  return '5/5 God Pack (per-friend manual flow only)'
      case 'god_pack_4of5_manual_only':  return '4/5 God Pack (per-friend manual flow only)'
      case 'god_pack_tier_locked_by_mode': return 'God Pack tier above current Smart Clear mode'
      default:                           return 'System safety rule'
    }
  }

  // Phase v3.8 — priority resolver for protection reasons. When multiple
  // reasons fire (each god_packs row evaluated independently, friend can
  // carry several simultaneously), pick the DOMINANT one for the
  // user-facing primary message. Lower number = higher priority = wins.
  // Detailed/raw reasons stay in logs and in override-eligible bullet
  // lists; this only governs the single-line SYSTEM_BLOCKED message.
  const PROTECTION_REASON_PRIORITY = {
    god_pack_pseudo_high_value:  10,
    god_pack_anomaly:            20,
    god_pack_5of5_manual_only:   30,
    god_pack_4of5_manual_only:   40,
    active_bot_account:          50,
    hunt_participant:            60,
    data_error:                  70,
    data_unavailable:            71,
    evaluator_error:             72,
    invalid_input:               73,
    god_pack_tier_locked_by_mode: 80,
    god_pack_history:            90,
    favorite_game:              100,
  };

  function pickPrimaryProtectionReason(reasonList) {
    if (!Array.isArray(reasonList) || reasonList.length === 0) return null;
    let best = null;
    let bestRank = Infinity;
    for (const t of reasonList) {
      if (!t) continue;
      const rank = PROTECTION_REASON_PRIORITY[t] !== undefined
        ? PROTECTION_REASON_PRIORITY[t]
        : 999; // unknown reasons rank last
      if (rank < bestRank) { bestRank = rank; best = t; }
    }
    return best;
  }

  // Phase v3.8 — user-facing copy template per dominant reason for the
  // SYSTEM_BLOCKED_FRIEND non-overrideable path. Keep one short sentence;
  // never list multiple reasons; never leak raw enum keys.
  function blockedReasonCopy(dominantType, displayName) {
    switch (dominantType) {
      case 'god_pack_pseudo_high_value':
        return `Cannot remove ${displayName}. This friend is classified as a potentially high-value or ambiguous God Pack, so it cannot be removed from this flow.`;
      case 'god_pack_anomaly':
        return `Cannot remove ${displayName}. This friend has incomplete God Pack data, so it cannot be safely removed from this flow.`;
      case 'god_pack_5of5_manual_only':
        return `Cannot remove ${displayName} in bulk. This friend holds a 5/5 God Pack and can only be removed via the per-friend manual flow.`;
      case 'god_pack_4of5_manual_only':
        return `Cannot remove ${displayName} in bulk. This friend holds a 4/5 God Pack and can only be removed via the per-friend manual flow.`;
      case 'active_bot_account':
        return `Cannot remove ${displayName}. This is your own bot account and cannot be removed here.`;
      case 'hunt_participant':
        return `Cannot remove ${displayName}. This friend is an active hunt participant — cannot be removed while the hunt is running.`;
      case 'data_error':
      case 'data_unavailable':
      case 'evaluator_error':
      case 'invalid_input':
        return `Cannot remove ${displayName}. Protection data is unavailable right now. Please try again later.`;
      case 'god_pack_tier_locked_by_mode':
        return `Cannot remove ${displayName}. This friend's God Pack tier is above the current Smart Clear mode. Adjust the mode or use the per-friend delete with override.`;
      case 'god_pack_history':
      case 'favorite_game':
      case null:
      case undefined:
      default:
        return `Cannot remove ${displayName}. This friend is protected by a system safety rule.`;
    }
  }

  // Remove ALL friends (skips favorites)
  const handleRemoveAllBots = async () => {
    if (!removalEnabled) { setError(removalReason || 'Friend removal is temporarily disabled.'); return }
    if (!selectedAccountId) return

    // Fetch favorites first to protect them — abort if this fails
    let favoritePlayerIds = []
    try {
      const favResult = await friendsApi.getGameFavorites(selectedAccountId)
      favoritePlayerIds = favResult.favoritePlayerIds || []
    } catch (favErr) {
      setError('Cannot verify favorites — friend removal blocked for safety. Try again later.')
      return
    }

    const favSet = new Set(favoritePlayerIds)
    const toRemoveFriends = friendsList.filter(f => !favSet.has(f.playerId))
    const skippedFavorites = friendsList.filter(f => favSet.has(f.playerId))
    const toRemoveIds = toRemoveFriends.map(f => f.playerId)

    // Phase v3.3 — partition via shared helper so handleRemoveAllBots
    // matches handleDeleteSelected/handleRemoveAllExceptGodpacks semantics.
    const _p = partitionFriendsForRemoval(toRemoveIds, godPackMap)
    const partitions       = _p.partitions
    const tierBreakdown    = _p.tierBreakdown
    const overrideCapped   = _p.overrideCapped
    const overrideEligible = _p.overrideEligible
    const overrideDeferred = _p.overrideDeferred
    const highValueCount   = _p.highValueCount
    const lowTierCount     = _p.lowTierCount
    const totalRemovable   = partitions.normal.length + overrideEligible.length

    const timeEstimate = formatTimeEstimate(totalRemovable)
    const willHappen = []
    if (partitions.normal.length > 0) {
      willHappen.push(`${partitions.normal.length} regular friend${partitions.normal.length !== 1 ? 's' : ''} will be removed in a batch`)
    }
    if (overrideEligible.length > 0) {
      const tierParts = []
      if (lowTierCount > 0) tierParts.push(`${lowTierCount} low-tier (1/5–3/5)`)
      if (highValueCount > 0) tierParts.push(`${highValueCount} high-value (4/5–5/5)`)
      willHappen.push(
        `${overrideEligible.length} GodPack friend${overrideEligible.length !== 1 ? 's' : ''} will be removed one-by-one with manual override` +
        (tierParts.length ? ` — ${tierParts.join(', ')}` : '')
      )
    }
    const willNot = []
    if (skippedFavorites.length > 0) {
      willNot.push(`${skippedFavorites.length} favorite friend${skippedFavorites.length !== 1 ? 's' : ''} will not be touched`)
    }
    if (partitions.hardBlocked.length > 0) {
      const hbParts = []
      if (tierBreakdown.pseudo > 0) hbParts.push(`${tierBreakdown.pseudo} pseudo high-value`)
      if (tierBreakdown.anomaly > 0) hbParts.push(`${tierBreakdown.anomaly} anomaly (unknown tier)`)
      willNot.push(
        `${partitions.hardBlocked.length} friend${partitions.hardBlocked.length !== 1 ? 's' : ''} are protected by system safety rules and cannot be bulk removed` +
        (hbParts.length ? ` (${hbParts.join(', ')})` : '')
      )
    }
    if (overrideCapped) {
      willNot.push(`${overrideDeferred.length} additional GP friend${overrideDeferred.length !== 1 ? 's' : ''} will NOT be touched this batch (cap=${MAX_OVERRIDE_BATCH}). Re-run to continue.`)
    }

    if (totalRemovable === 0) {
      setError(
        `Nothing to remove. ${partitions.hardBlocked.length} hard-protected (use single-delete per friend), ` +
        `${skippedFavorites.length} favorites kept.`
      )
      return
    }

    const confirmed = await confirm({
      title: 'Remove all friends',
      body: (
        <ConfirmationSummary
          outcome={`Remove ${totalRemovable} friend${totalRemovable !== 1 ? 's' : ''}`}
          willHappen={willHappen}
          willNotHappen={willNot}
          risk={overrideEligible.length > 0
            ? (highValueCount > 0
                ? `${highValueCount} high-value GodPack friend${highValueCount !== 1 ? 's' : ''} (4/5 or 5/5) included. This cannot be undone.`
                : `GodPack friends will be removed by explicit manual override (treated like one-by-one delete, not bulk). This cannot be undone.`)
            : 'This cannot be undone.'}
          riskTitle={highValueCount > 0
            ? '⚠️ HIGH-VALUE GodPack friends (4/5 / 5/5) included'
            : (overrideEligible.length > 0
                ? 'Manual override required for GP friends'
                : 'Permanent action')}
          meta={`Estimated time: ${timeEstimate}`}
        />
      ),
      confirmText: overrideEligible.length > 0
        ? `Remove ${totalRemovable} (${overrideEligible.length} via override)`
        : `Remove ${totalRemovable}`,
      confirmColor: 'error',
      variant: overrideEligible.length > 0 ? 'danger' : 'warning',
    })
    if (!confirmed) return

    // High-value second-confirm — matches handleDeleteSelected
    if (highValueCount > 0) {
      const hvBreakdown = []
      if (tierBreakdown.t4 > 0) hvBreakdown.push(`${tierBreakdown.t4} × 4/5`)
      if (tierBreakdown.t5 > 0) hvBreakdown.push(`${tierBreakdown.t5} × 5/5`)
      const highValueConfirmed = await confirm({
        title: '⚠️ Remove HIGH-VALUE GodPack friends?',
        message:
          `You are removing high-value GodPack friends (4/5 or 5/5): ${hvBreakdown.join(', ')}.\n\n` +
          `This will permanently revoke your access to these god packs.\n` +
          `This cannot be undone.\n\n` +
          `Each will be removed via explicit per-friend manual override.`,
        confirmText: `Yes, remove ${highValueCount} high-value GP friend${highValueCount !== 1 ? 's' : ''}`,
        cancelText: 'Cancel',
        confirmColor: 'error',
        variant: 'danger',
        requireCheckbox: 'I understand this removes access to 4/5 or 5/5 god packs permanently',
      })
      if (!highValueConfirmed) {
        console.log(`[REMOVE_ALL_BLOCKED] high-value second-confirm cancelled by user — ${highValueCount} hv friend(s) NOT removed`)
        return
      }
    }

    setActionLoading(prev => ({ ...prev, removeAll: true }))
    setError('')
    setSuccess('')
    setPurgeProgress({ phase: 'started', total: totalRemovable, removed: 0, failed: 0 })

    let normalSucceeded = 0
    let overrideRemoved = 0
    let overrideFailed = 0

    try {
      if (partitions.normal.length > 0) {
        try {
          await friendsApi.bulkRemoveGameFriends(selectedAccountId, partitions.normal, { source: 'manual_bulk' })
          normalSucceeded = partitions.normal.length
        } catch (err) {
          setError(`Failed to start bulk removal: ${err.message}`)
        }
      }

      if (overrideEligible.length > 0) {
        const seqResult = await runSequentialOverride(
          friendsApi,
          selectedAccountId,
          overrideEligible,
          { overrideReason: 'remove_all_multi_override', logPrefix: '[REMOVE_ALL_OVERRIDE]' }
        )
        overrideRemoved = seqResult.overrideRemoved
        overrideFailed = seqResult.overrideFailed
      }

      // Honest toast (mirrors handleDeleteSelected)
      const summaryParts = []
      const totalRemovedNow = normalSucceeded + overrideRemoved
      summaryParts.push(`Removed ${totalRemovedNow}.`)
      if (overrideRemoved > 0) summaryParts.push(`${overrideRemoved} via manual override.`)
      if (overrideFailed > 0) summaryParts.push(`${overrideFailed} override attempt${overrideFailed !== 1 ? 's' : ''} failed.`)
      if (partitions.hardBlocked.length > 0) {
        summaryParts.push(`${partitions.hardBlocked.length} friend${partitions.hardBlocked.length !== 1 ? 's' : ''} are protected by system safety rules and cannot be bulk removed.`)
      }
      if (overrideCapped) {
        summaryParts.push(`${overrideDeferred.length} additional GP friend${overrideDeferred.length !== 1 ? 's' : ''} deferred (batch cap=${MAX_OVERRIDE_BATCH}). Re-run to remove.`)
      }
      if (totalRemovedNow === 0 && overrideFailed === 0 && partitions.hardBlocked.length === 0) {
        setError('No friends removed.')
      } else {
        setSuccess(summaryParts.join(' '))
      }
    } catch (err) {
      setError(`Failed to start bulk removal: ${err.message}`)
    } finally {
      setActionLoading(prev => ({ ...prev, removeAll: false }))
      if (overrideEligible.length > 0 && partitions.normal.length === 0) {
        setPurgeProgress(null)
        loadGameFriends()
      }
    }
  }

  // Toggle select mode
  const handleToggleSelectMode = () => {
    if (selectMode) {
      setSelectedFriends(new Set())
      setDeleteSelectedProgress(null)
    }
    setSelectMode(!selectMode)
  }

  const handleToggleFriendSelect = (playerId) => {
    setSelectedFriends(prev => {
      const next = new Set(prev)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedFriends(new Set(filteredFriends.map(f => f.playerId)))
  }

  const handleDeselectAll = () => {
    setSelectedFriends(new Set())
  }

  const handleDeleteSelected = async () => {
    if (!removalEnabled) { setError(removalReason || 'Friend removal is temporarily disabled.'); return }
    if (!selectedAccountId || selectedFriends.size === 0) return

    // Fetch favorites first to protect them — abort if this fails
    let favoritePlayerIds = []
    try {
      const favResult = await friendsApi.getGameFavorites(selectedAccountId)
      favoritePlayerIds = favResult.favoritePlayerIds || []
    } catch (favErr) {
      setError('Cannot verify favorites — friend removal blocked for safety. Try again later.')
      return
    }

    const favSet = new Set(favoritePlayerIds)
    const playerIds = [...selectedFriends]
    const toRemove = playerIds.filter(id => !favSet.has(id))
    const skippedFavs = playerIds.filter(id => favSet.has(id))

    // Phase v3.3 (May 14 2026) — partition via shared helper. Same
    // semantics as v3.2 inline logic but now reused across all 3 bulk-
    // remove handlers (handleDeleteSelected, handleRemoveAllBots,
    // handleRemoveAllExceptGodpacks) so they cannot diverge.
    const _p = partitionFriendsForRemoval(toRemove, godPackMap);
    const partitions       = _p.partitions;
    const tierBreakdown    = _p.tierBreakdown;
    const overrideCapped   = _p.overrideCapped;
    const overrideEligible = _p.overrideEligible;
    const overrideDeferred = _p.overrideDeferred;
    const highValueCount   = _p.highValueCount;
    const lowTierCount     = _p.lowTierCount;

    // Build detailed removal/keep lists
    const unselectedCount = friendsList.length - playerIds.length
    const totalRemovable = partitions.normal.length + overrideEligible.length
    const timeEstimate = formatTimeEstimate(totalRemovable)
    const willHappenLines = []
    if (partitions.normal.length > 0) {
      willHappenLines.push(`${partitions.normal.length} regular friend${partitions.normal.length !== 1 ? 's' : ''} will be removed in a batch`)
    }
    if (overrideEligible.length > 0) {
      const tierParts = []
      if (lowTierCount > 0) tierParts.push(`${lowTierCount} low-tier (1/5–3/5)`)
      if (highValueCount > 0) tierParts.push(`${highValueCount} high-value (4/5–5/5)`)
      willHappenLines.push(
        `${overrideEligible.length} GodPack friend${overrideEligible.length !== 1 ? 's' : ''} will be removed one-by-one with manual override` +
        (tierParts.length ? ` — ${tierParts.join(', ')}` : '')
      )
    }
    const willNotLines = []
    if (skippedFavs.length > 0) {
      willNotLines.push(`${skippedFavs.length} favorite${skippedFavs.length !== 1 ? 's' : ''} in your selection will be kept`)
    }
    if (partitions.hardBlocked.length > 0) {
      const hbParts = []
      if (tierBreakdown.pseudo > 0) hbParts.push(`${tierBreakdown.pseudo} pseudo high-value`)
      if (tierBreakdown.anomaly > 0) hbParts.push(`${tierBreakdown.anomaly} anomaly (unknown tier)`)
      // Phase v3.2 (May 14 2026) — user-required phrasing for system-safety blocks.
      willNotLines.push(
        `${partitions.hardBlocked.length} friend${partitions.hardBlocked.length !== 1 ? 's' : ''} are protected by system safety rules and cannot be bulk removed` +
        (hbParts.length ? ` (${hbParts.join(', ')})` : '')
      )
    }
    if (overrideCapped) {
      willNotLines.push(`${overrideDeferred.length} additional GP friend${overrideDeferred.length !== 1 ? 's' : ''} will NOT be touched this batch (cap=${MAX_OVERRIDE_BATCH}). Re-select to continue.`)
    }
    if (unselectedCount > 0) {
      willNotLines.push(`${unselectedCount} unselected friend${unselectedCount !== 1 ? 's' : ''} will not be touched`)
    }

    if (totalRemovable === 0) {
      setError(
        `Nothing to remove. ${partitions.hardBlocked.length} hard-protected (use single-delete per friend), ` +
        `${skippedFavs.length} favorites kept.`
      )
      return
    }

    const confirmed = await confirm({
      title: 'Remove selected friends',
      body: (
        <ConfirmationSummary
          outcome={`Remove ${totalRemovable} friend${totalRemovable !== 1 ? 's' : ''}`}
          willHappen={willHappenLines}
          willNotHappen={willNotLines}
          risk={overrideEligible.length > 0
            ? (highValueCount > 0
                ? `${highValueCount} high-value GodPack friend${highValueCount !== 1 ? 's' : ''} (4/5 or 5/5) included. This cannot be undone.`
                : `GodPack friends will be removed by explicit manual override (treated like one-by-one delete, not bulk). This cannot be undone.`)
            : 'This cannot be undone.'}
          riskTitle={highValueCount > 0
            ? '⚠️ HIGH-VALUE GodPack friends (4/5 / 5/5) included'
            : (overrideEligible.length > 0
                ? 'Manual override required for GP friends'
                : 'Permanent action')}
          meta={`Estimated time: ${timeEstimate}`}
        />
      ),
      confirmText: overrideEligible.length > 0
        ? `Remove ${totalRemovable} (${overrideEligible.length} via override)`
        : `Remove ${totalRemovable}`,
      confirmColor: 'error',
      variant: overrideEligible.length > 0 ? 'danger' : 'warning',
    })
    if (!confirmed) return

    // ── High-value second-confirm (4/5 or 5/5) ───────────────────────────
    // Phase v3.2 (May 14 2026) — when 4/5 / 5/5 GodPack friends are in
    // the selection, fire a SECOND mandatory confirmation with a strong
    // warning + checkbox. This matches the per-friend manual-single
    // checkbox behavior so the sequential override loop is not done
    // implicitly across high-value friends.
    if (highValueCount > 0) {
      const hvBreakdown = []
      if (tierBreakdown.t4 > 0) hvBreakdown.push(`${tierBreakdown.t4} × 4/5`)
      if (tierBreakdown.t5 > 0) hvBreakdown.push(`${tierBreakdown.t5} × 5/5`)
      const highValueConfirmed = await confirm({
        title: '⚠️ Remove HIGH-VALUE GodPack friends?',
        message:
          `You are removing high-value GodPack friends (4/5 or 5/5): ${hvBreakdown.join(', ')}.\n\n` +
          `This will permanently revoke your access to these god packs.\n` +
          `This cannot be undone.\n\n` +
          `Each will be removed via explicit per-friend manual override.`,
        confirmText: `Yes, remove ${highValueCount} high-value GP friend${highValueCount !== 1 ? 's' : ''}`,
        cancelText: 'Cancel',
        confirmColor: 'error',
        variant: 'danger',
        requireCheckbox: 'I understand this removes access to 4/5 or 5/5 god packs permanently',
      })
      if (!highValueConfirmed) {
        console.log(`[MANUAL_SELECTED_BLOCKED] high-value second-confirm cancelled by user — ${highValueCount} hv friend(s) NOT removed`)
        return
      }
    }

    setActionLoading(prev => ({ ...prev, deleteSelected: true }))
    setError('')
    setSuccess('')
    setPurgeProgress({ phase: 'started', total: totalRemovable, removed: 0, failed: 0 })

    let normalSucceeded = 0;
    let overrideRemoved = 0;
    let overrideFailed = 0;

    try {
      // Partition 1: normal friends → existing MANUAL_BULK path (conservative)
      if (partitions.normal.length > 0) {
        try {
          await friendsApi.bulkRemoveGameFriends(selectedAccountId, partitions.normal, { source: 'manual_bulk' })
          normalSucceeded = partitions.normal.length // best-effort; progress event will refine
        } catch (err) {
          setError(`Failed to start bulk removal: ${err.message}`)
          // continue to override phase regardless — operator may still want override path
        }
      }

      // Partition 2: protected-but-overrideable → sequential MANUAL_SINGLE with overrideProtected=true
      // Phase v3.3 — delegated to shared helper for consistency across all
      // 3 bulk-remove entry points. MANUAL_SINGLE override path applies
      // per-call (supports god_pack_tier_locked_by_mode via 4ea9f152).
      if (overrideEligible.length > 0) {
        const seqResult = await runSequentialOverride(
          friendsApi,
          selectedAccountId,
          overrideEligible,
          { overrideReason: 'user_selected_multi_override', logPrefix: '[MANUAL_SELECTED_OVERRIDE]' }
        )
        overrideRemoved = seqResult.overrideRemoved
        overrideFailed = seqResult.overrideFailed
      }

      setSelectedFriends(new Set())
      setSelectMode(false)

      // Compose explicit honest toast
      const summaryParts = []
      const totalRemovedNow = normalSucceeded + overrideRemoved
      summaryParts.push(`Removed ${totalRemovedNow}.`)
      if (overrideRemoved > 0) summaryParts.push(`${overrideRemoved} via manual override.`)
      if (overrideFailed > 0) summaryParts.push(`${overrideFailed} override attempt${overrideFailed !== 1 ? 's' : ''} failed.`)
      if (partitions.hardBlocked.length > 0) {
        // Phase v3.2 — user-required phrasing.
        summaryParts.push(`${partitions.hardBlocked.length} friend${partitions.hardBlocked.length !== 1 ? 's' : ''} are protected by system safety rules and cannot be bulk removed.`)
      }
      if (overrideCapped) {
        summaryParts.push(`${overrideDeferred.length} additional low-tier GP friend${overrideDeferred.length !== 1 ? 's' : ''} deferred (batch cap=${MAX_OVERRIDE_BATCH}). Re-select to remove.`)
      }
      if (totalRemovedNow === 0 && overrideFailed === 0 && partitions.hardBlocked.length === 0) {
        // Edge case: nothing actually attempted (e.g., empty after partition)
        setError('No friends removed.')
      } else {
        setSuccess(summaryParts.join(' '))
      }
    } catch (err) {
      setError(`Failed to start bulk removal: ${err.message}`)
      setActionLoading(prev => ({ ...prev, deleteSelected: false }))
      setPurgeProgress(null)
    } finally {
      setActionLoading(prev => ({ ...prev, deleteSelected: false }))
      // purgeProgress for the normal-bulk portion still settles via socket;
      // override portion is synchronous so we can clear local progress.
      if (overrideEligible.length > 0 && partitions.normal.length === 0) {
        setPurgeProgress(null)
        loadGameFriends()
      }
    }
  }

  // Remove all bots EXCEPT God Pack and/or Pseudo Pack accounts AND favorites
  const handleRemoveAllExceptGodpacks = async () => {
    if (!removalEnabled) { setError(removalReason || 'Friend removal is temporarily disabled.'); return }
    if (!selectedAccountId) return

    setActionLoading(prev => ({ ...prev, removeExceptGodpacks: true }))
    setError('')
    setSuccess('')

    try {
      // Fetch god pack player IDs and favorites in parallel — abort if favorites fail
      let godpackData, favData
      try {
        ;[godpackData, favData] = await Promise.all([
          friendsApi.getGodpackPlayerIds({ includePseudo: includePseudoInRemove }),
          friendsApi.getGameFavorites(selectedAccountId),
        ])
      } catch (fetchErr) {
        setError('Cannot verify favorites — friend removal blocked for safety. Try again later.')
        setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
        return
      }
      const godpackPlayerIds = new Set(godpackData.playerIds || [])
      const favoritePlayerIds = new Set(favData.favoritePlayerIds || [])
      const hours = godpackData.hours || 24
      const packTypeLabel = includePseudoInRemove ? 'god packs + pseudo packs' : 'god packs'

      // Build protected set (godpacks + favorites)
      const protectedSet = new Set([...godpackPlayerIds, ...favoritePlayerIds])

      // Find which friends to keep vs remove
      const toKeep = friendsList.filter(f => protectedSet.has(f.playerId))
      const toRemove = friendsList.filter(f => !protectedSet.has(f.playerId))
      const favoritesKept = friendsList.filter(f => favoritePlayerIds.has(f.playerId)).length

      if (toRemove.length === 0) {
        // Phase 5.7 — Decision Language: calmer phrasing matches the
        // "noneRemovable" headline used on the Smart Clear preview.
        setSuccess(`No friends can be safely removed right now — all ${friendsList.length} are protected`)
        setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
        return
      }

      const godpacksKept = friendsList.filter(f => godpackPlayerIds.has(f.playerId)).length

      // Phase v3.3 — partition the to-remove set (post-godpack-exclusion)
      // through the shared helper. godpackData already excludes recent
      // god-pack holders, but the local godPackMap may still flag pseudo
      // / anomaly rows that the backend didn't include in the hours window.
      // The partition catches those and routes them to the right policy.
      const toRemoveIds = toRemove.map(f => f.playerId)
      const _p = partitionFriendsForRemoval(toRemoveIds, godPackMap)
      const partitions       = _p.partitions
      const tierBreakdown    = _p.tierBreakdown
      const overrideCapped   = _p.overrideCapped
      const overrideEligible = _p.overrideEligible
      const overrideDeferred = _p.overrideDeferred
      const highValueCount   = _p.highValueCount
      const lowTierCount     = _p.lowTierCount
      const totalRemovable   = partitions.normal.length + overrideEligible.length

      const timeEstimate = formatTimeEstimate(totalRemovable)
      const willHappen = []
      if (partitions.normal.length > 0) {
        willHappen.push(`${partitions.normal.length} regular friend${partitions.normal.length !== 1 ? 's' : ''} will be removed in a batch`)
      }
      if (overrideEligible.length > 0) {
        const tierParts = []
        if (lowTierCount > 0) tierParts.push(`${lowTierCount} low-tier (1/5–3/5)`)
        if (highValueCount > 0) tierParts.push(`${highValueCount} high-value (4/5–5/5)`)
        willHappen.push(
          `${overrideEligible.length} GodPack friend${overrideEligible.length !== 1 ? 's' : ''} will be removed one-by-one with manual override` +
          (tierParts.length ? ` — ${tierParts.join(', ')}` : '')
        )
      }
      const willNot = []
      if (godpacksKept > 0) {
        willNot.push(`${godpacksKept} recent ${packTypeLabel} holder${godpacksKept !== 1 ? 's' : ''} (last ${hours}h) will be kept`)
      }
      if (favoritesKept > 0) {
        willNot.push(`${favoritesKept} favorite friend${favoritesKept !== 1 ? 's' : ''} will not be touched`)
      }
      if (partitions.hardBlocked.length > 0) {
        const hbParts = []
        if (tierBreakdown.pseudo > 0) hbParts.push(`${tierBreakdown.pseudo} pseudo high-value`)
        if (tierBreakdown.anomaly > 0) hbParts.push(`${tierBreakdown.anomaly} anomaly (unknown tier)`)
        willNot.push(
          `${partitions.hardBlocked.length} friend${partitions.hardBlocked.length !== 1 ? 's' : ''} are protected by system safety rules and cannot be bulk removed` +
          (hbParts.length ? ` (${hbParts.join(', ')})` : '')
        )
      }
      if (overrideCapped) {
        willNot.push(`${overrideDeferred.length} additional GP friend${overrideDeferred.length !== 1 ? 's' : ''} will NOT be touched this batch (cap=${MAX_OVERRIDE_BATCH}). Re-run to continue.`)
      }

      if (totalRemovable === 0) {
        setError(
          `Nothing to remove. ${partitions.hardBlocked.length} hard-protected (use single-delete per friend), ` +
          `${favoritesKept} favorites kept, ${godpacksKept} ${packTypeLabel} kept.`
        )
        setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
        return
      }

      const confirmed = await confirm({
        title: toKeep.length > 0
          ? `Remove ${totalRemovable} Friends?`
          : `Remove ALL ${totalRemovable} Friends?`,
        body: (
          <ConfirmationSummary
            outcome={`Remove ${totalRemovable} friend${totalRemovable !== 1 ? 's' : ''}`}
            willHappen={willHappen}
            willNotHappen={willNot}
            risk={overrideEligible.length > 0
              ? (highValueCount > 0
                  ? `${highValueCount} high-value GodPack friend${highValueCount !== 1 ? 's' : ''} (4/5 or 5/5) included. This cannot be undone.`
                  : `GodPack friends will be removed by explicit manual override (treated like one-by-one delete, not bulk). This cannot be undone.`)
              : 'This cannot be undone.'}
            riskTitle={highValueCount > 0
              ? '⚠️ HIGH-VALUE GodPack friends (4/5 / 5/5) included'
              : (overrideEligible.length > 0
                  ? 'Manual override required for GP friends'
                  : 'Permanent action')}
            meta={`Estimated time: ${timeEstimate}`}
          />
        ),
        confirmText: overrideEligible.length > 0
          ? `Remove ${totalRemovable} (${overrideEligible.length} via override)`
          : `Remove ${totalRemovable}`,
        confirmColor: 'error',
        variant: overrideEligible.length > 0 ? 'danger' : 'warning',
      })
      if (!confirmed) {
        setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
        return
      }

      // High-value second-confirm
      if (highValueCount > 0) {
        const hvBreakdown = []
        if (tierBreakdown.t4 > 0) hvBreakdown.push(`${tierBreakdown.t4} × 4/5`)
        if (tierBreakdown.t5 > 0) hvBreakdown.push(`${tierBreakdown.t5} × 5/5`)
        const highValueConfirmed = await confirm({
          title: '⚠️ Remove HIGH-VALUE GodPack friends?',
          message:
            `You are removing high-value GodPack friends (4/5 or 5/5): ${hvBreakdown.join(', ')}.\n\n` +
            `This will permanently revoke your access to these god packs.\n` +
            `This cannot be undone.\n\n` +
            `Each will be removed via explicit per-friend manual override.`,
          confirmText: `Yes, remove ${highValueCount} high-value GP friend${highValueCount !== 1 ? 's' : ''}`,
          cancelText: 'Cancel',
          confirmColor: 'error',
          variant: 'danger',
          requireCheckbox: 'I understand this removes access to 4/5 or 5/5 god packs permanently',
        })
        if (!highValueConfirmed) {
          console.log(`[REMOVE_EXCEPT_GP_BLOCKED] high-value second-confirm cancelled — ${highValueCount} hv friend(s) NOT removed`)
          setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
          return
        }
      }

      setPurgeProgress({ phase: 'started', total: totalRemovable, removed: 0, failed: 0 })

      let normalSucceeded = 0
      let overrideRemoved = 0
      let overrideFailed = 0

      try {
        if (partitions.normal.length > 0) {
          try {
            await friendsApi.bulkRemoveGameFriends(selectedAccountId, partitions.normal, { source: 'manual_bulk' })
            normalSucceeded = partitions.normal.length
          } catch (err) {
            setError(`Failed to start bulk removal: ${err.message}`)
          }
        }

        if (overrideEligible.length > 0) {
          const seqResult = await runSequentialOverride(
            friendsApi,
            selectedAccountId,
            overrideEligible,
            { overrideReason: 'remove_except_gp_multi_override', logPrefix: '[REMOVE_EXCEPT_GP_OVERRIDE]' }
          )
          overrideRemoved = seqResult.overrideRemoved
          overrideFailed = seqResult.overrideFailed
        }

        const summaryParts = []
        const totalRemovedNow = normalSucceeded + overrideRemoved
        summaryParts.push(`Removed ${totalRemovedNow}.`)
        if (overrideRemoved > 0) summaryParts.push(`${overrideRemoved} via manual override.`)
        if (overrideFailed > 0) summaryParts.push(`${overrideFailed} override attempt${overrideFailed !== 1 ? 's' : ''} failed.`)
        if (partitions.hardBlocked.length > 0) {
          summaryParts.push(`${partitions.hardBlocked.length} friend${partitions.hardBlocked.length !== 1 ? 's' : ''} are protected by system safety rules and cannot be bulk removed.`)
        }
        if (overrideCapped) {
          summaryParts.push(`${overrideDeferred.length} additional GP friend${overrideDeferred.length !== 1 ? 's' : ''} deferred (batch cap=${MAX_OVERRIDE_BATCH}). Re-run to remove.`)
        }
        if (totalRemovedNow === 0 && overrideFailed === 0 && partitions.hardBlocked.length === 0) {
          setError('No friends removed.')
        } else {
          setSuccess(summaryParts.join(' '))
        }
      } catch (err) {
        setError(`Failed to start bulk removal: ${err.message}`)
        setPurgeProgress(null)
      } finally {
        setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
        if (overrideEligible.length > 0 && partitions.normal.length === 0) {
          setPurgeProgress(null)
          loadGameFriends()
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch pack data')
      setActionLoading(prev => ({ ...prev, removeExceptGodpacks: false }))
    }
  }

  // Smart Clear - Remove friends based on configured filters
  // PART C — fetches backend preview without removing anything.
  // Sets smartClearPreview state for UI to render. Always safe to call.
  const handleSmartClearPreview = async () => {
    if (!selectedAccountId || friendsList.length === 0) return
    setSmartClearPreviewLoading(true)
    setSmartClearPreviewError('')
    setSmartClearPreview(null)
    setSmartClearPreviewFavoritesUsed(null)

    try {
      // Fetch game-side favorites (caller-supplied to evaluator) when filter on
      let gameFavoritePlayerIds = null
      if (smartClearConfig.protectFavorites) {
        try {
          const favResult = await friendsApi.getGameFavorites(selectedAccountId)
          gameFavoritePlayerIds = favResult.favoritePlayerIds || []
        } catch (favErr) {
          // Leave null → backend will fail-closed for those friends
          console.warn('[SmartClear] favorites fetch failed:', favErr.message)
        }
      }

      const filters = {
        favorites: !!smartClearConfig.protectFavorites,
        wishlist: !!smartClearConfig.protectWishlist,
        needed: !!smartClearConfig.protectNeeded,
        highValue: !!(smartClearConfig.filterByStar || smartClearConfig.protectHighValue),
      }

      const friendList = friendsList.map(f => ({
        playerId: f.playerId,
        playerName: f.playerName || null,
      }))

      const preview = await friendsApi.smartClearPreview(selectedAccountId, {
        friendList, gameFavoritePlayerIds, filters,
        // Phase v3 — propagate the user's chosen GP tier cleanup mode.
        // Server clamps to [0..3] and echoes selectedMaxTier in the response.
        gpClearMaxTier,
      })
      setSmartClearPreview(preview)
      // Phase WP-FixD3 — snapshot the favorites used for this preview
      // so Confirm Removal sends the SAME data to the server.
      setSmartClearPreviewFavoritesUsed(gameFavoritePlayerIds)
    } catch (e) {
      // Phase v3.2.1 (May 14 2026) — surface structured errorDetail. The
      // route returns { error: 'Preview failed', message: err.message,
      // errorDetail: { name, code, message } }. fetchWithAuth in api.js
      // throws `new Error(errorData.error || errorData.message)` and
      // attaches the full body as `err._responseData` (Phase v3.2.1
      // addition). Read `_responseData.errorDetail` first; fall back to
      // `_responseData.message` (server's real err.message); fall back to
      // `e.message` ONLY if it isn't the generic "Preview failed" prefix
      // (which would cause "Preview failed: Preview failed").
      let detailMsg = null
      const rd = e && e._responseData
      if (rd && rd.errorDetail) {
        const d = rd.errorDetail
        detailMsg = `${d.name || 'Error'}${d.code ? ` (${d.code})` : ''}: ${d.message || 'unknown'}`
      } else if (rd && rd.message && rd.message !== 'Preview failed') {
        // route returned a distinct message (e.g. specific err.message text)
        detailMsg = rd.message
      } else if (e && e.message && e.message !== 'Preview failed') {
        detailMsg = e.message
      } else if (e && e._status) {
        detailMsg = `HTTP ${e._status} (no detail returned by server)`
      } else {
        detailMsg = 'unknown server error'
      }
      setSmartClearPreviewError(`Preview failed: ${detailMsg}`)
    } finally {
      setSmartClearPreviewLoading(false)
    }
  }

  // Phase WP-FixD (Apr 2026) — Smart Clear confirm sends preview-vetted ids.
  // Phase WP-FixD3 (Apr 2026) — confirm declares source='smart_clear';
  //   server recomputes confidence and rejects forged/stale ids.
  // Phase WP-FixD4 (Apr 2026) — when smartClearAcceptMedium is ON, the
  //   request includes MEDIUM_SAFE ids AND tells the server
  //   acceptMediumSafe=true. Server still revalidates and refuses any
  //   BLOCKED_UNKNOWN id; HIGH_SAFE always admitted.
  const handleSmartClear = async () => {
    if (!removalEnabled) {
      setError(removalReason || 'Friend removal is temporarily disabled.')
      setSmartClearOpen(false)
      return
    }
    if (!smartClearPreview || !smartClearPreview.canProceed) {
      setError('Cannot remove — preview not generated or removal blocked.')
      return
    }
    if (!selectedAccountId) return

    const groups = smartClearPreview.friendsByConfidence || {}
    const highSafe = groups.HIGH_SAFE || []
    const mediumSafe = groups.MEDIUM_SAFE || []
    const includeMedium = !!smartClearAcceptMedium
    const ids = includeMedium
      ? [...highSafe.map(f => f.playerId), ...mediumSafe.map(f => f.playerId)]
      : highSafe.map(f => f.playerId)

    if (ids.length === 0) {
      // Phase 5.1 — outcome-focused empty-state copy. No internal flags.
      setError(includeMedium
        ? 'No removable friends found. Try widening filters.'
        : 'No fully verified friends. Toggle "Include partial-confidence" to include medium-confidence matches.')
      return
    }

    setSmartClearing(true)
    setSmartClearProgress({ current: 0, total: ids.length, kept: 0, removed: 0 })
    setError('')

    try {
      const summary = smartClearPreview.summary || {}
      // Phase v3.1 — authoritative counts from execution-parity helper.
      // These match exactly what the bulk-remove handler will accept.
      // Falls back to legacy counts if server is on an older revision so
      // the modal still works during a partial rollout.
      const eligibleCount = includeMedium
        ? (summary.eligibleWithRiskAcceptCount ?? ids.length)
        : (summary.eligibleNowCount ?? highSafe.length)
      const protectedN = summary.protectedCount ?? summary.blockedUnknownCount ?? 0
      const timeEstimate = formatTimeEstimate(eligibleCount)

      // Phase v3.1 — confirmation copy keyed on execution-parity counts.
      // Promised count (eligible) and skipped count (protected) are
      // displayed prominently so the user cannot be surprised by
      // post-execution drop.
      const willHappen = [
        `${eligibleCount} friends eligible for removal`,
      ]
      if (gpClearMaxTier > 0) {
        willHappen.push(
          `GP cleanup mode active: friends whose only GodPack protection is at tier ≤ ${gpClearMaxTier}/5 are eligible for removal`
        )
      }
      const willNotHappen = []
      if (protectedN > 0) {
        willNotHappen.push(`${protectedN} protected friends will be skipped`)
      }
      if (!includeMedium && (summary.mediumSafeCount ?? 0) > 0) {
        willNotHappen.push(`${summary.mediumSafeCount} medium-confidence friends will not be touched`)
      }
      // Phase v3 — always remind the user that 4/5 and 5/5 are permanently
      // protected from Smart Clear bulk removal regardless of selected mode.
      willNotHappen.push('4/5 and 5/5 GodPack friends are NOT bulk-removable (use manual single-delete from the friend list)')

      const risk = (includeMedium && mediumSafe.length > 0)
        ? 'Some checks (wishlist, high-value cards) may not be fully verified for medium-confidence friends.'
        : null
      const riskTitle = risk ? 'Some removals are based on medium-confidence signals' : null

      const confirmed = await confirm({
        title: 'Smart Clear',
        body: (
          <ConfirmationSummary
            outcome={`Remove ${eligibleCount} friends`}
            willHappen={willHappen}
            willNotHappen={willNotHappen}
            risk={risk}
            riskTitle={riskTitle}
            meta={`Estimated time: ${timeEstimate}`}
          />
        ),
        confirmText: `Remove ${eligibleCount}`,
        confirmColor: 'error',
        variant: 'danger',
      })
      if (!confirmed) {
        setSmartClearing(false)
        return
      }

      setPurgeProgress({ phase: 'started', total: ids.length, removed: 0, failed: 0 })
      setSmartClearOpen(false)
      try {
        await friendsApi.bulkRemoveGameFriends(selectedAccountId, ids, {
          source: 'smart_clear',
          filters: smartClearPreview.filters || {},
          gameFavoritePlayerIds: smartClearPreviewFavoritesUsed,
          acceptMediumSafe: includeMedium,
          // Phase v3 — pass the SAME mode that was used to generate the
          // preview. Sending a deeper mode here than was previewed would
          // be a UX contract violation; the server will re-clamp + the
          // evaluator will reclassify regardless.
          gpClearMaxTier,
        })
      } catch (err) {
        setError(`Failed to start Smart Clear bulk removal: ${err.message}`)
        setSmartClearing(false)
        setPurgeProgress(null)
      }
    } catch (err) {
      setError(err.message || 'Smart Clear failed')
      setSmartClearing(false)
    }
  }

  // Open gift modal for a friend
  const handleOpenGiftModal = async (friend) => {
    setSelectedFriend(friend)
    setSelectedCard(null)
    setCardSearchQuery('')
    setGiftDialogOpen(true)
    setLoadingCards(true)
    setError('')

    try {
      const result = await giveCardApi.getEligibleCards(selectedAccountId)
      setEligibleCards(result.cards || [])
    } catch (err) {
      setError(err.message || 'Failed to load eligible cards')
      setEligibleCards([])
    } finally {
      setLoadingCards(false)
    }
  }

  // Close gift modal
  const handleCloseGiftModal = () => {
    setGiftDialogOpen(false)
    setSelectedFriend(null)
    setSelectedCard(null)
    setEligibleCards([])
    setCardSearchQuery('')
  }

  // Send card gift
  const handleSendGift = async () => {
    if (!selectedCard || !selectedFriend || !selectedAccountId) return

    setSendingGift(true)
    setError('')

    try {
      await giveCardApi.sendCard(selectedAccountId, {
        friendPlayerId: selectedFriend.playerId,
        cardId: selectedCard.backend_id || selectedCard.card_id,
        expansionId: selectedCard.set_code,
        lang: 'en',
      })
      setSuccess(`Card "${selectedCard.card_name}" sent to ${selectedFriend.playerName}!`)
      handleCloseGiftModal()
    } catch (err) {
      setError(err.message || 'Failed to send gift')
    } finally {
      setSendingGift(false)
    }
  }

  // Filter eligible cards by search
  const filteredEligibleCards = eligibleCards.filter(card => {
    if (!cardSearchQuery) return true
    const query = cardSearchQuery.toLowerCase()
    return (
      card.card_name?.toLowerCase().includes(query) ||
      card.backend_id?.toLowerCase().includes(query) ||
      card.set_code?.toLowerCase().includes(query)
    )
  })

  // Card image URL helper
  const getCardImageUrl = (cardId) => {
    return `/api/cards/${cardId}/image?v=5`
  }

  // Filter friends by debounced search
  // Compute sort key for each friend: [category, quality, recency, name]
  // Category: 0=live GP, 1=dead/pending GP, 2=favorite, 3=normal
  // Quality: higher = better (5=5/5, 4=4/5, 3=3/5, 0=unknown)
  // Recency: newer discoveredAt = higher
  const getFriendSortKey = useCallback((friend) => {
    const packs = godPackMap[friend.playerId]
    const isFav = favoritePlayerIds.has(friend.playerId)
    if (packs && packs.length > 0) {
      const sortKey = getGPSortKey(packs)
      return { ...sortKey, name: friend.playerName || '' }
    }
    return {
      category: isFav ? 2 : 3,
      quality: 0,
      recency: 0,
      name: friend.playerName || '',
    }
  }, [godPackMap, favoritePlayerIds])

  const filteredFriends = useMemo(() => {
    let list = [...friendsList]
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      list = list.filter(f =>
        f.playerId?.toLowerCase().includes(searchLower) ||
        f.playerName?.toLowerCase().includes(searchLower) ||
        f.friendCode?.toLowerCase().includes(searchLower)
      )
    }
    // Sort by priority: live GP (highest quality first) → dead GP → favorites → normal
    list.sort((a, b) => {
      const ka = getFriendSortKey(a)
      const kb = getFriendSortKey(b)
      if (ka.category !== kb.category) return ka.category - kb.category
      if (ka.quality !== kb.quality) return kb.quality - ka.quality // higher quality first
      if (ka.recency !== kb.recency) return kb.recency - ka.recency // newer first
      return ka.name.localeCompare(kb.name)
    })
    return list
  }, [friendsList, debouncedSearch, getFriendSortKey])

  // Reset page when filters change
  useEffect(() => { setFriendsPage(1) }, [debouncedSearch])

  const friendsTotalPages = Math.ceil(filteredFriends.length / FRIENDS_PER_PAGE)
  const paginatedFriends = filteredFriends.slice((friendsPage - 1) * FRIENDS_PER_PAGE, friendsPage * FRIENDS_PER_PAGE)

  if (loadingAccounts) {
    return <TablePageSkeleton />
  }

  if (accounts.length === 0) {
    return (
      <FadeIn>
        <EmptyState
          icon={<PeopleIcon sx={{ fontSize: 64 }} />}
          title={t('friends.noAccounts')}
          description={t('friends.linkAccountFirst')}
          action={
            <Button variant="contained" href="/accounts" sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` }}>
              {t('friends.linkAccount')}
            </Button>
          }
        />
      </FadeIn>
    )
  }

  return (
    <FadeIn>
    <Box>
      {/* ── SAFETY GATE BANNER (Apr 2026) ──────────────────────────────
          Shown when backend reports FRIEND_REMOVAL_ENABLED=false.
          All delete buttons are disabled while this banner is visible. */}
      {!removalEnabled && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ mb: 2, fontWeight: 500 }}
          icon={<WarningIcon />}
        >
          <strong>Friend removal is temporarily disabled</strong><br/>
          {removalReason || 'Friend removal is paused while protection filters are being verified. Viewing/searching/accepting friends still works.'}
        </Alert>
      )}
      {/* ── Header ──────────────────────────────────────────────── */}
      <PageHeader
        icon={<PeopleIcon />}
        title="Friends"
        subtitle={t('friends.searchPlaceholder')}
        chips={[
          { label: `${friendsList.length}/99 friends`, color: theme.palette.primary.main },
          ...(receivedRequests.length > 0 ? [{ label: `${receivedRequests.length} pending`, color: theme.palette.warning.main }] : []),
        ]}
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder={t('friends.searchPlaceholder')}
              value={search}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 180 } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{t('friends.selectAccount')}</InputLabel>
              <Select
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                label={t('friends.selectAccount')}
              >
                {accounts.map(acc => (
                  <MenuItem key={acc.id} value={acc.id}>
                    {acc.nickname || acc.player_name || acc.device_account?.substring(0, 20)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        }
      />

      {/* ── Action Bar: Icon buttons with tooltips ─────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap',
        position: 'sticky', top: { xs: 120, sm: 128 }, zIndex: 10,
        py: 1, mx: -1.5, px: 1.5,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,17,23,0.85)' : 'rgba(245,247,250,0.85)',
        backdropFilter: 'blur(8px)',
        borderRadius: '8px',
      }}>
        <Tooltip title={t('friends.refreshFriend')}>
          <IconButton
            onClick={loadGameFriends}
            disabled={loading || !selectedAccountId}
            sx={{
              minWidth: 44, minHeight: 44,
              bgcolor: `${theme.palette.primary.main}12`,
              color: theme.palette.primary.main,
              border: `1px solid ${theme.palette.primary.main}25`,
              '&:hover': { bgcolor: `${theme.palette.primary.main}22`, borderColor: `${theme.palette.primary.main}50` },
            }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title={t('friends.removeAllBots')}>
          <IconButton
            onClick={handleRemoveAllBots}
            disabled={loading || actionLoading.removeAll || purgeProgress || friendsList.length === 0}
            sx={{
              minWidth: 44, minHeight: 44,
              bgcolor: `${theme.palette.error.main}12`,
              color: theme.palette.error.main,
              border: `1px solid ${theme.palette.error.main}25`,
              '&:hover': { bgcolor: `${theme.palette.error.main}22`, borderColor: `${theme.palette.error.main}50` },
            }}
          >
            {actionLoading.removeAll ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
          </IconButton>
        </Tooltip>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={includePseudoInRemove ? t('friends.removeExceptPacks') || 'Keep GP + Pseudo' : t('friends.removeExceptGodpacks')}>
            <IconButton
              onClick={handleRemoveAllExceptGodpacks}
              disabled={!removalEnabled || loading || actionLoading.removeExceptGodpacks || purgeProgress || friendsList.length === 0}
              sx={{
                minWidth: 44, minHeight: 44,
                bgcolor: `${theme.palette.warning.main}12`,
                color: theme.palette.warning.main,
                border: `1px solid ${theme.palette.warning.main}25`,
                '&:hover': { bgcolor: `${theme.palette.warning.main}22`, borderColor: `${theme.palette.warning.main}50` },
              }}
            >
              {actionLoading.removeExceptGodpacks ? <CircularProgress size={20} color="inherit" /> : <GodPackIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={includePseudoInRemove ? 'Keeping pseudo pack finders too' : 'Only keeping god pack finders'}>
            <Switch
              size="small"
              checked={includePseudoInRemove}
              onChange={(e) => setIncludePseudoInRemove(e.target.checked)}
              disabled={actionLoading.removeExceptGodpacks}
            />
          </Tooltip>
        </Box>

        <Tooltip title={!removalEnabled ? 'Friend removal disabled — see banner' : (t('friends.smartClear') || 'Smart Clear')}>
          <span>{/* span needed for Tooltip on disabled button */}
          <IconButton
            onClick={() => {
              // Phase WP-FixC — reset stale preview when reopening modal
              // Phase WP-FixD4 — also reset risk-accept toggle
              setSmartClearPreview(null)
              setSmartClearPreviewError('')
              setSmartClearAcceptMedium(false)
              setSmartClearOpen(true)
            }}
            disabled={!removalEnabled || loading || smartClearing || purgeProgress || friendsList.length === 0}
            sx={{
              minWidth: 44, minHeight: 44,
              bgcolor: `${theme.palette.info.main}12`,
              color: theme.palette.info.main,
              border: `1px solid ${theme.palette.info.main}25`,
              '&:hover': { bgcolor: `${theme.palette.info.main}22`, borderColor: `${theme.palette.info.main}50` },
            }}
          >
            {smartClearing ? <CircularProgress size={20} color="inherit" /> : <FilterIcon />}
          </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={selectMode ? 'Exit select mode' : 'Select friends'}>
          <IconButton
            onClick={handleToggleSelectMode}
            disabled={loading || friendsList.length === 0}
            sx={{
              minWidth: 44, minHeight: 44,
              bgcolor: selectMode ? `${theme.palette.primary.main}20` : 'transparent',
              color: selectMode ? theme.palette.primary.main : 'text.secondary',
              border: `1px solid ${selectMode ? theme.palette.primary.main + '40' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              '&:hover': { bgcolor: selectMode ? `${theme.palette.primary.main}30` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') },
            }}
          >
            <SelectIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Server-side bulk removal progress */}
      {purgeProgress && purgeProgress.phase !== 'complete' && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          icon={<CircularProgress size={20} />}
        >
          <Typography variant="body2">
            <strong>Removing friends on server...</strong>{' '}
            {purgeProgress.removed || 0} / {purgeProgress.total || '?'} removed
            {purgeProgress.failed > 0 && ` (${purgeProgress.failed} failed)`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            You can safely close this page — removal continues in the background.
          </Typography>
        </Alert>
      )}

      {/* ── Tabs with notification dots ──────────────────────────── */}
      {/* 2026-04-20 Phase 6B — sticky tab bar so context persists while scrolling long friend lists. */}
      <GlassCard noPadding sx={{
        mb: 2,
        position: 'sticky', top: { xs: 184, sm: 192 }, zIndex: 9,
      }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minHeight: 48 },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon sx={{ fontSize: 18 }} />
                {t('friends.friends')} ({friendsList.length}/99)
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Badge
                  variant="dot"
                  invisible={receivedRequests.length === 0}
                  sx={{ '& .MuiBadge-dot': { bgcolor: theme.palette.error.main } }}
                >
                  <PersonAddIcon sx={{ fontSize: 18 }} />
                </Badge>
                {t('friends.pendingRequests')} ({receivedRequests.length})
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t('friends.sentRequestsTab')} ({sentRequests.length})
              </Box>
            }
          />
        </Tabs>
      </GlassCard>

      {/* Tab Content */}
      {loading ? (
        <GlassCard noPadding>
          <FriendListSkeleton rows={8} />
        </GlassCard>
      ) : (
        <>
          {/* Friends Tab */}
          {activeTab === 0 && (
            <GlassCard noPadding>
              {/* Select mode action bar */}
              {selectMode && filteredFriends.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mr: 1 }}>
                    {selectedFriends.size} selected
                  </Typography>
                  <Button size="small" variant="outlined" onClick={handleSelectAll} sx={{ textTransform: 'none' }}>
                    Select All ({filteredFriends.length})
                  </Button>
                  <Button size="small" variant="outlined" onClick={handleDeselectAll} disabled={selectedFriends.size === 0} sx={{ textTransform: 'none' }}>
                    Deselect All
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={handleDeleteSelected}
                    disabled={selectedFriends.size === 0 || actionLoading.deleteSelected}
                    startIcon={actionLoading.deleteSelected ? <CircularProgress size={14} color="inherit" /> : <PersonRemoveIcon />}
                    sx={{ textTransform: 'none', ml: 'auto' }}
                  >
                    {deleteSelectedProgress
                      ? `Removing ${deleteSelectedProgress.current}/${deleteSelectedProgress.total}...`
                      : `Remove ${selectedFriends.size} Selected`}
                  </Button>
                </Box>
              )}
              {filteredFriends.length === 0 ? (
                <EmptyState
                  icon={<PeopleIcon sx={{ fontSize: 64 }} />}
                  title={debouncedSearch ? t('friends.noFriendsMatching') : t('friends.noFriends')}
                  description={debouncedSearch ? `No friends matching "${debouncedSearch}". Try a different search term.` : 'Add friends to get started'}
                  minHeight={200}
                />
              ) : (
                <>
                <List sx={{ py: 0, overflowX: 'auto' }}>
                  {paginatedFriends.map((friend, index) => {
                    const isFav = favoritePlayerIds.has(friend.playerId)
                    const hasGodPack = !!godPackMap[friend.playerId]
                    return (
                    <Box key={friend.playerId}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          minHeight: { xs: 76, sm: 64 },
                          py: { xs: 1.25, sm: 1 },
                          px: { xs: 1.5, sm: 2 },
                          transition: 'background-color 0.15s',
                          bgcolor: selectMode && selectedFriends.has(friend.playerId) ? 'action.selected' : 'inherit',
                          cursor: selectMode ? 'pointer' : 'default',
                          // Bug #2 mobile-crowding fix (2026-04-19): keep
                          // primary content (name + badges) clear of the
                          // secondary action group so the inspect chip and
                          // the favorite IconButton can never be confused
                          // for one another on narrow screens. The padding
                          // is responsive — only on xs we reserve more
                          // horizontal room for the 3 right-side buttons.
                          '& .MuiListItemSecondaryAction-root': {
                            right: { xs: 8, sm: 16 },
                          },
                          '& .MuiListItemText-root': {
                            // Reserve right margin equal to the action
                            // group's worst-case width (3 × 44 + 2 × 8 gap
                            // ≈ 148 px on mobile; 0 on desktop where
                            // actions are hover-reveal).
                            marginRight: { xs: '152px', sm: 0 },
                          },
                          // Desktop: hover-reveal actions; Mobile: always visible
                          '& .friend-actions': {
                            opacity: isMobile ? 1 : 0,
                            transform: isMobile ? 'none' : 'translateX(8px)',
                            transition: 'opacity 0.15s ease, transform 0.15s ease',
                          },
                          '&:hover': {
                            bgcolor: 'action.hover',
                            '& .friend-actions': {
                              opacity: 1,
                              transform: 'translateX(0)',
                            },
                          },
                        }}
                        onClick={selectMode ? () => handleToggleFriendSelect(friend.playerId) : undefined}
                        secondaryAction={
                          selectMode ? null : (
                          <Box className="friend-actions" sx={{ display: 'flex', gap: { xs: 0, sm: 0.25 } }}>
                            <Tooltip title={isFav ? 'Remove from favorites' : 'Add to favorites'}>
                              <IconButton
                                onClick={() => handleToggleGameFavorite(friend.playerId)}
                                disabled={actionLoading[`fav_${friend.playerId}`]}
                                aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                sx={{
                                  minWidth: 44, minHeight: 44,
                                  p: { xs: 0.75, sm: 1 },
                                  color: isFav ? theme.palette.warning.main : 'text.disabled',
                                  '&:hover': { bgcolor: `${theme.palette.warning.main}15` },
                                }}
                              >
                                {actionLoading[`fav_${friend.playerId}`] ? (
                                  <CircularProgress size={18} />
                                ) : isFav ? (
                                  <StarIcon sx={{ fontSize: 20 }} />
                                ) : (
                                  <StarBorderIcon sx={{ fontSize: 20 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('friends.sendCardGift')}>
                              <IconButton
                                onClick={() => handleOpenGiftModal(friend)}
                                disabled={actionLoading[`gift_${friend.playerId}`]}
                                aria-label="Send card gift"
                                sx={{
                                  minWidth: 44, minHeight: 44,
                                  p: { xs: 0.75, sm: 1 },
                                  color: theme.palette.warning.main,
                                  '&:hover': { bgcolor: `${theme.palette.warning.main}15` },
                                }}
                              >
                                <GiftIcon sx={{ fontSize: 20 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('friends.removeFriend')}>
                              <IconButton
                                edge="end"
                                onClick={() => handleDeleteFriend(friend.playerId, friend.playerName)}
                                disabled={actionLoading[`del_${friend.playerId}`]}
                                aria-label="Remove friend"
                                sx={{
                                  minWidth: 44, minHeight: 44,
                                  p: { xs: 0.75, sm: 1 },
                                  color: 'error.main',
                                  '&:hover': { bgcolor: `${theme.palette.error.main}15` },
                                }}
                              >
                                {actionLoading[`del_${friend.playerId}`] ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <PersonRemoveIcon sx={{ fontSize: 20 }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Box>
                          )
                        }
                      >
                        {selectMode && (
                          <Checkbox
                            checked={selectedFriends.has(friend.playerId)}
                            onChange={() => handleToggleFriendSelect(friend.playerId)}
                            onClick={(e) => e.stopPropagation()}
                            sx={{ mr: 1 }}
                          />
                        )}
                        <ListItemAvatar>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.primary.main, fontSize: 15 }}>
                            {friend.playerName?.charAt(0)?.toUpperCase() || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              {isFav && (
                                <StarIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
                              )}
                              <Typography variant="body2" fontWeight={600}>
                                {friend.playerName || t('friends.unknown')}
                              </Typography>
                              {/* Status chips */}
                              {isFav && (
                                <Chip
                                  label="Favorite"
                                  size="small"
                                  sx={{
                                    height: 18, fontSize: '0.6rem', fontWeight: 600,
                                    bgcolor: `${theme.palette.warning.main}20`,
                                    color: theme.palette.warning.main,
                                  }}
                                />
                              )}
                              {hasGodPack && (() => {
                                const packs = godPackMap[friend.playerId]
                                // Canonical GP: ALL badges derived from ONE entry
                                const canonical = selectCanonicalGP(packs)
                                const badges = deriveBadges(canonical)
                                const hasWishlistMatch = packs.some(gp => gp.meetsWishlistThreshold !== false)
                                const starColor = hasWishlistMatch ? theme.palette.warning.main : theme.palette.text.secondary
                                // Phase 5.10 — compute the tier of the canonical
                                // pack ONLY when card data exists. Show a tiny
                                // tier chip ONLY for ultra / high tiers so the
                                // surface never shouts "Strong" on a routine
                                // godpack. Detection / removal logic untouched —
                                // this is a display chip only.
                                const canonicalCards = Array.isArray(canonical?.cards) ? canonical.cards : null
                                const tierResult = canonicalCards ? computeValueTier(canonicalCards) : null
                                const showTierChip = tierResult && (tierResult.tier === 'ultra' || tierResult.tier === 'high')
                                return (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.6, sm: 0.3 }, flexWrap: 'wrap' }}>
                                  {showTierChip && (
                                    <ValueTierChip
                                      tier={tierResult.tier}
                                      label={tierResult.label}
                                      size="tiny"
                                      showLabel={false}
                                    />
                                  )}
                                  {badges.isLive && (
                                    <Chip
                                      label="LIVE"
                                      size="small"
                                      sx={{
                                        height: { xs: 22, sm: 18 }, fontSize: { xs: '0.65rem', sm: '0.6rem' }, fontWeight: 700,
                                        bgcolor: `${theme.palette.success.main}20`,
                                        color: theme.palette.success.main,
                                      }}
                                    />
                                  )}
                                  {badges.quality != null && badges.quality > 0 && (
                                    <Chip
                                      label={`${badges.quality}/5`}
                                      size="small"
                                      sx={{
                                        height: { xs: 22, sm: 18 }, fontSize: { xs: '0.65rem', sm: '0.6rem' }, fontWeight: 700,
                                        bgcolor: badges.quality >= 5 ? `${theme.palette.warning.main}25` : badges.quality >= 4 ? `${theme.palette.info.main}20` : `${theme.palette.text.secondary}15`,
                                        color: badges.quality >= 5 ? theme.palette.warning.main : badges.quality >= 4 ? theme.palette.info.main : theme.palette.text.secondary,
                                      }}
                                    />
                                  )}
                                  {badges.packNumber != null && (
                                    <Chip
                                      label={`${badges.packNumber}P`}
                                      size="small"
                                      sx={{
                                        height: { xs: 22, sm: 18 }, fontSize: { xs: '0.65rem', sm: '0.6rem' }, fontWeight: 600,
                                        bgcolor: `${theme.palette.text.secondary}12`,
                                        color: theme.palette.text.secondary,
                                      }}
                                    />
                                  )}
                                  {/*
                                    Bug #3 tap-target fix (2026-04-19):
                                    inspect chip is interactive (onClick opens
                                    GP detail modal). Was h:20 — far below
                                    WCAG 44px min and easy to mis-tap into
                                    the row's favorite-toggle / select. On
                                    mobile bump to h:28 with extended hit
                                    area via ::before pseudo (visual stays
                                    compact, touch zone reaches ~44px).
                                  */}
                                  {/* Phase 5.7 finalize — tooltip uses
                                      Decision Language labels (Live /
                                      Awaiting confirmation / Expired)
                                      instead of ALL CAPS enum echoes.
                                      Inline fold avoids a hot-path
                                      module import inside the row map. */}
                                  <Tooltip title={`${packs.length} God Pack(s) · ${badges.isLive ? 'Live' : (() => { const s = String(badges.status || '').toUpperCase(); if (s === 'PICKED') return 'Awaiting confirmation'; if (s === 'EXPIRED') return 'Expired'; return s ? s[0] + s.slice(1).toLowerCase() : ''; })()}${badges.quality ? ` · ${badges.quality}/5` : ''}${badges.packNumber ? ` · Pack #${badges.packNumber}` : ''}${!hasWishlistMatch ? ' · no wishlist match' : ''} - Click for details`}>
                                    <Chip
                                      icon={<GodPackIcon sx={{ fontSize: { xs: 14, sm: 12 } }} />}
                                      label={packs.length}
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); setSelectedGodPackFriend(friend) }}
                                      sx={{
                                        height: { xs: 28, sm: 20 },
                                        minWidth: { xs: 44, sm: 'auto' },
                                        fontSize: { xs: '0.75rem', sm: '0.65rem' },
                                        bgcolor: `${starColor}30`,
                                        color: starColor,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        position: 'relative',
                                        '&:hover': { bgcolor: `${starColor}45` },
                                        '& .MuiChip-icon': { color: starColor },
                                        // Extend touch zone past visual bounds
                                        // on mobile only — meets WCAG 44px
                                        // without enlarging the painted chip.
                                        '&::before': {
                                          content: '""',
                                          position: 'absolute',
                                          top: '50%',
                                          left: '50%',
                                          transform: 'translate(-50%, -50%)',
                                          width: { xs: 44, sm: '100%' },
                                          height: { xs: 44, sm: '100%' },
                                        },
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                                )
                              })()}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                              {friend.playerId}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Box>
                    )
                  })}
                </List>
                {friendsTotalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {(friendsPage - 1) * FRIENDS_PER_PAGE + 1}–{Math.min(friendsPage * FRIENDS_PER_PAGE, filteredFriends.length)} of {filteredFriends.length}
                    </Typography>
                    <Pagination count={friendsTotalPages} page={friendsPage} onChange={(_, p) => setFriendsPage(p)} size="small" />
                  </Box>
                )}
              </>
              )}
            </GlassCard>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 1 && (
            <GlassCard noPadding>
              {receivedRequests.length === 0 ? (
                <EmptyState
                  icon={<PersonAddIcon sx={{ fontSize: 64 }} />}
                  title={t('friends.noPendingRequests')}
                  description="No pending friend requests at the moment"
                  minHeight={200}
                />
              ) : (
                <>
                  {/* Bulk accept/decline bar */}
                  {receivedRequests.length >= 2 && (
                    <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mr: 'auto' }}>
                        {receivedRequests.length} pending
                      </Typography>
                      <LoadingButton
                        loading={actionLoading.acceptAll}
                        size="small"
                        startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
                        onClick={handleAcceptAllRequests}
                        disabled={actionLoading.rejectAll}
                        sx={{ bgcolor: 'accent.main', color: '#fff', '&:hover': { bgcolor: 'accent.dark' }, textTransform: 'none', fontSize: '0.75rem', minHeight: 36 }}
                      >
                        Accept All
                      </LoadingButton>
                      <LoadingButton
                        loading={actionLoading.rejectAll}
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<CancelIcon sx={{ fontSize: 16 }} />}
                        onClick={handleRejectAllRequests}
                        disabled={actionLoading.acceptAll}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', minHeight: 36 }}
                      >
                        Decline All
                      </LoadingButton>
                    </Box>
                  )}
                  <List sx={{ py: 0, overflowX: 'auto' }}>
                  {receivedRequests.map((req, index) => {
                    // Urgency: time since received
                    const receivedAgo = req.created_at || req.receivedAt
                    let urgencyText = ''
                    if (receivedAgo) {
                      const diff = Math.floor((Date.now() - new Date(receivedAgo).getTime()) / 1000)
                      if (diff < 3600) urgencyText = `${Math.floor(diff / 60)}m ago`
                      else if (diff < 86400) urgencyText = `${Math.floor(diff / 3600)}h ago`
                      else urgencyText = `${Math.floor(diff / 86400)}d ago`
                    }
                    return (
                    <Box key={req.playerId}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          minHeight: 64,
                          py: 1,
                          px: { xs: 1.5, sm: 2 },
                          transition: 'background-color 0.15s',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {urgencyText && (
                              <Chip
                                label={urgencyText}
                                size="small"
                                sx={{
                                  height: 20, fontSize: '0.6rem',
                                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                  color: 'text.secondary',
                                  mr: 0.5,
                                }}
                              />
                            )}
                            <Tooltip title={t('friends.accept')}>
                              <IconButton
                                onClick={() => handleAcceptRequest(req.playerId)}
                                disabled={actionLoading[req.playerId]}
                                aria-label="Accept friend request"
                                sx={{
                                  minWidth: 44, minHeight: 44,
                                  color: 'success.main',
                                  '&:hover': { bgcolor: `${theme.palette.success.main}15` },
                                }}
                              >
                                {actionLoading[req.playerId] ? <CircularProgress size={18} /> : <CheckIcon sx={{ fontSize: 20 }} />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('friends.reject')}>
                              <IconButton
                                onClick={() => handleRejectRequest(req.playerId)}
                                disabled={actionLoading[`reject_${req.playerId}`]}
                                aria-label="Reject friend request"
                                sx={{
                                  minWidth: 44, minHeight: 44,
                                  color: 'error.main',
                                  '&:hover': { bgcolor: `${theme.palette.error.main}15` },
                                }}
                              >
                                {actionLoading[`reject_${req.playerId}`] ? <CircularProgress size={18} /> : <CancelIcon sx={{ fontSize: 20 }} />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.warning.main, fontSize: 15 }}>
                            {req.playerName?.charAt(0)?.toUpperCase() || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {req.playerName || t('friends.unknown')}
                              </Typography>
                              <Chip
                                label="Pending"
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.6rem', fontWeight: 600,
                                  bgcolor: `${theme.palette.warning.main}20`,
                                  color: theme.palette.warning.main,
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                              {req.playerId}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Box>
                    )
                  })}
                  </List>
                </>
              )}
            </GlassCard>
          )}

          {/* Sent Requests Tab */}
          {activeTab === 2 && (
            <GlassCard noPadding>
              {sentRequests.length === 0 ? (
                <EmptyState
                  icon={<PersonAddIcon sx={{ fontSize: 64 }} />}
                  title={t('friends.noSentRequests')}
                  description="You haven't sent any friend requests"
                  minHeight={200}
                />
              ) : (
                <List sx={{ py: 0, overflowX: 'auto' }}>
                  {sentRequests.map((req, index) => (
                    <Box key={req.playerId}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          minHeight: 64,
                          py: 1,
                          px: { xs: 1.5, sm: 2 },
                          transition: 'background-color 0.15s',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.info.main, fontSize: 15 }}>
                            {req.playerName?.charAt(0)?.toUpperCase() || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {req.playerName || t('friends.unknown')}
                              </Typography>
                              <Chip
                                label="Sent"
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.6rem', fontWeight: 600,
                                  bgcolor: `${theme.palette.info.main}20`,
                                  color: theme.palette.info.main,
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                              {req.playerId}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </GlassCard>
          )}
        </>
      )}

      {/* Add Friend Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('friends.addFriendTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label={t('friends.friendCode')}
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value)}
                placeholder={t('friends.enterFriendCode')}
                inputProps={{ maxLength: 16 }}
              />
              <Button
                variant="contained"
                onClick={handleSearchPlayer}
                disabled={searchingPlayer || !friendCodeInput.trim()}
                sx={{ bgcolor: 'accent.main', color: '#fff', '&:hover': { bgcolor: 'accent.dark' }, minWidth: 100 }}
              >
                {searchingPlayer ? <CircularProgress size={20} /> : t('friends.search')}
              </Button>
            </Box>

            {foundPlayer && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('friends.playerFound')}:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                    {foundPlayer.playerName?.charAt(0)?.toUpperCase() || '?'}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={500}>{foundPlayer.playerName || t('friends.unknown')}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      ID: {foundPlayer.playerId}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setFoundPlayer(null); setFriendCodeInput('') }}>
            {t('friends.cancel')}
          </Button>
          <LoadingButton
            loading={actionLoading.send}
            onClick={handleSendRequest}
            disabled={!foundPlayer}
            startIcon={<PersonAddIcon />}
          >
            {t('friends.sendRequest')}
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Gift Card Dialog */}
      <Dialog
        open={giftDialogOpen}
        onClose={handleCloseGiftModal}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { minHeight: '60vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <GiftIcon sx={{ color: theme.palette.warning.main }} />
            <Box>
              <Typography variant="h6">{t('friends.selectCardTitle')}</Typography>
              {selectedFriend && (
                <Typography variant="caption" color="text.secondary">
                  To: {selectedFriend.playerName}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton onClick={handleCloseGiftModal} size="small" aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingCards ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>{t('common.loading')}</Typography>
            </Box>
          ) : eligibleCards.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <GiftIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography color="text.secondary">
                {t('friends.noEligibleCards')}
              </Typography>
            </Box>
          ) : (
            <Box>
              {/* Search bar */}
              <TextField
                fullWidth
                size="small"
                placeholder={t('friends.searchCards')}
                value={cardSearchQuery}
                onChange={(e) => setCardSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select a card to send ({filteredEligibleCards.length} available):
              </Typography>

              {/* Card grid */}
              <Grid container spacing={2}>
                {filteredEligibleCards.slice(0, 50).map((card) => (
                  <Grid item xs={6} sm={4} md={3} key={card.backend_id || card.card_id}>
                    <Box
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        transform: selectedCard?.backend_id === card.backend_id ? 'scale(1.02)' : 'none',
                        '&:hover': {
                          transform: 'translateY(-4px) scale(1.02)',
                          '& img': {
                            boxShadow: '0 12px 28px rgba(255, 152, 0, 0.35)',
                          },
                        },
                      }}
                      onClick={() => setSelectedCard(card)}
                    >
                      <Box
                        component="img"
                        src={getCardImageUrl(card.backend_id || card.card_id)}
                        alt={card.card_name}
                        sx={{
                          width: '100%',
                          aspectRatio: '5 / 7',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          boxShadow: selectedCard?.backend_id === card.backend_id
                            ? `0 0 0 3px ${theme.palette.warning.main}, 0 8px 20px rgba(255, 152, 0, 0.3)`
                            : '0 4px 12px rgba(0, 0, 0, 0.15)',
                          transition: 'box-shadow 0.2s ease',
                        }}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/150x200?text=No+Image'
                        }}
                      />
                      <Box sx={{ mt: 1, px: 0.5 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {card.card_name}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Chip
                            label={card.set_code}
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            x{card.amount}
                          </Typography>
                        </Box>
                        {card.rarity && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {card.rarity}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {filteredEligibleCards.length > 50 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                  Showing first 50 cards. Use search to find specific cards.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {selectedCard && (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
                Selected: <strong>{selectedCard.card_name}</strong> ({selectedCard.set_code})
              </Typography>
            </Box>
          )}
          <Button onClick={handleCloseGiftModal} disabled={sendingGift}>
            {t('friends.close')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSendGift}
            disabled={!selectedCard || sendingGift}
            startIcon={sendingGift ? <CircularProgress size={16} color="inherit" /> : <GiftIcon />}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
              '&:hover': { background: `linear-gradient(135deg, ${theme.palette.warning.dark}, ${theme.palette.warning.dark})` },
            }}
          >
            {sendingGift ? t('friends.sending') : t('friends.sendGift')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Smart Clear Dialog */}
      <Dialog
        open={smartClearOpen}
        onClose={(_, reason) => {
          if (smartClearing) return;
          // Phase v3.1 (May 2026) — ignore backdrop click so accidental
          // click-out does not silently close the dialog and trigger the
          // reset-on-reopen useEffect. Esc + Cancel + X button remain
          // explicit close paths and DO reset selection on next open
          // (intentional safety per original v3 design).
          if (reason === 'backdropClick') return;
          setSmartClearOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon color="primary" />
          {t('friends.smartClearTitle') || 'Smart Clear Friends'}
          <Chip
            label="PREVIEW MODE"
            size="small"
            color="info"
            sx={{ ml: 1, height: 20, fontSize: '0.65rem', fontWeight: 700 }}
          />
        </DialogTitle>
        {/* Phase 4.7 — bound modal height so accordions + filters never push
            DialogActions (Confirm Removal) below the viewport on 375px mobile.
            Desktop keeps natural height (md: auto) since space isn't scarce. */}
        <DialogContent
          sx={{
            maxHeight: { xs: '70vh', md: 'auto' },
            overflowY: 'auto',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('friends.smartClearDesc') || 'Configure filters to selectively remove friends. Friends matching your criteria will be kept.'}
          </Typography>

          {smartClearing && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Processing: {smartClearProgress.current}/{smartClearProgress.total}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Removed: {smartClearProgress.removed} | Kept: {smartClearProgress.kept}
              </Typography>
            </Box>
          )}

          {/* Protection Options */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('friends.protection') || 'Protection'}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={smartClearConfig.protectGodpackFinders}
                  onChange={(e) => setSmartClearConfig(prev => ({ ...prev, protectGodpackFinders: e.target.checked }))}
                  disabled={smartClearing}
                />
              }
              label={t('friends.protectGodpackFinders') || 'Protect god pack finders (from database)'}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={smartClearConfig.protectFavorites}
                  onChange={(e) => setSmartClearConfig(prev => ({ ...prev, protectFavorites: e.target.checked }))}
                  disabled={smartClearing}
                />
              }
              label={t('friends.protectFavorites') || 'Protect favorites (in-game marked)'}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={smartClearConfig.protectWishlist}
                  onChange={(e) => setSmartClearConfig(prev => ({ ...prev, protectWishlist: e.target.checked }))}
                  disabled={smartClearing}
                />
              }
              label={t('friends.protectWishlist') || 'Protect friends with wishlist cards'}
            />
          </Box>

          {/* Phase v3 (May 2026) — GodPack tier-based cleanup mode.
              "Selection = approval" — choosing a non-zero mode tells Smart
              Clear to remove BULK-eligible friends whose only GodPack
              protection is at the selected tier(s) or lower. Tier 4, 5,
              and pseudo-high-value are ALWAYS excluded from this knob —
              they may still be removed manually one-by-one.
              Default 0 enforced on dialog open; not persisted. */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              GodPack Cleanup Mode
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Smart Clear is a <strong>bulk</strong> operation. This mode controls
              which low-tier GodPack friends become eligible for bulk removal.
              4/5 and 5/5 GodPacks are excluded from Smart Clear and must be
              removed manually one-by-one.
            </Typography>
            <RadioGroup
              value={String(gpClearMaxTier)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setGpClearMaxTier(Number.isInteger(v) ? Math.min(Math.max(v, 0), 3) : 0);
                // Invalidate preview — user must re-generate after mode change.
                setSmartClearPreview(null);
                setSmartClearPreviewError('');
              }}
            >
              <FormControlLabel
                value="0"
                control={<Radio size="small" disabled={smartClearing} />}
                label="Keep all GodPacks (recommended)"
              />
              <FormControlLabel
                value="1"
                control={<Radio size="small" disabled={smartClearing} />}
                label="Allow Smart Clear to remove 1/5 GodPack friends"
              />
              <FormControlLabel
                value="2"
                control={<Radio size="small" disabled={smartClearing} />}
                label="Allow Smart Clear to remove 1/5 and 2/5 GodPack friends"
              />
              <FormControlLabel
                value="3"
                control={<Radio size="small" disabled={smartClearing} />}
                label="Allow Smart Clear to remove 1/5, 2/5, and 3/5 GodPack friends"
              />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              ℹ️ 4/5 and 5/5 GodPacks are excluded from Smart Clear bulk
              cleanup but may still be removed manually one-by-one from the
              friend list.
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Filter Options */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('friends.filters') || 'Keep Friends Matching'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Friends matching these filters will be KEPT. Leave both off to remove everyone except protected.
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={smartClearConfig.filterByStar}
                  onChange={(e) => setSmartClearConfig(prev => ({ ...prev, filterByStar: e.target.checked }))}
                  disabled={smartClearing}
                />
              }
              label="Keep friends with high-value cards (Premium/Rare)"
            />
            {smartClearConfig.filterByStar && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', ml: 7, mt: -0.5, mb: 0.5 }}>
                Warning: This keeps most friends since many have Premium/Rare cards. Turn off for aggressive cleanup.
              </Typography>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={smartClearConfig.filterByNew}
                  onChange={(e) => setSmartClearConfig(prev => ({ ...prev, filterByNew: e.target.checked }))}
                  disabled={smartClearing}
                />
              }
              label={t('friends.filterByNew') || 'Keep friends with cards you need'}
            />
          </Box>

          {/* Logic Selector */}
          {(smartClearConfig.filterByStar || smartClearConfig.filterByNew) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('friends.filterLogic') || 'Filter Logic'}
              </Typography>
              <ToggleButtonGroup
                value={smartClearConfig.filterLogic}
                exclusive
                onChange={(e, val) => val && setSmartClearConfig(prev => ({ ...prev, filterLogic: val }))}
                disabled={smartClearing}
                size="small"
              >
                <ToggleButton value="OR">
                  {t('friends.logicOr') || 'OR (Match any)'}
                </ToggleButton>
                <ToggleButton value="AND">
                  {t('friends.logicAnd') || 'AND (Match all)'}
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}

          {/* Filter intent description */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {smartClearConfig.filterByStar || smartClearConfig.filterByNew
                ? `Friends matching your filters will be kept. All others will be removed.`
                : `No filters active - ALL friends will be removed (except protected ones).`
              }
            </Typography>
          </Alert>

          {/* Preview-first removal banner */}
          {!removalEnabled && (
            <Alert severity="warning" icon={<BlockIcon />} sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {removalReason || 'Friend removal is temporarily disabled — preview only.'}
              </Typography>
            </Alert>
          )}

          {smartClearPreviewError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {smartClearPreviewError}
            </Alert>
          )}

          {/* Phase v3.4 (May 14 2026) — UX clarity: success banner after a
              successful preview tells the user what the next step is. Users
              were stalling at the "Refresh Preview" stage because nothing
              told them to look DOWN for the red Remove button. The banner
              counts how many friends are about to be removed (high-only
              vs high+medium depending on partial-confidence toggle) and
              names the exact action label they need to press. */}
          {smartClearPreview && smartClearPreview.canProceed && (() => {
            const _highN = smartClearPreview?.summary?.highSafeCount ?? 0;
            const _medN  = smartClearPreview?.summary?.mediumSafeCount ?? 0;
            const _total = smartClearAcceptMedium ? _highN + _medN : _highN;
            if (_total === 0) return null;
            return (
              <Alert
                severity="success"
                icon={<CheckIcon />}
                sx={{ mt: 2 }}
              >
                <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>
                  Preview complete — Step 2 of 2
                </AlertTitle>
                <Typography variant="body2">
                  {_total} {_total === 1 ? 'friend is' : 'friends are'} ready for removal.
                  Review results below, then press <strong>Remove {_total}</strong> at the bottom to proceed.
                </Typography>
              </Alert>
            );
          })()}

          {/* Preview Results */}
          {smartClearPreview && (
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PreviewIcon fontSize="small" color="info" />
                Preview Results
              </Typography>

              {/* Summary chips — Phase WP-FixD3 confidence-tier counts */}
              {/* Phase 5.1 — humanized chip rail. Internal enum names
                  (HIGH_SAFE / MEDIUM_SAFE / BLOCKED_UNKNOWN) replaced
                  with operator-friendly labels. Color semantics
                  unchanged. */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip
                  label={`Scanned: ${smartClearPreview.totalScanned}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`High confidence: ${smartClearPreview.summary?.highSafeCount ?? 0}`}
                  size="small"
                  color="success"
                />
                <Chip
                  label={`Medium confidence: ${smartClearPreview.summary?.mediumSafeCount ?? 0}`}
                  size="small"
                  color="warning"
                />
                <Chip
                  label={`Protected: ${smartClearPreview.summary?.blockedUnknownCount ?? 0}`}
                  size="small"
                  color="error"
                />
                {/* Phase v3 — server-authoritative GP cleanup mode echo. */}
                {typeof smartClearPreview.selectedMaxTier === 'number' && (
                  <Chip
                    label={
                      smartClearPreview.selectedMaxTier === 0
                        ? 'GP mode: keep all'
                        : `GP mode: remove ≤${smartClearPreview.selectedMaxTier}/5`
                    }
                    size="small"
                    color={smartClearPreview.selectedMaxTier === 0 ? 'default' : 'info'}
                    variant={smartClearPreview.selectedMaxTier === 0 ? 'outlined' : 'filled'}
                  />
                )}
              </Box>

              {/* Phase v3 — GP-mode interaction summary. Visually distinguishes
                  "blocked-by-mode" (relaxable by picking a deeper mode) from
                  "permanently protected" (manual single-delete only). */}
              {typeof smartClearPreview.selectedMaxTier === 'number' &&
               smartClearPreview.selectedMaxTier > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Smart Clear is set to remove GP friends at tier ≤{' '}
                    {smartClearPreview.selectedMaxTier}/5. Higher-tier GP friends
                    in the protected list (4/5 and 5/5) are <strong>permanently
                    protected</strong> from Smart Clear and must be removed
                    manually one-by-one from the friend list.
                  </Typography>
                </Alert>
              )}

              {/* Block reason */}
              {!smartClearPreview.canProceed && (
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {smartClearPreview.blockReason || 'Removal blocked — incomplete data.'}
                  </Typography>
                </Alert>
              )}

              {/* Phase WP-FixD3 — three confidence-tier accordions.
                  BLOCKED/UNKNOWN is expanded by default (user wants
                  to see what got protected); HIGH_SAFE auto-expands
                  when there's something to remove. */}
              {(() => {
                const groups = smartClearPreview.friendsByConfidence || { HIGH_SAFE: [], MEDIUM_SAFE: [], BLOCKED_UNKNOWN: [] };
                const ConfidenceBadge = ({ tier }) => {
                  // Phase 5.1 — confirmation-modal language standard.
                  // Aligned with the chip rail above + the standardized
                  // ConfirmationSummary block used in handleSmartClear.
                  const map = {
                    HIGH_SAFE:        { label: 'High confidence',   color: 'success' },
                    MEDIUM_SAFE:      { label: 'Medium confidence', color: 'warning' },
                    BLOCKED_UNKNOWN:  { label: 'Protected',         color: 'error'   },
                  };
                  const m = map[tier] || { label: tier, color: 'default' };
                  return <Chip label={m.label} size="small" color={m.color} sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, ml: 1 }} />;
                };
                // Phase 4.7 — inline friend-code copy button per row.
                // Phase 4.8 — wired through to the unified snackbar so the
                // user gets visible confirmation. Failure path (rare —
                // navigator.clipboard exists everywhere modern) is also
                // surfaced explicitly rather than silently swallowed.
                const copyFriendCode = (code) => {
                  if (!code) return;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(code).then(
                      () => setSnack({ message: 'Copied friend code', severity: 'success' }),
                      () => setSnack({ message: 'Copy failed', severity: 'error' }),
                    );
                  } else {
                    setSnack({ message: 'Clipboard unavailable', severity: 'warning' });
                  }
                };
                // Phase 5.5 — `reasonChipFn(friend) → {label,color}|null`
                // is forwarded as an additional column on each row so
                // every protected friend gets a "why" chip without
                // requiring the user to expand the bullet detail.
                const ConfidenceList = ({ items, max = 100, secondaryFn, reasonChipFn }) => (
                  <List dense disablePadding>
                    {items.slice(0, max).map((f, i) => (
                      <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                              <Typography variant="body2" component="span">
                                {f.playerName || f.playerId}
                              </Typography>
                              <ConfidenceBadge tier={f.confidence} />
                              {/* Phase 4.7 — friend-code chip + copy. Only
                                  rendered when the preview row carries a
                                  friend code; harmless no-op otherwise. */}
                              {f.friendCode && (
                                <Tooltip title="Click to copy friend code" arrow>
                                  <Chip
                                    size="small"
                                    label={f.friendCode}
                                    onClick={(e) => { e.stopPropagation(); copyFriendCode(f.friendCode); }}
                                    sx={{
                                      ml: 0.5,
                                      height: 18,
                                      fontFamily: 'monospace',
                                      fontSize: '0.65rem',
                                      cursor: 'pointer',
                                    }}
                                  />
                                </Tooltip>
                              )}
                              {/* Phase 5.5 — per-friend "why protected"
                                  chip. One concise label per row so
                                  the user sees the primary reason at
                                  a glance, no scrolling required. */}
                              {(() => {
                                const cat = reasonChipFn ? reasonChipFn(f) : null;
                                if (!cat) return null;
                                return (
                                  <Chip
                                    size="small"
                                    label={cat.label}
                                    color={cat.color}
                                    sx={{ ml: 0.5, height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                                  />
                                );
                              })()}
                            </Box>
                          }
                          secondary={secondaryFn ? secondaryFn(f) : null}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                    {items.length > max && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                        ... and {items.length - max} more
                      </Typography>
                    )}
                  </List>
                );
                // Phase 4 (Apr 2026) — humanize reason types into short
                // operator-friendly phrases. Mirrors handleDeleteFriend's
                // local humanizer so the modal speaks the same language.
                const humanizeReason = (type) => {
                  switch (type) {
                    case 'god_pack_history':       return 'Has god pack history';
                    case 'favorite_game':          return 'In-game favorite';
                    case 'active_bot_account':     return 'Your own bot account';
                    case 'hunt_participant':       return 'Active hunt participant';
                    case 'data_error':             return 'Protection data unavailable';
                    case 'data_unavailable':       return 'Required data not stored';
                    case 'evaluator_error':        return 'Internal evaluator error';
                    case 'invalid_input':          return 'Invalid request';
                    case 'partial_verification':   return 'Wishlist / needed / high-value not verifiable';
                    case 'all_checks_passed':      return 'All available checks passed';
                    case 'optional_check_skipped': return 'Optional check skipped';
                    default:                       return type;
                  }
                };
                // Render compact bullet list per friend. Tier decides bullet glyph.
                const reasonNode = (f) => {
                  const reasons = [];
                  for (const r of (f.protectedReasons || [])) {
                    if (r?.type) reasons.push({ kind: 'block', text: humanizeReason(r.type), detail: r.detail || r.reason });
                  }
                  for (const r of (f.confidenceReasons || [])) {
                    if (r?.type === 'all_checks_passed') {
                      reasons.push({ kind: 'pass', text: humanizeReason(r.type) });
                    } else if (r?.type === 'partial_verification') {
                      reasons.push({ kind: 'warn', text: humanizeReason(r.type), detail: r.detail });
                    } else if (r?.type === 'optional_check_skipped') {
                      reasons.push({ kind: 'warn', text: humanizeReason(r.type), detail: r.detail });
                    }
                  }
                  if (reasons.length === 0) return null;
                  const glyph = (k) => k === 'block' ? '✗' : k === 'warn' ? '⚠' : '✓';
                  const color = (k) => k === 'block' ? 'error.main' : k === 'warn' ? 'warning.main' : 'success.main';
                  return (
                    <Box component="span" sx={{ display: 'block', mt: 0.25 }}>
                      {reasons.map((r, i) => (
                        <Box component="span" key={i} sx={{ display: 'block', color: color(r.kind), fontSize: '0.7rem' }}>
                          {glyph(r.kind)} {r.text}{r.detail ? ` — ${r.detail}` : ''}
                        </Box>
                      ))}
                    </Box>
                  );
                };
                // Phase 4 (Apr 2026) — operator-friendly summary header.
                const safeN    = groups.HIGH_SAFE.length;
                const partialN = groups.MEDIUM_SAFE.length;
                const blockedN = groups.BLOCKED_UNKNOWN.length;
                const summarySentence = [
                  safeN    > 0 && `${safeN} friend${safeN !== 1 ? 's' : ''} can be safely removed`,
                  partialN > 0 && `${partialN} need${partialN === 1 ? 's' : ''} explicit risk-accept`,
                  blockedN > 0 && `${blockedN} blocked due to active God Packs / favorites / system safety`,
                ].filter(Boolean).join(' · ');

                // Phase 5.5 (Apr 2026) — Smart Clear trust layer.
                //
                // Backend reason types observed on protectedReasons[]:
                //   god_pack_history, active_bot_account, hunt_participant,
                //   favorite_game, data_unavailable (w/ filter:
                //   favorites|wishlist|needed|highValue), data_error,
                //   evaluator_error, invalid_input.
                //
                // primaryReasonForFriend() picks ONE reason per friend
                // (priority order — first non-null wins) and projects
                // it into a UI category + label + color. The same
                // category drives both the per-row chip and the summary
                // breakdown so the totals always reconcile.
                const reasonCategoryFor = (r) => {
                  if (!r || !r.type) return null;
                  if (r.type === 'god_pack_history')   return { key: 'gp',        label: 'God Pack',       color: 'warning' };
                  if (r.type === 'active_bot_account') return { key: 'bot',       label: 'Active Bot',     color: 'info'    };
                  if (r.type === 'hunt_participant')   return { key: 'hunt',      label: 'Hunt',           color: 'info'    };
                  if (r.type === 'favorite_game')      return { key: 'fav',       label: 'Favorite',       color: 'secondary' };
                  if (r.type === 'data_unavailable') {
                    const f = r.filter || '';
                    if (f === 'wishlist' || f === 'needed' || f === 'highValue') {
                      return { key: 'collection', label: 'Wishlist / Needed', color: 'primary' };
                    }
                    return { key: 'verify', label: 'Safety Check', color: 'default' };
                  }
                  if (r.type === 'data_error' || r.type === 'evaluator_error' || r.type === 'invalid_input') {
                    return { key: 'verify', label: 'Safety Check', color: 'default' };
                  }
                  return { key: 'other', label: 'Protected', color: 'default' };
                };
                const primaryReasonForFriend = (f) => {
                  // Priority order — most user-meaningful first.
                  const pr = Array.isArray(f.protectedReasons) ? f.protectedReasons : [];
                  const PRI = ['god_pack_history','favorite_game','active_bot_account','hunt_participant','data_unavailable','data_error','evaluator_error','invalid_input'];
                  for (const t of PRI) {
                    const hit = pr.find(r => r?.type === t);
                    if (hit) return reasonCategoryFor(hit);
                  }
                  return pr.length > 0 ? reasonCategoryFor(pr[0]) : null;
                };

                // Build a breakdown of WHY the BLOCKED_UNKNOWN bucket
                // is blocked — totals must match blockedN exactly.
                const breakdown = { gp: 0, bot: 0, hunt: 0, fav: 0, collection: 0, verify: 0, other: 0 };
                let unmappedCount = 0;
                for (const f of groups.BLOCKED_UNKNOWN) {
                  const cat = primaryReasonForFriend(f);
                  if (cat) breakdown[cat.key]++;
                  else { breakdown.other++; unmappedCount++; }
                }
                // Console-side audit so ops can see how often the
                // backend ships rows without a mappable reason.
                if (unmappedCount > 0 && typeof console !== 'undefined') {
                  // eslint-disable-next-line no-console
                  console.log(`[SmartClear] ${unmappedCount} protected friend(s) without a mapped reason — falling back to "Protected"`);
                }
                const breakdownLines = [
                  breakdown.gp         > 0 && { icon: '🎴', text: `Protected by God Pack history`,        n: breakdown.gp },
                  breakdown.bot        > 0 && { icon: '🤖', text: `Protected by your own bot account`,    n: breakdown.bot },
                  breakdown.hunt       > 0 && { icon: '🎯', text: `Protected by active hunt participation`, n: breakdown.hunt },
                  breakdown.fav        > 0 && { icon: '⭐', text: `Protected by in-game favorites`,         n: breakdown.fav },
                  breakdown.collection > 0 && { icon: '📦', text: `Protected by wishlist / needed cards`,   n: breakdown.collection },
                  breakdown.verify     > 0 && { icon: '🛡️', text: `Protected by safety check (incomplete verification)`, n: breakdown.verify },
                  breakdown.other      > 0 && { icon: '🛡️', text: `Protected by safety rule`,               n: breakdown.other },
                ].filter(Boolean);

                // Phase 5.5 — when ALL friends are blocked, replace the
                // generic summarySentence with a calmer "no friends safe
                // to remove" + a structured per-reason breakdown.
                const noneRemovable = (safeN === 0 && partialN === 0 && blockedN > 0);
                return (
                  <>
                    {/* Phase 4 — summary sentence above accordions.
                        Phase 4.8 — "Preview ready" success chip.
                        Phase 5.5 — when noneRemovable, swap the generic
                        sentence for a calmer "No friends are safe to
                        remove right now" headline + a structured
                        per-reason breakdown so the user can see EXACTLY
                        why each friend was kept. Totals reconcile to
                        the protected count. */}
                    {noneRemovable ? (
                      <Box sx={{
                        p: 1.5, mb: 1.5, borderRadius: 1,
                        bgcolor: 'info.lighter', border: 1, borderColor: 'info.light',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            No friends are safe to remove right now.
                          </Typography>
                          <Chip
                            label="Preview ready"
                            size="small"
                            color="success"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25, lineHeight: 1.5 }}>
                          {blockedN} friend{blockedN !== 1 ? 's were' : ' was'} kept by protection rules. Open the list below to see why each one was kept.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {breakdownLines.map((bl, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box component="span" sx={{ fontSize: '0.95rem' }}>{bl.icon}</Box>
                              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
                                {bl.text}: <strong>{bl.n}</strong>
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ) : (
                      summarySentence && (
                        <Box sx={{
                          p: 1.25, mb: 1.5, borderRadius: 1,
                          bgcolor: 'info.lighter', border: 1, borderColor: 'info.light',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 1, flexWrap: 'wrap',
                        }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            {summarySentence}.
                          </Typography>
                          <Chip
                            label="Preview ready"
                            size="small"
                            color="success"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                          />
                        </Box>
                      )
                    )}

                    {/* Phase 5.5 — collapsible "Why are friends protected?"
                        explainer. Always visible (regardless of noneRemovable)
                        so users learning the system can read it any time. */}
                    {blockedN > 0 && (
                      <Accordion
                        disableGutters
                        elevation={0}
                        sx={{ mb: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Why are friends protected?
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                          <Typography variant="caption" sx={{ display: 'block', mb: 1, lineHeight: 1.5, color: 'text.primary' }}>
                            Smart Clear keeps friends when any safety rule detects they may be valuable or unsafe to remove.
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.5, color: 'text.secondary' }}>
                            A friend does not need a God Pack badge to be protected. Other rules include in-game favorites, your own bot accounts, active hunt participation, wishlist / needed-card matches, and incomplete safety checks (data the system could not verify).
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    )}

                    {/* Phase 5.1 — humanized accordion headers. Internal
                        enums (HIGH_SAFE/MEDIUM_SAFE/BLOCKED_UNKNOWN) drive
                        grouping/logic unchanged; user-visible labels use
                        the confirmation-modal language standard:
                        Protected / Medium confidence / High confidence. */}
                    {/* Protected — defaultExpanded so user sees protection at a glance */}
                    <Accordion sx={{ mb: 1 }} defaultExpanded={groups.BLOCKED_UNKNOWN.length > 0}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" fontWeight={600} color="error.main">
                          Protected ({groups.BLOCKED_UNKNOWN.length}) — will not be touched
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          These friends are kept safe and cannot be removed automatically.
                        </Typography>
                        <ConfidenceList
                          items={groups.BLOCKED_UNKNOWN}
                          secondaryFn={reasonNode}
                          reasonChipFn={primaryReasonForFriend}
                        />
                      </AccordionDetails>
                    </Accordion>

                    {/* Medium confidence (was MEDIUM_SAFE) */}
                    <Accordion sx={{ mb: 1 }} defaultExpanded={groups.MEDIUM_SAFE.length > 0}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" fontWeight={600} color="warning.main">
                          Medium confidence ({groups.MEDIUM_SAFE.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Toggle "Include partial-confidence" below to include these in the next removal.
                        </Typography>
                        <ConfidenceList items={groups.MEDIUM_SAFE} secondaryFn={reasonNode} />
                      </AccordionDetails>
                    </Accordion>

                    {/* High confidence (was HIGH_SAFE) */}
                    <Accordion sx={{ mb: 1 }} defaultExpanded={groups.HIGH_SAFE.length > 0}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          High confidence ({groups.HIGH_SAFE.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Every available check passed. Safe to remove.
                        </Typography>
                        <ConfidenceList items={groups.HIGH_SAFE} secondaryFn={reasonNode} />
                      </AccordionDetails>
                    </Accordion>
                  </>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        {/* Phase 4.7 — visual separator above the action row so the
            Confirm Removal button feels anchored when content scrolls
            on a bounded mobile DialogContent. */}
        <Divider />
        {/* Phase 5.8 mobile pass — DialogActions stacks vertically on
            mobile so each action gets a full-width 44px-tall hit zone
            instead of cramped wrapped chips. Desktop keeps horizontal
            row. responsive sx pattern matches the existing modal. */}
        <DialogActions sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          flexWrap: 'wrap',
          gap: 1,
          '& > *': {
            width: { xs: '100%', sm: 'auto' },
            minHeight: { xs: 44, sm: 'auto' },
          },
        }}>
          <Button onClick={() => setSmartClearOpen(false)} disabled={smartClearing}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          {/* Phase v3.4 (May 14 2026) — UX clarity: demote Refresh Preview
              once a preview has succeeded. Before preview: outlined+icon
              (primary-looking) so users find Generate Preview. After
              preview: text variant, no icon — visually secondary so the
              red Remove button reads as the next step. */}
          <Button
            variant={smartClearPreview ? 'text' : 'outlined'}
            color="info"
            onClick={handleSmartClearPreview}
            disabled={smartClearing || smartClearPreviewLoading || friendsList.length === 0}
            startIcon={
              smartClearPreviewLoading
                ? <CircularProgress size={16} />
                : (smartClearPreview ? null : <PreviewIcon />)
            }
          >
            {smartClearPreviewLoading ? 'Generating…' : (smartClearPreview ? 'Refresh Preview' : 'Generate Preview')}
          </Button>
          {/* Phase WP-FixD4 — partial-confidence opt-in. Visible only after
              preview exists. Toggling ON includes MEDIUM_SAFE friends in
              the deletion batch + tells the server to admit them. */}
          {smartClearPreview && (smartClearPreview.summary?.mediumSafeCount ?? 0) > 0 && (
            <FormControlLabel
              sx={{ mr: 1, ml: 0 }}
              control={
                <Switch
                  size="small"
                  checked={smartClearAcceptMedium}
                  onChange={(e) => setSmartClearAcceptMedium(e.target.checked)}
                  disabled={smartClearing}
                  color="warning"
                />
              }
              label={
                <Typography variant="caption" color={smartClearAcceptMedium ? 'warning.main' : 'text.secondary'}>
                  Include partial-confidence ({smartClearPreview.summary.mediumSafeCount} medium-confidence)
                </Typography>
              }
            />
          )}
          {(() => {
            const highN   = smartClearPreview?.summary?.highSafeCount   ?? 0;
            const medN    = smartClearPreview?.summary?.mediumSafeCount ?? 0;
            const include = smartClearAcceptMedium;
            const total   = include ? highN + medN : highN;
            const disabled =
              smartClearing ||
              friendsList.length === 0 ||
              !smartClearPreview ||
              !smartClearPreview.canProceed ||
              !removalEnabled ||
              total === 0;
            // Phase 5.1 — outcome-focused button label. Drops the
            // "Confirm Removal" prefix so the count + outcome reads as
            // a single sentence: "Remove 18".
            const label = smartClearing
              ? `Clearing... (${smartClearProgress.current}/${smartClearProgress.total})`
              : `Remove ${total}`;
            // Phase 4 — explain WHY the button is disabled.
            // Phase 5.1 — disabled copy uses the new language standard
            // (high-confidence / medium-confidence) and drops the
            // server-side "re-validates" footnote.
            const disabledReason =
              !removalEnabled         ? (removalReason || 'Friend removal is currently disabled.')
              : !smartClearPreview    ? 'Generate Preview first to see what would be removed.'
              : !smartClearPreview.canProceed ? (smartClearPreview.blockReason || 'Preview blocked — cannot proceed.')
              : total === 0           ? (medN > 0
                                          ? 'No high-confidence friends. Toggle "Include partial-confidence" to include medium-confidence matches.'
                                          : 'No removable friends found. Try widening filters or enabling partial-confidence removal.')
              : friendsList.length === 0 ? 'No friends loaded for this account.'
              : null;
            // Phase v3.4 (May 14 2026) — UX clarity: hover-only Tooltip on
            // a disabled button is invisible on mobile (no hover). Wrap the
            // button so the disabledReason ALSO renders as a visible caption
            // below it. Keeps Tooltip for desktop, adds inline text for
            // mobile users who otherwise saw a grey button with no hint.
            const button = (
              <span>{/* span needed for Tooltip on disabled button */}
              <Button
                variant="contained"
                color="error"
                onClick={handleSmartClear}
                disabled={disabled}
                startIcon={smartClearing ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                fullWidth
              >
                {label}
              </Button>
              </span>
            );
            const buttonWithTooltip = disabled && disabledReason
              ? <Tooltip title={disabledReason} arrow>{button}</Tooltip>
              : button;
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', width: { xs: '100%', sm: 'auto' }, alignItems: 'stretch' }}>
                {buttonWithTooltip}
                {disabled && disabledReason && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, textAlign: { xs: 'center', sm: 'right' }, lineHeight: 1.3 }}
                  >
                    {disabledReason}
                  </Typography>
                )}
              </Box>
            );
          })()}
        </DialogActions>
      </Dialog>

      {/* God Pack Details Dialog */}
      <Dialog
        open={Boolean(selectedGodPackFriend)}
        onClose={() => setSelectedGodPackFriend(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedGodPackFriend && godPackMap[selectedGodPackFriend.playerId] && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GodPackIcon sx={{ color: theme.palette.warning.main }} />
              God Packs - {selectedGodPackFriend.playerName}
              <IconButton onClick={() => setSelectedGodPackFriend(null)} sx={{ ml: 'auto' }} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {godPackMap[selectedGodPackFriend.playerId].map((gp, idx) => (
                <Paper key={gp.godPackId || idx} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: `${theme.palette.warning.main}40`, transition: 'border-color 0.15s, box-shadow 0.15s', '&:hover': { borderColor: `${theme.palette.warning.main}70`, boxShadow: `0 2px 12px ${theme.palette.warning.main}15` } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {gp.packType || 'Pack'}
                      </Typography>
                      {gp.status === 'ALIVE' && (
                        <Chip
                          label="LIVE"
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.6rem', fontWeight: 700,
                            bgcolor: `${theme.palette.success.main}25`,
                            color: theme.palette.success.main,
                            border: `1px solid ${theme.palette.success.main}50`,
                          }}
                        />
                      )}
                      {gp.packNumber && (
                        <Chip
                          label={`${gp.packNumber}P`}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.6rem', fontWeight: 700,
                            bgcolor: `${theme.palette.text.secondary}15`,
                            color: theme.palette.text.secondary,
                            border: `1px solid ${theme.palette.text.secondary}30`,
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {gp.discoveredAt ? new Date(gp.discoveredAt).toLocaleString() : 'Unknown date'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {gp.cardCount || gp.cards?.length || 0} premium cards
                    {gp.totalStars ? ` | ${gp.totalStars} stars` : ''}
                  </Typography>
                  {gp.cards && gp.cards.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {gp.cards.map((card, ci) => (
                        <Tooltip key={ci} title={`${card.name} (${card.rarity}) — Stock: ${card.stock ?? '?'}`} arrow>
                          <Box sx={{ width: 80, textAlign: 'center' }}>
                            <img
                              src={`/api/cards/${card.id}/image?v=5`}
                              alt={card.name}
                              style={{
                                width: 80,
                                borderRadius: 6,
                                border: `2px solid ${theme.palette.warning.main}60`,
                                background: theme.palette.background.default,
                              }}
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                            <Typography variant="caption" noWrap sx={{ display: 'block', fontSize: '0.6rem', mt: 0.25, color: 'text.secondary' }}>
                              {card.name}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', color: card.stock > 0 ? theme.palette.success.main : theme.palette.error.main, fontWeight: 600 }}>
                              {card.stock != null ? `×${card.stock}` : ''}
                            </Typography>
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  )}
                </Paper>
              ))}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}

      {/* Phase 4.8 — unified snackbar for inline copy feedback (Smart
          Clear preview rows). isPhone (sm breakpoint) drives the
          re-anchoring contract from utils/snackbarConfig.js. */}
      <Snackbar
        open={!!snack}
        onClose={() => setSnack(null)}
        {...getSnackbarProps({ severity: snack?.severity, isMobile: isPhone })}
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
    </Box>
    </FadeIn>
  )
}

export default Friends
