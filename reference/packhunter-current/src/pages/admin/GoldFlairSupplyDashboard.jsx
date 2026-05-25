/**
 * Gold Flair Supply Dashboard (admin-only).
 *
 * Read-only diagnostic. Surfaces the bot pool state for gold flair trades:
 *   - Top KPIs (across all sets): tradeable / blocked / maturing
 *   - Set browser: per-set strict-tradeable count + readiness
 *   - Card grid for selected set: matcher Tier 1 strict eligibility
 *   - Per-card drawer: full waterfall (validity → age → soft-ban →
 *     availability → user-link → host-health) + maturation cohorts
 *
 * Architecture: reuses existing /eligible-packs and /eligible-cards (both
 * cached server-side, fast). Adds /supply-detail for on-demand drawer.
 * No new aggregation across all cards (too expensive at this DB scale).
 *
 * NOT intended for live operations dashboarding — diagnostic only.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box, Typography, Paper, Chip, Stack, Alert, CircularProgress, Card,
  CardContent, Grid, Drawer, IconButton, TextField, MenuItem, FormControl,
  InputLabel, Select, Divider, LinearProgress, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ScheduleIcon from '@mui/icons-material/Schedule'
import InventoryIcon from '@mui/icons-material/Inventory'
import PageHeader from '../../components/PageHeader'

const callApi = async (path) => {
  const token = localStorage.getItem('vudoo_auth_token') || ''
  const res = await fetch(path, {
    credentials: 'include',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { rawText: text } }
  return { ok: res.ok, status: res.status, data }
}

// Format a possibly-large integer with thousands separators.
const fmt = (n) => Number(n || 0).toLocaleString()

function KpiCard({ label, value, color = 'default', icon = null, subtle = null }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          {icon}
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 600 }} color={color === 'default' ? 'text.primary' : `${color}.main`}>
          {fmt(value)}
        </Typography>
        {subtle != null && (
          <Typography variant="caption" color="text.secondary">{subtle}</Typography>
        )}
      </CardContent>
    </Card>
  )
}

function WaterfallStep({ label, count, total, blocked = 0, color = 'primary' }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {fmt(count)} {blocked > 0 && <Typography component="span" variant="caption" color="error">(−{fmt(blocked)})</Typography>}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} color={color} sx={{ height: 6, borderRadius: 1 }} />
    </Box>
  )
}

export default function GoldFlairSupplyDashboard({ user }) {
  const [packs, setPacks] = useState([])
  const [packsLoading, setPacksLoading] = useState(true)
  const [selectedSet, setSelectedSet] = useState('')
  const [cards, setCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filter chips
  const [filter, setFilter] = useState('all') // 'all' | 'tradeable' | 'blocked' | 'reserve_low'
  const [rarity, setRarity] = useState('all')
  const [sort, setSort] = useState('rarity_number')

  // Drawer
  const [drawerCard, setDrawerCard] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerDetail, setDrawerDetail] = useState(null)

  // Load packs once.
  useEffect(() => {
    let cancelled = false
    setPacksLoading(true)
    callApi('/api/admin/manual-gold-flair-trade/eligible-packs')
      .then(r => {
        if (cancelled) return
        if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`)
        const list = r.data.packs || []
        setPacks(list)
        if (list.length > 0 && !selectedSet) setSelectedSet(list[list.length - 1].setCode)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setPacksLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load cards when set changes.
  useEffect(() => {
    if (!selectedSet) { setCards([]); return }
    let cancelled = false
    setCardsLoading(true)
    callApi(`/api/admin/manual-gold-flair-trade/eligible-cards?setCode=${encodeURIComponent(selectedSet)}`)
      .then(r => {
        if (cancelled) return
        if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`)
        setCards(r.data.cards || [])
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setCardsLoading(false) })
    return () => { cancelled = true }
  }, [selectedSet])

  // Top-level KPIs aggregated across all packs.
  const summary = useMemo(() => {
    const s = {
      totalSets: packs.length,
      tradeableCardsAcrossSets: 0,
      eligible10PlusAcrossSets: 0,
      tradeable12PlusLooseAcrossSets: 0,
      ownedUniqueAcrossSets: 0,
      // computed lazily from current set's cards
      currentSetTradeable: 0,
      currentSetReserveLow: 0,
      currentSetBlocked: 0,
    }
    for (const p of packs) {
      s.tradeableCardsAcrossSets += parseInt(p.strictTradeable12Plus || p.eligibleCards || 0, 10)
      s.eligible10PlusAcrossSets += parseInt(p.eligible10Plus || 0, 10)
      s.tradeable12PlusLooseAcrossSets += parseInt(p.tradeable12Plus || 0, 10)
      s.ownedUniqueAcrossSets += parseInt(p.ownedUniqueCards || 0, 10)
    }
    for (const c of cards) {
      if (c.strictEligible || c.tradeReady) s.currentSetTradeable++
      else if (c.maxCopies >= 10 && c.maxCopies < 12) s.currentSetReserveLow++
      else if (c.maxCopies >= 12) s.currentSetBlocked++
    }
    s.currentSetGapVsLoose = Math.max(0,
      (parseInt(packs.find(p => p.setCode === selectedSet)?.tradeable12Plus || 0, 10)) - s.currentSetTradeable
    )
    return s
  }, [packs, cards, selectedSet])

  const availableRarities = useMemo(() => {
    return [...new Set(cards.map(c => c.rarity_code).filter(Boolean))].sort()
  }, [cards])

  const filteredCards = useMemo(() => {
    let result = [...cards]
    if (filter === 'tradeable') result = result.filter(c => c.strictEligible || c.tradeReady)
    else if (filter === 'blocked')  result = result.filter(c => !c.strictEligible && !c.tradeReady && c.maxCopies >= 12)
    else if (filter === 'reserve_low') result = result.filter(c => c.maxCopies >= 10 && c.maxCopies < 12)
    if (rarity !== 'all') result = result.filter(c => c.rarity_code === rarity)
    if (sort === 'max_copies_desc') result.sort((a, b) => (b.maxCopies || 0) - (a.maxCopies || 0))
    else if (sort === 'name') result.sort((a, b) => (a.card_name || '').localeCompare(b.card_name || ''))
    else result.sort((a, b) => {
      const r = (a.rarity_code || '').localeCompare(b.rarity_code || '')
      if (r !== 0) return r
      return (a.card_number || '').localeCompare(b.card_number || '', undefined, { numeric: true })
    })
    return result
  }, [cards, filter, rarity, sort])

  const openDrawer = useCallback(async (card) => {
    setDrawerCard(card)
    setDrawerDetail(null)
    setDrawerLoading(true)
    try {
      const r = await callApi(`/api/admin/manual-gold-flair-trade/supply-detail?cardId=${encodeURIComponent(card.backend_id || card.card_id)}`)
      if (!r.ok) throw new Error(r.data?.error || `HTTP ${r.status}`)
      setDrawerDetail(r.data)
    } catch (e) {
      setDrawerDetail({ error: e.message })
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, mx: 'auto' }}>
      <PageHeader
        icon={<InventoryIcon />}
        title="Gold Flair Supply Dashboard"
        subtitle="Read-only diagnostic. Strict matcher Tier 1 eligibility, blocked-by-X breakdown, and 24/48/72h maturation cohorts."
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Top KPIs (across all sets) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <KpiCard
            label="Tradeable cards (strict)"
            value={summary.tradeableCardsAcrossSets}
            color="success"
            icon={<CheckCircleIcon color="success" fontSize="small" />}
            subtle={`across ${summary.totalSets} sets`}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard
            label="Loose-ge12 (false positives)"
            value={Math.max(0, summary.tradeable12PlusLooseAcrossSets - summary.tradeableCardsAcrossSets)}
            color="warning"
            icon={<BlockIcon color="warning" fontSize="small" />}
            subtle={`raw ge12=${fmt(summary.tradeable12PlusLooseAcrossSets)}, strict=${fmt(summary.tradeableCardsAcrossSets)}`}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard
            label="Cards with ≥10 copies"
            value={summary.eligible10PlusAcrossSets}
            icon={<InventoryIcon fontSize="small" />}
            subtle="game-eligibility (10+)"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard
            label="Owned unique cards"
            value={summary.ownedUniqueAcrossSets}
            icon={<InventoryIcon fontSize="small" />}
            subtle="any bot has ≥1 copy"
          />
        </Grid>
      </Grid>

      {/* Set picker + per-set summary */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>Set</InputLabel>
            <Select value={selectedSet} label="Set" onChange={(e) => setSelectedSet(e.target.value)}>
              {packsLoading && <MenuItem value="">Loading…</MenuItem>}
              {packs.map(p => (
                <MenuItem key={p.setCode} value={p.setCode}>
                  {p.setName} — {p.strictTradeable12Plus ?? p.eligibleCards ?? 0} ready / {p.tradeable12Plus ?? 0} ≥12 / {p.eligible10Plus ?? 0} ≥10
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`Set tradeable: ${summary.currentSetTradeable}`} color="success" size="small" />
            <Chip label={`Reserve low: ${summary.currentSetReserveLow}`} color="warning" size="small" />
            <Chip label={`≥12 but blocked: ${summary.currentSetBlocked}`} color="error" size="small" />
            {summary.currentSetGapVsLoose > 0 && (
              <Tooltip title="Cards with raw ≥12 copies but no strict-eligible bot. Likely blocked by 14d age or soft-ban filter.">
                <Chip label={`Filter gap: ${summary.currentSetGapVsLoose}`} color="default" size="small" />
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Filter / sort toolbar */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Typography variant="caption" sx={{ mr: 1 }}>Filter:</Typography>
          {[
            { v: 'all',         label: `All (${cards.length})` },
            { v: 'tradeable',   label: `Tradeable (${summary.currentSetTradeable})`,    color: 'success' },
            { v: 'blocked',     label: `Blocked ≥12 (${summary.currentSetBlocked})`,     color: 'error' },
            { v: 'reserve_low', label: `Reserve low (${summary.currentSetReserveLow})`,  color: 'warning' },
          ].map(opt => (
            <Chip key={opt.v}
              label={opt.label}
              color={filter === opt.v ? (opt.color || 'primary') : 'default'}
              variant={filter === opt.v ? 'filled' : 'outlined'}
              onClick={() => setFilter(opt.v)} size="small"
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Rarity</InputLabel>
            <Select value={rarity} label="Rarity" onChange={(e) => setRarity(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {availableRarities.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sort</InputLabel>
            <Select value={sort} label="Sort" onChange={(e) => setSort(e.target.value)}>
              <MenuItem value="rarity_number">Rarity, number</MenuItem>
              <MenuItem value="max_copies_desc">Max copies (desc)</MenuItem>
              <MenuItem value="name">Name (A-Z)</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Card grid */}
      {cardsLoading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
      ) : (
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={1.5}>
            {filteredCards.map(c => {
              const eligible = c.strictEligible || c.tradeReady
              const max = c.maxCopies || 0
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={c.backend_id || c.card_id}>
                  <Card
                    sx={{
                      cursor: 'pointer', opacity: eligible ? 1 : 0.55,
                      borderLeft: '3px solid',
                      borderLeftColor: eligible ? 'success.main' : (max >= 10 ? 'warning.main' : 'text.disabled'),
                    }}
                    onClick={() => openDrawer(c)}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                          {c.card_name}
                        </Typography>
                        <Chip label={c.rarity_code} size="small" />
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                        <Typography variant="caption" color="text.secondary">max copies: {max}</Typography>
                        <Box sx={{ flex: 1 }} />
                        {eligible
                          ? <Chip label="Tradeable" size="small" color="success" />
                          : (max >= 12 ? <Chip label="Blocked" size="small" color="error" />
                          : (max >= 10 ? <Chip label="Reserve" size="small" color="warning" />
                          : <Chip label="No supply" size="small" />))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
            {filteredCards.length === 0 && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No cards match this filter.
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Per-card detail drawer */}
      <Drawer anchor="right" open={!!drawerCard} onClose={() => setDrawerCard(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 2 } }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline">Card Detail</Typography>
            <Typography variant="h6">{drawerCard?.card_name}</Typography>
            <Typography variant="caption" color="text.secondary">{drawerCard?.rarity_code} · {drawerCard?.setCode || drawerCard?.expansion_id}</Typography>
          </Box>
          <IconButton onClick={() => setDrawerCard(null)}><CloseIcon /></IconButton>
        </Stack>

        {drawerLoading && <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>}
        {drawerDetail?.error && <Alert severity="error">{drawerDetail.error}</Alert>}

        {drawerDetail?.detail && !drawerLoading && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Generated {drawerDetail.generatedAt ? new Date(drawerDetail.generatedAt).toLocaleTimeString() : ''}
            </Typography>

            <Box sx={{ mt: 2, mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                {drawerDetail.detail.strictEligible
                  ? <Chip label="Strict-eligible NOW" color="success" size="small" icon={<CheckCircleIcon />} />
                  : <Chip label="Not currently tradeable" color="error" size="small" icon={<BlockIcon />} />}
                <Typography variant="body2" color="text.secondary">
                  {fmt(drawerDetail.detail.strictEligibleAccountCount)} eligible bot(s)
                </Typography>
              </Stack>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Filter Waterfall</Typography>
            <WaterfallStep
              label="Total accounts with this card"
              count={drawerDetail.detail.totalAccountsWithCard}
              total={drawerDetail.detail.totalAccountsWithCard}
            />
            <WaterfallStep
              label="≥12 copies"
              count={drawerDetail.detail.accountsWithCopies12Plus}
              total={drawerDetail.detail.totalAccountsWithCard}
            />
            <WaterfallStep
              label="& aged ≥14d"
              count={drawerDetail.detail.accounts12PlusAge14}
              total={drawerDetail.detail.accountsWithCopies12Plus}
              blocked={drawerDetail.detail.blockedByAgeCount}
              color="warning"
            />
            <WaterfallStep
              label="& not soft-banned"
              count={drawerDetail.detail.accounts12PlusAge14NotSoftBanned}
              total={drawerDetail.detail.accounts12PlusAge14}
              blocked={drawerDetail.detail.blockedBySoftBanCount}
              color="warning"
            />
            <WaterfallStep
              label="& available (not locked)"
              count={drawerDetail.detail.accounts12PlusAge14Available}
              total={drawerDetail.detail.accounts12PlusAge14NotSoftBanned}
              blocked={drawerDetail.detail.blockedByAvailabilityCount}
              color="warning"
            />
            <WaterfallStep
              label="& bot-only (not user-linked)"
              count={drawerDetail.detail.strictEligibleAccountCount + drawerDetail.detail.blockedByHostHealthCount}
              total={drawerDetail.detail.accounts12PlusAge14Available}
              blocked={drawerDetail.detail.blockedByUserLinkCount}
              color="warning"
            />
            <WaterfallStep
              label="& host-health OK ⇒ STRICT-ELIGIBLE"
              count={drawerDetail.detail.strictEligibleAccountCount}
              total={drawerDetail.detail.accounts12PlusAge14Available}
              blocked={drawerDetail.detail.blockedByHostHealthCount}
              color="success"
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              <ScheduleIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              Maturation cohorts (≥12 copies, healthy, just below 14d gate)
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip size="small" label={`24h: +${fmt(drawerDetail.detail.nextMaturationWindow.accountsMaturing24h)}`} />
              <Chip size="small" label={`48h: +${fmt(drawerDetail.detail.nextMaturationWindow.accountsMaturing48h)}`} />
              <Chip size="small" label={`72h: +${fmt(drawerDetail.detail.nextMaturationWindow.accountsMaturing72h)}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              These accounts are below the 14-day gate today. They become eligible automatically as time passes — no deploy required.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Reserve Pool</Typography>
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`Reserve low (10-11 copies): ${fmt(drawerDetail.detail.reserveLowCount)}`} color="warning" variant="outlined" />
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  )
}
