/**
 * Phase 5.15 (Apr 27 2026) — ESM mirror of lib/b3Constants.js.
 *
 * MUST stay byte-aligned (modulo CJS↔ESM syntax) to lib/b3Constants.js.
 * Phase 5.15 contract test asserts both expose the same SET_CODE,
 * DISPLAY_NAME, candidate IDs, and VERIFIED flag so a Dashboard chip
 * never disagrees with the Discord embed about B3 readiness.
 *
 * See lib/b3Constants.js for the full doc-block + verification
 * contract.
 */

export const SET_CODE          = 'B3'
export const DISPLAY_NAME      = 'Pulsing Aura'
export const PACK_NAME_KEY     = 'PULSING_AURA'
export const COLOR             = '#FFB300'
export const COVER_PACKS       = ['Mega Lucario', 'Mega Sceptile']
export const LAUNCH_TARGET_UTC = '2026-04-28T01:00:00Z'
export const CARDS_FILE        = 'data/b3-cards.json'
export const CARD_GROUP        = 20

export const CANDIDATE_PACK_ID    = 'BN006_0010_00_000'
export const CANDIDATE_PRODUCT_ID = 'PC_PS_2604000_01_01_01'

// Phase 5.17 — flipped LIVE 2026-04-27 after frida verification (see
// lib/b3Constants.js for source-of-truth note).
export const VERIFIED                       = true
export const SOURCE                         = 'frida_verified_2026-04-27'
export const NEEDS_LIVE_VERIFICATION        = false
export const LAUNCH_BLOCKER_UNTIL_VERIFIED  = false

export function packId() {
  return VERIFIED ? CANDIDATE_PACK_ID : null
}

export function productId() {
  return VERIFIED ? CANDIDATE_PRODUCT_ID : null
}

export function pendingDescriptor() {
  return Object.freeze({
    name:                          PACK_NAME_KEY,
    label:                         `(${SET_CODE}) ${DISPLAY_NAME}`,
    expansion:                     SET_CODE,
    publicName:                    DISPLAY_NAME,
    color:                         COLOR,
    variant:                       1,
    packId:                        null,
    productId:                     null,
    candidatePackId:               CANDIDATE_PACK_ID,
    candidateProductId:            CANDIDATE_PRODUCT_ID,
    coverPacks:                    [...COVER_PACKS],
    launchTarget:                  LAUNCH_TARGET_UTC,
    cardGroup:                     CARD_GROUP,
    cardsFile:                     CARDS_FILE,
    verified:                      VERIFIED,
    source:                        SOURCE,
    needs_live_verification:       NEEDS_LIVE_VERIFICATION,
    launch_blocker_until_verified: LAUNCH_BLOCKER_UNTIL_VERIFIED,
    pendingVerification:           !VERIFIED,
  })
}

export function assertB3Verified(caller) {
  if (VERIFIED) return
  const err = new Error(
    `B3 (${DISPLAY_NAME}) is NOT YET VERIFIED — ${caller || 'caller'} ` +
    `must not target B3 for live hunting.`
  )
  err.code = 'B3_NOT_VERIFIED'
  throw err
}

export function isB3Verified() {
  return VERIFIED
}

export function isB3PackId(id) {
  if (!id) return false
  return String(id).startsWith('BN006_')
}

export function isB3GroupId(id) {
  if (!id) return false
  return /^c?(PK|TR)_20_/.test(String(id))
}
