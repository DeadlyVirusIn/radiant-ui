/**
 * CardRequest Page
 * Discord-like automated card trading - browse packs, request cards, track trades
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
  Collapse,
} from '@mui/material';
import {
  SwapHoriz as TradeIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  ViewModule as GridIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { FadeIn } from '../components/Animations';
import { autoTrade } from '../services/api';
import { useTradeWebSocket } from '../hooks/useTradeWebSocket';
import { useLanguage } from '../contexts/LanguageContext';
import { useAccount } from '../contexts/AccountContext';
import CardSearchAutocomplete from '../components/CardSearchAutocomplete';
import TradeRequestList from '../components/TradeRequestList';
import CardGrid from '../components/CardGrid';
import { RARITY_COLORS } from '../constants/gameData';
import PageHeader from '../components/PageHeader';
import AccountSelector from '../components/AccountSelector';
import AccountBadge from '../components/AccountBadge';
import AccountPerformance from '../components/AccountPerformance';
import MetricStrip from '../components/MetricStrip';
import NextActionBanner from '../components/NextActionBanner';
import InlineActivityStrip from '../components/InlineActivityStrip';
import AdaptiveHints from '../components/AdaptiveHints';
import OptimizationCards from '../components/OptimizationCards';

export default function CardRequest({ user }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const { accounts: linkedAccounts, selectedAccountId, selectAccount } = useAccount();
  const isDark = theme.palette.mode === 'dark';

  // State - Trade requests
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State - Pack browsing
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState('');
  const [cardType, setCardType] = useState('premium'); // 'regular' | 'premium'
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardCounts, setCardCounts] = useState(null);

  // Client-side cache for card data (key: `${pack}_${type}`)
  const cardCacheRef = useRef(new Map());

  // State - UI mode
  const [browseMode, setBrowseMode] = useState(0); // 0 = Grid Browse, 1 = Search

  // Selected card for confirmation dialog
  const [selectedCard, setSelectedCard] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pick card data from websocket (requestId -> { cards })
  const [pickCardDataMap, setPickCardDataMap] = useState({});

  // Rarity filter state
  const [selectedRarities, setSelectedRarities] = useState([]);

  // How It Works collapsed state
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // Load packs and requests on mount + account change.
  // Clear requests SYNCHRONOUSLY before fetch to prevent ghost data flash.
  useEffect(() => {
    setRequests([]);
    setError(null);
    loadPacks();
    loadRequests();
  }, [selectedAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback polling: refresh active requests every 30s (safety net — socket is primary).
  // Uses ref to avoid resetting the interval when requests change.
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  useEffect(() => {
    const interval = setInterval(() => {
      if (requestsRef.current.some(r => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status))) {
        loadRequests();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []); // stable — no deps, reads from ref

  // Load available packs
  const loadPacks = async () => {
    setPacksLoading(true);
    try {
      const result = await autoTrade.getPacks();
      setPacks(result.packs || []);
      // Auto-select newest set (last in array)
      if (result.packs?.length > 0) {
        const newestPack = result.packs[result.packs.length - 1];
        setSelectedPack(newestPack.setCode);
      }
    } catch (err) {
      console.error('Failed to load packs:', err);
    } finally {
      setPacksLoading(false);
    }
  };

  // Debounce ref for card loading + AbortController for in-flight cancellation
  const loadCardsTimeoutRef = useRef(null);
  const cardAbortRef = useRef(null);

  // Load cards when pack or type changes (debounced + abort previous)
  useEffect(() => {
    if (selectedPack) {
      if (loadCardsTimeoutRef.current) clearTimeout(loadCardsTimeoutRef.current);
      if (cardAbortRef.current) cardAbortRef.current.abort();
      setCards([]); // Clear stale cards immediately on switch
      setCardCounts(null);
      loadCardsTimeoutRef.current = setTimeout(() => {
        loadCards();
      }, 300);
    }
    return () => {
      if (loadCardsTimeoutRef.current) clearTimeout(loadCardsTimeoutRef.current);
      if (cardAbortRef.current) cardAbortRef.current.abort();
    };
  }, [selectedPack, cardType, selectedAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cards for selected pack (with client-side caching + abort guard)
  const loadCards = async () => {
    if (!selectedPack) return;

    const cacheKey = `${selectedPack}_${cardType}_${selectedAccountId || 'all'}`;

    // Check cache first (1 minute TTL)
    const cached = cardCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      setCards(cached.cards);
      setCardCounts(cached.counts);
      return;
    }

    const controller = new AbortController();
    cardAbortRef.current = controller;

    setCardsLoading(true);
    try {
      const result = await autoTrade.getCards(selectedPack, cardType, false, selectedAccountId);
      if (controller.signal.aborted) return;
      const cardsData = result.cards || [];
      const countsData = result.counts || null;

      cardCacheRef.current.set(cacheKey, {
        cards: cardsData,
        counts: countsData,
        timestamp: Date.now(),
      });

      setCards(cardsData);
      setCardCounts(countsData);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Failed to load cards:', err);
      setCards([]);
    } finally {
      if (!controller.signal.aborted) {
        setCardsLoading(false);
      }
    }
  };

  // Rarity weight for sorting (higher = rarer)
  const RARITY_WEIGHT = { UR: 11, IM: 10, SSR: 9, SAR: 8, S: 7, SR: 6, AR: 5, RR: 4, R: 3, U: 2, C: 1 };

  // Filtered and sorted cards: rarity filter + not-owned-first + rarity ascending + dex order
  const filteredCards = useMemo(() => {
    let result = [...cards];
    // Apply rarity filter
    if (selectedRarities.length > 0) {
      result = result.filter(c => selectedRarities.includes(c.rarity_code));
    }
    // Sort: not-owned first, then by rarity weight ascending (common first / dex order), then by card_number
    result.sort((a, b) => {
      const aOwned = (a.user_owned || 0) > 0 ? 1 : 0;
      const bOwned = (b.user_owned || 0) > 0 ? 1 : 0;
      if (aOwned !== bOwned) return aOwned - bOwned;
      const aWeight = RARITY_WEIGHT[a.rarity_code] || 0;
      const bWeight = RARITY_WEIGHT[b.rarity_code] || 0;
      if (aWeight !== bWeight) return aWeight - bWeight;
      return (a.card_number || '').localeCompare(b.card_number || '', undefined, { numeric: true });
    });
    return result;
  }, [cards, selectedRarities]);

  // Get unique rarities from current cards for filter chips
  const availableRarities = useMemo(() => {
    const rarities = [...new Set(cards.map(c => c.rarity_code).filter(Boolean))];
    return rarities.sort((a, b) => (RARITY_WEIGHT[b] || 0) - (RARITY_WEIGHT[a] || 0));
  }, [cards]);

  // Load user's trade requests
  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const [requestsResult, statsResult] = await Promise.all([
        autoTrade.getRequests(),
        autoTrade.getStats(),
      ]);

      setRequests(requestsResult.requests || []);
      setStats(statsResult);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError('Failed to load trade requests');
    } finally {
      setLoading(false);
    }
  };

  // Handle WebSocket events — called by guard layer (no stale closures)
  const handleTradeEvent = useCallback((event) => {
    // Store pick card data when received
    if (event.type === 'pick_card' && event.requestId && event.cards) {
      setPickCardDataMap(prev => ({
        ...prev,
        [event.requestId]: { cards: event.cards },
      }));
    }

    // Update request list in-place from socket event (source of truth for active requests)
    setRequests(prev => {
      const idx = prev.findIndex(r => r.id === event.requestId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: event.status || updated[idx].status,
          ...(event.botFriendCode ? { matched_friend_code: event.botFriendCode } : {}),
          ...(event.error ? { error_message: event.error } : {}),
        };
        return updated;
      }
      // New request not in list yet — will appear on next API sync
      return prev;
    });

    const isManual = event.tradeMode === 'manual';
    const messages = {
      created: 'Trade request created!',
      matching: 'Searching for a bot with the card...',
      friend_sent: isManual
        ? 'Friend request sent! Open the game and accept it.'
        : 'Friend request sent! Auto-accepting...',
      friend_accepted: 'Friend request accepted!',
      proposal_sent: isManual
        ? 'Trade proposal sent! Open the game, accept the trade, and pick any card.'
        : 'Trade proposal sent! Loading your cards...',
      pick_card: 'Pick a card to offer for the trade!',
      accepted: 'Trade accepted! Confirming...',
      completed: 'Trade completed successfully!',
      failed: `Trade failed: ${event.error || 'Unknown error'}`,
      expired: 'Friend request expired.',
      cancelled: 'Trade request cancelled.',
    };

    const severity = ['completed'].includes(event.type)
      ? 'success'
      : ['failed', 'expired', 'cancelled'].includes(event.type)
      ? 'error'
      : event.type === 'pick_card'
      ? 'warning'
      : 'info';

    setSnackbar({
      open: true,
      message: event.message || messages[event.type] || 'Trade status updated',
      severity,
    });
  }, []);

  // Reconnect resync — full API sync when socket reconnects
  const handleReconnect = useCallback(() => {
    loadRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket guard: handles accountId filtering, dedup, timestamp monotonic,
  // transition validation, debug logging, and reconnect resync
  const { seedRequestState } = useTradeWebSocket({
    onAny: handleTradeEvent,
  }, selectedAccountId, handleReconnect);

  // Handle card selection (from grid or search)
  const handleCardSelect = (card) => {
    setSelectedCard(card);
    setConfirmDialogOpen(true);
  };

  // Confirm and create trade request
  const handleConfirmRequest = async () => {
    if (!selectedCard) return;

    setSubmitting(true);

    try {
      const result = await autoTrade.createRequest(selectedCard.card_id || selectedCard.backend_id, selectedAccountId || null);

      if (result.success) {
        // Optimistic insert: add PENDING request immediately from API response.
        // Socket events will update status from here. No loadRequests() needed.
        if (result.request) {
          setRequests(prev => {
            if (prev.some(r => r.id === result.request.id)) return prev;
            return [{ ...result.request, requested_at: new Date().toISOString() }, ...prev];
          });
          seedRequestState([{ id: result.request.id, status: result.request.status || 'PENDING', requested_at: new Date().toISOString() }]);
        }
        setSnackbar({
          open: true,
          message: 'Trade request created! Searching for a bot...',
          severity: 'success',
        });
        setConfirmDialogOpen(false);
        setSelectedCard(null);
        // Refresh cards to update availability
        if (selectedPack) loadCards();
      } else {
        setSnackbar({
          open: true,
          message: result.error || 'Failed to create request',
          severity: 'error',
        });
      }
    } catch (err) {
      console.error('Failed to create request:', err);
      setSnackbar({
        open: true,
        message: err.message || 'Failed to create request',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel a trade request — optimistic update, socket confirms
  const handleCancelRequest = async (requestId) => {
    try {
      await autoTrade.cancelRequest(requestId);
      // Optimistic: mark as CANCELLED immediately. Socket event will confirm.
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status: 'CANCELLED' } : r
      ));
      setSnackbar({
        open: true,
        message: 'Trade request cancelled',
        severity: 'info',
      });
    } catch (err) {
      console.error('Failed to cancel request:', err);
      setSnackbar({
        open: true,
        message: 'Failed to cancel request',
        severity: 'error',
      });
    }
  };

  // Get pending request card IDs to disable those cards
  const pendingCardIds = requests
    .filter(r => ['PENDING', 'QUEUED', 'MATCHING', 'FRIEND_REQUEST_SENT', 'TRADE_PROPOSAL_SENT'].includes(r.status))
    .map(r => r.card_id);

  const canCreateRequest = !stats || stats.pending < 3;

  // Shared box style for themed containers
  const sectionBoxSx = {
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  };

  return (
    <FadeIn duration={0.3}>
    <Box sx={{ p: { xs: 2, md: 3 } }}>

      <NextActionBanner requests={requests} accounts={linkedAccounts} type="trade" />
      <AdaptiveHints requests={requests} type="trade" />
      <OptimizationCards requests={requests} />
      <InlineActivityStrip />
      <PageHeader
        icon={<TradeIcon />}
        title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{t('cardRequest.title')}<AccountBadge activeCount={requests.filter(r => !['COMPLETED','FAILED','CANCELLED'].includes(r.status)).length} /></Box>}
        subtitle={t('cardRequest.subtitle')}
        action={
          <AccountSelector />
        }
      />

      {/* ── Stats metric strip — shared MetricStrip component ── */}
      {stats && (
        <MetricStrip
          items={[
            { label: t('cardRequest.yourRequests'), value: stats.total, color: 'primary.main' },
            { label: t('cardRequest.pending'), value: stats.pending, color: 'warning.main' },
            { label: t('cardRequest.completed'), value: stats.completed, color: 'success.main' },
            { label: t('cardRequest.failed'), value: stats.failed, color: 'error.main' },
          ]}
          sx={{ mb: 3 }}
        />
      )}

      {/* Per-account performance breakdown */}
      <AccountPerformance requests={requests} accounts={linkedAccounts} />

      {/* ── Requests list ── */}
      <TradeRequestList
        requests={requests}
        loading={loading}
        error={error}
        onRefresh={loadRequests}
        onCancel={handleCancelRequest}
        onRequestAgain={async (req) => {
          try {
            const avail = await autoTrade.checkAvailability(req.card_id);
            if (!avail?.available) {
              setError('Card is currently unavailable — try again later');
              return;
            }
            const result = await autoTrade.createRequest(req.card_id, selectedAccountId);
            // Optimistic insert (same pattern as handleConfirmRequest)
            if (result.request) {
              setRequests(prev => {
                if (prev.some(r => r.id === result.request.id)) return prev;
                return [{ ...result.request, requested_at: new Date().toISOString() }, ...prev];
              });
              seedRequestState([{ id: result.request.id, status: result.request.status || 'PENDING', requested_at: new Date().toISOString() }]);
            }
            setSnackbar({ open: true, message: `New request created for ${req.card_name}`, severity: 'success' });
          } catch (e) {
            setError(e.message || 'Failed to create request');
          }
        }}
        stats={stats}
        pickCardDataMap={pickCardDataMap}
        onBrowseCards={() => {
          document.getElementById('card-browse-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      {/* ── Browse / Search section ── */}
      <Box id="card-browse-section" sx={{ ...sectionBoxSx, mb: 3, overflow: 'hidden' }}>

        {/* Tab bar */}
        <Tabs
          value={browseMode}
          onChange={(e, v) => setBrowseMode(v)}
          variant="fullWidth"
          sx={{
            borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            minHeight: 44,
            '& .MuiTab-root': { minHeight: 44, py: 0, fontWeight: 600, fontSize: '0.8rem' },
            '& .MuiTabs-indicator': {
              height: 2,
              borderRadius: '2px 2px 0 0',
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            },
          }}
        >
          <Tab icon={<GridIcon sx={{ fontSize: 17 }} />} label="Browse Packs" iconPosition="start" />
          <Tab icon={<SearchIcon sx={{ fontSize: 17 }} />} label="Search Cards" iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 2.5 }}>

          {/* ── Grid Browse Mode ── */}
          {browseMode === 0 && (
            <>
              {/* Compact toolbar: pack selector + type toggle */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  mb: 2,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                  <InputLabel>{t('cardRequest.selectPack')}</InputLabel>
                  <Select
                    value={selectedPack}
                    label={t('cardRequest.selectPack')}
                    onChange={(e) => setSelectedPack(e.target.value)}
                    disabled={packsLoading}
                  >
                    {packs.map((pack) => (
                      <MenuItem key={pack.setCode} value={pack.setCode}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                          <span>{pack.setName || pack.setCode}</span>
                          <Chip
                            size="small"
                            label={cardType === 'premium' ? `${pack.premiumAvailable} available` : `${pack.regularAvailable} available`}
                            color={
                              (cardType === 'premium' ? pack.premiumAvailable : pack.regularAvailable) > 0
                                ? 'success'
                                : 'default'
                            }
                            sx={{ ml: 2, height: 18, fontSize: '0.68rem' }}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <ToggleButtonGroup
                  value={cardType}
                  exclusive
                  onChange={(e, v) => { if (v) { setCardType(v); setSelectedRarities([]); } }}
                  aria-label="card type"
                  size="small"
                >
                  <ToggleButton value="regular" sx={{ px: 2, py: 0.75 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="button" sx={{ fontSize: '0.75rem', display: 'block' }}>
                        {t('cardRequest.regularCards')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        C, U, R, RR
                      </Typography>
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="premium" sx={{ px: 2, py: 0.75 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="button" sx={{ fontSize: '0.75rem', display: 'block' }}>
                        {t('cardRequest.premiumCards')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        AR, SR, SAR, S, SSR
                      </Typography>
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Rarity filter — horizontal scrollable chips */}
              {availableRarities.length > 1 && (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 0.5,
                    mb: 1.5,
                    overflowX: 'auto',
                    pb: 0.5,
                    '&::-webkit-scrollbar': { height: 3 },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: isDark ? 'rgba(124,138,255,0.2)' : 'rgba(0,0,0,0.15)',
                      borderRadius: 2,
                    },
                  }}
                >
                  {availableRarities.map(rarity => (
                    <Chip
                      key={rarity}
                      label={rarity}
                      size="small"
                      onClick={() => {
                        setSelectedRarities(prev =>
                          prev.includes(rarity) ? prev.filter(r => r !== rarity) : [...prev, rarity]
                        );
                      }}
                      sx={{
                        flexShrink: 0,
                        backgroundColor: selectedRarities.includes(rarity) ? (RARITY_COLORS[rarity] || '#999') : 'transparent',
                        color: selectedRarities.includes(rarity) ? 'white' : 'text.primary',
                        border: `1px solid ${RARITY_COLORS[rarity] || '#999'}`,
                        fontWeight: selectedRarities.includes(rarity) ? 'bold' : 'normal',
                        cursor: 'pointer',
                        height: 24,
                        fontSize: '0.72rem',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                  {selectedRarities.length > 0 && (
                    <Chip
                      label="Clear"
                      size="small"
                      variant="outlined"
                      onDelete={() => setSelectedRarities([])}
                      onClick={() => setSelectedRarities([])}
                      sx={{ flexShrink: 0, height: 24, fontSize: '0.72rem' }}
                    />
                  )}
                </Box>
              )}

              {/* Card counts summary */}
              {cardCounts && (
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={`${filteredCards.length} cards${selectedRarities.length > 0 ? ' (filtered)' : ''}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                  {cardType === 'premium' && cardCounts.premiumTotal > 0 && (
                    <Chip
                      label={`${cardCounts.premiumTotal} total premium cards`}
                      variant="outlined"
                      size="small"
                    />
                  )}
                  {cardType === 'regular' && cardCounts.regularTotal > 0 && (
                    <Chip
                      label={`${cardCounts.regularTotal} total regular cards`}
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>
              )}

              {/* Max requests warning */}
              {!canCreateRequest && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
                  You have reached the maximum of 3 concurrent requests. Wait for one to complete or cancel it.
                </Alert>
              )}

              {/* Card Grid */}
              <CardGrid
                cards={filteredCards}
                loading={cardsLoading}
                onTradeClick={canCreateRequest ? handleCardSelect : undefined}
                disabledCardIds={pendingCardIds}
              />
            </>
          )}

          {/* ── Search Mode ── */}
          {browseMode === 1 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Search by card name to find specific cards across all packs.
              </Typography>
              <CardSearchAutocomplete
                onSelect={handleCardSelect}
                disabled={!canCreateRequest}
              />
              {!canCreateRequest && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: '10px' }}>
                  You have reached the maximum of 3 concurrent requests. Wait for one to complete or cancel it.
                </Alert>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── How It Works — subtle collapsible ── */}
      <Box sx={{ mb: 2 }}>
        <Box
          onClick={() => setHowItWorksOpen(p => !p)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer',
            color: 'text.disabled',
            userSelect: 'none',
            '&:hover': { color: 'text.secondary' },
            transition: 'color 0.2s',
          }}
        >
          <InfoIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption">{t('cardRequest.howItWorks')}</Typography>
          <ExpandMoreIcon
            sx={{
              fontSize: 14,
              transition: 'transform 0.2s',
              transform: howItWorksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Box>
        <Collapse in={howItWorksOpen}>
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
            }}
          >
            {[
              t('cardRequest.step1'),
              t('cardRequest.step2'),
              t('cardRequest.step3'),
              t('cardRequest.step4'),
              t('cardRequest.step5'),
            ].map((step, i) => (
              <Typography key={i} variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                {step}
              </Typography>
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* ── Confirmation dialog ── */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => !submitting && setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('cardRequest.requestCard')}</DialogTitle>
        <DialogContent>
          {selectedCard && (
            <Box sx={{ py: 2 }}>
              {/* Card preview with image */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'grey.100',
                  borderRadius: 2,
                  mb: 3,
                }}
              >
                <Box
                  component="img"
                  src={`/api/cards/${selectedCard.backend_id}/image?v=5`}
                  alt={selectedCard.card_name}
                  sx={{
                    width: 80,
                    height: 112,
                    objectFit: 'contain',
                    bgcolor: isDark ? 'grey.900' : 'grey.200',
                    borderRadius: 1,
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <Box>
                  <Typography variant="h6">{selectedCard.card_name}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip
                      size="small"
                      label={selectedCard.rarity_code}
                      sx={{
                        bgcolor: RARITY_COLORS[selectedCard.rarity_code] || 'grey.500',
                        color: 'white',
                        fontWeight: 'bold',
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {selectedCard.expansion_name || selectedCard.expansion_id}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Availability info */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {selectedCard.isAvailable ? (
                    <>
                      <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      <Typography color="success.main" fontWeight={600}>
                        Available for trade
                      </Typography>
                    </>
                  ) : (
                    <Typography color="error.main">
                      No bots currently have this card
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Cost info */}
              {selectedCard.sandCost > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This card requires <strong>{selectedCard.sandCost.toLocaleString()} Bright Sand</strong> to trade.
                  The bot account will provide the sand.
                </Alert>
              )}

              {/* Instructions */}
              <Alert severity="warning">
                After requesting, a bot will send you a friend request in-game.
                You have <strong>10 minutes</strong> to accept the friend request,
                otherwise the trade will expire.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            disabled={submitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmRequest}
            disabled={submitting || !selectedCard?.isAvailable}
            startIcon={submitting ? <CircularProgress size={16} /> : <TradeIcon />}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 600,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
              },
            }}
          >
            {submitting ? t('cardRequest.submitting') : t('cardRequest.requestCard')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: '10px' }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  );
}
