/**
 * TCGdex API Service - Multi-language TCG Pocket card data
 * API: https://api.tcgdex.net/v2/{lang}/cards/{cardId}
 *
 * Supported languages by TCGdex:
 * - en: English
 * - fr: French
 * - es: Spanish
 * - it: Italian
 * - pt: Portuguese
 * - de: German
 * - ja: Japanese
 * - ko: Korean
 * - zh-tw: Traditional Chinese
 * - zh-cn: Simplified Chinese
 * - id: Indonesian
 * - th: Thai
 */

// Use backend proxy to avoid CSP issues (browser can't call api.tcgdex.net directly)
const TCGDEX_BASE = '/api/tcgdex'

// Map our language codes to TCGdex language codes
const LANGUAGE_MAP = {
  'en': 'en',
  'ja': 'ja',
  'fr': 'fr',
  'it': 'it',
  'de': 'de',
  'es': 'es',
  'pt': 'pt',
  'zh': 'zh-tw',  // Use Traditional Chinese for zh
  'ko': 'ko',
}

// In-memory cache for translations (reduces API calls)
const translationCache = new Map()
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

/**
 * Get TCGdex language code from our app language code
 */
function getTcgdexLang(appLang) {
  return LANGUAGE_MAP[appLang] || 'en'
}

/**
 * Generate cache key for a card translation
 */
function getCacheKey(cardId, lang) {
  return `${lang}:${cardId}`
}

/**
 * Check if cached item is still valid
 */
function isCacheValid(cacheEntry) {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION
}

/**
 * Convert TCGP card ID to TCGdex format
 * TCGP uses format like: A1_001, A1A_023, etc.
 * TCGdex uses format like: swsh1-1, base1-4, etc.
 *
 * For TCGP Pocket cards, TCGdex may use different IDs
 * This function attempts to find the closest match
 */
function convertCardIdToTcgdex(ptcgpCardId, setCode) {
  // For TCGP, card IDs are typically like "A1_001"
  // We'll need to map these to TCGdex format
  // TCGdex has a different ID system, so we'll search by name instead
  return ptcgpCardId
}

/**
 * Fetch a single card's translation from TCGdex
 */
export async function getCardTranslation(cardId, cardName, language = 'en') {
  const tcgdexLang = getTcgdexLang(language)
  const cacheKey = getCacheKey(cardId, tcgdexLang)

  // Check cache first
  const cached = translationCache.get(cacheKey)
  if (isCacheValid(cached)) {
    return cached.data
  }

  try {
    // Search for card by name in the specified language
    const searchResponse = await fetch(
      `${TCGDEX_BASE}/${tcgdexLang}/cards?name=${encodeURIComponent(cardName)}`
    )

    if (!searchResponse.ok) {
      throw new Error(`TCGdex API error: ${searchResponse.status}`)
    }

    const results = await searchResponse.json()

    if (results && results.length > 0) {
      // Get the first matching card's full details
      const cardData = results[0]

      const translation = {
        localizedName: cardData.name || cardName,
        localizedDescription: cardData.description || null,
        localizedCategory: cardData.category || null,
        illustrator: cardData.illustrator || null,
        tcgdexId: cardData.id,
        found: true,
      }

      // Cache the result
      translationCache.set(cacheKey, {
        data: translation,
        timestamp: Date.now(),
      })

      return translation
    }

    // If not found, return original name
    return {
      localizedName: cardName,
      localizedDescription: null,
      found: false,
    }
  } catch (error) {
    console.warn(`Failed to fetch translation for ${cardName}:`, error.message)
    return {
      localizedName: cardName,
      localizedDescription: null,
      found: false,
      error: error.message,
    }
  }
}

/**
 * Fetch all cards from TCGdex for a specific set
 */
export async function getSetCards(setId, language = 'en') {
  const tcgdexLang = getTcgdexLang(language)

  try {
    const response = await fetch(`${TCGDEX_BASE}/${tcgdexLang}/sets/${setId}`)

    if (!response.ok) {
      throw new Error(`TCGdex API error: ${response.status}`)
    }

    const setData = await response.json()
    return setData.cards || []
  } catch (error) {
    console.error(`Failed to fetch set cards for ${setId}:`, error)
    return []
  }
}

/**
 * Get all available sets from TCGdex
 */
export async function getSets(language = 'en') {
  const tcgdexLang = getTcgdexLang(language)

  try {
    const response = await fetch(`${TCGDEX_BASE}/${tcgdexLang}/sets`)

    if (!response.ok) {
      throw new Error(`TCGdex API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch TCGdex sets:', error)
    return []
  }
}

/**
 * Search cards by name across all sets
 */
export async function searchCards(query, language = 'en') {
  const tcgdexLang = getTcgdexLang(language)

  try {
    const response = await fetch(
      `${TCGDEX_BASE}/${tcgdexLang}/cards?name=${encodeURIComponent(query)}`
    )

    if (!response.ok) {
      throw new Error(`TCGdex API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to search cards:', error)
    return []
  }
}

/**
 * Batch translate multiple cards (for lists)
 * More efficient than individual calls
 */
export async function batchTranslateCards(cards, language = 'en') {
  if (language === 'en') {
    // English is the default, no translation needed
    return cards.map(card => ({
      ...card,
      localizedName: card.card_name,
      translationStatus: 'default',
    }))
  }

  const tcgdexLang = getTcgdexLang(language)
  const results = []

  // Process in parallel but with concurrency limit
  const BATCH_SIZE = 10

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE)

    const batchResults = await Promise.all(
      batch.map(async (card) => {
        const cacheKey = getCacheKey(card.backend_id, tcgdexLang)
        const cached = translationCache.get(cacheKey)

        if (isCacheValid(cached)) {
          return {
            ...card,
            localizedName: cached.data.localizedName,
            localizedDescription: cached.data.localizedDescription,
            translationStatus: cached.data.found ? 'translated' : 'not_found',
          }
        }

        // For non-cached cards, search by name
        try {
          const translation = await getCardTranslation(
            card.backend_id,
            card.card_name,
            language
          )

          return {
            ...card,
            localizedName: translation.localizedName,
            localizedDescription: translation.localizedDescription,
            translationStatus: translation.found ? 'translated' : 'not_found',
          }
        } catch (error) {
          return {
            ...card,
            localizedName: card.card_name,
            translationStatus: 'error',
          }
        }
      })
    )

    results.push(...batchResults)
  }

  return results
}

/**
 * Get card name translations
 * Uses TCGdex's card endpoint
 */
export async function getPokemonName(pokemonName, language = 'en') {
  const tcgdexLang = getTcgdexLang(language)
  const cacheKey = `pokemon:${tcgdexLang}:${pokemonName.toLowerCase()}`

  const cached = translationCache.get(cacheKey)
  if (isCacheValid(cached)) {
    return cached.data
  }

  try {
    // Search for the card in TCGdex
    const response = await fetch(
      `${TCGDEX_BASE}/${tcgdexLang}/cards?name=${encodeURIComponent(pokemonName)}`
    )

    if (!response.ok) {
      return pokemonName
    }

    const results = await response.json()
    if (results && results.length > 0) {
      const translatedName = results[0].name

      translationCache.set(cacheKey, {
        data: translatedName,
        timestamp: Date.now(),
      })

      return translatedName
    }

    return pokemonName
  } catch (error) {
    return pokemonName
  }
}

/**
 * Clear the translation cache
 */
export function clearCache() {
  translationCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  let validEntries = 0
  let expiredEntries = 0

  translationCache.forEach((value) => {
    if (isCacheValid(value)) {
      validEntries++
    } else {
      expiredEntries++
    }
  })

  return {
    totalEntries: translationCache.size,
    validEntries,
    expiredEntries,
    cacheDurationMinutes: CACHE_DURATION / 60000,
  }
}

export default {
  getCardTranslation,
  getSetCards,
  getSets,
  searchCards,
  batchTranslateCards,
  getPokemonName,
  clearCache,
  getCacheStats,
}
