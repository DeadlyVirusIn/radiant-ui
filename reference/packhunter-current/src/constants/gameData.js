/**
 * Shared game data constants used across multiple pages.
 * Single source of truth - import from here instead of defining locally.
 */

// Rarity color mapping
export const RARITY_COLORS = {
  'C': '#999999',
  'U': '#4caf50',
  'R': '#2196f3',
  'RR': '#9c27b0',
  'AR': '#e91e63',
  'SR': '#ff9800',
  'SAR': '#f44336',
  'S': '#b0bec5',
  'SSR': '#78909c',
  'IM': '#ffd700',
  'UR': '#000000',
  'P': '#00bcd4',
}

// Rarity display names
export const RARITY_NAMES = {
  'C': 'Common',
  'U': 'Uncommon',
  'R': 'Rare',
  'RR': 'Double Rare',
  'AR': 'Art Rare',
  'SR': 'Super Rare',
  'SAR': 'Special Art Rare',
  'S': 'Shiny',
  'SSR': 'Shiny Super Rare',
  'IM': 'Immersive Rare',
  'UR': 'Crown Rare',
  'P': 'Promo',
}

// Card type colors
export const TYPE_COLORS = {
  'Colorless': '#A8A77A',
  'Grass': '#7AC74C',
  'Fire': '#EE8130',
  'Water': '#6390F0',
  'Lightning': '#F7D02C',
  'Psychic': '#F95587',
  'Fighting': '#C22E28',
  'Darkness': '#705746',
  'Metal': '#B7B7CE',
  'Dragon': '#6F35FC',
}

// Set code to display name mapping
export const SET_NAMES = {
  'A1': 'Genetic Apex',
  'A1A': 'Mythical Island',
  'A2': 'Space-Time Smackdown',
  'A2A': 'Triumphant Light',
  'A2B': 'Shining Revelry',
  'A3': 'Celestial Guardians',
  'A3A': 'Extradimensional Crisis',
  'A3B': 'Eevee Grove',
  'A4': 'Wisdom of Sea and Sky',
  'A4A': 'Secluded Springs',
  'A4B': 'Deluxe Pack ex',
  'B1': 'Mega Rising',
  'B1A': 'Crimson Blaze',
  'B2': 'Fantastical Parade',
  'B2A': 'Paldean Wonders',
  'B2B': 'Mega Shine',
  // Phase 40 — B3 Launch Readiness (Apr 27 2026). Display name only;
  // card data / missions import at launch. See docs/LAUNCH_RUNBOOK_B3.md.
  'B3': 'Pulsing Aura',
  'PROMO-A': 'PROMO-A',
  'PROMO-B': 'PROMO-B',
}

// Pack badge colors (by set code)
export const PACK_COLORS = {
  // Phase 40 — B3 Pulsing Aura. Gold-frame / aura-themed amber.
  'B3': '#FFB300',
  'B2B': '#7C4DFF',
  'B2A': '#4CAF50',
  'B2': '#E91E63',
  'B1A': '#FF5722',
  'B1': '#FF6B6B',
  'A4B': '#9C27B0',
  'A4A': '#00BCD4',
  'A4': '#2196F3',
  'A3B': '#8BC34A',
  'A3A': '#FF5722',
  'A3': '#3F51B5',
  'A2B': '#E91E63',
  'A2A': '#FFC107',
  'A2': '#673AB7',
  'A1A': '#009688',
  'A1': '#F44336',
  'PROMO-A': '#607D8B',
  'PROMO-B': '#795548',
}

// Backend pack ID to display name mapping
export const PACK_DISPLAY_NAMES = {
  'AN001_0010_00_000': 'A1 Mewtwo',
  'AN001_0020_00_000': 'A1 Charizard',
  'AN001_0030_00_000': 'A1 Pikachu',
  'AN002_0010_00_000': 'A1a Mythical Island',
  'AN003_0010_00_000': 'A2 Dialga',
  'AN003_0020_00_000': 'A2 Palkia',
  'AN004_0010_00_000': 'A2a Triumphant Light',
  'AN005_0010_00_000': 'A2b Shining Revelry',
  'AN006_0010_00_000': 'A3 Solgaleo',
  'AN006_0020_00_000': 'A3 Lunala',
  'AN007_0010_00_000': 'A3a Extradimensional Crisis',
  'AN008_0010_00_000': 'A3b Eevee Grove',
  'AN009_0010_00_000': 'A4 Ho-Oh',
  'AN009_0020_00_000': 'A4 Lugia',
  'AN010_0010_00_000': 'A4a Secluded Springs',
  'AN011_0010_00_000': 'A4b Deluxe',
  'BN001_0010_00_000': 'B1 Blaziken',
  'BN001_0020_00_000': 'B1 Gyarados',
  'BN001_0030_00_000': 'B1 Altaria',
  'BN002_0010_00_000': 'B1a Crimson Blaze',
  'BN003_0010_00_000': 'B2 Gardevoir',
  'BW003_0010_00_000': 'B2 Gardevoir',
  'BW003_00Y0_00_000': 'B2 Gardevoir',
  'BN004_0010_00_000': 'B2a Paldean Wonders',
  'BN005_0010_00_000': 'B2b Mega Shine',
}

// Helper to get pack display name from pack name/id
export const getPackDisplayName = (packName, packId) => {
  if (packId && PACK_DISPLAY_NAMES[packId]) return PACK_DISPLAY_NAMES[packId]
  if (packName && PACK_DISPLAY_NAMES[packName]) return PACK_DISPLAY_NAMES[packName]
  if (packName && packName !== packId && !packName.startsWith('AN') && !packName.startsWith('BN') && !packName.startsWith('BW')) {
    return packName
  }
  if (packId) {
    const match = packId.match(/^([A-Z0-9]+)/i)
    if (match) return SET_NAMES[match[1]] || packId
  }
  return packName || packId || 'Unknown Pack'
}

// Helper to get set display name
export const getSetDisplayName = (set) => {
  if (set.set_name && set.set_name !== set.set_code) return set.set_name
  return SET_NAMES[set.set_code] || set.set_code
}
