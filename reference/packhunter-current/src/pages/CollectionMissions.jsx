/**
 * Collection Missions Page — Full view of all incomplete themed collection missions
 * Shows grouped mission requirements, ownership progress, and actionable missing cards
 * Uses the grouped_requirements schema from missions.json
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Grid, LinearProgress, Chip, Button, TextField, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Collapse, IconButton, Tooltip,
  InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Snackbar,
  ToggleButton, ToggleButtonGroup, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material'
import {
  Search as SearchIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  ArrowBack as BackIcon, SwapHoriz as TradeIcon, CardGiftcard as GiftIcon,
  CheckCircleOutline as CheckCircleOutlineIcon, CheckCircle as CheckCircleIcon,
  Sync as SyncIcon,
} from '@mui/icons-material'
import { useTheme } from '@mui/material'
import { useAccount } from '../contexts/AccountContext'
import { useThemeMode } from '../contexts/ThemeContext'
import { collection as collectionApi, cards as cardsApi } from '../services/api'
import { RARITY_COLORS, RARITY_NAMES, PACK_COLORS, SET_NAMES } from '../constants/gameData'
import { getRarityChipTextColor } from '../constants/rarityConfig'
import { FadeIn } from '../components/Animations'
import AccountSelector from '../components/AccountSelector'
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons'
import missionData from '../data/missions.json'
import {
  isCardTradable, GIFTABLE_RARITIES, isGroupSatisfied,
  evaluateMission, getAllMissionCardIds, getEvaluableMissions,
  getUnsatisfiedRequirements,
} from '../utils/missionHelpers'
import { getRecommendations, generateCombos, generatePlans } from '../utils/missionRecommendations'
import {
  createExecutionQueue, getActiveStep, completeStep, failStep, skipStep,
  revalidateQueue, isQueueValidForAccount, PLAN_STATUS, STEP_STATUS,
} from '../utils/planExecution'
import { savePlan, loadPlan, clearPlan, hasSavedPlan } from '../utils/planPersistence'
import { executeActionTransaction, computeOwnershipHash, formatDelta } from '../utils/missionDelta'
import { toggleManualCompletion, loadManualCompletions } from '../utils/completionPersistence'
import { getSocket } from '../services/socket'

export default function CollectionMissions({ user }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const { accounts, selectedAccountId, selectAccount } = useAccount()
  const [searchParams] = useSearchParams()

  // Sync account from URL param (passed from Tracker sidebar link)
  useEffect(() => {
    const urlAccount = searchParams.get('account')
    if (urlAccount && accounts.length > 0) {
      const exists = accounts.some(a => a.id === parseInt(urlAccount) || a.id.toString() === urlAccount)
      if (exists && String(selectedAccountId) !== urlAccount) {
        selectAccount(parseInt(urlAccount))
      }
    }
  }, [searchParams, accounts])

  const [loading, setLoading] = useState(true)
  const [ownership, setOwnership] = useState({})
  // Phase 37.2 — ownership account-stamp guard. `ownership` is a single
  // React state (not a per-account map) so a stale in-flight fetch can
  // overwrite the currently-selected account's inventory on rapid
  // account switch. selectedAccountIdRef tracks the LATEST selection; any
  // async .then() callback must compare its originating acctId against
  // this ref before calling setOwnership. Rejecting stale writes makes
  // cross-account ownership leaks structurally impossible — same
  // discipline as setGameCompletedForAccount.
  const selectedAccountIdRef = useRef(selectedAccountId)
  useEffect(() => { selectedAccountIdRef.current = selectedAccountId }, [selectedAccountId])
  // ── Mission completion (game-confirmed) — account-scoped storage ──
  // Bug fix: previously a single React state held "the latest game
  // completion set" without account scope. Switching accounts left the
  // prior account's set in place, applied to the new account's
  // ownership data — producing the reported "ALT shows MAIN's count"
  // contamination. Now keyed per accountId so each account has its
  // own snapshot AND switching cannot leak across accounts.
  //
  //   gameCompletedByAccount = { [accountId]: Set<missionId> | null }
  //   gameCompletedIds       = derived: the current selected account's set
  //
  // Storage is in React state (not localStorage) so a logout / refresh
  // forces a re-fetch — same lifetime as the prior implementation.
  const [gameCompletedByAccount, setGameCompletedByAccountRaw] = useState({})
  const gameCompletedIds = gameCompletedByAccount[selectedAccountId] ?? null

  // Phase 32 — snapshot-overwrite guard. snapshotAppliedRef tracks which
  // accounts have had an authoritative snapshot (DB hydrate or fresh
  // game sync) applied this session. Any write to gameCompletedByAccount
  // must go through setGameCompletedForAccount with an explicit source
  // tag so we can:
  //   - log SNAPSHOT_APPLIED / SYNC_REFRESH as intentional updates
  //   - log STATE_OVERRIDE (with before/after) if any future code path
  //     tries to overwrite a snapshot-mode account with non-sync data
  // The wrapper does NOT block overrides — blocking requires UI intent
  // (e.g. user hits "Sync from Game" again). It only makes silent
  // regressions observable at F12 the moment they happen.
  const snapshotAppliedRef = useRef({})
  const setGameCompletedForAccount = useCallback((acctId, newSet, source) => {
    if (!acctId) return
    setGameCompletedByAccountRaw(prev => {
      const before = prev[acctId]
      const beforeSize = before instanceof Set ? before.size : (before === null ? 'null(error)' : 'absent')
      const afterSize = newSet instanceof Set ? newSet.size : (newSet === null ? 'null(error)' : 'absent')
      const wasSnapshotApplied = !!snapshotAppliedRef.current[acctId]
      const isIntentional = source === 'snapshot' || source === 'sync' || source === 'sync_clear'

      if (wasSnapshotApplied && !isIntentional) {
        // Silent regression detector. If this fires, a code path is
        // stomping on a snapshot-authoritative account state.
        console.warn(
          `[Missions] STATE_OVERRIDE account=${acctId} source=${source} `
          + `before=${beforeSize} after=${afterSize} — rejecting override, snapshot stays authoritative`
        )
        return prev // hard-reject the override
      }

      if (source === 'snapshot' || source === 'sync') {
        snapshotAppliedRef.current[acctId] = true
      }
      console.log(
        `[Missions] ${source === 'snapshot' ? 'SNAPSHOT_APPLIED' : source === 'sync' ? 'SYNC_REFRESH' : 'SYNC_CLEAR'} `
        + `account=${acctId} before=${beforeSize} after=${afterSize}`
      )
      return { ...prev, [acctId]: newSet }
    })
  }, [])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSet, setFilterSet] = useState('')
  const [filterReward, setFilterReward] = useState('all')
  const [sortBy, setSortBy] = useState('closest')
  // Phase 36.1 — default view is "All Missions" so users never land
  // on a filtered subset that hides completed rows by surprise.
  // Toggle to "Missing" is still one click away.
  const [viewMode, setViewMode] = useState('all')
  // Per-set accordion open state. Phase 36.1: all groups COLLAPSED
  // by default so the page is scannable at a glance. User can
  // expand individually, or use the Expand All / Collapse All
  // controls next to the view toggle.
  const [expandedSets, setExpandedSets] = useState({})
  const [expandedMission, setExpandedMission] = useState(null)
  const [detailCards, setDetailCards] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Manual mark done handler — triggers re-evaluation via version counter
  const [manualVersion, setManualVersion] = useState(0)
  const handleToggleManualDone = (missionId) => {
    toggleManualCompletion(selectedAccountId, missionId)
    setManualVersion(v => v + 1)
  }

  const allMissions = useMemo(() => getEvaluableMissions(missionData?.missions), [])
  const allCardIds = useMemo(() => getAllMissionCardIds(allMissions), [allMissions])
  const availableSets = useMemo(() => [...new Set(allMissions.map(m => m.set_code))].sort(), [allMissions])

  // Sync metadata also account-scoped — same root cause as gameCompletedIds.
  // gameSyncByAccount[acctId] = { syncTime: ISO string|null, error: bool }
  const [gameSyncByAccount, setGameSyncByAccount] = useState({})
  const gameSyncTime  = gameSyncByAccount[selectedAccountId]?.syncTime ?? null
  const gameSyncError = gameSyncByAccount[selectedAccountId]?.error ?? false
  // In-flight is a global "is any fetch happening" guard; it is NOT
  // per-account because switching accounts mid-fetch is fine and the
  // prior fetch will set state under its own accountId.
  const [gameFetchInFlight, setGameFetchInFlight] = useState(false)

  // Shared: fetch game completion (with dedup guard).
  //
  // Writes ALL state under the requested acctId so that even if the user
  // switches accounts mid-flight, this fetch's result lands under the
  // ORIGINATING account — not the currently-selected one. This makes
  // cross-account contamination structurally impossible.
  //
  // Diagnostic logging is gated behind a localStorage flag
  // ('vudoo_mission_debug' = '1') so production users see clean logs but
  // operators investigating issues can flip the flag for full visibility.
  const fetchGameCompletion = async (acctId, { force = false, reason = 'page_load' } = {}) => {
    if (gameFetchInFlight) return
    if (!acctId) { console.warn('[Missions] No account selected for game sync'); return }
    const debug = (() => { try { return localStorage.getItem('vudoo_mission_debug') === '1' } catch { return false } })()
    setGameFetchInFlight(true)
    // Reset the originating account's sync state — leave OTHER accounts'
    // state intact (this is the whole point of per-account scoping).
    setGameSyncByAccount(prev => ({ ...prev, [acctId]: { syncTime: null, error: false } }))
    if (debug) console.log(`[Missions][debug] fetch start: account=${acctId} force=${force} reason=${reason}`)
    try {
      const data = await collectionApi.getGameMissionCompletion(acctId, { force, reason })
      if (data.error) throw new Error(data.error)
      const ids = data.completedMissionIds || []
      const now = data.fetchedAt || data.cachedAt || new Date().toISOString()
      // Stamp under the ORIGINATING account, not selectedAccountId.
      setGameCompletedForAccount(acctId, new Set(ids), 'sync')
      setGameSyncByAccount(prev => ({ ...prev, [acctId]: { syncTime: now, error: false } }))
      console.log(`[Missions] Game sync complete for account ${acctId}: ${ids.length} missions confirmed (gameTotal=${data.gameTotal ?? '?'})`)
      if (debug) {
        console.groupCollapsed(`[Missions][debug] account=${acctId} game-confirmed mission ids (${ids.length})`)
        console.log(ids)
        if (data.gameTotal != null && data.gameTotal !== ids.length) {
          console.warn(`[Missions][debug] mapping miss: game returned ${data.gameTotal} completed; only ${ids.length} mapped to our IDs (${data.gameTotal - ids.length} unmapped — game IDs not in mappingIdMapping.json)`)
        }
        console.groupEnd()
      }
    } catch (err) {
      console.error(`[Missions] Game sync failed for account ${acctId}:`, err.message || err)
      // Clear THIS account's set on failure so the evaluator falls back
      // cleanly. Other accounts' sets are untouched.
      setGameCompletedForAccount(acctId, null, 'sync_clear')
      setGameSyncByAccount(prev => ({ ...prev, [acctId]: { syncTime: null, error: true } }))
    } finally {
      setGameFetchInFlight(false)
    }
  }

  // Fetch ownership + persisted mission snapshot on mount / account switch.
  // Phase 31 — hydrate gameCompletedByAccount from DB snapshot (set by
  // the last successful /collection/mission-completion fetch). This
  // restores the last synced game truth on refresh WITHOUT re-hitting
  // the game server. If no snapshot exists (never synced this account),
  // the state stays null and the legacy inferred_persistent / engine
  // fallback applies — identical to pre-Phase-31 behavior. Either way,
  // the fetch is strictly scoped to selectedAccountId; no cross-account
  // leakage at the transport or storage layer.
  //
  // Full game sync is NOT fetched on every page load — expensive (gRPC
  // login + batched IsCompletedV1 calls). User-triggered only (top Sync
  // button or per-page Sync from Game), or refreshed on
  // collection:syncComplete socket event.
  useEffect(() => {
    if (!allCardIds.length || !selectedAccountId) return
    const acctId = selectedAccountId
    setLoading(true)

    Promise.all([
      collectionApi.getMissionProgress(allCardIds, acctId).catch(() => ({ owned: {} })),
      collectionApi.getMissionSnapshot(acctId).catch(() => ({ hasSnapshot: false })),
    ])
      .then(([progressData, snapshotData]) => {
        // Phase 37.2 — stale-fetch guard. If the user switched accounts
        // mid-fetch, the current selected account no longer matches acctId.
        // Dropping the write keeps cross-account leaks structurally
        // impossible (the in-flight ALT fetch cannot stamp MAIN's state
        // and vice versa).
        if (selectedAccountIdRef.current !== acctId) {
          console.warn(
            `[Missions] STALE_FETCH_DROPPED fetchAcct=${acctId} currentAcct=${selectedAccountIdRef.current} `
            + `— ignoring stale ownership/snapshot result (account switched mid-flight)`
          )
          return
        }
        const ownedCount = Object.keys(progressData.owned || {}).length
        setOwnership(progressData.owned || {})
        // Phase 31.1 — explicit source-tracing log. One line per hydrate
        // pass so the exact accountId, snapshot presence, and hydration
        // shape are visible at F12 on every refresh. If this line shows
        // snapshotFound=false for an account that was just synced, the
        // regression is at the persist path (server-side), NOT here.
        console.log(
          `[Missions] hydrate account=${acctId} `
          + `snapshotFound=${!!snapshotData.hasSnapshot} `
          + `snapshotIds=${snapshotData.completedMissionIds?.length ?? 0} `
          + `syncedAt=${snapshotData.syncedAt || 'null'} `
          + `ownershipKeys=${ownedCount}`
        )
        if (snapshotData.hasSnapshot) {
          // Stamp under the ORIGINATING account (acctId), not the
          // currently-selected one — mirrors fetchGameCompletion's
          // discipline so a mid-flight account switch cannot leak.
          const ids = snapshotData.completedMissionIds || []
          setGameCompletedForAccount(acctId, new Set(ids), 'snapshot')
          setGameSyncByAccount(prev => ({ ...prev, [acctId]: { syncTime: snapshotData.syncedAt, error: false } }))
        } else {
          console.log(`[Missions] PROGRESS_APPLIED account=${acctId} snapshot=absent — engine/inferred fallback until next sync`)
        }
      })
      .finally(() => setLoading(false))
  }, [selectedAccountId, allCardIds])

  // Listen for trade/gift/sync success → refresh game completion
  useEffect(() => {
    const socket = getSocket()
    if (!socket || !selectedAccountId) return
    const refresh = () => fetchGameCompletion(selectedAccountId, { force: true, reason: 'post_action' })
    socket.on('trade_request_completed', refresh)
    socket.on('gift_request_completed', refresh)
    socket.on('collection:syncComplete', refresh)
    return () => {
      socket.off('trade_request_completed', refresh)
      socket.off('gift_request_completed', refresh)
      socket.off('collection:syncComplete', refresh)
    }
  }, [selectedAccountId])

  // Evaluate all missions
  const evaluatedMissions = useMemo(() => {
    if (!Object.keys(ownership).length) return []

    // Phase 37.1 — strict two-source completion rule.
    //
    //   Snapshot exists for this account  → completion IS snapshot-membership
    //                                        (authoritative; inventory has no say)
    //   No snapshot exists                → completion = ownedCount >= requiredCount
    //                                        (pure targets math)
    //
    // Explicitly removed: localStorage `inferred_persistent` latches,
    // manual-click latches, resolveMissionCompletion's multi-source
    // priority chain. Those were causing false positives:
    //   - a mission latched complete months ago could stay complete
    //     on an Alt that no longer owns the cards
    //   - snapshot state could be silently overwritten when inventory
    //     re-evaluated the mission on mount
    //
    // snapshotMode is TRUE even for an empty snapshot (user synced and
    // has zero completions) so a fresh alt doesn't fall through to
    // stale latches.
    const snapshotMode = gameCompletedIds != null

    // 2026-04-24 — re-introduce explicit manual override at the TOP of
    // the priority chain (manual > snapshot > inventory). Manual
    // override is per-account localStorage, set only by direct user
    // action on the "Mark as completed in-game" button, and cleared by
    // the same button (or the new Reset Override action). This is NOT
    // the Phase 37.1 "inferred_persistent" latch which was correctly
    // removed — those latches were set automatically and survived
    // account switches, causing false positives. This manual set is
    // set-by-user-only and scoped to the selected account.
    // Dependency on manualVersion ensures the useMemo re-runs on toggle.
    const manualSet = loadManualCompletions(selectedAccountId)
    // eslint-disable-next-line no-unused-expressions
    manualVersion

    // Debug instrumentation — unchanged flag. Now logs source of
    // completion decision per evaluation pass.
    const debug = (() => { try { return localStorage.getItem('vudoo_mission_debug') === '1' } catch { return false } })()

    const result = allMissions
      .map(m => {
        const ev = evaluateMission(m, ownership)

        // Completion priority: manual override > snapshot > targets math.
        const manualOverride = manualSet.has(m.id)
        const isComplete = manualOverride
          ? true
          : snapshotMode
            ? gameCompletedIds.has(m.id)
            : (ev.ownedCount >= ev.requiredCount && ev.requiredCount > 0)

        // Display override: when complete, render ownedCount = requiredCount
        // so the X/Y label, remaining count, and progress bar all agree.
        // Needed because snapshot-completion may disagree with a stale
        // inventory that undercounts (e.g. user traded cards after
        // completing the mission in-game).
        const displayOwned = isComplete
          ? ev.requiredCount
          : Math.min(ev.ownedCount ?? 0, ev.requiredCount ?? 0)
        const displayRemaining = Math.max(0, (ev.requiredCount ?? 0) - displayOwned)

        const totalHourglass = (m.wonder_hourglass || 0) + (m.pack_hourglass || 0)
        const score = totalHourglass * (1 + (ev.progressRatio || 0) * 3)

        // Phase 38 — Trust & Clarity flag. True ONLY when the game
        // snapshot says the mission is complete but the local inventory
        // does not have enough of the required cards (e.g. user traded
        // cards away after completing the mission in-game, or inventory
        // sync lags behind mission sync). The UI uses this flag to add
        // a subtle "Completed via Game Sync" badge + a detail helper
        // line explaining why the mission reads complete despite local
        // inventory appearing short. Logic layer ignores this flag —
        // completion truth stays snapshot-authoritative per Phase 37.1.
        const isSnapshotCompleteMismatch =
          isComplete
          && snapshotMode
          && (ev.ownedCount ?? 0) < (ev.requiredCount ?? 0)

        return {
          ...m, ...ev,
          // Override ownedCount / remaining / progressRatio so every
          // consumer of the mission object sees the same numbers.
          ownedCount: displayOwned,
          remaining: displayRemaining,
          progressRatio: ev.requiredCount > 0 ? displayOwned / ev.requiredCount : (isComplete ? 1 : 0),
          totalHourglass, score,
          completionSource: manualOverride
            ? 'manual'
            : (snapshotMode ? 'snapshot' : 'targets'),
          manualOverride,
          isComplete,
          isSnapshotCompleteMismatch,
        }
      })

    // Phase 37.1 — one structured log per evaluation pass.
    // No more localStorage read for completion; no `completedSaved`
    // or `manual` contribution to the decision.
    try {
      const completeCount = result.filter(m => m.isComplete).length
      console.log(
        `[Missions] eval account=${selectedAccountId} `
        + `total=${allMissions.length} complete=${completeCount} `
        + `snapshotMode=${snapshotMode} `
        + `snapshotSize=${gameCompletedIds ? gameCompletedIds.size : 0} `
        + `countSource=${snapshotMode ? 'snapshot' : 'targets'}`
      )
    } catch { /* logging must never break evaluation */ }

    if (debug) {
      console.groupCollapsed(
        `[Missions][debug] account=${selectedAccountId} snapshotMode=${snapshotMode} total=${allMissions.length}`
      )
      console.log(`completion source: ${snapshotMode ? 'snapshot-membership' : 'targets-math'}`)
      console.log(`snapshot set size: ${gameCompletedIds ? gameCompletedIds.size : 0}`)
      console.groupEnd()
    }

    return result
  }, [allMissions, ownership, selectedAccountId, gameCompletedIds, manualVersion])

  // Incomplete slice used for summary counts. All missions stay in
  // evaluatedMissions per Phase 36; this derivation is purely for
  // the "X incomplete" header + summary card semantics that shipped
  // before Phase 36.
  const incompleteMissions = useMemo(
    () => evaluatedMissions.filter(m => !m.isComplete),
    [evaluatedMissions]
  )

  // Filter + sort
  const filteredMissions = useMemo(() => {
    // Phase 36 — viewMode gate applied FIRST. Default 'missing'
    // mirrors pre-Phase-36 UX; 'all' surfaces completed rows too.
    let result = viewMode === 'missing'
      ? evaluatedMissions.filter(m => !m.isComplete)
      : [...evaluatedMissions]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(m =>
        m.mission_name.toLowerCase().includes(q) ||
        m.set_code.toLowerCase().includes(q) ||
        m.set_name?.toLowerCase().includes(q) ||
        m.groups.some(g => g.lookup_name?.toLowerCase().includes(q))
      )
    }
    if (filterSet) result = result.filter(m => m.set_code === filterSet)
    if (filterReward === 'wonder') result = result.filter(m => m.wonder_hourglass > 0)
    else if (filterReward === 'pack') result = result.filter(m => m.pack_hourglass > 0)
    else if (filterReward === 'hourglass') result = result.filter(m => m.totalHourglass > 0)

    // Phase 36 — incomplete always first within each sort so a
    // completed mission never buries an incomplete one in the list.
    const byCompletion = (a, b) => (a.isComplete ? 1 : 0) - (b.isComplete ? 1 : 0)
    // Phase 37.2 — sort "closest" uses mission.remaining (from the same
    // resolved object rows render) instead of the legacy
    // unsatisfiedGroups evaluator field. Keeps sort order consistent
    // with the displayed X/Y.
    if (sortBy === 'closest') result.sort((a, b) => byCompletion(a, b) || (a.remaining ?? 0) - (b.remaining ?? 0) || b.score - a.score)
    else if (sortBy === 'wonder') result.sort((a, b) => byCompletion(a, b) || b.wonder_hourglass - a.wonder_hourglass)
    else if (sortBy === 'pack') result.sort((a, b) => byCompletion(a, b) || b.pack_hourglass - a.pack_hourglass)
    else if (sortBy === 'reward') result.sort((a, b) => byCompletion(a, b) || b.totalHourglass - a.totalHourglass)
    else if (sortBy === 'alpha') result.sort((a, b) => byCompletion(a, b) || a.mission_name.localeCompare(b.mission_name))
    else if (sortBy === 'set') result.sort((a, b) => a.set_code.localeCompare(b.set_code) || byCompletion(a, b) || a.mission_name.localeCompare(b.mission_name))
    return result
  }, [evaluatedMissions, viewMode, searchQuery, filterSet, filterReward, sortBy])

  // Phase 36 — set-grouped mission list. Each group carries its own
  // total / missing count so accordions can show per-pack progress
  // without re-scanning the main list.
  const missionsByGroup = useMemo(() => {
    const groups = new Map()
    for (const m of filteredMissions) {
      const key = m.set_code || '?'
      if (!groups.has(key)) {
        groups.set(key, { setCode: key, setName: m.set_name || key, missions: [], total: 0, missing: 0 })
      }
      const g = groups.get(key)
      g.missions.push(m)
      g.total++
      if (!m.isComplete) g.missing++
    }
    return [...groups.values()].sort((a, b) => a.setCode.localeCompare(b.setCode))
  }, [filteredMissions])

  // Phase 37.2 — summary derives EXCLUSIVELY from evaluatedMissions.
  // Prior code read `loadCompletedMissions` / `loadManualCompletions` from
  // localStorage for the "Completed (Saved)" / "Manual" chips; those are
  // Phase-37.1-obsolete latches and can contradict what rows actually
  // render (rows respect snapshot, latches persist across schema versions).
  // Now one source of truth: rows + summary + oneAway all read from the
  // same evaluatedMissions object so counts cannot diverge from rows.
  const summary = useMemo(() => {
    const completedCount = evaluatedMissions.length - incompleteMissions.length
    return {
      total: incompleteMissions.length,
      totalAll: evaluatedMissions.length,
      completed: completedCount,
      completedGame: gameCompletedIds ? gameCompletedIds.size : 0,
      wonderTotal: incompleteMissions.reduce((s, m) => s + (m.wonder_hourglass || 0), 0),
      packTotal: incompleteMissions.reduce((s, m) => s + (m.pack_hourglass || 0), 0),
      // Phase 37.2 — 1-card-away uses mission.remaining from the same
      // resolved object, NOT mission.unsatisfiedGroups (legacy evaluator
      // field that is snapshot-unaware).
      oneAway: incompleteMissions.filter(m => (m.remaining ?? 0) === 1).length,
    }
  }, [evaluatedMissions, incompleteMissions, gameCompletedIds])

  // Card metadata for recommendations (fetched once when ownership loads)
  const [cardMeta, setCardMeta] = useState({})
  useEffect(() => {
    if (!evaluatedMissions.length || !Object.keys(ownership).length) return
    // Collect all missing card IDs using unified helper (correct for all mission modes)
    const missingIds = new Set()
    evaluatedMissions.forEach(m => {
      const reqStatus = getUnsatisfiedRequirements(m, ownership)
      ;(reqStatus.missingCardIds || []).forEach(id => missingIds.add(id))
    })
    if (missingIds.size === 0) return
    // Fetch metadata in batches (max 100 per request)
    const ids = [...missingIds]
    const batchSize = 100
    const fetches = []
    for (let i = 0; i < ids.length; i += batchSize) {
      fetches.push(collectionApi.getCardDetails(ids.slice(i, i + batchSize), selectedAccountId))
    }
    Promise.all(fetches).then(results => {
      const meta = {}
      results.forEach(r => (r.cards || []).forEach(c => { meta[c.card_id] = c }))
      setCardMeta(meta)
    }).catch(() => {})
  }, [evaluatedMissions, ownership, selectedAccountId])

  // Recommendations — computed from missions + ownership + card metadata
  const recommendations = useMemo(() => {
    if (!evaluatedMissions.length || !Object.keys(ownership).length || !Object.keys(cardMeta).length) return null
    return getRecommendations(allMissions, ownership, cardMeta, 3)
  }, [allMissions, ownership, cardMeta])

  // Smart Combos — multi-step strategy plans
  const combos = useMemo(() => {
    if (!recommendations?._allRanked?.length || !Object.keys(ownership).length) return []
    return generateCombos(allMissions, ownership, recommendations._allRanked, {
      maxCandidates: 12, maxResults: 3, include3Card: true,
    })
  }, [recommendations, allMissions, ownership])

  // Auto-Plans — sequenced step-by-step actions with incremental outcomes
  const plans = useMemo(() => {
    if (!recommendations?._allRanked?.length || !Object.keys(ownership).length) return []
    return generatePlans(allMissions, ownership, recommendations._allRanked, {
      maxCandidates: 10, maxSteps: 3, maxResults: 2,
    })
  }, [recommendations, allMissions, ownership])

  // ── Execution Queue ──
  const [execQueue, setExecQueue] = useState(null)
  const [execLoading, setExecLoading] = useState(false)
  const [execMessage, setExecMessage] = useState(null)
  const isPremium = user?.subscriptionTier === 'premium' || user?.subscriptionTier === 'admin'

  // Delta summary state
  const [lastDelta, setLastDelta] = useState(null)

  // Persist plan to sessionStorage when it changes (with ownership hash for stale detection)
  useEffect(() => {
    savePlan(execQueue, computeOwnershipHash(ownership))
  }, [execQueue, ownership])

  // Restore saved plan on mount (if same account)
  const [showResumeBanner, setShowResumeBanner] = useState(false)
  useEffect(() => {
    if (!selectedAccountId || execQueue) return
    if (hasSavedPlan(selectedAccountId)) {
      setShowResumeBanner(true)
    }
  }, [selectedAccountId])

  const handleResumePlan = () => {
    const saved = loadPlan(selectedAccountId)
    if (!saved) { setShowResumeBanner(false); return }

    // Check ownership hash — warn if collection changed since plan was saved
    const currentHash = computeOwnershipHash(ownership)
    const ownershipChanged = saved.ownershipHash && saved.ownershipHash !== currentHash

    // Reconstruct queue from saved step data
    const restored = {
      id: `plan_restored_${Date.now()}`,
      status: PLAN_STATUS.IN_PROGRESS,
      accountId: saved.accountId,
      createdAt: saved.timestamp,
      steps: saved.steps.map((s, i) => ({
        ...s, index: i,
        tradeable: s.actionType === 'trade',
        giftable: s.actionType === 'gift',
        expectedMissions: 0, expectedWonder: 0, expectedPack: 0, expectedGroups: 0,
        actualMissions: null, actualWonder: null, actualPack: null,
        skipReason: null, failReason: null, completedAt: null,
      })),
      originalTotalMissions: 0, originalTotalWonder: 0, originalTotalPack: 0,
      completedMissions: saved.completedMissions || 0,
      completedWonder: saved.completedWonder || 0,
      completedPack: saved.completedPack || 0,
    }

    // ALWAYS revalidate against FRESH ownership — never trust persisted statuses
    const revalidated = revalidateQueue(restored, allMissions, ownership)
    setExecQueue(revalidated)
    setShowResumeBanner(false)

    const staleSteps = revalidated.steps.filter(s => s.status === 'no_longer_needed').length
    const msg = ownershipChanged
      ? `Plan restored — collection changed since last session${staleSteps > 0 ? `, ${staleSteps} step${staleSteps > 1 ? 's' : ''} no longer needed` : ''}`
      : 'Plan restored and revalidated'
    setExecMessage({ type: ownershipChanged ? 'warning' : 'success', text: msg })
  }

  const handleDismissResume = () => {
    clearPlan()
    setShowResumeBanner(false)
  }

  // Invalidate queue on account switch
  useEffect(() => {
    if (execQueue && !isQueueValidForAccount(execQueue, selectedAccountId)) {
      setExecQueue(null)
      setExecMessage(null)
      clearPlan()
    }
  }, [selectedAccountId])

  // Phase 37.2 — reset per-account transient UI state on account switch so
  // ALT cannot inherit MAIN's expanded-row, card metadata, or delta banner.
  // These are NOT keyed by accountId (unlike gameCompletedByAccount /
  // gameSyncByAccount) because they are genuinely ephemeral — clearing on
  // switch is simpler than maintaining per-account caches for data that
  // re-fetches on expand.
  useEffect(() => {
    setExpandedMission(null)
    setDetailCards([])
    setLastDelta(null)
  }, [selectedAccountId])

  // Start executing a plan
  const handleStartPlan = (plan) => {
    const queue = createExecutionQueue(plan, selectedAccountId)
    queue.status = PLAN_STATUS.IN_PROGRESS
    setExecQueue(queue)
    setExecMessage(null)
  }

  // Execute the active step — opens inline trade dialog or fires gift directly
  const handleExecuteStep = async (stepIndex) => {
    if (!execQueue || !selectedAccountId) return
    const step = execQueue.steps[stepIndex]
    if (!step || step.status !== STEP_STATUS.ACTIVE) return

    if (step.actionType === 'trade') {
      // Open inline trade confirmation dialog (same UX as Trade page)
      handleTradeAction({
        card_id: step.cardId,
        backend_id: step.backendId,
        card_name: step.cardName,
        cardId: step.cardId,
        backendId: step.backendId,
        cardName: step.cardName,
      }, stepIndex)
    } else if (step.actionType === 'gift') {
      // Gift executes directly (no confirmation needed — same as Tracker)
      setExecLoading(true)
      await handleGiftAction({
        backend_id: step.backendId,
        cardId: step.cardId,
        card_name: step.cardName,
        cardName: step.cardName,
      }, stepIndex)
      setExecLoading(false)
    }
  }

  // Retry a failed step — revalidate before retrying
  const handleRetryStep = async (stepIndex) => {
    if (!execQueue || !selectedAccountId) return
    const step = execQueue.steps[stepIndex]
    if (!step) return

    setExecMessage(null)

    // Revalidate: check if the card is now owned or step is no longer needed
    try {
      const freshData = await collectionApi.getMissionProgress([step.cardId], selectedAccountId)
      const owned = (freshData.owned?.[step.cardId] || 0)
      if (owned > 0) {
        // Card now owned — skip instead of retry
        const updated = skipStep(execQueue, stepIndex, 'Card is now owned — no action needed')
        setExecQueue(revalidateQueue(updated, allMissions, ownership))
        setExecMessage({ type: 'success', text: `${step.cardName} is already owned — step skipped` })
        return
      }
    } catch (e) { /* revalidation failed, proceed with retry */ }

    // Reset step to active
    const q = { ...execQueue, steps: execQueue.steps.map(s => ({ ...s })) }
    q.steps[stepIndex].status = STEP_STATUS.ACTIVE
    q.steps[stepIndex].failReason = null
    q.status = PLAN_STATUS.IN_PROGRESS
    setExecQueue(q)
  }

  // Skip a step
  const handleSkipStep = (stepIndex) => {
    setExecQueue(skipStep(execQueue, stepIndex, 'Skipped by user'))
  }

  // Cancel execution
  const handleCancelPlan = () => {
    setExecQueue(null)
    setExecMessage(null)
  }

  // ── Inline Trade/Gift Actions ──
  const [tradeCard, setTradeCard] = useState(null)
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false)
  const [tradeSubmitting, setTradeSubmitting] = useState(false)
  const [actionSnackbar, setActionSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [tradePlanStepIndex, setTradePlanStepIndex] = useState(null)
  // Active trade request tracking (after request creation, shows progress inline)
  const [activeTradeRequest, setActiveTradeRequest] = useState(null) // { id, status, ... }
  const [pickCards, setPickCards] = useState([]) // cards to pick from during PICK_CARD
  const [pickSearch, setPickSearch] = useState('')
  const [picking, setPicking] = useState(null)

  const handleTradeAction = (card, planStepIndex = null) => {
    setTradeCard(card)
    setTradePlanStepIndex(planStepIndex)
    setTradeDialogOpen(true)
  }

  const handleGiftAction = async (card, planStepIndex = null) => {
    if (!selectedAccountId) return
    setTradeSubmitting(true)
    try {
      const res = await fetch('/api/auto-gift/request', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.backend_id || card.cardId, accountId: selectedAccountId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Gift request failed')
      }
      setActionSnackbar({ open: true, message: `Gift request created for ${card.card_name || card.cardName}!`, severity: 'success' })

      // If this was a plan step, complete it
      if (planStepIndex !== null && execQueue) {
        await completeAndRefreshPlanStep(planStepIndex)
      }
    } catch (err) {
      setActionSnackbar({ open: true, message: `Gift failed: ${err.message}`, severity: 'error' })
      if (planStepIndex !== null && execQueue) {
        setExecQueue(failStep(execQueue, planStepIndex, err.message))
      }
    }
    setTradeSubmitting(false)
  }

  const handleTradeConfirm = async () => {
    if (!tradeCard || !selectedAccountId) return
    setTradeSubmitting(true)
    try {
      const { autoTrade } = await import('../services/api')
      const result = await autoTrade.createRequest(tradeCard.backend_id || tradeCard.backendId || tradeCard.card_id || tradeCard.cardId, selectedAccountId)
      // FIX: API returns { success, request: { id, ... } }, NOT { requestId }
      const requestId = result.request?.id || result.requestId || result.id
      if (!requestId) {
        throw new Error('No request ID returned from API')
      }
      const cardName = tradeCard.card_name || tradeCard.cardName

      setActiveTradeRequest({ id: requestId, status: 'MATCHING', cardName })
      setTradeSubmitting(false)

      // Poll for trade status updates every 5s for up to 10 minutes
      const pollTradeStatus = async () => {
        const { autoTrade: api } = await import('../services/api')
        for (let i = 0; i < 120; i++) { // 120 × 5s = 10 minutes
          await new Promise(r => setTimeout(r, 5000))
          try {
            const requests = await api.getRequests()
            const req = (requests.requests || requests).find(r => r.id === requestId)
            if (!req) {
              console.log(`[InlineTrade] Poll ${i}: request ${requestId} not found in list`)
              continue
            }

            console.log(`[InlineTrade] Poll ${i}: request ${requestId} status=${req.status}`)
            setActiveTradeRequest(prev => prev ? { ...prev, status: req.status, friendCode: req.matched_friend_code } : null)

            // Card picker: trigger on PICK_CARD, TRADE_PROPOSAL_SENT, or WAITING_TRADE_RESPONSE
            if (['PICK_CARD', 'TRADE_PROPOSAL_SENT', 'WAITING_TRADE_RESPONSE'].includes(req.status)) {
              try {
                const myCards = await api.getMyCards(req.id)
                if (myCards.cards?.length > 0) setPickCards(myCards.cards)
              } catch (e) { /* not ready yet */ }
            }

            // Terminal states
            if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(req.status)) {
              if (req.status === 'COMPLETED') {
                setActionSnackbar({ open: true, message: `Trade completed for ${cardName}!`, severity: 'success' })
                if (tradePlanStepIndex !== null && execQueue) {
                  await completeAndRefreshPlanStep(tradePlanStepIndex)
                }
              } else {
                setActionSnackbar({ open: true, message: `Trade ${req.status.toLowerCase()}: ${req.error_message || ''}`, severity: 'error' })
                if (tradePlanStepIndex !== null && execQueue) {
                  setExecQueue(failStep(execQueue, tradePlanStepIndex, req.error_message || req.status))
                }
              }
              setTradeDialogOpen(false)
              setActiveTradeRequest(null)
              setPickCards([])
              setTradeCard(null)
              setTradePlanStepIndex(null)
              return
            }
          } catch (e) {
            console.warn(`[InlineTrade] Poll ${i} error:`, e.message)
          }
        }
        // Polling exhausted — trade may still be in progress but dialog won't track it
        console.warn(`[InlineTrade] Polling exhausted for request ${requestId}`)
        setActiveTradeRequest(prev => prev ? { ...prev, status: 'TIMED_OUT' } : null)
      }
      pollTradeStatus()
    } catch (err) {
      setActionSnackbar({ open: true, message: `Trade failed: ${err.message}`, severity: 'error' })
      if (tradePlanStepIndex !== null && execQueue) {
        setExecQueue(failStep(execQueue, tradePlanStepIndex, err.message))
      }
      setTradeSubmitting(false)
    }
  }

  const handlePickCard = async (card) => {
    setPicking(card.cardId)
    try {
      const { autoTrade } = await import('../services/api')
      await autoTrade.pickTradeCard(activeTradeRequest.id, card.cardId, card.expansionId)
      setActiveTradeRequest(prev => prev ? { ...prev, status: 'CONFIRMING' } : null)
      setPickCards([])
    } catch (err) {
      setActionSnackbar({ open: true, message: `Pick failed: ${err.message}`, severity: 'error' })
    }
    setPicking(null)
  }

  // Shared: complete plan step + refresh ownership
  const completeAndRefreshPlanStep = async (stepIndex) => {
    // UNIFIED TRANSACTION: one API call, one ownership, one delta, one revalidation
    // Captures beforeOwnership synchronously BEFORE any async gap
    const beforeOwnership = { ...ownership }
    // Phase 38 — account-race guard. Mirrors the hydrate-path discipline
    // in the main useEffect: capture the originating accountId at the
    // start of the async, and drop the result if the user switched
    // accounts mid-flight. Without this, a completed trade/gift on
    // Account A can stamp A's fresh inventory under Account B after a
    // rapid switch.
    const acctIdAtStart = selectedAccountIdRef.current

    const result = await executeActionTransaction({
      beforeOwnership,
      missions: allMissions,
      allCardIds,
      accountId: selectedAccountId,
      collectionApi,
      execQueue,
      stepIndex,
      cardMetadata: cardMeta,
    })

    if (selectedAccountIdRef.current !== acctIdAtStart) {
      console.warn(
        `[Missions] STALE_EXECUTION_RESULT_DROPPED acctIdAtStart=${acctIdAtStart} `
        + `current=${selectedAccountIdRef.current} — account switched mid-flight, `
        + `not applying ownership/queue/delta updates`
      )
      return
    }

    setOwnership(result.freshOwnership)
    setExecQueue(result.updatedQueue)
    if (result.delta.hasChanges) {
      setLastDelta({ ...result.delta, nextBestAction: result.nextBestAction })
    }
    // Persist plan with ownership hash for stale detection
    savePlan(result.updatedQueue, result.ownershipHash)
    const nextStep = getActiveStep(updated)
    if (nextStep) {
      setActionSnackbar(prev => ({
        ...prev, message: prev.message + ` → Next: ${nextStep.cardName}`,
      }))
    } else if (updated.status === PLAN_STATUS.COMPLETED) {
      setActionSnackbar(prev => ({
        ...prev, message: prev.message + ' → Plan complete!',
      }))
    }
  }

  // Expand mission detail
  const handleExpand = async (mission) => {
    if (expandedMission === mission.id) { setExpandedMission(null); return }
    setExpandedMission(mission.id)
    setDetailLoading(true)
    setDetailCards([])
    try {
      // Use unified helper — correct for grouped, quota, AND hybrid missions
      const reqStatus = getUnsatisfiedRequirements(mission, ownership)
      const missingIds = reqStatus.missingCardIds || []
      if (missingIds.length > 0) {
        const data = await collectionApi.getCardDetails(missingIds, selectedAccountId)
        setDetailCards(data.cards || [])
      }
    } catch (e) { console.error('[CollectionMissions] Detail error:', e) }
    setDetailLoading(false)
  }

  if (loading) return <TablePageSkeleton />

  return (
    <FadeIn>
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button href="/tracker" startIcon={<BackIcon />} size="small">Tracker</Button>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Collection Missions</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {summary.total} incomplete for {accounts.find(a => a.id === selectedAccountId)?.nickname || 'selected account'}
            </Typography>
            <Button
              size="small"
              variant={gameSyncError ? 'contained' : 'outlined'}
              color={gameSyncError ? 'error' : gameSyncTime ? 'success' : 'primary'}
              startIcon={gameFetchInFlight ? <CircularProgress size={14} color="inherit" /> : <SyncIcon sx={{ fontSize: 16 }} />}
              onClick={() => fetchGameCompletion(selectedAccountId, { force: true, reason: 'manual_refresh' })}
              disabled={gameFetchInFlight || !selectedAccountId}
              sx={{ textTransform: 'none', fontSize: '0.72rem', height: 30, borderRadius: '8px', px: 1.5 }}
            >
              {gameFetchInFlight ? 'Syncing from game...' : gameSyncError ? 'Sync failed — retry' : gameSyncTime ? `Synced ${(() => {
                const ago = Math.round((Date.now() - new Date(gameSyncTime).getTime()) / 1000)
                if (ago < 60) return 'just now'
                if (ago < 3600) return `${Math.round(ago / 60)}m ago`
                return `${Math.round(ago / 3600)}h ago`
              })()}` : 'Sync from Game'}
            </Button>
          </Box>
        </Box>
        <AccountSelector minWidth={150} />
      </Box>

      {/* Resume Plan Banner */}
      {showResumeBanner && !execQueue && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" onClick={handleResumePlan} sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, textTransform: 'none' }}>
                Resume Plan
              </Button>
              <Button size="small" onClick={handleDismissResume} sx={{ textTransform: 'none' }}>Dismiss</Button>
            </Box>
          }>
          You have an unfinished plan from a previous session. Resume where you left off?
        </Alert>
      )}

      {/* Delta Summary — "What Changed" + Next Best Action */}
      {lastDelta && lastDelta.hasChanges && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}
          onClose={() => setLastDelta(null)}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>✨ What changed</Typography>
          <Typography sx={{ fontSize: '0.8rem' }}>{formatDelta(lastDelta)}</Typography>
          {lastDelta.completedMissionNames?.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Completed: {lastDelta.completedMissionNames.join(', ')}
            </Typography>
          )}
          {lastDelta.nextBestAction && (
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                👉 Next: {lastDelta.nextBestAction.actionType === 'trade' ? 'Trade' : 'Gift'} for {lastDelta.nextBestAction.cardName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                — {lastDelta.nextBestAction.reason}
              </Typography>
            </Box>
          )}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Incomplete', value: summary.total, color: theme.palette.primary.main },
          // Phase 37.2 — single "Completed" count matches rendered ✓ rows 1:1.
          ...(summary.completed > 0 ? [{ label: 'Completed', value: summary.completed, color: theme.palette.success.main }] : []),
          { label: 'Wonder Hourglass', value: summary.wonderTotal, color: theme.palette.warning.main, prefix: '⏳ ' },
          { label: 'Pack Hourglass', value: summary.packTotal, color: theme.palette.info.main, prefix: '📦 ' },
          { label: '1 Card Away', value: summary.oneAway, color: theme.palette.success.main },
        ].map(card => (
          <Grid item xs={6} sm={3} key={card.label}>
            <Box sx={{
              p: 2, borderRadius: '12px', textAlign: 'center',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: card.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {card.prefix || ''}{card.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{card.label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* ── Recommendations ── */}
      {recommendations && (recommendations.bestCards.length > 0 || recommendations.instantWins.length > 0) && (
        <Box sx={{
          mb: 2, p: 2, borderRadius: '12px',
          bgcolor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(92, 106, 196, 0.04)',
          border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.1)'}`,
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1.5, color: 'text.primary' }}>
            Best Next Actions
          </Typography>

          {/* Instant Wins — outcome-first */}
          {recommendations.instantWins.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'success.main', display: 'block', mb: 0.75 }}>
                Complete missions now
              </Typography>
              {recommendations.instantWins.map(card => (
                <Box key={card.cardId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1, mb: 0.4, borderRadius: '8px', bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  {card.backendId && <Box component="img" src={cardsApi.getImageUrl(card.backendId)} alt="" sx={{ width: 28, height: 39, objectFit: 'contain', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none' }} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2 }}>
                      {card.tradeable ? 'Trade' : 'Gift'} for {card.cardName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.primary', fontWeight: 500 }}>
                      {card.wonderUnlocked > 0 ? `+⏳${card.wonderUnlocked}` : ''}{card.packUnlocked > 0 ? `${card.wonderUnlocked > 0 ? ' + ' : '+'}📦${card.packUnlocked}` : ''} · {card.missionsCompleted} mission{card.missionsCompleted > 1 ? 's' : ''} complete
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', fontStyle: 'italic' }}>
                      {card.missionsCompleted === 1 ? 'Only missing card for this mission' : 'Completes shared requirements'}
                    </Typography>
                  </Box>
                  <Chip label={card.tradeable ? 'Trade' : 'Gift'} size="small" color={card.tradeable ? 'primary' : 'success'} sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700 }} />
                </Box>
              ))}
            </Box>
          )}

          {/* Best cards — outcome-first */}
          {recommendations.bestCards.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'primary.main', display: 'block', mb: 0.75 }}>
                {recommendations.instantWins.length > 0 ? 'Also high value' : 'Best cards to get'}
              </Typography>
              {recommendations.bestCards.slice(0, 3).map(card => (
                <Box key={card.cardId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1, mb: 0.4, borderRadius: '8px', bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  {card.backendId && <Box component="img" src={cardsApi.getImageUrl(card.backendId)} alt="" sx={{ width: 28, height: 39, objectFit: 'contain', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none' }} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.2 }}>{card.cardName}</Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                      Progress toward {card.missionsAffected} mission{card.missionsAffected > 1 ? 's' : ''} ({card.groupsSatisfied} group{card.groupsSatisfied > 1 ? 's' : ''})
                    </Typography>
                  </Box>
                  <Chip label={card.tradeable ? 'Trade' : card.giftable ? 'Gift' : 'Collect'} size="small" color={card.tradeable ? 'primary' : card.giftable ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700 }} />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ── Auto Plan + Execution Queue ── */}
      {(plans.length > 0 || execQueue) && (
        <Box sx={{
          mb: 2, p: 2, borderRadius: '14px',
          background: isDark
            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(59, 130, 246, 0.06))'
            : 'linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(59, 130, 246, 0.03))',
          border: `1px solid ${isDark ? 'rgba(124, 58, 237, 0.18)' : 'rgba(124, 58, 237, 0.12)'}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography sx={{ fontSize: '1rem' }}>🎯</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary' }}>
              Your Plan
            </Typography>
          </Box>

          {plans.map((plan, pi) => (
            <Box key={pi} sx={{
              mb: pi < plans.length - 1 ? 2 : 0,
              ...(pi > 0 && { pt: 2, borderTop: '1px solid', borderColor: 'divider' }),
            }}>
              {plans.length > 1 && (
                <Typography variant="caption" sx={{
                  fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                  color: plan.planType === 'best' ? '#7c3aed' : plan.planType === 'fastest' ? 'success.main' : 'primary.main',
                  letterSpacing: '0.05em', display: 'block', mb: 1,
                }}>
                  {plan.planType === 'best' ? '🔥 Best Plan' : plan.planType === 'fastest' ? '⚡ Fastest' : '💎 High Value'}
                </Typography>
              )}

              {/* Steps */}
              {plan.sequence.map((step, si) => (
                <Box key={si} sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.75, pl: 0.5,
                }}>
                  <Box sx={{
                    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, mt: 0.2,
                    bgcolor: step.stepMissions > 0 ? 'success.main' : 'action.selected',
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: step.stepMissions > 0 ? 'white' : 'text.secondary' }}>
                      {si + 1}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.3 }}>
                      {step.tradeable ? 'Trade' : step.giftable ? 'Gift' : 'Get'} for {step.cardName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: step.stepMissions > 0 ? 'success.main' : 'text.secondary', fontWeight: step.stepMissions > 0 ? 600 : 400 }}>
                      {step.stepMissions > 0
                        ? `→ completes ${step.stepMissions} mission${step.stepMissions > 1 ? 's' : ''}${step.stepWonder > 0 ? ` · +⏳${step.stepWonder}` : ''}${step.stepPack > 0 ? ` · +📦${step.stepPack}` : ''}`
                        : `→ ${step.stepGroups} requirement${step.stepGroups !== 1 ? 's' : ''} satisfied`}
                    </Typography>
                  </Box>
                  <Chip label={step.tradeable ? 'Trade' : 'Gift'} size="small"
                    color={step.tradeable ? 'primary' : 'success'}
                    sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, mt: 0.3 }} />
                </Box>
              ))}

              {/* Total */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, pt: 1,
                borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>
                  Total: {plan.steps} {plan.allTradeable ? 'trade' : 'action'}{plan.steps > 1 ? 's' : ''}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary' }}>
                  → {plan.totalMissions} mission{plan.totalMissions !== 1 ? 's' : ''}
                </Typography>
                {plan.totalWonder > 0 && (
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>
                    · +⏳{plan.totalWonder}
                  </Typography>
                )}
                {plan.totalPack > 0 && (
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'info.main' }}>
                    · +📦{plan.totalPack}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}

          {/* Execute Plan button — only when no active execution */}
          {!execQueue && plans.length > 0 && isPremium && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="contained" size="small"
                onClick={() => handleStartPlan(plans[0])}
                sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, textTransform: 'none', fontWeight: 600 }}
              >
                Execute Plan
              </Button>
            </Box>
          )}
          {!isPremium && plans.length > 0 && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
              Premium required to execute plans
            </Typography>
          )}

          {/* Execution Queue Tracker */}
          {execQueue && (
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: execQueue.status === PLAN_STATUS.COMPLETED ? 'success.main' : execQueue.status === PLAN_STATUS.PAUSED ? 'warning.main' : '#7c3aed' }}>
                  {execQueue.status === PLAN_STATUS.COMPLETED ? '✅ Plan Complete!'
                    : execQueue.status === PLAN_STATUS.PAUSED ? '⏸ Plan Paused — retry or skip the failed step to continue'
                    : `▶ Executing step ${execQueue.steps.filter(s => s.status === STEP_STATUS.COMPLETED).length + 1} of ${execQueue.steps.length}`}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="text" onClick={handleCancelPlan} sx={{ fontSize: '0.65rem', textTransform: 'none' }}>
                  {execQueue.status === PLAN_STATUS.COMPLETED ? 'Dismiss' : 'Cancel Plan'}
                </Button>
              </Box>

              {execMessage && (
                <Typography variant="caption" sx={{ display: 'block', mb: 1, color: execMessage.type === 'error' ? 'error.main' : 'success.main', fontWeight: 500 }}>
                  {execMessage.text}
                </Typography>
              )}

              {execQueue.steps.map((step, si) => {
                const isActive = step.status === STEP_STATUS.ACTIVE
                const isDone = step.status === STEP_STATUS.COMPLETED
                const isFailed = step.status === STEP_STATUS.FAILED
                const isSkipped = step.status === STEP_STATUS.SKIPPED || step.status === STEP_STATUS.NO_LONGER_NEEDED
                return (
                  <Box key={si} sx={{
                    display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1, mb: 0.5,
                    borderRadius: '8px',
                    bgcolor: isActive ? (isDark ? 'rgba(124, 58, 237, 0.1)' : 'rgba(124, 58, 237, 0.05)') : 'transparent',
                    border: isActive ? `1px solid ${isDark ? 'rgba(124, 58, 237, 0.25)' : 'rgba(124, 58, 237, 0.15)'}` : '1px solid transparent',
                    opacity: isSkipped ? 0.5 : 1,
                  }}>
                    <Box sx={{
                      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                      bgcolor: isDone ? 'success.main' : isFailed ? 'error.main' : isSkipped ? 'action.disabled' : isActive ? '#7c3aed' : 'action.selected',
                    }}>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: (isDone || isFailed || isActive) ? 'white' : 'text.secondary' }}>
                        {isDone ? '✓' : isFailed ? '!' : isSkipped ? '—' : si + 1}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{
                        fontSize: '0.75rem', fontWeight: isActive ? 600 : 400, lineHeight: 1.3,
                        textDecoration: isSkipped ? 'line-through' : 'none',
                        color: isSkipped ? 'text.secondary' : 'text.primary',
                      }}>
                        {step.actionType === 'trade' ? 'Trade' : 'Gift'} for {step.cardName}
                      </Typography>
                      {isSkipped && step.skipReason && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontStyle: 'italic' }}>
                          {step.skipReason}
                        </Typography>
                      )}
                      {isFailed && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'error.main' }}>
                          {step.failReason || 'Action failed'} — retry this step or skip it to continue
                        </Typography>
                      )}
                      {isDone && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'success.main' }}>
                          {step.actualMissions > 0 ? `+${step.actualMissions} mission${step.actualMissions > 1 ? 's' : ''}` : 'Done'}
                          {step.actualWonder > 0 ? ` · +⏳${step.actualWonder}` : ''}
                        </Typography>
                      )}
                    </Box>
                    {isActive && !execLoading && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Button size="small" variant="contained" onClick={() => handleExecuteStep(si)}
                          sx={{ fontSize: '0.6rem', textTransform: 'none', bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, minWidth: 0, px: 1.5 }}>
                          {step.actionType === 'trade' ? 'Trade' : 'Gift'}
                        </Button>
                        <Button size="small" variant="text" onClick={() => handleSkipStep(si)}
                          sx={{ fontSize: '0.6rem', textTransform: 'none', minWidth: 0, px: 1 }}>
                          Skip
                        </Button>
                      </Box>
                    )}
                    {isActive && execLoading && <CircularProgress size={16} sx={{ color: '#7c3aed' }} />}
                    {isFailed && (
                      <Button size="small" variant="outlined" onClick={() => handleRetryStep(si)}
                        sx={{ fontSize: '0.6rem', textTransform: 'none', minWidth: 0 }}>
                        Retry
                      </Button>
                    )}
                  </Box>
                )
              })}

              {/* Running totals */}
              {execQueue.completedMissions > 0 && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '0.7rem', fontWeight: 600, color: 'success.main' }}>
                  Progress: {execQueue.completedMissions} mission{execQueue.completedMissions > 1 ? 's' : ''} completed
                  {execQueue.completedWonder > 0 && ` · +⏳${execQueue.completedWonder}`}
                  {execQueue.completedPack > 0 && ` · +📦${execQueue.completedPack}`}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ── Smart Combos ── */}
      {combos.length > 0 && (() => {
        const primary = combos.filter(c => c.missionsCompleted > 0).slice(0, 3)
        const secondary = combos.filter(c => c.missionsCompleted === 0).slice(0, 2)
        if (primary.length === 0 && secondary.length === 0) return null
        return (
          <Box sx={{
            mb: 2, p: 2, borderRadius: '14px',
            bgcolor: isDark ? 'rgba(124, 58, 237, 0.06)' : 'rgba(124, 58, 237, 0.03)',
            border: `1px solid ${isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.1)'}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.9rem' }}>🧠</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.primary' }}>
                Smart Combos
              </Typography>
            </Box>

            {/* Primary combos — complete missions */}
            {primary.map((combo, i) => (
              <Box key={`p${i}`} sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1, px: 1, mb: 0.75,
                borderRadius: '10px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                ...(i === 0 && { border: `1px solid ${isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.12)'}` }),
              }}>
                <Box sx={{ textAlign: 'center', minWidth: 44, pt: 0.2 }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.2, color: combo.comboType === 'fastest' ? 'success.main' : '#7c3aed' }}>
                    {combo.comboType === 'fastest' ? '⚡ Fast' : combo.comboType === 'reward' ? '🔥 High\nValue' : '🎯 Best\nCombo'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.4 }}>
                    {combo.cards.map(card => (
                      <Chip key={card.cardId} label={card.cardName} size="small" color={card.tradeable ? 'primary' : 'success'} sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} />
                    ))}
                    {combo.hasSynergy && <Chip label="⚡ Chain" size="small" sx={{ height: 18, fontSize: '0.5rem', fontWeight: 700, bgcolor: '#7c3aed', color: 'white' }} />}
                  </Box>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.primary', fontWeight: 600, display: 'block' }}>
                    {combo.actions} {combo.allTradeable ? 'trades' : combo.allGiftable ? 'gifts' : 'actions'} → {combo.missionsCompleted} mission{combo.missionsCompleted !== 1 ? 's' : ''}
                    {combo.wonderUnlocked > 0 && ` · +⏳${combo.wonderUnlocked}`}
                    {combo.packUnlocked > 0 && ` · +📦${combo.packUnlocked}`}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', fontStyle: 'italic' }}>
                    {combo.reason}
                  </Typography>
                </Box>
              </Box>
            ))}

            {/* Secondary combos — setup only, shown smaller */}
            {secondary.length > 0 && primary.length > 0 && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Setup combos (no instant completions)
                </Typography>
                {secondary.map((combo, i) => (
                  <Box key={`s${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, px: 1, mb: 0.3, borderRadius: '6px', opacity: 0.75 }}>
                    <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', flex: 1 }}>
                      {combo.cards.map(card => (
                        <Chip key={card.cardId} label={card.cardName} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />
                      ))}
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {combo.groupsSatisfied} groups toward completion
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )
      })()}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search missions or cards..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} sx={{ flex: 1, minWidth: 200, maxWidth: 350 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Set</InputLabel>
          <Select value={filterSet} label="Set" onChange={(e) => setFilterSet(e.target.value)}>
            <MenuItem value="">All Sets</MenuItem>
            {availableSets.map(s => <MenuItem key={s} value={s}>{SET_NAMES[s] || s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Reward</InputLabel>
          <Select value={filterReward} label="Reward" onChange={(e) => setFilterReward(e.target.value)}>
            <MenuItem value="all">All Rewards</MenuItem>
            <MenuItem value="hourglass">Any Hourglass</MenuItem>
            <MenuItem value="wonder">Wonder Hourglass</MenuItem>
            <MenuItem value="pack">Pack Hourglass</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort</InputLabel>
          <Select value={sortBy} label="Sort" onChange={(e) => setSortBy(e.target.value)}>
            <MenuItem value="closest">Closest to Done</MenuItem>
            <MenuItem value="wonder">Wonder Hourglass</MenuItem>
            <MenuItem value="pack">Pack Hourglass</MenuItem>
            <MenuItem value="reward">Best Reward</MenuItem>
            <MenuItem value="alpha">Alphabetical</MenuItem>
            <MenuItem value="set">By Set</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {filteredMissions.length} missions
        </Typography>
        {/* Phase 36 — Missing / All view toggle. */}
        <ToggleButtonGroup
          size="small"
          value={viewMode}
          exclusive
          onChange={(_, v) => { if (v) setViewMode(v) }}
          sx={{ ml: 'auto' }}
        >
          <ToggleButton value="all">All Missions</ToggleButton>
          <ToggleButton value="missing">Missing Missions</ToggleButton>
        </ToggleButtonGroup>
        {/* Phase 36.1 — bulk expand/collapse for the per-set accordions. */}
        <Button
          size="small" variant="outlined"
          onClick={() => setExpandedSets(
            Object.fromEntries(missionsByGroup.map(g => [g.setCode, true]))
          )}
        >Expand All</Button>
        <Button
          size="small" variant="outlined"
          onClick={() => setExpandedSets({})}
        >Collapse All</Button>
      </Box>

      {/* Mission List — Phase 36 set-grouped accordions. */}
      {filteredMissions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          {/* Phase 40 — B3 Launch Readiness. When operator filters to a
              pending set (B3 Pulsing Aura) and no missions exist yet,
              surface a specific message instead of the generic
              "no missions" copy, and make clear that mission completion
              is NOT inferred from inventory until official mappings land. */}
          {filterSet === 'B3' ? (
            <>
              <Typography variant="h6" color="text.secondary">
                B3 missions not imported yet.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pulsing Aura launches 2026-04-27. Mission targets will populate after
                the official mapping is imported — completion will not be inferred from
                inventory before then.
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h6" color="text.secondary">
                {viewMode === 'missing' ? 'No incomplete missions in the current filter' : 'No missions in the current filter'}
              </Typography>
              <Typography variant="body2" color="text.secondary">Try adjusting filters or toggling to All Missions</Typography>
            </>
          )}
        </Box>
      ) : missionsByGroup.map(group => {
        // Phase 36.1 — default COLLAPSED. Explicit `true` required to
        // show the group open, so a fresh page load shows set headers
        // only.
        const groupExpanded = expandedSets[group.setCode] === true
        return (
          <Accordion
            key={group.setCode}
            expanded={groupExpanded}
            onChange={(_, next) => setExpandedSets(prev => ({ ...prev, [group.setCode]: next }))}
            sx={{ mb: 1, '&:before': { display: 'none' }, boxShadow: 'none',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderRadius: '12px !important', overflow: 'hidden' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <Chip label={group.setCode} size="small" sx={{
                  bgcolor: PACK_COLORS[group.setCode] || '#666', color: 'white',
                  fontWeight: 700, fontSize: '0.65rem', height: 22, minWidth: 42,
                }} />
                <Typography sx={{ fontWeight: 600 }}>
                  {SET_NAMES[group.setCode] || group.setName}
                </Typography>
                <Chip size="small" variant="outlined"
                  label={`${group.missing} missing / ${group.total} total`}
                  color={group.missing === 0 ? 'success' : 'default'} />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1, pt: 0 }}>
              {group.missions.map(mission => {
        const isExpanded = expandedMission === mission.id
        const reqStatus = getUnsatisfiedRequirements(mission, ownership)
        const unsatisfied = reqStatus.unsatisfiedGroups || []
        return (
          <Box key={mission.id} sx={{
            mb: 1.5, borderRadius: '12px', overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)',
            transition: 'border-color 0.15s ease, opacity 0.15s ease',
            // Phase 36 — completed rows are visibly de-emphasized but
            // still fully interactive (clickable for details). User's
            // spec: "Completed: reduced opacity + checkmark".
            ...(mission.isComplete && { opacity: 0.55 }),
            ...(isExpanded && { borderColor: theme.palette.primary.main + '40' }),
          }}>
            {/* Header */}
            <Box onClick={() => handleExpand(mission)} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
              cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
            }}>
              <Chip label={mission.set_code} size="small" sx={{
                bgcolor: PACK_COLORS[mission.set_code] || '#666', color: 'white',
                fontWeight: 700, fontSize: '0.65rem', height: 22, minWidth: 42,
              }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {mission.isComplete && (
                    <CheckCircleIcon sx={{ fontSize: '1rem', color: 'success.main' }} />
                  )}
                  {mission.mission_name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.3 }}>
                  <LinearProgress variant="determinate" value={mission.progressRatio * 100} sx={{
                    width: 80, height: 4, borderRadius: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: mission.unsatisfiedGroups <= 2 ? 'success.main' : 'primary.main' },
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600, color: (mission.remaining ?? 0) <= 1 ? 'success.main' : 'text.secondary' }}>
                    {/* Phase 37.1 — strict targets[] display. UI shows
                        ONLY ownedCount/requiredCount for every mission
                        type. Removed:
                          - hybridMode branch
                          - quotaMode branch (produced "59/5 copies"
                            using uncapped quotaOwned)
                          - satisfiedGroups / totalGroups fallback
                        ownedCount is already capped by the evaluator +
                        display override so values like "59/5" can no
                        longer render. */}
                    {`${mission.ownedCount ?? 0}/${mission.requiredCount ?? 0}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    {`(${mission.remaining ?? 0} left)`}
                  </Typography>
                  {/* 2026-04-24 — Secondary card-coverage clarity display.
                      Primary X/Y above matches the game's in-client slot
                      label (Phase 35 semantics, unchanged). This sub-line
                      surfaces flat card-level coverage for OR-heavy
                      missions where the two numbers diverge (e.g. B2A_330
                      Trainers of Paldea: 5/5 groups vs N/11 cards). Only
                      rendered when the two differ — otherwise redundant. */}
                  {mission.cardEntriesTotal != null
                    && mission.cardEntriesTotal !== (mission.requiredCount ?? 0)
                    && mission.cardEntriesTotal > 0 && (
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ fontSize: '0.6rem', ml: 0.5 }}
                    >
                      {`· ${mission.cardEntriesOwned ?? 0}/${mission.cardEntriesTotal} cards`}
                    </Typography>
                  )}
                  {/* Phase 38 — Trust & Clarity. Subtle badge for
                      snapshot-complete missions whose local inventory
                      doesn't show all required cards (e.g. traded away
                      after completing in-game). Explains WHY the row
                      reads complete without adding alarm colors. */}
                  {mission.isSnapshotCompleteMismatch && (
                    <Tooltip
                      arrow
                      title="Completed in-game (confirmed by game sync). Local inventory may not reflect every card used to complete this mission — game sync is authoritative for completion status."
                    >
                      <Chip
                        label="Game Sync"
                        size="small"
                        variant="outlined"
                        icon={<SyncIcon sx={{ fontSize: '0.7rem !important' }} />}
                        sx={{
                          height: 18, fontSize: '0.55rem', fontWeight: 600,
                          color: 'text.secondary',
                          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
                          '& .MuiChip-icon': { ml: 0.25, color: 'text.secondary' },
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {mission.wonder_hourglass > 0 && <Chip label={`⏳${mission.wonder_hourglass}`} size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#7c3aed', color: 'white' }} />}
                {mission.pack_hourglass > 0 && <Chip label={`📦${mission.pack_hourglass}`} size="small" sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'info.main', color: 'white' }} />}
                {mission.shop_ticket > 0 && <Chip label={`🎫${mission.shop_ticket}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />}
              </Box>
              {/* 2026-04-24 — manual override control. When inactive,
                  renders "Mark done manually" (outlined icon). When
                  active, renders filled green icon + "Reset override"
                  tooltip + "Manual" badge. Single click toggles state.
                  Override takes priority over snapshot + inventory in
                  the completion resolver. */}
              {mission.manualOverride && (
                <Tooltip
                  arrow
                  title="Marked done manually — overrides snapshot and inventory. Click the check icon to reset."
                >
                  <Chip
                    label="Manual"
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 18, fontSize: '0.55rem', fontWeight: 600,
                      color: 'success.main',
                      borderColor: 'success.main',
                      '& .MuiChip-label': { px: 0.5 },
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip
                arrow
                title={mission.manualOverride
                  ? 'Reset manual override (revert to snapshot/inventory)'
                  : 'Mark as completed in-game (manual override)'}
              >
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleToggleManualDone(mission.id); }}
                  sx={{
                    color: mission.manualOverride ? 'success.main' : 'text.secondary',
                    '&:hover': { color: mission.manualOverride ? 'warning.main' : 'success.main' },
                  }}
                >
                  {mission.manualOverride
                    ? <CheckCircleIcon sx={{ fontSize: 18 }} />
                    : <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <IconButton size="small">{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
            </Box>

            {/* Detail */}
            <Collapse in={isExpanded}>
              <Box sx={{ px: 2, pb: 2, pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                {detailLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
                ) : mission.isComplete ? (
                  /* Phase 37.2 — trust the RESOLVED mission.isComplete from
                     evaluatedMissions (snapshot-or-targets strict). Previously
                     this branch was gated on `reqStatus.isComplete` which is
                     pure-targets math and IGNORES the snapshot — producing
                     the "header ✓ / detail shows 0/5 still missing" divergence
                     (QA-reported "0/5 and complete at the same time"). One
                     resolved truth object per row now drives both header and
                     detail body.

                     Phase 38 — for snapshot-complete missions whose local
                     inventory doesn't cover every required card, surface a
                     plain-language helper line so users aren't surprised to
                     see ✓ on a mission their tracker appears short on. */
                  <Box sx={{ py: 1 }}>
                    <Typography color="success.main" sx={{ fontWeight: 600 }}>
                      {mission.completionSource === 'snapshot'
                        ? 'Completed — confirmed by game sync'
                        : 'All requirements met!'}
                    </Typography>
                    {mission.isSnapshotCompleteMismatch && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                        Local inventory may not reflect every card used to complete this mission. Game sync is authoritative for completion status.
                      </Typography>
                    )}
                  </Box>
                ) : reqStatus.hybridMode ? (
                  /* Hybrid mission: separate group requirements + quota requirement */
                  <Box sx={{ py: 1 }}>
                    {/* Group requirements (e.g. "Sudowoodo: 0/1") */}
                    {(mission.groups || []).map((group, gi) => {
                      const isSatisfied = isGroupSatisfied(group, ownership)
                      const label = group.lookup_name || `Group ${gi + 1}`
                      return (
                        <Box key={gi} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: isSatisfied ? 'success.main' : 'error.main' }}>
                            {label}: {isSatisfied ? '1' : '0'} / 1
                          </Typography>
                          {isSatisfied
                            ? <Chip label="✓" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'success.main', color: 'white' }} />
                            : <Chip label="Missing" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />}
                        </Box>
                      )
                    })}
                    {/* Quota requirement (e.g. "Trevenant: 3/5 copies") */}
                    {reqStatus.quotaRequired > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: reqStatus.quotaMissing === 0 ? 'success.main' : 'warning.main' }}>
                          {(reqStatus.eligibleCards || []).length === 1
                            ? (detailCards.find(c => c.card_id === reqStatus.eligibleCards[0])?.card_name || 'Copies')
                            : 'Eligible copies'}: {reqStatus.quotaOwned}/{reqStatus.quotaRequired}
                        </Typography>
                        {reqStatus.quotaMissing > 0 && (
                          <Chip label={`${reqStatus.quotaMissing} more needed`} size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                        )}
                      </Box>
                    )}
                    {/* Show missing cards */}
                    {(reqStatus.unsatisfiedGroups || []).length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: '0.7rem' }}>
                        Missing group cards shown below:
                      </Typography>
                    )}
                  </Box>
                ) : reqStatus.quotaMode ? (
                  <Box sx={{ py: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.5 }}>
                      Need {reqStatus.quotaMissing} more eligible card{reqStatus.quotaMissing !== 1 ? 's' : ''} ({reqStatus.quotaOwned}/{reqStatus.quotaRequired} collected)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Any card from this pool counts — duplicates included
                    </Typography>
                  </Box>
                ) : unsatisfied.map((group, gi) => {
                  const isOr = group.operator === 'OR' && group.cards.length > 1
                  const groupCards = group.cards.map(id => detailCards.find(c => c.card_id === id)).filter(Boolean)
                  return (
                    <Box key={gi} sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary', mb: 0.75, display: 'block' }}>
                        {isOr ? `Need 1 of ${group.cards.length} — ${group.lookup_name}` : `Need: ${group.lookup_name}`}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {groupCards.map(card => {
                          const tradable = isCardTradable(card)
                          const giftable = GIFTABLE_RARITIES.includes(card.rarity_code) && !card.is_promo
                          return (
                            <Box key={card.card_id} sx={{
                              display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: '8px',
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            }}>
                              <Box component="img" src={cardsApi.getImageUrl(card.backend_id)} alt={card.card_name}
                                sx={{ width: 36, height: 50, objectFit: 'contain', borderRadius: '6px', border: '1px solid', borderColor: isOr ? 'info.main' : 'error.main' }}
                                onError={(e) => { e.target.src = '/card-placeholder.png' }}
                              />
                              <Box>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.2 }}>{card.card_name}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                  #{card.number} · {RARITY_NAMES[card.rarity_code] || card.rarity_code}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.3, mt: 0.3 }}>
                                  {tradable && isPremium && (
                                    <Chip label="Trade" size="small" color="primary" clickable
                                      onClick={() => handleTradeAction(card)}
                                      sx={{ height: 18, fontSize: '0.5rem', cursor: 'pointer' }} />
                                  )}
                                  {giftable && isPremium && (
                                    <Chip label="Gift" size="small" color="success" clickable
                                      onClick={() => handleGiftAction(card)}
                                      sx={{ height: 18, fontSize: '0.5rem', cursor: 'pointer' }} />
                                  )}
                                  {!tradable && !giftable && <Chip label="Not tradable" size="small" sx={{ height: 16, fontSize: '0.5rem' }} />}
                                </Box>
                              </Box>
                            </Box>
                          )
                        })}
                        {groupCards.length === 0 && group.cards.length > 0 && (
                          <Typography variant="caption" color="text.secondary">{group.cards.join(', ')}</Typography>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Collapse>
          </Box>
        )
      })}
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>

    {/* ── Inline Trade Confirmation Dialog ── */}
    <Dialog open={tradeDialogOpen} onClose={() => !tradeSubmitting && !activeTradeRequest && setTradeDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TradeIcon color="primary" />
        {activeTradeRequest ? 'Trade in Progress' : 'Request Card via Trade'}
      </DialogTitle>
      <DialogContent>
        {tradeCard && !activeTradeRequest && (
          <Box sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 2, mb: 2 }}>
              {(tradeCard.backend_id || tradeCard.backendId) && (
                <Box component="img" src={cardsApi.getImageUrl(tradeCard.backend_id || tradeCard.backendId)} alt=""
                  sx={{ width: 60, height: 84, objectFit: 'contain', borderRadius: 1 }}
                  onError={(e) => { e.target.style.display = 'none' }} />
              )}
              <Box>
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>{tradeCard.card_name || tradeCard.cardName}</Typography>
                {tradeCard.rarity_code && (
                  <Chip label={RARITY_NAMES[tradeCard.rarity_code] || tradeCard.rarity_code} size="small"
                    sx={{ mt: 0.5, bgcolor: RARITY_COLORS[tradeCard.rarity_code] || '#666', color: getRarityChipTextColor(tradeCard.rarity_code), fontWeight: 600 }} />
                )}
              </Box>
            </Box>
            <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
              A bot will send you a friend request in-game. You have <strong>10 minutes</strong> to accept, then the trade will be executed automatically.
            </Alert>
            {tradePlanStepIndex !== null && (
              <Alert severity="success" sx={{ mt: 1, fontSize: '0.8rem' }}>
                This trade is part of your execution plan. After completion, the plan will advance to the next step.
              </Alert>
            )}
          </Box>
        )}

        {/* ── Active Trade Progress ── */}
        {activeTradeRequest && (
          <Box sx={{ py: 1 }}>
            <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
              Trading for: {activeTradeRequest.cardName}
            </Typography>

            {/* Status steps */}
            {['MATCHING', 'FRIEND_REQUEST_SENT', 'PICK_CARD', 'CONFIRMING', 'COMPLETED'].map((step, i) => {
              // Complete status mapping — covers ALL backend trade states
              const statusOrder = {
                PENDING: 0, MATCHING: 0, QUEUED: 0,
                FRIEND_REQUEST_SENT: 1, WAITING_FRIEND_ACCEPT: 1, HANDLING_FRIEND_REQUEST: 1,
                SUBMITTING_TRADE_PROPOSAL: 2, TRADE_PROPOSAL_SENT: 2, PICK_CARD: 2, WAITING_TRADE_RESPONSE: 2,
                TRADE_ACCEPTED: 3, CONFIRMING: 3, CONFIRMING_TRADE: 3, EXECUTING_TRADE: 3, PROCESSING_TRADE_STATE: 3, RECEIVING_OUTCOME: 3,
                COMPLETED: 4,
                TIMED_OUT: 0, // show as step 0 with different label
              }
              const current = statusOrder[activeTradeRequest.status] ?? 0
              const stepIdx = i
              const isDone = current > stepIdx
              const isActive = current === stepIdx
              const labels = ['Finding a bot...', 'Accept friend request', 'Pick a card to offer', 'Confirming trade...', 'Complete!']
              return (
                <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, opacity: isDone ? 0.5 : isActive ? 1 : 0.3 }}>
                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isDone ? 'success.main' : isActive ? '#7c3aed' : 'action.disabled' }}>
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: (isDone || isActive) ? 'white' : 'text.secondary' }}>
                      {isDone ? '✓' : i + 1}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 400 }}>
                    {labels[i]}
                  </Typography>
                  {isActive && i < 3 && <CircularProgress size={14} sx={{ ml: 'auto' }} />}
                </Box>
              )
            })}

            {/* Friend code display */}
            {activeTradeRequest.friendCode && ['FRIEND_REQUEST_SENT', 'WAITING_FRIEND_ACCEPT'].includes(activeTradeRequest.status) && (
              <Alert severity="warning" sx={{ mt: 2, fontSize: '0.8rem' }}>
                Add this friend code in-game: <strong>{activeTradeRequest.friendCode}</strong>
              </Alert>
            )}

            {/* Card Picker — the key interaction users were missing */}
            {pickCards.length > 0 && ['PICK_CARD', 'WAITING_TRADE_RESPONSE'].includes(activeTradeRequest.status) && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
                  Pick a card from your collection to offer in exchange:
                </Alert>
                <TextField size="small" placeholder="Search your cards..." value={pickSearch}
                  onChange={(e) => setPickSearch(e.target.value)} fullWidth sx={{ mb: 1.5 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
                  <Grid container spacing={1}>
                    {pickCards
                      .filter(c => !pickSearch || (c.cardName || '').toLowerCase().includes(pickSearch.toLowerCase()))
                      .slice(0, 40)
                      .map(card => (
                        <Grid item xs={12} sm={6} key={card.cardId}>
                          <Button variant="outlined" fullWidth disabled={picking !== null}
                            onClick={() => handlePickCard(card)}
                            sx={{ justifyContent: 'flex-start', textTransform: 'none', py: 0.75, px: 1.5,
                              borderColor: picking === card.cardId ? '#7c3aed' : 'divider',
                              '&:hover': { borderColor: '#7c3aed', bgcolor: 'action.hover' } }}>
                            {picking === card.cardId ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                            <Box sx={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                              <Typography variant="body2" noWrap fontWeight="medium" sx={{ fontSize: '0.8rem' }}>
                                {card.cardName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                x{card.cardAmount} · {card.rarityCode}
                              </Typography>
                            </Box>
                          </Button>
                        </Grid>
                      ))}
                  </Grid>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {!activeTradeRequest ? (
          <>
            <Button onClick={() => setTradeDialogOpen(false)} disabled={tradeSubmitting}>Cancel</Button>
            <Button variant="contained" onClick={handleTradeConfirm} disabled={tradeSubmitting}
              startIcon={tradeSubmitting ? <CircularProgress size={16} /> : <TradeIcon />}
              sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}>
              {tradeSubmitting ? 'Requesting...' : 'Request Card'}
            </Button>
          </>
        ) : (
          <Button onClick={() => {
            setTradeDialogOpen(false); setActiveTradeRequest(null); setPickCards([])
            setTradeCard(null); setTradePlanStepIndex(null)
          }}>
            {activeTradeRequest.status === 'COMPLETED' ? 'Done' : 'Close (trade continues in background)'}
          </Button>
        )}
      </DialogActions>
    </Dialog>

    {/* Action feedback snackbar */}
    <Snackbar open={actionSnackbar.open} autoHideDuration={6000}
      onClose={() => setActionSnackbar(prev => ({ ...prev, open: false }))}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={actionSnackbar.severity} onClose={() => setActionSnackbar(prev => ({ ...prev, open: false }))}>
        {actionSnackbar.message}
      </Alert>
    </Snackbar>
    </FadeIn>
  )
}
