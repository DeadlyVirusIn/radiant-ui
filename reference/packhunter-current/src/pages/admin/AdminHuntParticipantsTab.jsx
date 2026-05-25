/**
 * AdminHuntParticipantsTab — Phase 4 redesign.
 *
 * Scan-first 6-column operational view. Historical packs / friend codes /
 * raw player IDs / hunt config flags have moved to the detail drawer.
 *
 * Columns (fixed):
 *   Status · User · Active Packs · Friends · Last Event · Actions
 *
 * "PPM" in the original spec refers to per-user production; since packs
 * are produced by hunt containers (not per user), the closest
 * operationally actionable per-user signal is friend count (hunts fail
 * when a user's account runs out of outgoing friend slots). That value
 * is already fetched by the hook and is a critical operator signal, so
 * it takes the column. Semantic preserved: "how many throughput signals
 * are available on this user right now".
 *
 * Row click → <AdminHunterDetailDrawer/> (Current / Configuration / History).
 * Inline actions: one bot toggle + overflow menu for less-frequent ops.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip,
  CircularProgress, Alert, TablePagination, Menu, MenuItem,
  ListItemIcon, ListItemText, FormControl, InputLabel, Select,
  Paper, Stack,
} from '@mui/material';
import {
  PlayArrow as PlayIcon, Stop as StopIcon, SmartToy as BotIcon,
  Refresh as RefreshIcon, MoreVert as MoreVertIcon,
  CleaningServices as CleanIcon, Add as AddIcon,
  History as HistoryIcon,
} from '@mui/icons-material';

import StatusDot from '../../components/admin/StatusDot';
import PackSummary from '../../components/admin/PackSummary';
import { deriveHunterStatus, bucketByStatus } from '../../utils/hunterStatus';
import { formatRelativeTime } from '../../utils/dateFormat';
import useResponsive from '../../hooks/useResponsive';
import AdminHunterDetailDrawer from './AdminHunterDetailDrawer';
import { canBotControl } from '../../utils/blockedActions';
import { BlockedReasonChip } from '../../components/admin/BlockedReason';

export default function AdminHuntParticipantsTab({
  // Style objects
  sectionBox, tableContainerStyle, tableHeadStyle,
  // Data (from hook)
  filteredHuntParticipants, huntParticipants,
  botStatuses, actionLoading, friendCounts,
  // Phase 7 — hunterState filter from URL (and local setter)
  hunterStateFilter, setHunterStateFilter,
  // Handlers (from hook)
  handleToggleHuntParticipant, fetchBotStatus, handleStartBot, handleStopBot, fetchFriendCount,
  // Dialog triggers (parent-owned dialogs)
  handleOpenAddPack, setClearFriendsResult, setClearFriendsDialog,
  setStopAllBotsDialog, setStartAllBotsDialog,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { isPhone } = useResponsive();

  // Phase 7 — apply the status-bucket filter on top of the parent hook's
  // search/plan filters. State is derived fresh per row via the same
  // deriveHunterStatus the dot uses, so the column and the filter can
  // never disagree.
  const visibleParticipants = useMemo(() => {
    if (!hunterStateFilter || hunterStateFilter === 'all') {
      return filteredHuntParticipants;
    }
    return filteredHuntParticipants.filter((p) => {
      const key = `${p.player_id}_${p.account_type || 'main'}`;
      const bs = botStatuses[key];
      const { state } = deriveHunterStatus(p, bs);
      return state === hunterStateFilter;
    });
  }, [filteredHuntParticipants, hunterStateFilter, botStatuses]);

  useEffect(() => setPage(0), [visibleParticipants]);

  // Row overflow menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuParticipant, setMenuParticipant] = useState(null);
  const openMenu = (e, p) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuParticipant(p); };
  const closeMenu = () => { setMenuAnchor(null); setMenuParticipant(null); };

  // Detail drawer
  const [drawerParticipant, setDrawerParticipant] = useState(null);
  const openDrawer = (p) => setDrawerParticipant(p);
  const closeDrawer = () => setDrawerParticipant(null);

  // Status summary strip — quick fleet heuristic across ALL filtered rows
  // (pre-status-bucket filter, so the strip keeps showing the full
  // distribution even when a sub-state is selected).
  const statusBuckets = useMemo(
    () => bucketByStatus(filteredHuntParticipants, botStatuses),
    [filteredHuntParticipants, botStatuses],
  );

  return (
    <Box sx={sectionBox}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={600}>Hunt Participants</Typography>
          {/* Compact at-a-glance breakdown — derived from the dot state. */}
          <StatusSummaryStrip buckets={statusBuckets} total={filteredHuntParticipants.length} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button variant="outlined" color="success" size="small" startIcon={<PlayIcon />}
                  onClick={() => setStartAllBotsDialog(true)}>
            Start All Bots
          </Button>
          <Button variant="outlined" color="error" size="small" startIcon={<StopIcon />}
                  onClick={() => setStopAllBotsDialog(true)}>
            Stop All Bots
          </Button>
          <Tooltip title="Refresh bot statuses">
            <IconButton size="small" aria-label="Refresh bot statuses"
              onClick={() => {
                const seen = new Set();
                huntParticipants.forEach(p => {
                  if (!p.player_id) return;
                  const key = `${p.player_id}_${p.account_type || 'main'}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    fetchBotStatus(p.player_id, p.account_type || 'main', p.discord_id);
                  }
                });
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={hunterStateFilter || 'all'}
            label="Status"
            onChange={(e) => setHunterStateFilter?.(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="healthy">Healthy</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="idle">Idle</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {visibleParticipants.length} of {filteredHuntParticipants.length}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          Rows show only current active packs. Click a row for full details, configuration, and history.
        </Typography>
      </Alert>

      {/* Phase 10 — card layout on phones, table on tablet+. Both render the
          same six fields in the same order so ops know where to look. */}
      {isPhone ? (
        <Stack spacing={1}>
          {visibleParticipants.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((p) => {
            const statusKey = `${p.player_id}_${p.account_type || 'main'}`;
            const botStatus = botStatuses[statusKey] || {};
            const isRunning = botStatus.status === 'running';
            const { state, label: statusLabel } = deriveHunterStatus(p, botStatus);
            const friendInfo = friendCounts[statusKey];
            const lastUpdated = p.lastUpdatedAt || p.last_updated_at || null;

            return (
              <Paper
                key={`${p.discord_id}_${p.account_type || 'main'}`}
                elevation={0}
                onClick={() => openDrawer(p)}
                sx={{
                  p: 1.5,
                  border: 1, borderColor: 'divider', borderRadius: 1.5,
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 1 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <StatusDot state={state} label={statusLabel} size={10} />
                  <Typography fontWeight={600} noWrap sx={{ flex: 1 }}>
                    {p.discord_username}
                  </Typography>
                  {p.account_type === 'alt' && (
                    <Chip label="ALT" size="small" color="secondary" variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                  {p.is_paid && (
                    <Chip label="Paid" size="small" color="primary" variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>

                <Box sx={{ mb: 0.5 }}>
                  <PackSummary packs={p.packs} dense />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {friendInfo?.count != null ? `${friendInfo.count} friends` : '—'}
                    {' · '}
                    {lastUpdated ? formatRelativeTime(lastUpdated) : '—'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                    {p.player_id && !botStatus.loading && (
                      isRunning ? (
                        <IconButton size="medium" color="error" aria-label="Stop bot"
                          onClick={() => handleStopBot(p.player_id, p.account_type || 'main', p.discord_id)}
                          sx={{ width: 44, height: 44 }}>
                          <StopIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton size="medium" color="success" aria-label="Start bot"
                          onClick={() => handleStartBot(p.player_id, p.account_type || 'main', p.discord_id)}
                          sx={{ width: 44, height: 44 }}>
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      )
                    )}
                    <IconButton size="medium" aria-label="More actions"
                                onClick={(e) => openMenu(e, p)} sx={{ width: 44, height: 44 }}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Paper>
            );
          })}
          {visibleParticipants.length === 0 && (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: 1, borderColor: 'divider' }}>
              <Typography color="text.secondary">No hunt participants match the current filters</Typography>
            </Paper>
          )}
        </Stack>
      ) : (
      <TableContainer sx={tableContainerStyle}>
        <Table size="small">
          <TableHead>
            <TableRow sx={tableHeadStyle}>
              <TableCell sx={{ width: 36 }}>Status</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Active Packs</TableCell>
              <TableCell>Friends</TableCell>
              <TableCell>Last Event</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleParticipants.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((p) => {
              const statusKey = `${p.player_id}_${p.account_type || 'main'}`;
              const botStatus = botStatuses[statusKey] || {};
              const isRunning = botStatus.status === 'running';
              const { state, label: statusLabel } = deriveHunterStatus(p, botStatus);
              const friendInfo = friendCounts[statusKey];
              const lastUpdated = p.lastUpdatedAt || p.last_updated_at || null;

              return (
                <TableRow
                  key={`${p.discord_id}_${p.account_type || 'main'}`}
                  hover
                  onClick={() => openDrawer(p)}
                  sx={{ cursor: 'pointer' }}
                >
                  {/* Status (dot only, tooltip explains) */}
                  <TableCell>
                    <StatusDot state={state} label={statusLabel} size={10} />
                  </TableCell>

                  {/* User */}
                  <TableCell>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography fontWeight={600} noWrap>{p.discord_username}</Typography>
                        {p.account_type === 'alt' && (
                          <Chip label="ALT" size="small" color="secondary" variant="outlined"
                                sx={{ height: 16, fontSize: '0.6rem' }} />
                        )}
                        {p.is_paid && (
                          <Chip label="Paid" size="small" color="primary" variant="outlined"
                                sx={{ height: 16, fontSize: '0.6rem' }} />
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Active Packs — summarized, current-state only */}
                  <TableCell>
                    <PackSummary packs={p.packs} />
                  </TableCell>

                  {/* Friends (operational throughput signal) */}
                  <TableCell>
                    {!p.player_id ? (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    ) : friendInfo?.loading ? (
                      <CircularProgress size={14} />
                    ) : friendInfo?.count != null ? (
                      <Tooltip title={`${friendInfo.count} friends · ${friendInfo.sent || 0} sent · ${friendInfo.received || 0} received`}>
                        <Chip
                          label={friendInfo.count}
                          size="small"
                          color={friendInfo.count > 80 ? 'error' : friendInfo.count > 50 ? 'warning' : 'default'}
                          variant={friendInfo.count > 80 ? 'filled' : 'outlined'}
                        />
                      </Tooltip>
                    ) : isRunning ? (
                      <Button size="small" variant="text"
                              onClick={(e) => { e.stopPropagation(); fetchFriendCount(p.player_id, p.account_type || 'main'); }}>
                        Check
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>

                  {/* Last Event — relative time */}
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {lastUpdated ? formatRelativeTime(lastUpdated) : '—'}
                    </Typography>
                  </TableCell>

                  {/* Actions — primary bot toggle + overflow menu */}
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {!p.player_id ? (
                      <BlockedReasonChip reason={canBotControl({ participant: p, botStatus })} />
                    ) : botStatus.loading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <>
                        {isRunning ? (
                          <Tooltip title="Stop friend bot">
                            <span>
                              <IconButton size="small" color="error"
                                onClick={() => handleStopBot(p.player_id, p.account_type || 'main', p.discord_id)}
                                disabled={botStatus.loading} aria-label="Stop friend bot">
                                <StopIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Start friend bot">
                            <span>
                              <IconButton size="small" color="success"
                                onClick={() => handleStartBot(p.player_id, p.account_type || 'main', p.discord_id)}
                                disabled={botStatus.loading} aria-label="Start friend bot">
                                <PlayIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <Tooltip title="More actions">
                          <IconButton size="small" onClick={(e) => openMenu(e, p)} aria-label="More actions">
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {visibleParticipants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">No hunt participants match the current filters</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <TablePagination
        component="div"
        count={visibleParticipants.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
      />

      {/* Row overflow menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {menuParticipant && (
          <>
            <MenuItem onClick={() => { openDrawer(menuParticipant); closeMenu(); }}>
              <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
              <ListItemText>View details</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { handleOpenAddPack(menuParticipant); closeMenu(); }}>
              <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Add pack</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!menuParticipant.player_id}
              onClick={() => {
                fetchFriendCount(menuParticipant.player_id, menuParticipant.account_type || 'main');
                closeMenu();
              }}
            >
              <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Refresh friend count</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!menuParticipant.player_id || !(botStatuses[`${menuParticipant.player_id}_${menuParticipant.account_type || 'main'}`]?.status === 'running')}
              onClick={() => {
                setClearFriendsResult(null);
                setClearFriendsDialog({ open: true, participant: menuParticipant });
                closeMenu();
              }}
            >
              <ListItemIcon><CleanIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Clear unprotected friends</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!menuParticipant.player_id}
              onClick={() => {
                fetchBotStatus(menuParticipant.player_id, menuParticipant.account_type || 'main', menuParticipant.discord_id);
                closeMenu();
              }}
            >
              <ListItemIcon><BotIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Refresh bot status</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Row-click drawer */}
      <AdminHunterDetailDrawer
        open={Boolean(drawerParticipant)}
        participant={drawerParticipant}
        onClose={closeDrawer}
        botStatuses={botStatuses}
        actionLoading={actionLoading}
        friendCounts={friendCounts}
        handleToggleHuntParticipant={handleToggleHuntParticipant}
        handleStartBot={handleStartBot}
        handleStopBot={handleStopBot}
        handleOpenAddPack={handleOpenAddPack}
        fetchBotStatus={fetchBotStatus}
        fetchFriendCount={fetchFriendCount}
      />
    </Box>
  );
}

/** Compact inline status-distribution chip strip shown above the table. */
function StatusSummaryStrip({ buckets, total }) {
  if (total === 0) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title="Healthy hunters">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <StatusDot state="healthy" size={8} glow={false} label="Healthy" />
          <Typography variant="caption">{buckets.healthy}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title="Hunters with warnings">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, ml: 0.5 }}>
          <StatusDot state="warning" size={8} glow={false} label="Warning" />
          <Typography variant="caption">{buckets.warning}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title="Hunters in error">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, ml: 0.5 }}>
          <StatusDot state="error" size={8} glow={false} label="Error" />
          <Typography variant="caption">{buckets.error}</Typography>
        </Box>
      </Tooltip>
      <Tooltip title="Idle / not currently hunting">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, ml: 0.5 }}>
          <StatusDot state="idle" size={8} glow={false} label="Idle" />
          <Typography variant="caption">{buckets.idle}</Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}
