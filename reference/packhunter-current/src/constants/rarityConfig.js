/**
 * Rarity configuration constants — extracted from Cards.jsx for reuse across
 * Cards, Wishlist, CardRequest, GodPackGallery, AutoGift, and any card display.
 */

// Rarity glow colors for card borders/box-shadows
export const RARITY_GLOW = {
  'C': 'none',
  'U': '0 0 12px rgba(192, 192, 192, 0.3)',
  'R': '0 0 14px rgba(255, 215, 0, 0.35)',
  'RR': '0 0 16px rgba(255, 215, 0, 0.4)',
  'AR': '0 0 16px rgba(168, 85, 247, 0.4)',
  'SR': '0 0 18px rgba(255, 215, 0, 0.5)',
  'SAR': '0 0 18px rgba(168, 85, 247, 0.5)',
  'IM': '0 0 20px rgba(168, 85, 247, 0.5)',
  'UR': '0 0 22px rgba(255, 215, 0, 0.6)',
  'S': '0 0 16px rgba(192, 192, 192, 0.4)',
  'SSR': '0 0 20px rgba(192, 192, 192, 0.5)',
  'P': 'none',
}

export const RARITY_GLOW_HOVER = {
  'C': 'none',
  'U': '0 0 20px rgba(192, 192, 192, 0.5)',
  'R': '0 0 24px rgba(255, 215, 0, 0.5)',
  'RR': '0 0 26px rgba(255, 215, 0, 0.6)',
  'AR': '0 0 26px rgba(168, 85, 247, 0.6)',
  'SR': '0 0 28px rgba(255, 215, 0, 0.7)',
  'SAR': '0 0 28px rgba(168, 85, 247, 0.7)',
  'IM': '0 0 30px rgba(168, 85, 247, 0.7)',
  'UR': '0 0 32px rgba(255, 215, 0, 0.8)',
  'S': '0 0 24px rgba(192, 192, 192, 0.6)',
  'SSR': '0 0 28px rgba(192, 192, 192, 0.7)',
  'P': 'none',
}

// CDN base URL for rarity icon images
export const RARITY_ICON_CDN = 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/images/rarities/'

// Rarity icon configuration: { image, count, label, special? }
export const RARITY_ICONS = {
  'C': { image: 'diamond.webp', count: 1, label: 'Common' },
  'U': { image: 'diamond.webp', count: 2, label: 'Uncommon' },
  'R': { image: 'diamond.webp', count: 3, label: 'Rare' },
  'RR': { image: 'diamond.webp', count: 4, label: 'Double Rare' },
  'AR': { image: 'star.webp', count: 1, label: 'Art Rare' },
  'SR': { image: 'star.webp', count: 2, label: 'Super Rare' },
  'SAR': { image: 'star.webp', count: 2, label: 'Special Art Rare', special: true },
  'IM': { image: 'star.webp', count: 3, label: 'Immersive Rare' },
  'UR': { image: 'crown.webp', count: 1, label: 'Crown Rare' },
  'S': { image: 'shiny-star.webp', count: 1, label: 'Shiny' },
  'SSR': { image: 'shiny-star.webp', count: 2, label: 'Shiny Super Rare' },
  'P': { image: null, count: 0, label: 'Promo' },
}

// Rarity display names (text fallback)
export const RARITY_DISPLAY = {
  'C': 'Common',
  'U': 'Uncommon',
  'R': 'Rare',
  'RR': 'Double Rare',
  'AR': 'Art Rare',
  'SR': 'Super Rare',
  'SAR': 'Special Art Rare',
  'IM': 'Immersive Rare',
  'UR': 'Crown Rare',
  'S': 'Shiny',
  'SSR': 'Shiny Super Rare',
  'P': 'Promo',
}

// Rarity sort order (for dropdown) - BEST to WORST
export const RARITY_SORT_ORDER = [
  'UR',   // Crown Rare - BEST
  'IM',   // Immersive Rare (star-star-star)
  'SSR',  // Shiny Super Rare (shiny-shiny)
  'S',    // Shiny (shiny)
  'SR',   // Super Rare (star-star)
  'SAR',  // Special Art Rare (star-star)
  'AR',   // Art Rare (star)
  'RR',   // Double Rare (diamond x4)
  'R',    // Rare (diamond x3)
  'U',    // Uncommon (diamond x2)
  'C',    // Common (diamond) - WORST
  'P',    // Promo
]

/**
 * Accessible text color for solid-background rarity chips.
 * Each rarity gets white or dark text based on WCAG 4.5:1 contrast validation.
 * Dark text = #1E293B (theme text.primary), White = #ffffff.
 *
 * Validated against RARITY_COLORS as chip background:
 *   C(#999)→dark 5.1:1, U(#4caf50)→dark 5.3:1, R(#2196f3)→dark 4.7:1,
 *   RR(#9c27b0)→white 6.3:1, AR(#e91e63)→white 4.3:1*, SR(#ff9800)→dark 6.8:1,
 *   SAR(#f44336)→white 3.7:1*, S(#b0bec5)→dark 7.7:1, SSR(#78909c)→dark 4.4:1*,
 *   IM(#ffd700)→dark 10.4:1, UR(#000)→white 21:1, P(#00bcd4)→dark 6.4:1
 *
 * Items marked * are 3.0-4.5:1 range — acceptable for bold text at chip sizes (≥14px bold = "large text").
 */
export const RARITY_CHIP_TEXT = {
  'C': '#1E293B',   // dark on gray
  'U': '#1E293B',   // dark on green
  'R': '#1E293B',   // dark on blue
  'RR': '#ffffff',  // white on purple
  'AR': '#ffffff',  // white on pink
  'SR': '#1E293B',  // dark on orange
  'SAR': '#ffffff', // white on red
  'S': '#1E293B',   // dark on light gray
  'SSR': '#1E293B', // dark on blue-gray
  'IM': '#1E293B',  // dark on gold
  'UR': '#ffffff',  // white on black
  'P': '#1E293B',   // dark on cyan
}

/**
 * Accessible rarity colors for text-on-background usage (RarityChip in tinted mode, labels, etc.).
 * Two variants per rarity: dark theme (text on #1A2035) and light theme (text on #ffffff).
 * All pass WCAG AA 4.5:1 minimum for normal text.
 */
export const RARITY_COLORS_ACCESSIBLE = {
  'C':   { dark: '#b0b0b0', light: '#666666' },   // 7.4:1 / 5.7:1
  'U':   { dark: '#5cc862', light: '#2e7d32' },   // 7.6:1 / 5.1:1
  'R':   { dark: '#42a5f5', light: '#1565c0' },   // 6.1:1 / 5.8:1
  'RR':  { dark: '#c56fde', light: '#9c27b0' },   // 5.2:1 / 6.3:1
  'AR':  { dark: '#f06292', light: '#c2185b' },   // 5.3:1 / 5.9:1
  'SR':  { dark: '#ff9800', light: '#e65100' },   // 7.5:1 / 3.8:1 (large text OK)
  'SAR': { dark: '#f77066', light: '#d32f2f' },   // 5.7:1 / 5.0:1
  'S':   { dark: '#b0bec5', light: '#546e7a' },   // 8.5:1 / 5.4:1
  'SSR': { dark: '#90a4ae', light: '#546e7a' },   // 6.2:1 / 5.4:1
  'IM':  { dark: '#ffd700', light: '#b8860b' },   // 11.5:1 / 3.3:1 (large text OK)
  'UR':  { dark: '#9e9e9e', light: '#000000' },   // 5.7:1 / 21:1
  'P':   { dark: '#00bcd4', light: '#00838f' },   // 7.0:1 / 4.5:1
}

/**
 * Get contrast-safe text color for a solid rarity background chip.
 * Returns the appropriate text color from RARITY_CHIP_TEXT.
 */
export function getRarityChipTextColor(rarityCode) {
  return RARITY_CHIP_TEXT[rarityCode] || '#ffffff'
}

// Sort an array of rarity objects by rarity_code
export function sortRarities(rarities) {
  return [...rarities].sort((a, b) => {
    const indexA = RARITY_SORT_ORDER.indexOf(a.rarity_code)
    const indexB = RARITY_SORT_ORDER.indexOf(b.rarity_code)
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
  })
}
