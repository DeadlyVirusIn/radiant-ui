/**
 * AdminDebugUserDialog — Fullscreen debug panel for inspecting user accounts, friends, and bot status.
 * Extracted from AdminUsers.jsx. Self-contained — owns all debug-specific state and async logic.
 */

import { useState, useEffect, forwardRef } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress, Paper, Alert,
  Dialog, AppBar, Toolbar, IconButton, Tabs, Tab, Slide, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Close as CloseIcon, Group as GroupIcon, SmartToy as BotIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import adminApi from './adminUsersApi';
import { formatRelativeTime } from '../../utils/dateFormat';

const SlideTransition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function AdminDebugUserDialog({ open, user, onClose, setError, setSuccess }) {
  const [tab, setTab] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [friends, setFriends] = useState(null);
  const [botStatus, setBotStatus] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState({ accounts: false, friends: false, bot: false, clearing: false });

  // Load data when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    setTab(0);
    setFriends(null);
    setBotStatus(null);
    setAccounts([]);
    setSelectedAccount('');
    setLoading({ accounts: true, friends: false, bot: true, clearing: false });

    (async () => {
      try {
        const [accountsRes, botRes] = await Promise.all([
          adminApi.getUserAccounts(user.id).catch(() => ({ accounts: [] })),
          adminApi.getUserBotStatus(user.id).catch(() => ({ instances: [], recentLogs: [] })),
        ]);
        const accts = accountsRes.accounts || [];
        setAccounts(accts);
        setBotStatus(botRes);
        if (accts.length > 0) setSelectedAccount(accts[0].id);
      } catch (err) {
        setError(`Failed to load debug data: ${err.message}`);
      } finally {
        setLoading(prev => ({ ...prev, accounts: false, bot: false }));
      }
    })();
  }, [open, user]);

  const handleFetchFriends = async () => {
    if (!user || !selectedAccount) return;
    setLoading(prev => ({ ...prev, friends: true }));
    setFriends(null);
    try {
      const result = await adminApi.getUserFriends(user.id, selectedAccount);
      setFriends(result);
    } catch (err) {
      setError(`Failed to fetch friends: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, friends: false }));
    }
  };

  const handleClearFriends = async () => {
    if (!user || !selectedAccount) return;
    if (!friends) { setError('Fetch friends first to see what will be removed'); return; }
    if (!window.confirm(`Remove friends from ${user.username}'s account?\n\nGodpack finders and favorites will be kept.`)) return;

    setLoading(prev => ({ ...prev, clearing: true }));
    try {
      const result = await adminApi.clearUserFriends(user.id, selectedAccount);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Removed ${result.removed} friends, cancelled ${result.cancelledSent} sent requests. Kept ${result.kept} (${result.keptReasons?.favorites || 0} favorites, ${result.keptReasons?.godpacks || 0} godpacks).`);
        handleFetchFriends();
      }
    } catch (err) {
      setError(`Failed to clear friends: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, clearing: false }));
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog fullScreen open={open} onClose={handleClose} TransitionComponent={SlideTransition}>
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="Close debug panel">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6">
            Debug: {user?.username} ({user?.discord_username})
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto', width: '100%' }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab icon={<GroupIcon />} label="Game Friends" />
          <Tab icon={<BotIcon />} label="Bot Manager" />
        </Tabs>

        {/* Friends Tab */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
              <FormControl sx={{ minWidth: 300 }} size="small">
                <InputLabel>Account</InputLabel>
                <Select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} label="Account" disabled={loading.accounts}>
                  {accounts.map(acc => (
                    <MenuItem key={acc.id} value={acc.id}>
                      {acc.display_name || acc.nickname || acc.device_name || `Account #${acc.id}`}
                      {acc.player_id ? ` (${acc.player_id.substring(0, 8)}...)` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={handleFetchFriends} disabled={!selectedAccount || loading.friends}
                startIcon={loading.friends ? <CircularProgress size={16} /> : <GroupIcon />}>Fetch Friends</Button>
              <Button variant="outlined" color="error" size="small" onClick={handleClearFriends}
                disabled={!selectedAccount || !friends || loading.clearing}
                startIcon={loading.clearing ? <CircularProgress size={16} /> : <DeleteIcon />}>
                {loading.clearing ? 'Clearing...' : 'Remove All (Keep Godpacks & Favorites)'}
              </Button>
              {accounts.length === 0 && !loading.accounts && (
                <Alert severity="warning" sx={{ flex: 1 }}>No linked accounts found for this user</Alert>
              )}
            </Box>

            {friends && (
              <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                  {friends.total}/{friends.maxFriends} friends | {friends.receivedRequests?.length || 0} received requests | {friends.sentRequests?.length || 0} sent requests
                </Alert>

                {/* Accepted Friends */}
                <Typography variant="h6" sx={{ mb: 1 }}>Accepted Friends ({friends.friends?.length || 0})</Typography>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Player Name</TableCell>
                        <TableCell>Player ID</TableCell>
                        <TableCell>Friend Code</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Last Online</TableCell>
                        <TableCell>Added</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(friends.friends || []).map((f, i) => (
                        <TableRow key={i}>
                          <TableCell><Typography fontWeight="bold">{f.playerName}</Typography></TableCell>
                          <TableCell><code style={{ fontSize: '0.8em' }}>{f.playerId || '-'}</code></TableCell>
                          <TableCell><code style={{ fontSize: '0.8em' }}>{f.friendCode || '-'}</code></TableCell>
                          <TableCell>{f.playerLevel || '-'}</TableCell>
                          <TableCell>{f.lastOnline ? formatRelativeTime(f.lastOnline) : '-'}</TableCell>
                          <TableCell>{f.addedAt ? formatRelativeTime(f.addedAt) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      {(!friends.friends || friends.friends.length === 0) && (
                        <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">No accepted friends</Typography></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Received Requests */}
                <Typography variant="h6" sx={{ mb: 1 }}>Received Requests ({friends.receivedRequests?.length || 0})</Typography>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>Player Name</TableCell><TableCell>Player ID</TableCell><TableCell>Friend Code</TableCell><TableCell>Requested At</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {(friends.receivedRequests || []).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell><Typography fontWeight="bold">{r.playerName}</Typography></TableCell>
                          <TableCell><code style={{ fontSize: '0.8em' }}>{r.playerId || '-'}</code></TableCell>
                          <TableCell><code style={{ fontSize: '0.8em' }}>{r.friendCode || '-'}</code></TableCell>
                          <TableCell>{r.requestedAt ? formatRelativeTime(r.requestedAt) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      {(!friends.receivedRequests || friends.receivedRequests.length === 0) && (
                        <TableRow><TableCell colSpan={4} align="center"><Typography color="text.secondary">No received requests</Typography></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Sent Requests */}
                <Typography variant="h6" sx={{ mb: 1 }}>Sent Requests ({friends.sentRequests?.length || 0})</Typography>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>Player Name</TableCell><TableCell>Player ID</TableCell><TableCell>Friend Code</TableCell><TableCell>Requested At</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {(friends.sentRequests || []).map((s, i) => (
                        <TableRow key={i}>
                          <TableCell><Typography fontWeight="bold">{s.playerName}</Typography></TableCell>
                          <TableCell><code style={{ fontSize: '0.8em' }}>{s.playerId || '-'}</code></TableCell>
                          <TableCell><code style={{ fontSize: '0.8em' }}>{s.friendCode || '-'}</code></TableCell>
                          <TableCell>{s.requestedAt ? formatRelativeTime(s.requestedAt) : '-'}</TableCell>
                        </TableRow>
                      ))}
                      {(!friends.sentRequests || friends.sentRequests.length === 0) && (
                        <TableRow><TableCell colSpan={4} align="center"><Typography color="text.secondary">No sent requests</Typography></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {!friends && !loading.friends && selectedAccount && (
              <Alert severity="info">Click &quot;Fetch Friends&quot; to load the game friends list for this account.</Alert>
            )}
          </Box>
        )}

        {/* Bot Manager Tab */}
        {tab === 1 && (
          <Box>
            {loading.bot ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : botStatus ? (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Bot Instances ({botStatus.instanceCount || 0})</Typography>
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead><TableRow>
                      <TableCell>Type</TableCell><TableCell>Account</TableCell><TableCell>Status</TableCell>
                      <TableCell>Started</TableCell><TableCell>Stopped</TableCell><TableCell>Stats</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {(botStatus.instances || []).map((inst, i) => (
                        <TableRow key={i}>
                          <TableCell><Chip label={inst.bot_type || 'unknown'} size="small" color="primary" variant="outlined" /></TableCell>
                          <TableCell>{inst.display_name || inst.nickname || inst.device_name || '-'}</TableCell>
                          <TableCell><Chip label={inst.status} size="small" color={inst.status === 'running' ? 'success' : inst.status === 'stopped' ? 'default' : 'warning'} /></TableCell>
                          <TableCell>{inst.started_at ? formatRelativeTime(inst.started_at) : '-'}</TableCell>
                          <TableCell>{inst.stopped_at ? formatRelativeTime(inst.stopped_at) : '-'}</TableCell>
                          <TableCell>{inst.stats ? <code style={{ fontSize: '0.75em' }}>{typeof inst.stats === 'string' ? inst.stats : JSON.stringify(inst.stats)}</code> : '-'}</TableCell>
                        </TableRow>
                      ))}
                      {(!botStatus.instances || botStatus.instances.length === 0) && (
                        <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">No bot instances</Typography></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" sx={{ mb: 2 }}>Recent Logs ({botStatus.recentLogs?.length || 0})</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead><TableRow>
                      <TableCell sx={{ width: 160 }}>Timestamp</TableCell>
                      <TableCell sx={{ width: 80 }}>Level</TableCell>
                      <TableCell sx={{ width: 80 }}>Type</TableCell>
                      <TableCell>Message</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {(botStatus.recentLogs || []).map((log, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75em' }}>
                            {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Chip label={log.level} size="small" color={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : log.level === 'info' ? 'info' : 'default'} />
                          </TableCell>
                          <TableCell><Typography variant="caption">{log.bot_type || '-'}</Typography></TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{
                              fontFamily: 'monospace', fontSize: '0.8em',
                              color: log.level === 'error' ? 'error.main' : log.level === 'warn' ? 'warning.main' : 'text.primary',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                            }}>{log.message}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!botStatus.recentLogs || botStatus.recentLogs.length === 0) && (
                        <TableRow><TableCell colSpan={4} align="center"><Typography color="text.secondary">No recent logs</Typography></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              <Alert severity="info">No bot status data available for this user.</Alert>
            )}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
