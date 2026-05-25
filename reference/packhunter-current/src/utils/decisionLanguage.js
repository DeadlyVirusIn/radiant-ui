/**
 * Phase 5.7 (Apr 2026) — ESM mirror of lib/decisionLanguage.js.
 *
 * MUST stay byte-identical (modulo CJS↔ESM syntax) to lib/decisionLanguage.js.
 * Phase 5.7 contract test asserts both files emit the same labels,
 * states, confidence ladder, action verbs, and TERM_MAP entries.
 *
 * See lib/decisionLanguage.js for the full doc-block, scope rules,
 * included/excluded surface lists, and design rationale.
 */

export const STATES = Object.freeze({
  LIVE:     Object.freeze({ key: 'LIVE',     label: 'Live',                  emoji: '🟢', color: 'success' }),
  AWAITING: Object.freeze({ key: 'AWAITING', label: 'Awaiting confirmation', emoji: '🟡', color: 'warning' }),
  READY:    Object.freeze({ key: 'READY',    label: 'Ready',                 emoji: '🔵', color: 'info'    }),
  LIMITED:  Object.freeze({ key: 'LIMITED',  label: 'Limited',               emoji: '🟠', color: 'warning' }),
  BLOCKED:  Object.freeze({ key: 'BLOCKED',  label: 'Blocked',               emoji: '🔴', color: 'error'   }),
})

export const CONFIDENCE = Object.freeze({
  HIGH:      'High confidence',
  MEDIUM:    'Medium confidence',
  LIMITED:   'Limited confidence',
  PROTECTED: 'Protected',
})

export const ACTIONS = Object.freeze({
  FOUND:     'Found',
  CONFIRMED: 'Confirmed',
  READY:     'Ready',
  REMOVE:    'Remove',
  KEEP:      'Keep',
  REVIEW:    'Review',
})

export const TERM_MAP = Object.freeze({
  Detected:    'Found',
  Triggered:   'Started',
  Evaluated:   'Checked',
  Classified:  'Sorted',
  Imbalanced:  'Uneven',
})

export function humanizeTerm(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let out = raw
  for (const [from, to] of Object.entries(TERM_MAP)) {
    const re = new RegExp(`\\b${from}\\b`, 'gi')
    out = out.replace(re, (match) => {
      const titleCase = match[0] === match[0].toUpperCase()
      return titleCase ? to : to.toLowerCase()
    })
  }
  return out
}

export function classifyState(rawStatus) {
  if (!rawStatus) return STATES.AWAITING
  const s = String(rawStatus).toUpperCase()
  if (s === 'LIVE' || s === 'ALIVE')                          return STATES.LIVE
  if (s === 'PICKED')                                         return STATES.LIMITED
  if (s === 'EXPIRED')                                        return STATES.BLOCKED
  if (s === 'READY')                                          return STATES.READY
  if (s === 'PENDING' || s === 'AWAITING' || s === 'UNKNOWN') return STATES.AWAITING
  if (s === 'BLOCKED' || s === 'BLOCKED_UNKNOWN')             return STATES.BLOCKED
  return STATES.AWAITING
}

export function confidenceLabel(key) {
  if (!key) return ''
  const k = String(key).toUpperCase().replace(/[\s/-]+/g, '_')
  if (k === 'HIGH_SAFE')        return CONFIDENCE.HIGH
  if (k === 'MEDIUM_SAFE')      return CONFIDENCE.MEDIUM
  if (k === 'BLOCKED_UNKNOWN')  return CONFIDENCE.PROTECTED
  if (k === 'LIMITED')          return CONFIDENCE.LIMITED
  return ''
}
