/**
 * Gold Flair Trade page (Collection group, premium + admin only).
 *
 * Mirrors CardRequest auto-trade UX exactly:
 *   - AccountSelector in header (which user account is the receiver)
 *   - Pack dropdown filtered to packs with flair-eligible cards (≥10 owned + 1-3◆)
 *   - Rarity chip filter
 *   - CardGrid (same component as Trade page) — click card → confirm dialog
 *   - Confirm → POST /api/admin/manual-gold-flair-trade/request
 *   - WebSocket-driven status (matching, friend_sent, accepted, completed, failed)
 *   - Premium/admin tier → tradeMode=auto (bot orchestrates fully)
 *   - Trade-pass tier → tradeMode=manual (user accepts in-game)
 *
 * Diff vs CardRequest: cardFrameId attached to the request (defaults
 * GOLD_FRAME_100010). Backend writes it to pending_card_frames; executor
 * picks it up before SubmitProposalV2.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box, Typography, Button, Paper, Chip, Stack, Alert, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, ToggleButtonGroup, ToggleButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar,
  Collapse, IconButton, Tooltip,
} from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useAccount } from '../../contexts/AccountContext'
import AccountSelector from '../../components/AccountSelector'
import PageHeader from '../../components/PageHeader'
import CardGrid from '../../components/CardGrid'
import TradeRequestList from '../../components/TradeRequestList'
import { useTradeWebSocket } from '../../hooks/useTradeWebSocket'
import { autoTrade } from '../../services/api'
import { RARITY_COLORS } from '../../constants/gameData'

const GOLD_FRAME_ID = 'GOLD_FRAME_100010'
const RARITY_WEIGHT = { R: 3, U: 2, C: 1 }

const callApi = async (path, init = {}) => {
  const token = localStorage.getItem('vudoo_auth_token') || ''
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { rawText: text } }
  return { status: res.status, ok: res.ok, data }
}

export default function ManualGoldFlairTrade({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { accounts: linkedAccounts, selectedAccountId } = useAccount()
  const isAdmin = !!(user?.isAdmin || user?.subscriptionTier === 'admin')

  // Pack + cards state (mirrors CardRequest)
  const [packs, setPacks] = useState([])
  const [packsLoading, setPacksLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState('')
  const [cards, setCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [selectedRarities, setSelectedRarities] = useState([])
  const [cardFrameId, setCardFrameId] = useState(GOLD_FRAME_ID)
  // Default 11 — 10 burned to mint + 1 retained to send in the trade.
  // Aligns with the matcher's strict eligibility filter (Tier 1) so the
  // dropdown's "recommended" option matches what the backend actually
  // accepts. Admin can lower to 10 (single-use, bot loses frame) or raise
  // to 14/16 to retain 2+ frames per source bot.
  const [minCopies, setMinCopies] = useState(11)
  const [search, setSearch] = useState('')
  // 'ready' (default — only matcher-acceptable >=11), 'needs_reserve' (10 only),
  // 'all' (everything backend returned). Default protects users from clicking
  // cards that would fail at match time with "no eligible bot."
  const [readinessFilter, setReadinessFilter] = useState('ready')

  // Trade-requests panel collapsed by default. The list can grow long
  // (50+ historical rows) and pushes the card-selection UI below the
  // fold. Header still shows count badges so users see at a glance
  // whether anything is active.
  const [requestsCollapsed, setRequestsCollapsed] = useState(true)

  // Confirm dialog
  const [selectedCard, setSelectedCard] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Requests + status
  const [requests, setRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })
  const [error, setError] = useState(null)
  // Pick-card data per request (mirrors CardRequest). When bot proposes, server
  // emits pick_card event with cards array — we surface it via TradeRequestList
  // so user picks WITHIN the website (which routes through /pick-card →
  // acceptTradeWithCard → cardFrame auto-attached). Picking via in-game app
  // bypasses our cardFrame attach and forces manual "Edit Card" tap.
  const [pickCardDataMap, setPickCardDataMap] = useState({})

  // ---- Load packs (cached server-side, 5min) ---------------------------------
  useEffect(() => {
    let cancelled = false
    setPacksLoading(true)
    callApi('/api/admin/manual-gold-flair-trade/eligible-packs')
      .then(r => {
        if (cancelled) return
        if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`)
        const list = r.data.packs || []
        setPacks(list)
        if (list.length > 0 && !selectedPack) setSelectedPack(list[list.length - 1].setCode)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setPacksLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Load cards for selected pack (debounced + abort) ----------------------
  useEffect(() => {
    if (!selectedPack) { setCards([]); return }
    let cancelled = false
    setCardsLoading(true)
    const params = new URLSearchParams({ setCode: selectedPack, minCopies: String(minCopies) })
    if (cardFrameId) params.set('cardFrameId', cardFrameId)
    callApi(`/api/admin/manual-gold-flair-trade/eligible-cards?${params}`)
      .then(r => {
        if (cancelled) return
        if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`)
        setCards(r.data.cards || [])
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setCardsLoading(false) })
    return () => { cancelled = true }
  }, [selectedPack, cardFrameId, minCopies])

  // ---- Load user's existing trade requests -----------------------------------
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const result = await autoTrade.getRequests()
      setRequests(result.requests || [])
    } catch (e) {
      console.error('Failed to load requests:', e)
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  // ---- WebSocket-driven live updates (same hook CardRequest uses) -----------
  const handleTradeEvent = useCallback((event) => {
    // Capture pick_card payload so user can pick from THIS page (not in-game).
    // Picking here routes through /pick-card → acceptTradeWithCard which
    // auto-attaches cardFrame. Picking in-game bypasses our auto-attach.
    if (event.type === 'pick_card' && event.requestId && event.cards) {
      setPickCardDataMap(prev => ({
        ...prev,
        [event.requestId]: { cards: event.cards },
      }))
    }

    setRequests(prev => {
      const idx = prev.findIndex(r => r.id === event.requestId)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          status: event.status || updated[idx].status,
          ...(event.botFriendCode ? { matched_friend_code: event.botFriendCode } : {}),
          ...(event.error ? { error_message: event.error } : {}),
        }
        return updated
      }
      return prev
    })

    // Refetch on milestone events so timeline dots (Match/Friend/Trade/Done)
    // reflect server-side timestamps. WebSocket events don't carry matched_at,
    // friend_request_sent_at, trade_sent_at, completed_at — only loadRequests
    // pulls those from the canonical webui_trade_requests row.
    if (['matching', 'friend_sent', 'friend_accepted', 'proposal_sent', 'completed', 'failed', 'cancelled'].includes(event.type)) {
      setTimeout(() => loadRequests(), 500)
    }

    const messages = {
      created: 'Gold flair trade request created!',
      matching: 'Finding a bot with this card...',
      minting: 'Preparing your gold-framed card...',
      friend_sent: 'Bot sent a friend request — accept it in-game.',
      friend_accepted: 'Friend accepted!',
      proposal_sent: 'Trade proposal sent — gold flair attached!',
      pick_card: 'Pick a card to offer for the trade!',
      accepted: 'Trade ready in-game — review and accept it.',
      completed: 'Gold flair trade completed!',
      failed: `Failed: ${event.error || 'Unknown'}`,
      expired: 'Friend request expired.',
      cancelled: 'Cancelled.',
    }
    const severity = event.type === 'completed' ? 'success'
      : ['failed', 'expired', 'cancelled'].includes(event.type) ? 'error'
      : event.type === 'pick_card' ? 'warning' : 'info'
    setSnackbar({ open: true, message: event.message || messages[event.type] || 'Status updated', severity })
  }, [])

  const { seedRequestState } = useTradeWebSocket({ onAny: handleTradeEvent }, selectedAccountId, loadRequests)

  // Counts per readiness bucket — backend returns status in {trade_ready,
  // reserve_low, not_eligible}. Display always shows how many of each.
  // Scope readiness counts to the active rarity selection so the status chips
  // match the (rarity-filtered) grid. Set-wide totals otherwise look broken
  // (e.g. "Trade Ready 116" beside an empty R grid).
  const readinessCounts = useMemo(() => {
    const base = selectedRarities.length > 0
      ? cards.filter(c => selectedRarities.includes(c.rarity_code))
      : cards
    let ready = 0, reserve = 0, notElig = 0
    for (const c of base) {
      if (c.status === 'trade_ready' || c.tradeReady) ready++
      else if (c.status === 'reserve_low') reserve++
      else notElig++
    }
    return { ready, reserve, notElig, all: base.length }
  }, [cards, selectedRarities])

  // ---- Filter + sort cards (mirrors CardRequest) ----------------------------
  const filteredCards = useMemo(() => {
    let result = [...cards]
    if (readinessFilter === 'ready') {
      result = result.filter(c => c.status === 'trade_ready' || c.tradeReady)
    } else if (readinessFilter === 'reserve_low') {
      result = result.filter(c => c.status === 'reserve_low')
    } else if (readinessFilter === 'not_eligible') {
      result = result.filter(c => c.status === 'not_eligible')
    }
    if (selectedRarities.length > 0) result = result.filter(c => selectedRarities.includes(c.rarity_code))
    if (search.trim()) {
      const needle = search.trim().toLowerCase()
      result = result.filter(c =>
        (c.card_name || '').toLowerCase().includes(needle) ||
        (c.backend_id || '').toLowerCase().includes(needle) ||
        (c.card_id || '').toLowerCase().includes(needle)
      )
    }
    result.sort((a, b) => {
      // Trade-ready cards float to top in mixed views.
      const aReady = (a.status === 'trade_ready' || a.tradeReady) ? 1 : 0
      const bReady = (b.status === 'trade_ready' || b.tradeReady) ? 1 : 0
      if (bReady !== aReady) return bReady - aReady
      const aw = RARITY_WEIGHT[a.rarity_code] || 0
      const bw = RARITY_WEIGHT[b.rarity_code] || 0
      if (aw !== bw) return aw - bw
      return (a.card_number || '').localeCompare(b.card_number || '', undefined, { numeric: true })
    })
    return result
  }, [cards, selectedRarities, search, readinessFilter])

  // Explanatory empty-state when the rarity+readiness filter yields nothing but
  // cards exist with copies just under the 11 trade-ready threshold (scarce
  // rarities like R rarely reach 11 on a single bot).
  const emptyStateHint = useMemo(() => {
    if (filteredCards.length > 0) return null
    const scope = selectedRarities.length > 0
      ? cards.filter(c => selectedRarities.includes(c.rarity_code))
      : cards
    const rarLabel = selectedRarities.length > 0 ? `${selectedRarities.join('/')} ` : ''
    const nearReady = scope.filter(c => (c.maxCopies || 0) >= 10 && (c.maxCopies || 0) < 11)
    if (readinessFilter === 'ready' && nearReady.length > 0) {
      const top = nearReady.reduce((a, b) => ((b.maxCopies || 0) > (a.maxCopies || 0) ? b : a))
      return `No ${rarLabel}cards are trade-ready. ${nearReady.length} ${rarLabel}card${nearReady.length === 1 ? '' : 's'} ` +
        `(e.g. ${top.card_name}) ${nearReady.length === 1 ? 'has' : 'have'} ${top.maxCopies} copies, but a bot needs 11 to mint and still send one.`
    }
    return `No ${rarLabel}cards match this filter.`
  }, [filteredCards, cards, selectedRarities, readinessFilter])

  const availableRarities = useMemo(() => {
    const rar = [...new Set(cards.map(c => c.rarity_code).filter(Boolean))]
    return rar.sort((a, b) => (RARITY_WEIGHT[b] || 0) - (RARITY_WEIGHT[a] || 0))
  }, [cards])

  // ---- Submit -----------------------------------------------------------------
  const handleConfirm = async () => {
    if (!selectedCard) return
    setSubmitting(true); setError(null)
    try {
      const r = await callApi('/api/admin/manual-gold-flair-trade/request', {
        method: 'POST',
        body: JSON.stringify({
          cardId: selectedCard.backend_id,
          accountId: selectedAccountId || null,
          cardFrameId: cardFrameId || GOLD_FRAME_ID,
        }),
      })
      if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`)
      // Optimistic insert.
      // matchService.createTradeRequest returns camelCase keys (cardId,
      // cardName, rarityCode, sandCost) but TradeRequestCard reads snake_case
      // (card_id, card_name, rarity_code, sand_cost). Map both so the row
      // renders correctly until loadRequests() refetches the canonical
      // snake_case row from /api/auto-trade/requests.
      if (r.data.request) {
        const incoming = r.data.request
        const optimisticRow = {
          ...incoming,
          // snake_case keys for TradeRequestCard
          card_id: incoming.card_id ?? incoming.cardId ?? selectedCard?.backend_id,
          card_name: incoming.card_name ?? incoming.cardName ?? selectedCard?.card_name,
          rarity: incoming.rarity ?? selectedCard?.rarity,
          rarity_code: incoming.rarity_code ?? incoming.rarityCode ?? selectedCard?.rarity_code,
          expansion_id: incoming.expansion_id ?? incoming.expansionId ?? selectedCard?.expansion_id ?? selectedCard?.setCode,
          pack_id: incoming.pack_id ?? incoming.packId ?? selectedCard?.pack_id,
          sand_cost: incoming.sand_cost ?? incoming.sandCost ?? 0,
          image_url: incoming.image_url ?? incoming.imageUrl ?? (selectedCard?.backend_id ? `/api/cards/${selectedCard.backend_id}/image` : null),
          trade_mode: incoming.trade_mode ?? incoming.tradeMode ?? 'manual',
          requested_at: new Date().toISOString(),
        }
        setRequests(prev => prev.some(x => x.id === incoming.id) ? prev : [optimisticRow, ...prev])
        seedRequestState([{ id: incoming.id, status: incoming.status || 'PENDING', requested_at: optimisticRow.requested_at }])
        // Refetch in 2s to replace optimistic row with canonical server row
        // (picks up matched_at, matched_account_id once executor matches).
        setTimeout(() => loadRequests(), 2000)
      }
      setSnackbar({ open: true, message: r.data.message || 'Gold flair trade request created!', severity: 'success' })
      setConfirmOpen(false)
      setSelectedCard(null)
    } catch (e) {
      setError(e.message)
      setSnackbar({ open: true, message: e.message, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        icon={<SwapHorizIcon />}
        title="Gold Flair Trades — Eligible Cards"
        subtitle="Bot delivers a card to your selected account with gold flair attached. Diamond rarities ◆/◆◆/◆◆◆ only (4◆ excluded). Cards shown are sourced from the bot pool's actual card_stocks ∩ card_frame_stocks."
        action={<AccountSelector />}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Requests list — collapsed by default so card-selection is above the fold */}
      {requests.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, border: '2px solid', borderColor: 'warning.main' }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setRequestsCollapsed(c => !c)}
            role="button"
            aria-expanded={!requestsCollapsed}
            aria-label="Toggle trade requests panel"
          >
            <Typography variant="h6" sx={{ flex: 1 }}>
              Your Trade Requests
            </Typography>
            <Chip size="small" label={`${requests.length} total`} />
            <IconButton size="small" sx={{ transform: requestsCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
              <ExpandMoreIcon />
            </IconButton>
          </Stack>
          <Collapse in={!requestsCollapsed} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Manual mode:</strong> the bot will send a friend request and trade proposal.
                Open the game on your phone, accept the friend request, then pick the card you want to give back —
                apply gold flair to it in-game (Edit Card → Apply Gold Frame) so the trade goes through with flair on both sides.
              </Alert>
              <TradeRequestList
                requests={requests}
                loading={requestsLoading}
                pickCardDataMap={pickCardDataMap}
                onRefresh={loadRequests}
                onCancel={async (id) => { await autoTrade.cancelRequest(id); loadRequests() }}
              />
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Toolbar: pack dropdown + cardFrame selector */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 240, flex: 1 }}>
            <InputLabel>Select Pack</InputLabel>
            <Select
              value={selectedPack}
              label="Select Pack"
              onChange={(e) => setSelectedPack(e.target.value)}
              disabled={packsLoading || packs.length === 0}
            >
              {packs.map(pack => (
                <MenuItem key={pack.setCode} value={pack.setCode}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1 }}>
                    <span>{pack.setName || pack.setCode}</span>
                    <Tooltip
                      title={
                        <>
                          <div>Ready = a bot can deliver this card by using an existing frame or minting one.</div>
                          <div>Instant = a bot already owns the gold frame.</div>
                        </>
                      }
                    >
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          size="small"
                          label={`Ready cards ${pack.tradeable11Plus ?? pack.eligibleCards ?? 0}`}
                          color={(pack.tradeable11Plus ?? pack.eligibleCards ?? 0) > 0 ? 'success' : 'default'}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {(pack.observedFrameStock ?? 0) > 0 && (
                          <Chip
                            size="small"
                            label={`Instant frames ${pack.observedFrameStock}`}
                            color="warning"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Tooltip>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Single-frame toggle is a no-op for users (only one option). Show
              compact label only. Admins still see the same control — backend
              ID intentionally hidden from UI. */}
          <Chip
            label="✨ Gold Flair"
            color="warning"
            sx={{ fontWeight: 'bold', height: 32, px: 1 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel shrink>Search card name / ID</InputLabel>
            <Box
              component="input"
              type="text"
              placeholder="e.g. Buneary or PK_10_..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                mt: '16px',
                p: '8.5px 14px',
                fontSize: '0.875rem',
                border: '1px solid rgba(255,255,255,0.23)',
                borderRadius: '4px',
                bgcolor: 'transparent',
                color: 'inherit',
                outline: 'none',
                width: '100%',
                '&:focus': { borderColor: 'primary.main' },
              }}
            />
          </FormControl>

          {/* Admin-only: tune bot frame retention threshold. Users always 11 (10 mint + 1 send). */}
          {isAdmin && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Min copies (admin)</InputLabel>
              <Select value={minCopies} label="Min copies (admin)" onChange={(e) => setMinCopies(Number(e.target.value))}>
                <MenuItem value={10}>10 (single-use — depletes frame)</MenuItem>
                <MenuItem value={11}>11 (10 mint + 1 send, no buffer) — recommended</MenuItem>
                <MenuItem value={14}>14 (keep 2 frames after trade)</MenuItem>
                <MenuItem value={16}>16 (keep 3 frames after trade)</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>

        {/* Readiness filter chips. Default 'ready' so users can't click cards
            that would fail at match time. */}
        <Box sx={{ display: 'flex', gap: 0.75, mt: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ mr: 1, color: 'text.secondary' }}>Status:</Typography>
          {[
            { v: 'ready', label: `Ready to send (${readinessCounts.ready})`, color: 'success' },
            { v: 'reserve_low', label: `Low stock (${readinessCounts.reserve})`, color: 'warning' },
            { v: 'not_eligible', label: `Unavailable (${readinessCounts.notElig})`, color: 'default' },
            { v: 'all', label: `All (${readinessCounts.all})`, color: 'primary' },
          ].map(opt => (
            <Chip
              key={opt.v}
              label={opt.label}
              size="small"
              color={readinessFilter === opt.v ? opt.color : 'default'}
              variant={readinessFilter === opt.v ? 'filled' : 'outlined'}
              onClick={() => setReadinessFilter(opt.v)}
              sx={{ cursor: 'pointer', fontWeight: readinessFilter === opt.v ? 'bold' : 'normal' }}
            />
          ))}
        </Box>

        {availableRarities.length > 1 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ alignSelf: 'center', mr: 1, color: 'text.secondary' }}>Rarity:</Typography>
            {availableRarities.map(r => (
              <Chip
                key={r}
                label={r}
                size="small"
                onClick={() => setSelectedRarities(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                sx={{
                  bgcolor: selectedRarities.includes(r) ? (RARITY_COLORS[r] || '#999') : 'transparent',
                  color: selectedRarities.includes(r) ? 'white' : 'text.primary',
                  border: `1px solid ${RARITY_COLORS[r] || '#999'}`,
                  fontWeight: selectedRarities.includes(r) ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
              />
            ))}
            {selectedRarities.length > 0 && (
              <Chip label="Clear" size="small" variant="outlined" onClick={() => setSelectedRarities([])} />
            )}
          </Box>
        )}
      </Paper>

      {/* Card grid */}
      {selectedPack && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            {filteredCards.length} card{filteredCards.length === 1 ? '' : 's'} — Trade Ready first.
            Trade button enabled only on cards with ≥11 copies.
          </Typography>
          {filteredCards.length === 0 && emptyStateHint && (
            <Alert severity="info" sx={{ mb: 2 }}>{emptyStateHint}</Alert>
          )}
          {/* CardGrid greys-out cards where isAvailable=false (set server-side
              when maxCopies < 11). Click handler still gates defensively in
              case backend is stale. */}
          <CardGrid
            cards={filteredCards}
            loading={cardsLoading}
            flairMode
            onTradeClick={(c) => {
              if (!(c.status === 'trade_ready' || c.tradeReady)) {
                setSnackbar({ open: true, message: `${c.card_name} has only ${c.maxCopies || 0} copies — needs 11+ (10 to mint + 1 to send).`, severity: 'warning' })
                return
              }
              setSelectedCard(c); setConfirmOpen(true)
            }}
          />
        </Box>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Confirm gold flair trade
        </DialogTitle>
        <DialogContent>
          {selectedCard && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body1">
                <strong>{selectedCard.card_name}</strong> ({selectedCard.rarity_code}) — {selectedCard.setName || selectedCard.setCode}
              </Typography>
              {selectedCard.card_number && (
                <Typography variant="caption" color="text.secondary">
                  #{selectedCard.card_number}
                </Typography>
              )}
              {isAdmin && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', opacity: 0.6 }}>
                  {selectedCard.backend_id}
                </Typography>
              )}
              <Alert severity="info">
                Bot will send a friend request and trade proposal with <strong>gold flair</strong> attached.
                You then complete the trade in-game on your phone — pick the same-rarity card you want to give back,
                apply gold flair to it (if not already), and tap Accept.
              </Alert>
              <Alert severity="error" icon={false}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  ⚠️ IRREVERSIBLE — read carefully
                </Typography>
                <Typography variant="body2" component="div">
                  Gold-flair trades consume gold frames from both sides. <strong>Cannot be undone</strong>:
                  <ul style={{ marginTop: 4, marginBottom: 4, paddingLeft: 18 }}>
                    <li>The card you send back must be the same rarity ({selectedCard.rarity_code}) and have a gold frame.
                    If you don't have one, the in-game UI will offer to apply one when you pick the card —
                    that <strong>spends 10 duplicates</strong> of that card permanently.</li>
                    <li>The gold frame on the card you send is <strong>destroyed</strong> when the trade completes.
                    To trade flair again with that card, mint another frame (10 more duplicates).</li>
                    <li>If you don't accept in-game within <strong>2 hours</strong>, the trade auto-cancels and the bot's frame is preserved.</li>
                  </ul>
                </Typography>
              </Alert>
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Confirm trade'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
