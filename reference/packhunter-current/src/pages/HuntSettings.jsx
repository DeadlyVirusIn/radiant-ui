import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CardActionArea,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Chip,
  CircularProgress,
  TextField,
  Skeleton,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Divider,
  Card,
  useTheme,
} from '@mui/material';
import {
  CheckCircle as JoinedIcon,
  Add as JoinIcon,
  DeleteSweep as LeaveAllIcon,
  SelectAll as JoinAllIcon,
  Star as StarIcon,
  Speed as HuntIcon,
  AutoAwesome as PseudoIcon,
  People as FriendIcon,
  Style as RareIcon,
} from '@mui/icons-material';
import { hunt } from '../services/api';
import SettingRow from '../components/SettingRow';
import { FadeIn } from '../components/Animations';
import { EmptyState } from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { useSectionStyles } from '../components/SectionCard';

// Group packs by expansion, newest first (B1a, B1, A4b, A4a, A4, A3b, ... A1)
function parseExpansion(exp) {
  // e.g. "B1a" -> series='B', major=1, sub='a'
  //      "A4"  -> series='A', major=4, sub=''
  const match = exp.match(/^([A-Z])(\d+)([a-z]?)$/i);
  if (!match) return { series: 'Z', major: 0, sub: '' };
  return { series: match[1].toUpperCase(), major: parseInt(match[2]), sub: match[3] || '' };
}

function compareExpansions(a, b) {
  const pa = parseExpansion(a);
  const pb = parseExpansion(b);
  // B series before A series (B is newer)
  if (pa.series !== pb.series) return pb.series.localeCompare(pa.series);
  // Higher major number first
  if (pa.major !== pb.major) return pb.major - pa.major;
  // Sub-letter: 'b' > 'a' > '' (no sub). Reverse so sub-letters come first, base last
  // e.g. B1a before B1
  if (pa.sub && !pb.sub) return -1;
  if (!pa.sub && pb.sub) return 1;
  return pb.sub.localeCompare(pa.sub);
}

function groupByExpansion(packs) {
  const groups = [];
  const seen = new Set();
  for (const pack of packs) {
    const exp = pack.expansion || 'Other';
    if (!seen.has(exp)) {
      seen.add(exp);
      groups.push({ expansion: exp, packs: [] });
    }
    groups.find(g => g.expansion === exp).packs.push(pack);
  }
  groups.sort((a, b) => compareExpansions(a.expansion, b.expansion));
  return groups;
}

export default function HuntSettings() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('main');
  const [packs, setPacks] = useState([]);
  const [joinedPacks, setJoinedPacks] = useState([]);
  const [containerGroup, setContainerGroup] = useState(0);
  const [godPackEnabled, setGodPackEnabled] = useState(true);
  const [pseudoEnabled, setPseudoEnabled] = useState(false);
  const [minRareCards, setMinRareCards] = useState(1);
  const [keepAsFriend, setKeepAsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [error, setError] = useState(null);

  const { sectionBox } = useSectionStyles();

  useEffect(() => {
    async function init() {
      try {
        const [accountsRes, packsRes] = await Promise.all([
          hunt.getAccounts(),
          hunt.getPacks(),
        ]);
        setAccounts(accountsRes.accounts || []);
        setPacks(packsRes.packs || []);
        if (accountsRes.accounts?.length > 0) {
          setSelectedAccount(accountsRes.accounts[0].account_type);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const loadStatus = useCallback(async (accountType) => {
    setStatusLoading(true);
    try {
      const status = await hunt.getMyStatus(accountType);
      const joinedNames = (status.joinedPacks || []).map(p => p.pack_name);
      setJoinedPacks(joinedNames);
      setContainerGroup(status.containerGroup || 0);
      setGodPackEnabled(joinedNames.length > 0);
      setPseudoEnabled(status.pseudoEnabled || false);
      setMinRareCards(status.minRareCards || 1);
      setKeepAsFriend(status.keepAsFriend || false);
    } catch (err) {
      showSnackbar(err.message, 'error');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && accounts.length > 0) {
      loadStatus(selectedAccount);
    }
  }, [selectedAccount, loading, accounts.length, loadStatus]);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const isJoined = (packName) => joinedPacks.includes(packName);

  // Toggle single pack -- optimistic UI, no confirmation dialog for individual packs
  const handlePackClick = async (pack) => {
    const joined = isJoined(pack.name);
    setActionLoading(pack.name);
    // Optimistic update
    if (joined) {
      setJoinedPacks(prev => prev.filter(n => n !== pack.name));
    } else {
      setJoinedPacks(prev => [...prev, pack.name]);
    }
    try {
      if (joined) {
        await hunt.leavePack(selectedAccount, pack.name);
        showSnackbar(`Left ${pack.label}`);
      } else {
        await hunt.joinPack(selectedAccount, pack.name);
        showSnackbar(`Joined ${pack.label}`);
      }
    } catch (err) {
      // Rollback on error
      await loadStatus(selectedAccount);
      showSnackbar(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveAll = () => {
    setConfirmDialog({
      open: true,
      title: 'Leave All Hunts?',
      message: `This will remove your ${selectedAccount} account from ALL pack hunts. You can rejoin later.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setActionLoading('__all__');
        try {
          await hunt.leaveAllPacks(selectedAccount);
          showSnackbar('Left all hunts');
          await loadStatus(selectedAccount);
        } catch (err) {
          showSnackbar(err.message, 'error');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleJoinAll = () => {
    setConfirmDialog({
      open: true,
      title: 'Join All Hunts?',
      message: `This will add your ${selectedAccount} account to ALL available pack hunts.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setActionLoading('__all__');
        try {
          const result = await hunt.joinAllPacks(selectedAccount);
          showSnackbar(`Joined ${result.count || 'all'} packs`);
          await loadStatus(selectedAccount);
        } catch (err) {
          showSnackbar(err.message, 'error');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleGodPackToggle = async (event) => {
    const enabled = event.target.checked;
    setGodPackEnabled(enabled);
    try {
      if (enabled) {
        await hunt.updateMinStars(selectedAccount, 5);
      } else {
        await hunt.updateMinStars(selectedAccount, 8);
      }
      showSnackbar(`God pack notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setGodPackEnabled(!enabled);
      showSnackbar(err.message, 'error');
    }
  };

  const handlePseudoToggle = async (event) => {
    const enabled = event.target.checked;
    setPseudoEnabled(enabled);
    try {
      await hunt.togglePseudo(selectedAccount, enabled);
      showSnackbar(`Pseudo god packs ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setPseudoEnabled(!enabled); // rollback
      showSnackbar(err.message, 'error');
    }
  };

  const handleMinRareCardsChange = async (_event, value) => {
    if (value === null) return;
    const v = parseInt(value);
    setMinRareCards(v);
    try {
      await hunt.updateMinRareCards(selectedAccount, v);
      showSnackbar(`Min rare cards set to ${v}+`);
    } catch (err) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleKeepAsFriendToggle = async (event) => {
    const enabled = event.target.checked;
    setKeepAsFriend(enabled);
    try {
      await hunt.toggleKeepAsFriend(selectedAccount, enabled);
      showSnackbar(`Keep as friend ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setKeepAsFriend(!enabled); // rollback
      showSnackbar(err.message, 'error');
    }
  };

  const currentAccount = accounts.find(a => a.account_type === selectedAccount);
  const expansionGroups = groupByExpansion(packs);

  if (loading) {
    return (
      <Box sx={{  }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 2 }} />
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid item xs={6} sm={4} md={3} key={i}>
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <FadeIn>
        <Box sx={{ maxWidth: 800, mx: 'auto', textAlign: 'center', mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          <Typography color="text.secondary">
            Make sure your Discord account is linked and you have registered via Discord.
          </Typography>
        </Box>
      </FadeIn>
    );
  }

  if (accounts.length === 0) {
    return (
      <FadeIn>
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
          <EmptyState
            icon={<HuntIcon sx={{ fontSize: 64 }} />}
            title="No Accounts Found"
            description="Please register your friend code via the Discord bot first using /register."
          />
        </Box>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
    <Box sx={{  }}>
      <PageHeader
        icon={<HuntIcon />}
        title="Hunt Settings"
        subtitle="Configure pack hunting preferences"
        accent={theme.palette.success.main}
      />

      {/* Account Selector + Friend Code */}
      <Box sx={{ ...sectionBox, mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Account</InputLabel>
            <Select
              value={selectedAccount}
              label="Account"
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {accounts.map(a => (
                <MenuItem key={a.account_type} value={a.account_type}>
                  {a.account_type === 'main' ? 'Main Account' : 'Alt Account'}
                  {a.nickname ? ` (${a.nickname})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {currentAccount && (
            <TextField
              size="small"
              label="Friend Code"
              value={currentAccount.friend_code || ''}
              InputProps={{ readOnly: true }}
              helperText="Contact admin to change"
              sx={{ minWidth: 200 }}
            />
          )}

          <Chip
            label={`${joinedPacks.length} pack${joinedPacks.length !== 1 ? 's' : ''} joined`}
            color={joinedPacks.length > 0 ? 'success' : 'default'}
            variant="outlined"
          />

          {containerGroup > 0 && (
            <Tooltip title="Your assigned hunt container group. All containers hunt simultaneously — your god pack notifications come from this group's instances.">
              <Chip
                label={`Container ${containerGroup}`}
                size="small"
                sx={{
                  fontWeight: 600,
                  bgcolor: isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(88, 101, 242, 0.08)',
                  color: isDark ? '#7c8aff' : '#5865f2',
                  border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.25)' : 'rgba(88, 101, 242, 0.2)'}`,
                }}
              />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Notification Settings */}
      <Box sx={{ ...sectionBox, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <StarIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Notification Settings
          </Typography>
        </Box>

        {/* God Pack Notifications Toggle */}
        <SettingRow
          icon={<StarIcon sx={{ color: theme.palette.warning.main }} />}
          label="God Pack Notifications"
          description="Receive god pack notifications when a 5-star pack is found"
          control={
            <Switch
              checked={godPackEnabled}
              onChange={handleGodPackToggle}
              color="success"
            />
          }
        />

        <Divider sx={{ my: 2 }} />

        {/* Pseudo God Pack Settings */}
        <SettingRow
          icon={<PseudoIcon sx={{ color: theme.palette.secondary.main }} />}
          label="Pseudo God Packs"
          description="Get notified for near-god packs (e.g. 1/5 or 2/5 rare cards instead of 5/5)"
          control={
            <Switch
              checked={pseudoEnabled}
              onChange={handlePseudoToggle}
              color="secondary"
            />
          }
        />

        {pseudoEnabled && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, pl: 1 }}>
            <Tooltip title="Minimum rare cards to trigger pseudo notification">
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <RareIcon fontSize="small" /> Min rare cards:
              </Typography>
            </Tooltip>
            <ToggleButtonGroup
              value={String(minRareCards)}
              exclusive
              onChange={handleMinRareCardsChange}
              size="small"
            >
              <ToggleButton value="1">1/5</ToggleButton>
              <ToggleButton value="2">2/5</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Keep as Friend */}
        <SettingRow
          icon={<FriendIcon sx={{ color: theme.palette.info.main }} />}
          label="Keep as Friend"
          description="Keep hunt account as friend after claiming god pack as it might reappear"
          control={
            <Switch
              checked={keepAsFriend}
              onChange={handleKeepAsFriendToggle}
              color="primary"
            />
          }
        />
      </Box>

      {/* Pack Grid Header with Join All / Leave All */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Packs ({packs.length}) &mdash; {joinedPacks.filter(jp => packs.some(p => p.name === jp)).length} joined
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="success"
            size="small"
            startIcon={actionLoading === '__all__' ? <CircularProgress size={16} /> : <JoinAllIcon />}
            onClick={handleJoinAll}
            disabled={!!actionLoading || joinedPacks.length === packs.length}
          >
            Join All
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={actionLoading === '__all__' ? <CircularProgress size={16} /> : <LeaveAllIcon />}
            onClick={handleLeaveAll}
            disabled={!!actionLoading || joinedPacks.length === 0}
          >
            Leave All
          </Button>
        </Box>
      </Box>

      {/* Pack Grid grouped by expansion */}
      {statusLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid item xs={6} sm={4} md={3} key={i}>
              <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        expansionGroups.map((group) => (
          <Box key={group.expansion} sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 700, letterSpacing: 1.5 }}>
              {group.expansion}
            </Typography>
            <Grid container spacing={1.5}>
              {group.packs.map((pack) => {
                const joined = isJoined(pack.name);
                const isActing = actionLoading === pack.name;
                return (
                  <Grid item xs={6} sm={4} md={3} key={pack.name}>
                    <Box
                      sx={{
                        borderRadius: '12px',
                        border: joined ? `2px solid ${theme.palette.success.main}` : `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                        bgcolor: joined
                          ? (isDark ? `${theme.palette.success.main}26` : `${theme.palette.success.main}14`)
                          : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'),
                        opacity: isActing ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                        overflow: 'hidden',
                        '&:hover': {
                          borderColor: joined ? theme.palette.success.main : (isDark ? 'rgba(124, 138, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                          bgcolor: joined
                            ? (isDark ? `${theme.palette.success.main}33` : `${theme.palette.success.main}1E`)
                            : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handlePackClick(pack)}
                        disabled={!!actionLoading}
                        aria-label={joined ? `Leave ${pack.label} hunt` : `Join ${pack.label} hunt`}
                      >
                        <CardContent sx={{ py: 1.5, px: 2, textAlign: 'center' }}>
                          {isActing ? (
                            <CircularProgress size={20} sx={{ mb: 0.5, color: joined ? 'success.main' : 'text.secondary' }} />
                          ) : joined ? (
                            <JoinedIcon sx={{ fontSize: 20, mb: 0.5, color: 'success.main' }} />
                          ) : (
                            <JoinIcon sx={{ fontSize: 20, mb: 0.5, opacity: 0.4, color: 'text.secondary' }} />
                          )}
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{ color: joined ? 'success.main' : 'text.primary' }}
                          >
                            {pack.label}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))
      )}

      {/* Confirmation Dialog -- only for bulk actions */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
          <Button onClick={confirmDialog.onConfirm} variant="contained" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  );
}
