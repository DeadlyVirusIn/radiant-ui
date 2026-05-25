/**
 * Phase 5.10 (Apr 2026) — ESM mirror of lib/valueTier.js.
 *
 * MUST stay byte-aligned (modulo CJS↔ESM syntax) to lib/valueTier.js.
 * The Phase 5.10 contract test asserts both files share the same
 * tier ladder, label phrases, and TIER_PALETTE map so a Dashboard
 * chip never disagrees with the Discord embed about pack value.
 *
 * See lib/valueTier.js for the full doc-block, scope rules, and
 * priority ladder.
 */

function getCardStarCount(card) {
  if (!card) return 0
  const rarityCode = card.rarity_code || card.rarity
  if (rarityCode && typeof rarityCode === 'string') {
    const code = rarityCode.toUpperCase()
    if (['C', 'U', 'R', 'RR', 'AR'].includes(code)) return 1
    if (['SR', 'SAR'].includes(code))                return 2
    if (['IM', 'UR', 'SSR', 'S'].includes(code))     return 3
  }
  if (card.stars >= 1)       return card.stars
  if (card.star_rating >= 1) return card.star_rating
  return 1
}

export function phraseDuplicate(name, count) {
  if (count === 2) return `Double ${name}`
  if (count === 3) return `Triple ${name}`
  return `${count}× ${name} (duplicate)`
}

export function computeValueTier(cards) {
  const fallback = { tier: 'normal', label: 'Strong Pull', signal: 'Strong Pull' }
  if (!Array.isArray(cards) || cards.length === 0) return fallback

  const total      = cards.length
  const starsPer   = cards.map(getCardStarCount)
  const highTierIx = starsPer.map((s, i) => (s >= 2 ? i : -1)).filter(i => i >= 0)
  const highCount  = highTierIx.length

  if (total >= 5 && highCount === total) {
    const label = `${total}/${total} High-Tier Pack`
    return { tier: 'ultra', label, signal: label }
  }
  if (total >= 5 && highCount >= 4) {
    const label = `${highCount}/${total} High-Tier Pack`
    return { tier: 'ultra', label, signal: label }
  }

  const nameCounts = new Map()
  for (const i of highTierIx) {
    const c = cards[i]
    const n = (c.name || c.card_name || '').trim()
    if (!n) continue
    nameCounts.set(n, (nameCounts.get(n) || 0) + 1)
  }
  const dupEntries = [...nameCounts.entries()].filter(([, n]) => n >= 2)
  if (dupEntries.length > 0) {
    dupEntries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const [name, count] = dupEntries[0]
    const label = phraseDuplicate(name, count)
    return { tier: 'high', label, signal: label }
  }

  if (highCount >= 3) {
    const label = `${highCount}× ★★ Hits`
    return { tier: 'high', label, signal: label }
  }
  if (highCount === 2) return { tier: 'strong', label: '2× ★★ Hits', signal: '2× ★★ Hits' }
  if (highCount === 1) return { tier: 'strong', label: '★★ Hit',      signal: '★★ Hit'      }

  return fallback
}

export const TIER_PALETTE = Object.freeze({
  ultra:  'warning',
  high:   'secondary',
  strong: 'info',
  normal: 'default',
})

export function tierPalette(tier) {
  return TIER_PALETTE[tier] || TIER_PALETTE.normal
}

export const TIER_DISPLAY = Object.freeze({
  ultra:  'Ultra',
  high:   'High',
  strong: 'Strong',
  normal: 'Normal',
})

export function tierDisplay(tier) {
  return TIER_DISPLAY[tier] || TIER_DISPLAY.normal
}
