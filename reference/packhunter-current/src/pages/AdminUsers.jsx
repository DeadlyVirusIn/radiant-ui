/**
 * Admin User Management - Full user management page
 *
 * Features:
 * - View all registered users
 * - Grant/revoke admin privileges
 * - Manage Discord roles
 * - Manage WebUI permissions
 * - Delete users
 */

import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Tabs,
  Tab,
  InputAdornment,
  AppBar,
  Toolbar,
  Slide,
  Divider,
  TableSortLabel,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Star as StarIcon,
  CheckCircle as CheckIcon,
  Block as BlockIcon,
  ArrowBack as BackIcon,
  People as PeopleIcon,
  HelpOutline as HelpIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Warning as WarningIcon,
  SmartToy as BotIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  CreditCard as CreditCardIcon,
  PersonOff as PersonOffIcon,
  BugReport as BugIcon,
  Close as CloseIcon,
  Group as GroupIcon,
  Add as AddIcon,
  CallMerge as MergeIcon,
  ContentCopy as DuplicateIcon,
  CleaningServices as CleanIcon,
  CardGiftcard as TrialIcon,
} from '@mui/icons-material';
import { FadeIn } from '../components/Animations';
import { formatRelativeTime } from '../utils/dateFormat';
import { EmptyState } from '../components/EmptyState';
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons';
import { useSectionStyles } from '../components/SectionCard';
import adminApi from './admin/adminUsersApi';
import useAdminUsers from './admin/useAdminUsers';
// Phase 2: Subscribers merged into Users — AdminSubscribersTab no longer mounted
// (file retained on disk for diff history; not imported).
import AdminHuntParticipantsTab from './admin/AdminHuntParticipantsTab';
import AdminEditUserDialog from './admin/AdminEditUserDialog';
import AdminDebugUserDialog from './admin/AdminDebugUserDialog';
import AdminUsersTab from './admin/AdminUsersTab';
import {
  DeleteUserDialog,
  StopAllBotsDialog,
  StartAllBotsDialog,
  AdminToggleDialog,
  GrantTrialDialog,
} from './admin/AdminSimpleDialogs';

function AdminUsers({ user }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { sectionBox, tableContainerStyle, tableHeadStyle } = useSectionStyles();

  const {
    loading, users, unregisteredSubs, userSummary, subscribers, huntParticipants,
    tab, setTab, search, setSearch, error, setError, success, setSuccess,
    filteredUsers, filteredHuntParticipants,
    userFilterRole, setUserFilterRole,
    userFilterPlan, setUserFilterPlan,
    hunterStateFilter, setHunterStateFilter,
    userSortBy, userSortOrder, handleUserSort,
    botStatuses, actionLoading, friendCounts,
    dataIssues, dataIssuesExpanded, setDataIssuesExpanded, dataIssuesLoading,
    showTestUsers, setShowTestUsers,
    loadData, loadDataIssues, refreshUsers, refreshSubscribers, refreshHuntParticipants,
    handleToggleActive, handleToggleHuntParticipant,
    fetchBotStatus, handleStartBot, handleStopBot, fetchFriendCount,
    handleRemoveSubscriber,
  } = useAdminUsers(user, navigate);

  // Dialog state (stays in component)
  const [editDialog, setEditDialog] = useState({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null, loading: false });
  const [adminDialog, setAdminDialog] = useState({ open: false, user: null, newIsAdmin: false });
  const [stopAllBotsDialog, setStopAllBotsDialog] = useState(false);
  const [stopAllBotsLoading, setStopAllBotsLoading] = useState(false);
  const [startAllBotsDialog, setStartAllBotsDialog] = useState(false);
  const [startAllBotsLoading, setStartAllBotsLoading] = useState(false);
  const [addSubDialog, setAddSubDialog] = useState({ open: false });
  const [subForm, setSubForm] = useState({ discord_username: '', discord_id: '', duration_days: 30, subscription_tier: 'premium' });

  // Add pack dialog state
  const [addPackDialog, setAddPackDialog] = useState({ open: false, participant: null });
  const [addPackName, setAddPackName] = useState('');
  const [availablePacks, setAvailablePacks] = useState([]);
  const [addPackLoading, setAddPackLoading] = useState(false);

  // Debug dialog state (internal state owned by dialog component)
  const [debugDialog, setDebugDialog] = useState({ open: false, user: null });

  // Clear friends state
  const [clearFriendsDialog, setClearFriendsDialog] = useState({ open: false, participant: null });
  const [clearFriendsLoading, setClearFriendsLoading] = useState(false);
  const [clearFriendsResult, setClearFriendsResult] = useState(null);

  // Duplicate merge dialog state
  const [dupeDialog, setDupeDialog] = useState({ open: false, loading: false, duplicates: [] });
  const [mergeLoading, setMergeLoading] = useState(false);

  // Edit user dialog state (form state is owned by the dialog component)
  const [editUserDialog, setEditUserDialog] = useState({ open: false, user: null });

  // Trial dialog state
  const [trialDialog, setTrialDialog] = useState({ open: false, user: null });
  const [trialDays, setTrialDays] = useState(14);
  const [trialNotes, setTrialNotes] = useState('');
  const [trialSaving, setTrialSaving] = useState(false);


  // Handle admin toggle - opens confirmation dialog first
  const handleToggleAdmin = (userId, currentIsAdmin) => {
    const targetUser = users.find(u => u.id === userId);
    setAdminDialog({ open: true, user: targetUser, newIsAdmin: !currentIsAdmin });
  };

  const handleConfirmToggleAdmin = async () => {
    if (!adminDialog.user) return;
    try {
      const result = await adminApi.toggleAdmin(adminDialog.user.id, adminDialog.newIsAdmin);
      if (result.success) {
        setSuccess(result.message);
        setAdminDialog({ open: false, user: null, newIsAdmin: false });
        refreshUsers();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(`Failed to update admin status: ${err.message}`);
    }
  };

  // Handle stop all friend bots
  const handleStopAllBots = async () => {
    try {
      setStopAllBotsLoading(true);
      const result = await adminApi.forceStopAllBots();
      if (result.success) {
        setSuccess(result.message || 'All friend bots stopped');
        setStopAllBotsDialog(false);
        refreshHuntParticipants();
      } else {
        setError(result.error || 'Failed to stop bots');
      }
    } catch (err) {
      setError(`Failed to stop all bots: ${err.message}`);
    } finally {
      setStopAllBotsLoading(false);
    }
  };

  // Handle start all active bots
  const handleStartAllBots = async () => {
    try {
      setStartAllBotsLoading(true);
      const result = await adminApi.startAllActiveBots();
      if (result.success) {
        setSuccess(result.message || 'Bots started for active participants');
        setStartAllBotsDialog(false);
        refreshHuntParticipants();
      } else {
        setError(result.error || 'Failed to start bots');
      }
    } catch (err) {
      setError(`Failed to start all bots: ${err.message}`);
    } finally {
      setStartAllBotsLoading(false);
    }
  };

  // Handle delete user
  // Phase 18 — hardened:
  //   - prevents double-submit via deleteDialog.loading
  //   - deletes by canonical numeric ID (not row index or username)
  //   - surfaces backend detail (admin-only route, safe to show)
  //   - closes modal only on success
  const handleDeleteUser = async () => {
    const target = deleteDialog.user;
    if (!target?.id) {
      setError('Delete blocked: missing user ID');
      return;
    }
    if (deleteDialog.loading) return;            // double-click guard

    setDeleteDialog(prev => ({ ...prev, loading: true }));
    try {
      const result = await adminApi.deleteUser(target.id);
      if (result.success) {
        setSuccess(`User ${target.username} deleted`);
        setDeleteDialog({ open: false, user: null, loading: false });
        refreshUsers();
      } else {
        // Keep modal open, surface the real reason.
        setError(result.detail ? `${result.error}: ${result.detail}` : (result.error || 'Failed to delete user'));
        setDeleteDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.data?.detail;
      setError(`Failed to delete user${detail ? `: ${detail}` : `: ${err.message}`}`);
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // Handle add subscriber
  const handleAddSubscriber = async () => {
    try {
      const result = await adminApi.addSubscriber({
        discord_username: subForm.discord_username,
        discord_id: subForm.discord_id,
        duration_days: subForm.duration_days,
        source: subForm.source || 'crypto',
        subscription_tier: subForm.subscription_tier || 'premium',
      });
      if (result.success) {
        setSuccess('Subscriber added successfully');
        setAddSubDialog({ open: false });
        setSubForm({ discord_username: '', discord_id: '', duration_days: 30, source: 'crypto', subscription_tier: 'premium' });
        refreshSubscribers();
      } else {
        setError(result.error || 'Failed to add subscriber');
      }
    } catch (err) {
      setError(`Failed to add subscriber: ${err.message}`);
    }
  };

  // Handle find duplicate subscribers
  const handleFindDuplicates = async () => {
    setDupeDialog({ open: true, loading: true, duplicates: [] });
    try {
      const result = await adminApi.findDuplicateSubscribers();
      setDupeDialog({ open: true, loading: false, duplicates: result.duplicates || [] });
    } catch (err) {
      setError(`Failed to find duplicates: ${err.message}`);
      setDupeDialog({ open: false, loading: false, duplicates: [] });
    }
  };

  // Handle merge two subscribers
  const handleMergeSubscribers = async (keepId, removeId) => {
    setMergeLoading(true);
    try {
      const result = await adminApi.mergeSubscribers(keepId, removeId);
      if (result.success) {
        setSuccess(result.message || 'Subscribers merged successfully');
        // Remove the merged pair from the duplicates list
        setDupeDialog(prev => ({
          ...prev,
          duplicates: prev.duplicates.filter(d =>
            !(d.entryA.id === keepId || d.entryA.id === removeId || d.entryB.id === keepId || d.entryB.id === removeId)
          ),
        }));
        refreshSubscribers();
      } else {
        setError(result.error || 'Failed to merge subscribers');
      }
    } catch (err) {
      setError(`Failed to merge: ${err.message}`);
    } finally {
      setMergeLoading(false);
    }
  };

  // Handle open add-pack dialog
  const handleOpenAddPack = async (participant) => {
    setAddPackDialog({ open: true, participant });
    setAddPackName('');
    try {
      const result = await adminApi.getAvailablePacks();
      if (result.packs) {
        setAvailablePacks(result.packs);
      }
    } catch (err) {
      console.error('Failed to load packs:', err);
    }
  };

  // Handle add pack submit
  const handleAddPack = async () => {
    if (!addPackName || !addPackDialog.participant) return;
    try {
      setAddPackLoading(true);
      const result = await adminApi.addHuntPack(addPackDialog.participant.discord_id, addPackName, addPackDialog.participant.account_type);
      if (result.success) {
        setSuccess(result.message);
        setAddPackDialog({ open: false, participant: null });
        refreshHuntParticipants();
      } else {
        setError(result.error || 'Failed to add pack');
      }
    } catch (err) {
      setError(`Failed to add pack: ${err.message}`);
    } finally {
      setAddPackLoading(false);
    }
  };

  const handleClearHuntFriends = async (participant) => {
    setClearFriendsLoading(true);
    setClearFriendsResult(null);
    try {
      const result = await adminApi.clearFriends(participant.player_id);
      setClearFriendsResult(result);
      if (result.success) {
        setSuccess(`Cleared ${result.removed} friends for ${participant.discord_username} (${result.remaining} remaining, ${result.protected} protected)`);
        // Refresh friend count
        fetchFriendCount(participant.player_id, participant.account_type || 'main');
      } else {
        setError(result.error || 'Failed to clear friends');
      }
    } catch (err) {
      setError(`Failed to clear friends: ${err.message}`);
    } finally {
      setClearFriendsLoading(false);
    }
  };

  // Debug dialog — simplified open/close (all internal state owned by dialog component)
  const handleOpenDebug = (u) => setDebugDialog({ open: true, user: u });
  const handleCloseDebug = () => setDebugDialog({ open: false, user: null });

  // Edit User Dialog — open handler (dialog owns its own form state)
  const handleOpenEditUser = (u) => {
    setEditUserDialog({ open: true, user: u });
  };

  // === Grant Trial Handlers ===
  const handleOpenTrialDialog = (u) => {
    setTrialDays(14);
    setTrialNotes('');
    setTrialDialog({ open: true, user: u });
  };

  const handleGrantTrial = async () => {
    const u = trialDialog.user;
    if (!u) return;
    setTrialSaving(true);
    try {
      const res = await adminApi.grantTrial(u.id, trialDays, trialNotes);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.message || `${trialDays}-day trial granted to ${u.username}`);
        setTrialDialog({ open: false, user: null });
        loadData();
      }
    } catch (err) {
      setError(`Grant trial failed: ${err.message}`);
    } finally {
      setTrialSaving(false);
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton size="small" onClick={() => navigate('/admin')} aria-label="Go back to admin">
          <BackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <PageHeader
            icon={<PeopleIcon />}
            title="User Management"
            subtitle="Manage users, admins, and paid subscribers"
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
        </Box>
      </Box>

      {/* Help Info */}
      <Alert severity="info" sx={{ mb: 3 }} icon={<HelpIcon />}>
        <Typography variant="body2" component="div">
          <strong>User Management Guide:</strong>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            <li><strong>Admin Toggle:</strong> Grant or revoke admin permissions. Owner accounts are protected</li>
            <li><strong>Paid Subscribers:</strong> Add Discord users as paid subscribers manually or via Discord role sync</li>
            <li><strong>Delete User:</strong> Permanently removes user and unlinks all their accounts</li>
          </Box>
        </Typography>
      </Alert>

      {/* Data Issues Banner */}
      {dataIssues.summary.total > 0 && (
        <Alert
          severity={dataIssues.summary.errors > 0 ? 'error' : 'warning'}
          sx={{ mb: 3, cursor: 'pointer' }}
          icon={<WarningIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setDataIssuesExpanded(!dataIssuesExpanded)}
            >
              {dataIssuesExpanded ? 'Collapse' : 'Expand'}
            </Button>
          }
          onClick={() => setDataIssuesExpanded(!dataIssuesExpanded)}
        >
          <Typography variant="body2" fontWeight="bold">
            {dataIssues.summary.total} data issue{dataIssues.summary.total !== 1 ? 's' : ''} found
            {dataIssues.summary.errors > 0 && ` (${dataIssues.summary.errors} error${dataIssues.summary.errors !== 1 ? 's' : ''})`}
            {dataIssues.summary.warnings > 0 && ` (${dataIssues.summary.warnings} warning${dataIssues.summary.warnings !== 1 ? 's' : ''})`}
          </Typography>
          {dataIssuesExpanded && (
            <Box sx={{ mt: 1 }}>
              {dataIssues.issues.map((issue, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                  <Chip
                    label={issue.severity}
                    size="small"
                    color={issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}
                    sx={{ minWidth: 60 }}
                  />
                  <Typography variant="caption" sx={{ flex: 1 }}>{issue.message}</Typography>
                  {issue.user_id && (
                    <Button
                      size="small"
                      variant="text"
                      sx={{ minWidth: 'auto', fontSize: '0.7rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const u = users.find(usr => usr.id === issue.user_id);
                        if (u) handleOpenEditUser(u);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {/* Stats — inline metric strip */}
      <Box sx={{
        display: 'flex',
        gap: 0,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        overflow: 'hidden',
        mb: 3,
        flexWrap: 'wrap',
      }}>
        {[
          { value: userSummary.total_users || users.length, label: 'Total Users', color: 'primary.main' },
          { value: userSummary.admins || users.filter(u => u.is_admin).length, label: 'Admins', color: 'warning.main' },
          { value: userSummary.with_subscription || 0, label: 'With Sub', color: 'success.main' },
          { value: userSummary.with_dcbin || 0, label: 'DC.bin', color: 'info.main' },
          { value: userSummary.with_xml || 0, label: 'XML', color: 'secondary.main' },
          { value: userSummary.unregistered_paid || unregisteredSubs.filter(s => s.subscription_active).length, label: 'Unreg Paid', color: 'error.main' },
        ].map((m, i, arr) => (
          <Box key={m.label} sx={{
            flex: '1 1 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.5,
            borderRight: i < arr.length - 1 ? `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}` : 'none',
            minWidth: 100,
          }}>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1} color={m.color}>{m.value}</Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.2}>{m.label}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Tabs + Search row */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 2,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        px: 1,
        flexWrap: 'wrap',
      }}>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          sx={{ flex: '1 1 auto', minHeight: { xs: 36, md: 48 }, '& .MuiTab-root': { minHeight: { xs: 36, md: 48 }, fontSize: { xs: '0.7rem', md: '0.875rem' }, px: { xs: 1, md: 2 } } }}
        >
          {/* Phase 2: Subscribers tab removed — subscriber ops live on Users via drawer */}
          <Tab label={isMobile ? `Users (${users.length})` : `Users (${users.length})`} />
          <Tab label={isMobile ? `Hunters (${huntParticipants.length})` : `Hunt Participants (${huntParticipants.length})`} />
        </Tabs>
        <TextField
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 220 }, flexShrink: 0, mt: { xs: 1, sm: 0 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {loading ? (
        <TablePageSkeleton />
      ) : (
        <>
          {/* Tab 0: Users (merged with Subscribers — Phase 2) */}
          {tab === 0 && (
            <AdminUsersTab
              sectionBox={sectionBox}
              tableContainerStyle={tableContainerStyle}
              tableHeadStyle={tableHeadStyle}
              isDark={isDark}
              filteredUsers={filteredUsers}
              users={users}
              unregisteredSubs={unregisteredSubs}
              userSummary={userSummary}
              user={user}
              userFilterRole={userFilterRole}
              setUserFilterRole={setUserFilterRole}
              userFilterPlan={userFilterPlan}
              setUserFilterPlan={setUserFilterPlan}
              userSortBy={userSortBy}
              userSortOrder={userSortOrder}
              handleUserSort={handleUserSort}
              showTestUsers={showTestUsers}
              setShowTestUsers={setShowTestUsers}
              dataIssues={dataIssues}
              dataIssuesExpanded={dataIssuesExpanded}
              setDataIssuesExpanded={setDataIssuesExpanded}
              dataIssuesLoading={dataIssuesLoading}
              handleToggleAdmin={handleToggleAdmin}
              handleToggleActive={handleToggleActive}
              handleOpenTrialDialog={handleOpenTrialDialog}
              handleOpenEditUser={handleOpenEditUser}
              handleOpenDebug={handleOpenDebug}
              handleRemoveSubscriber={handleRemoveSubscriber}
              handleFindDuplicates={handleFindDuplicates}
              setAddSubDialog={setAddSubDialog}
              refreshSubscribers={refreshSubscribers}
              setDeleteDialog={setDeleteDialog}
              setError={setError}
              setSuccess={setSuccess}
              loadData={loadData}
              loadDataIssues={loadDataIssues}
            />
          )}

          {/* Tab 1: Hunt Participants (was tab 2 pre-merge) */}
          {tab === 1 && (
            <AdminHuntParticipantsTab
              sectionBox={sectionBox}
              tableContainerStyle={tableContainerStyle}
              tableHeadStyle={tableHeadStyle}
              filteredHuntParticipants={filteredHuntParticipants}
              huntParticipants={huntParticipants}
              botStatuses={botStatuses}
              actionLoading={actionLoading}
              friendCounts={friendCounts}
              hunterStateFilter={hunterStateFilter}
              setHunterStateFilter={setHunterStateFilter}
              handleToggleHuntParticipant={handleToggleHuntParticipant}
              fetchBotStatus={fetchBotStatus}
              handleStartBot={handleStartBot}
              handleStopBot={handleStopBot}
              fetchFriendCount={fetchFriendCount}
              handleOpenAddPack={handleOpenAddPack}
              setClearFriendsResult={setClearFriendsResult}
              setClearFriendsDialog={setClearFriendsDialog}
              setStopAllBotsDialog={setStopAllBotsDialog}
              setStartAllBotsDialog={setStartAllBotsDialog}
            />
          )}
        </>
      )}

      {/* Add Pack Dialog */}
      <Dialog open={addPackDialog.open} onClose={() => setAddPackDialog({ open: false, participant: null })} maxWidth="xs" fullWidth>
        <DialogTitle>
          Add Pack for {addPackDialog.participant?.discord_username}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Select Pack</InputLabel>
            <Select
              value={addPackName}
              onChange={(e) => setAddPackName(e.target.value)}
              label="Select Pack"
            >
              {availablePacks
                .filter(ap => !addPackDialog.participant?.packs?.some(
                  pk => pk.pack_name === ap.name && pk.is_active
                ))
                .map(ap => (
                  <MenuItem key={ap.name} value={ap.name}>
                    {ap.label || ap.name}
                  </MenuItem>
                ))
              }
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPackDialog({ open: false, participant: null })}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddPack}
            disabled={!addPackName || addPackLoading}
          >
            {addPackLoading ? <CircularProgress size={20} /> : 'Add Pack'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Debug Dialog (Fullscreen) */}
      <AdminDebugUserDialog
        open={debugDialog.open}
        user={debugDialog.user}
        onClose={handleCloseDebug}
        setError={setError}
        setSuccess={setSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteUserDialog
        open={deleteDialog.open}
        user={deleteDialog.user}
        loading={deleteDialog.loading}
        onClose={() => setDeleteDialog({ open: false, user: null, loading: false })}
        onConfirm={handleDeleteUser}
      />

      {/* Stop All Friend Bots Confirmation Dialog */}
      <StopAllBotsDialog
        open={stopAllBotsDialog}
        onClose={() => setStopAllBotsDialog(false)}
        onConfirm={handleStopAllBots}
        loading={stopAllBotsLoading}
      />

      {/* Start All Active Bots Confirmation Dialog */}
      <StartAllBotsDialog
        open={startAllBotsDialog}
        onClose={() => setStartAllBotsDialog(false)}
        onConfirm={handleStartAllBots}
        loading={startAllBotsLoading}
      />

      {/* Clear Friends Confirmation Dialog */}
      <Dialog
        open={clearFriendsDialog.open}
        onClose={() => !clearFriendsLoading && setClearFriendsDialog({ open: false, participant: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Clear Friends — {clearFriendsDialog.participant?.discord_username}</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Remove all unprotected friends from <strong>{clearFriendsDialog.participant?.discord_username}</strong>'s main account.
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>Protected friends (will NOT be removed):</Typography>
            <Typography variant="body2" component="div">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Favorites (in-game favorite list)</li>
                <li>God pack finders — ALIVE or PENDING &lt; 48 hours</li>
                <li>Recent pack finders — any pack discovered &lt; 96 hours</li>
                <li>Active hunt participants</li>
                <li>Active device accounts (linked users)</li>
              </ul>
            </Typography>
          </Alert>
          {clearFriendsResult && (
            <Alert severity={clearFriendsResult.success ? 'success' : 'error'} sx={{ mb: 1 }}>
              {clearFriendsResult.success ? (
                <Typography variant="body2">
                  Removed <strong>{clearFriendsResult.removed}</strong> friends.
                  Remaining: <strong>{clearFriendsResult.remaining}</strong>.
                  Protected: <strong>{clearFriendsResult.protected}</strong>
                  {clearFriendsResult.protectionSummary && (
                    <> (favorites: {clearFriendsResult.protectionSummary.favorites}, god packs: {clearFriendsResult.protectionSummary.godPacks}, recent: {clearFriendsResult.protectionSummary.recentPacks}, hunt: {clearFriendsResult.protectionSummary.huntParticipants}, accounts: {clearFriendsResult.protectionSummary.liveAccounts})</>
                  )}
                </Typography>
              ) : (
                <Typography variant="body2">{clearFriendsResult.error || 'Unknown error'}</Typography>
              )}
            </Alert>
          )}
          {!clearFriendsResult && (
            <Alert severity="warning">
              <Typography variant="body2">
                This action cannot be undone. Only unprotected friends will be removed.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearFriendsDialog({ open: false, participant: null })} disabled={clearFriendsLoading}>
            {clearFriendsResult ? 'Close' : 'Cancel'}
          </Button>
          {!clearFriendsResult && (
            <Button
              color="warning"
              variant="contained"
              onClick={() => handleClearHuntFriends(clearFriendsDialog.participant)}
              disabled={clearFriendsLoading}
              startIcon={clearFriendsLoading ? <CircularProgress size={16} /> : <CleanIcon />}
            >
              {clearFriendsLoading ? 'Clearing...' : 'Clear Friends'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Admin Toggle Confirmation Dialog */}
      <AdminToggleDialog
        open={adminDialog.open}
        user={adminDialog.user}
        newIsAdmin={adminDialog.newIsAdmin}
        onClose={() => setAdminDialog({ open: false, user: null, newIsAdmin: false })}
        onConfirm={handleConfirmToggleAdmin}
      />

      {/* Add Subscriber Dialog */}
      <Dialog
        open={addSubDialog.open}
        onClose={() => setAddSubDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Paid Subscriber</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Discord Username"
              value={subForm.discord_username}
              onChange={(e) => setSubForm({ ...subForm, discord_username: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Discord ID"
              value={subForm.discord_id}
              onChange={(e) => setSubForm({ ...subForm, discord_id: e.target.value })}
              fullWidth
              placeholder="e.g., 123456789012345678"
            />
            <FormControl fullWidth>
              <InputLabel>Duration</InputLabel>
              <Select
                value={subForm.duration_days}
                onChange={(e) => setSubForm({ ...subForm, duration_days: e.target.value })}
                label="Duration"
              >
                <MenuItem value={7}>7 days</MenuItem>
                <MenuItem value={30}>30 days</MenuItem>
                <MenuItem value={90}>90 days</MenuItem>
                <MenuItem value={180}>180 days</MenuItem>
                <MenuItem value={365}>1 year</MenuItem>
                <MenuItem value={3650}>Lifetime (10 years)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={subForm.source || 'crypto'}
                onChange={(e) => setSubForm({ ...subForm, source: e.target.value })}
                label="Payment Method"
              >
                <MenuItem value="crypto">Crypto</MenuItem>
                <MenuItem value="paypal">PayPal F&F</MenuItem>
                <MenuItem value="admin">Admin (free)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Subscription Tier</InputLabel>
              <Select
                value={subForm.subscription_tier || 'premium'}
                onChange={(e) => setSubForm({ ...subForm, subscription_tier: e.target.value })}
                label="Subscription Tier"
              >
                <MenuItem value="premium">Premium</MenuItem>
                <MenuItem value="trade">Trade</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSubDialog({ open: false })}>Cancel</Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleAddSubscriber}
            disabled={!subForm.discord_username}
          >
            Add Subscriber
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Subscribers Dialog */}
      <Dialog
        open={dupeDialog.open}
        onClose={() => setDupeDialog({ open: false, loading: false, duplicates: [] })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DuplicateIcon color="warning" />
            Duplicate Subscribers
          </Box>
        </DialogTitle>
        <DialogContent>
          {dupeDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : dupeDialog.duplicates.length === 0 ? (
            <Alert severity="success" sx={{ mt: 1 }}>No duplicate subscribers detected.</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Alert severity="warning">
                Found {dupeDialog.duplicates.length} potential duplicate(s). Review and merge as needed.
              </Alert>
              {dupeDialog.duplicates.map((dupe, idx) => {
                // Recommend keeping the entry with discord_id
                const aHasId = !!dupe.entryA.discord_id;
                const bHasId = !!dupe.entryB.discord_id;
                const recommendKeepA = aHasId && !bHasId;
                const recommendKeepB = bHasId && !aHasId;

                return (
                  <Paper key={idx} sx={{ p: 2, border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="subtitle2" color="warning.main" gutterBottom>
                      {dupe.reason}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={5}>
                        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: recommendKeepA ? 'success.50' : 'transparent' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {dupe.entryA.discord_username}
                            {recommendKeepA && <Chip label="Recommended" size="small" color="success" sx={{ ml: 1 }} />}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            ID: {dupe.entryA.discord_id || 'none'} | Source: {dupe.entryA.source || 'manual'}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            Email: {dupe.entryA.kofi_email || 'none'}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            Expires: {dupe.entryA.subscription_end ? new Date(dupe.entryA.subscription_end).toLocaleDateString() : '-'}
                          </Typography>
                          <Button
                            size="small"
                            variant={recommendKeepA ? 'contained' : 'outlined'}
                            color="success"
                            startIcon={<MergeIcon />}
                            sx={{ mt: 1 }}
                            disabled={mergeLoading}
                            onClick={() => handleMergeSubscribers(dupe.entryA.id, dupe.entryB.id)}
                          >
                            Keep This
                          </Button>
                        </Paper>
                      </Grid>
                      <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MergeIcon color="action" sx={{ fontSize: 32 }} />
                      </Grid>
                      <Grid item xs={5}>
                        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: recommendKeepB ? 'success.50' : 'transparent' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {dupe.entryB.discord_username}
                            {recommendKeepB && <Chip label="Recommended" size="small" color="success" sx={{ ml: 1 }} />}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            ID: {dupe.entryB.discord_id || 'none'} | Source: {dupe.entryB.source || 'manual'}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            Email: {dupe.entryB.kofi_email || 'none'}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            Expires: {dupe.entryB.subscription_end ? new Date(dupe.entryB.subscription_end).toLocaleDateString() : '-'}
                          </Typography>
                          <Button
                            size="small"
                            variant={recommendKeepB ? 'contained' : 'outlined'}
                            color="success"
                            startIcon={<MergeIcon />}
                            sx={{ mt: 1 }}
                            disabled={mergeLoading}
                            onClick={() => handleMergeSubscribers(dupe.entryB.id, dupe.entryA.id)}
                          >
                            Keep This
                          </Button>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Paper>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDupeDialog({ open: false, loading: false, duplicates: [] })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Grant Trial Dialog */}
      <GrantTrialDialog
        open={trialDialog.open}
        user={trialDialog.user}
        onClose={() => setTrialDialog({ open: false, user: null })}
        onConfirm={handleGrantTrial}
        trialDays={trialDays}
        setTrialDays={setTrialDays}
        trialNotes={trialNotes}
        setTrialNotes={setTrialNotes}
        saving={trialSaving}
      />

      {/* Edit User Dialog */}
      <AdminEditUserDialog
        open={editUserDialog.open}
        user={editUserDialog.user}
        onClose={() => setEditUserDialog({ open: false, user: null })}
        onSaved={() => { refreshUsers(); loadDataIssues(); }}
        setError={setError}
        setSuccess={setSuccess}
      />

      {/* Snackbars */}
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

export default AdminUsers;
