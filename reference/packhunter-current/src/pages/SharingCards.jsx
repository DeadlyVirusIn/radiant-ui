/**
 * Sharing Cards Page (Phase 22 Wave B)
 *
 * Rename of the prior AutoGift page, reorganized into the unified
 * Sharing Cards product:
 *
 *   Manual Sharing tab (default)
 *     → the existing AutoGift gift-request UI (pack browser, card search,
 *       request timeline). All working flows preserved verbatim — we only
 *       removed the rendering of the premium auto-gift section, which
 *       has moved to the Automatic tab.
 *
 *   Automatic Scheduled Sharing tab
 *     1. Fill Missing Cards   → existing FillMissingPanel (WORKING)
 *     2. Shinedust Farm       → existing ShinedustFarmPanel (WORKING)
 *     3. Specific Card Sharing → NEW: rotation-based sharing via
 *                                /api/sharing-rules (Phase 22.b API).
 *
 * Architecture decisions:
 *   - Both tabs share the same outer page. Manual tab is always mounted;
 *     its state (selected cards, filters, in-flight sockets) survives
 *     tab switches. The Automatic tab is lazy-mounted on first click
 *     but then stays mounted.
 *   - Fill Missing + Shinedust mutual exclusion (game-level 1-gift/day
 *     limit) is UNCHANGED — same refs + disable-if-active callbacks as
 *     before, just reordered so Fill Missing appears first.
 *   - Specific Card Sharing is independent of the mutual-exclusion pair.
 *     It goes through the sharing_rules CRUD endpoint, not the daily
 *     auto-gift system.
 *   - Legacy /auto-gift route redirects to /sharing-cards. No duplicate
 *     nav entries; no "legacy" label.
 *
 * Do NOT rewrite AutoGiftInner logic. If a Manual-flow bug surfaces, it
 * is NOT caused by this rename — git blame the original AutoGift
 * function for unchanged history.
 */

import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle, createContext, useContext } from 'react';
import { fetchWithAuth } from '../services/api';        // Wave B — Specific Card Sharing CRUD
import { friendlyError } from '../utils/errorMessages';
import { logEvent, logAlert } from '../utils/observability';
import PageHeader from '../components/PageHeader';
import AccountSelector from '../components/AccountSelector';
import StatusIndicator from '../components/StatusIndicator';
import AccountBadge from '../components/AccountBadge';
import InlineActivityStrip from '../components/InlineActivityStrip';
import { getErrorDisplay, isRetryable } from '../utils/errorDisplay';
import { getSocket } from '../services/socket';
import RequestTimeline from '../components/RequestTimeline';
import AdaptiveHints from '../components/AdaptiveHints';
import OptimizationCards from '../components/OptimizationCards';

import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
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
  Divider,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Skeleton,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Autocomplete,
  Checkbox,
  Pagination,
} from '@mui/material';
import {
  CardGiftcard as GiftIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  PersonAdd as PersonAddIcon,
  Pending as PendingIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
  Error as ErrorIcon,
  Inventory2 as InventoryIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  ViewModule as GridIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material';
import { useLanguage } from '../contexts/LanguageContext';
import { useAccount } from '../contexts/AccountContext';
import { useSocketEventGuard } from '../hooks/useSocketEventGuard';
import { getRequestAge } from '../hooks/useRequestAge';
import { RARITY_COLORS } from '../constants/gameData';
import { RARITY_CHIP_TEXT } from '../constants/rarityConfig';
import { FadeIn } from '../components/Animations';
import { EmptyState } from '../components/EmptyState';
import { useSectionStyles } from '../components/SectionCard';
import MetricStrip from '../components/MetricStrip';
import AccountPerformance from '../components/AccountPerformance';
import NextActionBanner from '../components/NextActionBanner';

// API helpers
const getAuthHeaders = () => {
  return { 'Content-Type': 'application/json' };
};

// All API calls use credentials: 'include' for httpOnly cookie auth

const autoGift = {
  getPacks: async () => {
    const res = await fetch('/api/auto-gift/packs', { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get packs');
    return res.json();
  },
  getCards: async (setCode, availableOnly = true, accountId = null) => {
    let url = `/api/auto-gift/cards?setCode=${setCode}&availableOnly=${availableOnly}`;
    if (accountId) url += `&accountId=${accountId}`;
    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get cards');
    return res.json();
  },
  searchCards: async (query) => {
    const res = await fetch(`/api/auto-gift/search?q=${encodeURIComponent(query)}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to search cards');
    return res.json();
  },
  getCardInfo: async (cardId) => {
    const res = await fetch(`/api/auto-gift/card/${cardId}`, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get card info');
    return res.json();
  },
  createRequest: async (cardId, accountId = null) => {
    const res = await fetch('/api/auto-gift/request', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cardId, accountId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create request');
    }
    return res.json();
  },
  getRequests: async (status = null) => {
    const url = status ? `/api/auto-gift/requests?status=${status}` : '/api/auto-gift/requests';
    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to get requests');
    return res.json();
  },
  cancelRequest: async (requestId, reason = 'Cancelled by user') => {
    const res = await fetch(`/api/auto-gift/requests/${requestId}/cancel`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to cancel request');
    }
    return res.json();
  },
};

// Status colors and icons
const STATUS_CONFIG = {
  PENDING: { color: 'warning', icon: <PendingIcon />, label: 'Pending' },
  QUEUED: { color: 'info', icon: <PendingIcon />, label: 'Queued' },
  MATCHING: { color: 'info', icon: <RefreshIcon />, label: 'Finding Card' },
  FRIEND_REQUEST_SENT: { color: 'primary', icon: <PersonAddIcon />, label: 'Add Friend' },
  EXECUTING_GIFT: { color: 'secondary', icon: <GiftIcon />, label: 'Sending Gift' },
  COMPLETED: { color: 'success', icon: <CheckCircleIcon />, label: 'Completed' },
  FAILED: { color: 'error', icon: <ErrorIcon />, label: 'Failed' },
  CANCELLED: { color: 'default', icon: <CancelIcon />, label: 'Cancelled' },
};

// v2.1 — Shinedust Farm + Fill Missing panels re-enabled (Apr 2026)

// ──────────────── Tab visibility context (hardening pass) ────────────────
//
// Lightweight React context so descendants can check which tab is active
// and short-circuit expensive background work (polling, socket handler
// state writes, refetches) when their tab is hidden. display:none mounting
// is preserved for state preservation; this context just gates the side
// effects that were previously running unconditionally.
//
// Contract:
//   useTabActive('manual')    → true iff Manual tab is currently visible
//   useTabActive('automatic') → true iff Automatic tab is currently visible
//
// Default ({manual:true, automatic:true}) means a component mounted outside
// the provider behaves as before — legacy call sites + tests unaffected.

const TabVisibilityContext = createContext({ manual: true, automatic: true });
function useTabActive(name) {
  const ctx = useContext(TabVisibilityContext);
  return !!ctx[name];
}

// Structured observability log. Uses logEvent (already imported) so
// Phase 19 observability picks these up. Wrapped in try/catch because
// observability failures must never break UX.
function sharingLog(event, data = {}) {
  try { logEvent({ level: 'info', event: `sharing_cards.${event}`, ...data }); }
  catch { /* swallow */ }
}

// ─────────────────────── SharingCards outer wrapper ───────────────────────

/**
 * Top-level page component. Holds Manual/Automatic tab state and
 * broadcasts visibility via TabVisibilityContext. No business logic.
 */
export default function SharingCards({ user }) {
  const [tab, setTab] = useState(0);
  // Automatic tab is lazy-mounted on first click, then stays mounted so
  // its state (rotation list, form drafts) survives tab switches.
  const [automaticMounted, setAutomaticMounted] = useState(false);
  const handleTabChange = (_e, v) => {
    const fromName = tab === 0 ? 'manual' : 'automatic';
    const toName = v === 0 ? 'manual' : 'automatic';
    if (v === 1 && !automaticMounted) setAutomaticMounted(true);
    setTab(v);
    sharingLog('tab_switch', { from: fromName, to: toName });
  };

  const visibility = useMemo(
    () => ({ manual: tab === 0, automatic: tab === 1 }),
    [tab]
  );

  return (
    <TabVisibilityContext.Provider value={visibility}>
      <Box>
        <Box sx={{
          borderBottom: 1, borderColor: 'divider',
          px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 },
        }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            aria-label="Sharing Cards tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Manual Sharing" id="sharing-tab-0" aria-controls="sharing-panel-0" />
            <Tab label="Automatic Scheduled Sharing" id="sharing-tab-1" aria-controls="sharing-panel-1" />
          </Tabs>
        </Box>

        {/* Manual tab — always mounted. display:none preserves heavy
            state (selected cards, filters, in-flight requests). Effects
            inside check useTabActive('manual') before starting timers. */}
        <Box
          role="tabpanel"
          id="sharing-panel-0"
          aria-labelledby="sharing-tab-0"
          hidden={tab !== 0}
          sx={{ display: tab === 0 ? 'block' : 'none' }}
        >
          <ManualGiftPanel user={user} />
        </Box>

        {/* Automatic tab — lazy-mount on first click, then keep mounted. */}
        <Box
          role="tabpanel"
          id="sharing-panel-1"
          aria-labelledby="sharing-tab-1"
          hidden={tab !== 1}
          sx={{ display: tab === 1 ? 'block' : 'none' }}
        >
          {automaticMounted && <AutomaticSharingTab user={user} />}
        </Box>
      </Box>
    </TabVisibilityContext.Provider>
  );
}

// ─────────────────── Manual gift panel (renamed) ───────────────────
// Retains the full original AutoGift implementation unchanged. Only the
// top-level signature and the <AutoGiftPremiumFeatures /> render were
// touched by Wave B. Hardening pass added a useTabActive('manual') guard
// around the 30s fallback polling loop; all other logic is identical.
// Any bug in Manual gift flows is NOT caused by the rename — git blame
// the original AutoGift function for history.

function ManualGiftPanel({ user }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const { accounts: linkedAccounts, selectedAccountId, selectAccount } = useAccount();

  // State - Gift requests
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State - Pack browsing
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState('');
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardCounts, setCardCounts] = useState(null);

  // Selected card for confirmation dialog
  const [selectedCard, setSelectedCard] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedTimelines, setExpandedTimelines] = useState(new Set());

  // Expandable info section
  const [infoExpanded, setInfoExpanded] = useState(false);

  // Premium check
  const isPremium = user?.subscriptionTier === 'premium' || user?.subscriptionTier === 'admin';

  // Image error tracking
  const [imageErrors, setImageErrors] = useState({});

  // Browse mode state (0 = Grid Browse, 1 = Search)
  const [browseMode, setBrowseMode] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Rarity filter state
  const [selectedRarities, setSelectedRarities] = useState([]);

  // Request filter tabs
  const [requestTab, setRequestTab] = useState('active');
  const [requestSubFilter, setRequestSubFilter] = useState('all');
  const [confirmingCancelId, setConfirmingCancelId] = useState(null);

  // Status tabs configuration
  const GIFT_ACTIVE_STATUSES = ['PENDING', 'QUEUED', 'MATCHING', 'FRIEND_REQUEST_SENT', 'EXECUTING_GIFT'];
  const STATUS_TABS = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active', statuses: GIFT_ACTIVE_STATUSES },
    { value: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
    { value: 'failed', label: 'Failed/Cancelled', statuses: ['FAILED', 'CANCELLED'] },
  ];

  // Sub-filters for specific tabs
  const GIFT_SUB_FILTERS = {
    failed: [
      { value: 'all', label: 'All' },
      { value: 'retryable', label: 'Retryable', filter: (r) => r.status === 'FAILED' && isRetryable(r.error_message) },
      { value: 'permanent', label: 'Permanent', filter: (r) => r.status === 'FAILED' && !isRetryable(r.error_message) },
    ],
  };
  const currentGiftSubFilters = GIFT_SUB_FILTERS[requestTab];

  // Rarity weight for sorting (ascending: common first)
  const RARITY_WEIGHT = { C: 1, U: 2, R: 3, RR: 4, AR: 5, SAR: 6, SR: 7, S: 8, SSR: 9 };

  // Get unique rarities from current cards for filter chips
  const availableRarities = useMemo(() => {
    const rarities = [...new Set(cards.map(c => c.rarity_code).filter(Boolean))];
    return rarities.sort((a, b) => (RARITY_WEIGHT[a] || 0) - (RARITY_WEIGHT[b] || 0));
  }, [cards]);

  // Filtered and sorted cards: rarity filter + missing first + rarity ascending + dex order
  const filteredCards = useMemo(() => {
    let result = [...cards];
    // Apply rarity filter
    if (selectedRarities.length > 0) {
      result = result.filter(c => selectedRarities.includes(c.rarity_code));
    }
    // Sort: missing (user_owned === 0) first, then by rarity weight ascending, then by card_number
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

  // Gift socket event names (all events the guard should listen to)
  const GIFT_EVENT_NAMES = useMemo(() => [
    'gift_request_created', 'gift_request_matching', 'gift_request_friend_sent',
    'gift_request_friend_accepted', 'gift_executing', 'gift_request_completed',
    'gift_request_failed', 'gift_request_cancelled', 'gift_request_expired',
  ], []);

  // Stable handler for gift socket events — reads from refs, no stale closures
  const handleGuardedGiftEvent = useCallback((data, meta) => {
    // Update request list in-place from socket event (source of truth for active requests)
    setRequests(prev => {
      const idx = prev.findIndex(r => r.id === data.requestId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: data.status,
          matched_friend_code: data.botFriendCode,
          ...(data.error ? { error_message: friendlyError(data.error) } : {}),
          _lastUpdatedAt: meta.lastUpdatedAt,
          _source: meta.source,
        };
        return updated;
      }
      return prev;
    });

    // Show snackbar for important updates
    if (data.status === 'FRIEND_REQUEST_SENT') {
      setSnackbar({ open: true, message: `Add friend code: ${data.botFriendCode}`, severity: 'info' });
    } else if (data.status === 'COMPLETED') {
      setSnackbar({ open: true, message: `Gift complete! Check your present box.`, severity: 'success' });
    } else if (data.status === 'FAILED') {
      setSnackbar({ open: true, message: `Gift failed: ${friendlyError(data.error)}`, severity: 'error' });
    }
  }, []);

  // Reconnect resync — full API sync when socket reconnects
  const handleReconnect = useCallback(() => {
    loadRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket event guard: single registration, handles accountId filter, dedup,
  // timestamp monotonic guard, transition validation, debug logging, reconnect resync
  const { seedRequestState, clearState: clearGuardState } = useSocketEventGuard({
    selectedAccountId,
    eventNames: GIFT_EVENT_NAMES,
    onEvent: handleGuardedGiftEvent,
    onReconnect: handleReconnect,
  });

  // Load packs and requests on mount + account change.
  // Clear requests SYNCHRONOUSLY before fetch to prevent ghost data flash.
  useEffect(() => {
    clearGuardState();
    setRequests([]);
    setError(null);
    loadPacks();
    loadRequests();
  }, [selectedAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback polling: refresh active requests every 30s in case socket event was missed.
  // 30s (not 10s) — socket is primary, this is safety net only.
  //
  // Hardening pass: guard by tab visibility. While Manual tab is hidden
  // we skip the poll entirely (no new interval is even scheduled). When
  // the user comes back the poll resumes. This eliminated a background
  // 30s ping that used to fire for every user sitting on the Automatic
  // tab or with Sharing Cards open in a background browser tab.
  const requestsRef = useRef(requests);
  requestsRef.current = requests;
  const isManualActive = useTabActive('manual');
  useEffect(() => {
    if (!isManualActive) return;
    const interval = setInterval(() => {
      if (requestsRef.current.some(r => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(r.status))) {
        loadRequests();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isManualActive]); // re-runs when tab visibility changes

  // Load available packs
  const loadPacks = async () => {
    setPacksLoading(true);
    try {
      const result = await autoGift.getPacks();
      setPacks(result.packs || []);
      // Auto-select latest pack (last in array)
      if (result.packs?.length > 0) {
        const latestPack = result.packs[result.packs.length - 1];
        setSelectedPack(latestPack.expansion_id);
      }
    } catch (err) {
      console.error('Failed to load packs:', err);
    } finally {
      setPacksLoading(false);
    }
  };

  // AbortController ref for card fetches — cancels in-flight requests on account/pack switch
  const cardAbortRef = useRef(null);

  // Load cards when pack or account changes — abort previous fetch, clear stale data
  useEffect(() => {
    if (selectedPack) {
      // Cancel any in-flight card fetch
      if (cardAbortRef.current) cardAbortRef.current.abort();
      setCards([]); // Clear stale cards immediately
      setCardCounts(null);
      loadCards();
    }
    return () => { if (cardAbortRef.current) cardAbortRef.current.abort(); };
  }, [selectedPack, selectedAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cards for selected pack (scoped to selected account for ownership)
  const loadCards = async () => {
    if (!selectedPack) return;

    // Create new AbortController for this fetch
    const controller = new AbortController();
    cardAbortRef.current = controller;

    setCardsLoading(true);
    try {
      const result = await autoGift.getCards(selectedPack, true, selectedAccountId || null);
      // Only apply result if this fetch wasn't aborted
      if (!controller.signal.aborted) {
        setCards(result.cards || []);
        setCardCounts(result.counts || null);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Failed to load cards:', err);
        setCards([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setCardsLoading(false);
      }
    }
  };

  // Load user's gift requests
  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await autoGift.getRequests();
      setRequests(result.requests || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
      setError('Failed to load gift requests');
    } finally {
      setLoading(false);
    }
  };

  // Search cards (debounced)
  const handleSearchChange = (query) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const result = await autoGift.searchCards(query);
        setSearchResults(result.cards || []);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // Filter requests: main tab, then sub-filter
  const filteredRequests = requests.filter((request) => {
    // Main tab filter
    if (requestTab !== 'all') {
      const tab = STATUS_TABS.find((t) => t.value === requestTab);
      if (!tab?.statuses?.includes(request.status)) return false;
    }
    // Sub-filter
    if (requestSubFilter !== 'all' && currentGiftSubFilters) {
      const sf = currentGiftSubFilters.find(s => s.value === requestSubFilter);
      if (sf?.filter && !sf.filter(request)) return false;
    }
    return true;
  });

  // Pagination for gift requests
  const [giftPage, setGiftPage] = useState(1);
  const GIFTS_PER_PAGE = 20;
  const giftTotalPages = Math.ceil(filteredRequests.length / GIFTS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice((giftPage - 1) * GIFTS_PER_PAGE, giftPage * GIFTS_PER_PAGE);

  // Get counts for each tab
  const getTabCounts = () => ({
    all: requests.length,
    active: requests.filter((r) => ['PENDING', 'QUEUED', 'MATCHING', 'FRIEND_REQUEST_SENT', 'EXECUTING_GIFT'].includes(r.status)).length,
    completed: requests.filter((r) => r.status === 'COMPLETED').length,
    failed: requests.filter((r) => ['FAILED', 'CANCELLED'].includes(r.status)).length,
  });

  const tabCounts = getTabCounts();

  // Handle card click - open confirmation dialog
  const handleCardClick = (card) => {
    if (!card.isGiftable) {
      setSnackbar({ open: true, message: 'No accounts have this card available for gifting', severity: 'warning' });
      return;
    }
    setSelectedCard(card);
    setConfirmDialogOpen(true);
  };

  // Submit gift request
  const handleSubmitRequest = async () => {
    if (!selectedCard) return;

    if (!selectedCard.backend_id) {
      setSnackbar({ open: true, message: 'Card data is missing an ID. Please refresh and try again.', severity: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await autoGift.createRequest(selectedCard.card_id || selectedCard.backend_id, selectedAccountId);
      // Optimistic insert: add PENDING request immediately from API response.
      // Socket events will update status from here. No loadRequests() needed.
      if (result.request) {
        setRequests(prev => {
          // Avoid duplicate if socket event arrived first
          if (prev.some(r => r.id === result.request.id)) return prev;
          return [{
            ...result.request,
            requested_at: new Date().toISOString(),
            _lastUpdatedAt: new Date().toISOString(),
            _source: 'api',
          }, ...prev];
        });
        // Seed guard state so it can track this request's transitions
        seedRequestState([{ id: result.request.id, status: result.request.status || 'PENDING', requested_at: new Date().toISOString() }]);
      }
      setSnackbar({ open: true, message: 'Gift request created! Searching for card...', severity: 'success' });
      setConfirmDialogOpen(false);
      setSelectedCard(null);
    } catch (err) {
      setSnackbar({ open: true, message: friendlyError(err.message), severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel a gift request — optimistic update, socket confirms
  const handleCancelRequest = async (requestId) => {
    try {
      await autoGift.cancelRequest(requestId);
      // Optimistic: mark as CANCELLED immediately. Socket event will confirm.
      setRequests(prev => prev.map(r =>
        r.id === requestId ? { ...r, status: 'CANCELLED', _lastUpdatedAt: new Date().toISOString(), _source: 'api' } : r
      ));
      setSnackbar({ open: true, message: 'Gift request cancelled', severity: 'info' });
    } catch (err) {
      setSnackbar({ open: true, message: friendlyError(err.message), severity: 'error' });
    }
  };

  // Get card image URL
  const getCardImageUrl = (card) => {
    if (imageErrors[card.backend_id]) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjNjY2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
    }
    return `/api/cards/${card.backend_id}/image?v=5`;
  };

  // Handle image load error
  const handleImageError = (cardId) => {
    setImageErrors((prev) => ({ ...prev, [cardId]: true }));
  };

  const isDark = theme.palette.mode === 'dark';

  const { sectionBox } = useSectionStyles();

  // Shared section header style
  const sectionHeader = (icon, label) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      {icon}
      <Typography variant="caption" fontWeight={700} color="primary.main" textTransform="uppercase" letterSpacing={1}>
        {label}
      </Typography>
    </Box>
  );

  // Semantic status chip colors
  const getStatusChipProps = (status) => {
    const map = {
      PENDING: { sx: { bgcolor: theme.palette.warning.main, color: '#fff' } },
      QUEUED: { sx: { bgcolor: theme.palette.info.main, color: '#fff' } },
      MATCHING: { sx: { bgcolor: theme.palette.info.main, color: '#fff' } },
      FRIEND_REQUEST_SENT: { sx: { bgcolor: theme.palette.secondary.main, color: '#fff' } },
      EXECUTING_GIFT: { sx: { bgcolor: theme.palette.secondary.light, color: '#fff' } },
      COMPLETED: { sx: { bgcolor: theme.palette.success.main, color: '#fff' } },
      FAILED: { sx: { bgcolor: theme.palette.error.main, color: '#fff' } },
      CANCELLED: { sx: { bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' } },
    };
    return map[status] || {};
  };

  return (
    <FadeIn>
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <NextActionBanner requests={requests} accounts={linkedAccounts} type="gift" onTabChange={(tab) => setRequestTab(tab)} />
      <AdaptiveHints requests={requests} type="gift" />
      <OptimizationCards requests={requests} />
      <InlineActivityStrip />
      {/* Header */}
      <PageHeader
        icon={<GiftIcon />}
        title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>Auto Gift<AccountBadge activeCount={requests.filter(r => !['COMPLETED','FAILED','CANCELLED'].includes(r.status)).length} /></Box>}
        subtitle="Request 1D–4D cards gifted to you automatically"
        action={
          <>
            <AccountSelector />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { loadPacks(); loadRequests(); loadCards(); }}
              size="small"
              sx={{ borderRadius: '8px' }}
            >
              Refresh
            </Button>
          </>
        }
      />

      {/* Wave B — Premium Auto-Gift Features (Shinedust / Fill Missing)
          have been moved to the "Automatic Scheduled Sharing" tab. The
          <AutoGiftPremiumFeatures /> render that used to live here is
          now handled by <AutomaticSharingTab /> in the outer wrapper.
          Keeping this comment as a signpost for grep / git blame. */}

      {/* Info Box */}
      <Alert
        severity="info"
        sx={{ mb: 3, borderRadius: '12px' }}
        action={
          <IconButton size="small" onClick={() => setInfoExpanded(!infoExpanded)} aria-label={infoExpanded ? 'Collapse info' : 'Expand info'}>
            {infoExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        }
      >
        <Typography variant="body2">
          Request common cards (1D-4D) to be gifted to you automatically. Cards appear in your in-game present box.
        </Typography>
        <Collapse in={infoExpanded}>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>How it works:</strong>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>Select a card you want from the catalog below</li>
                <li>The bot finds an account with that card</li>
                <li>Bot sends you a friend request - add the friend code shown</li>
                <li>Once you accept, the bot gifts you the card</li>
                <li>Check your in-game present box to receive the card</li>
              </ol>
            </Typography>
          </Box>
        </Collapse>
      </Alert>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats metric strip — shared MetricStrip component */}
      <MetricStrip
        items={[
          { label: 'Your Requests', value: tabCounts.all, color: 'primary.main' },
          { label: 'Active', value: tabCounts.active, color: 'warning.main' },
          { label: 'Completed', value: tabCounts.completed, color: 'success.main' },
          { label: 'Failed', value: tabCounts.failed, color: 'error.main' },
        ]}
        sx={{ mb: 3 }}
      />

      {/* Per-account performance breakdown (collapsed by default, hidden if < 2 accounts) */}
      <AccountPerformance requests={requests} accounts={linkedAccounts} />

      {/* Your Gift Requests Section with Tabs */}
      {requests.length > 0 && (
        <Box sx={{ ...sectionBox, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            {sectionHeader(<GiftIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />, 'Your Gift Requests')}
            <Button startIcon={<RefreshIcon />} onClick={loadRequests} size="small" disabled={loading} sx={{ borderRadius: '8px' }}>
              Refresh
            </Button>
          </Box>

          {/* Filter Tabs */}
          <Tabs
            value={requestTab}
            onChange={(e, v) => { setRequestTab(v); setRequestSubFilter('all'); }}
            variant="fullWidth"
            sx={{
              borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              mb: 2,
              minHeight: 40,
              '& .MuiTab-root': { minHeight: 40, py: 0, fontWeight: 600, fontSize: '0.78rem' },
              '& .MuiTabs-indicator': {
                height: 2,
                borderRadius: '2px 2px 0 0',
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          >
            {STATUS_TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {tab.label}
                    <Chip
                      size="small"
                      label={tabCounts[tab.value]}
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>

          {/* Sub-filter chips — shown when available for current tab */}
          {currentGiftSubFilters && currentGiftSubFilters.length > 1 && (
            <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
              {currentGiftSubFilters.map(sf => (
                <Chip
                  key={sf.value}
                  label={sf.label}
                  size="small"
                  variant={requestSubFilter === sf.value ? 'filled' : 'outlined'}
                  color={requestSubFilter === sf.value ? 'primary' : 'default'}
                  onClick={() => setRequestSubFilter(sf.value)}
                  sx={{ fontSize: '0.65rem', cursor: 'pointer' }}
                />
              ))}
            </Box>
          )}

          {/* Filtered Request List */}
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={<GiftIcon sx={{ fontSize: 48 }} />}
              title="No requests here"
              description={requestTab === 'active' ? 'You have no active gift requests. Browse cards below to get started.' : 'No requests match this filter.'}
              minHeight={120}
            />
          ) : (
            <>
            <List dense disablePadding>
              {paginatedRequests.map((req) => {
                const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                return (
                  <ListItem
                    key={req.id}
                    id={`request-gift-${req.id}`}
                    disablePadding
                    sx={{
                      px: 1.5, py: 1,
                      mb: 0.5,
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                      borderLeft: `3px solid ${
                        req.status === 'COMPLETED' ? theme.palette.success.main :
                        req.status === 'FAILED' || req.status === 'CANCELLED' ? theme.palette.error.main :
                        req.status === 'FRIEND_REQUEST_SENT' ? theme.palette.primary.main :
                        theme.palette.warning.main
                      }`,
                      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.08)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 1.5 }}>
                      <Box sx={{ mt: 0.5, color: `${statusConfig.color}.main`, position: 'relative' }}>
                        {statusConfig.icon}
                        {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(req.status) && (
                          <Box sx={{
                            position: 'absolute', top: -2, right: -2,
                            width: 6, height: 6, borderRadius: '50%',
                            bgcolor: `${statusConfig.color}.main`,
                            animation: 'pulse 2s ease-in-out infinite',
                            '@keyframes pulse': {
                              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                              '50%': { opacity: 0.4, transform: 'scale(0.7)' },
                            },
                          }} />
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" noWrap>{req.card_name}</Typography>
                          <Chip label={req.rarity_code || '?'} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {req.card_id}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {req.expansion_name || req.expansion_id} • #{req.card_number || '?'}
                          {req._source && (
                            <Typography component="span" variant="caption" sx={{ ml: 1, fontSize: '0.55rem', color: req._source === 'socket' ? 'success.main' : 'info.main', opacity: 0.7 }}>
                              via {req._source}{req._lastUpdatedAt ? `, ${(() => { const s = Math.round((Date.now() - new Date(req._lastUpdatedAt).getTime()) / 1000); return s < 60 ? `${s}s ago` : `${Math.round(s/60)}m ago`; })()}` : ''}
                            </Typography>
                          )}
                        </Typography>
                        {req.status === 'FRIEND_REQUEST_SENT' && req.matched_friend_code && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                            <Typography variant="body2" color="primary.main" fontWeight="bold" fontSize="0.8rem">
                              Add friend: {req.matched_friend_code}
                            </Typography>
                            <IconButton
                              size="small"
                              aria-label="Copy friend code"
                              onClick={() => {
                                navigator.clipboard.writeText(req.matched_friend_code.replace(/-/g, ''));
                                setSnackbar({ open: true, message: 'Friend code copied!', severity: 'success' });
                              }}
                            >
                              <CopyIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Box>
                        )}
                        {req.error_message && (() => {
                          const info = getErrorDisplay(req.error_message);
                          return (
                            <Typography variant="caption" color="error.main" display="block" sx={{ fontSize: '0.65rem' }}>
                              {info.icon} {info.message}
                              {info.category === 'retryable' && <span style={{ color: 'inherit', opacity: 0.7 }}> — retrying</span>}
                            </Typography>
                          );
                        })()}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        {/* Phase-aware age indicator for active requests */}
                        {(() => {
                          const age = getRequestAge(req);
                          return !age.isTerminal ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 0.5 }}>
                              {age.ageText && (
                                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: `${age.color}.main` || age.color, fontFamily: 'monospace', lineHeight: 1.2 }}>
                                  {age.phaseLabel} • {age.ageText}
                                </Typography>
                              )}
                              {age.band !== 'active' && (
                                <Typography variant="caption" sx={{ fontSize: '0.5rem', color: `${age.color}.main` || age.color, lineHeight: 1.2 }}>
                                  {age.label}
                                </Typography>
                              )}
                            </Box>
                          ) : null;
                        })()}
                        <StatusIndicator status={req.status} type="gift" errorMessage={req.error_message} compact />
                        {['PENDING', 'QUEUED', 'MATCHING', 'FRIEND_REQUEST_SENT'].includes(req.status) && (
                          confirmingCancelId === req.id ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Button
                                size="small" variant="contained" color="error"
                                onClick={() => { handleCancelRequest(req.id); setConfirmingCancelId(null); }}
                                sx={{ fontSize: '0.55rem', height: 20, textTransform: 'none', minWidth: 'auto', px: 0.75 }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="small" variant="outlined"
                                onClick={() => setConfirmingCancelId(null)}
                                sx={{ fontSize: '0.55rem', height: 20, textTransform: 'none', minWidth: 'auto', px: 0.75 }}
                              >
                                Keep
                              </Button>
                            </Box>
                          ) : (
                            <Tooltip title="Cancel request">
                              <IconButton size="small" onClick={() => {
                                const age = getRequestAge(req);
                                if (age.ageMs > 3 * 60 * 1000) {
                                  setConfirmingCancelId(req.id);
                                } else {
                                  handleCancelRequest(req.id);
                                }
                              }} aria-label="Cancel request">
                                <CancelIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )
                        )}
                        {['FAILED', 'CANCELLED'].includes(req.status) && req.requested_at && (Date.now() - new Date(req.requested_at).getTime() > 120000) && (
                          <Tooltip title="Create a new request for this card">
                            <Button
                              size="small" variant="outlined" color="primary"
                              onClick={async () => {
                                try {
                                  const avail = await autoGift.checkAvailability(req.card_id);
                                  if (!avail?.available) {
                                    setSnackbar({ open: true, message: 'Card currently unavailable', severity: 'warning' });
                                    return;
                                  }
                                  const result = await autoGift.createRequest(req.card_id, selectedAccountId);
                                  // Optimistic insert (same pattern as handleSubmitRequest)
                                  if (result.request) {
                                    setRequests(prev => {
                                      if (prev.some(r => r.id === result.request.id)) return prev;
                                      return [{ ...result.request, requested_at: new Date().toISOString(), _lastUpdatedAt: new Date().toISOString(), _source: 'api' }, ...prev];
                                    });
                                    seedRequestState([{ id: result.request.id, status: result.request.status || 'PENDING', requested_at: new Date().toISOString() }]);
                                  }
                                  setSnackbar({ open: true, message: `New request for ${req.card_name}`, severity: 'success' });
                                } catch (e) {
                                  setSnackbar({ open: true, message: e.message, severity: 'error' });
                                }
                              }}
                              sx={{ fontSize: '0.6rem', height: 22, textTransform: 'none', minWidth: 'auto', px: 1 }}
                            >
                              Request Again
                            </Button>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    {/* Expandable timeline */}
                    <Box sx={{ width: '100%', mt: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{ cursor: 'pointer', color: 'text.disabled', fontSize: '0.6rem', '&:hover': { color: 'text.secondary' } }}
                        onClick={() => setExpandedTimelines(prev => {
                          const next = new Set(prev)
                          next.has(req.id) ? next.delete(req.id) : next.add(req.id)
                          return next
                        })}
                      >
                        {expandedTimelines.has(req.id) ? '▾ Hide timeline' : '▸ Show timeline'}
                      </Typography>
                      <Collapse in={expandedTimelines.has(req.id)}>
                        <RequestTimeline request={req} type="gift" />
                      </Collapse>
                    </Box>
                  </ListItem>
                );
              })}
            </List>
            {giftTotalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {(giftPage - 1) * GIFTS_PER_PAGE + 1}–{Math.min(giftPage * GIFTS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length}
                </Typography>
                <Pagination count={giftTotalPages} page={giftPage} onChange={(_, p) => setGiftPage(p)} size="small" />
              </Box>
            )}
          </>
          )}
        </Box>
      )}

      {/* Browse / Search Panel */}
      <Box sx={{ ...sectionBox, overflow: 'hidden' }}>
        {/* Mode tabs */}
        <Tabs
          value={browseMode}
          onChange={(e, v) => setBrowseMode(v)}
          variant="fullWidth"
          sx={{
            borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            mb: 0,
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

        {/* Grid Browse Mode */}
        {browseMode === 0 && (
          <>
            {/* Pack Selection */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                <InputLabel>Expansion</InputLabel>
                <Select
                  value={selectedPack}
                  label="Expansion"
                  onChange={(e) => setSelectedPack(e.target.value)}
                  disabled={packsLoading}
                >
                  {packs.map((pack) => (
                    <MenuItem key={pack.expansion_id} value={pack.expansion_id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>{pack.expansion_name || pack.expansion_id}</span>
                        <Chip
                          size="small"
                          label={`${pack.available_cards}/${pack.total_cards}`}
                          color={pack.available_cards > 0 ? 'success' : 'default'}
                          sx={{ ml: 2, height: 18, fontSize: '0.68rem' }}
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {cardCounts && (
                <Chip
                  label={`${cardCounts.available} of ${cardCounts.total} available`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              )}
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
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Chip
                label={`${filteredCards.length} cards${selectedRarities.length > 0 ? ' (filtered)' : ''}`}
                color="primary"
                variant="outlined"
                size="small"
              />
            </Box>

            {cardsLoading ? (
              <Grid container spacing={1.5}>
                {[...Array(8)].map((_, index) => (
                  <Grid item xs={6} sm={4} md={3} lg={2.4} key={index}>
                    <Card sx={{ height: '100%', borderRadius: '12px' }}>
                      <Skeleton variant="rectangular" height={200} animation="wave" sx={{ borderRadius: '12px 12px 0 0' }} />
                      <CardContent sx={{ py: 1.5 }}>
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="40%" />
                      </CardContent>
                      <CardActions sx={{ p: 1, pt: 0 }}>
                        <Skeleton variant="rectangular" width="100%" height={32} sx={{ borderRadius: '8px' }} />
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : filteredCards.length === 0 ? (
              <EmptyState
                icon={<InventoryIcon sx={{ fontSize: 48 }} />}
                title={selectedRarities.length > 0 ? 'No cards match filter' : 'No cards available'}
                description={selectedRarities.length > 0
                  ? 'No cards match the selected rarity filter. Try clearing filters.'
                  : 'No giftable cards available in this expansion. Select a different expansion or check back later.'}
                minHeight={200}
              />
            ) : (
              <Grid container spacing={1.5}>
                {filteredCards.map((card) => {
                  const isAvailable = card.isGiftable;
                  const rarityColor = RARITY_COLORS[card.rarity_code] || '#666';

                  return (
                    <Grid item xs={6} sm={4} md={3} lg={2.4} key={card.backend_id}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '12px',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                          opacity: isAvailable ? 1 : 0.55,
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          cursor: isAvailable ? 'pointer' : 'default',
                          '&:hover': isAvailable ? {
                            transform: 'scale(1.01)',
                            borderColor: rarityColor,
                            boxShadow: `0 0 16px ${rarityColor}33, ${isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)'}`,
                          } : {},
                        }}
                        onClick={() => isAvailable && handleCardClick(card)}
                      >
                        {/* Card Image */}
                        <CardMedia
                          component="img"
                          image={getCardImageUrl(card)}
                          alt={card.card_name}
                          onError={() => handleImageError(card.backend_id)}
                          sx={{
                            height: 200,
                            objectFit: 'contain',
                            bgcolor: isDark ? 'grey.900' : 'grey.100',
                            p: 1,
                            borderRadius: '12px 12px 0 0',
                          }}
                        />

                        {/* Card Info */}
                        <CardContent sx={{ flexGrow: 1, py: 1.5, px: 1.5 }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight="bold"
                            noWrap
                            title={card.card_name}
                          >
                            {card.card_name}
                          </Typography>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                            <Chip
                              size="small"
                              label={card.rarity_code}
                              sx={{
                                bgcolor: rarityColor,
                                color: RARITY_CHIP_TEXT[card.rarity_code] || '#fff',
                                fontWeight: 'bold',
                                fontSize: '0.6875rem',
                                height: 20,
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              #{card.card_number || '?'}
                            </Typography>
                          </Box>

                          {/* Availability */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                            {isAvailable ? (
                              <>
                                <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                                <Typography variant="caption" color="success.main" fontWeight={600}>
                                  Available
                                </Typography>
                              </>
                            ) : (
                              <>
                                <WarningIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">
                                  Not available
                                </Typography>
                              </>
                            )}
                          </Box>

                          {/* User's inventory */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                            <InventoryIcon sx={{ fontSize: 13, color: card.user_owned > 0 ? 'info.main' : 'text.disabled' }} />
                            <Typography
                              variant="caption"
                              color={card.user_owned > 0 ? 'info.main' : 'text.disabled'}
                            >
                              {card.user_owned || 0} owned
                            </Typography>
                          </Box>
                        </CardContent>

                        {/* Gift Button */}
                        <CardActions sx={{ p: 1, pt: 0 }}>
                          <Tooltip
                            title={
                              !isAvailable
                                ? 'No bots have this card'
                                : `Gift ${card.card_name}`
                            }
                          >
                            <span style={{ width: '100%' }}>
                              <Button
                                fullWidth
                                variant={isAvailable ? 'contained' : 'outlined'}
                                color={isAvailable ? 'primary' : 'inherit'}
                                startIcon={<GiftIcon />}
                                disabled={!isAvailable}
                                onClick={(e) => { e.stopPropagation(); handleCardClick(card); }}
                                size="small"
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 'bold',
                                  borderRadius: '8px',
                                  ...(isAvailable ? {
                                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                    '&:hover': {
                                      background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                                    },
                                  } : {}),
                                }}
                              >
                                Gift
                              </Button>
                            </span>
                          </Tooltip>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </>
        )}

        {/* Search Mode */}
        {browseMode === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Search by card name to find specific giftable cards across all packs.
            </Typography>
            <TextField
              fullWidth
              placeholder="Search by card name (min 2 characters)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchLoading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null,
              }}
              sx={{ mb: 2 }}
            />

            {searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
              <EmptyState
                icon={<SearchIcon sx={{ fontSize: 48 }} />}
                title="No results"
                description={`No giftable cards found matching "${searchQuery}". Try a different search term.`}
                minHeight={160}
              />
            )}

            {searchResults.length > 0 && (
              <Grid container spacing={1.5}>
                {searchResults.map((card) => {
                  const isAvailable = card.isGiftable;
                  const rarityColor = RARITY_COLORS[card.rarity_code] || '#666';

                  return (
                    <Grid item xs={6} sm={4} md={3} lg={2.4} key={card.backend_id}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          borderRadius: '12px',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                          opacity: isAvailable ? 1 : 0.55,
                          cursor: isAvailable ? 'pointer' : 'default',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          '&:hover': isAvailable ? {
                            transform: 'scale(1.01)',
                            borderColor: rarityColor,
                            boxShadow: `0 0 16px ${rarityColor}33, ${isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)'}`,
                          } : {},
                        }}
                        onClick={() => isAvailable && handleCardClick(card)}
                      >
                        <CardMedia
                          component="img"
                          image={getCardImageUrl(card)}
                          alt={card.card_name}
                          sx={{
                            height: 200,
                            objectFit: 'contain',
                            bgcolor: isDark ? 'grey.900' : 'grey.100',
                            p: 1,
                            borderRadius: '12px 12px 0 0',
                          }}
                        />
                        <CardContent sx={{ flexGrow: 1, py: 1.5, px: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold" noWrap>
                            {card.card_name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={card.rarity_code}
                              sx={{ bgcolor: rarityColor, color: RARITY_CHIP_TEXT[card.rarity_code] || '#fff', fontWeight: 'bold', height: 20, fontSize: '0.6875rem' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              #{card.card_number || '?'}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {card.expansion_name || card.expansion_id}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            {isAvailable ? (
                              <>
                                <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                                <Typography variant="caption" color="success.main" fontWeight={600}>Available</Typography>
                              </>
                            ) : (
                              <>
                                <WarningIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">Not available</Typography>
                              </>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Box>
        )}
        </Box>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => !submitting && setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GiftIcon color="primary" />
          Request Gift
        </DialogTitle>
        <DialogContent>
          {selectedCard && (
            <Box sx={{ py: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'grey.100',
                  borderRadius: 2,
                  mb: 2,
                }}
              >
                <Box
                  component="img"
                  src={getCardImageUrl(selectedCard)}
                  alt={selectedCard.card_name}
                  sx={{
                    width: 80,
                    height: 112,
                    objectFit: 'contain',
                    bgcolor: isDark ? 'grey.900' : 'grey.200',
                    borderRadius: 1,
                  }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <Box>
                  <Typography variant="h6">{selectedCard.card_name}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      Available for gifting
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Alert severity="warning" sx={{ borderRadius: '10px' }}>
                After requesting, you will receive a friend code. Add that friend in-game within <strong>10 minutes</strong> to receive your card.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitRequest}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <GiftIcon />}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              color: '#fff',
              borderRadius: '8px',
              fontWeight: 600,
              '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
            }}
          >
            {submitting ? 'Requesting...' : 'Request Gift'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
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

// === Premium Features Wrapper (mutual exclusion) ===

function AutoGiftPremiumFeatures({ user, selectedAccountId }) {
  const shinedustRef = useRef(null);
  const fillMissingRef = useRef(null);

  // Called when shinedust is enabled — disable fill-missing for same account
  const onShinedustEnabled = async () => {
    if (fillMissingRef.current?.disableIfActive) {
      await fillMissingRef.current.disableIfActive();
    }
  };

  // Called when fill-missing is enabled — disable shinedust for same account
  const onFillMissingEnabled = async () => {
    if (shinedustRef.current?.disableIfActive) {
      await shinedustRef.current.disableIfActive();
    }
  };

  return (
    <>
      <Alert severity="info" sx={{ mb: 2, borderRadius: '10px' }}>
        <Typography variant="body2">
          <strong>Only one</strong> auto-gift feature can be active per account (game limit: 1 received gift per day).
          Enabling one will automatically disable the other.
        </Typography>
      </Alert>

      {/* Wave B — order corrected to match product spec:
          1. Fill Missing Cards
          2. Shinedust Farm
          (Specific Card Sharing is appended OUTSIDE this component in
           AutomaticSharingTab, since it's not part of the mutex pair.) */}
      <PremiumFeatureSection
        title="Fill Missing Cards"
        icon="🃏"
        helpTitle="How Fill Missing Cards Works"
        helpContent={[
          'Automatically gifts you one card you don\'t own yet, every day after the 6:00 AM UTC game reset.',
          'After your collection is synced, the system finds cards missing from your selected account.',
          'Priority: 4-diamond cards first, then 3-diamond, then 2-diamond, then 1-diamond.',
          'A bot account that has a spare copy sends a friend request, gifts the card, then unfriends.',
          'You can filter by specific packs/expansions using the pack filter setting.',
          'Runs once per day per account. Collection sync must be enabled for this feature to work.',
        ]}
      >
        <FillMissingPanel ref={fillMissingRef} selectedAccountId={selectedAccountId} onEnabled={onFillMissingEnabled} />
      </PremiumFeatureSection>

      <PremiumFeatureSection
        title="Shinedust Farm"
        icon="💎"
        helpTitle="How Shinedust Farm Works"
        helpContent={[
          'Automatically gifts you one random 4-diamond (Double Rare) card every day after the 6:00 AM UTC game reset.',
          'A bot account that has a spare 4-diamond card sends a friend request to your selected account, gifts the card, then unfriends.',
          'Each 4-diamond card you receive and convert gives you 720 shinedust.',
          'Runs once per day per account — you cannot receive more than one shinedust farm gift per reset cycle.',
        ]}
      >
        <ShinedustFarmPanel ref={shinedustRef} user={user} selectedAccountId={selectedAccountId} onEnabled={onShinedustEnabled} />
      </PremiumFeatureSection>
    </>
  );
}

// === Premium Sub-Components ===

function PremiumFeatureSection({ title, icon, helpTitle, helpContent, children }) {
  const [expanded, setExpanded] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{
      mb: 2, p: 2.5, borderRadius: '12px',
      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${isDark ? 'rgba(124,138,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>{icon}</Typography>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
          <Chip label="Premium" size="small" color="secondary" sx={{ fontSize: '0.65rem', height: 20 }} />
        </Box>
        <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>

      <Collapse in={expanded}>
        {/* Help section */}
        <Box sx={{ mt: 1.5, mb: 1.5 }}>
          <Typography
            variant="caption"
            color="primary"
            sx={{ cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            onClick={(e) => { e.stopPropagation(); setHelpOpen(!helpOpen); }}
          >
            {helpOpen ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
            {helpOpen ? 'Hide help' : helpTitle}
          </Typography>
          <Collapse in={helpOpen}>
            <Box sx={{
              mt: 1, p: 1.5, borderRadius: '8px',
              bgcolor: isDark ? 'rgba(124,138,255,0.06)' : 'rgba(124,138,255,0.04)',
              border: `1px solid ${isDark ? 'rgba(124,138,255,0.1)' : 'rgba(124,138,255,0.08)'}`,
            }}>
              {helpContent.map((line, i) => (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: i < helpContent.length - 1 ? 0.75 : 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
                  {i + 1}. {line}
                </Typography>
              ))}
            </Box>
          </Collapse>
        </Box>

        {/* Feature content */}
        {children}
      </Collapse>
    </Box>
  );
}

const ShinedustFarmPanel = forwardRef(function ShinedustFarmPanel({ user, selectedAccountId, onEnabled }, ref) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [pendingExecId, setPendingExecId] = useState(null);
  const actionInFlight = useRef(false); // Guard: prevent socket race during enable/disable

  // Severity-aware auto-clear: errors linger longer than success confirmations
  useEffect(() => {
    if (!runResult) return;
    const ms = runResult.error ? 12000 : 5000;
    const timer = setTimeout(() => setRunResult(null), ms);
    return () => clearTimeout(timer);
  }, [runResult]);

  // Expose disableIfActive for mutual exclusion
  useImperativeHandle(ref, () => ({
    disableIfActive: async () => {
      if (status?.enabled) {
        try {
          const res = await fetch('/api/auto-gift/shinedust/disable', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: selectedAccountId }),
          });
          if (!res.ok) console.error('[Shinedust] disableIfActive failed:', res.status);
          await loadStatus(selectedAccountId);
        } catch (e) {
          console.error('[Shinedust] disableIfActive error:', e.message);
        }
      }
    }
  }), [status, selectedAccountId]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
  });

  const loadStatus = async (acctId, showSpinner = true) => {
    if (!acctId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/auto-gift/shinedust/status?accountId=${acctId}`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('[Shinedust] loadStatus error:', res.status, errData.error || '');
        setStatus(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error('[Shinedust] loadStatus fetch error:', e.message);
      setStatus(null);
    }
    setLoading(false); // ALWAYS clear loading
  };

  useEffect(() => {
    setRunResult(null);
    setPendingExecId(null);
    loadStatus(selectedAccountId);
  }, [selectedAccountId]);

  const handleEnable = async () => {
    if (!selectedAccountId) return;
    actionInFlight.current = true; // Guard socket handler
    const acctId = selectedAccountId;
    setActionLoading(true);
    try {
      // Mutual exclusion: disable Fill Missing first (may trigger parent re-render)
      if (onEnabled) await onEnabled();
      const res = await fetch('/api/auto-gift/shinedust/enable', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accountId: acctId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      // Optimistic: API confirmed enable is persisted (same pattern as Fill Missing fix)
      setStatus(prev => ({ ...(prev || {}), enabled: true }));
      setRunResult({ message: 'Enabled! Running first farm in background...' });
    } catch (e) {
      // Rollback: restore previous enabled state so UI doesn't show "Enabled" with error
      setStatus(prev => ({ ...(prev || {}), enabled: false }));
      setRunResult({ error: `Enable failed: ${e.message}` });
    }
    actionInFlight.current = false;
    setActionLoading(false);
  };

  const handleDisable = async () => {
    actionInFlight.current = true;
    setActionLoading(true);
    try {
      const res = await fetch('/api/auto-gift/shinedust/disable', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      // Optimistic: API confirmed disable is persisted
      setStatus(prev => ({ ...(prev || {}), enabled: false }));
      setRunResult(null);
      await loadStatus(selectedAccountId, false);
    } catch (e) {
      setRunResult({ error: `Disable failed: ${e.message}` });
    }
    actionInFlight.current = false;
    setActionLoading(false);
  };

  // Poll execution status as fallback when socket misses the result
  const pollExecStatus = useCallback(async (execId) => {
    try {
      const res = await fetch(`/api/auto-gift/execution-status?feature=shinedust&accountId=${selectedAccountId}`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const { execution } = await res.json();
      if (!execution || execution.id !== execId) return null;
      if (['completed', 'failed', 'skipped', 'timed_out'].includes(execution.status)) {
        return execution;
      }
      return null; // still running
    } catch { return null; }
  }, [selectedAccountId]);

  // Listen for shinedust result via socket (primary path)
  const isAutomaticActiveShine = useTabActive('automatic');
  useEffect(() => {
    // Hardening pass: skip subscribing when Automatic tab is hidden.
    // When the user comes back we re-subscribe and loadStatus catches up
    // any state that arrived while hidden.
    if (!isAutomaticActiveShine) return;
    const socket = getSocket();
    if (!socket) return;

    const handleResult = (data) => {
      // Ignore events from a different account (user may have switched)
      if (data.accountId && String(data.accountId) !== String(selectedAccountId)) return;
      // Skip if enable/disable is in flight — action handler owns the state (Phase 5C guard)
      if (actionInFlight.current) return;
      setRunResult({
        giftsSent: data.sent || 0,
        message: data.message || (data.sent > 0 ? `Sent ${data.sent} gift(s)` : 'No gifts sent'),
      });
      setActionLoading(false);
      setPendingExecId(null);
      loadStatus(selectedAccountId);
    };

    socket.on('shinedust-result', handleResult);
    return () => { socket.off('shinedust-result', handleResult); };
  }, [selectedAccountId, isAutomaticActiveShine]);

  // Fallback poll: if socket doesn't deliver within 15s, poll every 10s
  // Hardening pass: also guarded by tab visibility — a pendingExecId
  // stuck open from a prior tab visit must not keep hitting the
  // backend every 10 seconds while the tab is hidden.
  useEffect(() => {
    if (!pendingExecId) return;
    if (!isAutomaticActiveShine) return;  // guard: no poll while hidden
    let cancelled = false;

    const startPoll = setTimeout(async () => {
      const interval = setInterval(async () => {
        if (cancelled) { clearInterval(interval); return; }
        const done = await pollExecStatus(pendingExecId);
        if (done) {
          clearInterval(interval);
          if (cancelled) return;
          setRunResult({
            giftsSent: done.status === 'completed' ? 1 : 0,
            message: done.result_summary || done.error_message || done.status,
          });
          setActionLoading(false);
          setPendingExecId(null);
          loadStatus(selectedAccountId);
        }
      }, 10000);
      // Hard cap: stop polling after 3 min
      setTimeout(() => { clearInterval(interval); }, 180000);
    }, 15000); // wait 15s for socket before starting polls

    return () => { cancelled = true; clearTimeout(startPoll); };
  }, [pendingExecId, selectedAccountId, pollExecStatus, isAutomaticActiveShine]);

  // On mount: check if there's an active execution (handles refresh-during-run)
  useEffect(() => {
    (async () => {
      if (!selectedAccountId) return;
      try {
        const res = await fetch(`/api/auto-gift/execution-status?feature=shinedust&accountId=${selectedAccountId}`, {
          credentials: 'include', headers: getAuthHeaders(),
        });
        if (!res.ok) return;
        const { execution } = await res.json();
        if (execution && ['queued', 'running'].includes(execution.status)) {
          setActionLoading(true);
          setPendingExecId(execution.id);
          setRunResult({ message: 'Shinedust farm is running...' });
        }
      } catch { /* ignore mount check errors */ }
    })();
  }, [selectedAccountId]);

  const handleRunNow = async () => {
    setActionLoading(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/auto-gift/shinedust/run-now', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunResult({ error: data.error || data.message || `Server error (${res.status})` });
        setActionLoading(false);
      } else if (data.alreadyRunning) {
        setRunResult({ message: data.message || 'Already running' });
        // Don't clear actionLoading — poll for the existing run
        setPendingExecId(data.activeExecutionId || null);
      } else if (data.queued) {
        setRunResult({ message: data.message || 'Running shinedust farm...' });
        setPendingExecId(data.executionId || null);
      } else {
        setRunResult(data);
        setActionLoading(false);
      }
    } catch (e) {
      setRunResult({ error: e.message });
      setActionLoading(false);
    }
  };

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box>
      {status?.enabled ? (
        <Box>
          <Chip label="Enabled" color="success" size="small" sx={{ mb: 1 }} />
          {/* Phase 28 — summary-card truth. "Last attempt" covers any
              reached-the-gRPC-layer run (success or failure).
              "Last success" only renders when lastSuccessAt is
              populated (confirmed delivery). Today's gifts stay
              truthful — they come from shinedust_farm_log status=SUCCESS. */}
          <Typography variant="body2">
            Last attempt: {status.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : '—'}
            {' | '}Gifts today: {status.todayGiftsSent || 0}
            {' | '}Shinedust: {status.todayShinedustEarned || 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last success: {status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString() : '—'}
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={handleRunNow}
              disabled={actionLoading || !selectedAccountId}
            >
              {actionLoading ? <CircularProgress size={16} /> : 'Run Now'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleDisable}
              disabled={actionLoading || !selectedAccountId}
            >
              Disable
            </Button>
          </Box>
          {runResult && (
            <Typography variant="body2" color={runResult.giftsSent > 0 ? 'success.main' : 'warning.main'} sx={{ mt: 1 }}>
              {runResult.message || runResult.error}
            </Typography>
          )}
        </Box>
      ) : (
        <Box>
          <Chip label="Disabled" color="default" size="small" sx={{ mb: 1 }} />
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedAccountId
              ? 'Enable to start farming shinedust on this account.'
              : 'Select an account above, then enable to start farming shinedust.'}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={handleEnable}
            disabled={actionLoading || !selectedAccountId}
          >
            {!selectedAccountId ? 'Select Account First' : 'Enable Shinedust Farm'}
          </Button>
        </Box>
      )}
    </Box>
  );
});

const FillMissingPanel = forwardRef(function FillMissingPanel({ selectedAccountId, onEnabled }, ref) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [selectedPacks, setSelectedPacks] = useState([]);
  const actionInFlight = useRef(false); // Guard: prevent mount-effect loadStatus during enable/disable
  const [pendingExecId, setPendingExecId] = useState(null);

  // Severity-aware auto-clear: errors linger longer than success confirmations
  useEffect(() => {
    if (!sendResult) return;
    const ms = sendResult.error ? 12000 : 5000;
    const timer = setTimeout(() => setSendResult(null), ms);
    return () => clearTimeout(timer);
  }, [sendResult]);

  // Expose disableIfActive for mutual exclusion
  useImperativeHandle(ref, () => ({
    disableIfActive: async () => {
      if (status?.enabled) {
        try {
          const res = await fetch('/api/auto-gift/fill-missing/disable', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: selectedAccountId }),
          });
          if (!res.ok) console.error('[FillMissing] disableIfActive failed:', res.status);
          await loadStatus(selectedAccountId);
        } catch (e) {
          console.error('[FillMissing] disableIfActive error:', e.message);
        }
      }
    }
  }), [status, selectedAccountId]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
  });

  // loadStatus: fetches fill-missing status from backend.
  // showSpinner controls whether setLoading(true) fires at START (which causes unmount via the if(loading) guard).
  // setLoading(false) ALWAYS fires at the end so the component eventually renders.
  const loadStatus = async (acctId, showSpinner = true) => {
    if (!acctId) {
      setStatus(null);
      setSelectedPacks([]);
      setLoading(false);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/auto-gift/fill-missing/status?accountId=${acctId}`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('[FillMissing] loadStatus error:', res.status, errData.error || '');
        setStatus(null);
        setLoading(false);
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Non-JSON response');
      const data = await res.json();
      setStatus(data);
      if (data.setCodes) {
        setSelectedPacks(data.setCodes.split(',').map(s => s.trim()).filter(Boolean));
      } else {
        setSelectedPacks([]);
      }
    } catch (e) {
      console.error('[FillMissing] loadStatus fetch error:', e.message);
      setStatus(null);
    }
    setLoading(false); // ALWAYS clear loading so component renders
  };

  const loadPacks = async () => {
    setPacksLoading(true);
    try {
      const res = await fetch('/api/auto-gift/packs', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error('Non-JSON response');
      const data = await res.json();
      setPacks(data.packs || []);
    } catch (e) {
      console.error('[FillMissing] loadPacks error:', e.message);
    }
    setPacksLoading(false);
  };

  // Poll execution status as fallback
  const pollFillExecStatus = useCallback(async (execId) => {
    try {
      const res = await fetch(`/api/auto-gift/execution-status?feature=fill_missing&accountId=${selectedAccountId}`, {
        credentials: 'include', headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      const { execution } = await res.json();
      if (!execution || execution.id !== execId) return null;
      if (['completed', 'failed', 'skipped', 'timed_out'].includes(execution.status)) return execution;
      return null;
    } catch { return null; }
  }, [selectedAccountId]);

  // Listen for fill-missing result via socket (primary path)
  // Hardening pass: skip subscribing when Automatic tab is hidden; on
  // re-mount the loadStatus re-fetch catches up any state changes.
  const isAutomaticActiveFill = useTabActive('automatic');
  useEffect(() => {
    if (!isAutomaticActiveFill) return;
    const socket = getSocket();
    if (!socket) return;

    const handleResult = (data) => {
      // Ignore events from a different account (user may have switched)
      if (data.accountId && String(data.accountId) !== String(selectedAccountId)) return;
      // Skip if enable/disable is in flight — handleEnable/handleDisable owns the state
      if (actionInFlight.current) return;
      if (data.sent) {
        setSendResult({ message: data.message || `Sent "${data.cardName}"` });
      } else {
        setSendResult({ error: data.message || 'Could not send a card' });
      }
      setActionLoading(false);
      setPendingExecId(null);
      loadStatus(selectedAccountId, false);
    };

    socket.on('fill-missing-result', handleResult);
    return () => { socket.off('fill-missing-result', handleResult); };
  }, [selectedAccountId, isAutomaticActiveFill]);

  // Fallback poll: if socket doesn't deliver within 15s, poll every 10s
  // Hardening pass: guard by tab visibility so a stale pendingExecId
  // from a prior visit stops polling the backend when the user navigates
  // away.
  useEffect(() => {
    if (!pendingExecId) return;
    if (!isAutomaticActiveFill) return;
    let cancelled = false;

    const startPoll = setTimeout(async () => {
      const interval = setInterval(async () => {
        if (cancelled) { clearInterval(interval); return; }
        const done = await pollFillExecStatus(pendingExecId);
        if (done) {
          clearInterval(interval);
          if (cancelled) return;
          setSendResult({
            message: done.result_summary || done.error_message || done.status,
            sent: done.status === 'completed',
          });
          setActionLoading(false);
          setPendingExecId(null);
          if (!actionInFlight.current) loadStatus(selectedAccountId, false);
        }
      }, 10000);
      setTimeout(() => { clearInterval(interval); }, 120000);
    }, 15000);

    return () => { cancelled = true; clearTimeout(startPoll); };
  }, [pendingExecId, selectedAccountId, pollFillExecStatus, isAutomaticActiveFill]);

  useEffect(() => {
    setSendResult(null);
    setPendingExecId(null);
    // Clear stale data SYNCHRONOUSLY before async fetch — prevents ghost data flash.
    // setLoading(true) triggers the loading spinner, which is correct behavior:
    // the user should see a spinner, not the previous account's data.
    setStatus(null);
    if (!actionInFlight.current) {
      loadStatus(selectedAccountId);
    }
    loadPacks();
    // On mount: check for active execution (handles refresh-during-run)
    (async () => {
      if (!selectedAccountId) return;
      try {
        const res = await fetch(`/api/auto-gift/execution-status?feature=fill_missing&accountId=${selectedAccountId}`, {
          credentials: 'include', headers: getAuthHeaders(),
        });
        if (!res.ok) return;
        const { execution } = await res.json();
        if (execution && ['queued', 'running'].includes(execution.status)) {
          setActionLoading(true);
          setPendingExecId(execution.id);
          setSendResult({ message: 'Fill missing is running...' });
        }
      } catch { /* ignore mount check errors */ }
    })();
  }, [selectedAccountId]);

  const handleEnable = async () => {
    if (!selectedAccountId) return;
    actionInFlight.current = true; // Prevent mount-effect race
    const acctId = selectedAccountId;
    const packs = [...selectedPacks];
    const previousEnabled = status?.enabled ?? null;
    const t0 = Date.now();
    logEvent('autoGift.fillMissing.enable', { accountId: acctId, selectedPacks: packs, previousEnabled, phase: 'start' });
    setActionLoading(true);
    try {
      const res = await fetch('/api/auto-gift/fill-missing/enable', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          accountId: acctId,
          setCodes: packs.length > 0 ? packs : null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      logEvent('autoGift.fillMissing.enable', { accountId: acctId, previousEnabled, newEnabled: true, phase: 'api_success', latencyMs: Date.now() - t0 });
      // Disable sibling feature AFTER our enable is persisted (mutual exclusion)
      if (onEnabled) await onEnabled();
      // Optimistic: API confirmed enable is persisted — set status immediately so chip agrees with message.
      // Socket event will refresh full data when background task completes. No loadStatus() here
      // to avoid race condition where fetch returns stale data and overwrites optimistic state.
      setStatus(prev => ({ ...(prev || {}), enabled: true }));
      setSendResult({ message: 'Enabled! Running first fill in background...' });
    } catch (e) {
      logEvent('autoGift.fillMissing.enable', { accountId: acctId, previousEnabled, phase: 'error', error: e.message }, 'error');
      // Rollback: restore previous enabled state so UI doesn't show "Enabled" with error
      setStatus(prev => ({ ...(prev || {}), enabled: previousEnabled ?? false }));
      setSendResult({ error: `Enable failed: ${e.message}` });
    }
    actionInFlight.current = false;
    setActionLoading(false);
  };

  const handleDisable = async () => {
    actionInFlight.current = true;
    setActionLoading(true);
    try {
      const res = await fetch('/api/auto-gift/fill-missing/disable', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP ${res.status}`);
      }
      // Optimistic: API confirmed disable is persisted. No loadStatus() — avoids race condition.
      setStatus(prev => ({ ...(prev || {}), enabled: false }));
      setSendResult(null);
    } catch (e) {
      setSendResult({ error: `Disable failed: ${e.message}` });
    }
    actionInFlight.current = false;
    setActionLoading(false);
  };

  const handleSendNow = async () => {
    setActionLoading(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/auto-gift/fill-missing', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendResult({ error: data.error || data.message || `Server error (${res.status})` });
        setActionLoading(false);
      } else if (data.alreadyRunning) {
        setSendResult({ message: data.message || 'Already running' });
        setPendingExecId(data.activeExecutionId || null);
      } else if (data.queued) {
        setSendResult({ message: data.message || 'Processing...' });
        setPendingExecId(data.executionId || null);
      } else {
        setSendResult(data);
        setActionLoading(false);
      }
    } catch (e) {
      setSendResult({ error: e.message });
      setActionLoading(false);
    }
  };

  const handleUpdatePacks = async (newPacks) => {
    setSelectedPacks(newPacks);
    // Auto-save pack selection if already enabled
    if (status?.enabled) {
      try {
        const res = await fetch('/api/auto-gift/fill-missing/update-packs', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders(),
          body: JSON.stringify({ setCodes: newPacks.length > 0 ? newPacks : null, accountId: selectedAccountId }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('[FillMissing] updatePacks error:', errData.error || res.status);
          setSendResult({ error: `Pack filter update failed: ${errData.error || 'unknown error'}` });
        }
      } catch (e) {
        console.error('[FillMissing] updatePacks fetch error:', e.message);
      }
    }
  };

  const togglePack = (setCode) => {
    const newPacks = selectedPacks.includes(setCode)
      ? selectedPacks.filter(s => s !== setCode)
      : [...selectedPacks, setCode];
    handleUpdatePacks(newPacks);
  };

  if (loading) return <CircularProgress size={24} />;

  return (
    <Box>
      {/* Pack Filter — multi-select dropdown */}
      <Autocomplete
        multiple
        size="small"
        options={packs}
        loading={packsLoading}
        value={packs.filter(p => selectedPacks.includes(p.expansion_id))}
        getOptionLabel={(option) => option.expansion_name || option.expansion_id}
        isOptionEqualToValue={(option, value) => option.expansion_id === value.expansion_id}
        onChange={(e, newValue) => handleUpdatePacks(newValue.map(v => v.expansion_id))}
        disableCloseOnSelect
        renderOption={(props, option, { selected }) => (
          <li {...props}>
            <Checkbox
              icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
              checkedIcon={<CheckBoxIcon fontSize="small" />}
              style={{ marginRight: 8 }}
              checked={selected}
            />
            {option.expansion_name || option.expansion_id}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Pack Filter"
            placeholder={selectedPacks.length === 0 ? 'All packs (click to filter)' : ''}
            helperText="Leave empty to fill from all packs, or select specific ones"
          />
        )}
        sx={{ mb: 2, maxWidth: 500 }}
      />

      {status?.enabled ? (
        <Box>
          <Chip label="Enabled" color="success" size="small" sx={{ mb: 1 }} />
          {/* Phase 28 — summary-card truth.
              "Last attempt" = lastAttemptAt (falls back to lastRunAt for
              legacy rows pre-Phase-27). Covers success AND failure.
              "Total sent" = confirmedSendCount (Phase 27 truth metric),
              falls back to totalCardsSent only for legacy rows.
              "Last card" = lastConfirmedCard ONLY — never
              lastCardSent, which captures the attempted candidate on
              failure (reported-Greninja-ex symptom). Empty dash when
              no confirmed delivery exists. */}
          <Typography variant="body2">
            Last attempt: {(status.lastAttemptAt || status.lastRunAt)
              ? new Date(status.lastAttemptAt || status.lastRunAt).toLocaleString()
              : '—'}
            {' | '}Total sent: {status.confirmedSendCount ?? status.totalCardsSent ?? 0}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last success: {status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleString() : '—'}
            {' | '}Last card: {status.lastConfirmedCard || '—'}
          </Typography>
          {status.lastAttemptStatus && status.lastAttemptStatus !== 'confirmed' && (
            <Chip
              size="small"
              sx={{ mt: 0.5 }}
              label={`Last attempt: ${status.lastAttemptStatus}`}
              color={status.lastAttemptStatus === 'skipped' ? 'default'
                   : status.lastAttemptStatus === 'awaiting_acceptance' ? 'info'
                   : 'warning'}
            />
          )}
          {status.todayGift && (
            <Typography variant="body2" color="info.main" sx={{ mt: 0.5 }}>
              Today: {status.todayGift.card_name} ({status.todayGift.status})
            </Typography>
          )}
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={handleSendNow}
              disabled={actionLoading || !selectedAccountId}
            >
              {actionLoading ? <CircularProgress size={16} /> : 'Send 1 Now'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={handleDisable}
              disabled={actionLoading || !selectedAccountId}
            >
              Disable
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          <Chip label="Disabled" color="default" size="small" sx={{ mb: 1 }} />
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedAccountId
              ? 'Choose packs to fill from (or leave empty for all), then enable.'
              : 'Select an account above, choose packs to fill from, then enable.'}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={handleEnable}
            disabled={actionLoading || !selectedAccountId}
          >
            {actionLoading ? <CircularProgress size={16} /> : (!selectedAccountId ? 'Select Account First' : 'Enable Fill Missing Cards')}
          </Button>
        </Box>
      )}
      {/* Single sendResult render location — outside enabled/disabled conditional */}
      {sendResult && (
        <Typography variant="body2" color={sendResult.error ? 'error.main' : 'success.main'} sx={{ mt: 1 }}>
          {sendResult.error || sendResult.message}
        </Typography>
      )}
    </Box>
  );
});

// ─────────────────── Automatic Scheduled Sharing tab ───────────────────

/**
 * Wave B — Automatic tab.
 *
 * Three sections in this exact order (product spec):
 *   1. Fill Missing Cards  → existing FillMissingPanel (mutex with Shinedust)
 *   2. Shinedust Farm       → existing ShinedustFarmPanel (mutex with Fill)
 *   3. Specific Card Sharing → new rotation feature, independent of mutex
 *
 * Fill Missing + Shinedust are reused verbatim from AutoGiftPremiumFeatures.
 * Premium gate preserved — non-premium users see an upgrade prompt.
 * Specific Card Sharing works for any authenticated user (backend does
 * not require premium tier).
 */
function AutomaticSharingTab({ user }) {
  const { selectedAccountId } = useAccount();

  // Gate uses the SAME shape as TierGuard (canonical `subscriptionTier`
  // camelCase) plus explicit admin fallbacks. Prior code used
  // `subscription_tier` (snake_case, the DB form) which is never present
  // on the user object the client receives — that made this gate always
  // read false, hiding both premium panels from admins AND premium users.
  //
  // Effective gate (per product):  isPremium || isAdmin
  const tier = user?.subscriptionTier || 'free';
  const isAdmin = tier === 'admin' || user?.isAdmin === true || user?.is_admin === 1 || user?.is_admin === true;
  const isPremium = tier === 'premium' || isAdmin;
  const canUsePremiumSharing = isPremium;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {!canUsePremiumSharing && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: '10px' }}>
          <Typography variant="body2">
            Fill Missing Cards and Shinedust Farm require a Premium subscription.
            Specific Card Sharing is available to all accounts below.
          </Typography>
        </Alert>
      )}

      {/* Sections 1 + 2: existing premium features, reordered (Fill first).
          Admins pass through the same gate via the isAdmin fallback. */}
      {canUsePremiumSharing && (
        <AutoGiftPremiumFeatures user={user} selectedAccountId={selectedAccountId} />
      )}

      {/* Section 3 (new): Specific Card Sharing rotation */}
      <SpecificCardSharingSection selectedAccountId={selectedAccountId} />
    </Box>
  );
}

// ─────────────────── Specific Card Sharing (NEW) ───────────────────

/**
 * Wave B — third section under Automatic Scheduled Sharing.
 *
 * Users pick a set of card IDs, a rotation mode, and a schedule. The
 * rule is persisted via /api/sharing-rules (type = 'gift_specific_rotation').
 * A "Run now" action advances the rotation cursor (or picks a random
 * card for random mode) and returns the selected card without actually
 * sending — Phase 22.b provides a preview contract; actual gift dispatch
 * integration is deferred.
 */
function SpecificCardSharingSection({ selectedAccountId }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(null);  // { mode:'create'|'edit', draft }
  // Phase 23D — recommendations panel state
  const [recommendations, setRecommendations] = useState([]);
  const [dismissedRecIds, setDismissedRecIds] = useState(() => {
    try {
      const raw = localStorage.getItem('sharingRecsDismissed');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const persistDismissed = (ids) => {
    try { localStorage.setItem('sharingRecsDismissed', JSON.stringify([...ids])); } catch {}
  };

  // ─── Pack-picker state (hoisted so the dialog can read it) ───
  // The new UX replaces the raw card-ID textarea with a pack-first
  // searchable picker. Packs are loaded once; cards are loaded per
  // selected pack. Both reuse the same /api/auto-gift endpoints the
  // Manual tab already depends on — no new API.
  const [availablePacks, setAvailablePacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [availableCards, setAvailableCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  // currently-picked pack for the dialog. Separate from draft because
  // the pack choice is a UI concern only (we don't persist pack id on
  // the rule — we persist resolved card ids). If the user changes pack,
  // already-selected cards from other packs remain (cross-pack rotations
  // are allowed).
  const [dialogPack, setDialogPack] = useState(null);

  const loadRules = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetchWithAuth('/sharing-rules');
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to load');
      setRules((data.rules || []).filter(x => x.type === 'gift_specific_rotation'));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadRules(); }, [loadRules]);

  // Phase 23D — load recommendations once per section mount, refresh
  // whenever rules change (so accepting/ignoring a suggestion updates
  // the panel naturally).
  const loadRecommendations = useCallback(async () => {
    try {
      // Phase 23D — /sharing-recommendations (not /recommendations —
      // that path is owned by a pre-existing rule engine).
      const r = await fetchWithAuth('/sharing-recommendations');
      const data = await r.json();
      if (r.ok) setRecommendations(data.recommendations || []);
    } catch { /* non-fatal — recommendations are advisory */ }
  }, []);
  useEffect(() => { loadRecommendations(); }, [loadRecommendations, rules.length]);

  const dismissRecommendation = (id) => {
    setDismissedRecIds(prev => {
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  };
  const visibleRecommendations = recommendations.filter(r => !dismissedRecIds.has(r.id));

  // Lazy-load packs the first time the dialog opens. Cached across dialog
  // reopens so a user who creates multiple rotations doesn't refetch.
  const ensurePacksLoaded = useCallback(async () => {
    if (availablePacks.length > 0 || packsLoading) return;
    setPacksLoading(true);
    try {
      const result = await autoGift.getPacks();
      setAvailablePacks(result.packs || []);
    } catch (e) { setError(`Failed to load packs: ${e.message}`); }
    finally { setPacksLoading(false); }
  }, [availablePacks.length, packsLoading]);

  // Load cards for the currently selected pack. availableOnly=false so
  // the picker shows ALL cards in the pack (sharing isn't
  // ownership-filtered — the bot inventory handles that at send time).
  useEffect(() => {
    if (!dialogPack) { setAvailableCards([]); return; }
    let cancelled = false;
    (async () => {
      setCardsLoading(true);
      try {
        const result = await autoGift.getCards(dialogPack.expansion_id || dialogPack.set_code || dialogPack.id, false, null);
        if (cancelled) return;
        setAvailableCards(result.cards || []);
      } catch (e) {
        if (!cancelled) setError(`Failed to load cards: ${e.message}`);
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dialogPack]);

  // Resolve legacy card-id-only rules on edit so users see card names,
  // not UUIDs. Non-blocking — the dialog opens immediately with raw IDs
  // visible and names fill in as each lookup resolves. Cards that fail
  // to resolve (e.g. removed from the game) keep their raw ID chip with
  // a subdued "unknown card" label; users can still remove them.
  const resolveLegacyCards = useCallback(async (cards) => {
    const unresolved = (cards || []).filter(c => c && c.cardId && !c.cardName);
    if (unresolved.length === 0) return cards;
    const lookups = await Promise.all(unresolved.map(async (c) => {
      try {
        const info = await autoGift.getCardInfo(c.cardId);
        return { ...c, cardName: info?.card?.name || info?.name || null,
                      rarity: info?.card?.rarity || info?.rarity || null,
                      pack: info?.card?.pack || info?.pack || null };
      } catch { return c; }  // keep raw ID on failure
    }));
    const byId = new Map(lookups.map(x => [x.cardId, x]));
    return (cards || []).map(c => byId.get(c.cardId) || c);
  }, []);

  const openCreate = () => {
    setDialog({
      mode: 'create',
      draft: {
        name: '',
        type: 'gift_specific_rotation',
        config: { cards: [], mode: 'sequential', cursor: 0, dailyLimit: null },
        schedule: { intervalHours: 24, timezone: 'UTC' },
        priority: 0,
        enabled: true,
      },
    });
    setDialogPack(null);
    setCardSearch('');
    ensurePacksLoaded();
  };
  const openEdit = async (r) => {
    const draftClone = JSON.parse(JSON.stringify(r));
    // Open immediately with whatever we have, then enrich with resolved names.
    setDialog({ mode: 'edit', draft: draftClone });
    setDialogPack(null);
    setCardSearch('');
    ensurePacksLoaded();
    const enriched = await resolveLegacyCards(draftClone.config?.cards || []);
    // Only update if the dialog is still open on the same rule.
    setDialog((current) => {
      if (!current || current.draft.id !== draftClone.id) return current;
      return { ...current, draft: { ...current.draft, config: { ...current.draft.config, cards: enriched } } };
    });
  };

  const saveRule = async () => {
    if (!dialog) return;
    const d = dialog.draft;
    // Basic validation: at least one card ID, sensible name.
    const cards = (d.config?.cards || []).filter(c => c && c.cardId);
    if (cards.length === 0) { setError('Add at least one card ID'); return; }
    setSaving(true); setError('');
    try {
      const path = dialog.mode === 'create' ? '/sharing-rules' : `/sharing-rules/${d.id}`;
      const method = dialog.mode === 'create' ? 'POST' : 'PATCH';
      const payload = { ...d, config: { ...d.config, cards } };
      const r = await fetchWithAuth(path, { method, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      // Fix 5 — structured log for rule lifecycle. Phase 23 automation
      // dashboards will subscribe to these events to audit rule churn.
      sharingLog(dialog.mode === 'create' ? 'rule_created' : 'rule_updated', {
        ruleId: data.rule?.id ?? d.id ?? null,
        type: 'gift_specific_rotation',
        mode: d.config?.mode || 'sequential',
        intervalHours: d.schedule?.intervalHours || 24,
        cardCount: cards.length,
      });
      setDialog(null);
      loadRules();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const deleteRule = async (id) => {
    try {
      const r = await fetchWithAuth(`/sharing-rules/${id}`, { method: 'DELETE' });
      if (r.ok) {
        sharingLog('rule_deleted', { ruleId: id });
        loadRules();
      }
    } catch (e) { setError(e.message); }
  };

  const toggleEnabled = async (rule) => {
    try {
      const r = await fetchWithAuth(`/sharing-rules/${rule.id}`, {
        method: 'PATCH', body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (r.ok) {
        sharingLog('rule_toggled', { ruleId: rule.id, enabled: !rule.enabled });
        loadRules();
      }
    } catch (e) { setError(e.message); }
  };

  // Phase 25F — "Run now" now ACTUALLY dispatches (via the shared
  // scheduler.evaluateRule path). Outcome is surfaced to the user
  // immediately via setError / success message based on the canonical
  // { outcome, reason } response shape. No more silent cursor advances.
  const runNow = async (rule) => {
    try {
      setError('');
      const r = await fetchWithAuth(`/sharing-rules/${rule.id}/run`, {
        method: 'POST', body: JSON.stringify({}),
      });
      const data = await r.json();

      // HTTP 502 is the dispatch-failed case (evaluateRule threw
      // downstream). HTTP 200 covers dispatched / skipped — we still
      // inspect outcome to know which.
      if (!r.ok && data?.outcome !== 'failed') {
        throw new Error(data.error || 'Run failed');
      }

      // Human-readable feedback per outcome.
      const card = data.cardId || data.pickedCardId || data.pickedCard?.cardName;
      if (data.outcome === 'dispatched') {
        // Success — surface the actual sent card so users can verify.
        setError('');
        if (typeof setSuccess === 'function') {
          setSuccess(`Sent ${card || 'gift'} — rule #${rule.id}`);
        }
      } else if (data.outcome === 'skipped') {
        setError(`Skipped — ${data.reason || 'not eligible right now'}`);
      } else if (data.outcome === 'failed') {
        setError(`Failed — ${data.reason || data.error || 'dispatch error'}`);
      } else if (data.outcome === 'preview') {
        setError(`Preview only — selected ${card || 'card'}, no gift dispatched`);
      }

      sharingLog('rule_run_manual', {
        ruleId: rule.id,
        mode: rule.config?.mode,
        outcome: data.outcome,
        reason: data.reason,
        cardId: data.cardId || data.pickedCardId || null,
        requestId: data.requestId,
      });
      loadRules();
    } catch (e) { setError(e.message); }
  };

  return (
    <Box sx={{
      mb: 2, p: 2.5, borderRadius: '12px',
      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      border: `1px solid ${isDark ? 'rgba(124,138,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem' }}>🎯</Typography>
          <Typography variant="subtitle2" fontWeight={700}>Specific Card Sharing</Typography>
          <Chip label="New" size="small" color="success" sx={{ fontSize: '0.65rem', height: 20 }} />
        </Box>
        <Button size="small" variant="contained" onClick={openCreate} startIcon={<PersonAddIcon />}>
          New rotation
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.85rem' }}>
        Pick specific cards and rotate them on a schedule. Independent of Fill Missing /
        Shinedust Farm — rotations run on their own interval and do not count against the
        1-gift-per-day mutual exclusion.
      </Typography>

      {/* Phase 23D — Recommendations panel. Proactive suggestions
          driven by drift findings + last_result analysis. NEVER
          auto-apply — every item is an advisory chip with a dismiss
          button. Dismissals persist in localStorage per-browser. */}
      {visibleRecommendations.length > 0 && (
        <Box sx={{
          mb: 1.5, p: 1.5, borderRadius: '8px',
          bgcolor: isDark ? 'rgba(124,138,255,0.06)' : 'rgba(124,138,255,0.04)',
          border: `1px solid ${isDark ? 'rgba(124,138,255,0.2)' : 'rgba(124,138,255,0.15)'}`,
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
            SUGGESTIONS ({visibleRecommendations.length})
          </Typography>
          <Stack spacing={0.75}>
            {visibleRecommendations.slice(0, 5).map((r) => {
              const sevColor =
                r.severity === 'error' ? 'error' :
                r.severity === 'warning' ? 'warning' : 'info';
              return (
                <Alert
                  key={r.id}
                  severity={sevColor}
                  variant="outlined"
                  sx={{ py: 0.5, borderRadius: '6px' }}
                  onClose={() => dismissRecommendation(r.id)}
                >
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    <Chip size="small" label={r.type.replace('_', ' ').toLowerCase()} sx={{ mr: 1, height: 18, fontSize: '0.65rem' }} />
                    {r.message}
                  </Typography>
                </Alert>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Phase 23A — executor is now wired. The backend scheduler runs
          hourly and dispatches gifts via the same pipeline used by the
          Manual tab (matchService.createGiftRequest → giftExecutor).
          Subject to the game's 1-gift-per-day-per-account limit; if
          all accounts are at the cap, the rule is skipped for the day
          and retries on the next tick. */}
      <Alert severity="success" variant="outlined" sx={{ mb: 1.5, borderRadius: '8px' }}>
        <Typography variant="body2">
          <strong>Automation live.</strong>
          {' '}Enabled rules run on their configured interval and dispatch
          real gifts through the shared executor. Each run records an
          explicit outcome — <strong>sent</strong>, <strong>skipped</strong>
          {' '}(with reason), or <strong>failed</strong> — so you can tell
          at a glance whether a gift was actually delivered. "Run now"
          dispatches immediately; use the eye icon for a cursor-only
          preview.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <CircularProgress size={18} />
      ) : rules.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          No rotations configured yet. Click "New rotation" to create one.
        </Typography>
      ) : (
        <List dense sx={{ pl: 0 }}>
          {rules.map((rule) => {
            const cards = rule.config?.cards || [];
            const modeLabel = rule.config?.mode === 'random' ? 'Random' : 'Sequential';
            const intervalH = rule.schedule?.intervalHours || 24;
            // Phase 23A — execution status chip + next-run estimate.
            // last_result shape from the scheduler:
            //   { ok, outcome: 'dispatched'|'skipped'|'failed', reason?, ... }
            const lastOutcome = rule.last_result?.outcome;
            const lastReason = rule.last_result?.reason;
            const lastCard = rule.last_result?.pickedCardName
              || rule.last_result?.pickedCardId
              || rule.last_result?.pickedCard?.cardId
              || null;
            const statusColor =
              lastOutcome === 'dispatched' ? 'success' :
              lastOutcome === 'failed' ? 'error' :
              lastOutcome === 'skipped' ? 'warning' :
              lastOutcome === 'preview' ? 'info' : 'default';
            // Phase 23B — friendlier reason labels for priority-engine
            // skips so users see WHY a rotation didn't fire today.
            const friendlyReason = (outcome, reason, result) => {
              if (!reason) return '';
              if (reason === 'blocked_by_priority') {
                const by = result?.blockedBy;
                return by === 'fill_missing' ? 'higher priority: Fill Missing ran today'
                  : by === 'shinedust' ? 'higher priority: Shinedust'
                  : 'higher priority automation ran today';
              }
              if (reason === 'daily_limit_all_accounts') return 'daily gift limit — tomorrow';
              if (reason === 'card_unavailable') return 'no bot has this card right now';
              if (reason === 'no_active_accounts') return 'no active accounts';
              return reason;
            };
            // Phase 25F — explicit outcome labels. "preview" is now a
            // distinct state (was previously indistinguishable from
            // success because the old /run handler always returned
            // ok:true without dispatching). Each state gets its own
            // chip color so users can tell at a glance whether a gift
            // actually went out.
            const statusLabel =
              lastOutcome === 'dispatched' ? 'sent' :
              lastOutcome === 'preview'    ? 'preview only' :
              lastOutcome === 'skipped'
                ? `skipped${lastReason ? ` — ${friendlyReason('skipped', lastReason, rule.last_result)}` : ''}`
                : lastOutcome === 'failed'
                  ? `failed${lastReason ? ` — ${friendlyReason('failed', lastReason, rule.last_result)}` : ''}`
                  : null;
            const nextRunAt = rule.enabled && rule.last_run_at
              ? new Date(new Date(rule.last_run_at).getTime() + intervalH * 3600_000)
              : null;
            const nextRunLabel = !rule.enabled
              ? 'paused'
              : rule.last_run_at
                ? (nextRunAt <= new Date() ? 'due now (next tick)' : nextRunAt.toLocaleString())
                : 'on next tick';
            // Phase 23C — auto-paused rules (drift engine intervened)
            // carry a distinctive outcome + drift note in last_result.
            // Surface with an info chip so the user knows WHY it's paused.
            const isAutoPaused = rule.last_result?.outcome === 'auto_paused';
            const autoPauseDrift = rule.last_result?.drift || null;
            const autoPauseRecommendation = rule.last_result?.recommendation || null;
            return (
              <ListItem key={rule.id} sx={{ pl: 0, pr: 0, flexWrap: 'wrap' }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {rule.name || `Rotation #${rule.id}`}
                      </Typography>
                      <Chip size="small" label={modeLabel} variant="outlined" />
                      <Chip size="small" label={`${cards.length} card${cards.length === 1 ? '' : 's'}`} variant="outlined" />
                      <Chip size="small" label={`every ${intervalH}h`} variant="outlined" />
                      {statusLabel && (
                        <Chip size="small" label={statusLabel} color={statusColor} variant="filled" sx={{ maxWidth: 260 }} />
                      )}
                      {/* Phase 23C — drift auto-pause chip. Distinct from
                          manual disable so users see the rule was paused
                          BY THE SYSTEM and why. */}
                      {isAutoPaused && (
                        <Tooltip title={autoPauseRecommendation || 'Automatically paused due to drift — review the rule before re-enabling'}>
                          <Chip
                            size="small"
                            label={`auto-paused: ${autoPauseDrift || 'drift'}`}
                            color="warning"
                            variant="filled"
                          />
                        </Tooltip>
                      )}
                      {!rule.enabled && !isAutoPaused && <Chip size="small" label="disabled" color="default" variant="outlined" />}
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                      {rule.last_run_at
                        ? `last run ${new Date(rule.last_run_at).toLocaleString()}`
                        : 'never run'}
                      {/* Phase 25F — outcome-specific verb so users
                          can tell whether a gift was actually sent.
                          Before: "picked X" was shown for ALL outcomes
                          including preview + skipped + failed, making
                          it impossible to know what happened. */}
                      {lastCard && ' · '}
                      {lastCard && (
                        lastOutcome === 'dispatched'
                          ? `sent ${lastCard}`
                          : lastOutcome === 'preview'
                          ? `preview selected ${lastCard} (no gift sent)`
                          : lastOutcome === 'skipped'
                          ? `would have picked ${lastCard} — skipped`
                          : lastOutcome === 'failed'
                          ? `failed after selecting ${lastCard}`
                          : `picked ${lastCard}`
                      )}
                      {' · next: '}
                      <Typography component="span" variant="caption" sx={{ fontWeight: 500 }}>
                        {nextRunLabel}
                      </Typography>
                    </Typography>
                  }
                />
                <Tooltip title={rule.enabled ? 'Disable' : 'Enable'}>
                  <IconButton size="small" onClick={() => toggleEnabled(rule)}>
                    {rule.enabled ? <CheckBoxIcon fontSize="small" /> : <CheckBoxOutlineBlankIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Run now — actually dispatches the gift">
                  <span><IconButton size="small" onClick={() => runNow(rule)} disabled={!rule.enabled}>
                    <RefreshIcon fontSize="small" />
                  </IconButton></span>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => openEdit(rule)}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => deleteRule(rule.id)}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      )}

      {/* Create / edit dialog — Pack-first searchable card picker.
          Replaces the prior raw-cardId textarea. Users never need to know
          or paste a cardId; selections persist as {cardId, cardName, rarity}
          under config.cards. Backward compatible: legacy rules stored as
          [{cardId}] only are resolved via autoGift.getCardInfo on edit. */}
      <Dialog open={!!dialog} onClose={() => !saving && setDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog?.mode === 'edit' ? 'Edit rotation' : 'New rotation'}</DialogTitle>
        {dialog && (() => {
          const d = dialog.draft;
          const setDraft = (patch) => setDialog({ ...dialog, draft: { ...d, ...patch } });
          const setConfig = (patch) => setDraft({ config: { ...(d.config || {}), ...patch } });
          const setSchedule = (patch) => setDraft({ schedule: { ...(d.schedule || {}), ...patch } });
          const selectedCards = d.config?.cards || [];
          const selectedIds = new Set(selectedCards.map(c => c.cardId));
          const cardIdOf = (c) => c?.card_id || c?.backend_id || c?.id || null;
          const cardNameOf = (c) => c?.name || c?.card_name || c?.title || '';
          const cardRarityOf = (c) => c?.rarity || c?.rarity_code || null;
          // Filter the pack's cards by the current search text and
          // exclude anything already in the rotation so users can't
          // double-add.
          const filteredCards = (() => {
            const q = cardSearch.trim().toLowerCase();
            return availableCards
              .filter(card => {
                const id = cardIdOf(card);
                if (!id || selectedIds.has(id)) return false;
                if (!q) return true;
                return cardNameOf(card).toLowerCase().includes(q);
              })
              .slice(0, 60);  // cap render cost; scroll if more
          })();
          const addCard = (card) => {
            const id = cardIdOf(card);
            if (!id || selectedIds.has(id)) return;
            setConfig({
              cards: [
                ...selectedCards,
                { cardId: id, cardName: cardNameOf(card), rarity: cardRarityOf(card) },
              ],
            });
            setCardSearch('');  // reset search so user can type the next card
          };
          const removeCard = (cardId) => {
            setConfig({ cards: selectedCards.filter(c => c.cardId !== cardId) });
          };
          return (
            <>
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                  <TextField
                    label="Name"
                    value={d.name || ''}
                    onChange={(e) => setDraft({ name: e.target.value })}
                    size="small"
                    placeholder="e.g. Favorite EX cards"
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                      <InputLabel>Rotation mode</InputLabel>
                      <Select
                        label="Rotation mode"
                        value={d.config?.mode || 'sequential'}
                        onChange={(e) => setConfig({ mode: e.target.value, cursor: 0 })}
                      >
                        <MenuItem value="sequential">Sequential</MenuItem>
                        <MenuItem value="random">Random</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                      <InputLabel>Schedule</InputLabel>
                      <Select
                        label="Schedule"
                        value={d.schedule?.intervalHours || 24}
                        onChange={(e) => setSchedule({ intervalHours: e.target.value })}
                      >
                        <MenuItem value={6}>Every 6 hours</MenuItem>
                        <MenuItem value={12}>Every 12 hours</MenuItem>
                        <MenuItem value={24}>Daily (24 hours)</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Pack selector — required. User must pick a pack
                      before the card search becomes active. */}
                  <Autocomplete
                    size="small"
                    options={availablePacks}
                    loading={packsLoading}
                    value={dialogPack}
                    onChange={(_, v) => setDialogPack(v)}
                    getOptionLabel={(p) => p?.name || p?.expansion_name || p?.set_code || ''}
                    isOptionEqualToValue={(a, b) => (a?.expansion_id || a?.set_code) === (b?.expansion_id || b?.set_code)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Pack (required)"
                        placeholder={packsLoading ? 'Loading packs…' : 'Select a pack first'}
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (<>
                            {packsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>),
                        }}
                      />
                    )}
                  />

                  {/* Card search — gated on pack selection. Dropdown of
                      filtered options; clicking one adds it to the list
                      and clears the search. */}
                  <Autocomplete
                    size="small"
                    disabled={!dialogPack}
                    loading={cardsLoading}
                    options={filteredCards}
                    inputValue={cardSearch}
                    onInputChange={(_, v, reason) => {
                      // Don't clear on blur — let the user see what they typed.
                      if (reason !== 'reset') setCardSearch(v);
                    }}
                    // No "value" — the field is a picker, not a bound value.
                    value={null}
                    onChange={(_, card) => {
                      if (card) addCard(card);
                    }}
                    clearOnBlur={false}
                    getOptionLabel={(c) => c ? cardNameOf(c) : ''}
                    isOptionEqualToValue={(a, b) => cardIdOf(a) === cardIdOf(b)}
                    renderOption={(props, card) => (
                      <li {...props} key={cardIdOf(card)}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <Typography variant="body2" sx={{ flex: 1 }}>{cardNameOf(card)}</Typography>
                          {cardRarityOf(card) && (
                            <Chip size="small" label={cardRarityOf(card)} variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                          )}
                        </Box>
                      </li>
                    )}
                    noOptionsText={
                      !dialogPack ? 'Select a pack first' :
                      cardsLoading ? 'Loading cards…' :
                      cardSearch ? `No cards match "${cardSearch}"` :
                      availableCards.length === 0 ? 'No cards in this pack' :
                      'Start typing to search'
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search cards"
                        placeholder={!dialogPack ? 'Select a pack first' : 'Type a card name'}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                          endAdornment: (<>
                            {cardsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>),
                        }}
                      />
                    )}
                  />

                  {/* Selected cards — chips with remove. */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      Selected cards ({selectedCards.length})
                    </Typography>
                    {selectedCards.length === 0 ? (
                      <Typography variant="caption" color="text.disabled">
                        No cards selected yet. Pick a pack above, then search a card to add it.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {selectedCards.map((c) => {
                          const isLegacyUnresolved = !c.cardName;
                          const label = c.cardName || c.cardId;
                          return (
                            <Chip
                              key={c.cardId}
                              label={
                                <span>
                                  {label}
                                  {c.rarity ? ` · ${c.rarity}` : ''}
                                  {isLegacyUnresolved ? ' · unknown card' : ''}
                                </span>
                              }
                              onDelete={() => removeCard(c.cardId)}
                              size="small"
                              variant={isLegacyUnresolved ? 'outlined' : 'filled'}
                              color={isLegacyUnresolved ? 'default' : 'primary'}
                              sx={{ maxWidth: '100%' }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDialog(null)} disabled={saving}>Cancel</Button>
                <Button
                  variant="contained"
                  onClick={saveRule}
                  disabled={saving || selectedCards.length === 0}
                >
                  {saving ? <CircularProgress size={16} /> : (dialog.mode === 'edit' ? 'Save' : 'Create')}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Box>
  );
}
