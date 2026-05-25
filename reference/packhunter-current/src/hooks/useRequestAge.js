/**
 * useRequestAge — Four-band age visualization for active requests.
 *
 * Bands aligned with backend timeouts:
 *   Active:   < 3 min  — normal operation
 *   Delayed:  3-8 min  — taking longer than usual
 *   Stale:    8-15 min — likely stuck, server will auto-cancel soon
 *   Overdue:  > 15 min — server is cleaning this up
 *
 * Backend auto-cancels at 10-15 min (executor) with 20 min reaper fallback.
 * Client warns early but never acts — backend is the authority.
 *
 * Usage:
 *   const age = useRequestAge(request);
 *   // age = { band, label, color, ageMs, ageText, isTerminal }
 */

import { useMemo } from 'react';
import { useTicker } from './useTicker';

// Thresholds in milliseconds
const DELAYED_MS  = 3  * 60 * 1000;  // 3 min
const STALE_MS    = 8  * 60 * 1000;  // 8 min
const OVERDUE_MS  = 15 * 60 * 1000;  // 15 min

// Phase 26 — TRADE_STUCK_FINALIZATION is terminal-but-not-success.
// Operator must triage; user is told the trade is stuck (not "done",
// not "failed-from-the-start"). Surfaced as terminal so age stops
// ticking and the UI doesn't continue to imply "in flight".
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'TRADE_STUCK_FINALIZATION'];

// Short human-readable phase labels by status. Phase 26 — every label
// here must be TRUTHFUL (no implied success unless settlement is
// proven). Specifically:
//   - WAITING_TRADE_RESPONSE = the bot has sent the offer; what we are
//     literally waiting for is the IN-GAME settlement, so call it
//     "Waiting for in-game confirmation" not just "Waiting".
//   - CONFIRMING / TRADE_ACCEPTED = bot is now finalizing on user
//     side; surface "Finalizing" not "Accepted" (the latter sounds
//     done).
//   - TRADE_STUCK_FINALIZATION = explicit "stuck" — never a success.
const PHASE_LABELS = {
  PENDING:                    'Pending',
  QUEUED:                     'Queued',
  MATCHING:                   'Matching',
  FRIEND_REQUEST_SENT:        'Friend request sent',
  FRIEND_ACCEPTED:            'Friend accepted',
  SUBMITTING_TRADE_PROPOSAL:  'Sending trade offer',
  TRADE_PROPOSAL_SENT:        'Trade offer sent',
  EXECUTING_TRADE:            'Executing trade',
  PICK_CARD:                  'Pick a card',
  TRADE_ACCEPTED:             'Finalizing trade',
  CONFIRMING:                 'Finalizing trade',
  CONFIRMING_TRADE:           'Finalizing trade',
  WAITING_TRADE_RESPONSE:     'Waiting for in-game confirmation',
  TRADE_STUCK_FINALIZATION:   'Stuck during finalization',
  EXECUTING_GIFT:             'Sending gift',
  COMPLETED:                  'Trade completed',
  FAILED:                     'Failed',
  CANCELLED:                  'Cancelled',
};

const BANDS = {
  active:   { label: '',                          color: 'info',    chipColor: 'info' },
  delayed:  { label: 'Taking longer than usual',  color: 'warning', chipColor: 'warning' },
  stale:    { label: 'May be stuck — auto-cancel soon', color: '#ed6c02', chipColor: 'warning' },
  overdue:  { label: 'Server is cleaning this up', color: 'error',  chipColor: 'error' },
  terminal: { label: '',                          color: 'default', chipColor: 'default' },
};

/**
 * Get the phase-aware timestamp for age calculation.
 * Uses the most relevant timestamp for the current status.
 */
function getPhaseTimestamp(request) {
  // Execution phase
  if (request.trade_sent_at || request.gift_sent_at) {
    return request.trade_sent_at || request.gift_sent_at;
  }
  // Friend phase
  if (request.friend_request_sent_at) {
    return request.friend_request_sent_at;
  }
  // Match phase
  if (request.matched_at) {
    return request.matched_at;
  }
  // Fallback
  return request.requested_at || request.created_at;
}

function formatAge(ms) {
  if (ms < 1000) return 'now';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m${remSecs > 0 ? `${remSecs}s` : ''}`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h${mins % 60}m`;
}

function computeAge(request) {
  if (!request) return BANDS.terminal;

  const phaseLabel = PHASE_LABELS[request.status] || request.status || '';

  if (TERMINAL_STATUSES.includes(request.status)) {
    return {
      band: 'terminal',
      ...BANDS.terminal,
      ageMs: 0,
      ageText: '',
      phaseLabel,
      isTerminal: true,
    };
  }

  const ts = getPhaseTimestamp(request);
  if (!ts) {
    return { band: 'active', ...BANDS.active, ageMs: 0, ageText: '', phaseLabel, isTerminal: false };
  }

  const ageMs = Date.now() - new Date(ts).getTime();
  const ageText = formatAge(ageMs);

  let band;
  if (ageMs >= OVERDUE_MS) band = 'overdue';
  else if (ageMs >= STALE_MS) band = 'stale';
  else if (ageMs >= DELAYED_MS) band = 'delayed';
  else band = 'active';

  return {
    band,
    ...BANDS[band],
    ageMs,
    ageText,
    phaseLabel,
    isTerminal: false,
  };
}

/**
 * Hook: live-updating request age with 1s tick for active requests.
 *
 * Wave 3: subscribes to the shared 1s ticker. Lists with N active
 * request rows previously created N timers; now they share one.
 * Terminal requests don't subscribe at all.
 */
export function useRequestAge(request) {
  const isTerminal = TERMINAL_STATUSES.includes(request?.status);
  const tick = useTicker({ enabled: !isTerminal });
  return useMemo(() => computeAge(request), [request, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Pure function (no hook): compute age once without live ticking.
 * Use in list renders where per-item intervals are too expensive.
 */
export function getRequestAge(request) {
  return computeAge(request);
}

export default useRequestAge;
