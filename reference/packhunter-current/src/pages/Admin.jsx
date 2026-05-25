/**
 * Admin Dashboard - Admin-only control panel
 *
 * Features:
 * - System overview (CPU, memory, uptime)
 * - User management
 * - Discord registration management
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  LinearProgress,
  Paper,
  useTheme,
} from '@mui/material';
import AdminDebugPanel from '../components/AdminDebugPanel';
import AdminSystemSnapshot from '../components/AdminSystemSnapshot';
import AdminRecommendations from '../components/AdminRecommendations';
import InsightCards from '../components/InsightCards';
import {
  Memory as MemoryIcon,
  Storage as StorageIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  MonitorHeart as HealthIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Star as StarIcon,
  CheckCircle as CheckIcon,
  Link as LinkIcon,
  Cloud as CloudIcon,
  Folder as FolderIcon,
  Timer as TimerIcon,
  Style as CardDatabaseIcon,
  SystemUpdateAlt as UpdateIcon,
} from '@mui/icons-material';
import { FadeIn } from '../components/Animations';
import { formatRelativeTime } from '../utils/dateFormat';
import { hunt } from '../services/api';
import PageHeader from '../components/PageHeader';
import { useSectionStyles } from '../components/SectionCard';
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons';

// Format bytes
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format uptime
const formatUptime = (seconds) => {
  if (!seconds) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// API helper
const adminApi = {
  getSystem: () => fetch('/api/admin/system', {
    credentials: 'include'
  }).then(r => r.json()),

  getStats: () => fetch('/api/admin/stats', {
    credentials: 'include'
  }).then(r => r.json()),

  getUsers: () => fetch('/api/admin/users', {
    credentials: 'include'
  }).then(r => r.json()),

  toggleAdmin: (userId, isAdmin) => fetch(`/api/admin/users/${userId}/admin`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isAdmin })
  }).then(r => r.json()),

  getDiscordRegistrations: () => fetch('/api/admin/discord-registrations', {
    credentials: 'include'
  }).then(r => r.json()),

  approveDiscordUser: (discordId, durationDays = 30) => fetch(`/api/admin/discord-registrations/${discordId}/approve`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_days: durationDays })
  }).then(r => r.json()),
};

function Admin({ user }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { sectionBox, tableContainerStyle, tableHeadStyle } = useSectionStyles();

  const [loading, setLoading] = useState(true);
  const [system, setSystem] = useState(null);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [discordRegistrations, setDiscordRegistrations] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cardDbStatus, setCardDbStatus] = useState(null);
  const [cardDbUpdating, setCardDbUpdating] = useState(false);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [systemRes, statsRes, healthRes, usersRes, discordRes, cardDbRes] = await Promise.all([
        adminApi.getSystem(),
        adminApi.getStats(),
        hunt.getSystemHealth().catch(() => null),
        adminApi.getUsers(),
        adminApi.getDiscordRegistrations(),
        fetch('/api/admin/card-database/status', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      ]);

      if (systemRes.success) setSystem(systemRes.system);
      if (statsRes.stats) setStats(statsRes.stats);
      if (healthRes) setHealth(healthRes);
      if (usersRes.users) setUsers(usersRes.users);
      if (discordRes.registrations) setDiscordRegistrations(discordRes.registrations);
      if (cardDbRes) setCardDbStatus(cardDbRes);
    } catch (err) {
      setError('Failed to load admin data');
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    loadData();

    // Auto-refresh every 15 seconds
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [user, loadData, navigate]);

  // Handle admin toggle
  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    try {
      const result = await adminApi.toggleAdmin(userId, !currentIsAdmin);
      if (result.success) {
        setSuccess(result.message);
        loadData();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(`Failed to update admin status: ${err.message}`);
    }
  };

  // Handle Discord user approval
  const handleApproveDiscordUser = async (discordId, discordUsername) => {
    try {
      const result = await adminApi.approveDiscordUser(discordId, 30);
      if (result.success) {
        setSuccess(`Approved ${discordUsername} for 30 days`);
        loadData();
      } else {
        setError(result.error || 'Failed to approve user');
      }
    } catch (err) {
      setError(`Failed to approve user: ${err.message}`);
    }
  };

  // Handle card database update
  const handleCardDbUpdate = async () => {
    try {
      setCardDbUpdating(true);
      const res = await fetch('/api/admin/card-database/update', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Card DB updated: ${data.oldVersion} → ${data.newVersion} | +${data.sync.added} new, ~${data.sync.updated} updated`);
        // Refresh status
        const statusRes = await fetch('/api/admin/card-database/status', { credentials: 'include' }).then(r => r.json());
        setCardDbStatus(statusRes);
      } else {
        setError(data.error || 'Update failed');
      }
    } catch (err) {
      setError(`Card DB update failed: ${err.message}`);
    } finally {
      setCardDbUpdating(false);
    }
  };

  if (!user?.isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Admin access required</Alert>
      </Box>
    );
  }

  return (
    <FadeIn>
    <Box>
      {/* Page Header */}
      <PageHeader
        icon={<AdminIcon />}
        title="Admin Dashboard"
        subtitle="System monitoring and administration"
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {loading && !system ? (
        <TablePageSkeleton />
      ) : (
        <Grid container spacing={3}>
          {/* Quick Stats — inline metric strip */}
          <Grid item xs={12}>
            <Box sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              overflow: 'hidden',
            }}>
              {[
                { icon: <PeopleIcon sx={{ fontSize: 16 }} />, value: stats?.registeredUsers || 0, label: 'Users', color: 'primary.main' },
                { icon: <LinkIcon sx={{ fontSize: 16 }} />, value: stats?.linkedAccounts || 0, label: 'Linked', color: 'success.main' },
                { icon: <StarIcon sx={{ fontSize: 16 }} />, value: stats?.activeSubscribers || 0, label: 'Subscribers', color: 'warning.main' },
                { icon: <MemoryIcon sx={{ fontSize: 16 }} />, value: `${system?.memoryUsagePercent || 0}%`, label: 'Memory', color: 'info.main' },
                { icon: <TimerIcon sx={{ fontSize: 16 }} />, value: formatUptime(health?.uptime), label: 'Uptime', color: 'success.main' },
                { icon: <StorageIcon sx={{ fontSize: 16 }} />, value: health?.database === 'connected' ? 'OK' : 'Error', label: 'Database', color: health?.database === 'connected' ? 'success.main' : 'error.main' },
              ].map((m, i, arr) => (
                <Box key={m.label} sx={{
                  flex: '1 1 auto',
                  minWidth: { xs: '33%', sm: 'auto' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.5,
                  py: 1.5,
                  borderRight: { xs: 'none', sm: i < arr.length - 1 ? `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}` : 'none' },
                  borderBottom: { xs: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}`, sm: 'none' },
                }}>
                  <Box sx={{ color: m.color }}>{m.icon}</Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700} lineHeight={1}>{m.value}</Typography>
                    <Typography variant="caption" color="text.secondary" lineHeight={1.2}>{m.label}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Grid>

          {/* System Health */}
          <Grid item xs={12}>
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <HealthIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" fontWeight={600}>System Health</Typography>
              </Box>
              {system && (
                <Typography variant="caption" color="text.secondary">
                  {system.hostname} &middot; {system.platform} {system.arch} ({system.cpus} CPUs) &middot; Node {system.nodeVersion} (PID: {system.pid})
                </Typography>
              )}
            </Box>

            <Grid container spacing={2}>
              {/* Resource Usage Card */}
              <Grid item xs={12} md={6}>
                <Box sx={sectionBox}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <MemoryIcon sx={{ fontSize: 18, color: 'info.main' }} />
                    <Typography variant="subtitle2" fontWeight={600}>Resource Usage</Typography>
                  </Box>
                  {(() => {
                    const memory = health?.memory || {};
                    const heapPercent = memory.heapTotal ? Math.round((memory.heapUsed / memory.heapTotal) * 100) : 0;
                    return (
                      <TableContainer>
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>Heap Used</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">{formatBytes(memory.heapUsed)}</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75, width: '40%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <LinearProgress variant="determinate" value={heapPercent} sx={{ flexGrow: 1, height: 6, borderRadius: 3 }} />
                                  <Typography variant="caption" sx={{ minWidth: 32 }}>{heapPercent}%</Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>Heap Total</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">{formatBytes(memory.heapTotal)}</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>RSS Memory</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">{formatBytes(memory.rss)}</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>External</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">{formatBytes(memory.external)}</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>Array Buffers</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">{formatBytes(memory.arrayBuffers)}</TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <FolderIcon sx={{ fontSize: 14, color: 'text.secondary' }} /> Logs Dir
                                </Box>
                              </TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">
                                <Chip label={health?.logsDir ? 'OK' : 'Missing'} color={health?.logsDir ? 'success' : 'error'} size="small" />
                              </TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ border: 0, pl: 0, py: 0.75 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <FolderIcon sx={{ fontSize: 14, color: 'text.secondary' }} /> Data Dir
                                </Box>
                              </TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} align="right">
                                <Chip label={health?.dataDir ? 'OK' : 'Missing'} color={health?.dataDir ? 'success' : 'error'} size="small" />
                              </TableCell>
                              <TableCell sx={{ border: 0, py: 0.75 }} />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    );
                  })()}
                </Box>
              </Grid>

              {/* Proxy Pool Status Card */}
              <Grid item xs={12} md={6}>
                <Box sx={sectionBox}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CloudIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight={600}>Proxy Pool Status</Typography>
                  </Box>
                  {health?.proxyPool?.error ? (
                    <Alert severity="warning" sx={{ mb: 1 }}>{health.proxyPool.error}</Alert>
                  ) : (
                    <Grid container spacing={2}>
                      {[
                        { label: 'Total', value: health?.proxyPool?.totalProxies || 0, color: 'primary.main' },
                        { label: 'Available', value: health?.proxyPool?.availableProxies || 0, color: 'success.main' },
                        { label: 'In Use', value: health?.proxyPool?.inUseProxies || 0, color: 'warning.main' },
                        { label: 'Queue', value: health?.proxyPool?.queueLength || 0, color: 'info.main' },
                      ].map(({ label, value, color }) => (
                        <Grid item xs={6} key={label}>
                          <Box sx={{
                            textAlign: 'center',
                            p: 1.5,
                            borderRadius: '10px',
                            border: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
                            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                          }}>
                            <Typography variant="h4" fontWeight={700} sx={{ color }}>{value}</Typography>
                            <Typography variant="body2" color="text.secondary">{label}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Card Database */}
          <Grid item xs={12}>
            <Box sx={sectionBox}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CardDatabaseIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Typography variant="subtitle2" fontWeight={600}>Card Database</Typography>
                </Box>
                <Button
                  size="small"
                  variant={cardDbStatus?.updateAvailable ? 'contained' : 'outlined'}
                  color={cardDbStatus?.updateAvailable ? 'warning' : 'primary'}
                  startIcon={cardDbUpdating ? <CircularProgress size={14} /> : <UpdateIcon />}
                  onClick={handleCardDbUpdate}
                  disabled={cardDbUpdating}
                >
                  {cardDbUpdating ? 'Updating...' : cardDbStatus?.updateAvailable ? `Update to v${cardDbStatus.latest}` : 'Check & Sync'}
                </Button>
              </Box>
              {cardDbStatus ? (
                <Grid container spacing={2}>
                  {[
                    { label: 'Installed', value: `v${cardDbStatus.installed}`, color: 'primary.main' },
                    { label: 'Latest', value: `v${cardDbStatus.latest}`, color: cardDbStatus.updateAvailable ? 'warning.main' : 'success.main' },
                    { label: 'Package Cards', value: cardDbStatus.packageCards, color: 'info.main' },
                    { label: 'DB Cards', value: cardDbStatus.databaseCards, color: 'text.primary' },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={3} key={label}>
                      <Box sx={{ textAlign: 'center', p: 1, borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.05)'}` }}>
                        <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="caption" color="text.secondary">Loading...</Typography>
              )}
            </Box>
          </Grid>

          {/* Recent Users */}
          <Grid item xs={12}>
            <Box sx={sectionBox}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PeopleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" fontWeight={600}>Recent Users</Typography>
              </Box>
                <TableContainer sx={tableContainerStyle}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={tableHeadStyle}>
                        <TableCell>Username</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Discord</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Last Login</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.slice(0, 10).map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PersonIcon fontSize="small" color="action" />
                              <Typography fontWeight={u.is_admin ? 'bold' : 'normal'}>
                                {u.username}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{u.email || '-'}</TableCell>
                          <TableCell>
                            {u.discord_username ? (
                              <Box>
                                <Typography variant="body2">{u.discord_username}</Typography>
                                {u.discord_id && (
                                  <Typography variant="caption" color="text.secondary">
                                    {u.discord_id}
                                  </Typography>
                                )}
                              </Box>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.is_owner ? 'Owner' : u.is_admin ? 'Admin' : 'User'}
                              color={u.is_owner ? 'warning' : u.is_admin ? 'primary' : 'default'}
                              size="small"
                              sx={u.is_owner ? { fontWeight: 'bold' } : {}}
                            />
                          </TableCell>
                          <TableCell>{formatRelativeTime(u.created_at)}</TableCell>
                          <TableCell>{u.last_login_at ? formatRelativeTime(u.last_login_at) : '-'}</TableCell>
                          <TableCell align="right">
                            <Tooltip title={u.is_owner ? 'Owner (protected)' : u.is_admin ? 'Revoke Admin' : 'Grant Admin'}>
                              <IconButton
                                size="small"
                                color={u.is_admin ? 'warning' : 'default'}
                                aria-label={u.is_owner ? 'Owner (protected)' : u.is_admin ? 'Revoke admin' : 'Grant admin'}
                                onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                                disabled={u.id === user.id || u.is_owner}
                              >
                                <AdminIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {users.length > 10 && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Button
                      size="small"
                      onClick={() => navigate('/admin/users')}
                    >
                      View All {users.length} Users
                    </Button>
                  </Box>
                )}
            </Box>
          </Grid>

          {/* Discord Registrations */}
          <Grid item xs={12}>
            <Box sx={sectionBox}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <PeopleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" fontWeight={600}>Discord Bot Registrations</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Users who registered their friend code via the Discord /register command
              </Typography>
                <TableContainer sx={tableContainerStyle}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={tableHeadStyle}>
                        <TableCell>Discord User</TableCell>
                        <TableCell>Friend Code</TableCell>
                        <TableCell>Player ID</TableCell>
                        <TableCell>Registered</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discordRegistrations.slice(0, 10).map((reg) => (
                        <TableRow key={reg.discord_id}>
                          <TableCell>
                            <Typography fontWeight="bold">{reg.discord_username}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {reg.discord_id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <code style={{ fontSize: '0.85em' }}>{reg.friend_code}</code>
                          </TableCell>
                          <TableCell>
                            {reg.player_id ? (
                              <Chip label="Verified" color="success" size="small" />
                            ) : reg.friend_code ? (
                              <Chip label="Linked" color="info" size="small" />
                            ) : (
                              <Chip label="Pending" color="warning" size="small" />
                            )}
                          </TableCell>
                          <TableCell>{formatRelativeTime(reg.registered_at)}</TableCell>
                          <TableCell>
                            {reg.is_paid ? (
                              <Chip
                                icon={<CheckIcon />}
                                label="Paid"
                                color="success"
                                size="small"
                              />
                            ) : (
                              <Chip label="Free" color="default" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {!reg.is_paid && (
                              <Tooltip title="Approve as Paid (30 days)">
                                <IconButton
                                  size="small"
                                  color="success"
                                  aria-label="Approve as paid"
                                  onClick={() => handleApproveDiscordUser(reg.discord_id, reg.discord_username)}
                                >
                                  <StarIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {discordRegistrations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography color="text.secondary">No Discord registrations yet</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                {discordRegistrations.length > 10 && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Showing 10 of {discordRegistrations.length} registrations
                    </Typography>
                  </Box>
                )}
            </Box>
          </Grid>
        </Grid>
      )}

      {/* Snackbars */}
      {/* ── Admin Dashboard v2: Snapshot → Insights → Debug ── */}

      {/* ROW 1: System Snapshot */}
      <Paper sx={{ p: 2.5, mt: 3, borderRadius: '12px' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
          System Snapshot (24h)
        </Typography>
        <AdminSystemSnapshot />
      </Paper>

      {/* ROW 2: Recommendations + Insights */}
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
            <AdminRecommendations />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
              Insights
            </Typography>
            <InsightCards isAdmin />
          </Paper>
        </Grid>
      </Grid>

      {/* ROW 3: Debug Table */}
      <Paper sx={{ p: 2.5, mt: 2, borderRadius: '12px' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
          Request Inspector
        </Typography>
        <AdminDebugPanel />
      </Paper>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        message={success}
      />
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

export default Admin;
