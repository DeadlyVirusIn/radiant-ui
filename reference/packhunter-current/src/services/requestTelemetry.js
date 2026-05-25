/**
 * Client-side request telemetry — Wave 1 instrumentation.
 *
 * Purpose: give operators hard numbers to validate that the cascade fix
 * worked, without shipping a full APM layer.
 *
 * Emits `[REQ-TELEMETRY]` lines to console at every full-page lifecycle:
 *   - cumulative request counter per page session (resets on navigation)
 *   - in-flight dedup hits (would-have-been-duplicate requests saved)
 *   - 429 events by endpoint
 *   - optional: window.__requestTelemetry snapshot for debug panels
 *
 * Zero dependencies. No network egress. Safe to leave on in production.
 */

const SESSION_START = Date.now();

const state = {
  totalRequests: 0,
  dedupedRequests: 0,          // would-have-been-duplicate GET calls short-circuited
  rateLimitHits: {},           // { endpoint: count }
  retryAttempts: 0,            // single-retry-on-429 fires
  byEndpoint: {},              // { endpoint: { count, lastTs } }
};

// Low-cardinality endpoint key (strips numeric IDs, long hashes)
function endpointKey(url) {
  try {
    const u = new URL(url, 'http://x');
    return u.pathname
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[A-Za-z0-9]{20,}/g, '/:hash');
  } catch {
    return url.split('?')[0];
  }
}

function record(url) {
  const ep = endpointKey(url);
  state.totalRequests++;
  const bucket = state.byEndpoint[ep] || (state.byEndpoint[ep] = { count: 0, lastTs: 0 });
  bucket.count++;
  bucket.lastTs = Date.now();
}

function recordDedup(url) {
  state.dedupedRequests++;
  const ep = endpointKey(url);
  console.log(`[REQ-TELEMETRY] dedup-hit ${ep} (total saved: ${state.dedupedRequests})`);
}

function recordRateLimit(url, retryAfter) {
  const ep = endpointKey(url);
  state.rateLimitHits[ep] = (state.rateLimitHits[ep] || 0) + 1;
  console.warn(`[REQ-TELEMETRY] 429 on ${ep} (retryAfter=${retryAfter || '?'}s, occurrences: ${state.rateLimitHits[ep]})`);
}

function recordRetry() {
  state.retryAttempts++;
}

function snapshot() {
  const elapsedSec = Math.round((Date.now() - SESSION_START) / 1000);
  return {
    elapsedSec,
    totalRequests: state.totalRequests,
    dedupedRequests: state.dedupedRequests,
    retryAttempts: state.retryAttempts,
    rateLimitHits: { ...state.rateLimitHits },
    topEndpoints: Object.entries(state.byEndpoint)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([ep, v]) => ({ endpoint: ep, count: v.count })),
  };
}

// Surface snapshot at every page nav (popstate / visibility change)
// so we get a clean per-page-load readout in the console.
let lastReportedAt = 0;
function reportIfPageLoadFinished(reason) {
  const now = Date.now();
  if (now - lastReportedAt < 2000) return; // coalesce bursts
  lastReportedAt = now;
  const s = snapshot();
  console.log(
    `[REQ-TELEMETRY] page-load-summary (${reason}) ` +
    `requests=${s.totalRequests} deduped=${s.dedupedRequests} ` +
    `retries=${s.retryAttempts} 429s=${Object.values(s.rateLimitHits).reduce((a, b) => a + b, 0)} ` +
    `elapsed=${s.elapsedSec}s`
  );
  console.log('[REQ-TELEMETRY] top endpoints:', s.topEndpoints);
}

if (typeof window !== 'undefined') {
  window.__requestTelemetry = snapshot;
  // Fire a summary once the page is quiet after initial load
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('load', () => {
      setTimeout(() => reportIfPageLoadFinished('initial-load'), 5000);
    });
  }
}

export {
  record,
  recordDedup,
  recordRateLimit,
  recordRetry,
  snapshot,
  reportIfPageLoadFinished,
  endpointKey,
};
