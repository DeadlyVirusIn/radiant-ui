/**
 * Number formatting utilities for consistent display across the WebUI.
 * Uses locale-aware formatting and tabular figures for data alignment.
 */

/**
 * Format a number with locale-aware thousands separators
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(num, decimals = 0) {
  if (num == null || isNaN(num)) return '—'
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format a large number with K/M/B suffix
 * @param {number} num - Number to format
 * @returns {string} Compact number string (e.g., "1.2K", "3.5M")
 */
export function formatCompact(num) {
  if (num == null || isNaN(num)) return '—'
  if (Math.abs(num) < 1000) return num.toString()
  const suffixes = ['', 'K', 'M', 'B']
  const tier = Math.floor(Math.log10(Math.abs(num)) / 3)
  const suffix = suffixes[Math.min(tier, suffixes.length - 1)]
  const scale = Math.pow(10, tier * 3)
  const scaled = num / scale
  return scaled.toFixed(scaled < 10 ? 1 : 0) + suffix
}

/**
 * Format a percentage
 * @param {number} num - Number to format as percentage (0-100)
 * @param {number} decimals - Decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export function formatPercent(num, decimals = 1) {
  if (num == null || isNaN(num)) return '—'
  return Number(num).toFixed(decimals) + '%'
}

/**
 * Format a duration in seconds to human readable
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "2m 30s", "1h 15m")
 */
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/**
 * CSS style for tabular (monospaced) number display.
 * Apply to elements showing numeric data in columns for alignment.
 */
export const tabularNumStyle = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
}

/**
 * CSS style for monospaced data display (ports, IDs, hashes).
 * Uses Fira Code if available, falls back to system monospace.
 */
export const monoStyle = {
  fontFamily: '"Fira Code", "Roboto Mono", "Courier New", monospace',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.8125rem',
}
