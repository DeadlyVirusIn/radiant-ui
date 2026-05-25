/**
 * GP Helpers — single source of truth for deriving friend row badges from GP data.
 *
 * RULE: All badges for a friend row come from ONE canonical GP entry.
 * Selection: highest-priority ALIVE GP → newest ALIVE → newest non-ALIVE.
 * Once selected, quality, packSize, and status ALL come from that entry.
 */

/**
 * Select the canonical GP entry for badge display.
 * Priority: ALIVE with highest quality → newest ALIVE → newest non-ALIVE.
 *
 * @param {Array} packs — array of GP objects for one player
 * @returns {Object|null} — the canonical GP entry, or null if empty
 */
export function selectCanonicalGP(packs) {
  if (!packs || packs.length === 0) return null
  if (packs.length === 1) return packs[0]

  // Separate ALIVE from non-ALIVE
  const alive = packs.filter(gp => gp.status === 'ALIVE')
  const other = packs.filter(gp => gp.status !== 'ALIVE')

  if (alive.length > 0) {
    // Among ALIVE: highest quality first, then newest
    alive.sort((a, b) => {
      const qa = a.cardCount || 0
      const qb = b.cardCount || 0
      if (qa !== qb) return qb - qa
      return new Date(b.discoveredAt || 0) - new Date(a.discoveredAt || 0)
    })
    return alive[0]
  }

  // No ALIVE: return newest
  other.sort((a, b) => new Date(b.discoveredAt || 0) - new Date(a.discoveredAt || 0))
  return other[0]
}

/**
 * Derive display badges from a canonical GP entry.
 * If data is uncertain, returns null for that field (hide badge).
 *
 * @param {Object} gp — canonical GP entry
 * @returns {{ quality: number|null, packSize: number|null, status: string, isLive: boolean }}
 */
export function deriveBadges(gp) {
  if (!gp) return { quality: null, packNumber: null, status: 'UNKNOWN', isLive: false }

  const quality = (gp.cardCount != null && gp.cardCount > 0) ? gp.cardCount : null

  // Pack number: which pack in the session this GP was found in (1st, 2nd, etc.)
  // This comes from godPackData.packNumber in the hunt flow.
  // NOT "pack size" — all GPs are single packs (5 cards).
  // The Discord thread title shows e.g. "2P" meaning "2nd pack opened".
  const packNumber = gp.packNumber || null

  return {
    quality,
    packNumber,
    status: gp.status || 'PENDING',
    isLive: gp.status === 'ALIVE',
    discoveredAt: gp.discoveredAt,
    godPackId: gp.godPackId,
  }
}

/**
 * Get sort key for a friend with GP data.
 * Uses canonical GP, not aggregated.
 */
export function getGPSortKey(packs) {
  const canonical = selectCanonicalGP(packs)
  if (!canonical) return { category: 3, quality: 0, recency: 0 }
  const badges = deriveBadges(canonical)
  return {
    category: badges.isLive ? 0 : 1,
    quality: badges.quality || 0,
    recency: new Date(badges.discoveredAt || 0).getTime(),
  }
}
