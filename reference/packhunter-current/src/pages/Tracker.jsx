import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FadeIn } from '../components/Animations'
import CollapsibleHelp from '../components/CollapsibleHelp'
import SyncStatusChip from '../components/SyncStatusChip'
import {
  Box,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
  TextField,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  InputAdornment,
  useMediaQuery,
  useTheme,
  Popover,
  Fab,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Sync as SyncIcon,
  CatchingPokemon as PokeballIcon,
  Star as StarIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Upload as UploadIcon,
  FileDownload as ExportIcon,
  DoneAll as MarkAllIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Assessment as StatsIcon,
  DeleteForever as DeleteForeverIcon,
  TrendingUp as TrendingUpIcon,
  Lightbulb as LightbulbIcon,
  Psychology as StrategyIcon,
  SwapHoriz as TradeIcon,
} from '@mui/icons-material'
import {
  CardGiftcard as CardGiftcardIcon,
  SwapHoriz as SwapHorizIcon,
  AutoAwesome as AutoSyncIcon,
  LocalOffer as OfferTradeIcon,
  FavoriteBorder as WishlistIcon,
} from '@mui/icons-material'
import { collection as collectionApi, collectionSync as collectionSyncApi, cards as cardsApi, accounts as accountsApi, autoTrade as autoTradeApi, autoGift as autoGiftApi, missingCards as missingCardsApi, manualTrade as manualTradeApi, wishlist as wishlistApi, missions as missionsApi, unifiedSync } from '../services/api'
import { useLocalizedCardName, getCardDisplayName } from '../hooks/useLocalizedCards'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import {
  exportCollectionCSV,
  exportCollectionJSON,
  exportSetProgress,
  exportRarityStats,
  exportFullReport,
} from '../utils/exportUtils'
import PackRecommendation from '../components/PackRecommendation'
import { EmptyState } from '../components/EmptyState'
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons'
import { RARITY_COLORS, RARITY_NAMES, TYPE_COLORS, SET_NAMES, PACK_COLORS, getSetDisplayName } from '../constants/gameData'
import { getRarityChipTextColor, RARITY_COLORS_ACCESSIBLE } from '../constants/rarityConfig'
import missionData from '../data/missions.json'
import { isCardTradable, GIFTABLE_RARITIES, isGroupSatisfied, evaluateMission, getAllMissionCardIds, getEvaluableMissions, scoreMission, getUnsatisfiedRequirements } from '../utils/missionHelpers'
import { loadCompletedMissions, markMissionsCompleted, loadManualCompletions } from '../utils/completionPersistence'
import { getSocket } from '../services/socket'

// Rarity glow for card tiles (matching Cards page)
const RARITY_GLOW = {
  'C': 'none', 'U': '0 0 12px rgba(192, 192, 192, 0.3)',
  'R': '0 0 14px rgba(255, 215, 0, 0.35)', 'RR': '0 0 16px rgba(255, 215, 0, 0.4)',
  'AR': '0 0 16px rgba(168, 85, 247, 0.4)', 'SR': '0 0 18px rgba(255, 215, 0, 0.5)',
  'SAR': '0 0 18px rgba(244, 67, 54, 0.5)', 'IM': '0 0 20px rgba(168, 85, 247, 0.5)',
  'UR': '0 0 22px rgba(255, 215, 0, 0.6)', 'S': '0 0 16px rgba(192, 192, 192, 0.4)',
  'SSR': '0 0 20px rgba(192, 192, 192, 0.5)', 'P': 'none',
}

// Left sidebar width
const LEFT_SIDEBAR_WIDTH = 280
const RIGHT_SIDEBAR_WIDTH = 280

// Trade/gift eligibility imported from utils/missionHelpers

// ── Scoring Config (single tuning point for all strategy logic) ──
const SCORING = {
  // Rarity tier values — used for weighting missing cards & prioritization
  // Scale: 0–10, exponential-ish to reflect actual pull difficulty
  rarity: {
    'UR': 10, 'IM': 8.5, 'SAR': 7, 'SR': 5.5, 'AR': 4, 'SSR': 4,
    'RR': 2.5, 'S': 1.5, 'R': 1.5, 'U': 0.5, 'C': 0.2, 'P': 0,
  },
  // Set completion — bonus multipliers based on how close to done
  setCompletion: {
    thresholds: [
      { minPct: 95, bonus: 3.0, label: 'near-perfect' },
      { minPct: 85, bonus: 2.2, label: 'almost done' },
      { minPct: 70, bonus: 1.6, label: 'strong progress' },
      { minPct: 50, bonus: 1.2, label: 'half done' },
      { minPct: 0,  bonus: 1.0, label: 'early' },
    ],
    // Urgency curve: fewer missing → exponentially higher urgency
    // Formula: urgency = baseUrgency + (urgencyScale / missing)
    baseUrgency: 5,
    urgencyScale: 30,   // 1 missing → 35pts, 3 missing → 15pts, 10 missing → 8pts
    urgencyCap: 40,
  },
  // Pack efficiency — how to score a pack's value
  pack: {
    // Efficiency = missing cards covered / diminishing factor for large sets
    // Packs covering near-complete sets get proximity bonus (from setCompletion)
    // Packs with fewer missing cards per set have higher hit rate
    hitRateBonusThreshold: 15,  // ≤ this many missing → bonus
    hitRateBonus: 1.4,
    largSetPenalty: 0.75,       // > 40 missing → penalty
    largSetThreshold: 40,
  },
  // Action ranking — final weights when combining different action types
  action: {
    setWeight: 1.0,     // "complete set X" actions
    packWeight: 0.7,    // "open pack X" actions
    rarityWeight: 0.85, // "hunt rarity X" actions
  },
}

// Helper: get set completion bonus from thresholds
function getCompletionBonus(pct) {
  for (const t of SCORING.setCompletion.thresholds) {
    if (pct >= t.minPct) return { bonus: t.bonus, label: t.label }
  }
  return { bonus: 1.0, label: 'early' }
}

// Helper: compute urgency score from missing count (higher = more urgent)
function getUrgencyScore(missing) {
  if (missing <= 0) return 0
  const raw = SCORING.setCompletion.baseUrgency + (SCORING.setCompletion.urgencyScale / missing)
  return Math.min(raw, SCORING.setCompletion.urgencyCap)
}

// Helper: compute rarity-weighted value for a rarity code
function getRarityValue(code) {
  return SCORING.rarity[code] || 0
}

// Backward compat alias used by insights
const RARITY_IMPORTANCE = SCORING.rarity

// Pack-to-set mapping (same as PackRecommendation) for lightweight scoring
const INSIGHT_PACKS = [
  { name: 'Paldean Wonders', setCode: 'B2A' },
  { name: 'Gardevoir', setCode: 'B2' },
  { name: 'Mega Shine', setCode: 'B2B' },
  { name: 'Crimson Blaze', setCode: 'B1A' },
  { name: 'Mega Blaziken', setCode: 'B1' },
  { name: 'Mega Gyarados', setCode: 'B1' },
  { name: 'Mega Altaria', setCode: 'B1' },
  { name: 'Deluxe Pack ex', setCode: 'A4B' },
  { name: 'Secluded Springs', setCode: 'A4A' },
  { name: 'Ho-Oh', setCode: 'A4' },
  { name: 'Lugia', setCode: 'A4' },
  { name: 'Eevee Grove', setCode: 'A3B' },
  { name: 'Dimensional Crisis', setCode: 'A3A' },
  { name: 'Solgaleo', setCode: 'A3' },
  { name: 'Lunala', setCode: 'A3' },
  { name: 'Shining Revelry', setCode: 'A2B' },
  { name: 'Triumphant Light', setCode: 'A2A' },
  { name: 'Dialga', setCode: 'A2' },
  { name: 'Palkia', setCode: 'A2' },
  { name: 'Mythical Island', setCode: 'A1A' },
  { name: 'Mewtwo', setCode: 'A1' },
  { name: 'Charizard', setCode: 'A1' },
  { name: 'Pikachu', setCode: 'A1' },
]

function Tracker({ user }) {
  const { isDark } = useThemeMode()
  const { t } = useLanguage()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [summary, setSummary] = useState(null)
  const [sets, setSets] = useState([])
  const [rarityStats, setRarityStats] = useState([])
  const [typeStats, setTypeStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  // Premium features state
  const isPremium = user?.subscriptionTier === 'premium' || user?.subscriptionTier === 'admin'
  const [actionLoading, setActionLoading] = useState(null) // null = idle, 'gift'|'trade'|'offer'|'sync' = which action is loading
  const [syncSettings, setSyncSettings] = useState(null)
  const [missingSummary, setMissingSummary] = useState(null)
  const [missingRarityFilter, setMissingRarityFilter] = useState('')

  // Load persisted filters from localStorage
  const getPersistedFilters = () => {
    try {
      const saved = localStorage.getItem('trackerPageFilters')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  }
  const persistedFilters = getPersistedFilters()

  // Wave 7: tab state in URL. ?tab=all|owned|missing. URL takes priority
  // over localStorage so deep links are honored. localStorage is still
  // updated as a fallback for users without query strings.
  const [searchParams, setSearchParams] = useSearchParams()
  const TAB_VALUES = ['all', 'owned', 'missing']
  const initialFilterTab = useMemo(() => {
    const fromUrl = searchParams.get('tab')
    if (TAB_VALUES.includes(fromUrl)) return fromUrl
    return persistedFilters.filterTab || 'all'
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Selected set and detail view
  const [selectedSet, setSelectedSet] = useState(persistedFilters.selectedSet || null)
  const [setDetail, setSetDetail] = useState(null)
  const [loadingSet, setLoadingSet] = useState(false)

  // Card filter tab: 'all', 'owned', 'missing' (URL + localStorage persistence)
  const [filterTab, setFilterTabState] = useState(initialFilterTab)
  const [searchQuery, setSearchQuery] = useState(persistedFilters.searchQuery || '')

  // Wrapped setter: writes URL query param so deep-links + back-button work
  const setFilterTab = (next) => {
    setFilterTabState(next)
    const sp = new URLSearchParams(searchParams)
    if (next === 'all') sp.delete('tab')
    else sp.set('tab', next)
    setSearchParams(sp, { replace: true })
  }

  // Persist filters to localStorage when they change (fallback for query-less navigations)
  useEffect(() => {
    const filters = { filterTab, searchQuery, selectedSet }
    localStorage.setItem('trackerPageFilters', JSON.stringify(filters))
  }, [filterTab, searchQuery, selectedSet])

  // Card edit dialog
  const [editCard, setEditCard] = useState(null)

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState('')
  const [importing, setImporting] = useState(false)

  // Sync from game state
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [selectedSyncAccount, setSelectedSyncAccount] = useState('')
  const [syncing, setSyncing] = useState(false)

  // Account filter for per-account tracking
  const [accountFilter, setAccountFilter] = useState('all') // 'all' or account id string
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Rarity missing cards dialog
  const [rarityMissingOpen, setRarityMissingOpen] = useState(false)
  const [rarityMissingData, setRarityMissingData] = useState(null) // { rarityCode, sets, totalMissing }
  const [rarityMissingLoading, setRarityMissingLoading] = useState(false)

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportIncludeOwned, setExportIncludeOwned] = useState(true)
  const [exportIncludeMissing, setExportIncludeMissing] = useState(true)
  const [exportType, setExportType] = useState('collection') // collection, sets, rarity, full
  const [exporting, setExporting] = useState(false)

  // Rarity filter state
  const [selectedRarities, setSelectedRarities] = useState([])
  const [filterAnchorEl, setFilterAnchorEl] = useState(null)

  // ── Mission data (must be defined before refreshTrackerData uses hourglassCardIds) ──
  const hourglassRelevant = useMemo(() => {
    const evaluable = getEvaluableMissions(missionData?.missions)
    return evaluable.filter(m => m.wonder_hourglass > 0 || m.pack_hourglass > 0)
  }, [])

  const hourglassCardIds = useMemo(() => getAllMissionCardIds(hourglassRelevant), [hourglassRelevant])

  // ── Unified tracker refresh — single orchestration point ──
  // Called on: initial load, sync success, manual card edit, set mark complete
  // Refreshes ALL tracker data for the current accountFilter
  //
  // Wave 1 fix: no longer writes to accountFilter (the state it was
  // depending on). Account auto-selection now lives in a separate
  // mount-only effect below so we don't double-fire the whole data
  // refresh on every page load.
  const refreshTrackerData = async (opts = {}) => {
    const { showLoading = true, refreshSetDetail = true } = opts
    if (showLoading) setLoading(true)
    try {
      // Wave 1.1: no longer calls accountsApi.list() here — the mount-only
      // auto-select effect below owns that fetch. Avoids duplicate request
      // on every refreshTrackerData call (page load + account switches).
      const [summaryData, rarityData] = await Promise.all([
        collectionApi.getSummary(accountFilter),
        collectionApi.getRarityStats(accountFilter),
      ])
      setSummary(summaryData.summary)
      setSets(summaryData.sets || [])
      setRarityStats(rarityData.rarityStats || [])

      setTypeStats([])

      // Refresh mission ownership + game completion (sidebar + scoring)
      if (hourglassCardIds.length > 0) {
        collectionApi.getMissionProgress(hourglassCardIds, accountFilter)
          .then(data => setMissionOwnership(data.owned || {}))
          .catch(() => setMissionOwnership(null))
        setGameCompletedIds(null) // Client-side persistence is source of truth
      }

      // Refresh set detail if one is currently open
      if (refreshSetDetail && selectedSet) {
        loadSetDetail(selectedSet)
      }

      // Refresh premium missing summary
      if (isPremium) {
        missingCardsApi.getSummary(accountFilter !== 'all' ? accountFilter : null)
          .then(setMissingSummary).catch(() => {})
      }
    } catch (error) {
      console.error('Failed to load collection data:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Backward compat alias
  const loadData = refreshTrackerData

  // ── Mount-only account list + auto-select ──────────────────────────
  // Wave 1.1: this is now the SOLE caller of accountsApi.list(). It:
  //   1. populates linkedAccounts (used by the filter dropdown)
  //   2. picks a main account on first load (only if still on 'all')
  // Not re-run when accountFilter changes, so refreshTrackerData doesn't
  // re-fetch the account list on every account switch.
  useEffect(() => {
    let cancelled = false
    accountsApi.list().then(({ accounts = [] }) => {
      if (cancelled) return
      setLinkedAccounts(accounts)
      if (accounts.length === 0) return
      setAccountFilter(prev => {
        if (prev !== 'all') return prev
        const mainAccount = accounts.find(a => a.account_type === 'main') || accounts[0]
        return mainAccount.id.toString()
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, []) // mount-only, intentional

  // ── Data effect: reacts to account changes ─────────────────────────
  // Runs on: initial settled accountFilter, user account switch.
  // No longer double-fires because refreshTrackerData no longer writes
  // to its own dep.
  useEffect(() => {
    refreshTrackerData()
  }, [accountFilter])

  // Listen for trade/gift/sync success → refresh game completion.
  //
  // Wave 2: the handler is debounced by 2s. Rationale: during socket
  // reconnect cycles or bursts (e.g. multiple trades completing back to
  // back), the legacy code fired getGameMissionCompletion synchronously
  // on every event. That method issues a gRPC login internally and is
  // expensive; back-to-back events used to produce duplicate network
  // calls + UI flicker. 2s is short enough to feel immediate yet long
  // enough to coalesce bursts.
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !accountFilter) return

    let timer = null
    const scheduleRefresh = () => {
      if (accountFilter === 'all') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        collectionApi.getGameMissionCompletion(accountFilter, { force: true, reason: 'post_action' })
          .then(data => setGameCompletedIds(new Set(data.completedMissionIds || [])))
          .catch(() => setGameCompletedIds(null))
      }, 2000)
    }

    socket.on('trade_request_completed', scheduleRefresh)
    socket.on('gift_request_completed', scheduleRefresh)
    socket.on('collection:syncComplete', scheduleRefresh)
    return () => {
      if (timer) clearTimeout(timer)
      socket.off('trade_request_completed', scheduleRefresh)
      socket.off('gift_request_completed', scheduleRefresh)
      socket.off('collection:syncComplete', scheduleRefresh)
    }
  }, [accountFilter])

  // Load set detail (respects account filter)
  const loadSetDetail = async (setCode, acctFilter) => {
    setLoadingSet(true)
    setSelectedSet(setCode)
    try {
      const filter = acctFilter !== undefined ? acctFilter : accountFilter
      let data
      if (filter && filter !== 'all') {
        data = await collectionApi.getByAccountSet(filter, setCode)
      } else {
        data = await collectionApi.getSet(setCode)
      }
      setSetDetail(data)
    } catch (error) {
      console.error('Failed to load set detail:', error)
    } finally {
      setLoadingSet(false)
    }
  }

  // Update card ownership
  const handleUpdateCard = async (cardId, newAmount) => {
    try {
      await collectionApi.updateCard(cardId, newAmount, accountFilter)
      if (setDetail) {
        setSetDetail(prev => ({
          ...prev,
          cards: prev.cards.map(c =>
            c.backend_id === cardId ? { ...c, owned: newAmount } : c
          ),
        }))
      }
      if (editCard && editCard.backend_id === cardId) {
        setEditCard(prev => ({ ...prev, owned: newAmount }))
      }
      loadData()
    } catch (error) {
      console.error('Failed to update card:', error)
    }
  }

  // Mark set complete
  const handleMarkSetComplete = async (setCode) => {
    try {
      const result = await collectionApi.markSetComplete(setCode, accountFilter)
      setMessage({ type: 'success', text: result.message || `Marked ${setCode} as complete!` })
      loadData()
      if (selectedSet === setCode) {
        loadSetDetail(setCode)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to mark set complete' })
    }
  }

  // Bulk import
  const handleImport = async () => {
    if (!importData.trim()) {
      setMessage({ type: 'error', text: 'Please paste your collection data' })
      return
    }

    setImporting(true)
    try {
      let cards = []
      try {
        const parsed = JSON.parse(importData)
        if (Array.isArray(parsed)) {
          cards = parsed.map(item => ({
            backendId: item.backendId || item.backend_id || item.card_id || item.id,
            amount: item.amount || item.count || item.qty || 1
          })).filter(c => c.backendId)
        } else if (typeof parsed === 'object') {
          cards = Object.entries(parsed).map(([key, value]) => ({
            backendId: key,
            amount: typeof value === 'number' ? value : (value.amount || value.count || 1)
          }))
        }
      } catch (e) {
        const lines = importData.trim().split('\n')
        for (const line of lines) {
          const match = line.match(/^([A-Za-z0-9-]+)[:\s,]+(\d+)/)
          if (match) {
            cards.push({ backendId: match[1], amount: parseInt(match[2]) })
          }
        }
      }

      if (cards.length === 0) {
        setMessage({ type: 'error', text: 'No valid card data found. Check the format.' })
        setImporting(false)
        return
      }

      const result = await collectionApi.bulkUpdate(cards, accountFilter)
      setMessage({
        type: 'success',
        text: `Imported ${result.updated} cards! Total owned: ${result.ownedCards}`
      })
      setImportOpen(false)
      setImportData('')
      loadData()
    } catch (error) {
      console.error('Import error:', error)
      setMessage({ type: 'error', text: 'Failed to import collection data' })
    } finally {
      setImporting(false)
    }
  }

  // Export collection
  const handleExport = async () => {
    setExporting(true)
    try {
      const dateStr = new Date().toISOString().slice(0, 10)

      if (exportType === 'sets') {
        // Export set progress
        const setsData = sets.map(s => ({
          name: getSetDisplayName(s),
          code: s.set_code,
          owned: s.ownedInSet,
          total: s.totalInSet,
        }))
        exportSetProgress(setsData, `set-progress-${dateStr}.csv`)
        setMessage({ type: 'success', text: 'Set progress exported!' })
      } else if (exportType === 'rarity') {
        // Export rarity stats
        const rarityData = rarityStats.map(r => ({
          rarity: RARITY_NAMES[r.rarity_code] || r.rarity_code,
          owned: r.ownedCards,
          total: r.totalCards,
        }))
        exportRarityStats(rarityData, `rarity-stats-${dateStr}.csv`)
        setMessage({ type: 'success', text: 'Rarity stats exported!' })
      } else if (exportType === 'full') {
        // Export full report (respects account filter)
        const allCards = []
        for (const set of sets) {
          const setData = accountFilter && accountFilter !== 'all'
            ? await collectionApi.getByAccountSet(accountFilter, set.set_code)
            : await collectionApi.getSet(set.set_code)
          for (const card of setData.cards) {
            allCards.push({
              ...card,
              set_name: getSetDisplayName(set),
              set_code: set.set_code,
              owned: card.owned > 0,
              quantity: card.owned,
            })
          }
        }
        exportFullReport({
          summary,
          sets: sets.map(s => ({
            name: getSetDisplayName(s),
            code: s.set_code,
            owned: s.ownedInSet,
            total: s.totalInSet,
          })),
          rarityStats: rarityStats.map(r => ({
            rarity: RARITY_NAMES[r.rarity_code] || r.rarity_code,
            owned: r.ownedCards,
            total: r.totalCards,
          })),
          cards: allCards,
        }, `collection-report-${dateStr}.json`)
        setMessage({ type: 'success', text: 'Full report exported!' })
      } else {
        // Export collection cards (respects account filter)
        const allCards = []
        for (const set of sets) {
          const setData = accountFilter && accountFilter !== 'all'
            ? await collectionApi.getByAccountSet(accountFilter, set.set_code)
            : await collectionApi.getSet(set.set_code)
          for (const card of setData.cards) {
            allCards.push({
              id: card.card_id,
              backend_id: card.backend_id,
              name: card.card_name,
              set: getSetDisplayName(set),
              set_code: set.set_code,
              rarity: RARITY_NAMES[card.rarity_code] || card.rarity_code,
              type: card.card_type || '',
              owned: card.owned > 0,
              quantity: card.owned,
            })
          }
        }

        const options = {
          includeOwned: exportIncludeOwned,
          includeMissing: exportIncludeMissing,
        }

        if (exportFormat === 'csv') {
          exportCollectionCSV(allCards, `collection-${dateStr}.csv`, options)
        } else {
          exportCollectionJSON(allCards, `collection-${dateStr}.json`, options)
        }
        setMessage({ type: 'success', text: 'Collection exported!' })
      }
      setExportDialogOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      setMessage({ type: 'error', text: 'Failed to export collection' })
    } finally {
      setExporting(false)
    }
  }

  // Sync: if account is selected, sync directly; otherwise open dialog
  const handleOpenSyncDialog = async () => {
    // If a specific account is selected in the tracker, sync it directly
    if (accountFilter && accountFilter !== 'all') {
      setSelectedSyncAccount(accountFilter)
      setSyncing(true)
      try {
        const result = await collectionApi.syncFromGame(accountFilter)
        if (result.error) {
          setMessage({ type: 'error', text: result.error })
        } else {
          setMessage({ type: 'success', text: `Synced ${result.cardsSynced} cards from game account!` })
          // Full tracker refresh — updates everything including missions, set detail, stats
          await refreshTrackerData({ showLoading: false })
          // If mission dialog is open, close it (data may have changed — user can re-open)
          if (missionDetailOpen) {
            setMissionDetailOpen(false)
            setMissionDetailData(null)
          }
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Failed to sync from game' })
      } finally {
        setSyncing(false)
      }
      return
    }
    // No account selected — open dialog to pick one
    try {
      const data = await accountsApi.list()
      setLinkedAccounts(data.accounts || [])
      if (data.accounts?.length > 0 && !selectedSyncAccount) {
        setSelectedSyncAccount(data.accounts[0].id.toString())
      }
      setSyncDialogOpen(true)
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load accounts' })
    }
  }

  // Sync from game
  const handleSyncFromGame = async () => {
    if (!selectedSyncAccount) {
      setMessage({ type: 'error', text: 'Please select an account' })
      return
    }
    setSyncing(true)
    try {
      // Phase 25D — single server-side orchestrated sync. The backend
      // endpoint /api/sync/tracker/:accountId runs collection sync and
      // mission sync sequentially and returns a combined result:
      //   { inventorySynced, missionsSynced, cardsUpdated,
      //     missionsChecked, lastSyncedAt, errors }
      // This replaces the Phase 25C pattern where the client called
      // both endpoints itself. Single round-trip + partial-success
      // semantics exposed in one place.
      const result = await unifiedSync.tracker(selectedSyncAccount)

      // Record for the SyncStatusChip so any page can render the
      // current per-account sync truth without re-calling the API.
      const { recordSyncStatus } = await import('../components/SyncStatusChip')
      recordSyncStatus(selectedSyncAccount, result)

      const bothOk = result.inventorySynced && result.missionsSynced
      const inventoryOnly = result.inventorySynced && !result.missionsSynced
      const nothing = !result.inventorySynced

      if (nothing) {
        setMessage({
          type: 'error',
          text: result.errors?.inventory || 'Sync failed — inventory did not update',
        })
        return
      }

      const cardsText = `${result.cardsUpdated} cards`
      const missionsText = result.missionsSynced
        ? `${result.missionsChecked} missions checked`
        : `Missions: ${result.errors?.missions || 'not synced'}`

      setMessage({
        type: bothOk ? 'success' : 'warning',
        text: `Synced ${cardsText} · ${missionsText}`,
      })
      setSyncDialogOpen(false)
      // Full tracker refresh — pulls both inventory + mission state.
      await refreshTrackerData({ showLoading: false })
      if (missionDetailOpen) {
        setMissionDetailOpen(false)
        setMissionDetailData(null)
      }
    } catch (error) {
      console.error('Sync error:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to sync from game' })
    } finally {
      setSyncing(false)
    }
  }

  // === Premium Feature Handlers ===

  // Gift to Me: create an auto-gift request for this card
  const handleGiftToMe = async (card) => {
    setActionLoading('gift')
    try {
      const data = await autoGiftApi.createRequest(card.backend_id)
      setMessage({ type: 'success', text: `Gift request created for ${card.card_name}!` })
      setEditCard(null)
    } catch (err) {
      setMessage({ type: 'error', text: `Gift failed: ${err.message}` })
    } finally { setActionLoading(null) }
  }

  // Trade for This: open confirmation dialog before creating request
  const [tradeConfirmCard, setTradeConfirmCard] = useState(null)
  const [tradeConfirmOpen, setTradeConfirmOpen] = useState(false)
  const [tradeSubmitting, setTradeSubmitting] = useState(false)

  const handleTradeForThis = (card) => {
    setTradeConfirmCard(card)
    setTradeConfirmOpen(true)
  }

  const handleTradeConfirm = async () => {
    if (!tradeConfirmCard) return
    setTradeSubmitting(true)
    try {
      await autoTradeApi.createRequest(tradeConfirmCard.card_id || tradeConfirmCard.backend_id)
      setMessage({ type: 'success', text: `Trade request created for ${tradeConfirmCard.card_name}!` })
      setTradeConfirmOpen(false)
      setTradeConfirmCard(null)
      setEditCard(null)
    } catch (err) {
      setMessage({ type: 'error', text: `Trade request failed: ${err.message}` })
    } finally { setTradeSubmitting(false) }
  }

  // Add to Wishlist from tracker card detail
  // Sends to the correct wishlist (main/alt) based on currently selected account
  const handleAddToWishlist = async (card) => {
    setActionLoading('wishlist')
    try {
      const selectedAccount = linkedAccounts.find(a => a.id.toString() === accountFilter)
      const listType = selectedAccount?.account_type || 'main'
      await wishlistApi.add(card.backend_id, card.card_name, card.rarity_code, card.set_code, undefined, undefined, listType)
      const label = listType === 'alt' ? 'alt' : 'main'
      setMessage({ type: 'success', text: `Added ${card.card_name} to ${label} wishlist!` })
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to add to wishlist: ${err.message}` })
    } finally {
      setActionLoading(null)
    }
  }

  // Offer for Trade (Feature #1): create a manual trade offer — user sends this card away via bot
  const [offerTradeCard, setOfferTradeCard] = useState(null) // card pending account selection
  const [offerTradeAccountId, setOfferTradeAccountId] = useState('')

  const handleOfferTrade = async (card) => {
    // Fetch accounts if not cached
    let accounts = linkedAccounts
    if (!accounts || accounts.length === 0) {
      try {
        const data = await accountsApi.list()
        accounts = data.accounts || []
        setLinkedAccounts(accounts)
      } catch { accounts = [] }
    }
    if (accounts.length === 0) {
      setMessage({ type: 'error', text: 'No linked game account — go to Accounts page to link one' })
      return
    }
    // Single account: submit directly. Multiple accounts: prompt selection.
    if (accounts.length === 1) {
      submitOfferTrade(card, accounts[0].id)
    } else {
      setOfferTradeCard(card)
      setOfferTradeAccountId(accounts[0].id)
    }
  }

  const submitOfferTrade = async (card, accountId) => {
    setActionLoading('offer')
    setOfferTradeCard(null)
    try {
      const data = await manualTradeApi.createOffer(accountId, card.backend_id)
      setMessage({ type: 'success', text: `Trade offer created for ${card.card_name}! Processing...` })
      setEditCard(null)
    } catch (err) {
      setMessage({ type: 'error', text: `Trade offer failed: ${err.message}` })
    } finally { setActionLoading(null) }
  }

  // Auto-Sync Now: manual trigger for collection sync
  const handleToggleAutoSync = async () => {
    setActionLoading('sync')
    try {
      const newState = !syncSettings?.autoSyncEnabled
      const syncAccountId = accountFilter !== 'all' ? accountFilter : null
      const data = await collectionSyncApi.updateSettings({ autoSyncEnabled: newState, syncAccountId })
      if (data.error) throw new Error(data.error)
      setSyncSettings(prev => ({ ...prev, autoSyncEnabled: newState ? 1 : 0 }))
      setMessage({ type: 'success', text: newState ? 'Auto Sync enabled — runs daily at 6:00 AM UTC' : 'Auto Sync disabled' })
      // If just enabled, also run a sync now
      if (newState) {
        const syncData = await collectionSyncApi.syncNow(syncAccountId)
        if (!syncData.error) {
          setMessage({ type: 'success', text: 'Auto Sync enabled and sync started!' })
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally { setActionLoading(null) }
  }

  // Handle account filter change — reload sidebar summary, rarity stats, and current set detail
  const handleAccountFilterChange = async (newFilter) => {
    setAccountFilter(newFilter)
    // Reload summary (sidebar) and rarity stats for this account filter
    try {
      const [summaryData, rarityData] = await Promise.all([
        collectionApi.getSummary(newFilter),
        collectionApi.getRarityStats(newFilter),
      ])
      setSummary(summaryData.summary)
      setSets(summaryData.sets || [])
      setRarityStats(rarityData.rarityStats || [])
    } catch (err) {
      console.error('Failed to reload collection data for account filter:', err)
    }
    if (selectedSet) {
      await loadSetDetail(selectedSet, newFilter)
    }
  }

  // Delete collection & resync — scoped to selected account if one is chosen
  const handleDeleteCollection = async () => {
    setResetting(true)
    try {
      const deleteAccountId = accountFilter !== 'all' ? accountFilter : null
      const result = await collectionApi.resetCollection(deleteAccountId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        const msg = deleteAccountId
          ? 'Account collection deleted. Sync again to repopulate.'
          : 'All collection data deleted. Sync again to repopulate.'
        setMessage({ type: 'success', text: msg })
        setResetDialogOpen(false)
        if (!deleteAccountId) setAccountFilter('all')
        await loadData()
        if (selectedSet) {
          await loadSetDetail(selectedSet, deleteAccountId ? accountFilter : 'all')
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete collection' })
    } finally {
      setResetting(false)
    }
  }

  // Handle clicking a rarity stat to show missing cards for that rarity
  const handleRarityClick = async (rarityCode, missingCount) => {
    if (missingCount <= 0) return // nothing missing, no action
    setRarityMissingOpen(true)
    setRarityMissingLoading(true)
    setRarityMissingData(null)
    try {
      const data = await missingCardsApi.getMissing(rarityCode, accountFilter)
      setRarityMissingData({
        rarityCode,
        sets: data.sets || [],
        totalMissing: data.totalMissing || 0,
      })
    } catch (error) {
      console.error('Failed to load missing cards for rarity:', error)
      setMessage({ type: 'error', text: 'Failed to load missing cards' })
      setRarityMissingOpen(false)
    } finally {
      setRarityMissingLoading(false)
    }
  }

  // Load premium sync settings (once)
  useEffect(() => {
    if (isPremium) {
      collectionSyncApi.getSettings().then(setSyncSettings).catch(() => {})
    }
  }, [isPremium])

  // Load missing summary (re-fetch when account filter changes)
  useEffect(() => {
    if (isPremium) {
      missingCardsApi.getSummary(accountFilter !== 'all' ? accountFilter : null)
        .then(setMissingSummary).catch(() => {})
    }
  }, [isPremium, accountFilter])

  // Filter cards based on tab, search, and rarity
  const getFilteredCards = () => {
    if (!setDetail?.cards) return []
    let filtered = setDetail.cards

    if (filterTab === 'owned') {
      filtered = filtered.filter(c => c.owned > 0)
    } else if (filterTab === 'missing') {
      filtered = filtered.filter(c => c.owned === 0)
    }

    if (selectedRarities.length > 0) {
      filtered = filtered.filter(c => {
        const effectiveRarity = c.is_promo === 1 ? 'P' : c.rarity_code
        return selectedRarities.includes(effectiveRarity)
      })
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.card_name?.toLowerCase().includes(query) ||
        c.card_id?.toLowerCase().includes(query)
      )
    }

    return filtered
  }

  // Get unique rarities from current set for filter chips
  // PROMO cards: use 'P' as rarity when is_promo=1 (their rarity_code holds real rarity like RR/SR)
  const availableSetRarities = setDetail?.cards
    ? [...new Set(setDetail.cards.map(c => c.is_promo === 1 ? 'P' : c.rarity_code).filter(Boolean))].sort(
        (a, b) => {
          const order = { C: 1, U: 2, R: 3, RR: 4, AR: 5, SR: 6, SAR: 7, S: 8, SSR: 9, IM: 10, UR: 11, P: 12 }
          return (order[a] || 0) - (order[b] || 0)
        }
      )
    : []

  const filteredCards = getFilteredCards()
  const missingCount = setDetail?.cards?.filter(c => c.owned === 0).length || 0

  // ��─ Smart Insights (computed from existing state) ��────────
  const insights = useMemo(() => {
    if (!sets.length || !summary) return null

    // 1. Closest to Completion — sets sorted by fewest missing cards
    const closestToCompletion = sets
      .map(s => ({ ...s, missing: s.totalInSet - s.ownedInSet, displayName: getSetDisplayName(s) }))
      .filter(s => s.missing > 0)
      .sort((a, b) => a.missing - b.missing)
      .slice(0, 3)

    // 2. Best Pack Recommendation — packs ranked by how many missing cards their set has
    const setMissingMap = {}
    sets.forEach(s => { setMissingMap[s.set_code] = s.totalInSet - s.ownedInSet })
    const packScores = []
    const seenPacks = new Set()
    INSIGHT_PACKS.forEach(pack => {
      const missing = setMissingMap[pack.setCode] || 0
      if (missing > 0 && !seenPacks.has(pack.name)) {
        seenPacks.add(pack.name)
        packScores.push({ ...pack, missing })
      }
    })
    packScores.sort((a, b) => b.missing - a.missing)
    const bestPack = packScores[0] || null

    // 3. Rarity Focus — rarities with missing cards, sorted by importance
    const rarityFocus = rarityStats
      .map(r => ({
        code: r.rarity_code,
        name: RARITY_NAMES[r.rarity_code] || r.rarity_code,
        missing: r.totalCards - r.ownedCards,
        total: r.totalCards,
        owned: r.ownedCards,
        percentage: r.percentage,
        importance: RARITY_IMPORTANCE[r.rarity_code] || 0,
      }))
      .filter(r => r.missing > 0)
      .sort((a, b) => b.importance - a.importance || b.missing - a.missing)
      .slice(0, 3)

    // 4. Next Best Actions — 2-4 actionable suggestions
    const actions = []
    // Nearly complete sets
    closestToCompletion.forEach(s => {
      if (s.missing <= 3) {
        actions.push({
          icon: '🎯',
          text: `Finish ${s.set_code} (${s.missing} card${s.missing === 1 ? '' : 's'} left)`,
          priority: 10 - s.missing,
        })
      }
    })
    // High-value rarity gaps
    rarityFocus.forEach(r => {
      if (r.importance >= 5 && r.missing > 0) {
        actions.push({
          icon: '⚡',
          text: `Focus on ${r.name} (${r.missing} missing)`,
          priority: r.importance,
        })
      }
    })
    // Best pack to open
    if (bestPack) {
      actions.push({
        icon: '📦',
        text: `Open ${bestPack.name} packs`,
        priority: 4,
      })
    }
    // Overall milestone
    const pct = summary.overallPercentage || 0
    if (pct >= 90 && pct < 100) {
      actions.push({
        icon: '🔥',
        text: `${100 - pct}% to full collection!`,
        priority: 9,
      })
    }
    actions.sort((a, b) => b.priority - a.priority)
    const topActions = actions.slice(0, 4)

    return { closestToCompletion, bestPack, rarityFocus, actions: topActions, setMissingMap, packScores }
  }, [sets, rarityStats, summary])

  // ── Strategy & Optimization Engine (v2 — config-driven scoring) ──
  const strategy = useMemo(() => {
    if (!insights || !sets.length) return null

    const { packScores } = insights

    // ─ A. Set Completion Score ─
    // Formula: urgency(missing) × completionBonus(pct) × rarityBoost
    // rarityBoost uses average rarity value of missing cards per rarity stat
    const scoredSets = sets
      .map(s => {
        const missing = s.totalInSet - s.ownedInSet
        if (missing <= 0) return null
        const pct = s.percentage
        const { bonus: cBonus, label: cLabel } = getCompletionBonus(pct)
        const urgency = getUrgencyScore(missing)
        // Rarity boost: average rarity value of missing cards in this set's rarity distribution
        // Approximate from global rarity stats (we don't have per-set rarity breakdown without API)
        const rarityBoost = 1.0 + (pct >= 80 ? 0.3 : 0) // near-complete sets likely missing rarer cards
        const score = Math.round(urgency * cBonus * rarityBoost * 10) / 10
        return {
          set_code: s.set_code,
          displayName: getSetDisplayName(s),
          missing, total: s.totalInSet, owned: s.ownedInSet, percentage: pct,
          score, cLabel,
          reason: missing <= 3
            ? `Only ${missing} card${missing === 1 ? '' : 's'} away — ${cLabel}`
            : `${cLabel} at ${pct}% — ${missing} to go`,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
    const fastestPath = scoredSets.slice(0, 3)

    // ─ B. Pack Efficiency Score ─
    // Formula: missing × completionBonus(pct) × hitRateFactor
    const packEfficiency = packScores.map(pack => {
      const setData = sets.find(s => s.set_code === pack.setCode)
      const pct = setData?.percentage || 0
      const { bonus: cBonus } = getCompletionBonus(pct)
      const hitRate = pack.missing <= SCORING.pack.hitRateBonusThreshold
        ? SCORING.pack.hitRateBonus
        : pack.missing > SCORING.pack.largSetThreshold
          ? SCORING.pack.largSetPenalty
          : 1.0
      const score = Math.round(pack.missing * cBonus * hitRate * 10) / 10
      const reason = pct >= 80
        ? `Helps finish ${pack.setCode} (${pct}%)`
        : pack.missing <= 15
          ? `High hit rate — only ${pack.missing} missing`
          : `${pack.missing} missing cards in ${pack.setCode}`
      return { ...pack, score, pct, reason }
    })
    packEfficiency.sort((a, b) => b.score - a.score)
    const topPacks = packEfficiency.slice(0, 3)

    // ─ C. Rarity Priority Score ─
    // Formula: rarityValue × log2(missing + 1) × scarcityBonus
    // scarcityBonus: if total cards for this rarity is low, each missing one matters more
    const rarityScored = rarityStats
      .map(r => {
        const missing = r.totalCards - r.ownedCards
        if (missing <= 0) return null
        const val = getRarityValue(r.rarity_code)
        const scarcityBonus = r.totalCards <= 10 ? 1.5 : r.totalCards <= 30 ? 1.2 : 1.0
        const score = Math.round(val * Math.log2(missing + 1) * scarcityBonus * 10) / 10
        const reason = val >= 7
          ? `High-value — ${missing} missing across all sets`
          : missing <= 5
            ? `Almost complete — just ${missing} left`
            : `${missing} missing · ${r.percentage}% collected`
        return {
          code: r.rarity_code,
          name: RARITY_NAMES[r.rarity_code] || r.rarity_code,
          missing, total: r.totalCards, owned: r.ownedCards,
          percentage: r.percentage, importance: val,
          score, reason,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)

    // ─ D. Optimal Actions (unified ranking) ─
    // Normalize scores to 0-100 scale per type, then apply type weights
    const candidates = []
    const maxSetScore = scoredSets[0]?.score || 1
    const maxPackScore = packEfficiency[0]?.score || 1
    const maxRarityScore = rarityScored[0]?.score || 1

    // Set actions
    fastestPath.forEach(s => {
      const normalized = (s.score / maxSetScore) * 100 * SCORING.action.setWeight
      candidates.push({
        type: 'set', icon: '🎯',
        label: `Complete ${s.set_code}`,
        detail: `${s.missing} missing · ${s.percentage}%`,
        reason: s.reason,
        score: Math.round(normalized * 10) / 10,
        setCode: s.set_code,
      })
    })

    // Pack actions (top 2)
    topPacks.slice(0, 2).forEach(pack => {
      const normalized = (pack.score / maxPackScore) * 100 * SCORING.action.packWeight
      candidates.push({
        type: 'pack', icon: '📦',
        label: `Open ${pack.name}`,
        detail: `${pack.missing} missing in ${pack.setCode} · ${pack.pct}%`,
        reason: pack.reason,
        score: Math.round(normalized * 10) / 10,
      })
    })

    // Rarity actions (top 2)
    rarityScored.slice(0, 2).forEach(r => {
      const normalized = (r.score / maxRarityScore) * 100 * SCORING.action.rarityWeight
      candidates.push({
        type: 'rarity', icon: '⚡',
        label: `Hunt ${r.name}`,
        detail: `${r.missing} missing · ${r.percentage}% collected`,
        reason: r.reason,
        score: Math.round(normalized * 10) / 10,
        rarityCode: r.code,
      })
    })

    candidates.sort((a, b) => b.score - a.score)
    const optimalActions = candidates.slice(0, 3)

    // ─ Trade Intelligence ─
    const totalDuplicates = (summary?.totalCopies || 0) - (summary?.ownedCards || 0)
    const tradeAdvice = totalDuplicates > 0 ? {
      duplicates: totalDuplicates,
      suggestion: totalDuplicates >= 50
        ? 'Large trade pool — offer extras for missing cards'
        : totalDuplicates >= 10
          ? 'Decent trade stock available'
          : 'Few extras — hold for now',
    } : null

    return { topPacks, fastestPath, optimalActions, tradeAdvice, rarityScored: rarityScored.slice(0, 3) }
  }, [insights, sets, rarityStats, summary])

  // ── Hourglass Missions (from imported mission data + real ownership) ──
  const [missionOwnership, setMissionOwnership] = useState(null)
  const [gameCompletedIds, setGameCompletedIds] = useState(null) // Set from game API
  const [missionLoading, setMissionLoading] = useState(false)
  const [missionDetailOpen, setMissionDetailOpen] = useState(false)
  const [missionDetailData, setMissionDetailData] = useState(null)
  const [missionDetailCards, setMissionDetailCards] = useState([])
  const [missionDetailLoading, setMissionDetailLoading] = useState(false)

  // Mission ownership is refreshed by refreshTrackerData() inline

  // Score hourglass missions using shared helper
  const hourglassMissions = useMemo(() => {
    if (!hourglassRelevant.length || !missionOwnership) return null
    // Apply completion persistence — completed missions won't appear
    // Priority: game > manual > inferred_persistent > engine
    const completedSet = loadCompletedMissions(accountFilter)
    const manualSet = loadManualCompletions(accountFilter)
    const newlyCompleted = []
    const scored = hourglassRelevant.map(m => {
      // Skip if completed by any source
      if ((gameCompletedIds && gameCompletedIds.has(m.id)) || manualSet.has(m.id) || completedSet.has(m.id)) return null
      const result = scoreMission(m, missionOwnership)
      // Latch new completions
      if (result === null && !completedSet.has(m.id)) {
        newlyCompleted.push(m.id)
      }
      return result
    }).filter(Boolean)
    // Persist
    if (newlyCompleted.length > 0) markMissionsCompleted(accountFilter, newlyCompleted)
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 6)
  }, [missionOwnership, hourglassRelevant, accountFilter, gameCompletedIds])

  // Open mission detail dialog — fetches FRESH ownership + card details
  const handleMissionClick = async (mission) => {
    setMissionDetailOpen(true)
    setMissionDetailLoading(true)
    try {
      // Step 1: Fetch FRESH ownership for ALL mission cards (groups + eligible_cards for quota)
      const allMissionCardIds = [...new Set([
        ...(mission.groups || []).flatMap(g => g.cards || []),
        ...(mission.eligible_cards || []),
      ])]
      const freshOwnership = await collectionApi.getMissionProgress(allMissionCardIds, accountFilter)
      const owned = freshOwnership.owned || {}

      // Step 2: Use unified helper — correct for grouped, quota, AND hybrid
      const reqStatus = getUnsatisfiedRequirements(mission, owned)
      const ev = evaluateMission(mission, owned)

      const unsatisfied = reqStatus.unsatisfiedGroups || []

      setMissionDetailData({
        ...mission,
        unsatisfiedGroupsData: unsatisfied,
        totalGroups: ev.totalGroups,
        satisfiedGroups: ev.satisfiedGroups,
        unsatisfiedGroups: ev.unsatisfiedGroups,
        progressRatio: ev.progressRatio,
        quotaMode: ev.quotaMode,
        hybridMode: ev.hybridMode || false,
        quotaRequired: ev.quotaRequired || reqStatus.quotaRequired,
        quotaOwned: ev.quotaOwned || reqStatus.quotaOwned,
        quotaMissing: reqStatus.quotaMissing || 0,
        groupedSatisfied: ev.groupedSatisfied,
        groupedTotal: ev.groupedTotal,
        eligibleCards: reqStatus.eligibleCards || [],
        isComplete: ev.isComplete,
        reqStatus, // pass full status for rendering
      })

      if (unsatisfied.length === 0 && !(reqStatus.hybridMode && reqStatus.quotaMissing > 0)) {
        setMissionDetailCards([])
        setMissionDetailLoading(false)
        return
      }

      // Step 4: Fetch card details for unsatisfied groups AND hybrid eligible cards
      const missingIds = [...new Set([
        ...unsatisfied.flatMap(g => g.cards),
        ...(reqStatus.hybridMode ? (reqStatus.eligibleCards || []) : []),
      ])]
      const data = await collectionApi.getCardDetails(missingIds, accountFilter)
      setMissionDetailCards(data.cards || [])
    } catch (e) {
      console.error('[Mission] Detail fetch error:', e)
      setMissionDetailCards([])
    }
    setMissionDetailLoading(false)
  }

  const renderSidebarContent = () => (
    <>
      {/* ── Section 1: Rarity Tracker ────────────────────── */}
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.75rem', color: 'text.primary' }}>RARITY TRACKER</Typography>
      <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
        Click a rarity to see missing cards
      </Typography>
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {rarityStats.map((rarity) => {
          const missingCount = rarity.totalCards - rarity.ownedCards
          const hasMissing = missingCount > 0
          return (
            <Grid item xs={6} key={rarity.rarity_code}>
              <Box
                onClick={() => hasMissing && handleRarityClick(rarity.rarity_code, missingCount)}
                sx={{
                  cursor: hasMissing ? 'pointer' : 'default',
                  p: 0.75,
                  borderRadius: 1,
                  transition: 'all 0.15s ease',
                  ...(hasMissing && {
                    '&:hover': {
                      bgcolor: 'action.hover',
                      transform: 'scale(1.03)',
                    },
                  }),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                  <Chip
                    label={rarity.rarity_code}
                    size="small"
                    sx={{
                      height: 18, minWidth: 32, fontSize: '0.55rem', fontWeight: 700,
                      bgcolor: RARITY_COLORS[rarity.rarity_code] || '#999',
                      color: getRarityChipTextColor(rarity.rarity_code),
                    }}
                  />
                  <Typography variant="caption" sx={{ flex: 1, fontWeight: 500 }}>
                    {rarity.ownedCards}/{rarity.totalCards}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                    {rarity.percentage}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {RARITY_NAMES[rarity.rarity_code] || rarity.rarity_code}
                  </Typography>
                  {hasMissing && (
                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, fontSize: '0.6rem' }}>
                      {missingCount} missing
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>
          )
        })}
      </Grid>
      <Divider sx={{ my: 2 }} />

      {/* ── Section 2: Hourglass Missions ────────────────── */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.75rem', color: 'text.primary' }}>HOURGLASS CARDS</Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontSize: '0.65rem' }}>
        Missions closest to completion that reward hourglasses
      </Typography>
      {missionLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
          <CircularProgress size={16} />
        </Box>
      ) : hourglassMissions && hourglassMissions.length > 0 ? (
        <Box sx={{ mb: 1 }}>
          {hourglassMissions.map((m) => (
            <Box
              key={`${m.set_code}-${m.mission_name}`}
              onClick={() => handleMissionClick(m)}
              sx={{
                py: 0.6, px: 0.75, mb: 0.5, borderRadius: '6px', cursor: 'pointer',
                transition: 'all 0.15s ease',
                '&:hover': { bgcolor: 'action.hover', transform: 'translateX(2px)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                <Typography sx={{ fontSize: '0.8rem', lineHeight: 1 }}>
                  {m.wonder_hourglass > 0 ? '⏳' : '📦'}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, flex: 1, lineHeight: 1.3, color: 'text.primary' }}>
                  {m.mission_name}
                </Typography>
                <Chip label={m.wonder_hourglass > 0 ? `⏳${m.wonder_hourglass}` : `📦${m.pack_hourglass}`} size="small" sx={{
                  height: 18, fontSize: '0.55rem', fontWeight: 700, minWidth: 0,
                  bgcolor: m.wonder_hourglass > 0 ? '#7c3aed' : 'info.main',
                  color: 'white',
                }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Chip label={m.set_code} size="small" sx={{
                  height: 16, fontSize: '0.5rem', fontWeight: 700,
                  bgcolor: PACK_COLORS[m.set_code] || '#666', color: 'white', minWidth: 30,
                }} />
                <LinearProgress
                  variant="determinate"
                  value={m.progressRatio * 100}
                  sx={{
                    flex: 1, height: 4, borderRadius: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: m.unsatisfiedGroups <= 2 ? 'success.main' : 'primary.main' },
                  }}
                />
                <Typography variant="caption" sx={{
                  fontSize: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap',
                  color: m.unsatisfiedGroups <= 2 ? 'success.main' : 'text.primary',
                }}>
                  {m.unsatisfiedGroups} left
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="caption" sx={{ fontStyle: 'italic', fontSize: '0.65rem', color: 'text.secondary' }}>
          {accountFilter === 'all' ? 'Select a specific account to see mission progress' : 'All hourglass missions completed!'}
        </Typography>
      )}
      <Button
        size="small"
        variant="text"
        href={`/collection-missions${accountFilter && accountFilter !== 'all' ? `?account=${accountFilter}` : ''}`}
        sx={{ mt: 1, mb: 0.5, fontSize: '0.65rem', fontWeight: 600, textTransform: 'none', color: 'primary.main' }}
      >
        View all missing missions →
      </Button>
      <Divider sx={{ my: 2 }} />

      {/* ── Section 3: Strategy Engine ────────────────────── */}
      {strategy && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <StrategyIcon sx={{ fontSize: 16, color: 'info.main', opacity: 0.8 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.75rem', color: 'text.primary' }}>STRATEGY</Typography>
          </Box>

          {/* Optimal Actions — the answer to "what should I do?" */}
          {strategy.optimalActions.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {strategy.optimalActions.map((action, i) => (
                <Box
                  key={i}
                  onClick={() => {
                    if (action.type === 'set' && action.setCode) loadSetDetail(action.setCode)
                    if (action.type === 'rarity' && action.rarityCode) handleRarityClick(action.rarityCode, 1)
                  }}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1,
                    py: 0.75, px: 1, mb: 0.5, borderRadius: '8px',
                    cursor: action.type === 'set' || action.type === 'rarity' ? 'pointer' : 'default',
                    bgcolor: i === 0
                      ? (isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)')
                      : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                    border: i === 0 ? `1px solid ${isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(92, 106, 196, 0.12)'}` : '1px solid transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.08)',
                      transform: 'translateX(2px)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '0.9rem', lineHeight: 1, mt: 0.1 }}>{action.icon}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{
                      fontSize: i === 0 ? '0.7rem' : '0.65rem',
                      fontWeight: i === 0 ? 700 : 600,
                      lineHeight: 1.3,
                      display: 'block',
                      color: i === 0 ? 'text.primary' : 'text.secondary',
                    }}>
                      {action.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', lineHeight: 1.2, fontStyle: 'italic' }}>
                      {action.reason || action.detail}
                    </Typography>
                  </Box>
                  {i === 0 && (
                    <Chip label="#1" size="small" sx={{
                      height: 16, fontSize: '0.5rem', fontWeight: 800,
                      bgcolor: 'info.main', color: 'white', minWidth: 0,
                    }} />
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Pack Efficiency */}
          {strategy.topPacks.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', color: 'text.secondary', letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.75, display: 'block' }}>
                Best Packs to Open
              </Typography>
              {strategy.topPacks.map((pack, i) => (
                <Tooltip key={pack.name + pack.setCode} title={pack.reason || ''} placement="left" arrow>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  py: 0.4, px: 1, mb: 0.3, borderRadius: '6px',
                  transition: 'background-color 0.15s ease',
                  '&:hover': { bgcolor: 'action.hover' },
                }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', width: 14, textAlign: 'center' }}>
                    {i + 1}
                  </Typography>
                  <Chip label={pack.setCode} size="small" sx={{
                    height: 16, fontSize: '0.45rem', fontWeight: 700,
                    bgcolor: PACK_COLORS[pack.setCode] || '#666', color: 'white', minWidth: 30,
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 500, flex: 1 }}>
                    {pack.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 600, color: 'text.secondary' }}>
                    {pack.missing}
                  </Typography>
                </Box>
                </Tooltip>
              ))}
            </Box>
          )}

          {/* Fastest Completion Path */}
          {strategy.fastestPath.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', color: 'text.secondary', letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.75, display: 'block' }}>
                Fastest to Complete
              </Typography>
              {strategy.fastestPath.map(s => (
                <Box
                  key={s.set_code}
                  onClick={() => loadSetDetail(s.set_code)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    py: 0.4, px: 1, mb: 0.3, borderRadius: '6px', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: 'action.hover', transform: 'translateX(2px)' },
                  }}
                >
                  <Chip label={s.set_code} size="small" sx={{
                    height: 16, fontSize: '0.45rem', fontWeight: 700,
                    bgcolor: PACK_COLORS[s.set_code] || '#666', color: 'white', minWidth: 30,
                  }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <LinearProgress
                      variant="determinate"
                      value={s.percentage}
                      sx={{
                        height: 3, borderRadius: 2,
                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: s.percentage >= 90 ? 'success.main' : 'primary.main' },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 600, whiteSpace: 'nowrap', color: s.missing <= 5 ? 'success.main' : 'text.secondary' }}>
                    {s.missing} left
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Trade Intelligence */}
          {strategy.tradeAdvice && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              py: 0.6, px: 1, borderRadius: '8px',
              bgcolor: isDark ? 'rgba(255, 167, 38, 0.06)' : 'rgba(255, 167, 38, 0.04)',
              border: `1px solid ${isDark ? 'rgba(255, 167, 38, 0.12)' : 'rgba(255, 167, 38, 0.1)'}`,
            }}>
              <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>🔁</Typography>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, display: 'block', lineHeight: 1.3 }}>
                  {strategy.tradeAdvice.duplicates} duplicate{strategy.tradeAdvice.duplicates !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.5rem', color: 'text.secondary', opacity: 0.7 }}>
                  {strategy.tradeAdvice.suggestion}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}
      {strategy && <Divider sx={{ my: 2 }} />}

      {/* ── Smart Insights ──────────────────────────────── */}
      {insights && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <LightbulbIcon sx={{ fontSize: 16, color: 'warning.main', opacity: 0.8 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.75rem', color: 'text.primary' }}>INSIGHTS</Typography>
          </Box>

          {/* Next Best Actions */}
          {insights.actions.length > 0 && (
            <Box sx={{ mb: 2 }}>
              {insights.actions.map((action, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  py: 0.6, px: 1, mb: 0.5, borderRadius: '8px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
                  transition: 'background-color 0.15s ease',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
                }}>
                  <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>{action.icon}</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 500, lineHeight: 1.3 }}>
                    {action.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Closest to Completion */}
          {insights.closestToCompletion.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', color: 'text.secondary', letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.75, display: 'block' }}>
                Almost There
              </Typography>
              {insights.closestToCompletion.map(s => (
                <Box
                  key={s.set_code}
                  onClick={() => loadSetDetail(s.set_code)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    py: 0.5, px: 1, mb: 0.4, borderRadius: '8px', cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: 'action.hover', transform: 'translateX(2px)' },
                  }}
                >
                  <Chip label={s.set_code} size="small" sx={{
                    height: 18, minWidth: 36, fontSize: '0.5rem', fontWeight: 700,
                    bgcolor: PACK_COLORS[s.set_code] || '#666', color: 'white',
                  }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <LinearProgress
                      variant="determinate"
                      value={s.percentage}
                      sx={{
                        height: 4, borderRadius: 2,
                        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                          bgcolor: s.missing <= 3 ? 'success.main' : 'primary.main',
                        },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap', color: s.missing <= 3 ? 'success.main' : 'text.secondary' }}>
                    {s.missing} left
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Rarity Focus */}
          {insights.rarityFocus.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.65rem', color: 'text.secondary', letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.75, display: 'block' }}>
                Rarity Priority
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {insights.rarityFocus.map(r => {
                  const ac = RARITY_COLORS_ACCESSIBLE[r.code]
                  const tintColor = ac ? (isDark ? ac.dark : ac.light) : (RARITY_COLORS[r.code] || '#999')
                  const bgBase = RARITY_COLORS[r.code] || '#999'
                  return (
                    <Chip
                      key={r.code}
                      label={`${r.name} · ${r.missing}`}
                      size="small"
                      onClick={() => handleRarityClick(r.code, r.missing)}
                      sx={{
                        height: 22, fontSize: '0.55rem', fontWeight: 600, cursor: 'pointer',
                        bgcolor: `${bgBase}20`,
                        color: tintColor,
                        border: `1px solid ${bgBase}40`,
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: `${bgBase}35`, transform: 'scale(1.05)' },
                      }}
                    />
                  )
                })}
              </Box>
            </Box>
          )}
        </Box>
      )}
      {insights && <Divider sx={{ my: 2 }} />}

      {/* ── Section 5: Stats ─────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography color="text.secondary">Total Unique</Typography>
          <Typography fontWeight={600}>
            {summary?.ownedCards || 0} / {summary?.totalCards || 0}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography color="text.secondary">Total Owned</Typography>
          <Typography fontWeight={600}>{summary?.totalCopies || 0}</Typography>
        </Box>
      </Box>
      <Divider sx={{ my: 2 }} />
      <PackRecommendation compact />
    </>
  )

  if (loading) {
    return <TablePageSkeleton />
  }

  return (
    <FadeIn>
    {/* Wave 10: replaced 100vh (broken on iOS Safari due to dynamic toolbar)
        with 100dvh (dynamic viewport height — accounts for the toolbar
        appearing/disappearing on scroll). Falls back to 100vh on browsers
        that don't support dvh (older iOS) — same behavior as before. */}
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: { xs: 'auto', md: 'calc(100dvh - 100px)' },
      minHeight: { xs: 'calc(100dvh - 200px)', md: 'auto' },
      overflow: { xs: 'visible', md: 'hidden' },
    }}>
      {/* Help Info */}
      <CollapsibleHelp sx={{ mx: 2, mt: 2, mb: 1 }}>
        <ul>
          <li><strong>"Sync from Game":</strong> Fetches your card collection from your linked game account to update owned counts</li>
          <li><strong>Layout:</strong> Left sidebar shows sets with progress bars; Center displays cards; Right sidebar shows stats</li>
          <li><strong>Edit owned count:</strong> Click any card to open a dialog where you can adjust how many copies you own</li>
          <li><strong>Export options:</strong> Export Collection (cards), Set Progress, Rarity Stats, or Full Report with all data</li>
        </ul>
      </CollapsibleHelp>

      {/* Wave 10: stack columns on mobile; horizontal layout only ≥ md.
          On phones the left set list (already display:none < md) and right
          insights drawer remain Drawer-only — center content takes full width. */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        flex: 1,
        overflow: { xs: 'visible', md: 'hidden' },
      }}>
      {/* Left Sidebar - Pack List (hidden on mobile) */}
      <Box
        sx={{
          width: LEFT_SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          overflowY: 'auto',
          bgcolor: 'background.paper',
          display: { xs: 'none', md: 'block' },
        }}
      >
        <List dense sx={{ py: 0 }}>
          {sets.map((set) => (
            <ListItemButton
              key={set.set_code}
              selected={selectedSet === set.set_code}
              onClick={() => loadSetDetail(set.set_code)}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 1.5,
                transition: 'background-color 0.18s ease',
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={set.set_code}
                    size="small"
                    sx={{
                      bgcolor: PACK_COLORS[set.set_code] || '#666',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      height: 20,
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                    {set.percentage}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {set.ownedInSet} / {set.totalInSet}
                  </Typography>
                  <ChevronRightIcon fontSize="small" color="action" />
                </Box>
                <Typography variant="body2" noWrap sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {getSetDisplayName(set)}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={set.percentage}
                  sx={{
                    mt: 0.5,
                    height: 5,
                    borderRadius: 3,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: set.percentage === 100
                        ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                        : set.percentage >= 70
                          ? `linear-gradient(90deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`
                          : set.percentage >= 40
                            ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                            : PACK_COLORS[set.set_code] || theme.palette.primary.main,
                    },
                  }}
                />
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Center Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ── Row 1: Title + Summary Metrics ──────────────────── */}
        <Box sx={{
          px: 2.5, pt: 2.5, pb: 2,
          bgcolor: isDark ? 'rgba(124, 138, 255, 0.03)' : 'rgba(92, 106, 196, 0.02)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7 }}>
              Collection Tracker
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 2, md: 3.5 }, alignItems: 'baseline' }}>
              {[
                { key: 'owned', value: summary?.ownedCards || 0, label: 'Owned', color: theme.palette.success.main },
                { key: 'missing', value: (summary?.totalCards || 0) - (summary?.ownedCards || 0), label: 'Missing', color: theme.palette.error.main },
                { key: 'all', value: `${summary?.overallPercentage || 0}%`, label: 'Complete', color: theme.palette.primary.main },
              ].map(metric => {
                const isEmphasized = filterTab === metric.key
                return (
                  <Box key={metric.key} sx={{
                    textAlign: 'center',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: isEmphasized ? 1 : 0.55,
                    transform: isEmphasized ? 'scale(1.08)' : 'scale(1)',
                  }}>
                    <Typography sx={{
                      fontSize: isEmphasized ? '1.7rem' : '1.4rem',
                      fontWeight: 800, lineHeight: 1, color: metric.color,
                      letterSpacing: '-0.03em',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      textShadow: isEmphasized ? `0 0 20px ${metric.color}40` : 'none',
                    }}>
                      {metric.value}
                    </Typography>
                    <Typography variant="caption" sx={{
                      fontSize: '0.6rem', fontWeight: isEmphasized ? 600 : 500,
                      color: isEmphasized ? metric.color : 'text.secondary',
                      transition: 'color 0.25s ease',
                      letterSpacing: '0.04em',
                    }}>{metric.label}</Typography>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>

        {/* ── Row 2: Actions ──────────────────────────────────── */}
        <Box sx={{
          px: 2.5, py: 1.25, display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap',
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: isDark ? 'rgba(124, 138, 255, 0.015)' : 'rgba(92, 106, 196, 0.008)',
        }}>
          <Button variant="contained" startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <SyncIcon />} onClick={handleOpenSyncDialog}
            disabled={syncing}
            sx={{ background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`, opacity: 0.85, transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-1px)', opacity: 1 } }}
            size="small">
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
          {isPremium && (
            <Tooltip title={syncSettings?.autoSyncEnabled
              ? `Auto-sync ON — daily at 6:00 AM UTC${syncSettings?.lastSyncAt ? `\nLast: ${new Date(syncSettings.lastSyncAt).toLocaleString()}` : ''}`
              : 'Enable auto-sync (daily)'}>
              <Button variant={syncSettings?.autoSyncEnabled ? 'contained' : 'outlined'}
                startIcon={actionLoading === 'sync' ? <CircularProgress size={14} /> : <AutoSyncIcon />}
                onClick={handleToggleAutoSync} disabled={actionLoading === 'sync'}
                color={syncSettings?.autoSyncEnabled ? 'success' : 'secondary'} size="small"
                sx={{ opacity: 0.85, transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-1px)', opacity: 1 } }}>
                {syncSettings?.autoSyncEnabled ? 'Auto ✓' : 'Auto'}
              </Button>
            </Tooltip>
          )}
          <Button variant="outlined" startIcon={<ExportIcon />} onClick={() => setExportDialogOpen(true)} size="small"
            sx={{ opacity: 0.7, transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'translateY(-1px)', opacity: 1 } }}>
            Export
          </Button>
          <Box sx={{ flex: 1 }} />
          {isPremium && linkedAccounts.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Account</InputLabel>
              <Select value={accountFilter} onChange={(e) => handleAccountFilterChange(e.target.value)} label="Account" sx={{ fontSize: '0.75rem' }}>
                <MenuItem value="all">All</MenuItem>
                {linkedAccounts.map((account) => (
                  <MenuItem key={account.id} value={account.id.toString()}>{account.nickname || `#${account.id}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Tooltip title="Reset collection data">
            <IconButton color="error" onClick={() => setResetDialogOpen(true)} size="small"
              sx={{ border: '1px solid', borderColor: 'error.main', borderRadius: 1, opacity: 0.5, transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)', '&:hover': { transform: 'scale(1.08)', opacity: 1 } }}>
              <DeleteForeverIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* ── Mode Tabs + Search ─────────────────────────────── */}
        <Box sx={{ px: 2.5, pt: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          {selectedSet && setDetail ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => { setSelectedSet(null); setSetDetail(null); }} aria-label="Back to all sets" size="small"
                sx={{ transition: 'transform 0.15s', '&:hover': { transform: 'scale(1.1)' } }}>
                <CloseIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
                {getSetDisplayName(setDetail.set)}
              </Typography>
              <TextField size="small" placeholder="Search..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} sx={{ width: { xs: 140, sm: 200 } }}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              {/* Pill-style mode buttons */}
              <Box sx={{ display: 'flex', gap: 0.5, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: '10px', p: 0.5 }}>
                {[
                  { value: 'all', label: 'All', count: summary?.totalCards || 0, color: theme.palette.primary.main },
                  { value: 'owned', label: 'Owned', count: summary?.ownedCards || 0, color: theme.palette.success.main },
                  { value: 'missing', label: 'Missing', count: (summary?.totalCards || 0) - (summary?.ownedCards || 0), color: theme.palette.error.main },
                ].map(mode => {
                  const isActive = filterTab === mode.value
                  return (
                    <Box
                      key={mode.value}
                      onClick={() => setFilterTab(mode.value)}
                      sx={{
                        px: 2, py: 0.75, borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 0.75,
                        bgcolor: isActive ? (mode.value === 'missing' ? theme.palette.error.main : mode.value === 'owned' ? theme.palette.success.main : theme.palette.primary.main) : 'transparent',
                        color: isActive ? 'white' : 'text.secondary',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.8rem',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isActive ? `0 2px 8px ${mode.color}30` : 'none',
                        '&:hover': {
                          bgcolor: isActive ? undefined : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        },
                        '&:active': {
                          transform: 'scale(0.97)',
                        },
                      }}
                    >
                      {mode.label}
                      <Typography component="span" sx={{
                        fontSize: '0.65rem', fontWeight: 700, ml: 0.25,
                        bgcolor: isActive ? 'rgba(255,255,255,0.2)' : `${mode.color}18`,
                        color: isActive ? 'white' : mode.color,
                        px: 0.5, py: 0.1, borderRadius: '6px', lineHeight: 1.3,
                      }}>
                        {mode.count}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
              <Box sx={{ flex: 1 }} />
              <TextField size="small" placeholder="Search cards..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} sx={{ width: { xs: 140, sm: 220 } }}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
            </Box>
          )}

          {/* ── Filter State Bar ────────────────────────────── */}
          <Box sx={{
            display: 'flex', gap: 1, mt: 1.5, mb: 0.5, alignItems: 'center', flexWrap: 'wrap',
            px: 1.5, py: 0.75, borderRadius: '8px',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
            borderLeft: `3px solid ${filterTab === 'missing' ? theme.palette.error.main : filterTab === 'owned' ? theme.palette.success.main : theme.palette.primary.main}`,
            transition: 'border-color 0.25s ease',
          }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6 }}>
              Showing
            </Typography>
            <Chip label={filterTab === 'all' ? 'All Cards' : filterTab === 'owned' ? 'Owned Only' : 'Missing Only'} size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: filterTab === 'missing' ? 'error.main' : filterTab === 'owned' ? 'success.main' : 'action.selected', color: filterTab !== 'all' ? 'white' : 'text.primary' }} />
            <Chip label={selectedSet ? getSetDisplayName(setDetail?.set || { set_code: selectedSet }) : 'All Sets'} size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} variant="outlined" />
            {selectedRarities.length > 0 && (
              <Chip label={`${selectedRarities.length} rarities`} size="small" onDelete={() => setSelectedRarities([])}
                sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} variant="outlined" />
            )}
            {searchQuery && (
              <Chip label={`"${searchQuery}"`} size="small" onDelete={() => setSearchQuery('')}
                sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} variant="outlined" />
            )}
            {accountFilter !== 'all' && (
              <Chip label={`Account: ${linkedAccounts.find(a => a.id.toString() === accountFilter)?.nickname || `#${accountFilter}`}`} size="small"
                sx={{ height: 18, fontSize: '0.55rem', fontWeight: 600 }} variant="outlined" />
            )}
          </Box>
        </Box>

        {/* Mobile Set Selector (replaces sidebar on mobile) */}
        {isMobile && !selectedSet && (
          <Box sx={{ px: 2, pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Set</InputLabel>
              <Select
                value={selectedSet || ''}
                onChange={(e) => loadSetDetail(e.target.value)}
                label="Select Set"
              >
                {sets.map((set) => (
                  <MenuItem key={set.set_code} value={set.set_code}>
                    {set.set_name} ({set.owned}/{set.total} - {set.percentage}%)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Message */}
        {message && (
          <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ m: 2 }}>
            {message.text}
          </Alert>
        )}

        {/* Content Area
            Mobile-scroll fix: this is a page-level inner scroll
            container (flex:1 + overflow:auto) — without the
            data-scroll-container attribute, the theme's
            [data-scroll-container] padding-bottom rule (=
            --mobile-nav-offset, 96px + safe-area) does not apply,
            and the last list items get hidden behind the fixed
            bottom nav on mobile/PWA. See cssBaselineOverrides in
            contexts/ThemeContext.jsx. */}
        <Box data-scroll-container sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
          {selectedSet && setDetail ? (
            // Set Detail View
            <Box>
              {/* Set Header */}
              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: PACK_COLORS[setDetail.set?.set_code] || '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PokeballIcon sx={{ color: 'white' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '-0.01em' }}>
                    {getSetDisplayName(setDetail.set).toUpperCase()}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography color="text.secondary">
                      {setDetail.set?.percentage}%
                    </Typography>
                    <Typography color="text.secondary">
                      {setDetail.set?.ownedCards} / {setDetail.set?.totalCards}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={setDetail.set?.percentage || 0}
                      sx={{
                        flex: 1, height: 8, borderRadius: 4, maxWidth: 200,
                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: (setDetail.set?.percentage || 0) === 100
                            ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                            : (setDetail.set?.percentage || 0) >= 70
                              ? `linear-gradient(90deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`
                              : (setDetail.set?.percentage || 0) >= 40
                                ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                                : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Box>

              {/* Tabs */}
              <Tabs value={filterTab} onChange={(e, v) => setFilterTab(v)} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto" sx={{ mb: 2 }}>
                <Tab label="All Cards" value="all" />
                <Tab label="Owned" value="owned" />
                <Tab label={`Missing ${missingCount}`} value="missing" />
              </Tabs>

              {/* Search */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <TextField
                  size="small"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ flex: 1, maxWidth: 300 }}
                  InputProps={{
                    startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
                <Button
                  variant={selectedRarities.length > 0 ? 'contained' : 'outlined'}
                  startIcon={<FilterIcon />}
                  onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                >
                  Filter{selectedRarities.length > 0 ? ` (${selectedRarities.length})` : ''}
                </Button>
                <Popover
                  open={Boolean(filterAnchorEl)}
                  anchorEl={filterAnchorEl}
                  onClose={() => setFilterAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                >
                  <Box sx={{ p: 2, minWidth: 200 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Filter by Rarity</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {availableSetRarities.map(rarity => {
                        const isActive = selectedRarities.includes(rarity)
                        const color = RARITY_COLORS[rarity] || '#999'
                        return (
                          <Chip
                            key={rarity}
                            label={RARITY_NAMES[rarity] || rarity}
                            size="small"
                            onClick={() => {
                              setSelectedRarities(prev =>
                                prev.includes(rarity) ? prev.filter(r => r !== rarity) : [...prev, rarity]
                              )
                            }}
                            sx={{
                              backgroundColor: isActive ? color : 'transparent',
                              color: isActive ? getRarityChipTextColor(rarity) : 'text.primary',
                              border: `1.5px solid ${color}`,
                              fontWeight: isActive ? 700 : 500,
                              cursor: 'pointer',
                              boxShadow: isActive ? `0 2px 8px ${color}40` : 'none',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                backgroundColor: isActive ? color : `${color}18`,
                                transform: 'scale(1.05)',
                              },
                            }}
                          />
                        )
                      })}
                    </Box>
                    {selectedRarities.length > 0 && (
                      <Button
                        size="small"
                        onClick={() => setSelectedRarities([])}
                        sx={{ mt: 1 }}
                      >
                        Clear All
                      </Button>
                    )}
                  </Box>
                </Popover>
              </Box>

              {/* Premium Missing Cards Summary (Feature #6) */}
              {isPremium && filterTab === 'missing' && missingSummary?.sets?.length > 0 && (
                <Box
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: '14px',
                    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'}`,
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                    borderLeft: `3px solid ${theme.palette.secondary.main}`,
                  }}
                >
                  <Typography variant="subtitle2" color="secondary" sx={{ mb: 1 }}>Missing Cards Summary (All Sets)</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {missingSummary.sets.map(s => (
                      <Chip
                        key={s.setCode}
                        label={`${s.setName || s.setCode}: ${s.totalMissing} missing`}
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => loadSetDetail(s.setCode)}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Cards Grid */}
              {loadingSet ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : filteredCards.length === 0 ? (
                <EmptyState
                  icon={<SearchIcon sx={{ fontSize: 48 }} />}
                  title="No Cards Found"
                  description={searchQuery ? `No results for "${searchQuery}". Try a different term.` : filterTab === 'owned' ? 'No owned cards in this set yet. Sync your collection or open some packs!' : filterTab === 'missing' ? 'You have every card in this set — nice!' : 'Try clearing your filters.'}
                  action={
                    (searchQuery || selectedRarities.length > 0) && (
                      <Button variant="outlined" size="small" onClick={() => { setSearchQuery(''); setSelectedRarities([]) }} sx={{ mt: 1 }}>
                        Clear Filters
                      </Button>
                    )
                  }
                  minHeight={200}
                />
              ) : (
                <Grid container spacing={1.5}>
                  {filteredCards.map((card) => {
                    const glow = RARITY_GLOW[card.rarity_code] || 'none'
                    return (
                    <Grid item xs={6} sm={4} md={3} lg={2} key={card.backend_id}>
                      <Box
                        onClick={() => setEditCard(card)}
                        sx={{
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          opacity: filterTab === 'all' && card.owned === 0 ? 0.45 : 1,
                          borderRadius: '14px',
                          '&:hover': {
                            transform: 'translateY(-3px) scale(1.015)',
                            '& img': {
                              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.3)',
                            },
                          },
                        }}
                      >
                        <Box sx={{ position: 'relative', borderRadius: '14px', overflow: 'hidden' }}>
                          <Box
                            component="img"
                            src={cardsApi.getImageUrl(card.backend_id)}
                            alt={getCardDisplayName(card)}
                            sx={{
                              width: '100%',
                              aspectRatio: '5 / 7',
                              objectFit: 'contain',
                              display: 'block',
                              borderRadius: '14px',
                              boxShadow: glow,
                              transition: 'box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onError={(e) => { e.target.src = '/card-placeholder.png' }}
                          />
                          {/* Promo badge */}
                          {card.is_promo === 1 && (
                            <Box sx={{
                              position: 'absolute', top: 4, right: 4, px: 0.5, py: 0.15,
                              borderRadius: '4px', fontSize: '0.5rem', fontWeight: 800,
                              bgcolor: 'rgba(0, 188, 212, 0.85)', color: '#fff',
                              letterSpacing: '0.05em', lineHeight: 1.3,
                              backdropFilter: 'blur(4px)',
                            }}>
                              PROMO
                            </Box>
                          )}
                          {/* Name + rarity overlay at bottom */}
                          <Box sx={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                            px: 0.75, py: 0.5, pt: 2,
                            borderRadius: '0 0 14px 14px',
                          }}>
                            <Typography variant="caption" sx={{
                              color: '#fff', fontWeight: 600, fontSize: '0.6rem',
                              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap', lineHeight: 1.2,
                              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            }}>
                              {getCardDisplayName(card)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.5rem' }}>
                              {RARITY_NAMES[card.rarity_code] || card.rarity_code}
                            </Typography>
                          </Box>
                          {/* Owned badge */}
                          {card.owned > 0 && (
                            <Box sx={{
                              position: 'absolute', top: 4, left: 4,
                              bgcolor: 'primary.main', color: 'white',
                              borderRadius: '8px', px: 0.75, py: 0.15,
                              fontSize: '0.65rem', fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: 0.25,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}>
                              ×{card.owned}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                    )
                  })}
                </Grid>
              )}
            </Box>
          ) : (
            // All Sets View
            <Box>
              <Grid container spacing={1.5}>
                {sets.map((set) => (
                  <Grid item xs={12} key={set.set_code}>
                    <Box
                      onClick={() => loadSetDetail(set.set_code)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        borderRadius: '14px',
                        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'}`,
                        bgcolor: isDark ? 'rgba(26, 32, 53, 0.5)' : 'rgba(255, 255, 255, 0.7)',
                        boxShadow: set.percentage === 100
                          ? `0 1px 4px rgba(0,0,0,0.1), inset 0 0 0 1px ${theme.palette.success.main}18`
                          : isDark ? '0 1px 4px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
                        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          borderColor: PACK_COLORS[set.set_code] || theme.palette.primary.main,
                          transform: 'translateY(-2px) scale(1.005)',
                          boxShadow: `0 8px 28px ${(PACK_COLORS[set.set_code] || theme.palette.primary.main)}18`,
                          bgcolor: isDark ? 'rgba(124, 138, 255, 0.04)' : 'rgba(92, 106, 196, 0.03)',
                        },
                      }}
                    >
                      <Chip
                        label={set.set_code}
                        sx={{
                          bgcolor: PACK_COLORS[set.set_code] || '#666',
                          color: 'white',
                          fontWeight: 700,
                          minWidth: 100,
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 500, mb: 0.5 }}>
                          {getSetDisplayName(set)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={set.percentage}
                            sx={{
                              flex: 1, height: 8, borderRadius: 4, maxWidth: 240,
                              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                              overflow: 'hidden',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                background: set.percentage === 100
                                  ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                                  : set.percentage >= 70
                                    ? `linear-gradient(90deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`
                                    : set.percentage >= 40
                                      ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                                      : `linear-gradient(90deg, ${PACK_COLORS[set.set_code] || theme.palette.primary.main}, ${PACK_COLORS[set.set_code] || theme.palette.primary.light}80)`,
                                ...(set.percentage >= 90 && set.percentage < 100 && {
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2.5s ease-in-out infinite',
                                  '@keyframes shimmer': {
                                    '0%': { backgroundPosition: '200% 0' },
                                    '100%': { backgroundPosition: '-200% 0' },
                                  },
                                }),
                              },
                            }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: set.percentage === 100 ? 'success.main' : set.percentage >= 70 ? 'success.dark' : 'text.primary', minWidth: 40, textAlign: 'right' }}>
                            {set.percentage}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50, textAlign: 'right' }}>
                            {set.ownedInSet}/{set.totalInSet}
                          </Typography>
                        </Box>
                      </Box>
                      <ChevronRightIcon color="action" />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Sidebar - Stats (collapsible on desktop, drawer on mobile) */}
      {!isMobile && rightSidebarOpen && (
        <Box
          sx={{
            width: RIGHT_SIDEBAR_WIDTH,
            flexShrink: 0,
            borderLeft: 'none',
            overflowY: 'auto',
            bgcolor: isDark ? 'rgba(15, 18, 30, 0.6)' : 'rgba(248, 249, 252, 0.9)',
            p: 2,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '1px',
              background: isDark
                ? 'linear-gradient(180deg, transparent, rgba(124, 138, 255, 0.15) 30%, rgba(124, 138, 255, 0.15) 70%, transparent)'
                : 'linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.08) 30%, rgba(0, 0, 0, 0.08) 70%, transparent)',
            },
          }}
        >
          <IconButton
            onClick={() => setRightSidebarOpen(false)}
            size="small"
            aria-label="Close stats panel"
            sx={{ position: 'absolute', top: 4, left: 4 }}
          >
            <ChevronRightIcon />
          </IconButton>
          <Box sx={{ mt: 4 }}>
            {renderSidebarContent()}
          </Box>
        </Box>
      )}
      {!isMobile && !rightSidebarOpen && (
        <Box
          sx={{
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'flex-start',
            pt: 1,
          }}
        >
          <Tooltip title="Show stats">
            <IconButton onClick={() => setRightSidebarOpen(true)} size="small" aria-label="Show stats">
              <ChevronLeftIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      </Box>

      {/* Mobile stats drawer */}
      {isMobile && (
        <>
          <Drawer
            anchor="right"
            open={rightSidebarOpen}
            onClose={() => setRightSidebarOpen(false)}
            PaperProps={{ sx: { width: Math.min(RIGHT_SIDEBAR_WIDTH, 300), p: 2, maxWidth: '85vw' } }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Stats</Typography>
              <IconButton onClick={() => setRightSidebarOpen(false)} size="small" aria-label="Close stats">
                <CloseIcon />
              </IconButton>
            </Box>
            {renderSidebarContent()}
          </Drawer>
          <Fab
            size="small"
            color="primary"
            onClick={() => setRightSidebarOpen(true)}
            sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000 }}
          >
            <StatsIcon />
          </Fab>
        </>
      )}

      {/* Card Edit Dialog */}
      <Dialog open={Boolean(editCard)} onClose={() => setEditCard(null)} maxWidth="xs" fullWidth>
        {editCard && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {getCardDisplayName(editCard)}
                <Chip
                  label={RARITY_NAMES[editCard.rarity_code] || editCard.rarity_code}
                  size="small"
                  sx={{
                    bgcolor: RARITY_COLORS[editCard.rarity_code] || '#666',
                    color: getRarityChipTextColor(editCard.rarity_code),
                    fontWeight: 600,
                    fontSize: '0.65rem',
                  }}
                />
                {editCard.is_promo === 1 && (
                  <Chip label="PROMO" size="small" sx={{
                    height: 18, fontSize: '0.55rem', fontWeight: 700,
                    bgcolor: 'rgba(0, 188, 212, 0.15)', color: '#00bcd4',
                    border: '1px solid rgba(0, 188, 212, 0.3)',
                  }} />
                )}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box
                  component="img"
                  src={cardsApi.getImageUrl(editCard.backend_id)}
                  alt={getCardDisplayName(editCard)}
                  sx={{ maxWidth: 200, maxHeight: 280, objectFit: 'contain' }}
                  onError={(e) => { e.target.src = '/card-placeholder.png' }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton
                    onClick={() => handleUpdateCard(editCard.backend_id, Math.max(0, editCard.owned - 1))}
                    disabled={editCard.owned <= 0}
                    aria-label="Decrease card count"
                  >
                    <RemoveIcon />
                  </IconButton>
                  <Typography variant="h4" sx={{ fontWeight: 600, minWidth: 60, textAlign: 'center' }}>
                    {editCard.owned}
                  </Typography>
                  <IconButton onClick={() => handleUpdateCard(editCard.backend_id, editCard.owned + 1)} aria-label="Increase card count">
                    <AddIcon />
                  </IconButton>
                </Box>
                <Typography color="text.secondary">Cards Owned</Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
              {/* Premium-only: Gift to Me (giftable rarities only) */}
              {isPremium && GIFTABLE_RARITIES.includes(editCard.rarity_code) && (
                <Button
                  startIcon={<CardGiftcardIcon />}
                  onClick={() => handleGiftToMe(editCard)}
                  disabled={actionLoading === 'gift'}
                  color="success"
                  size="small"
                >
                  {actionLoading === 'gift' ? 'Creating...' : 'Gift to Me'}
                </Button>
              )}
              {/* Add to Wishlist */}
              <Button
                startIcon={<WishlistIcon />}
                onClick={() => handleAddToWishlist(editCard)}
                disabled={actionLoading === 'wishlist'}
                color="secondary"
                size="small"
              >
                {actionLoading === 'wishlist' ? 'Adding...' : 'Wishlist'}
              </Button>
              {/* Premium-only: Trade for This (non-tradable rarities hidden) */}
              {isPremium && isCardTradable(editCard) && (
                <Button
                  startIcon={<SwapHorizIcon />}
                  onClick={() => handleTradeForThis(editCard)}
                  disabled={actionLoading === 'trade'}
                  color="primary"
                  size="small"
                >
                  {actionLoading === 'trade' ? 'Creating...' : 'Trade for This'}
                </Button>
              )}
              {/* Premium-only: Offer for Trade (send this card away) — only for owned tradable cards */}
              {isPremium && editCard.owned > 0 && isCardTradable(editCard) && (
                <Button
                  startIcon={<OfferTradeIcon />}
                  onClick={() => handleOfferTrade(editCard)}
                  disabled={actionLoading === 'offer'}
                  color="warning"
                  size="small"
                >
                  {actionLoading === 'offer' ? 'Creating...' : 'Offer for Trade'}
                </Button>
              )}
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setEditCard(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Account Selection Dialog for Offer Trade (multi-account users) */}
      <Dialog open={!!offerTradeCard} onClose={() => setOfferTradeCard(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Select Account for Trade</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Which account should offer "{offerTradeCard?.card_name}" for trade?
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={offerTradeAccountId}
              onChange={(e) => setOfferTradeAccountId(e.target.value)}
            >
              {linkedAccounts.map((acc) => (
                <MenuItem key={acc.id} value={acc.id}>
                  {acc.game_name || acc.device_account || `Account #${acc.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOfferTradeCard(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => submitOfferTrade(offerTradeCard, offerTradeAccountId)}
            disabled={!offerTradeAccountId}
          >
            Offer for Trade
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Collection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste your collection data in JSON format:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={10}
            placeholder='{"A1-001": 3, "A1-002": 1}'
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            sx={{ fontFamily: 'monospace' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || !importData.trim()}
            startIcon={importing ? <CircularProgress size={16} /> : <UploadIcon />}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync from Game Dialog */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon color="primary" />
          Sync Collection from Game
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Fetch your card collection from your linked game account.
          </Typography>
          {/* Phase 25D — sync truth indicator. Shows the outcome of
              the LAST tracker sync (both inventory + missions) for
              the currently-selected account. Green when both fresh;
              yellow when missions lag inventory (partial sync); grey
              when the account has never been synced. */}
          {selectedSyncAccount && (
            <Box sx={{ mb: 2 }}>
              <SyncStatusChip accountId={selectedSyncAccount} />
            </Box>
          )}
          {linkedAccounts.length === 0 ? (
            <Alert severity="warning">
              No linked accounts found. Please link a game account first.
            </Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Select Account</InputLabel>
              <Select
                value={selectedSyncAccount}
                onChange={(e) => setSelectedSyncAccount(e.target.value)}
                label="Select Account"
              >
                {linkedAccounts.map((account) => (
                  <MenuItem key={account.id} value={account.id.toString()}>
                    {account.nickname || `Account ${account.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {syncing && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Fetching card collection...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)} disabled={syncing}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSyncFromGame}
            disabled={syncing || linkedAccounts.length === 0}
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Collection Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <DeleteForeverIcon />
          {accountFilter !== 'all'
            ? `Delete Collection for ${linkedAccounts.find(a => a.id.toString() === accountFilter)?.nickname || 'Account'}`
            : 'Delete All Collection Data'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {accountFilter !== 'all'
              ? `This will delete collection data for "${linkedAccounts.find(a => a.id.toString() === accountFilter)?.nickname || 'this account'}" only. Your other accounts' data will be kept. You will need to sync this account again to repopulate.`
              : 'This will permanently delete ALL your collection tracking data (all accounts). You will need to sync again from your game accounts to repopulate.'}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            {accountFilter !== 'all'
              ? 'Use this if this account\'s collection data is incorrect. After deleting, use "Sync" to pull fresh data for this account.'
              : 'Use this if your collection data is incorrect (e.g. stale cards from an unlinked alt account). After deleting, use "Sync" to pull fresh data from each linked account.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} disabled={resetting}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteCollection}
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
          >
            {resetting ? 'Deleting...' : accountFilter !== 'all' ? 'Delete Account Collection' : 'Delete All Collection Data'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExportIcon color="primary" />
          Export Collection
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Export your collection data in various formats.
          </Typography>

          {/* Export Type */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Export Type</InputLabel>
            <Select
              value={exportType}
              onChange={(e) => setExportType(e.target.value)}
              label="Export Type"
            >
              <MenuItem value="collection">Card Collection</MenuItem>
              <MenuItem value="sets">Set Progress</MenuItem>
              <MenuItem value="rarity">Rarity Statistics</MenuItem>
              <MenuItem value="full">Full Report (All Data)</MenuItem>
            </Select>
          </FormControl>

          {/* Format selection for collection export */}
          {exportType === 'collection' && (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  label="Format"
                >
                  <MenuItem value="csv">CSV (Spreadsheet)</MenuItem>
                  <MenuItem value="json">JSON (Data)</MenuItem>
                </Select>
              </FormControl>

              {/* Filter options */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Button
                  variant={exportIncludeOwned ? 'contained' : 'outlined'}
                  onClick={() => setExportIncludeOwned(!exportIncludeOwned)}
                  size="small"
                  startIcon={exportIncludeOwned ? <CheckIcon /> : <UncheckedIcon />}
                >
                  Owned Cards
                </Button>
                <Button
                  variant={exportIncludeMissing ? 'contained' : 'outlined'}
                  onClick={() => setExportIncludeMissing(!exportIncludeMissing)}
                  size="small"
                  startIcon={exportIncludeMissing ? <CheckIcon /> : <UncheckedIcon />}
                >
                  Missing Cards
                </Button>
              </Box>
            </>
          )}

          {/* Preview info */}
          <Box
            sx={{
              p: 2,
              mt: 2,
              borderRadius: '10px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {exportType === 'collection' && (
                <>
                  {exportFormat === 'csv' ? 'CSV' : 'JSON'} file with{' '}
                  {exportIncludeOwned && exportIncludeMissing
                    ? 'all cards'
                    : exportIncludeOwned
                    ? 'owned cards only'
                    : 'missing cards only'}
                </>
              )}
              {exportType === 'sets' && 'CSV file with set completion progress'}
              {exportType === 'rarity' && 'CSV file with rarity statistics'}
              {exportType === 'full' && 'JSON file with all collection data, sets, and statistics'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={exporting || (exportType === 'collection' && !exportIncludeOwned && !exportIncludeMissing)}
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <ExportIcon />}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rarity Missing Cards Dialog */}
      <Dialog
        open={rarityMissingOpen}
        onClose={() => setRarityMissingOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {rarityMissingData && (
            <Chip
              label={RARITY_NAMES[rarityMissingData.rarityCode] || rarityMissingData.rarityCode}
              size="small"
              sx={{
                bgcolor: RARITY_COLORS[rarityMissingData.rarityCode] || '#999',
                color: getRarityChipTextColor(rarityMissingData.rarityCode),
                fontWeight: 600,
              }}
            />
          )}
          Missing Cards {rarityMissingData ? `(${rarityMissingData.totalMissing})` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {rarityMissingLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : rarityMissingData?.sets?.length > 0 ? (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                These are all cards tagged as <strong>{RARITY_NAMES[rarityMissingData.rarityCode] || rarityMissingData.rarityCode}</strong> ({rarityMissingData.rarityCode}) that you don't own.
                If any card looks wrong for this rarity, it may be mis-tagged in the card database.
              </Alert>
              {rarityMissingData.sets.map((set) => (
                <Box key={set.setCode} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Chip
                      label={set.setCode}
                      size="small"
                      sx={{
                        bgcolor: PACK_COLORS[set.setCode] || '#666',
                        color: 'white',
                        fontWeight: 700,
                      }}
                    />
                    <Typography variant="subtitle2" fontWeight={600}>
                      {set.setName || set.setCode} ({set.cards.length} missing)
                    </Typography>
                  </Box>
                  <Grid container spacing={1.5}>
                    {set.cards.map((card) => (
                      <Grid item xs={4} sm={3} md={2} key={card.backend_id}>
                        <Box
                          sx={{ textAlign: 'center', position: 'relative' }}
                        >
                          <Box
                            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8, transform: 'scale(1.03)' }, transition: 'all 0.15s ease' }}
                            onClick={() => { setEditCard({ ...card, owned: 0 }); setRarityMissingOpen(false) }}
                          >
                            <Box
                              component="img"
                              src={cardsApi.getImageUrl(card.backend_id)}
                              alt={card.card_name}
                              sx={{
                                width: '100%',
                                aspectRatio: '5 / 7',
                                objectFit: 'contain',
                                borderRadius: '10px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                border: '2px solid',
                                borderColor: 'error.main',
                                opacity: 0.85,
                              }}
                              onError={(e) => { e.target.src = '/card-placeholder.png' }}
                            />
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 500, lineHeight: 1.2 }}>
                              {card.card_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              #{card.number} | {card.rarity_code}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                            <Tooltip title="Add to Wishlist">
                              <IconButton
                                size="small"
                                color="secondary"
                                aria-label="Add to wishlist"
                                onClick={(e) => { e.stopPropagation(); handleAddToWishlist(card) }}
                                disabled={!!actionLoading}
                                sx={{ p: 0.3 }}
                              >
                                <WishlistIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            {isPremium && GIFTABLE_RARITIES.includes(card.rarity_code) && (
                              <Tooltip title="Gift to Me">
                                <IconButton
                                  size="small"
                                  color="success"
                                  aria-label="Gift to me"
                                  onClick={(e) => { e.stopPropagation(); handleGiftToMe(card) }}
                                  disabled={!!actionLoading}
                                  sx={{ p: 0.3 }}
                                >
                                  <CardGiftcardIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {isPremium && isCardTradable(card) && (
                              <Tooltip title="Trade for This">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  aria-label="Trade for this"
                                  onClick={(e) => { e.stopPropagation(); handleTradeForThis(card) }}
                                  disabled={!!actionLoading}
                                  sx={{ p: 0.3 }}
                                >
                                  <SwapHorizIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No missing cards found for this rarity.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRarityMissingOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Trade Confirmation Dialog */}
      <Dialog
        open={tradeConfirmOpen}
        onClose={() => !tradeSubmitting && setTradeConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Request Card</DialogTitle>
        <DialogContent>
          {tradeConfirmCard && (
            <Box sx={{ py: 2 }}>
              {/* Card preview */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.900', borderRadius: 2, mb: 3 }}>
                <Box
                  component="img"
                  src={`/api/cards/${tradeConfirmCard.backend_id}/image?v=5`}
                  alt={tradeConfirmCard.card_name}
                  sx={{ width: 80, height: 112, objectFit: 'contain', bgcolor: 'grey.800', borderRadius: 1 }}
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <Box>
                  <Typography variant="h6">{tradeConfirmCard.card_name}</Typography>
                  {tradeConfirmCard.rarity && (
                    <Chip
                      size="small"
                      label={tradeConfirmCard.rarity}
                      sx={{ bgcolor: RARITY_COLORS[tradeConfirmCard.rarity] || 'grey.500', color: getRarityChipTextColor(tradeConfirmCard.rarity), fontWeight: 'bold', mt: 0.5 }}
                    />
                  )}
                </Box>
              </Box>

              {/* Instructions */}
              <Alert severity="warning">
                After requesting, a bot will send you a friend request in-game.
                You have <strong>10 minutes</strong> to accept the friend request,
                otherwise the trade will expire.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTradeConfirmOpen(false)} disabled={tradeSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleTradeConfirm}
            disabled={tradeSubmitting}
            startIcon={tradeSubmitting ? <CircularProgress size={20} /> : <SwapHorizIcon />}
          >
            {tradeSubmitting ? 'Requesting...' : 'Request Card'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mission Detail Dialog */}
      <Dialog
        open={missionDetailOpen}
        onClose={() => setMissionDetailOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { maxHeight: '80vh' } }}
      >
        {missionDetailData && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>
                  {missionDetailData.wonder_hourglass > 0 ? '⏳' : '📦'}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>
                  {missionDetailData.mission_name}
                </Typography>
                <Chip label={missionDetailData.set_code} size="small" sx={{
                  bgcolor: PACK_COLORS[missionDetailData.set_code] || '#666', color: 'white', fontWeight: 700,
                }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                {missionDetailData.wonder_hourglass > 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                    ⏳ Wonder Hourglass ×{missionDetailData.wonder_hourglass}
                  </Typography>
                )}
                {missionDetailData.pack_hourglass > 0 && (
                  <Typography variant="caption" color="info.main" sx={{ fontWeight: 600 }}>
                    📦 Pack Hourglass ×{missionDetailData.pack_hourglass}
                  </Typography>
                )}
                {missionDetailData.shop_ticket > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    🎫 Shop ×{missionDetailData.shop_ticket}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {missionDetailData.hybridMode
                  ? `Groups: ${missionDetailData.groupedSatisfied || 0}/${missionDetailData.groupedTotal || 0} · Copies: ${missionDetailData.quotaOwned || 0}/${missionDetailData.quotaRequired || 0}`
                  : `${missionDetailData.satisfiedGroups}/${missionDetailData.totalGroups} requirements met · ${missionDetailData.unsatisfiedGroups} left`}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              {missionDetailLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : !missionDetailData.unsatisfiedGroupsData?.length && !missionDetailData.hybridMode ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  All requirements met!
                </Typography>
              ) : missionDetailData.hybridMode ? (
                /* Hybrid mission: show group status + quota status separately */
                <Box>
                  {(missionDetailData.groups || []).map((group, gi) => {
                    const isSatisfied = isGroupSatisfied(group, missionDetailData.reqStatus ? undefined : {})
                    const label = group.lookup_name || `Requirement ${gi + 1}`
                    // For hybrid, check group satisfaction from reqStatus
                    const groupSatisfied = !(missionDetailData.unsatisfiedGroupsData || []).some(
                      ug => ug.lookup_name === group.lookup_name || (ug.cards && group.cards && ug.cards[0] === group.cards[0])
                    )
                    return (
                      <Box key={gi} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={groupSatisfied ? '✓' : '✗'}
                          size="small"
                          sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: groupSatisfied ? 'success.main' : 'error.main', color: 'white' }}
                        />
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {label}: {groupSatisfied ? 1 : 0} / 1
                        </Typography>
                      </Box>
                    )
                  })}
                  {missionDetailData.quotaRequired > 0 && (
                    <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={missionDetailData.quotaMissing === 0 ? '✓' : `${missionDetailData.quotaMissing}`}
                        size="small"
                        sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: missionDetailData.quotaMissing === 0 ? 'success.main' : 'warning.main', color: 'white' }}
                      />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {(missionDetailData.eligibleCards || []).length === 1
                          ? (missionDetailCards.find(c => c.card_id === missionDetailData.eligibleCards[0])?.card_name || 'Copies')
                          : 'Eligible copies'}: {missionDetailData.quotaOwned}/{missionDetailData.quotaRequired}
                      </Typography>
                    </Box>
                  )}
                  {/* Show unsatisfied group cards below */}
                  {(missionDetailData.unsatisfiedGroupsData || []).map((group, gi) => {
                    const isOr = group.operator === 'OR' && group.cards.length > 1
                    const groupCards = group.cards.map(id => missionDetailCards.find(c => c.card_id === id)).filter(Boolean)
                    return groupCards.length > 0 ? (
                      <Box key={`missing-${gi}`} sx={{ mt: 2, mb: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', display: 'block', mb: 1, color: 'text.secondary' }}>
                          {isOr ? `Need 1 of ${group.cards.length} — ${group.lookup_name || 'any option'}` : `Need: ${group.lookup_name || 'card'}`}
                        </Typography>
                        <Grid container spacing={1}>
                          {groupCards.map((card) => (
                            <Grid item xs={4} sm={3} key={card.card_id}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Box component="img" src={cardsApi.getImageUrl(card.backend_id)} alt={card.card_name}
                                  sx={{ width: '100%', aspectRatio: '5 / 7', objectFit: 'contain', borderRadius: '10px', border: '2px solid', borderColor: 'error.main', opacity: 0.85 }}
                                  onError={(e) => { e.target.src = '/card-placeholder.png' }}
                                />
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, mt: 0.5 }}>{card.card_name}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    ) : null
                  })}
                </Box>
              ) : (
                <Box>
                  {missionDetailData.unsatisfiedGroupsData.map((group, gi) => {
                    const isOr = group.operator === 'OR' && group.cards.length > 1
                    const groupCards = group.cards.map(id => missionDetailCards.find(c => c.card_id === id)).filter(Boolean)
                    return (
                      <Box key={gi} sx={{ mb: 2.5, pb: gi < missionDetailData.unsatisfiedGroupsData.length - 1 ? 2 : 0, borderBottom: gi < missionDetailData.unsatisfiedGroupsData.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.65rem', display: 'block', mb: 1, color: 'text.secondary' }}>
                          {isOr ? `Need 1 of ${group.cards.length} — ${group.lookup_name || 'any option'}` : `Need: ${group.lookup_name || 'card'}`}
                        </Typography>
                        <Grid container spacing={1}>
                          {groupCards.map((card) => {
                            const tradable = isCardTradable(card)
                            const giftable = GIFTABLE_RARITIES.includes(card.rarity_code) && !card.is_promo
                            return (
                              <Grid item xs={isOr ? 4 : 6} sm={isOr ? 3 : 4} key={card.card_id}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <Box
                                    component="img"
                                    src={cardsApi.getImageUrl(card.backend_id)}
                                    alt={card.card_name}
                                    sx={{
                                      width: '100%', aspectRatio: '5 / 7', objectFit: 'contain',
                                      borderRadius: '10px', boxShadow: RARITY_GLOW[card.rarity_code] || 'none',
                                      border: '2px solid', borderColor: isOr ? 'info.main' : 'error.main', opacity: 0.85,
                                    }}
                                    onError={(e) => { e.target.src = '/card-placeholder.png' }}
                                  />
                                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 600, fontSize: '0.55rem', lineHeight: 1.2 }}>
                                    {card.card_name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.45rem' }}>
                                    #{card.number} · {RARITY_NAMES[card.rarity_code] || card.rarity_code}
                                  </Typography>
                                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 0.3 }}>
                                    {tradable && isPremium && (
                                      <Tooltip title="Trade"><IconButton size="small" color="primary" sx={{ p: 0.2 }}
                                        onClick={() => { setMissionDetailOpen(false); handleTradeForThis(card) }}>
                                        <SwapHorizIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                                    )}
                                    {giftable && isPremium && (
                                      <Tooltip title="Gift"><IconButton size="small" color="success" sx={{ p: 0.2 }}
                                        onClick={() => { setMissionDetailOpen(false); handleGiftToMe(card) }}>
                                        <CardGiftcardIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                                    )}
                                    <Tooltip title="Wishlist"><IconButton size="small" color="secondary" sx={{ p: 0.2 }}
                                      onClick={() => handleAddToWishlist(card)}>
                                      <WishlistIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
                                  </Box>
                                </Box>
                              </Grid>
                            )
                          })}
                        </Grid>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setMissionDetailOpen(false); loadSetDetail(missionDetailData.set_code) }} size="small">
                View Set
              </Button>
              <Button onClick={() => setMissionDetailOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
    </FadeIn>
  )
}

export default Tracker
