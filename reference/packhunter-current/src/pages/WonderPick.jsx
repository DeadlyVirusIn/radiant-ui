import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
} from '@mui/material'
import {
  Sync as SyncIcon,
  HourglassEmpty as HourglassIcon,
  AccessTime as TimeIcon,
  Style as PackIcon,
  CheckCircle as CheckIcon,
  History as HistoryIcon,
  AutoAwesome as GlassIcon,
  Timer as TimerIcon,
  Bolt as StaminaIcon,
  HelpOutline as HelpIcon,
  Healing as HealIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material'
import IconButton from '@mui/material/IconButton'
import { tasks as tasksApi, cards as cardsApi, collection as collectionApi, friends as friendsApi, hunt as huntApi, wonderpicksFeed } from '../services/api'
// Phase 3 (Apr 2026) — freshness pill + godpack:updated socket listener
import FreshnessIndicator from '../components/FreshnessIndicator'
import { onGodpackUpdated, offGodpackUpdated } from '../services/socket'
import { useAccount } from '../contexts/AccountContext'
import useHealAction from '../hooks/useHealAction'
import { WonderPickSkeleton } from '../components/LoadingSkeleton'
import { getCardDisplayName } from '../hooks/useLocalizedCards'
import { getRewardAsset } from '../utils/rewardAssets'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { RARITY_COLORS, SET_NAMES, PACK_DISPLAY_NAMES, getPackDisplayName } from '../constants/gameData'
import { EmptyState } from '../components/EmptyState'
import { FadeIn } from '../components/Animations'
import PageHeader from '../components/PageHeader'
import AccountSelector from '../components/AccountSelector'
import AccountBadge from '../components/AccountBadge'
import CollapsibleHelp from '../components/CollapsibleHelp'
import LoadingButton from '../components/LoadingButton'
// Phase 4.8 — unified snackbar styling/duration/anchor (Snackbar
// already imported via the @mui/material destructure above).
import MuiAlert from '@mui/material/Alert'
import { getSnackbarProps, getAlertSx } from '../utils/snackbarConfig'

const getSetDisplayName = (setCode) => {
  return SET_NAMES[setCode] || setCode || ''
}

/**
 * Phase 25F — shared size contract for history-feed media.
 *
 * History entries across the app (Wonder Pick, Pack Open, Tracker
 * recent pulls, etc.) all need to render at the same compact size
 * so a single component can't accidentally balloon to full-width
 * card art. 100px is the canonical compact width — tall enough for
 * a legible card at 5/7 aspect, narrow enough to stack 3-4 across
 * on mobile without wrapping.
 *
 * If you're building a detail/modal view, ignore this constant and
 * let the image size to its container (width: 100%). HISTORY_CARD_
 * MAX_WIDTH is specifically for FEED contexts.
 */
export const HISTORY_CARD_MAX_WIDTH = 100;

/**
 * Stable history card image — prevents flicker from parent re-renders.
 * Once an image fails to load, it permanently switches to the placeholder.
 * Memoized so parent state changes (alivePlayers, etc.) don't cause re-render.
 *
 * Bug fix (Phase 25F): width was `100%` alone, which in a flex child
 * without an explicit width resolved to the image's INTRINSIC size
 * (400-800px raw card art) — history entries rendered huge. Now
 * clamped to HISTORY_CARD_MAX_WIDTH. Modal/detail views should use a
 * different component or override the width explicitly.
 */
const HistoryCardImage = memo(function HistoryCardImage({ cardId, alt }) {
  const [failed, setFailed] = useState(false)
  const src = (!failed && cardId) ? cardsApi.getImageUrl(cardId) : '/card-placeholder.png'

  return (
    <Box
      component="img"
      src={src}
      alt={alt || 'Card'}
      sx={{
        width: '100%',
        maxWidth: HISTORY_CARD_MAX_WIDTH,
        aspectRatio: '5 / 7',
        objectFit: 'contain',
        display: 'block',
      }}
      onError={() => { if (!failed) setFailed(true) }}
    />
  )
})

function WonderPick({ user }) {
  const { isDark } = useThemeMode()
  const theme = useTheme()
  // Phase 4.8 — phone-width detection for snackbar re-anchoring.
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useLanguage()
  const { accounts: allAccounts, selectedAccountId, selectAccount, loading: accountsLoading } = useAccount()
  const userAccounts = allAccounts.filter(a => a.is_active)
  const selectedAccount = selectedAccountId || ''
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  // Per-resource loading flags — replaces the single loadingData gate.
  // Each is released independently when its slice arrives so the pick
  // list no longer waits on resources or ownership to paint.
  const [picksLoading, setPicksLoading] = useState(false)
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [ownershipLoading, setOwnershipLoading] = useState(false)
  // rawPicks = unsorted feeds straight from the backend. wonderPicks is
  // derived via useMemo below so a later ownedCards update just re-sorts
  // without requiring a refetch.
  const [rawPicks, setRawPicks] = useState([])
  const [ownedCards, setOwnedCards] = useState(new Map())
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [resources, setResources] = useState({ stamina: 0, maxStamina: 10, hourglasses: 0 })
  // selectedAccountRef — used by in-flight fetches to check that the
  // account the fetch was KICKED OFF FOR is still the currently-selected
  // one. Prevents stale responses from overwriting newer account state.
  const selectedAccountRef = useRef(null)
  useEffect(() => { selectedAccountRef.current = selectedAccount }, [selectedAccount])

  // Pick result dialog
  const [pickResult, setPickResult] = useState(null)
  const [pickDialogOpen, setPickDialogOpen] = useState(false)
  const [pickingFeed, setPickingFeed] = useState(null)

  // Phase 3 (Apr 2026) — freshness state from /api/wonderpicks/feed.
  // Read AFTER the existing tasksApi.getWonderPicks() warms the cache.
  // Surface as a small pill near the page header. Does NOT replace
  // the existing data path — strictly additive read.
  const [feedMeta, setFeedMeta] = useState(null)   // { lastUpdatedAt, cacheStatus, cacheAgeMs, warmHint }

  // Shared heal action hook
  const healApi = useCallback(
    (chargersAmount, vcAmount) => tasksApi.healChallengePower(selectedAccount, chargersAmount, vcAmount),
    [selectedAccount]
  )
  const { healLoading, handleHeal: doHeal } = useHealAction(healApi, () => loadWonderPickData(), 1500)

  // Pick history (stored in localStorage for persistence)
  const [pickHistory, setPickHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wonderPickHistory') || '[]')
    } catch { return [] }
  })
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [removingFriend, setRemovingFriend] = useState(null) // playerId being removed

  const handleRemoveFriend = async (pick) => {
    if (!pick.playerId || !selectedAccount) return
    if (!window.confirm(`Remove ${pick.playerName || 'this friend'} from your friend list?`)) return
    setRemovingFriend(pick.playerId)
    try {
      await friendsApi.deleteGameFriend(selectedAccount, pick.playerId, { force: true })
      setSuccessMessage(`Removed ${pick.playerName || 'friend'}`)
    } catch (e) {
      setError(`Failed to remove friend: ${e.message}`)
    }
    setRemovingFriend(null)
  }

  const [markingLive, setMarkingLive] = useState(null) // playerId being marked
  const [alivePlayers, setAlivePlayers] = useState(new Set()) // playerIds with ALIVE god packs (from DB + local marks)
  const handleMarkLive = async (pick) => {
    if (!pick.playerId) return
    setMarkingLive(pick.playerId)
    try {
      const result = await huntApi.updateGodpackStatusByPlayer(pick.playerId, 'ALIVE')
      const name = pick.playerName || 'friend'
      const discordStatus = result.discordLivePosted
        ? 'Discord synced'
        : result.discordThreadId
          ? 'pending Discord announcement'
          : 'no Discord thread'
      setSuccessMessage(`Marked ${name} as LIVE (${discordStatus})`)
      setAlivePlayers(prev => new Set(prev).add(pick.playerId))
    } catch (e) {
      setError(e.message?.includes('404') ? 'No god pack found for this player' : `Failed: ${e.message}`)
    }
    setMarkingLive(null)
  }

  // Load wonder pick data when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadWonderPickData()
    }
  }, [selectedAccount])

  // Phase 3 (Apr 2026) — godpack:updated socket listener.
  // Server emits this on any GP status writeback. Refetch picks +
  // alive-players via the existing loader (debounced 500ms so a burst
  // of events triggers one refetch). DO NOT mutate state from payload.
  useEffect(() => {
    if (!selectedAccount) return undefined
    let timer = null
    const handler = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => loadWonderPickData(), 500)
    }
    onGodpackUpdated(handler)
    return () => {
      if (timer) clearTimeout(timer)
      offGodpackUpdated(handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount])

  const loadWonderPickData = async () => {
    if (!selectedAccount) return
    const acctId = selectedAccount
    setError('')
    // Critical: keep loadingData TRUE during the picks fetch. Without
    // this, the empty-state condition (`!loadingData && wonderPicks.length === 0`)
    // renders the "No wonder picks available" card the instant the page
    // mounts — BEFORE the picks fetch even resolves. This was the
    // regression in 15e5264f.
    setLoadingData(true)

    // Timing instrumentation — toggle via localStorage.setItem('vudoo_wp_perf','1').
    const perf = (() => { try { return localStorage.getItem('vudoo_wp_perf') === '1' } catch { return false } })()
    const t0 = performance.now()
    const mark = (label) => { if (perf) console.log(`[WP][perf] +${Math.round(performance.now() - t0)}ms ${label}`) }
    mark('load start')
    // Always-on lightweight diagnostics so we don't repeat this RCA blind:
    console.log(`[WP-FE] load start account=${acctId}`)

    // ── ROOT CAUSE of prior blocking:  Promise.all([picks, resources, owned])
    // means the slowest of the 3 legs gates render. `getResources` hits
    // the game API twice (GetResourceSummary + GetAllResources + several
    // power-level calls) through a gRPC session — often 800ms+. The
    // browser skeleton stayed visible until that leg finished even
    // though the pick card data was already in hand from getWonderPicks.
    //
    // Fix: fire all 3 requests in parallel, but DO NOT await them as a
    // group. Each leg is handled independently and hydrates its OWN
    // slice of state. Skeleton gates on picks alone. Ownership arrives
    // and `wonderPicks` auto re-sorts via the needScore tie-break.
    // Resources arrives and the header mini-counters update. No full
    // skeleton for 600+ms after picks are already known.
    setPicksLoading(true)
    setResourcesLoading(true)
    setOwnershipLoading(true)

    // Picks — the only thing the skeleton blocks on
    tasksApi.getWonderPicks(acctId)
      .then(picksData => {
        mark('picks returned')
        // Diagnostic: count what the API actually returned.
        const someoneN = (picksData?.someoneFeeds || []).length
        const freeN    = (picksData?.freeFeeds || []).length
        const luckyN   = (picksData?.luckyFeeds || []).length
        console.log(`[WP-FE] apiPicks someone=${someoneN} free=${freeN} lucky=${luckyN} total=${someoneN+freeN+luckyN}`)
        // Stale-account guard REMOVED — it dropped picks when
        // selectedAccountRef.current was null (effect-order race) or
        // when the ref + acctId types diverged (string vs number from
        // AccountContext). The "wrong-account briefly visible" risk the
        // guard mitigated is far less harmful than dropping picks
        // entirely. This was the second arm of the 15e5264f regression.
        const parseExpiry = (t) => {
          if (!t) return null
          if (typeof t === 'string') return new Date(t)
          return new Date(t * 1000)
        }
        const allPicks = [
          ...(picksData.someoneFeeds || []),
          ...(picksData.freeFeeds || []),
          ...(picksData.luckyFeeds || []),
        ].map(feed => {
          const expiry = parseExpiry(feed.expiryTime)
          return { ...feed, id: feed.feedId, isExpired: expiry ? expiry < new Date() : false, expiryDate: expiry }
        })
        console.log(`[WP-FE] rawPicks built len=${allPicks.length}`)
        // Stamina comes back in picksData — hydrate the stamina slice
        // NOW so pick-button gating works before /resources lands.
        setResources(prev => ({
          ...prev,
          stamina: picksData.challengePower?.current ?? prev.stamina,
          maxStamina: picksData.challengePower?.max ?? prev.maxStamina,
          healAt: picksData.challengePower?.healAt ?? prev.healAt,
        }))
        setRawPicks(allPicks)
        setPicksLoading(false)
        setLoadingData(false)   // legacy gate — release immediately
        mark('rawPicks set — SKELETON RELEASED')

        // Kick off alive-players enrichment (fire-and-forget)
        const friendPlayerIds = allPicks.filter(p => p.isFriend && p.playerId).map(p => p.playerId)
        if (friendPlayerIds.length > 0) {
          huntApi.getAlivePlayers(friendPlayerIds)
            .then(alive => {
              mark('alivePlayers returned')
              if (alive && alive.length > 0) setAlivePlayers(prev => {
                const next = new Set(prev); alive.forEach(id => next.add(id)); return next
              })
            })
            .catch(() => { /* non-blocking */ })
        }

        // Phase 3 (Apr 2026) — fire-and-forget read of the normalized
        // /api/wonderpicks/feed for freshness metadata. Cache was just
        // warmed by the getWonderPicks call above, so this should hit
        // cacheStatus='hit'. Failure is silent — the existing UI keeps
        // working, the freshness pill just stays hidden.
        wonderpicksFeed.getFeed(acctId)
          .then(feed => {
            setFeedMeta({
              lastUpdatedAt: feed.lastUpdatedAt || null,
              cacheStatus:   feed.cacheStatus   || null,
              cacheAgeMs:    feed.cacheAgeMs   ?? null,
              warmHint:      feed.warmHint     || null,
            })
          })
          .catch(() => { /* non-blocking */ })
      })
      .catch(err => {
        console.error('Failed to load wonder picks:', err)
        setError(`Failed to load wonder picks: ${err.message}`)
        setPicksLoading(false)
        setLoadingData(false)
      })

    // Resources — independent, doesn't gate render. No stale-account
    // guard (see picks-leg comment above).
    tasksApi.getResources(acctId)
      .then(resourcesData => {
        mark('resources returned')
        setResources(prev => ({
          ...prev,
          hourglasses: resourcesData.hourglasses || 0,
          wpChargers: resourcesData.wpChargers || 0,
        }))
        setResourcesLoading(false)
      })
      .catch(() => { setResourcesLoading(false) })

    // Ownership — independent. When it resolves, the useMemo sort
    // re-runs and the need-score tie-breaker takes effect. Until then
    // picks render fine with bucket-only ordering (FREE PICK still top).
    collectionApi.getOwnedCards(acctId)
      .then(ownedData => {
        mark('ownership returned')
        const ownedMap = ownedData?.cards || {}
        setOwnedCards(new Map(Object.entries(ownedMap).map(([k, v]) => [k, v])))
        setOwnershipLoading(false)
      })
      .catch(() => { setOwnershipLoading(false) })

    // No await, no Promise.all. Each leg above manages its own state
    // slice + loading flag. Previous implementation re-assembled all
    // three into a single response path; the dead body has been removed.
  }

  // Derived — sort happens REACTIVELY via useMemo when either rawPicks,
  // ownedCards, or alivePlayers changes. Picks render with bucket-only
  // order the moment they arrive (FREE PICK still on top — the bucket
  // doesn't depend on ownership); when ownership/alive-players hydrate
  // hundreds of ms later, the memo re-runs with proper need-score
  // tie-breaking. Single render cycle vs the prior setState-in-effect.
  //
  // Apr 2026 — consumed bucket (6) slots between actionable and
  // expired. Backend now stamps pickStatus: 'available' | 'consumed'
  // | 'expired' on every feed. Consumed picks stay visible (so the
  // operator sees "yes, that one was picked") but drop below all
  // actionable picks. Expired moves to very bottom (7).
  const wonderPicks = useMemo(() => {
    const bucketOf = (p) => {
      if (p.pickStatus === 'expired' || p.isExpired) return 7
      if (p.pickStatus === 'consumed') return 6
      if (p.feedType === 'FREE') return 1
      if (p.isFriend && p.playerId && alivePlayers.has?.(p.playerId)) return 2
      if (p.isFriend === true) return 3
      return 4
    }
    const needOf = (p) => (p.cards || [])
      .filter(c => !ownedCards.has(c.cardId) || ownedCards.get(c.cardId) === 0).length
    return [...rawPicks].sort((a, b) => {
      const ab = bucketOf(a), bb = bucketOf(b)
      if (ab !== bb) return ab - bb
      return needOf(b) - needOf(a)
    })
  }, [rawPicks, ownedCards, alivePlayers])

  // Apr 2026 — optimistic consumed-state update. Given a feedId, mark
  // the matching pick in rawPicks as consumed immediately so the UI
  // never renders a stale PICK button after success. The subsequent
  // loadWonderPickData() confirms from backend; if backend disagrees
  // (rare) the server state wins on the next refresh.
  const markFeedConsumed = (feedId) => {
    const nowIso = new Date().toISOString()
    setRawPicks(prev => prev.map(p =>
      p.feedId === feedId ? { ...p, pickStatus: 'consumed', consumedAt: p.consumedAt || nowIso } : p
    ))
  }

  // Perform wonder pick
  const handlePick = async (pick) => {
    // Defense in depth — refuse to act on a consumed pick even if
    // someone clicks a stale button. Should not happen with the new
    // sort + UI state, but safe.
    if (pick.pickStatus === 'consumed') {
      return
    }
    if (pick.isExpired || pick.pickStatus === 'expired') {
      setError('This pick has expired')
      return
    }

    if (resources.stamina < pick.staminaRequired && pick.feedType !== 'FREE') {
      setError('Not enough stamina for this pick')
      return
    }

    setPickingFeed(pick.feedId)
    setError('')

    try {
      const result = await tasksApi.performWonderPick(selectedAccount, pick.feedId, pick.feedType, pick.cards || [])

      // Apr 2026 — backend 409 guard path. Server detected this
      // feedId was already consumed; convert to consumed UI + toast
      // without treating as an error.
      if (result?.alreadyPicked === true || result?.error === 'already-picked') {
        markFeedConsumed(pick.feedId)
        setSuccessMessage('This pick was already claimed')
        return
      }

      if (result.success) {
        // Optimistic consumed update — mark BEFORE the refresh kicks
        // off, so the card row flips to "Already Picked" in the same
        // render tick that shows the result modal.
        markFeedConsumed(pick.feedId)
        // Handle substitution items (hourglasses, event tickets) — no card returned
        if (result.isSubstitutionItem) {
          const itemName = result.item?.name || 'Item'
          setPickResult({ cardId: null, cardName: itemName, isSubstitutionItem: true })
          setPickDialogOpen(true)
          setSuccessMessage(`Got ${itemName}!`)

          const historyEntry = {
            id: Date.now(),
            card: { cardId: null, cardName: itemName, isSubstitutionItem: true },
            isSubstitutionItem: true,
            packName: pick.packName || pick.packId,
            playerName: pick.playerName,
            timestamp: new Date().toISOString(),
            isNew: false,
          }
          const newHistory = [historyEntry, ...pickHistory].slice(0, 50)
          setPickHistory(newHistory)
          localStorage.setItem('wonderPickHistory', JSON.stringify(newHistory))
          await loadWonderPickData()
          return
        }

        const card = result.card || { cardId: null, cardName: null, rarity: null, isNew: false }
        setPickResult({ ...card, cardDetailsUnavailable: result.cardDetailsUnavailable })
        setPickDialogOpen(true)

        if (result.cardDetailsUnavailable) {
          setSuccessMessage(t('wonderpick.pickCompletedNoDetails') || 'Pick completed! Card added to your collection.')
        } else {
          setSuccessMessage(`Got ${card.cardName || card.cardId || 'a card'}!`)
        }

        // Add to history
        const historyEntry = {
          id: Date.now(),
          card,
          cardDetailsUnavailable: result.cardDetailsUnavailable,
          packName: pick.packName || pick.packId,
          playerName: pick.playerName,
          timestamp: new Date().toISOString(),
          isNew: card.isNew,
        }
        const newHistory = [historyEntry, ...pickHistory].slice(0, 50) // Keep last 50
        setPickHistory(newHistory)
        localStorage.setItem('wonderPickHistory', JSON.stringify(newHistory))

        // Refresh data after successful pick
        await loadWonderPickData()
      } else {
        setError(result.error || 'Failed to perform wonder pick')
      }
    } catch (err) {
      console.error('Wonder pick failed:', err)
      setError(`Wonder pick failed: ${err.message}`)
    } finally {
      setPickingFeed(null)
    }
  }

  // Format expiry time
  // Phase 5.7 — Decision Language: Title Case 'Expired' instead of
  // ALL CAPS enum echo.
  const formatExpiry = (date, isExpired) => {
    if (isExpired) return 'Expired'
    if (!date) return 'Unknown'

    const now = new Date()
    const diff = date - now
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `in ${minutes}m`
    }
    return 'Expiring soon'
  }

  // Format stamina regen countdown
  const formatTimeDuration = (ms) => {
    if (ms <= 0) return 'Ready!'
    const totalMin = Math.floor(ms / 60000)
    const hours = Math.floor(totalMin / 60)
    const minutes = totalMin % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatStaminaRegen = (healAt) => {
    if (!healAt || healAt === 0) return null
    const healTime = typeof healAt === 'number' ? healAt * 1000 : new Date(healAt).getTime()
    if (isNaN(healTime)) return null
    const diff = healTime - Date.now()
    return formatTimeDuration(diff)
  }

  // Full recovery: time for ALL missing stamina points (not just next one)
  const getFullRecoveryLabel = () => {
    if (!resources.healAt || resources.stamina >= resources.maxStamina) return null
    const healTime = typeof resources.healAt === 'number' ? resources.healAt * 1000 : new Date(resources.healAt).getTime()
    if (isNaN(healTime)) return null
    const nextPointMs = healTime - Date.now()
    if (nextPointMs <= 0) return null
    const missingAfterNext = resources.maxStamina - resources.stamina - 1
    const healSec = 43200 // 12h per point — from proto healSecPerPower
    const fullMs = nextPointMs + (missingAfterNext * healSec * 1000)
    return `Full: ${formatTimeDuration(fullMs)}`
  }

  // Wonder Pick Card component (face-up)
  const WonderPickCard = ({ card, isOwned, ownedCount, isExpired }) => (
    <Box
      sx={{
        // Phase 4.7 — responsive grid: 3 cards on xs (375px), 4 on sm,
        // fixed 140px on md+. Old fixed 5-across at xs crushed cards
        // to ~56px wide → unreadable. minWidth 90px is the floor below
        // which a card image can't render rarity/HP legibly.
        width: { xs: '33.333%', sm: '25%', md: 140 },
        minWidth: { xs: 90, sm: 'auto' },
        flexShrink: { xs: 1, sm: 0 },
        position: 'relative',
      }}
    >
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: `2px solid ${RARITY_COLORS[card?.rarityCode] || '#ccc'}`,
          position: 'relative',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'scale(1.03)',
            boxShadow: `0 8px 24px ${RARITY_COLORS[card?.rarityCode] || 'rgba(0,0,0,0.3)'}66`,
          },
        }}
      >
        <Box
          component="img"
          src={card.cardId ? cardsApi.getImageUrl(card.cardId) : '/card-placeholder.png'}
          alt={getCardDisplayName(card) || card.cardId}
          sx={{
            width: '100%',
            aspectRatio: '5 / 7',
            objectFit: 'contain',
            display: 'block',
            filter: isExpired ? 'grayscale(50%)' : 'none',
          }}
          onError={(e) => { e.target.src = '/card-placeholder.png' }}
        />

        {/* Expired overlay */}
        {isExpired && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              px: 2,
              py: 0.5,
              borderRadius: 1,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            EXPIRED
          </Box>
        )}
      </Box>

      {/* Card info badge */}
      <Box
        sx={{
          position: 'absolute',
          bottom: -8,
          right: 4,
          bgcolor: isOwned ? '#4caf50' : RARITY_COLORS[card?.rarity || card?.rarityCode] || '#666',
          color: 'white',
          borderRadius: 1,
          px: 1,
          py: 0.25,
          fontSize: '0.65rem',
          fontWeight: 600,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        {isOwned ? `x${ownedCount}` : card.rarity || card.rarityCode || '?'}
      </Box>

      {/* Card name */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          textAlign: 'center',
          mt: 1.5,
          fontSize: '0.65rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {getCardDisplayName(card) || card.cardId || 'Unknown'}
      </Typography>
    </Box>
  )

  // Wonder Pick Row component
  const WonderPickRow = ({ pick }) => (
    <Box
      sx={{
        p: 2,
        mb: 2,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        alignItems: 'center',
        // Apr 2026 — consumed rows render at reduced opacity with a
        // muted grey border so the operator instantly distinguishes
        // "already picked" from live actionable picks. Placed above
        // the expired opacity rule so consumed+expired lands on
        // consumed styling (most recent user context).
        opacity: pick.pickStatus === 'consumed' ? 0.55 : (pick.isExpired ? 0.7 : 1),
        borderRadius: '14px',
        border: pick.pickStatus === 'consumed'
          ? `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'}`
          : pick.feedType === 'FREE'
            ? '2px solid #34D399'
            : `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: pick.feedType === 'FREE' ? '#34D399' : 'rgba(124, 138, 255, 0.3)',
          transform: 'translateY(-2px)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)',
        },
      }}
    >
      {/* Cards */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1, sm: 1.5 },
          flexWrap: 'nowrap',
          pb: 1,
          flex: 1,
          width: '100%',
        }}
      >
        {(pick.cards || []).length > 0 ? (
          pick.cards.map((card, idx) => (
            <WonderPickCard
              key={card.cardId || idx}
              card={card}
              isOwned={ownedCards.has(card.cardId)}
              ownedCount={ownedCards.get(card.cardId) || 0}
              isExpired={pick.isExpired}
            />
          ))
        ) : (
          // Show placeholder cards if no card data
          [...Array(5)].map((_, idx) => (
            <Box
              key={idx}
              sx={{
                width: { xs: '33.333%', sm: '25%', md: 140 },
                aspectRatio: '5 / 7',
                minWidth: { xs: 90, sm: 'auto' },
                flexShrink: { xs: 1, sm: 0 },
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography color="text.secondary" variant="caption">?</Typography>
            </Box>
          ))
        )}
        {/* Substitution rewards (event WPs) — render alongside cards
            so the user can see "this pick may yield X" before clicking.
            Each rendered with the canonical local asset from rewardAssets. */}
        {(pick.substitutionItems || []).filter(s => !s.disable).map((subItem, idx) => {
          const asset = getRewardAsset(subItem.rewardKey)
          const label = asset?.label || subItem.name || 'Reward'
          const amt = subItem.amount || 1
          return (
            <Box
              key={`sub-${idx}`}
              title={`${label}${amt > 1 ? ` × ${amt}` : ''}`}
              sx={{
                width: { xs: '33.333%', sm: '25%', md: 140 },
                aspectRatio: '5 / 7', minWidth: { xs: 90, sm: 'auto' },
                flexShrink: { xs: 1, sm: 0 },
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.05)',
                border: '1px solid rgba(76, 175, 80, 0.25)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 0.5, p: 1,
              }}
            >
              {asset
                ? (
                  <img
                    src={asset.src}
                    alt={asset.alt}
                    loading="lazy"
                    style={{ width: '60%', height: 'auto', objectFit: 'contain' }}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ) : (
                  <Typography color="text.secondary" variant="caption" sx={{ fontWeight: 700 }}>?</Typography>
                )}
              <Typography sx={{ fontSize: '0.6rem', textAlign: 'center', fontWeight: 600, lineHeight: 1.1 }}>
                {label}
              </Typography>
              {amt > 1 && (
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#4caf50' }}>
                  × {amt}
                </Typography>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Info panel */}
      <Box
        sx={{
          minWidth: { xs: '100%', md: 200 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 2,
          borderRadius: '10px',
          bgcolor: pick.feedType === 'FREE'
            ? (isDark ? 'rgba(76,175,80,0.08)' : 'rgba(52, 211, 153, 0.08)')
            : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
          border: `1px solid ${pick.feedType === 'FREE' ? 'rgba(52,211,153,0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}`,
        }}
      >
        {/* Feed Type Badge */}
        {pick.feedType === 'FREE' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CheckIcon sx={{ fontSize: 16, color: '#34D399' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#34D399', fontSize: '0.75rem', letterSpacing: 0.5 }}>
              FREE PICK
            </Typography>
          </Box>
        )}

        {/* Pack */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: 54, flexShrink: 0 }}>
            Pack
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <PackIcon sx={{ fontSize: 14, color: theme.palette.secondary.light, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
              {getPackDisplayName(pick.packName, pick.packId)}
            </Typography>
          </Box>
        </Box>

        {/* Player */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: 54, flexShrink: 0 }}>
            Player
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Avatar sx={{ width: 18, height: 18, fontSize: 9 }}>
              {(pick.playerName || 'F')[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
              {pick.playerName || 'Friend'}
            </Typography>
            {pick.isFriend === true && (
              <Chip label="FRIEND" size="small" sx={{
                height: 16, fontSize: '0.55rem', fontWeight: 700,
                bgcolor: `${theme.palette.info.main}20`,
                color: theme.palette.info.main,
              }} />
            )}
            {pick.isFriend === true && pick.playerId && (
              <>
                {alivePlayers.has(pick.playerId) ? (
                  <Chip label="LIVE" size="small" sx={{
                    height: 16, fontSize: '0.55rem', fontWeight: 700, ml: 0.3,
                    bgcolor: 'success.main', color: '#fff',
                  }} />
                ) : (
                  <Tooltip title="Mark as LIVE god pack" arrow>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleMarkLive(pick); }}
                      disabled={markingLive === pick.playerId}
                      sx={{ p: 0.2, ml: 0.3, color: 'text.disabled', '&:hover': { color: 'success.main' } }}
                    >
                      {markingLive === pick.playerId
                        ? <CircularProgress size={12} />
                        : <CheckIcon sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Remove this friend" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFriend(pick); }}
                    disabled={removingFriend === pick.playerId}
                    sx={{ p: 0.2, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                  >
                    {removingFriend === pick.playerId
                      ? <CircularProgress size={12} />
                      : <PersonRemoveIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>

        {/* Expiry */}
        {pick.expiryDate && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 54, flexShrink: 0 }}>
              Expires
            </Typography>
            <Typography variant="caption" color={pick.isExpired ? 'error' : 'text.secondary'} sx={{ fontSize: '0.78rem' }}>
              {formatExpiry(pick.expiryDate, pick.isExpired)}
            </Typography>
          </Box>
        )}

        {/* Need score — how many cards you don't own */}
        {(pick.cards || []).length > 0 && (() => {
          const unowned = (pick.cards || []).filter(c => !ownedCards.has(c.cardId) || ownedCards.get(c.cardId) === 0).length
          if (unowned === 0) return null
          return (
            <Chip
              label={`${unowned} card${unowned > 1 ? 's' : ''} you need`}
              size="small"
              color={unowned >= 3 ? 'success' : unowned >= 2 ? 'info' : 'default'}
              variant="outlined"
              sx={{ fontSize: '0.68rem', height: 20, fontWeight: 600, mb: 0.5 }}
            />
          )
        })()}

        {/* Apr 2026 — consumed picks render a non-clickable chip
            instead of a LoadingButton so repeated clicks are
            structurally impossible (no button to click). Live picks
            keep the same LoadingButton + disabled-rule defense that
            was here before, plus a new pickStatus guard. */}
        {pick.pickStatus === 'consumed' ? (
          <Chip
            icon={<CheckIcon sx={{ fontSize: 14 }} />}
            label="Already Picked"
            size="small"
            variant="outlined"
            sx={{
              mt: 0.5,
              width: '100%',
              height: 32,
              fontWeight: 600,
              fontSize: '0.75rem',
              color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          />
        ) : (
          <LoadingButton
            loading={pickingFeed === pick.feedId}
            fullWidth
            disabled={
              pick.pickStatus !== 'available' ||
              pick.isExpired ||
              (resources.stamina < pick.staminaRequired && pick.feedType !== 'FREE')
            }
            onClick={() => handlePick(pick)}
            sx={{
              mt: 0.5,
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              py: 0.75,
              bgcolor: pick.isExpired ? '#ccc' : 'accent.main',
              '&:hover': {
                bgcolor: 'accent.dark',
              },
              '&:disabled': {
                background: isDark ? '#444' : '#ccc',
                color: isDark ? '#999' : '#666',
              },
            }}
          >
            {pick.feedType === 'FREE' ? 'PICK (FREE)' : `PICK (${pick.staminaRequired} stamina)`}
          </LoadingButton>
        )}
      </Box>
    </Box>
  )

  if (loading || accountsLoading) {
    return <WonderPickSkeleton count={3} />
  }

  return (
    <FadeIn duration={0.3}>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<GlassIcon />}
        title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{t('nav.wonderPick')}<AccountBadge /></Box>}
        subtitle={t('wonderpick.subtitle')}
      />

      {/* Help Info */}
      <CollapsibleHelp>
        <ul>
          <li><strong>Stamina (Challenge Power):</strong> Regenerates over time, required for most picks</li>
          <li><strong>WP Chargers:</strong> Can be used to refill Wonder Pick stamina</li>
          <li><strong>FREE picks:</strong> Green-bordered picks cost no stamina - grab these first!</li>
          <li><strong>Expiring picks:</strong> Check the countdown timers - expired picks cannot be claimed</li>
          <li><strong>Hourglasses:</strong> Can be exchanged for stamina when you run low</li>
        </ul>
      </CollapsibleHelp>

      {/* ═══ STAMINA HERO — primary constraint, drives all decisions ═══ */}
      {selectedAccount && !loadingData && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 2, mb: 2, px: 2.5, py: 1.5,
          borderRadius: '12px',
          bgcolor: resources.stamina > 0
            ? (isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)')
            : (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)'),
          border: `1px solid ${resources.stamina > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
        }}>
          <StaminaIcon sx={{
            fontSize: 28,
            color: resources.stamina > 0 ? theme.palette.success.main : theme.palette.error.main,
          }} />
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography sx={{
                fontSize: '1.5rem', fontWeight: 800, lineHeight: 1,
                fontFamily: '"JetBrains Mono", monospace',
                color: resources.stamina > 0 ? theme.palette.success.main : theme.palette.error.main,
              }}>
                {resources.stamina}/{resources.maxStamina}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                stamina
              </Typography>
            </Box>
            {resources.healAt && resources.stamina < resources.maxStamina && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Next in {formatStaminaRegen(resources.healAt)}
                </Typography>
                {getFullRecoveryLabel() && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', ml: 1 }}>
                    ({getFullRecoveryLabel()})
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          {/* Resource counts shown in action bar below — no duplication here */}
        </Box>
      )}

      {/* Control bar */}
      <Box
        sx={{
          p: 2,
          mb: 3,
          borderRadius: '14px',
          border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        {/* Account selector */}
        <AccountSelector label={t('wonderpick.selectAccount')} minWidth={200} hideIfSingle={false} />

        {/* Phase 3 — freshness pill from /api/wonderpicks/feed.
            Renders only after the cache is warmed by the first
            tasksApi.getWonderPicks() call. Does not gate the UI. */}
        {feedMeta && (
          <FreshnessIndicator
            lastUpdatedAt={feedMeta.lastUpdatedAt}
            cacheStatus={feedMeta.cacheStatus}
            cacheAgeMs={feedMeta.cacheAgeMs}
            warmHint={feedMeta.warmHint}
            variant="detail"
            sx={{ alignSelf: 'center' }}
          />
        )}

        <Button
          variant="contained"
          startIcon={loadingData ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          onClick={loadWonderPickData}
          disabled={!selectedAccount || loadingData}
          sx={{
            borderRadius: '8px',
            bgcolor: 'accent.main',
            color: '#fff',
            '&:hover': { bgcolor: 'accent.dark' },
          }}
        >
          {loadingData ? t('common.loading') : t('wonderpick.loadData')}
        </Button>

        {/* Resources display */}
        {selectedAccount && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Stamina / Challenge Power */}
            <Tooltip title="Challenge Power for Wonder Pick">
              <Chip
                icon={<StaminaIcon sx={{ fontSize: 16 }} />}
                label={`${resources.stamina}/${resources.maxStamina}`}
                color={resources.stamina > 0 ? 'success' : 'default'}
                variant="outlined"
                size="small"
              />
            </Tooltip>

            {/* Stamina Regen Timer */}
            {resources.healAt && resources.stamina < resources.maxStamina && (
              <Tooltip title="Time until next stamina point">
                <Chip
                  icon={<TimerIcon sx={{ fontSize: 16 }} />}
                  label={formatStaminaRegen(resources.healAt)}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              </Tooltip>
            )}

            {/* WP Chargers (challengePowerChargers) — refill Wonder Pick stamina */}
            <Tooltip title="WP Chargers — use to refill Wonder Pick stamina">
              <Chip
                icon={<GlassIcon sx={{ fontSize: 16 }} />}
                label={`${resources.wpChargers || 0} WP Chargers`}
                color="secondary"
                variant="outlined"
                size="small"
              />
            </Tooltip>

            {/* Pack HG not shown here — belongs on pack opening page */}

            {/* Heal Buttons - show when stamina is below max */}
            {/* Each charger advances regen by 1hr. healSecPerPower=43200 (12hr) → 12 chargers = +1 stamina */}
            {resources.stamina < resources.maxStamina && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Tooltip title="Uses 12 chargers to restore 1 stamina point">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={healLoading ? <CircularProgress size={14} /> : <HealIcon />}
                    disabled={healLoading}
                    onClick={async () => {
                      const result = await doHeal(12, 0)
                      if (result.success) setSuccessMessage('Challenge power +1! Refreshing...')
                      else setError(`Heal failed: ${result.error}`)
                    }}
                    sx={{ textTransform: 'none', borderColor: '#4caf50', color: '#4caf50', '&:hover': { borderColor: '#388e3c', backgroundColor: 'rgba(76, 175, 80, 0.08)' } }}
                  >
                    +1 Stamina
                  </Button>
                </Tooltip>
                <Tooltip title={`Uses ${(resources.maxStamina - resources.stamina) * 12} chargers to fully restore stamina`}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={healLoading ? <CircularProgress size={14} /> : <HealIcon />}
                    disabled={healLoading}
                    onClick={async () => {
                      const needed = (resources.maxStamina - resources.stamina) * 12
                      const result = await doHeal(needed, 0)
                      if (result.success) setSuccessMessage(`Challenge power full! Used ${needed} chargers. Refreshing...`)
                      else setError(`Heal failed: ${result.error}`)
                    }}
                    sx={{ textTransform: 'none', borderColor: '#ff9800', color: '#ff9800', '&:hover': { borderColor: '#f57c00', backgroundColor: 'rgba(255, 152, 0, 0.08)' } }}
                  >
                    Full Refill
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* No account selected message */}
      {!selectedAccount && (
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <EmptyState
            icon={<SyncIcon sx={{ fontSize: 64 }} />}
            title={t('wonderpick.selectAccountToView')}
            description="Choose an account above to load your available wonder picks"
            minHeight={200}
          />
        </Box>
      )}

      {/* Loading state */}
      {selectedAccount && loadingData && (
        <WonderPickSkeleton count={3} />
      )}

      {/* Wonder Pick List */}
      {selectedAccount && !loadingData && wonderPicks.length === 0 && (
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <EmptyState
            icon={<PackIcon sx={{ fontSize: 64 }} />}
            title={t('wonderpick.noPicksAvailable')}
            description="No wonder picks are currently available. Check back later!"
            minHeight={200}
          />
        </Box>
      )}

      {selectedAccount && !loadingData && wonderPicks.length > 0 && (
        <Box>
          {wonderPicks.map((pick) => (
            <WonderPickRow key={pick.id || pick.feedId} pick={pick} />
          ))}
        </Box>
      )}

      {/* Pick History Section */}
      {pickHistory.length > 0 && (
        <Box
          sx={{
            mt: 4,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            overflow: 'hidden',
          }}
        >
          {/* History header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1.75,
              borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            <HistoryIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
            <Typography variant="subtitle2" fontWeight={700}>
              {t('wonderpick.pickHistory')} ({pickHistory.length})
            </Typography>
          </Box>
          <Box sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
              {pickHistory.slice(0, 20).map((entry) => (
                <Box
                  key={entry.id}
                  sx={{
                    // Phase 25F — both minWidth AND maxWidth so the
                    // flex child can't balloon past HISTORY_CARD_MAX_WIDTH
                    // even if a future change removes the image's own
                    // maxWidth. Matches the shared size contract.
                    minWidth: HISTORY_CARD_MAX_WIDTH,
                    maxWidth: HISTORY_CARD_MAX_WIDTH,
                    flex: `0 0 ${HISTORY_CARD_MAX_WIDTH}px`,
                    textAlign: 'center',
                  }}
                >
                  <Box
                    sx={{
                      borderRadius: 2,
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      border: `2px solid ${RARITY_COLORS[entry.card?.rarity || entry.card?.rarityCode] || '#ccc'}`,
                      mb: 1,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'scale(1.03)',
                        boxShadow: `0 6px 16px ${RARITY_COLORS[entry.card?.rarity || entry.card?.rarityCode] || 'rgba(0,0,0,0.2)'}55`,
                      },
                    }}
                  >
                    <HistoryCardImage
                      cardId={entry.card?.cardId}
                      alt={getCardDisplayName(entry.card) || 'Card'}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', fontSize: '0.65rem' }}>
                    {getCardDisplayName(entry.card) || entry.card?.cardId || 'Unknown'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </Typography>
                  {entry.isNew && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', fontWeight: 700, fontSize: '0.6rem' }}>
                      NEW
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
            {pickHistory.length > 20 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('wonderpick.showingPicks').replace('{count}', pickHistory.length)}
              </Typography>
            )}
            <Button
              size="small"
              color="error"
              onClick={() => {
                setPickHistory([])
                localStorage.removeItem('wonderPickHistory')
              }}
              sx={{ mt: 1 }}
            >
              {t('wonderpick.clearHistory')}
            </Button>
          </Box>
        </Box>
      )}

      {/* Pick Result Dialog */}
      <Dialog open={pickDialogOpen} onClose={() => setPickDialogOpen(false)} maxWidth="sm">
        <DialogTitle>Wonder Pick Result</DialogTitle>
        <DialogContent>
          {pickResult && pickResult.isSubstitutionItem ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box sx={{ fontSize: 64, mb: 2 }}>
                {pickResult.cardName?.includes('Hourglass') ? '\u23F3' : '\uD83C\uDF9F\uFE0F'}
              </Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {pickResult.cardName || 'Item Obtained!'}
              </Typography>
              <Typography color="text.secondary">
                Item has been added to your inventory.
              </Typography>
            </Box>
          ) : pickResult && pickResult.cardDetailsUnavailable ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box
                component="img"
                src="/card-placeholder.png"
                alt="Card"
                sx={{
                  width: 200,
                  height: 280,
                  objectFit: 'contain',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  mb: 2,
                  opacity: 0.5,
                }}
              />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Pick Completed!
              </Typography>
              <Typography color="text.secondary">
                Card added to your collection. Check in-game to see details.
              </Typography>
            </Box>
          ) : pickResult && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box
                component="img"
                src={pickResult.cardId ? cardsApi.getImageUrl(pickResult.cardId) : '/card-placeholder.png'}
                alt={getCardDisplayName(pickResult) || pickResult.cardId}
                sx={{
                  width: 200,
                  height: 280,
                  objectFit: 'contain',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  mb: 2,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'scale(1.03)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
                }}
                onError={(e) => { e.target.src = '/card-placeholder.png' }}
              />
              <Typography variant="h6" sx={{ mb: 1 }}>
                {getCardDisplayName(pickResult) || pickResult.cardId}
              </Typography>
              <Typography color="text.secondary">
                {pickResult.rarity || pickResult.rarityDisplay || ''} {pickResult.pack ? `- ${getSetDisplayName(pickResult.pack)}` : ''}
              </Typography>
              {pickResult.isNew && (
                <Typography color="success.main" sx={{ mt: 1, fontWeight: 700 }}>
                  NEW CARD!
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Phase 4.8 — Success Snackbar (unified styling/duration/anchor).
          successMessage is a plain string today; treat as info severity. */}
      <Snackbar
        open={!!successMessage}
        onClose={() => setSuccessMessage('')}
        {...getSnackbarProps({ severity: 'info', isMobile: isPhone })}
      >
        <MuiAlert
          severity="info"
          variant="filled"
          elevation={6}
          sx={getAlertSx(theme)}
        >
          {successMessage}
        </MuiAlert>
      </Snackbar>
    </Box>
    </FadeIn>
  )
}

export default WonderPick
