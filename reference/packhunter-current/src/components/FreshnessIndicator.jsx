/**
 * FreshnessIndicator — Phase 3 (Apr 2026).
 *
 * Small, non-intrusive freshness pill for any read-model surface that
 * exposes lastUpdatedAt + (optional) cacheStatus / cacheAgeMs /
 * staleFlags. Designed to be paired with /api/godpacks/feed and
 * /api/wonderpicks/feed responses.
 *
 * States:
 *   synced  — fresh data, < FRESH_S seconds since lastUpdatedAt
 *             AND cacheStatus is hit/miss-but-recent
 *   cached  — older than FRESH_S, younger than STALE_S, OR
 *             cacheStatus === 'hit' with notable cacheAgeMs
 *   stale   — older than STALE_S OR staleFlags non-empty
 *   miss    — cacheStatus === 'miss' (special label)
 *
 * Updates relative time via a single 5s interval (cleanup on unmount).
 * Re-renders are throttled to ~once per 5s — no spam.
 */

import { useEffect, useState, useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const FRESH_S = 30;
const STALE_S = 300;
const TICK_MS  = 5000;

function formatRel(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  if (seconds < 5)         return 'just now';
  if (seconds < 60)        return `${Math.floor(seconds)}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60)           return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)          return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function FreshnessIndicator({
  lastUpdatedAt = null,
  cacheStatus = null,             // 'hit' | 'miss' | null
  cacheAgeMs = null,
  staleFlags = null,              // string[]
  warmHint = null,                // when miss, hint to call existing endpoint to warm
  variant = 'compact',            // 'compact' | 'detail'
  sx = {},
}) {
  // Re-render every TICK_MS so the relative time updates without
  // every parent component re-rendering on its own poll.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Compute current state from inputs (memoized — input changes only).
  const { state, label, color, tooltip } = useMemo(() => {
    const stale = Array.isArray(staleFlags) && staleFlags.length > 0;
    const ts = lastUpdatedAt ? new Date(lastUpdatedAt).getTime() : null;
    const ageS = ts && !Number.isNaN(ts) ? Math.max(0, (Date.now() - ts) / 1000) : null;
    // Recompute on every render so tick advances label text.
    if (cacheStatus === 'miss') {
      return {
        state: 'miss',
        label: warmHint ? 'Loading…' : 'Not cached',
        color: 'warning.main',
        tooltip: warmHint ? `Fetching live data from ${warmHint}` : 'No cached data yet',
      };
    }
    if (stale) {
      return {
        state: 'stale',
        label: 'Stale',
        color: 'error.main',
        tooltip: `Data marked stale: ${staleFlags.join(', ')}`,
      };
    }
    if (ageS == null) {
      return { state: 'unknown', label: '—', color: 'text.disabled', tooltip: 'No timestamp' };
    }
    if (ageS < FRESH_S) {
      const rel = formatRel(ageS) || 'just now';
      return {
        state: 'synced',
        label: rel === 'just now' ? 'Synced just now' : `Synced ${rel}`,
        color: 'success.main',
        tooltip: cacheStatus === 'hit'
          ? `From cache (age ${Math.round((cacheAgeMs ?? 0) / 1000)}s)`
          : `Last sync ${new Date(ts).toLocaleString()}`,
      };
    }
    if (ageS < STALE_S) {
      const rel = formatRel(ageS) || `${Math.round(ageS)}s ago`;
      return {
        state: 'cached',
        label: cacheStatus === 'hit' ? `Cached ${rel}` : `Last sync ${rel}`,
        color: 'warning.main',
        tooltip: `Last sync ${new Date(ts).toLocaleString()}`,
      };
    }
    const rel = formatRel(ageS) || 'long ago';
    return {
      state: 'stale',
      label: `Stale (${rel})`,
      color: 'error.main',
      tooltip: `Last sync ${new Date(ts).toLocaleString()} — older than ${STALE_S}s`,
    };
    // intentionally include force-rerender token in deps via no-op
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdatedAt, cacheStatus, cacheAgeMs, staleFlags, warmHint, /* force tick */ Math.floor(Date.now() / TICK_MS)]);

  return (
    <Tooltip title={tooltip || ''} arrow>
      <Box
        component="span"
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 0.75, py: 0.25, borderRadius: 1,
          bgcolor: 'transparent', color,
          fontSize: variant === 'detail' ? '0.75rem' : '0.65rem',
          lineHeight: 1, fontWeight: 600,
          ...sx,
        }}
        data-state={state}
        data-testid="freshness-indicator"
      >
        <FiberManualRecordIcon sx={{ fontSize: variant === 'detail' ? 10 : 8 }} />
        <Typography component="span" variant="caption" sx={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// Exposed for tests.
export const FRESHNESS_THRESHOLDS = { FRESH_S, STALE_S };
