/**
 * useLocalizedCards Hook
 *
 * Custom React hook for fetching and displaying card names in the user's
 * selected language. Uses TCGdex API for translations with caching.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { batchTranslateCards, getCardTranslation, clearCache } from '../services/tcgdexApi'

/**
 * Hook to get localized card data for a list of cards
 *
 * @param {Array} cards - Array of card objects from the backend
 * @param {Object} options - Hook options
 * @param {boolean} options.enabled - Whether to fetch translations (default: true)
 * @param {boolean} options.translateOnLoad - Translate immediately on load (default: true)
 * @returns {Object} - { localizedCards, isTranslating, error, refreshTranslations }
 */
export function useLocalizedCards(cards, options = {}) {
  const { enabled = true, translateOnLoad = true } = options
  const { language } = useLanguage()

  const [localizedCards, setLocalizedCards] = useState([])
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState(null)

  // Track previous language to detect changes
  const prevLanguageRef = useRef(language)
  const prevCardsRef = useRef(cards)

  // Translate cards when language or cards change
  const translateCards = useCallback(async () => {
    if (!enabled || !cards || cards.length === 0) {
      setLocalizedCards(cards || [])
      return
    }

    // For English, just use original names
    if (language === 'en') {
      setLocalizedCards(
        cards.map((card) => ({
          ...card,
          localizedName: card.card_name,
          translationStatus: 'default',
        }))
      )
      return
    }

    setIsTranslating(true)
    setError(null)

    try {
      const translated = await batchTranslateCards(cards, language)
      setLocalizedCards(translated)
    } catch (err) {
      console.error('Translation error:', err)
      setError(err.message)
      // Fallback to original names
      setLocalizedCards(
        cards.map((card) => ({
          ...card,
          localizedName: card.card_name,
          translationStatus: 'error',
        }))
      )
    } finally {
      setIsTranslating(false)
    }
  }, [cards, language, enabled])

  // Effect to translate when language changes or cards update
  useEffect(() => {
    const languageChanged = prevLanguageRef.current !== language
    const cardsChanged = prevCardsRef.current !== cards

    prevLanguageRef.current = language
    prevCardsRef.current = cards

    if (translateOnLoad && (languageChanged || cardsChanged)) {
      translateCards()
    }
  }, [language, cards, translateOnLoad, translateCards])

  // Manual refresh function
  const refreshTranslations = useCallback(() => {
    translateCards()
  }, [translateCards])

  return {
    localizedCards,
    isTranslating,
    error,
    refreshTranslations,
  }
}

/**
 * Hook to get localized name for a single card
 *
 * @param {Object} card - Card object with card_name
 * @param {Object} options - Hook options
 * @returns {Object} - { localizedName, isLoading, error }
 */
export function useLocalizedCardName(card, options = {}) {
  const { enabled = true } = options
  const { language } = useLanguage()

  const [localizedName, setLocalizedName] = useState(card?.card_name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!enabled || !card?.card_name) {
      setLocalizedName(card?.card_name || '')
      return
    }

    // For English, use original name
    if (language === 'en') {
      setLocalizedName(card.card_name)
      return
    }

    const fetchTranslation = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const translation = await getCardTranslation(
          card.backend_id,
          card.card_name,
          language
        )
        setLocalizedName(translation.localizedName)
      } catch (err) {
        console.error('Translation error:', err)
        setError(err.message)
        setLocalizedName(card.card_name) // Fallback
      } finally {
        setIsLoading(false)
      }
    }

    fetchTranslation()
  }, [card, language, enabled])

  return {
    localizedName,
    isLoading,
    error,
  }
}

/**
 * Hook to clear translation cache
 *
 * @returns {Function} - Function to clear the cache
 */
export function useClearTranslationCache() {
  return useCallback(() => {
    clearCache()
  }, [])
}

/**
 * Get display name for a card - returns localized name if available
 * Supports both snake_case (card_name) and camelCase (cardName) formats
 *
 * @param {Object} card - Card object (may have localizedName property)
 * @returns {string} - Display name (localized if available, otherwise original)
 */
export function getCardDisplayName(card) {
  if (!card) return ''
  return card.localizedName || card.card_name || card.cardName || ''
}

export default {
  useLocalizedCards,
  useLocalizedCardName,
  useClearTranslationCache,
  getCardDisplayName,
}
