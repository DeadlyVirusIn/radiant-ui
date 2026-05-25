/**
 * Frontend Observability — Structured logging for browser-side decision points.
 *
 * Lightweight. JSON output to console. Gated by sessionStorage flag to avoid spam.
 * Enable verbose mode: sessionStorage.setItem('vudoo_obs', '1')
 *
 * NEVER logs: tokens, passwords, auth headers.
 */

const isVerbose = () => {
  try { return sessionStorage.getItem('vudoo_obs') === '1' } catch { return false }
}

/**
 * Log a structured event to browser console.
 * Always logs warn/error. Info only in verbose mode.
 */
export function logEvent(event, data = {}, level = 'info') {
  if (level === 'info' && !isVerbose()) return
  const entry = { ts: new Date().toISOString(), event, ...data }
  if (level === 'error') {
    console.error('[OBS]', JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn('[OBS]', JSON.stringify(entry))
  } else {
    console.log('[OBS]', JSON.stringify(entry))
  }
}

/**
 * Log an alert-level event (always visible).
 */
export function logAlert(event, severity, data = {}) {
  logEvent(`alert.${event}`, { severity, ...data }, severity === 'P1' ? 'error' : 'warn')
}
