/**
 * IntelligenceStrip — Phase 4 (Apr 2026).
 *
 * Three side-by-side cards: NOW · NEXT · RISK.
 * Each section hides gracefully when its underlying signal is null.
 *
 * Inputs (all optional — pass only what's available):
 *   now: { ppm?, activeHunts?, liveGodpacks?, lastUpdatedAt? }
 *   next: { trendDir?: 'up'|'down'|'flat', forecastHourly?, label? }
 *   risk: Array<{ severity:'low'|'med'|'high', text:string, kind?:string }>
 *
 * No backend logic. No data invention. If `now` and `next` and
 * `risk` all evaluate empty, returns null (component renders nothing).
 */

import React from 'react';
import { Box, Paper, Typography, Tooltip, Chip, Skeleton } from '@mui/material';
import {
  Bolt as NowIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Warning as RiskIcon,
  CheckCircle as OkIcon,
} from '@mui/icons-material';
import FreshnessIndicator from './FreshnessIndicator';

function isEmpty(obj) {
  return !obj || Object.values(obj).every(v => v == null || v === '' || (Array.isArray(v) && v.length === 0));
}

function NowCard({ now }) {
  const ppm          = now?.ppm;
  const activeHunts  = now?.activeHunts;
  const liveGodpacks = now?.liveGodpacks;
  return (
    <Paper elevation={0} sx={{
      p: 2, height: '100%', border: 1, borderColor: 'divider', borderRadius: 1.5,
      borderLeft: 4, borderLeftColor: 'success.main',
      display: 'flex', flexDirection: 'column', gap: 0.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <NowIcon sx={{ fontSize: 18, color: 'success.main' }} />
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1, lineHeight: 1, color: 'text.secondary' }}>
          NOW
        </Typography>
      </Box>
      {ppm != null && (
        <Typography variant="body2"><strong>PPM:</strong> {Number(ppm).toFixed(1)}/min</Typography>
      )}
      {activeHunts != null && (
        <Typography variant="body2"><strong>Active hunts:</strong> {activeHunts}</Typography>
      )}
      {liveGodpacks != null && (
        <Typography variant="body2"><strong>Live god packs:</strong> {liveGodpacks}</Typography>
      )}
      {now?.lastUpdatedAt && (
        <FreshnessIndicator lastUpdatedAt={now.lastUpdatedAt} variant="compact" sx={{ mt: 'auto', alignSelf: 'flex-start' }} />
      )}
    </Paper>
  );
}

function NextCard({ next }) {
  const dir = next?.trendDir;
  const Trend = dir === 'up' ? TrendingUpIcon : dir === 'down' ? TrendingDownIcon : TrendingFlatIcon;
  const trendColor = dir === 'up' ? 'success.main' : dir === 'down' ? 'error.main' : 'text.secondary';
  return (
    <Paper elevation={0} sx={{
      p: 2, height: '100%', border: 1, borderColor: 'divider', borderRadius: 1.5,
      borderLeft: 4, borderLeftColor: 'info.main',
      display: 'flex', flexDirection: 'column', gap: 0.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Trend sx={{ fontSize: 18, color: trendColor }} />
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1, lineHeight: 1, color: 'text.secondary' }}>
          NEXT
        </Typography>
      </Box>
      {next?.label && (
        <Typography variant="body2" sx={{ color: trendColor, fontWeight: 600 }}>
          {next.label}
        </Typography>
      )}
      {next?.forecastHourly != null && (
        <Typography variant="body2">
          <strong>~{Number(next.forecastHourly).toLocaleString()}</strong> packs forecast (1h)
        </Typography>
      )}
      {!next?.label && next?.forecastHourly == null && (
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          No forecast data yet
        </Typography>
      )}
    </Paper>
  );
}

function RiskCard({ risk }) {
  const items = Array.isArray(risk) ? risk : [];
  const empty = items.length === 0;
  const sevColor = (s) => s === 'high' ? 'error.main' : s === 'med' ? 'warning.main' : 'info.main';
  return (
    <Paper elevation={0} sx={{
      p: 2, height: '100%', border: 1, borderColor: 'divider', borderRadius: 1.5,
      borderLeft: 4, borderLeftColor: empty ? 'success.main' : 'error.main',
      display: 'flex', flexDirection: 'column', gap: 0.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {empty
          ? <OkIcon sx={{ fontSize: 18, color: 'success.main' }} />
          : <RiskIcon sx={{ fontSize: 18, color: 'error.main' }} />}
        <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1, lineHeight: 1, color: 'text.secondary' }}>
          RISK
        </Typography>
        {!empty && (
          <Chip size="small" color="error" label={items.length} sx={{ ml: 'auto', height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
        )}
      </Box>
      {empty ? (
        <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
          No active risks
        </Typography>
      ) : (
        items.slice(0, 4).map((r, i) => (
          <Tooltip key={i} title={r.kind || ''} arrow>
            <Typography variant="body2" sx={{ color: sevColor(r.severity), fontSize: '0.8rem' }}>
              ⚠ {r.text}
            </Typography>
          </Tooltip>
        ))
      )}
      {items.length > 4 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          +{items.length - 4} more
        </Typography>
      )}
    </Paper>
  );
}

// Phase 4.7 — Skeleton placeholder. Three card-shaped blocks matching
// the final NOW/NEXT/RISK layout, so first-paint reserves the same
// vertical space and avoids layout shift when real data arrives.
// Caller passes loading={true} OR the strip auto-renders skeletons
// when all three signals are undefined (vs explicitly empty).
function IntelligenceStripSkeleton() {
  return (
    <Box sx={{
      display: 'grid',
      gap: 2,
      mb: 2,
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
      },
    }}>
      {[0, 1, 2].map(i => (
        <Paper
          key={i}
          elevation={0}
          sx={{
            p: 2, height: '100%', minHeight: 96,
            border: 1, borderColor: 'divider', borderRadius: 1.5,
            borderLeft: 4,
            borderLeftColor: i === 0 ? 'success.main' : i === 1 ? 'info.main' : 'warning.main',
            display: 'flex', flexDirection: 'column', gap: 0.75,
          }}
        >
          <Skeleton variant="text" width={50} height={14} />
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={14} sx={{ mt: 'auto' }} />
        </Paper>
      ))}
    </Box>
  );
}

export default function IntelligenceStrip({ now, next, risk, loading = false }) {
  // Phase 4.7 — explicit loading prop wins; otherwise treat
  // "all three signals are undefined" (not just empty) as a still-fetching
  // state. Callers that pass explicit empty objects/arrays render normally
  // (per the existing isEmpty() contract — empty object STILL hides cards).
  const allUnset =
    now === undefined && next === undefined && risk === undefined;
  if (loading || allUnset) {
    return <IntelligenceStripSkeleton />;
  }

  const showNow  = !isEmpty(now);
  const showNext = !isEmpty(next);
  const showRisk = Array.isArray(risk);   // always show RISK card if explicit array (even empty = "all clear")
  if (!showNow && !showNext && !showRisk) return null;

  return (
    <Box sx={{
      display: 'grid',
      gap: 2,
      mb: 2,
      gridTemplateColumns: {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
      },
    }}>
      {showNow  && <NowCard now={now} />}
      {showNext && <NextCard next={next} />}
      {showRisk && <RiskCard risk={risk} />}
    </Box>
  );
}
