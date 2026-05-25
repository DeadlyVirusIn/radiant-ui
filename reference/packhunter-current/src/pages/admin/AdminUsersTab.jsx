/**
 * AdminUsersTab — merged Users + Subscribers admin view (Phase 2/3).
 *
 * Before the merge: 12 columns, ~8 chips/row, 5 inline action buttons,
 * a sibling Subscribers tab with overlapping data, and native
 * prompt()/confirm() for subscriber edits.
 *
 * After the merge: 6 columns (User · Plan · Status · Account · Last Active ·
 * Actions), boolean presence as icons, one Plan filter, two inline actions
 * (Edit + overflow menu), and a row-click detail drawer (AdminUserDetailDrawer)
 * that owns all subscriber operations via proper MUI dialogs.
 */

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, FormControl,
  InputLabel, Select, MenuItem, TableSortLabel, TablePagination,
  Menu, ListItemIcon, ListItemText, Divider, Paper, Stack,
} from '@mui/material';
import useResponsive from '../../hooks/useResponsive';
import {
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Block as BlockIcon,
  BugReport as BugIcon,
  CardGiftcard as TrialIcon,
  MoreVert as MoreVertIcon,
  Star as OwnerStarIcon,
  Warning as WarningIcon,
  RemoveCircleOutline as DashIcon,
  Add as AddIcon,
  ContentCopy as DuplicateIcon,
  AddCircle as AddCircleIcon,
  Event as EventIcon,
  Link as LinkIcon,
  DeleteForever as RemoveSubIcon,
} from '@mui/icons-material';
import adminApi from './adminUsersApi';
import { formatRelativeTime } from '../../utils/dateFormat';
import AdminUserDetailDrawer, { PLAN_CONFIG, getUserPlan } from './AdminUserDetailDrawer';
import { canToggleAdmin, canToggleActive, canDeleteUser } from '../../utils/blockedActions';
import { BlockedReasonChip } from '../../components/admin/BlockedReason';

export default function AdminUsersTab({
  // Style objects (from useSectionStyles)
  sectionBox, tableContainerStyle, tableHeadStyle, isDark,
  // Data
  filteredUsers, users, unregisteredSubs, userSummary,
  // Current logged-in user (for disable checks)
  user,
  // Filter/sort state
  userFilterRole, setUserFilterRole,
  userFilterPlan, setUserFilterPlan,
  userSortBy, userSortOrder, handleUserSort,
  // Phase 18 — test-user toggle.
  showTestUsers, setShowTestUsers,
  // Data issues
  dataIssues, dataIssuesExpanded, setDataIssuesExpanded, dataIssuesLoading,
  // Handlers
  handleToggleAdmin, handleToggleActive, handleOpenTrialDialog, handleOpenEditUser, handleOpenDebug,
  // Subscriber ops (Phase 2 — now owned by Users page)
  handleRemoveSubscriber, handleFindDuplicates, setAddSubDialog,
  refreshSubscribers,
  // Dialog triggers
  setDeleteDialog,
  // Shared
  setError, setSuccess, loadData, loadDataIssues,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { isPhone } = useResponsive();
  useEffect(() => setPage(0), [filteredUsers]);

  // Row overflow menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuUser, setMenuUser] = useState(null);
  const openMenu = (e, u) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuUser(u); };
  const closeMenu = () => { setMenuAnchor(null); setMenuUser(null); };

  // Detail drawer
  const [drawerUser, setDrawerUser] = useState(null);
  const openDrawer = (u) => setDrawerUser(u);
  const closeDrawer = () => setDrawerUser(null);

  // Drawer-triggered subscriber dialog state (Set End Date / Set ID) used when
  // fired from the overflow menu directly (skips the drawer).
  const [quickDateOpen, setQuickDateOpen] = useState(false);
  const [quickDateUser, setQuickDateUser] = useState(null);

  const activeUnreg = unregisteredSubs.filter(s => s.subscription_active);

  return (
    <Box sx={sectionBox}>
      {/* Unregistered Paid Subscribers banner — preserved from Phase 2 merge */}
      {activeUnreg.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>{activeUnreg.length} paid subscriber{activeUnreg.length === 1 ? '' : 's'} not linked to a WebUI account:</strong>
          </Typography>
          {activeUnreg.map(s => (
            <Box key={s.discord_username} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="body2">{s.discord_username} ({s.subscription_tier || 'paid'})</Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  const username = window.prompt(`Enter the WebUI username to link "${s.discord_username}" to:`);
                  if (!username) return;
                  const match = users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.discord_username?.toLowerCase() === username.toLowerCase());
                  if (!match) { setError(`No WebUI user found matching "${username}"`); return; }
                  if (!window.confirm(`Link subscriber "${s.discord_username}" to WebUI user "${match.username}" (ID ${match.id})?`)) return;
                  try {
                    const res = await adminApi.linkSubscriber(s.discord_username, match.id);
                    if (res.error) { setError(res.error); return; }
                    setSuccess(res.message || 'Linked successfully');
                    loadData();
                  } catch (err) { setError('Failed to link subscriber'); }
                }}
              >
                Link to User
              </Button>
            </Box>
          ))}
        </Alert>
      )}

      {/* Filter bar + subscriber ops (absorbed from the old Subscribers tab) */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Role</InputLabel>
          <Select value={userFilterRole} label="Role" onChange={(e) => setUserFilterRole(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="owner">Owner</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="user">User</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Plan</InputLabel>
          <Select value={userFilterPlan || 'all'} label="Plan" onChange={(e) => setUserFilterPlan(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="premium">Premium</MenuItem>
            <MenuItem value="trade">Trade</MenuItem>
            <MenuItem value="trial">Trial</MenuItem>
            <MenuItem value="free">Free</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
          </Select>
        </FormControl>
        {/* Phase 18 — test-user toggle. Hidden count shown as caption. */}
        {typeof setShowTestUsers === 'function' && (() => {
          const hidden = users.filter(u => u.is_test).length;
          return (
            <Tooltip title={
              showTestUsers
                ? 'Test users visible — including in warnings'
                : `Hiding ${hidden} test user${hidden === 1 ? '' : 's'} (testuser, testadmin, trade-test, *_test_*)`
            }>
              <Button
                size="small"
                variant={showTestUsers ? 'contained' : 'outlined'}
                color={showTestUsers ? 'warning' : 'inherit'}
                onClick={() => setShowTestUsers(!showTestUsers)}
                sx={{ textTransform: 'none' }}
              >
                {showTestUsers ? `TEST users: shown (${hidden})` : `TEST users: hidden (${hidden})`}
              </Button>
            </Tooltip>
          );
        })()}
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" color="warning" startIcon={<DuplicateIcon />} onClick={handleFindDuplicates}>
          Find Duplicates
        </Button>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddSubDialog?.({ open: true })}>
          Add Subscriber
        </Button>
      </Box>

      {/* Phase 10 — card layout for phone, same 6-field semantics as table */}
      {isPhone ? (
        <Stack spacing={1}>
          {filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((u) => {
            const plan = getUserPlan(u);
            const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
            const anyDcbin = u.accounts?.some(a => a.has_dcbin);
            const anyXml = u.accounts?.some(a => a.has_xml);
            const acctCount = u.accounts?.length || 0;
            const lastActiveSrc = u.last_login || u.last_seen || u.updated_at || u.created_at;
            return (
              <Paper
                key={u.id}
                elevation={0}
                onClick={() => openDrawer(u)}
                sx={{
                  p: 1.5,
                  border: 1, borderColor: 'divider', borderRadius: 1.5,
                  bgcolor: !u.is_active ? 'action.hover' : 'inherit',
                  opacity: !u.is_active ? 0.7 : 1,
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 1 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <PersonIcon fontSize="small" color={u.is_admin ? 'primary' : 'action'} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={u.is_admin ? 'bold' : 500} noWrap>
                      {u.username}
                      {acctCount > 1 && (
                        <Chip label={`${acctCount}`} size="small"
                              sx={{ ml: 0.75, height: 16, fontSize: '0.6rem' }} />
                      )}
                    </Typography>
                    {u.discord_username && (
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {u.discord_username}
                      </Typography>
                    )}
                  </Box>
                  <Chip label={planCfg.label} size="small"
                        color={planCfg.color} variant={planCfg.variant}
                        sx={{ fontWeight: 600 }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {u.is_active ? 'Active' : 'Disabled'}
                    {' · '}
                    {anyDcbin && anyXml ? 'Account ✓' : anyDcbin || anyXml ? 'Partial' : 'No account'}
                    {u.subscription_end && (
                      <>
                        {' · '}
                        <Box component="span" sx={{
                          color: new Date(u.subscription_end) < new Date() ? 'error.main' : 'inherit',
                        }}>
                          ends {new Date(u.subscription_end).toLocaleDateString()}
                        </Box>
                      </>
                    )}
                    {lastActiveSrc && (
                      <>
                        {' · '}
                        {formatRelativeTime(lastActiveSrc)}
                      </>
                    )}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                    <IconButton size="medium" color="primary" aria-label="Edit user"
                                onClick={() => handleOpenEditUser(u)} sx={{ width: 44, height: 44 }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="medium" aria-label="More actions"
                                onClick={(e) => openMenu(e, u)} sx={{ width: 44, height: 44 }}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Paper>
            );
          })}
          {filteredUsers.length === 0 && (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: 1, borderColor: 'divider' }}>
              <Typography color="text.secondary">No users match the current filters</Typography>
            </Paper>
          )}
        </Stack>
      ) : (
      <TableContainer sx={tableContainerStyle}>
        <Table size="small">
          <TableHead>
            <TableRow sx={tableHeadStyle}>
              <TableCell>
                <TableSortLabel active={userSortBy === 'username'} direction={userSortBy === 'username' ? userSortOrder : 'asc'} onClick={() => handleUserSort('username')}>
                  User
                </TableSortLabel>
              </TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>
                <TableSortLabel
                  active={userSortBy === 'subscription_end'}
                  direction={userSortBy === 'subscription_end' ? userSortOrder : 'asc'}
                  onClick={() => handleUserSort('subscription_end')}
                >
                  End Date
                </TableSortLabel>
              </TableCell>
              <TableCell>Last Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((u) => {
              const plan = getUserPlan(u);
              const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
              const anyDcbin = u.accounts?.some(a => a.has_dcbin);
              const anyXml = u.accounts?.some(a => a.has_xml);
              const acctCount = u.accounts?.length || 0;
              const acctState = !acctCount ? 'none' : (anyDcbin && anyXml) ? 'complete' : 'partial';
              const lastActiveSrc = u.last_login || u.last_seen || u.updated_at || u.created_at;
              const isSelf = u.id === user.id;
              const isProtected = u.is_owner;

              return (
                <TableRow
                  key={u.id}
                  hover
                  onClick={() => openDrawer(u)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: !u.is_active ? 'action.hover' : 'inherit',
                    opacity: !u.is_active ? 0.7 : 1,
                  }}
                >
                  {/* User */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon fontSize="small" color={u.is_admin ? 'primary' : 'action'} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={u.is_admin ? 'bold' : 500} noWrap>
                          {u.username}
                          {acctCount > 1 && (
                            <Chip label={`${acctCount}`} size="small" sx={{ ml: 0.75, height: 16, fontSize: '0.6rem' }} />
                          )}
                          {u.is_test && (
                            <Chip
                              label="TEST"
                              size="small"
                              sx={{
                                ml: 0.75, height: 16, fontSize: '0.6rem',
                                bgcolor: 'grey.800', color: 'grey.100',
                              }}
                            />
                          )}
                        </Typography>
                        {u.discord_username && (
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {u.discord_username}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Plan (one chip) */}
                  <TableCell>
                    <Chip
                      label={planCfg.label}
                      size="small"
                      color={planCfg.color}
                      variant={planCfg.variant}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>

                  {/* Status (icon, not chip) */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={u.is_active ? 'Active' : 'Disabled'}>
                        {u.is_active
                          ? <CheckIcon fontSize="small" sx={{ color: 'success.main' }} />
                          : <BlockIcon fontSize="small" sx={{ color: 'error.main' }} />}
                      </Tooltip>
                      {u.is_owner && (
                        <Tooltip title="Owner"><OwnerStarIcon fontSize="small" sx={{ color: 'warning.main' }} /></Tooltip>
                      )}
                    </Box>
                  </TableCell>

                  {/* Account (composite icon) */}
                  <TableCell>
                    <Tooltip title={
                      acctState === 'complete' ? 'DC.bin + XML loaded'
                        : acctState === 'partial' ? `Partial — DC.bin: ${anyDcbin ? '✓' : '—'} · XML: ${anyXml ? '✓' : '—'}`
                          : 'No account linked'
                    }>
                      {acctState === 'complete'
                        ? <CheckIcon fontSize="small" sx={{ color: 'success.main' }} />
                        : acctState === 'partial'
                          ? <WarningIcon fontSize="small" sx={{ color: 'warning.main' }} />
                          : <DashIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
                    </Tooltip>
                  </TableCell>

                  {/* End Date (subscription expiry) — sortable, nulls last */}
                  <TableCell>
                    {u.subscription_end ? (
                      <Tooltip title={new Date(u.subscription_end).toLocaleString()}>
                        <Typography
                          variant="caption"
                          sx={{
                            // Soft red highlight for already-expired subscriptions so
                            // ops can spot them at a glance when sorting by end date.
                            color: new Date(u.subscription_end) < new Date() ? 'error.main' : 'text.primary',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {new Date(u.subscription_end).toLocaleDateString()}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  {/* Last Active (relative) */}
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {lastActiveSrc ? formatRelativeTime(lastActiveSrc) : '—'}
                    </Typography>
                  </TableCell>

                  {/* Actions: 1 inline + overflow menu */}
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Edit user">
                      <IconButton size="small" color="primary" onClick={() => handleOpenEditUser(u)} aria-label="Edit user">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="More actions">
                      <IconButton size="small" onClick={(e) => openMenu(e, u)} aria-label="More actions">
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary">No users match the current filters</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}
      <TablePagination
        component="div"
        count={filteredUsers.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />

      {/* Row overflow menu — every admin action that's not Edit or row-click */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {menuUser && (
          <>
            <MenuItem onClick={() => { openDrawer(menuUser); closeMenu(); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              <ListItemText>View details</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleOpenDebug(menuUser); closeMenu(); }}>
              <ListItemIcon><BugIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Debug</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleOpenTrialDialog(menuUser); closeMenu(); }}>
              <ListItemIcon><TrialIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Grant trial</ListItemText>
            </MenuItem>
            {(() => {
              const adminGate = canToggleAdmin({ targetUser: menuUser, currentUser: user });
              return (
                <MenuItem
                  disabled={!adminGate.allowed}
                  onClick={() => { handleToggleAdmin(menuUser.id, menuUser.is_admin); closeMenu(); }}
                >
                  <ListItemIcon><AdminIcon fontSize="small" color={menuUser.is_admin ? 'warning' : 'inherit'} /></ListItemIcon>
                  <ListItemText>{menuUser.is_admin ? 'Revoke admin' : 'Grant admin'}</ListItemText>
                  {!adminGate.allowed && <BlockedReasonChip reason={adminGate} sx={{ ml: 1 }} />}
                </MenuItem>
              );
            })()}
            {(() => {
              const activeGate = canToggleActive({ targetUser: menuUser, currentUser: user });
              return (
                <MenuItem
                  disabled={!activeGate.allowed}
                  onClick={() => { handleToggleActive(menuUser.id, menuUser.is_active); closeMenu(); }}
                >
                  <ListItemIcon>
                    {menuUser.is_active
                      ? <BlockIcon fontSize="small" color="error" />
                      : <CheckIcon fontSize="small" color="success" />}
                  </ListItemIcon>
                  <ListItemText>{menuUser.is_active ? 'Deactivate' : 'Activate'}</ListItemText>
                  {!activeGate.allowed && <BlockedReasonChip reason={activeGate} sx={{ ml: 1 }} />}
                </MenuItem>
              );
            })()}

            {menuUser.subscription_source && <Divider />}
            {menuUser.subscription_source && (
              <MenuItem onClick={() => { openDrawer(menuUser); closeMenu(); }}>
                <ListItemIcon><AddCircleIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Manage subscription…</ListItemText>
              </MenuItem>
            )}

            <Divider />
            {(() => {
              const deleteGate = canDeleteUser({ targetUser: menuUser, currentUser: user });
              return (
                <MenuItem
                  disabled={!deleteGate.allowed}
                  onClick={() => { setDeleteDialog({ open: true, user: menuUser }); closeMenu(); }}
                >
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText sx={{ color: deleteGate.allowed ? 'error.main' : 'inherit' }}>Delete user</ListItemText>
                  {!deleteGate.allowed && <BlockedReasonChip reason={deleteGate} sx={{ ml: 1 }} />}
                </MenuItem>
              );
            })()}
          </>
        )}
      </Menu>

      {/* Full-detail drawer — owns subscriber ops (Extend / Set Date / Set ID / Remove) */}
      <AdminUserDetailDrawer
        open={Boolean(drawerUser)}
        user={drawerUser}
        onClose={closeDrawer}
        refreshUsers={loadData}
        refreshSubscribers={refreshSubscribers}
        handleRemoveSubscriber={handleRemoveSubscriber}
        setError={setError}
        setSuccess={setSuccess}
      />
    </Box>
  );
}
