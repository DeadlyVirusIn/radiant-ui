/**
 * TradeRequestCard Component
 * Displays a single trade request with status and countdown timer
 * Includes card picker UI for PICK_CARD state
 */

import { useState, useEffect } from 'react';
import { useTicker } from '../hooks/useTicker';
import { getErrorDisplay, ERROR_GROUP_LABELS } from '../utils/errorDisplay';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  LinearProgress,
  Collapse,
  Tooltip,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import StatusIndicator from './StatusIndicator';
import RequestTimeline from './RequestTimeline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import StyleIcon from '@mui/icons-material/Style';
import { RARITY_COLORS } from '../constants/gameData';
import { autoTrade } from '../services/api';
import { useRequestAge } from '../hooks/useRequestAge';
import { getCardRetryProbability } from '../hooks/useNextAction';

// Status configurations (default = auto mode)
const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'default',
    icon: HourglassEmptyIcon,
    description: 'Waiting to be processed...',
  },
  QUEUED: {
    label: 'Queued',
    color: 'info',
    icon: HourglassEmptyIcon,
    description: 'Waiting for another user\'s gift or trade to finish...',
  },
  MATCHING: {
    label: 'Matching',
    color: 'info',
    icon: HourglassEmptyIcon,
    description: 'Searching for a bot with this card...',
  },
  FRIEND_REQUEST_SENT: {
    label: 'Friend Request Sent',
    color: 'warning',
    icon: PersonAddIcon,
    description: 'Auto-accepting friend request...',
  },
  TRADE_PROPOSAL_SENT: {
    label: 'Trade Sent',
    color: 'primary',
    icon: SwapHorizIcon,
    description: 'Trade proposal sent! Loading your cards...',
  },
  PICK_CARD: {
    label: 'Pick a Card',
    color: 'secondary',
    icon: StyleIcon,
    description: 'Choose a card to offer from your collection',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'success',
    icon: CheckCircleIcon,
    description: 'Trade completed successfully!',
  },
  FAILED: {
    label: 'Failed',
    color: 'error',
    icon: ErrorIcon,
    description: 'Trade failed.',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'default',
    icon: CancelIcon,
    description: 'Request was cancelled.',
  },
};

// Manual mode overrides for trade-pass users
const MANUAL_STATUS_OVERRIDES = {
  FRIEND_REQUEST_SENT: {
    description: 'Open the game and accept the friend request from the bot!',
  },
  TRADE_PROPOSAL_SENT: {
    description: 'Open the game, accept the trade, and pick any card to offer!',
  },
};

// Format time remaining
function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return null;

  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires - now;

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Card Picker sub-component for PICK_CARD state
 */
function CardPicker({ requestId, cards: initialCards, onPicked }) {
  const [cards, setCards] = useState(initialCards || []);
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(null); // cardId being picked
  const [error, setError] = useState(null);

  // Fetch cards if not provided via socket (fallback to API)
  useEffect(() => {
    if (initialCards && initialCards.length > 0) {
      setCards(initialCards);
      return;
    }
    // Fetch from API
    autoTrade.getMyCards(requestId).then(result => {
      if (result.cards) setCards(result.cards);
    }).catch(() => {});
  }, [requestId, initialCards]);

  const filteredCards = cards.filter(card => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (card.cardName || '').toLowerCase().includes(q) ||
           (card.cardId || '').toLowerCase().includes(q) ||
           (card.rarityCode || '').toLowerCase().includes(q);
  });

  const handlePick = async (card) => {
    setPicking(card.cardId);
    setError(null);
    try {
      await autoTrade.pickTradeCard(requestId, card.cardId, card.expansionId);
      if (onPicked) onPicked(card);
    } catch (err) {
      setError(err.message || 'Failed to accept trade');
      setPicking(null);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <TextField
        size="small"
        placeholder="Search your cards..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
        <Grid container spacing={1}>
          {filteredCards.slice(0, 50).map((card) => (
            <Grid item xs={12} sm={6} key={card.cardId}>
              <Button
                variant="outlined"
                fullWidth
                disabled={picking !== null}
                onClick={() => handlePick(card)}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  py: 1,
                  px: 1.5,
                  borderColor: picking === card.cardId ? 'secondary.main' : 'divider',
                  '&:hover': { borderColor: 'secondary.main', bgcolor: 'action.hover' },
                }}
              >
                {picking === card.cardId ? (
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                ) : (
                  <StyleIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                )}
                <Box sx={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <Typography variant="body2" noWrap fontWeight="medium">
                    {card.cardName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    x{card.cardAmount}
                  </Typography>
                </Box>
                {card.rarityCode && (
                  <Chip
                    size="small"
                    label={card.rarityCode}
                    sx={{
                      bgcolor: RARITY_COLORS[card.rarityCode] || 'grey.500',
                      color: 'white',
                      fontSize: '0.65rem',
                      height: 18,
                      ml: 0.5,
                    }}
                  />
                )}
              </Button>
            </Grid>
          ))}
        </Grid>
      </Box>

      {filteredCards.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          {search ? 'No cards match your search' : 'No tradeable cards found'}
        </Typography>
      )}

      {filteredCards.length > 50 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          Showing top 50 cards. Use search to find specific cards.
        </Typography>
      )}
    </Box>
  );
}

export default function TradeRequestCard({ request, onCancel, pickCardData, onRequestAgain, allRequests }) {
  const [expanded, setExpanded] = useState(request.status === 'PICK_CARD');
  const [copied, setCopied] = useState(false);
  const [cardPicked, setCardPicked] = useState(false);

  const age = useRequestAge(request);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isManualTrade = request.trade_mode === 'manual';
  const baseStatus = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING;
  const manualOverride = isManualTrade ? MANUAL_STATUS_OVERRIDES[request.status] : null;
  const status = manualOverride ? { ...baseStatus, ...manualOverride } : baseStatus;
  const StatusIcon = status.icon;
  const isActive = ['PENDING', 'QUEUED', 'MATCHING', 'FRIEND_REQUEST_SENT', 'TRADE_PROPOSAL_SENT', 'PICK_CARD'].includes(request.status);
  const showTimer = request.status === 'FRIEND_REQUEST_SENT' && request.expires_at;
  // Manual trades skip PICK_CARD — user picks in-game
  const isPickCard = request.status === 'PICK_CARD' && !cardPicked && !isManualTrade;

  // Auto-expand when PICK_CARD
  useEffect(() => {
    if (request.status === 'PICK_CARD') {
      setExpanded(true);
    }
  }, [request.status]);

  // Wave 3: subscribes to the shared 1s ticker — N mounted cards now
  // share ONE timer instead of one each. timeRemaining is computed
  // inline from request.expires_at on each tick-driven re-render.
  useTicker({ enabled: showTimer });
  const timeRemaining = showTimer ? formatTimeRemaining(request.expires_at) : null;

  // Copy friend code to clipboard
  const handleCopyFriendCode = async () => {
    if (request.matched_friend_code) {
      try {
        await navigator.clipboard.writeText(request.matched_friend_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // Calculate progress for timer
  const getTimerProgress = () => {
    if (!request.expires_at || !request.friend_request_sent_at) return 100;

    const now = new Date();
    const sent = new Date(request.friend_request_sent_at);
    const expires = new Date(request.expires_at);
    const total = expires - sent;
    const remaining = expires - now;

    return Math.max(0, Math.min(100, (remaining / total) * 100));
  };

  return (
    <Card
      id={`request-trade-${request.id}`}
      sx={{
        mb: 2,
        borderLeft: 4,
        borderColor: `${status.color}.main`,
        opacity: !isActive ? 0.7 : 1,
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease, opacity 0.3s ease, background-color 0.4s ease',
        ...(request.status === 'COMPLETED' && {
          animation: 'successFlash 1.2s ease-out',
          '@keyframes successFlash': {
            '0%': { boxShadow: '0 0 12px rgba(76, 175, 80, 0.5)', bgcolor: 'rgba(76, 175, 80, 0.04)' },
            '100%': { boxShadow: 'none', bgcolor: 'transparent' },
          },
        }),
        ...(request.status === 'FAILED' && {
          animation: 'failFlash 0.8s ease-out',
          '@keyframes failFlash': {
            '0%': { boxShadow: '0 0 8px rgba(244, 67, 54, 0.4)' },
            '100%': { boxShadow: 'none' },
          },
        }),
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Main content row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Status icon */}
          <StatusIcon
            color={status.color}
            sx={{ fontSize: 32 }}
          />

          {/* Card info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" noWrap>
                {request.card_name}
              </Typography>
              <Chip
                size="small"
                label={request.rarity_code}
                sx={{
                  bgcolor: RARITY_COLORS[request.rarity_code] || 'grey.500',
                  color: 'white',
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {status.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                #{request.id}
              </Typography>
              {!age.isTerminal && age.ageText && (
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: `${age.color}.main` || age.color, fontFamily: 'monospace' }}>
                  {age.phaseLabel} • {age.ageText}
                </Typography>
              )}
              {!age.isTerminal && age.band !== 'active' && (
                <Chip
                  label={age.label}
                  size="small"
                  color={age.chipColor}
                  variant="outlined"
                  sx={{ height: 16, fontSize: '0.55rem', fontWeight: 600 }}
                />
              )}
            </Box>
          </Box>

          {/* Timer (for friend request) */}
          {showTimer && timeRemaining && (
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography
                variant="h6"
                color={timeRemaining === 'Expired' ? 'error' : 'warning.main'}
              >
                {timeRemaining}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                remaining
              </Typography>
            </Box>
          )}

          {/* Status indicator */}
          <StatusIndicator status={request.status} type="trade" errorMessage={request.error_message} compact />

          {/* Cancel button — with confirmation for long-running requests (> 3 min) */}
          {isActive && onCancel && (
            confirmCancel ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => { onCancel(request.id); setConfirmCancel(false); }}
                  sx={{ fontSize: '0.6rem', height: 24, textTransform: 'none', minWidth: 'auto', px: 1 }}
                >
                  Yes, cancel
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setConfirmCancel(false)}
                  sx={{ fontSize: '0.6rem', height: 24, textTransform: 'none', minWidth: 'auto', px: 1 }}
                >
                  Keep
                </Button>
              </Box>
            ) : (
              <Tooltip title={age.ageMs > 3 * 60 * 1000 ? 'This request has been running — click to confirm cancel' : 'Cancel request'}>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (age.ageMs > 3 * 60 * 1000) {
                      setConfirmCancel(true);
                    } else {
                      onCancel(request.id);
                    }
                  }}
                  color="error"
                  aria-label="Cancel request"
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            )
          )}

          {/* Request Again — only on terminal states, >2 min old, with retry probability */}
          {!isActive && ['FAILED', 'CANCELLED'].includes(request.status) &&
            request.requested_at && (Date.now() - new Date(request.requested_at).getTime() > 120000) &&
            onRequestAgain && (() => {
              const prob = allRequests ? getCardRetryProbability(request.card_id || request.card_name, allRequests) : null;
              const probText = prob != null ? `~${prob}% success` : null;
              const probColor = prob >= 60 ? 'success.main' : prob >= 30 ? 'warning.main' : prob != null ? 'error.main' : null;
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip title={probText ? `Retry probability: ${probText} based on past attempts` : 'Create a new request for this card'}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={() => onRequestAgain(request)}
                      sx={{ fontSize: '0.65rem', height: 24, textTransform: 'none', minWidth: 'auto', px: 1 }}
                    >
                      Retry{probText ? ` (${probText})` : ''}
                    </Button>
                  </Tooltip>
                </Box>
              );
            })()
          }

          {/* Expand button */}
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Show less details' : 'Show more details'}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* Timer progress bar */}
        {showTimer && (
          <LinearProgress
            variant="determinate"
            value={getTimerProgress()}
            color="warning"
            sx={{ mt: 1, height: 4, borderRadius: 2 }}
          />
        )}

        {/* PICK_CARD: Indeterminate progress */}
        {isPickCard && (
          <LinearProgress
            color="secondary"
            sx={{ mt: 1, height: 4, borderRadius: 2 }}
          />
        )}

        {/* Expanded details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <RequestTimeline request={request} type="trade" />
          </Box>
          <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            {/* PICK_CARD: Card Picker */}
            {isPickCard && (
              <CardPicker
                requestId={request.id}
                cards={pickCardData?.cards || request._pickCards}
                onPicked={() => setCardPicked(true)}
              />
            )}

            {/* Friend code to add (for friend request status) */}
            {request.status === 'FRIEND_REQUEST_SENT' && request.matched_friend_code && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  bgcolor: isManualTrade ? 'info.light' : 'warning.light',
                  borderRadius: 1,
                  mb: 2,
                }}
              >
                <PersonAddIcon color={isManualTrade ? 'info' : 'warning'} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {isManualTrade
                      ? 'Open the game and accept this friend request:'
                      : 'Add this friend code in-game:'}
                  </Typography>
                  <Typography variant="h6" fontFamily="monospace">
                    {request.matched_friend_code}
                  </Typography>
                </Box>
                <Tooltip title={copied ? 'Copied!' : 'Copy friend code'}>
                  <IconButton onClick={handleCopyFriendCode} color={isManualTrade ? 'info' : 'warning'} aria-label="Copy friend code to clipboard">
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            {/* Manual trade: trade proposal sent — instruct user to accept in-game */}
            {isManualTrade && request.status === 'TRADE_PROPOSAL_SENT' && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  bgcolor: 'primary.light',
                  borderRadius: 1,
                  mb: 2,
                }}
              >
                <SwapHorizIcon color="primary" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="bold">
                    Trade proposal sent!
                  </Typography>
                  <Typography variant="body2">
                    Open the game, accept the trade, and pick any card to offer.
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Details grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 2,
                mt: isPickCard ? 2 : 0,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Card ID
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {request.card_id}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Expansion
                </Typography>
                <Typography variant="body2">
                  {request.expansion_id || 'N/A'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Sand Cost
                </Typography>
                <Typography variant="body2">
                  {request.sand_cost || 0}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Requested
                </Typography>
                <Typography variant="body2">
                  {new Date(request.requested_at).toLocaleString()}
                </Typography>
              </Box>

              {request.completed_at && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Completed
                  </Typography>
                  <Typography variant="body2">
                    {new Date(request.completed_at).toLocaleString()}
                  </Typography>
                </Box>
              )}

              {request.error_message && (() => {
                const info = getErrorDisplay(request.error_message, request.status);
                const groupLabel = ERROR_GROUP_LABELS[info.group] || 'Error';
                return (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Chip
                        label={groupLabel}
                        size="small"
                        color={info.group === 'network' || info.group === 'timeout' ? 'warning' : info.group === 'validation' ? 'info' : 'error'}
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                      />
                      <Typography variant="body2" color="error.main" sx={{ fontSize: '0.8rem' }}>
                        {info.icon} {info.message}
                      </Typography>
                    </Box>
                    {info.recommendation && (
                      <Typography variant="caption" sx={{ color: info.category === 'actionable' ? 'warning.main' : 'text.secondary', fontStyle: 'italic' }}>
                        {info.recommendation}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
