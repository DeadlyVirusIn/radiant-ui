/**
 * Pack expansion grouping utilities — extracted from HuntSettings.jsx and BotHub.jsx.
 * Used anywhere that needs to group/sort packs by expansion (e.g. B2b, B1a, A4, A3b, etc.)
 */

/**
 * Parse an expansion code into structured parts.
 * e.g. "B1a" -> { series: 'B', major: 1, sub: 'a' }
 *      "A4"  -> { series: 'A', major: 4, sub: '' }
 */
export function parseExpansion(exp) {
  const match = exp.match(/^([A-Z])(\d+)([a-z]?)$/i)
  if (!match) return { series: 'Z', major: 0, sub: '' }
  return { series: match[1].toUpperCase(), major: parseInt(match[2]), sub: match[3] || '' }
}

/**
 * Compare two expansion codes for sorting (newest first).
 * B series before A series, higher major number first, sub-letters (b > a > none).
 */
export function compareExpansions(a, b) {
  const pa = parseExpansion(a)
  const pb = parseExpansion(b)
  if (pa.series !== pb.series) return pb.series.localeCompare(pa.series)
  if (pa.major !== pb.major) return pb.major - pa.major
  if (pa.sub && !pb.sub) return -1
  if (!pa.sub && pb.sub) return 1
  return pb.sub.localeCompare(pa.sub)
}

/**
 * Group an array of pack objects by their expansion, sorted newest-first.
 * Returns array of { expansion, packs } objects.
 */
export function groupPacksByExpansion(packs) {
  const groups = {}
  for (const pack of packs) {
    const exp = pack.expansion || 'Other'
    if (!groups[exp]) groups[exp] = []
    groups[exp].push(pack)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => compareExpansions(a, b))
    .map(([expansion, items]) => ({ expansion, packs: items }))
}
