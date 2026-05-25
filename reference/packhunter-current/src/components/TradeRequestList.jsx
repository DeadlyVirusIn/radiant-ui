/**
 * TradeRequestList Component
 * List of user's trade requests with filtering, status tabs, batch operations,
 * and smart sub-filters.
 */

import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Skeleton,
  Alert,
  Button,
  Chip,
  Paper,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TradeRequestCard from './TradeRequestCard';
import { EmptyState } from './EmptyState';
import { getRequestAge } from '../hooks/useRequestAge';
import { isRetryable } from '../utils/errorDisplay';

// Status filter tabs
// Active = anything not in a terminal state. Mirrors the executor's TRADE_STATE
// enum (tradeConstants.js) so new in-flight states are picked up automatically
// when added. Previously hard-listed only 6 states which left FRIEND_REQUEST_SENT
// trades visible but other phases (e.g. SUBMITTING_TRADE_PROPOSAL,
// CONFIRMING_TRADE) invisible — making trades appear "lost" to the user.
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'TRADE_STUCK_FINALIZATION'];
const ACTIVE_STATUSES = [
  'PENDING', 'QUEUED', 'MATCHING',
  'INITIALIZING', 'CHECKING_EXISTING_TRADE', 'PROCESSING_EXISTING_TRADE',
  'CHECKING_INVENTORY', 'HANDLING_FRIEND_REQUEST', 'WAITING_FRIEND_ACCEPT',
  'FRIEND_REQUEST_SENT',
  'SUBMITTING_TRADE_PROPOSAL', 'TRADE_PROPOSAL_SENT', 'WAITING_TRADE_RESPONSE',
  'PICK_CARD', 'TRADE_ACCEPTED',
  'PROCESSING_TRADE_STATE', 'EXECUTING_TRADE', 'PROPOSING_TRADE',
  'CONFIRMING_TRADE', 'CONFIRMING', 'RECEIVING_OUTCOME',
];
const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active', statuses: ACTIVE_STATUSES },
  { value: 'stale', label: 'Stuck', filter: (r) => { const a = getRequestAge(r); return !a.isTerminal && (a.band === 'stale' || a.band === 'overdue'); } },
  { value: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { value: 'failed', label: 'Failed/Cancelled', statuses: ['FAILED', 'CANCELLED'] },
];

// Sub-filters for specific tabs
const SUB_FILTERS = {
  failed: [
    { value: 'all', label: 'All' },
    { value: 'retryable', label: 'Retryable', filter: (r) => r.status === 'FAILED' && isRetryable(r.error_message) },
    { value: 'permanent', label: 'Permanent', filter: (r) => r.status === 'FAILED' && !isRetryable(r.error_message) },
    { value: 'cancelled', label: 'Cancelled', filter: (r) => r.status === 'CANCELLED' },
  ],
  active: [
    { value: 'all', label: 'All' },
    { value: 'long', label: 'Long-running', filter: (r) => { const a = getRequestAge(r); return !a.isTerminal && a.ageMs > 5 * 60 * 1000 && a.band !== 'stale' && a.band !== 'overdue'; } },
  ],
};

export default function TradeRequestList({
  requests = [],
  loading = false,
  error = null,
  onRefresh,
  onCancel,
  onRequestAgain,
  onBrowseCards,
  stats = null,
  pickCardDataMap = {},
}) {
  const [activeTab, setActiveTab] = useState('active');
  const [subFilter, setSubFilter] = useState('all');
  const [batchCancelling, setBatchCancelling] = useState(false);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // Reset sub-filter when tab changes
  const handleTabChange = (e, value) => {
    setActiveTab(value);
    setSubFilter('all');
  };

  // Filter requests: main tab filter, then sub-filter
  const filteredRequests = useMemo(() => {
    let result = requests;

    // Main tab filter
    if (activeTab !== 'all') {
      const tab = STATUS_TABS.find((t) => t.value === activeTab);
      if (tab?.filter) result = result.filter(tab.filter);
      else if (tab?.statuses) result = result.filter(r => tab.statuses.includes(r.status));
    }

    // Sub-filter
    const subs = SUB_FILTERS[activeTab];
    if (subs && subFilter !== 'all') {
      const sf = subs.find(s => s.value === subFilter);
      if (sf?.filter) result = result.filter(sf.filter);
    }

    return result;
  }, [requests, activeTab, subFilter]);

  // Count requests per tab
  const counts = useMemo(() => {
    const staleCount = requests.filter(r => {
      const a = getRequestAge(r);
      return !a.isTerminal && (a.band === 'stale' || a.band === 'overdue');
    }).length;
    return {
      all: requests.length,
      active: requests.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
      stale: staleCount,
      completed: requests.filter((r) => r.status === 'COMPLETED').length,
      failed: requests.filter((r) => ['FAILED', 'CANCELLED'].includes(r.status)).length,
    };
  }, [requests]);

  // Count retryable failed requests (for batch retry button)
  const retryableCount = useMemo(() =>
    requests.filter(r => r.status === 'FAILED' && isRetryable(r.error_message)).length,
    [requests]
  );

  // Available sub-filters for current tab
  const currentSubFilters = SUB_FILTERS[activeTab];

  return (
    <Box>
      {/* Header with stats */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Your Trade Requests</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {stats && (
            <Chip size="small" label={`${stats.activeSessions || 0} active sessions`} color="primary" variant="outlined" />
          )}
          {onRefresh && (
            <Button startIcon={<RefreshIcon />} onClick={onRefresh} size="small" disabled={loading}>
              Refresh
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Status tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          {STATUS_TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {tab.label}
                  <Chip
                    size="small"
                    label={counts[tab.value] || 0}
                    sx={{
                      height: 20, fontSize: '0.7rem',
                      bgcolor:
                        tab.value === 'active' && counts.active > 0 ? 'primary.main'
                        : tab.value === 'stale' && counts.stale > 0 ? 'warning.main'
                        : tab.value === 'failed' && counts.failed > 0 ? 'error.main'
                        : 'grey.300',
                      color:
                        (tab.value === 'active' && counts.active > 0) ||
                        (tab.value === 'stale' && counts.stale > 0) ||
                        (tab.value === 'failed' && counts.failed > 0)
                          ? 'white' : 'text.secondary',
                    }}
                  />
                </Box>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {/* Sub-filters — chip row below tabs */}
      {currentSubFilters && currentSubFilters.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
          {currentSubFilters.map(sf => (
            <Chip
              key={sf.value}
              label={sf.label}
              size="small"
              variant={subFilter === sf.value ? 'filled' : 'outlined'}
              color={subFilter === sf.value ? 'primary' : 'default'}
              onClick={() => setSubFilter(sf.value)}
              sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}

      {/* Batch action bar — cancel stale OR retry failed */}
      {activeTab === 'stale' && counts.stale >= 2 && onCancel && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <Button
            size="small" variant="outlined" color="warning"
            disabled={batchCancelling}
            onClick={async () => {
              const staleReqs = requests.filter(r => {
                const a = getRequestAge(r);
                return !a.isTerminal && (a.band === 'stale' || a.band === 'overdue');
              });
              setBatchCancelling(true);
              setBatchProgress({ done: 0, total: staleReqs.length });
              for (let i = 0; i < staleReqs.length; i++) {
                try { await onCancel(staleReqs[i].id); } catch { /* continue */ }
                setBatchProgress({ done: i + 1, total: staleReqs.length });
              }
              setBatchCancelling(false);
            }}
            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
          >
            {batchCancelling ? `Cancelling ${batchProgress.done} / ${batchProgress.total}...` : `Cancel all ${counts.stale} stuck`}
          </Button>
        </Box>
      )}
      {activeTab === 'failed' && retryableCount >= 2 && onRequestAgain && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5, gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {retryableCount} retryable (network/timeout)
          </Typography>
          <Button
            size="small" variant="outlined" color="info"
            disabled={batchRetrying}
            onClick={async () => {
              const retryable = requests.filter(r => r.status === 'FAILED' && isRetryable(r.error_message));
              setBatchRetrying(true);
              setBatchProgress({ done: 0, total: retryable.length });
              for (let i = 0; i < retryable.length; i++) {
                try { await onRequestAgain(retryable[i]); } catch { /* continue */ }
                setBatchProgress({ done: i + 1, total: retryable.length });
              }
              setBatchRetrying(false);
            }}
            sx={{ fontSize: '0.7rem', textTransform: 'none' }}
          >
            {batchRetrying ? `Retrying ${batchProgress.done} / ${batchProgress.total}...` : `Retry ${retryableCount} safe`}
          </Button>
        </Box>
      )}

      {/* Loading skeleton */}
      {loading && requests.length === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={80} animation="wave" />
          ))}
        </Box>
      )}

      {/* Empty state */}
      {!loading && filteredRequests.length === 0 && (
        <EmptyState
          icon={<SwapHorizIcon sx={{ fontSize: 64 }} />}
          title={
            activeTab === 'all' ? 'No trade requests yet'
            : activeTab === 'active' ? (subFilter === 'long' ? 'No long-running requests' : 'No active requests')
            : activeTab === 'stale' ? 'Nothing stuck'
            : activeTab === 'completed' ? 'No completed requests'
            : subFilter === 'retryable' ? 'No retryable failures'
            : subFilter === 'permanent' ? 'No permanent failures'
            : subFilter === 'cancelled' ? 'No cancelled requests'
            : 'No failures'
          }
          description={
            activeTab === 'all' ? 'Search for a card above to get started.'
            : activeTab === 'active' ? (subFilter === 'long' ? 'All requests are completing quickly.' : 'Search for a card above to create one.')
            : activeTab === 'stale' ? 'All requests are progressing normally.'
            : activeTab === 'completed' ? 'Completed trades will appear here.'
            : subFilter === 'retryable' ? 'No transient failures to retry.'
            : 'All requests succeeded or are still active.'
          }
          action={
            (activeTab === 'all' || activeTab === 'active') && onBrowseCards ? (
              <Button size="small" variant="outlined" onClick={onBrowseCards} sx={{ textTransform: 'none' }}>
                Browse Cards
              </Button>
            ) : null
          }
          minHeight={120}
        />
      )}

      {/* Request list */}
      {filteredRequests.map((request) => (
        <TradeRequestCard
          key={request.id}
          request={request}
          onCancel={onCancel}
          allRequests={requests}
          onRequestAgain={onRequestAgain}
          pickCardData={pickCardDataMap[request.id]}
        />
      ))}

      {filteredRequests.length > 0 && filteredRequests.length >= 50 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
          Showing most recent 50 requests
        </Typography>
      )}
    </Box>
  );
}
