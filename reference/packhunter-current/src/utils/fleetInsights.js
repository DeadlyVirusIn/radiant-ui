/**
 * Phase 9 — deterministic operational insights from Fleet Summary + history.
 *
 * An insight is a SHORT narrative summary — not a stat, not an alert.
 * They read like a SRE briefing line: "Idle up 40% over 10m",
 * "PPM back to normal after dip", "Errors concentrated in errors bucket".
 *
 * Rules:
 *   - Only emit insights grounded in actual data points we have.
 *   - Don't duplicate alert messages. If an alert says "14 idle", we
 *     don't ALSO emit "idle up". But we CAN emit a recovery insight
 *     ("idle recovered") that no alert covers.
 *   - Max 3 — caller will slice anyway, but we rank internally.
 *
 * Priorities (higher = show first):
 *   100 — incident recovery (current healthy, recent history bad)
 *    80 — sustained degradation missed by alerts
 *    60 — sharp trend changes (up or down by meaningful %)
 *    20 — leader / positive notes (only if useful)
 */

const TREND_PCT = 25;           // sharp trend change threshold
const MIN_HISTORY_FOR_TREND = 4;
const MIN_HISTORY_FOR_MEDIAN = 6;

function tileValue(tile) { return Number(tile?.value ?? 0); }
function historyOf(tile) { return Array.isArray(tile?.history) ? tile.history.map(h => Number(h?.value || 0)) : []; }

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pctChange(from, to) {
  if (!(from > 0)) return to === 0 ? 0 : Infinity;
  return ((to - from) / from) * 100;
}

function windowMinutes(history) {
  if (!history || history.length < 2) return 0;
  const firstTs = new Date(history[0]?.ts || 0).getTime();
  const lastTs  = new Date(history[history.length - 1]?.ts || 0).getTime();
  if (!Number.isFinite(firstTs) || !Number.isFinite(lastTs)) return 0;
  return Math.max(0, Math.round((lastTs - firstTs) / 60_000));
}

/**
 * Build the insight list.
 *
 * @param {object} args
 * @param {object} args.tiles             Fleet tiles object (includes history[])
 * @param {Array}  args.alerts            Current alerts (used to avoid duplicates)
 * @param {object} [args.rebalanceHeadline] Phase 14: optional rebalance headline
 * @param {number} [args.limit]           Max insights to return (default 3)
 * @returns {Array<{ priority, kind, severity, title, body }>}
 */
export function deriveInsights({ tiles = {}, alerts = [], rebalanceHeadline = null, limit = 3 } = {}) {
  const alertIds = new Set(alerts.map(a => a.id));
  const insights = [];

  /* ── Recovery: idle hunters came back down ───────────────────── */
  const idleHist = historyOf(tiles.idleHunters);
  const idleNow = tileValue(tiles.idleHunters);
  if (idleHist.length >= MIN_HISTORY_FOR_MEDIAN) {
    const priorMed = median(idleHist.slice(0, -2));
    if (priorMed >= 5 && idleNow <= Math.ceil(priorMed * 0.5) && idleNow <= 3) {
      insights.push({
        priority: 100,
        kind: 'recovery',
        severity: 'info',
        title: 'Idle hunters recovered',
        body: `Down to ${idleNow} from recent median ${Math.round(priorMed)}.`,
      });
    }
  }

  /* ── Recovery: errors cleared ───────────────────────────────── */
  const errHist = historyOf(tiles.errorHunters);
  const errNow = tileValue(tiles.errorHunters);
  if (errHist.length >= MIN_HISTORY_FOR_MEDIAN) {
    const priorMed = median(errHist.slice(0, -2));
    if (priorMed >= 2 && errNow === 0) {
      insights.push({
        priority: 100,
        kind: 'recovery',
        severity: 'info',
        title: 'Error hunters cleared',
        body: `Back to 0 from recent median ${Math.round(priorMed)}.`,
      });
    }
  }

  /* ── Sustained degradation: idle climbing but not yet alert-level ─ */
  if (idleHist.length >= MIN_HISTORY_FOR_TREND && !alertIds.has('too-many-idle')) {
    const start = idleHist[0];
    const delta = pctChange(start, idleNow);
    if (idleNow >= 3 && delta >= TREND_PCT) {
      const mins = windowMinutes(tiles.idleHunters?.history);
      insights.push({
        priority: 80,
        kind: 'trend',
        severity: 'warning',
        title: `Idle hunters up ${Math.round(delta)}% over ${mins}m`,
        body: `From ${start} to ${idleNow}.`,
      });
    }
  }

  /* ── Sharp errors trend (short window) ─────────────────────── */
  if (errHist.length >= MIN_HISTORY_FOR_TREND && !alertIds.has('hunters-in-error')) {
    const start = errHist[0];
    const delta = pctChange(start, errNow);
    if (errNow >= 2 && delta >= TREND_PCT) {
      const mins = windowMinutes(tiles.errorHunters?.history);
      insights.push({
        priority: 80,
        kind: 'trend',
        severity: 'warning',
        title: `Errors rising: ${start} → ${errNow} over ${mins}m`,
        body: 'Active pack failures accumulating.',
      });
    }
  }

  /* ── God-pack throughput drop (info-level trend) ───────────── */
  const gpHist = historyOf(tiles.recentGodPacks);
  const gpNow = tileValue(tiles.recentGodPacks);
  if (gpHist.length >= MIN_HISTORY_FOR_MEDIAN && !alertIds.has('gp-throughput-drop')) {
    const priorMed = median(gpHist.slice(0, -1));
    if (priorMed >= 4 && gpNow <= priorMed * 0.75) {
      const dropPct = Math.round(((priorMed - gpNow) / priorMed) * 100);
      const mins = windowMinutes(tiles.recentGodPacks?.history);
      insights.push({
        priority: 60,
        kind: 'trend',
        severity: 'info',
        title: `God-pack rate down ${dropPct}% over ${mins}m`,
        body: `${gpNow} in last window vs median ${Math.round(priorMed)}.`,
      });
    }
  }

  /* ── Positive: paid users rising (only when not overshadowed) ─ */
  const paidHist = historyOf(tiles.paidActive);
  const paidNow = tileValue(tiles.paidActive);
  if (paidHist.length >= MIN_HISTORY_FOR_TREND) {
    const start = paidHist[0];
    const delta = pctChange(start, paidNow);
    if (start >= 5 && delta >= 10) {
      insights.push({
        priority: 20,
        kind: 'leader',
        severity: 'info',
        title: `Paid users up ${Math.round(delta)}%`,
        body: `From ${start} to ${paidNow}.`,
      });
    }
  }

  /* ── Phase 14 — rebalance-aware insights ────────────────────── */
  if (rebalanceHeadline) {
    // 1. Recent auto-apply success — narrates the outcome for ~5 min.
    if (rebalanceHeadline.status === 'applied' && rebalanceHeadline.lastApply) {
      const { imbalanceBefore, imbalanceAfter } = rebalanceHeadline.lastApply;
      insights.push({
        priority: 95,
        kind: 'recovery',
        severity: 'info',
        title: `Auto-rebalance applied: imbalance ${imbalanceBefore}→${imbalanceAfter}`,
        body: 'Applied within policy gates.',
      });
    }

    // 2. Blocked rebalance — system wants to rebalance but can't.
    if (rebalanceHeadline.status === 'blocked' && rebalanceHeadline.blockers?.length) {
      insights.push({
        priority: 85,
        kind: 'trend',
        severity: 'warning',
        title: 'Rebalance blocked',
        body: `imbalance ${rebalanceHeadline.currentImbalance}; ${rebalanceHeadline.blockers.join(', ')}`,
      });
    }

    // 3. Recommended rebalance awaiting an operator click.
    if (rebalanceHeadline.status === 'recommended') {
      insights.push({
        priority: 75,
        kind: 'trend',
        severity: 'info',
        title: `Rebalance recommended: imbalance ${rebalanceHeadline.currentImbalance}→${rebalanceHeadline.projectedImbalance}`,
        body: rebalanceHeadline.blockers?.length
          ? `${rebalanceHeadline.blockers.join(', ')} excluded`
          : 'Open Hybrid Control to apply',
      });
    }
  }

  insights.sort((a, b) => b.priority - a.priority);
  return insights.slice(0, limit);
}
