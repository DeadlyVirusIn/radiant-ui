/**
 * DebugStrip — Lightweight debug visibility panel for socket events and request lifecycle.
 *
 * Activation: Ctrl+Shift+D or ?debug=1 URL param.
 *
 * Collapsed (32px): socket status, last event, active/stale request counts.
 * Expanded (300px): event log, lifecycle timeline, errors, guard rejections.
 *
 * Filters by selectedAccountId. Shows event source (socket vs API).
 */

import { useState, useMemo } from 'react';
import { Box, Typography, IconButton, Chip, Collapse, Tooltip } from '@mui/material';
import {
  BugReport as DebugIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Delete as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useDebugMode, useDebugData, filterByAccount, clearAll } from '../hooks/useDebugStore';
import { useAccount } from '../contexts/AccountContext';

// Status dot colors
const SOURCE_COLORS = { socket: '#4caf50', api: '#2196f3' };
const STATUS_COLORS = {
  COMPLETED: '#4caf50',
  FAILED: '#f44336',
  CANCELLED: '#9e9e9e',
  MATCHING: '#2196f3',
  FRIEND_REQUEST_SENT: '#ff9800',
  EXECUTING_GIFT: '#9c27b0',
  EXECUTING_TRADE: '#9c27b0',
  PENDING: '#9e9e9e',
  QUEUED: '#9e9e9e',
};

function formatAge(isoString) {
  if (!isoString) return '—';
  const ms = Date.now() - new Date(isoString).getTime();
  if (ms < 1000) return 'now';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h`;
}

function SourceDot({ source }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        bgcolor: SOURCE_COLORS[source] || '#9e9e9e',
        mr: 0.5,
      }}
    />
  );
}

export default function DebugStrip() {
  const { active } = useDebugMode();
  const [expanded, setExpanded] = useState(false);
  const [filterAccount, setFilterAccount] = useState(true);
  const { selectedAccountId } = useAccount();
  const data = useDebugData(active);

  // Apply account filter
  const events = useMemo(
    () => filterAccount ? filterByAccount(data.events, selectedAccountId) : data.events,
    [data.events, selectedAccountId, filterAccount]
  );
  const rejections = useMemo(
    () => filterAccount ? filterByAccount(data.rejections, selectedAccountId) : data.rejections,
    [data.rejections, selectedAccountId, filterAccount]
  );

  if (!active) return null;

  const lastEvent = events[events.length - 1];
  const staleCount = events.filter(e => {
    if (!e.receivedAt) return false;
    const age = Date.now() - new Date(e.receivedAt).getTime();
    return age > 8 * 60 * 1000 && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(e.status);
  }).length;

  // Active requests from lifecycle
  const activeRequests = [];
  for (const [reqId, steps] of data.lifecycle) {
    const last = steps[steps.length - 1];
    if (last && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(last.status)) {
      activeRequests.push({ requestId: reqId, ...last });
    }
  }

  const oldestActive = activeRequests.reduce((oldest, req) => {
    if (!oldest || req.timestamp < oldest.timestamp) return req;
    return oldest;
  }, null);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: 'rgba(0,0,0,0.85)',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        fontSize: 11,
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Collapsed bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          px: 1.5,
          gap: 2,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <DebugIcon sx={{ fontSize: 14, color: '#ff9800' }} />

        {/* Socket status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: lastEvent ? '#4caf50' : '#9e9e9e',
            }}
          />
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, color: '#b0b0b0' }}>
            Last: {lastEvent ? `${lastEvent.eventName} (${formatAge(lastEvent.receivedAt)})` : 'no events'}
          </Typography>
        </Box>

        {/* Active requests */}
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
          Active: {activeRequests.length}
          {staleCount > 0 && <span style={{ color: '#ff9800' }}> ({staleCount} stale)</span>}
        </Typography>

        {/* Oldest active */}
        {oldestActive && (
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, color: '#ff9800' }}>
            Oldest: {oldestActive.status} {formatAge(oldestActive.timestamp)}
          </Typography>
        )}

        {/* Rejections count */}
        {rejections.length > 0 && (
          <Chip
            label={`${rejections.length} rejected`}
            size="small"
            sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(244,67,54,0.2)', color: '#ef9a9a' }}
          />
        )}

        <Box sx={{ flex: 1 }} />

        {/* Filter toggle */}
        <Tooltip title={filterAccount ? 'Showing selected account only' : 'Showing all accounts'}>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setFilterAccount(!filterAccount); }}
            sx={{ color: filterAccount ? '#4caf50' : '#9e9e9e', p: 0.25 }}
          >
            <FilterIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        <IconButton size="small" sx={{ color: '#9e9e9e', p: 0.25 }}>
          {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      {/* Expanded panel */}
      <Collapse in={expanded}>
        <Box sx={{ maxHeight: 300, overflow: 'auto', px: 1.5, pb: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>

          {/* Event log */}
          <Typography sx={{ fontSize: 10, color: '#888', mt: 0.5, mb: 0.5, fontWeight: 600 }}>
            SOCKET EVENTS ({events.length})
            <IconButton size="small" onClick={clearAll} sx={{ color: '#666', p: 0.25, ml: 1 }}>
              <ClearIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Typography>
          {events.slice().reverse().slice(0, 30).map((e, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, lineHeight: 1.4, py: 0.1 }}>
              <Typography sx={{ fontSize: 10, color: '#666', minWidth: 40 }}>{formatAge(e.receivedAt)}</Typography>
              <SourceDot source={e.source} />
              <Typography sx={{ fontSize: 10, color: STATUS_COLORS[e.status] || '#b0b0b0', minWidth: 120 }}>
                {e.eventName}
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#888' }}>
                {e.requestId ? `req:${String(e.requestId).slice(-6)}` : ''}
                {e.accountId ? ` acct:${String(e.accountId).slice(-4)}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 10, color: STATUS_COLORS[e.status] || '#666' }}>
                {e.status || ''}
              </Typography>
            </Box>
          ))}

          {/* Request lifecycle — shows elapsed duration per phase */}
          {data.lifecycle.size > 0 && (
            <>
              <Typography sx={{ fontSize: 10, color: '#888', mt: 1, mb: 0.5, fontWeight: 600 }}>
                REQUEST LIFECYCLE ({data.lifecycle.size})
              </Typography>
              {Array.from(data.lifecycle.entries()).reverse().slice(0, 20).map(([reqId, steps]) => {
                const lastStep = steps[steps.length - 1];
                const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(lastStep?.status);
                return (
                  <Box key={reqId} sx={{ mb: 0.75, pl: 1, borderLeft: `2px solid ${isTerminal ? '#555' : '#ff9800'}`, py: 0.25 }}>
                    <Typography sx={{ fontSize: 10, color: isTerminal ? '#777' : '#b0b0b0', mb: 0.25 }}>
                      <span style={{ color: '#999' }}>req:{String(reqId).slice(-6)}</span>
                      {isTerminal && <span style={{ color: STATUS_COLORS[lastStep.status] || '#888', marginLeft: 6 }}>{lastStep.status}</span>}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 0', alignItems: 'center' }}>
                      {steps.map((s, j) => {
                        // Calculate time spent in this phase (duration from this step to next, or to now if last)
                        const nextTs = j < steps.length - 1 ? new Date(steps[j + 1].timestamp).getTime() : Date.now();
                        const stepTs = new Date(s.timestamp).getTime();
                        const phaseMs = Math.max(0, nextTs - stepTs);
                        const phaseDur = isTerminal && j === steps.length - 1 ? '' : formatAge(new Date(Date.now() - phaseMs).toISOString());
                        // For terminal last step, show total elapsed from first to last
                        const displayDur = (isTerminal && j === steps.length - 1)
                          ? ''
                          : (phaseMs < 1000 ? '<1s' : formatAge(new Date(Date.now() - phaseMs).toISOString()));
                        // Actually compute directly
                        const durText = (() => {
                          if (isTerminal && j === steps.length - 1) return '';
                          if (phaseMs < 1000) return '<1s';
                          const secs = Math.floor(phaseMs / 1000);
                          if (secs < 60) return `${secs}s`;
                          const mins = Math.floor(secs / 60);
                          return `${mins}m${secs % 60}s`;
                        })();
                        // Color: stale if > 3 min in non-terminal phase
                        const isPhaseStale = !isTerminal && phaseMs > 3 * 60 * 1000 && j === steps.length - 1;
                        return (
                          <span key={j} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <SourceDot source={s.source} />
                            <span style={{ color: STATUS_COLORS[s.status] || '#888', fontSize: 10 }}>{s.status}</span>
                            {durText && (
                              <span style={{ color: isPhaseStale ? '#ff9800' : '#555', fontSize: 9, marginLeft: 2 }}>
                                ({durText})
                              </span>
                            )}
                            {j < steps.length - 1 && <span style={{ color: '#444', margin: '0 3px', fontSize: 10 }}>→</span>}
                          </span>
                        );
                      })}
                      {/* Total elapsed */}
                      {steps.length > 1 && (
                        <span style={{ color: '#666', fontSize: 9, marginLeft: 6 }}>
                          total: {(() => {
                            const total = (isTerminal ? new Date(lastStep.timestamp).getTime() : Date.now()) - new Date(steps[0].timestamp).getTime();
                            const secs = Math.floor(total / 1000);
                            if (secs < 60) return `${secs}s`;
                            const mins = Math.floor(secs / 60);
                            return `${mins}m${secs % 60}s`;
                          })()}
                        </span>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </>
          )}

          {/* Guard rejections */}
          {rejections.length > 0 && (
            <>
              <Typography sx={{ fontSize: 10, color: '#f44336', mt: 1, mb: 0.5, fontWeight: 600 }}>
                GUARD REJECTIONS ({rejections.length})
              </Typography>
              {rejections.slice().reverse().slice(0, 15).map((r, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, lineHeight: 1.4, py: 0.1 }}>
                  <Typography sx={{ fontSize: 10, color: '#666', minWidth: 40 }}>{formatAge(r.timestamp)}</Typography>
                  <Typography sx={{ fontSize: 10, color: '#ef9a9a' }}>
                    {r.reason}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: '#888' }}>
                    {r.eventName} {r.requestId ? `req:${String(r.requestId).slice(-6)}` : ''}
                    {r.accountId ? ` acct:${String(r.accountId).slice(-4)}` : ''}
                  </Typography>
                </Box>
              ))}
            </>
          )}

          {/* Errors */}
          {data.errors.length > 0 && (
            <>
              <Typography sx={{ fontSize: 10, color: '#f44336', mt: 1, mb: 0.5, fontWeight: 600 }}>
                ERRORS ({data.errors.length})
              </Typography>
              {data.errors.slice().reverse().slice(0, 10).map((e, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, lineHeight: 1.4, py: 0.1 }}>
                  <Typography sx={{ fontSize: 10, color: '#666', minWidth: 40 }}>{formatAge(e.timestamp)}</Typography>
                  <Typography sx={{ fontSize: 10, color: '#ef9a9a' }}>
                    [{e.source}] {e.message}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
