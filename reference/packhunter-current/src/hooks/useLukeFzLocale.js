/**
 * useLukeFzLocale — additive client-side hook that decorates a cards array with
 * `lukefzLocalizedName` from the LukeFZ-backed /api/locale/dict endpoint.
 *
 * Read-only. Display-only. Default behavior preserved when locale === 'en' /
 * unset (returns the input array unchanged with optional `lukefzLocalizedName`
 * mirroring `card_name`).
 *
 * Fallback chain (matches backend service):
 *   requested locale → en_US → raw cardId
 *
 * Used as a TAIL FALLBACK to the existing TCGdex-backed `useLocalizedCards`
 * hook. Components decide priority: `card.localizedName || card.lukefzLocalizedName || card.card_name`.
 */

import { useState, useEffect } from 'react'

const LOCALE_ALIAS = {
  en: 'en_US', 'en-us': 'en_US',
  ja: 'ja_JP', 'ja-jp': 'ja_JP', jp: 'ja_JP',
  de: 'de_DE', 'de-de': 'de_DE',
  fr: 'fr_FR', 'fr-fr': 'fr_FR',
  es: 'es_ES', 'es-es': 'es_ES',
  it: 'it_IT', 'it-it': 'it_IT',
  ko: 'ko_KR', 'ko-kr': 'ko_KR', kr: 'ko_KR',
  pt: 'pt_BR', 'pt-br': 'pt_BR',
  zh: 'zh_TW', 'zh-tw': 'zh_TW', tw: 'zh_TW',
}

function normalizeLocale(loc) {
  if (typeof loc !== 'string' || !loc) return 'en_US'
  const lc = loc.trim().toLowerCase()
  return LOCALE_ALIAS[lc] || LOCALE_ALIAS[lc.split(/[-_]/)[0]] || 'en_US'
}

// Module-level dict cache: { 'ja_JP': { cards: {...}, packs: {...} } }
const _cache = new Map()
const _inflight = new Map()

async function fetchDict(locale) {
  const canonical = normalizeLocale(locale)
  if (_cache.has(canonical)) return _cache.get(canonical)
  if (_inflight.has(canonical)) return _inflight.get(canonical)

  const p = fetch(`/api/locale/dict?locale=${encodeURIComponent(canonical)}`)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (d && d.cards) _cache.set(canonical, d)
      _inflight.delete(canonical)
      return _cache.get(canonical) || null
    })
    .catch(() => {
      _inflight.delete(canonical)
      return null
    })
  _inflight.set(canonical, p)
  return p
}

/**
 * Decorate a cards array with `lukefzLocalizedName`.
 * Default behavior (no locale or locale === 'en') = pass-through, no decoration.
 *
 * @param {Array} cards - card objects with `image` field (PK_10_xxx_xx embedded) and `card_name`
 * @param {string} locale - browser locale; falls back to 'en' if absent
 */
export function useLukeFzLocale(cards, locale) {
  const [decorated, setDecorated] = useState(cards || [])

  useEffect(() => {
    if (!cards || cards.length === 0) {
      setDecorated([])
      return
    }
    const canonical = normalizeLocale(locale)
    // Default behavior: omit decoration when locale unset or English — keeps
    // existing behavior identical.
    if (canonical === 'en_US') {
      setDecorated(cards)
      return
    }
    let cancelled = false
    fetchDict(canonical).then(dict => {
      if (cancelled) return
      if (!dict || !dict.cards) {
        setDecorated(cards)
        return
      }
      setDecorated(
        cards.map(c => {
          // Extract PK_id from image filename: cPK_10_xxxxxx_xx_..._RARITY.webp
          const m = typeof c.image === 'string' ? c.image.match(/^c?(PK_\d+_\d+_\d+)_/) : null
          const pkId = m ? m[1] : c.backend_id || c.card_id || null
          const lookup = pkId ? dict.cards[pkId] : null
          return { ...c, lukefzLocalizedName: lookup || c.card_name }
        })
      )
    })
    return () => {
      cancelled = true
    }
  }, [cards, locale])

  return decorated
}

/**
 * Fetch a single card's localized name (component-level convenience helper).
 * Returns the raw cardId if missing — never throws.
 */
export async function fetchLukeFzCardName(cardId, locale) {
  if (!cardId) return ''
  const canonical = normalizeLocale(locale)
  if (canonical === 'en_US') return cardId
  const dict = await fetchDict(canonical)
  if (!dict || !dict.cards) return cardId
  return dict.cards[cardId] || cardId
}

export default useLukeFzLocale
