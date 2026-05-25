/**
 * GiveCard Page
 * Send duplicate cards as gifts to friends
 */

import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Grid,
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
  IconButton,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  CardGiftcard as GiftIcon,
  People as FriendsIcon,
  Inventory as CardsIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  InfoOutlined as InfoIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { RARITY_COLORS } from '../constants/gameData';
import { FadeIn } from '../components/Animations';
import PageHeader from '../components/PageHeader';

// Rarity glow map
const RARITY_GLOW = {
  'C': 'none',
  'U': '0 0 8px rgba(192, 192, 192, 0.3)',
  'R': '0 0 8px rgba(255, 215, 0, 0.3)',
  'RR': '0 0 10px rgba(255, 215, 0, 0.4)',
  'AR': '0 0 10px rgba(156, 39, 176, 0.4)',
  'SR': '0 0 10px rgba(255, 215, 0, 0.4)',
  'SAR': '0 0 12px rgba(255, 215, 0, 0.5)',
  'UR': '0 0 14px rgba(255, 215, 0, 0.6)',
  'IM': '0 0 14px rgba(255, 215, 0, 0.6)',
  'SSR': '0 0 14px rgba(255, 215, 0, 0.6)',
};

// Relative time helper
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function GiveCard({ user }) {
  const { t } = useLanguage();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // State
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [friends, setFriends] = useState([]);
  const [eligibleCards, setEligibleCards] = useState([]);
  const [giftHistory, setGiftHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState(0); // 0 = Give Card, 1 = History

  // Selection state
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  // Dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Set filter state
  const [selectedSet, setSelectedSet] = useState('');

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, []);

  // Load data when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadFriends();
      loadEligibleCards();
      loadHistory();
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.accounts?.length > 0) {
          setSelectedAccount(data.accounts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const loadFriends = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/give-card/friends/${selectedAccount}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to load friends');
      }
    } catch (err) {
      setError('Network error loading friends');
    } finally {
      setLoading(false);
    }
  };

  const loadEligibleCards = async () => {
    if (!selectedAccount) return;
    try {
      const res = await fetch(`/api/give-card/eligible/${selectedAccount}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setEligibleCards(data.cards || []);
      }
    } catch (err) {
      console.error('Failed to load eligible cards:', err);
    }
  };

  const loadHistory = async () => {
    if (!selectedAccount) return;
    try {
      const res = await fetch(`/api/give-card/history/${selectedAccount}?limit=20`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setGiftHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Rarity weight for sorting (higher = rarer)
  const RARITY_WEIGHT = { UR: 11, IM: 10, SSR: 9, SAR: 8, S: 7, SR: 6, AR: 5, RR: 4, R: 3, U: 2, C: 1 };

  // Extract unique sets from eligible cards
  const availableSets = useMemo(() => {
    const setMap = new Map();
    eligibleCards.forEach(card => {
      if (card.set_code && !setMap.has(card.set_code)) {
        setMap.set(card.set_code, card.set_name || card.set_code);
      }
    });
    return Array.from(setMap.entries()).map(([code, name]) => ({ code, name }));
  }, [eligibleCards]);

  // Auto-select newest set (last in list) when eligible cards load
  useEffect(() => {
    if (availableSets.length > 0 && !selectedSet) {
      setSelectedSet(availableSets[availableSets.length - 1].code);
    }
  }, [availableSets]);

  // Filtered and sorted eligible cards: set filter + not-owned-first + rarity desc
  const filteredEligibleCards = useMemo(() => {
    let result = [...eligibleCards];
    if (selectedSet) {
      result = result.filter(c => c.set_code === selectedSet);
    }
    result.sort((a, b) => {
      return (RARITY_WEIGHT[b.rarity_code] || 0) - (RARITY_WEIGHT[a.rarity_code] || 0);
    });
    return result;
  }, [eligibleCards, selectedSet]);

  const handleSendCard = async () => {
    if (!selectedFriend || !selectedCard) return;

    setSending(true);
    try {
      const res = await fetch(`/api/give-card/send/${selectedAccount}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          friendPlayerId: selectedFriend.playerId,
          cardId: selectedCard.backend_id || selectedCard.card_id,
          expansionId: selectedCard.set_code,
        }),
      });

      if (res.ok) {
        setSnackbar({
          open: true,
          message: `Successfully sent ${selectedCard.card_name} to ${selectedFriend.playerName}!`,
          severity: 'success',
        });
        setConfirmOpen(false);
        setSelectedFriend(null);
        setSelectedCard(null);
        // Refresh data
        loadEligibleCards();
        loadHistory();
      } else {
        const err = await res.json();
        setSnackbar({
          open: true,
          message: err.error || 'Failed to send card',
          severity: 'error',
        });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Network error sending card',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const getCardImageUrl = (card) => {
    // Use backend proxy for reliable multi-CDN fallback
    return `/api/cards/${card.backend_id}/image?v=5`;
  };

  // Shared panel box style
  const panelSx = {
    p: 2.5,
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  };

  const renderGiveCardTab = () => (
    <Grid container spacing={2.5}>
      {/* Left Column: Friends List */}
      <Grid item xs={12} md={4}>
        <Box sx={panelSx}>
          {/* Panel header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <FriendsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                {t('giveCard.selectFriend') || 'Select Friend'}
              </Typography>
              {friends.length > 0 && (
                <Chip
                  label={friends.length}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.68rem',
                    bgcolor: isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(92, 106, 196, 0.1)',
                    color: 'primary.main',
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>
            <Tooltip title="Refresh friends">
              <IconButton size="small" onClick={loadFriends} aria-label="Refresh friends list"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={28} />
            </Box>
          ) : friends.length === 0 ? (
            <Box sx={{
              py: 3, textAlign: 'center',
              color: 'text.secondary',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: '10px',
            }}>
              <FriendsIcon sx={{ fontSize: 32, opacity: 0.4, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {t('giveCard.noFriends') || 'No friends available to receive cards'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding sx={{ maxHeight: 420, overflow: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)' },
            }}>
              {friends.map((friend) => {
                const isSelected = selectedFriend?.playerId === friend.playerId;
                return (
                  <ListItem
                    key={friend.playerId}
                    onClick={() => setSelectedFriend(friend)}
                    sx={{
                      borderRadius: '10px',
                      mb: 0.5,
                      px: 1.5,
                      py: 0.75,
                      cursor: 'pointer',
                      borderLeft: `3px solid ${isSelected ? theme.palette.primary.main : 'transparent'}`,
                      bgcolor: isSelected
                        ? isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.08)'
                        : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: isSelected
                          ? isDark ? 'rgba(124, 138, 255, 0.16)' : 'rgba(92, 106, 196, 0.1)'
                          : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                        borderLeftColor: theme.palette.primary.main,
                      },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar sx={{
                        width: 32, height: 32,
                        bgcolor: isSelected ? 'primary.main' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        color: isSelected ? 'white' : 'text.secondary',
                        fontSize: '0.8rem',
                      }}>
                        {friend.playerName?.[0]?.toUpperCase() || <PersonIcon sx={{ fontSize: 16 }} />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={isSelected ? 600 : 400} noWrap>
                          {friend.playerName || `Player ${friend.playerId.slice(0, 8)}...`}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color={friend.canReceive ? 'success.main' : 'text.disabled'}>
                          {friend.canReceive ? 'Ready to receive' : 'Unavailable today'}
                        </Typography>
                      }
                    />
                    {isSelected && (
                      <CheckCircleIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                    )}
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Grid>

      {/* Right Column: Cards Grid */}
      <Grid item xs={12} md={8}>
        <Box sx={panelSx}>
          {/* Panel header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <CardsIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                {t('giveCard.eligibleCards') || 'Eligible Cards'}
              </Typography>
              <Chip
                label={filteredEligibleCards.length}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.68rem',
                  bgcolor: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
                  color: 'secondary.main',
                  fontWeight: 600,
                }}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              {/* Set filter dropdown */}
              {availableSets.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel sx={{ fontSize: '0.8rem' }}>Set</InputLabel>
                  <Select
                    value={selectedSet}
                    label="Set"
                    onChange={(e) => setSelectedSet(e.target.value)}
                    sx={{ fontSize: '0.8rem' }}
                  >
                    <MenuItem value="">All Sets</MenuItem>
                    {availableSets.map(s => (
                      <MenuItem key={s.code} value={s.code} sx={{ fontSize: '0.8rem' }}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Tooltip title="Refresh cards">
                <IconButton size="small" onClick={loadEligibleCards} aria-label="Refresh eligible cards"
                  sx={{ color: 'text.secondary', '&:hover': { color: 'secondary.main' } }}>
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {filteredEligibleCards.length === 0 ? (
            <Box sx={{
              py: 4, textAlign: 'center',
              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: '10px',
            }}>
              <CardsIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {t('giveCard.noEligibleCards') || 'No owned cards available to give'}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={1.5} sx={{
              maxHeight: 480, overflow: 'auto',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)' },
            }}>
              {filteredEligibleCards.map((card) => {
                const isCardSelected = selectedCard?.backend_id === card.backend_id;
                const glow = RARITY_GLOW[card.rarity_code] || 'none';
                return (
                  <Grid item xs={4} sm={3} md={2.4} key={card.backend_id || card.card_id}>
                    <Box
                      onClick={() => setSelectedCard(card)}
                      sx={{
                        position: 'relative',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: `2px solid ${isCardSelected ? theme.palette.secondary.main : 'transparent'}`,
                        boxShadow: isCardSelected
                          ? `0 0 0 1px ${theme.palette.secondary.main}40, ${glow}`
                          : glow,
                        transition: 'all 0.18s ease',
                        '&:hover': {
                          transform: 'scale(1.04)',
                          boxShadow: `0 4px 16px rgba(0,0,0,0.25), ${glow}`,
                          borderColor: isCardSelected ? 'secondary.main' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={getCardImageUrl(card)}
                        alt={card.card_name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                        sx={{
                          width: '100%',
                          aspectRatio: '0.71',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                      {/* Amount badge */}
                      <Chip
                        label={`x${card.amount}`}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(0,0,0,0.65)',
                          color: 'white',
                          backdropFilter: 'blur(4px)',
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      {/* Rarity badge */}
                      <Chip
                        label={card.rarity_code}
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          left: 4,
                          height: 16,
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          backgroundColor: RARITY_COLORS[card.rarity_code] || '#999',
                          color: 'white',
                          '& .MuiChip-label': { px: 0.6 },
                        }}
                      />
                      {/* Selection check overlay */}
                      {isCardSelected && (
                        <Box sx={{
                          position: 'absolute', inset: 0,
                          bgcolor: 'rgba(124, 58, 237, 0.18)',
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                          p: 0.5,
                        }}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'secondary.main',
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                        </Box>
                      )}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>

        {/* Floating Send Action Area */}
        {selectedFriend && selectedCard && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: '14px',
              border: `1px solid ${theme.palette.primary.main}40`,
              bgcolor: isDark
                ? 'rgba(92, 106, 196, 0.1)'
                : 'rgba(92, 106, 196, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              boxShadow: `0 2px 16px ${theme.palette.primary.main}20`,
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box
                component="img"
                src={getCardImageUrl(selectedCard)}
                alt={selectedCard.card_name}
                sx={{ width: 36, height: 50, objectFit: 'cover', borderRadius: '6px' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <Box>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {selectedCard.card_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  to {selectedFriend.playerName}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<SendIcon sx={{ fontSize: 16 }} />}
              onClick={() => setConfirmOpen(true)}
              sx={{
                px: 3,
                py: 0.85,
                borderRadius: '10px',
                fontWeight: 600,
                boxShadow: `0 4px 14px ${theme.palette.primary.main}50`,
                '&:hover': {
                  boxShadow: `0 6px 20px ${theme.palette.primary.main}60`,
                },
              }}
            >
              {t('giveCard.sendCard') || 'Send Card'}
            </Button>
          </Box>
        )}
      </Grid>
    </Grid>
  );

  const renderHistoryTab = () => (
    <Box sx={panelSx}>
      <Box display="flex" alignItems="center" gap={1} mb={2.5}>
        <HistoryIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle1" fontWeight={600}>
          {t('giveCard.history') || 'Gift History'}
        </Typography>
      </Box>

      {giftHistory.length === 0 ? (
        <Box sx={{
          py: 4, textAlign: 'center',
          border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: '10px',
        }}>
          <HistoryIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('giveCard.noHistory') || 'No gift history yet'}
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {giftHistory.map((gift, index) => (
            <Box key={gift.id}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1.25,
                px: 0.5,
                borderRadius: '10px',
                transition: 'bgcolor 0.15s',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                },
              }}>
                {/* Timeline dot */}
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  bgcolor: gift.status === 'success' ? 'success.main' : 'error.main',
                  boxShadow: gift.status === 'success'
                    ? '0 0 6px rgba(16, 185, 129, 0.5)'
                    : '0 0 6px rgba(239, 68, 68, 0.5)',
                }} />

                <Avatar sx={{
                  width: 32, height: 32,
                  bgcolor: gift.status === 'success'
                    ? isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'
                    : isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  color: gift.status === 'success' ? 'success.main' : 'error.main',
                }}>
                  <GiftIcon sx={{ fontSize: 15 }} />
                </Avatar>

                <Box flex={1} minWidth={0}>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    Card: {gift.cardId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    To: {gift.recipientId?.slice(0, 16)}...
                  </Typography>
                </Box>

                <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
                  <Chip
                    label={gift.status}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      mb: 0.25,
                      bgcolor: gift.status === 'success'
                        ? isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)'
                        : isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                      color: gift.status === 'success' ? 'success.main' : 'error.main',
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                  <Box display="flex" alignItems="center" gap={0.25} justifyContent="flex-end">
                    <TimeIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                      {relativeTime(gift.sentAt)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {index < giftHistory.length - 1 && (
                <Box sx={{
                  ml: 2.5,
                  width: 1,
                  height: 12,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                }} />
              )}
            </Box>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <FadeIn duration={0.3}>
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        icon={<GiftIcon />}
        title={t('giveCard.title') || 'Give Card'}
        subtitle="Gift duplicate cards to your friends"
        action={
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel sx={{ fontSize: '0.8rem' }}>{t('giveCard.account') || 'Account'}</InputLabel>
            <Select
              value={selectedAccount}
              label={t('giveCard.account') || 'Account'}
              onChange={(e) => setSelectedAccount(e.target.value)}
              size="small"
              sx={{ fontSize: '0.85rem' }}
            >
              {accounts.map((acc) => (
                <MenuItem key={acc.id} value={acc.id} sx={{ fontSize: '0.85rem' }}>
                  {acc.nickname || acc.friend_code || `Account ${acc.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Subtle helper text instead of full Alert */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1,
        mb: 2.5, px: 1.5, py: 1,
        borderRadius: '10px',
        bgcolor: isDark ? 'rgba(92, 106, 196, 0.06)' : 'rgba(92, 106, 196, 0.04)',
        border: `1px solid ${isDark ? 'rgba(92, 106, 196, 0.12)' : 'rgba(92, 106, 196, 0.1)'}`,
      }}>
        <InfoIcon sx={{ fontSize: 15, color: 'primary.main', mt: 0.15, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" lineHeight={1.5}>
          {t('giveCard.info') || 'Give owned cards to your friends. Only 1-4 diamond rarity cards can be gifted. Each friend can receive 1 card per day. Gifting permanently removes the card from the bot account.'}
        </Typography>
      </Box>

      {/* Modern styled tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        sx={{
          mb: 2.5,
          minHeight: 36,
          '& .MuiTabs-root': { minHeight: 36 },
          '& .MuiTabs-indicator': {
            height: 2,
            borderRadius: '2px 2px 0 0',
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          },
          '& .MuiTab-root': {
            minHeight: 36,
            fontSize: '0.82rem',
            fontWeight: 500,
            textTransform: 'none',
            color: 'text.secondary',
            px: 2,
            py: 0.75,
            '&.Mui-selected': {
              color: 'primary.main',
              fontWeight: 600,
            },
          },
        }}
      >
        <Tab
          label={t('giveCard.giveCardTab') || 'Give Card'}
          icon={<GiftIcon sx={{ fontSize: 15 }} />}
          iconPosition="start"
        />
        <Tab
          label={t('giveCard.historyTab') || 'History'}
          icon={<HistoryIcon sx={{ fontSize: 15 }} />}
          iconPosition="start"
        />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 ? renderGiveCardTab() : renderHistoryTab()}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? '#1a2035' : 'background.paper',
            minWidth: 340,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
          {t('giveCard.confirmTitle') || 'Confirm Gift'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('giveCard.confirmMessage') || 'Are you sure you want to send this card?'}
          </Typography>
          {selectedCard && (
            <Box sx={{
              display: 'flex', gap: 2, alignItems: 'center',
              p: 1.5, borderRadius: '12px',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
              mb: 1.5,
            }}>
              <Box
                component="img"
                src={getCardImageUrl(selectedCard)}
                alt={selectedCard.card_name}
                sx={{ width: 60, borderRadius: '8px' }}
              />
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>
                  {selectedCard.card_name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {selectedCard.set_name} | {selectedCard.rarity}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  You have: {selectedCard.amount} copies
                </Typography>
              </Box>
            </Box>
          )}
          {selectedFriend && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              p: 1, borderRadius: '8px',
              bgcolor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
            }}>
              <PersonIcon sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="body2">
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {t('giveCard.recipient') || 'To'}:
                </Box>{' '}
                {selectedFriend.playerName}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={sending}
            sx={{ borderRadius: '8px', textTransform: 'none' }}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            onClick={handleSendCard}
            variant="contained"
            color="primary"
            disabled={sending}
            startIcon={sending ? <CircularProgress size={14} /> : <SendIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5,
              boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
            }}
          >
            {sending ? (t('giveCard.sending') || 'Sending...') : (t('giveCard.send') || 'Send')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  );
}
