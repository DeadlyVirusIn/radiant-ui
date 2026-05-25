/**
 * Profile Page - User profile management and account overview
 *
 * Shows:
 * - User information (username, email, member since)
 * - Linked device accounts with game profile data
 * - Sync profile from game API
 * - Account statistics
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Avatar,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Skeleton,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  CalendarMonth as CalendarIcon,
  Sync as SyncIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  SportsEsports as GameIcon,
  People as FriendsIcon,
  SwapHoriz as TradeIcon,
  Inventory2 as CollectionIcon,
  Star as LevelIcon,
  Refresh as RefreshIcon,
  EmojiEvents as TrophyIcon,
  LocalFireDepartment as DamageIcon,
  Redeem as PackIcon,
  AutoAwesome as GodPackIcon,
  HourglassTop as HourglassIcon,
  MonetizationOn as GoldIcon,
  ConfirmationNumber as TicketIcon,
  Diamond as ShinedustIcon,
  Block as BannedIcon,
  WorkspacePremium as PointsIcon,
} from '@mui/icons-material';
import { accounts, profile as profileApi } from '../services/api';
import { formatDateTime, formatRelativeTime } from '../utils/dateFormat';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemeMode } from '../contexts/ThemeContext';
import StatCardV2 from '../components/StatCardV2';
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations';
import { EmptyState } from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import InstallAppButton from '../components/InstallAppButton';
import { useSectionStyles } from '../components/SectionCard';

function Profile({ user }) {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const { t } = useLanguage();

  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  const [stats, setStats] = useState(null);

  // Load linked accounts
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accounts.list();
      setLinkedAccounts(response.accounts || []);
    } catch (err) {
      setError('Failed to load accounts');
      console.error('Load accounts error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load user stats
  const loadStats = useCallback(async () => {
    try {
      // Try to get trade request stats
      const response = await fetch('/api/auto-trade/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadStats();
  }, [loadAccounts, loadStats]);

  // Sync profile from game API
  const syncProfile = async (accountId) => {
    try {
      setSyncing(prev => ({ ...prev, [accountId]: true }));
      const response = await profileApi.get(accountId);

      if (response.data?.profile) {
        setSuccess(`Profile synced: ${response.data.profile.nickname || 'Unknown'}`);
        // Reload accounts to show updated data
        await loadAccounts();
      }
    } catch (err) {
      setError(`Failed to sync profile: ${err.response?.data?.error || err.message}`);
    } finally {
      setSyncing(prev => ({ ...prev, [accountId]: false }));
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Format friend ID with dashes
  const formatFriendId = (friendId) => {
    if (!friendId) return 'Not synced';
    // If already formatted, return as is
    if (friendId.includes('-')) return friendId;
    // Format as XXXX-XXXX-XXXX-XXXX
    return friendId.match(/.{1,4}/g)?.join('-') || friendId;
  };

  // Get profile icon URL
  const getIconUrl = (iconId) => {
    if (!iconId) return null;
    // Extract number from icon ID like PROFILE_ICON_100150_SAKAKI
    const match = iconId.match(/PROFILE_ICON_(\d+)/);
    if (match) {
      return `/api/assets/profile-icon/${match[1]}`;
    }
    return null;
  };

  const { sectionBox: cardStyle } = useSectionStyles();

  const infoRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 1,
  };


  return (
    <FadeIn>
      <Box>
        {/* Page Header */}
        <PageHeader
          icon={<PersonIcon />}
          title="Profile"
          subtitle="Manage your account and view game profile information"
        />

        {/* Install App CTA — only shown if not already installed */}
        <Box sx={{ mb: 3 }}>
          <InstallAppButton variant="card" />
        </Box>

        <StaggerContainer>
          <Grid container spacing={3}>
            {/* User Hero Card */}
            <Grid item xs={12} md={4}>
              <StaggerItem>
                <Box sx={{
                  ...cardStyle,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Subtle gradient accent at top */}
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    borderRadius: '14px 14px 0 0',
                  }} />

                  {/* Avatar + name */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 2.5, pt: 1 }}>
                    <Avatar
                      sx={{
                        width: 88,
                        height: 88,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        fontSize: '2.25rem',
                        fontWeight: 700,
                        mb: 2,
                        boxShadow: `0 6px 20px ${theme.palette.primary.main}4D`,
                        border: `3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'}`,
                      }}
                    >
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                    <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.3 }}>
                      {user?.username || 'User'}
                    </Typography>
                    {user?.email && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {user.email}
                      </Typography>
                    )}
                    {user?.isAdmin && (
                      <Chip
                        label="Admin"
                        color="primary"
                        size="small"
                        sx={{ mt: 1, fontWeight: 600 }}
                      />
                    )}
                  </Box>

                  <Divider sx={{ mb: 2, opacity: 0.5 }} />

                  {/* Info rows */}
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {[
                      { icon: <PersonIcon sx={{ fontSize: 16, color: 'primary.main' }} />, label: 'Username', value: user?.username || 'Not set' },
                      { icon: <EmailIcon sx={{ fontSize: 16, color: 'primary.main' }} />, label: 'Email', value: user?.email || 'Not set' },
                      { icon: <CalendarIcon sx={{ fontSize: 16, color: 'primary.main' }} />, label: 'Member Since', value: user?.createdAt ? formatDateTime(user.createdAt) : 'Unknown' },
                    ].map((row) => (
                      <Box key={row.label} sx={infoRowStyle}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            bgcolor: isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(92, 106, 196, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {row.icon}
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {row.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {row.value}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </StaggerItem>
            </Grid>

            {/* Stats Card */}
            <Grid item xs={12} md={8}>
              <StaggerItem>
                <Box sx={{
                  ...cardStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark || theme.palette.success.main})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px ${theme.palette.success.main}40`,
                      }}
                    >
                      <TradeIcon sx={{ color: 'white', fontSize: 18 }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700}>Activity Summary</Typography>
                  </Box>
                  <Grid container spacing={2} sx={{ flex: 1 }}>
                    <Grid item xs={6} sm={3}>
                      <StatCardV2
                        icon={GameIcon}
                        label="Linked Accounts"
                        value={linkedAccounts.length}
                        color="primary"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StatCardV2
                        icon={TradeIcon}
                        label="Trades Done"
                        value={stats?.completed || 0}
                        color="success"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StatCardV2
                        icon={CollectionIcon}
                        label="Total Requests"
                        value={stats?.total || 0}
                        color="info"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StatCardV2
                        icon={FriendsIcon}
                        label="Pending"
                        value={stats?.pending || 0}
                        color="warning"
                      />
                    </Grid>
                  </Grid>
                </Box>
              </StaggerItem>
            </Grid>

            {/* Game Accounts Section */}
            <Grid item xs={12}>
              <StaggerItem>
                <Box sx={cardStyle}>
                  {/* Section header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: '10px',
                          background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark || theme.palette.secondary.main})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 4px 12px ${theme.palette.secondary.main}40`,
                        }}
                      >
                        <GameIcon sx={{ color: 'white', fontSize: 18 }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>Game Accounts</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {linkedAccounts.length} account{linkedAccounts.length !== 1 ? 's' : ''} linked
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
                      onClick={loadAccounts}
                      disabled={loading}
                      size="small"
                      sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                    >
                      Refresh
                    </Button>
                  </Box>

                  {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {[1, 2].map(i => (
                        <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: '12px' }} />
                      ))}
                    </Box>
                  ) : linkedAccounts.length === 0 ? (
                    <EmptyState
                      icon={<GameIcon sx={{ fontSize: 64 }} />}
                      title="No Accounts Linked"
                      description="Go to the Accounts page to link your game account."
                      minHeight={200}
                    />
                  ) : (
                    <Grid container spacing={2}>
                      {linkedAccounts.map((account) => (
                        <Grid item xs={12} md={6} key={account.id}>
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: '12px',
                              border: `1px solid ${
                                account.is_active
                                  ? isDark ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.25)'
                                  : isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)'
                              }`,
                              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                borderColor: account.is_active
                                  ? isDark ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.4)'
                                  : isDark ? 'rgba(124, 138, 255, 0.25)' : 'rgba(92, 106, 196, 0.25)',
                                bgcolor: isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.015)',
                                boxShadow: isDark
                                  ? '0 4px 16px rgba(0,0,0,0.2)'
                                  : '0 4px 16px rgba(0,0,0,0.06)',
                              },
                            }}
                          >
                            {/* Account header */}
                            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                              <Avatar
                                src={getIconUrl(account.icon_id)}
                                sx={{
                                  width: 56,
                                  height: 56,
                                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                  flexShrink: 0,
                                  fontSize: '1.25rem',
                                  fontWeight: 700,
                                  boxShadow: `0 4px 12px ${theme.palette.primary.main}30`,
                                  border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'}`,
                                }}
                              >
                                {account.nickname?.[0] || '?'}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                                  <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                                    {account.nickname || 'Unknown Player'}
                                  </Typography>
                                  {account.is_active && (
                                    <Chip label="Active" color="success" size="small" sx={{ fontWeight: 600, height: 22 }} />
                                  )}
                                  {account.account_type && (
                                    <Chip
                                      label={account.account_type}
                                      size="small"
                                      variant="outlined"
                                      color={account.account_type === 'alt' ? 'warning' : 'primary'}
                                      sx={{ height: 22, fontSize: '0.7rem', textTransform: 'capitalize' }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary">
                                  Device: {account.device_account?.substring(0, 8)}...
                                </Typography>
                              </Box>
                            </Box>

                            {/* Ban Status Warning */}
                            {account.is_banned && (
                              <Alert severity="error" icon={<BannedIcon />} sx={{ mb: 1.5, borderRadius: '8px' }}>
                                Account banned {account.banned_at ? `on ${formatDateTime(account.banned_at)}` : ''}
                              </Alert>
                            )}

                            {/* Player Level Badge */}
                            {account.player_level > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                <Chip
                                  icon={<LevelIcon />}
                                  label={`Level ${account.player_level}`}
                                  color="primary"
                                  size="small"
                                />
                              </Box>
                            )}

                            {/* Resources */}
                            {(account.hourglasses > 0 || account.gold > 0 || account.shinedust > 0 || account.shop_tickets > 0) && (
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                                  Resources
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                  {account.hourglasses > 0 && (
                                    <Chip icon={<HourglassIcon />} label={account.hourglasses.toLocaleString()} size="small" color="info" variant="outlined" sx={{ fontVariantNumeric: 'tabular-nums' }} />
                                  )}
                                  {account.gold > 0 && (
                                    <Chip icon={<GoldIcon />} label={account.gold.toLocaleString()} size="small" color="warning" variant="outlined" sx={{ fontVariantNumeric: 'tabular-nums' }} />
                                  )}
                                  {account.shinedust > 0 && (
                                    <Chip icon={<ShinedustIcon />} label={account.shinedust.toLocaleString()} size="small" color="secondary" variant="outlined" sx={{ fontVariantNumeric: 'tabular-nums' }} />
                                  )}
                                  {account.shop_tickets > 0 && (
                                    <Chip icon={<TicketIcon />} label={account.shop_tickets.toLocaleString()} size="small" color="success" variant="outlined" sx={{ fontVariantNumeric: 'tabular-nums' }} />
                                  )}
                                  {account.pack_points > 0 && (
                                    <Chip icon={<PointsIcon />} label={`${account.pack_points.toLocaleString()} pts`} size="small" variant="outlined" sx={{ fontVariantNumeric: 'tabular-nums' }} />
                                  )}
                                </Box>
                              </Box>
                            )}

                            {/* ID fields */}
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: '8px',
                                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                                mb: 1.5,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.75,
                              }}
                            >
                              {/* Friend Code */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, flexShrink: 0 }}>
                                  Friend Code:
                                </Typography>
                                <Typography variant="caption" fontFamily="monospace" sx={{ flex: 1 }}>
                                  {formatFriendId(account.friend_id)}
                                </Typography>
                                {account.friend_id && (
                                  <Tooltip title={copiedField === `friend_${account.id}` ? 'Copied!' : 'Copy'}>
                                    <IconButton
                                      size="small"
                                      aria-label="Copy friend ID"
                                      onClick={() => copyToClipboard(formatFriendId(account.friend_id), `friend_${account.id}`)}
                                      sx={{ p: 0.25 }}
                                    >
                                      {copiedField === `friend_${account.id}` ? <CheckIcon sx={{ fontSize: 14 }} /> : <CopyIcon sx={{ fontSize: 14 }} />}
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>

                              {/* Player ID */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, flexShrink: 0 }}>
                                  Player ID:
                                </Typography>
                                <Typography variant="caption" fontFamily="monospace" sx={{ flex: 1 }}>
                                  {account.player_id ? `${account.player_id.substring(0, 8)}...` : 'Not synced'}
                                </Typography>
                                {account.player_id && (
                                  <Tooltip title={copiedField === `player_${account.id}` ? 'Copied!' : 'Copy'}>
                                    <IconButton
                                      size="small"
                                      aria-label="Copy player ID"
                                      onClick={() => copyToClipboard(account.player_id, `player_${account.id}`)}
                                      sx={{ p: 0.25 }}
                                    >
                                      {copiedField === `player_${account.id}` ? <CheckIcon sx={{ fontSize: 14 }} /> : <CopyIcon sx={{ fontSize: 14 }} />}
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>

                              {/* Last Active */}
                              {account.last_session_at && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, flexShrink: 0 }}>
                                    Last Active:
                                  </Typography>
                                  <Typography variant="caption">
                                    {formatRelativeTime(account.last_session_at)}
                                  </Typography>
                                </Box>
                              )}
                            </Box>

                            {/* Battle & Pack Statistics Accordion */}
                            {(account.total_win_count > 0 || account.total_packs_opened > 0 || account.max_damage > 0) && (
                              <Accordion
                                sx={{
                                  mb: 1.5,
                                  bgcolor: 'transparent',
                                  boxShadow: 'none',
                                  border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                                  borderRadius: '8px !important',
                                  '&:before': { display: 'none' },
                                }}
                              >
                                <AccordionSummary
                                  expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}
                                  sx={{ px: 1.5, minHeight: 36, '& .MuiAccordionSummary-content': { my: 0.75 } }}
                                >
                                  <Typography variant="caption" color="text.secondary">
                                    Battle & Pack Statistics
                                  </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ px: 1.5, pb: 1.5 }}>
                                  <Grid container spacing={1}>
                                    {/* Battle Stats */}
                                    {account.total_win_count > 0 && (
                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <TrophyIcon fontSize="small" color="warning" />
                                          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{account.total_win_count.toLocaleString()} wins</Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                    {account.max_damage > 0 && (
                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <DamageIcon fontSize="small" color="error" />
                                          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{account.max_damage.toLocaleString()} max dmg</Typography>
                                        </Box>
                                      </Grid>
                                    )}

                                    {/* Battle Progress bars */}
                                    {account.beginner_battles_completed > 0 && (
                                      <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="caption" sx={{ minWidth: 80 }}>Beginner:</Typography>
                                          <LinearProgress
                                            variant="determinate"
                                            value={Math.min(100, (account.beginner_battles_completed / 50) * 100)}
                                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                          />
                                          <Typography variant="caption">{account.beginner_battles_completed}/50</Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                    {account.intermediate_battles_completed > 0 && (
                                      <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="caption" sx={{ minWidth: 80 }}>Intermediate:</Typography>
                                          <LinearProgress
                                            variant="determinate"
                                            value={Math.min(100, (account.intermediate_battles_completed / 50) * 100)}
                                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                            color="info"
                                          />
                                          <Typography variant="caption">{account.intermediate_battles_completed}/50</Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                    {account.advanced_battles_completed > 0 && (
                                      <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="caption" sx={{ minWidth: 80 }}>Advanced:</Typography>
                                          <LinearProgress
                                            variant="determinate"
                                            value={Math.min(100, (account.advanced_battles_completed / 50) * 100)}
                                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                            color="warning"
                                          />
                                          <Typography variant="caption">{account.advanced_battles_completed}/50</Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                    {account.expert_battles_completed > 0 && (
                                      <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="caption" sx={{ minWidth: 80 }}>Expert:</Typography>
                                          <LinearProgress
                                            variant="determinate"
                                            value={Math.min(100, (account.expert_battles_completed / 50) * 100)}
                                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                            color="error"
                                          />
                                          <Typography variant="caption">{account.expert_battles_completed}/50</Typography>
                                        </Box>
                                      </Grid>
                                    )}

                                    {/* Pack Stats */}
                                    {account.total_packs_opened > 0 && (
                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <PackIcon fontSize="small" color="primary" />
                                          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{account.total_packs_opened.toLocaleString()} packs</Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                    {account.god_packs_found > 0 && (
                                      <Grid item xs={6}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <GodPackIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                                          <Typography variant="body2" sx={{ color: theme.palette.warning.main, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {account.god_packs_found} God Packs!
                                          </Typography>
                                        </Box>
                                      </Grid>
                                    )}
                                  </Grid>
                                </AccordionDetails>
                              </Accordion>
                            )}

                            {/* Sync button */}
                            <Button
                              variant="outlined"
                              size="small"
                              fullWidth
                              startIcon={syncing[account.id] ? <CircularProgress size={14} /> : <SyncIcon />}
                              onClick={() => syncProfile(account.id)}
                              disabled={syncing[account.id]}
                              sx={{
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontWeight: 600,
                                py: 0.75,
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  boxShadow: `0 2px 8px ${theme.palette.primary.main}20`,
                                },
                              }}
                            >
                              {syncing[account.id] ? 'Syncing...' : 'Sync Profile'}
                            </Button>

                            {!account.friend_id && (
                              <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '8px', py: 0.5 }}>
                                Friend ID not synced. Click "Sync Profile" to fetch from game.
                              </Alert>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              </StaggerItem>
            </Grid>
          </Grid>
        </StaggerContainer>

        {/* Success Snackbar */}
        <Snackbar
          open={!!success}
          autoHideDuration={4000}
          onClose={() => setSuccess('')}
          message={success}
        />

        {/* Error Snackbar */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError('')}
        >
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        </Snackbar>
      </Box>
    </FadeIn>
  );
}

export default Profile;
