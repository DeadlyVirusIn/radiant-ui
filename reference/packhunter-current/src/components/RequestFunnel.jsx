/**
 * RequestFunnel — Visual funnel showing how many requests reached each phase,
 * average time per phase, and retry success rate.
 *
 * Pure frontend computation from request timestamps. No API calls.
 * Collapsed by default — operator expands when investigating bottlenecks.
 */

import { useMemo } from 'react';
import { Box, Typography, Chip, LinearProgress } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import MetricStrip from './MetricStrip';
import SectionPanel from './SectionPanel';

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

// Phase definitions with timestamp fields
const PHASES = [
  { key: 'created', label: 'Created', check: () => true },
  { key: 'matched', label: 'Matched', check: (r) => !!r.matched_at },
  { key: 'friend', label: 'Friend Sent', check: (r) => !!r.friend_request_sent_at },
  { key: 'executing', label: 'Executing', check: (r) => !!(r.trade_sent_at || r.gift_sent_at) },
  { key: 'completed', label: 'Completed', check: (r) => r.status === 'COMPLETED' },
];

function formatDuration(ms) {
  if (ms == null || ms <= 0) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m${secs % 60}s`;
}

function computeFunnel(requests) {
  if (!requests || requests.length < 3) return null;

  const recent = requests.slice(0, 100);

  // Phase counts: how many requests reached each phase
  const phaseCounts = PHASES.map(phase => ({
    ...phase,
    count: recent.filter(phase.check).length,
  }));

  // Phase timing: avg time between consecutive phases (completed requests only)
  const completed = recent.filter(r => r.status === 'COMPLETED');
  const timings = [];

  const calcAvg = (pairs) => {
    const valid = pairs.filter(ms => ms > 0 && ms < 30 * 60 * 1000);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  // Matching phase: requested_at → matched_at
  timings.push({
    label: 'Matching',
    avgMs: calcAvg(completed.filter(r => r.requested_at && r.matched_at)
      .map(r => new Date(r.matched_at) - new Date(r.requested_at))),
  });

  // Friend phase: matched_at → friend_request_sent_at
  timings.push({
    label: 'Friend',
    avgMs: calcAvg(completed.filter(r => r.matched_at && r.friend_request_sent_at)
      .map(r => new Date(r.friend_request_sent_at) - new Date(r.matched_at))),
  });

  // Execution phase: friend_request_sent_at → (trade_sent_at | gift_sent_at)
  timings.push({
    label: 'Execution',
    avgMs: calcAvg(completed.filter(r => r.friend_request_sent_at && (r.trade_sent_at || r.gift_sent_at))
      .map(r => new Date(r.trade_sent_at || r.gift_sent_at) - new Date(r.friend_request_sent_at))),
  });

  // Completion phase: (trade_sent_at | gift_sent_at) → completed_at
  timings.push({
    label: 'Finalize',
    avgMs: calcAvg(completed.filter(r => (r.trade_sent_at || r.gift_sent_at) && r.completed_at)
      .map(r => new Date(r.completed_at) - new Date(r.trade_sent_at || r.gift_sent_at))),
  });

  // Retry success rate: group by card_id, check if 2nd+ attempt succeeds
  const byCard = new Map();
  for (const r of recent) {
    const cardId = r.card_id || r.card_name;
    if (!cardId) continue;
    if (!byCard.has(cardId)) byCard.set(cardId, []);
    byCard.get(cardId).push(r);
  }

  let retryAttempts = 0;
  let retrySuccesses = 0;
  for (const [, reqs] of byCard) {
    if (reqs.length < 2) continue;
    // Sort by requested_at, skip first attempt
    const sorted = [...reqs].sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at));
    for (let i = 1; i < sorted.length; i++) {
      if (TERMINAL.has(sorted[i].status)) {
        retryAttempts++;
        if (sorted[i].status === 'COMPLETED') retrySuccesses++;
      }
    }
  }
  const retryRate = retryAttempts > 0 ? Math.round((retrySuccesses / retryAttempts) * 100) : null;

  // Slowest phase
  const slowest = timings.reduce((max, t) => (!max || (t.avgMs && t.avgMs > (max.avgMs || 0))) ? t : max, null);

  return { phaseCounts, timings, retryRate, retryAttempts, retrySuccesses, total: recent.length, slowest };
}

export default function RequestFunnel({ requests = [], sx }) {
  const funnel = useMemo(() => computeFunnel(requests), [requests]);

  if (!funnel) return null;

  const maxCount = funnel.phaseCounts[0]?.count || 1;

  // Find the biggest single-step dropoff for highlighting (P3)
  let biggestDropIdx = -1;
  let biggestDropVal = 0;
  funnel.phaseCounts.forEach((phase, i) => {
    if (i === 0) return;
    const drop = funnel.phaseCounts[i - 1].count - phase.count;
    if (drop > biggestDropVal) { biggestDropVal = drop; biggestDropIdx = i; }
  });

  // Queue prioritization hint — identify bottleneck with actionable advice
  const bottleneckHint = (() => {
    if (!funnel.slowest?.avgMs || funnel.slowest.avgMs < 60 * 1000) return null;
    const hints = {
      Matching: 'Card stock may be low — try different cards',
      Friend: 'Keep game open to accept friend requests faster',
      Execution: 'Server may be under load — requests will auto-retry',
      Finalize: 'Trade confirmation slow — typically resolves on its own',
    };
    return hints[funnel.slowest.label] || null;
  })();

  const chips = [
    { label: `${funnel.total} requests` },
    ...(funnel.slowest?.avgMs ? [{
      label: `Slowest: ${funnel.slowest.label} (${formatDuration(funnel.slowest.avgMs)})`,
      color: 'warning', variant: 'outlined',
    }] : []),
    ...(biggestDropVal > 0 ? [{
      label: `Biggest drop: ${funnel.phaseCounts[biggestDropIdx]?.label} (−${biggestDropVal})`,
      color: 'error', variant: 'outlined',
    }] : []),
  ];

  return (
    <SectionPanel
      icon={<FilterListIcon />}
      title="Request Funnel"
      chips={chips}
      sx={sx}
    >
      {/* Funnel bars */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {funnel.phaseCounts.map((phase, i) => {
          const pct = maxCount > 0 ? (phase.count / maxCount) * 100 : 0;
          const dropoff = i > 0 ? funnel.phaseCounts[i - 1].count - phase.count : 0;
          const isBiggestDrop = i === biggestDropIdx;
          return (
            <Box key={phase.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', minWidth: 70, textAlign: 'right', fontWeight: isBiggestDrop ? 700 : 400 }}>
                {phase.label}
              </Typography>
              <Box sx={{ flex: 1, position: 'relative' }}>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  color={phase.key === 'completed' ? 'success' : 'primary'}
                  sx={{ height: 16, borderRadius: 1, bgcolor: 'action.hover' }}
                />
                <Typography sx={{
                  position: 'absolute', top: 0, left: 8, lineHeight: '16px',
                  fontSize: '0.6rem', fontWeight: 600, color: pct > 30 ? 'white' : 'text.primary',
                }}>
                  {phase.count}
                </Typography>
              </Box>
              {dropoff > 0 && (
                <Typography sx={{
                  fontSize: isBiggestDrop ? '0.7rem' : '0.6rem',
                  fontWeight: isBiggestDrop ? 700 : 400,
                  color: 'error.main',
                  minWidth: 35,
                }}>
                  −{dropoff}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Phase timing row */}
      <MetricStrip
        items={[
          ...funnel.timings.map(t => ({
            label: t.label,
            value: formatDuration(t.avgMs),
            color: t.avgMs && t.avgMs > 5 * 60 * 1000 ? 'warning.main' : 'info.main',
            tooltip: t.avgMs ? `Average time in ${t.label.toLowerCase()} phase` : 'Insufficient data',
          })),
          ...(funnel.retryRate != null ? [{
            label: 'Retry Success',
            value: `${funnel.retryRate}%`,
            color: funnel.retryRate >= 60 ? 'success.main' : funnel.retryRate >= 30 ? 'warning.main' : 'error.main',
            tooltip: `${funnel.retrySuccesses} of ${funnel.retryAttempts} retry attempts succeeded`,
          }] : []),
        ]}
        sx={{ mt: 1.5 }}
      />

      {/* Bottleneck insight */}
      {bottleneckHint && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '0.65rem', color: 'warning.main', fontStyle: 'italic' }}>
          💡 {bottleneckHint}
        </Typography>
      )}
    </SectionPanel>
  );
}
