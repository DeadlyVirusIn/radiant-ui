/**
 * Phase 4.8 (Apr 2026) — Live "time ago" text.
 *
 * Re-renders ONLY itself every 30s so a "5 min ago" label silently
 * advances to "6 min ago" without forcing a parent component re-render.
 * Mirrors the FreshnessIndicator tick-interval (5s for fine-grained
 * freshness pills, 30s here for coarser human-friendly durations).
 *
 * Format ladder:
 *   < 60s     → "just now"
 *   < 60min   → "Xm ago"
 *   < 24h     → "Xh ago"
 *   else      → "Xd ago"
 *
 * Honors prefers-reduced-motion at the global-styles layer (we're a
 * setInterval consumer, not a motion consumer — the user's reduce-motion
 * preference doesn't disable the clock; it disables visual transitions).
 *
 * Usage:
 *   <TimeAgo at={godpack.discoveredAt} />
 *   <TimeAgo at={godpack.discoveredAt} prefix="Found" />
 *   <TimeAgo at={godpack.discoveredAt} component="span" sx={{ color: 'text.secondary' }} />
 */

import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';

const TICK_MS = 30 * 1000;   // 30 seconds — coarse enough to avoid jank

export function formatTimeAgo(at) {
  if (!at) return null;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * @param {object} props
 * @param {string|Date} props.at - timestamp source (ISO / Date / number)
 * @param {string} [props.prefix] - optional "Found" / "Updated" prefix
 * @param {string} [props.component='span'] - MUI Typography component
 * @param {object} [props.sx] - MUI sx forwarding
 * @param {string} [props.variant] - MUI Typography variant
 */
export default function TimeAgo({ at, prefix, component = 'span', sx, variant }) {
  // Local "now" tick. Only THIS component re-renders on each 30s tick;
  // parent stays stable.
  const [, force] = useState(0);
  useEffect(() => {
    if (!at) return undefined;
    const id = setInterval(() => force(n => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [at]);

  const text = formatTimeAgo(at);
  if (!text) return null;

  const display = prefix ? `${prefix} ${text}` : text;
  return (
    <Typography component={component} variant={variant} sx={sx}>
      {display}
    </Typography>
  );
}
