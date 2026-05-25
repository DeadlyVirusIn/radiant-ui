/**
 * useNextAction — Computes the single most important operator action.
 *
 * Priority (highest first):
 *   1. Stuck requests (stale/overdue band)
 *   2. Retryable failures (safe to retry, probability > 40%)
 *   3. Account anomaly (critical severity)
 *   4. Bottleneck phase (slowest phase > 3 min)
 *   5. High success (positive reinforcement)
 *
 * Returns: { priority, severity, icon, title, description, actionLabel?, actionValue? } | null
 *
 * Data sources: request array + age bands + error categories + per-card retry stats.
 * Pure frontend. No API calls.
 */

import { useMemo } from 'react';
import { getRequestAge } from './useRequestAge';
import { isRetryable, getErrorDisplay } from '../utils/errorDisplay';

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function computeRetryRate(requests) {
  const byCard = new Map();
  const recent = requests.slice(0, 100);
  for (const r of recent) {
    const cardId = r.card_id || r.card_name;
    if (!cardId) continue;
    if (!byCard.has(cardId)) byCard.set(cardId, []);
    byCard.get(cardId).push(r);
  }
  let attempts = 0, successes = 0;
  for (const [, reqs] of byCard) {
    if (reqs.length < 2) continue;
    const sorted = [...reqs].sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at));
    for (let i = 1; i < sorted.length; i++) {
      if (TERMINAL.has(sorted[i].status)) {
        attempts++;
        if (sorted[i].status === 'COMPLETED') successes++;
      }
    }
  }
  return attempts > 0 ? Math.round((successes / attempts) * 100) : null;
}

export function useNextAction(requests = [], accounts = []) {
  return useMemo(() => {
    if (!requests || requests.length < 2) return null;

    const active = requests.filter(r => !TERMINAL.has(r.status));
    const failed = requests.filter(r => r.status === 'FAILED');

    // 1. Stuck requests
    const stuckRequests = active.filter(r => {
      const age = getRequestAge(r);
      return age.band === 'stale' || age.band === 'overdue';
    });
    if (stuckRequests.length >= 2) {
      return {
        priority: 1,
        severity: 'warning',
        icon: '⏱️',
        title: `${stuckRequests.length} requests stuck`,
        description: 'These may be auto-cancelled by the server soon. Cancel manually or wait for cleanup.',
        actionLabel: 'View stuck',
        actionValue: 'stale',
      };
    }

    // 2. Retryable failures
    const retryable = failed.filter(r => isRetryable(r.error_message));
    if (retryable.length >= 2) {
      const retryRate = computeRetryRate(requests);
      const rateText = retryRate != null ? ` (~${retryRate}% retry success)` : '';
      return {
        priority: 2,
        severity: 'info',
        icon: '🔄',
        title: `${retryable.length} retryable failures`,
        description: `Network/timeout failures that can be retried${rateText}.`,
        actionLabel: 'View failed',
        actionValue: 'failed',
      };
    }

    // 3. Account anomaly (check for accounts with very high failure rate)
    if (accounts.length >= 2) {
      const byAcct = new Map();
      for (const r of requests) {
        const id = r.user_account_id || 'unknown';
        if (!byAcct.has(id)) byAcct.set(id, { total: 0, failed: 0, completed: 0 });
        const a = byAcct.get(id);
        a.total++;
        if (r.status === 'COMPLETED') a.completed++;
        if (r.status === 'FAILED') a.failed++;
      }
      for (const [id, stats] of byAcct) {
        if (stats.total >= 5 && stats.failed > stats.completed * 3) {
          const name = accounts.find(a => String(a.id) === String(id))?.nickname || `Account ${String(id).slice(-4)}`;
          return {
            priority: 3,
            severity: 'error',
            icon: '🔴',
            title: `${name} needs attention`,
            description: `${stats.failed} failures vs ${stats.completed} completions — credentials may need re-linking.`,
          };
        }
      }
    }

    // 4. Bottleneck phase (check if any phase > 3 min avg from completed requests)
    const completed = requests.filter(r => r.status === 'COMPLETED' && r.requested_at && r.completed_at);
    if (completed.length >= 3) {
      const friendTimes = completed
        .filter(r => r.matched_at && r.friend_request_sent_at)
        .map(r => new Date(r.friend_request_sent_at) - new Date(r.matched_at))
        .filter(ms => ms > 0 && ms < 30 * 60 * 1000);
      const avgFriend = friendTimes.length > 0 ? friendTimes.reduce((a, b) => a + b, 0) / friendTimes.length : 0;

      const matchTimes = completed
        .filter(r => r.requested_at && r.matched_at)
        .map(r => new Date(r.matched_at) - new Date(r.requested_at))
        .filter(ms => ms > 0 && ms < 30 * 60 * 1000);
      const avgMatch = matchTimes.length > 0 ? matchTimes.reduce((a, b) => a + b, 0) / matchTimes.length : 0;

      if (avgFriend > 3 * 60 * 1000) {
        const mins = Math.round(avgFriend / 60000);
        return {
          priority: 4,
          severity: 'info',
          icon: '👥',
          title: 'Friend step is the bottleneck',
          description: `Averaging ${mins}m in the friend phase. Keep the game open to accept requests faster.`,
        };
      }
      if (avgMatch > 3 * 60 * 1000) {
        const mins = Math.round(avgMatch / 60000);
        return {
          priority: 4,
          severity: 'info',
          icon: '🔍',
          title: 'Matching is slow',
          description: `Averaging ${mins}m to find a match. Card stock may be low — try different cards.`,
        };
      }
    }

    // 5. High success (positive)
    const recent20 = requests.slice(0, 20);
    if (recent20.length >= 5) {
      const rate = recent20.filter(r => r.status === 'COMPLETED').length / recent20.length;
      if (rate >= 0.9) {
        return {
          priority: 5,
          severity: 'success',
          icon: '✅',
          title: 'Running smoothly',
          description: `${Math.round(rate * 100)}% success rate on your last ${recent20.length} requests.`,
        };
      }
    }

    return null;
  }, [requests, accounts]);
}

/**
 * Compute retry probability for a specific card based on historical data.
 * Returns: number (0-100) or null if insufficient data.
 */
export function getCardRetryProbability(cardId, requests) {
  if (!cardId || !requests || requests.length < 5) return null;

  const cardReqs = requests.filter(r => (r.card_id || r.card_name) === cardId && TERMINAL.has(r.status));
  if (cardReqs.length < 2) {
    // Fall back to overall retry rate
    return computeRetryRate(requests);
  }

  const sorted = [...cardReqs].sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at));
  let attempts = 0, successes = 0;
  for (let i = 1; i < sorted.length; i++) {
    attempts++;
    if (sorted[i].status === 'COMPLETED') successes++;
  }
  return attempts > 0 ? Math.round((successes / attempts) * 100) : null;
}

export default useNextAction;
