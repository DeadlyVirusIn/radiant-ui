import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, TablePagination, TextField, MenuItem, Button, Chip,
  IconButton, Tooltip, Alert, CircularProgress, Tabs, Tab,
  useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PageHeader from '../components/PageHeader';
import { useSectionStyles } from '../components/SectionCard';
import { FadeIn } from '../components/Animations';
import { formatDateTime } from '../utils/dateFormat';

const API_BASE = '/api/admin/audit-log';

const typeColors = {
  TRADE: 'primary',
  TRADE_REQUEST: 'info',
  GOLD_FLAIR_TRADE: 'warning',
  GIFT: 'secondary',
};

// Display labels (chip text). Default for missing key is the raw value.
const typeLabels = {
  GOLD_FLAIR_TRADE: 'GOLD FLAIR',
};

const statusColors = {
  COMPLETED: 'success',
  PENDING: 'warning',
  MATCHING: 'info',
  FAILED: 'error',
  CANCELLED: 'default',
};

export default function AuditLog({ user }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { sectionBox, tableContainerStyle, tableHeadStyle } = useSectionStyles();

  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    username: '',
    cardId: '',
    type: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  // Suspicious activity
  const [suspicious, setSuspicious] = useState([]);
  const [suspiciousLoading, setSuspiciousLoading] = useState(false);

  // Admin actions
  const [adminActions, setAdminActions] = useState([]);
  const [adminActionsTotal, setAdminActionsTotal] = useState(0);
  const [adminActionsPage, setAdminActionsPage] = useState(0);
  const [adminActionsLoading, setAdminActionsLoading] = useState(false);

  const fetchAuditLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', (page + 1).toString());
      params.set('pageSize', pageSize.toString());
      if (filters.username) params.set('username', filters.username);
      if (filters.cardId) params.set('cardId', filters.cardId);
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await fetch(`${API_BASE}?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  const fetchSuspicious = useCallback(async () => {
    setSuspiciousLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suspicious?days=7&threshold=5`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuspicious(data.rows || []);
    } catch (err) {
      console.error('Suspicious fetch failed:', err);
    } finally {
      setSuspiciousLoading(false);
    }
  }, []);

  const fetchAdminActions = useCallback(async () => {
    setAdminActionsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', (adminActionsPage + 1).toString());
      params.set('pageSize', '50');
      const res = await fetch(`/api/admin/admin-actions?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAdminActions(data.rows || []);
      setAdminActionsTotal(data.total || 0);
    } catch (err) {
      console.error('Admin actions fetch failed:', err);
    } finally {
      setAdminActionsLoading(false);
    }
  }, [adminActionsPage]);

  const handleRefreshMV = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      await fetchAuditLog();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (tab === 0) fetchAuditLog();
    if (tab === 1) fetchSuspicious();
    if (tab === 2) fetchAdminActions();
  }, [tab, fetchAuditLog, fetchSuspicious, fetchAdminActions]);

  const handleFilterChange = (field) => (e) => {
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({ username: '', cardId: '', type: '', status: '', dateFrom: '', dateTo: '' });
    setPage(0);
  };

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = ['Date', 'User', 'Type', 'Card', 'Rarity', 'Status', 'Partner', 'Sand Cost'];
    const csvRows = rows.map(r => [
      r.completed_at || r.created_at || '',
      r.username || `User #${r.user_id}`,
      r.type || '',
      r.card_name || r.card_id || '',
      r.rarity_code || '',
      r.status || '',
      r.partner_nickname || r.partner_player_id || '',
      r.sand_cost || 0,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FadeIn>
    <Box>
      {/* Page Header */}
      <PageHeader
        icon={<HistoryIcon />}
        title="Trade & Gift Audit Log"
        subtitle="Transfer history, suspicious activity, and admin actions"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Export current view as CSV">
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCSV}
                disabled={rows.length === 0}
              >
                Export CSV
              </Button>
            </Tooltip>
            <Tooltip title="Refresh materialized view (updates data)">
              <Button
                size="small"
                variant="outlined"
                startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={handleRefreshMV}
                disabled={refreshing}
              >
                Refresh Data
              </Button>
            </Tooltip>
          </Box>
        }
      />

      {/* Tabs */}
      <Box sx={{
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        mb: 2,
        px: 1,
      }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Audit Log" />
          <Tab label="Suspicious Activity" icon={<WarningIcon />} iconPosition="start" />
          <Tab label="Admin Actions" />
        </Tabs>
      </Box>

      {tab === 0 && (
        <>
          {/* Filters */}
          <Box sx={{ ...sectionBox, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="subtitle2" fontWeight={600}>Filters</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                label="Username"
                size="small"
                sx={{ width: 160 }}
                value={filters.username}
                onChange={handleFilterChange('username')}
              />
              <TextField
                label="Card ID"
                size="small"
                sx={{ width: 140 }}
                value={filters.cardId}
                onChange={handleFilterChange('cardId')}
              />
              <TextField
                label="Type"
                size="small"
                sx={{ width: 150 }}
                select
                value={filters.type}
                onChange={handleFilterChange('type')}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="TRADE">Trade</MenuItem>
                <MenuItem value="TRADE_REQUEST">Trade Request</MenuItem>
                <MenuItem value="GOLD_FLAIR_TRADE">Gold Flair Trade</MenuItem>
                <MenuItem value="GIFT">Gift</MenuItem>
              </TextField>
              <TextField
                label="Status"
                size="small"
                sx={{ width: 150 }}
                select
                value={filters.status}
                onChange={handleFilterChange('status')}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </TextField>
              <TextField
                label="From"
                type="date"
                size="small"
                sx={{ width: 150 }}
                InputLabelProps={{ shrink: true }}
                value={filters.dateFrom}
                onChange={handleFilterChange('dateFrom')}
              />
              <TextField
                label="To"
                type="date"
                size="small"
                sx={{ width: 150 }}
                InputLabelProps={{ shrink: true }}
                value={filters.dateTo}
                onChange={handleFilterChange('dateTo')}
              />
              <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                <IconButton size="small" color="primary" onClick={fetchAuditLog} aria-label="Search audit log"><SearchIcon /></IconButton>
                <IconButton size="small" onClick={clearFilters} aria-label="Clear filters"><ClearIcon /></IconButton>
              </Box>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Table */}
          <TableContainer sx={tableContainerStyle}>
            <Table size="small">
              <TableHead>
                <TableRow sx={tableHeadStyle}>
                  <TableCell>Type</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Received Card</TableCell>
                  <TableCell>Rarity</TableCell>
                  <TableCell>Sent Card</TableCell>
                  <TableCell>Partner</TableCell>
                  <TableCell>Sand</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center"><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">No records found</TableCell>
                  </TableRow>
                ) : rows.map((row, i) => (
                  <TableRow key={`${row.transfer_type}-${row.source_id}-${i}`} hover>
                    <TableCell>
                      <Chip label={typeLabels[row.transfer_type] || row.transfer_type} size="small" color={typeColors[row.transfer_type] || 'default'} />
                    </TableCell>
                    <TableCell>{row.username || `User #${row.user_id}`}</TableCell>
                    <TableCell>
                      <Chip label={row.account_type || 'main'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.received_card_name || row.received_card_id || '-'}
                    </TableCell>
                    <TableCell>
                      {row.received_card_rarity && (
                        <Chip label={row.received_card_rarity} size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.sent_card_name || row.sent_card_id || '-'}
                    </TableCell>
                    <TableCell>{row.partner_nickname || row.partner_player_id || '-'}</TableCell>
                    <TableCell>{row.sand_cost > 0 ? row.sand_cost.toLocaleString() : '-'}</TableCell>
                    <TableCell>
                      <Chip label={row.status} size="small" color={statusColors[row.status] || 'default'} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.completed_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(0); }}
              rowsPerPageOptions={[25, 50, 100]}
            />
          </TableContainer>
        </>
      )}

      {tab === 1 && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Shows users who received 5+ unique premium cards (AR, SR, SAR, S, SSR, 1S, 2S) in the last 7 days.
          </Alert>

          <Box sx={sectionBox}>
          <TableContainer sx={tableContainerStyle}>
            <Table size="small">
              <TableHead>
                <TableRow sx={tableHeadStyle}>
                  <TableCell>User</TableCell>
                  <TableCell>Unique Premium Cards</TableCell>
                  <TableCell>Total Transfers</TableCell>
                  <TableCell>Types</TableCell>
                  <TableCell>First Transfer</TableCell>
                  <TableCell>Last Transfer</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suspiciousLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : suspicious.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No suspicious activity detected</TableCell>
                  </TableRow>
                ) : suspicious.map((row, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{row.username || `User #${row.user_id}`}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.unique_premium_cards}
                        color={row.unique_premium_cards >= 10 ? 'error' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{row.total_transfers}</TableCell>
                    <TableCell>
                      {(row.transfer_types || []).map((t) => (
                        <Chip key={t} label={t} size="small" sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell>{formatDateTime(row.first_transfer)}</TableCell>
                    <TableCell>{formatDateTime(row.last_transfer)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        </>
      )}
      {tab === 2 && (
        <>
          <Box sx={sectionBox}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Admin action audit trail — logs all admin operations (grant/revoke admin, delete users, stop processes, etc.)
          </Typography>
          <TableContainer sx={tableContainerStyle}>
            <Table size="small">
              <TableHead>
                <TableRow sx={tableHeadStyle}>
                  <TableCell>Time</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adminActionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell>
                  </TableRow>
                ) : adminActions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No admin actions logged yet</TableCell>
                  </TableRow>
                ) : adminActions.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>{row.username}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.action}
                        size="small"
                        color={
                          row.action?.includes('DELETE') ? 'error' :
                          row.action?.includes('GRANT') ? 'warning' :
                          row.action?.includes('STOP') || row.action?.includes('KILL') ? 'error' :
                          row.action?.includes('REVOKE') ? 'info' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.details || '-'}
                    </TableCell>
                    <TableCell>{row.target_user || '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8em', fontFamily: 'monospace' }}>{row.ip_address || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={adminActionsTotal}
            page={adminActionsPage}
            onPageChange={(_, p) => setAdminActionsPage(p)}
            rowsPerPage={50}
            rowsPerPageOptions={[50]}
          />
          </Box>
        </>
      )}
    </Box>
    </FadeIn>
  );
}
