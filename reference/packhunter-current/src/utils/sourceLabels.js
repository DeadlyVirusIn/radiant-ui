/**
 * Phase 5.0 (Apr 2026) — WebUI-side ESM proxy of lib/sourceLabels.js.
 *
 * The canonical module at repo-root/lib/sourceLabels.js is CommonJS
 * (so the Discord backend can `require()` it). Vite's root is
 * webui/client, so importing from `../../../../lib/sourceLabels`
 * crosses the root boundary and breaks Rollup.
 *
 * Solution: this file LITERALLY duplicates the same display strings
 * + classify/glyph/emoji helpers in ESM form. The Phase 5.0 parity
 * test asserts every literal here matches the CJS module exactly,
 * so a drift causes CI failure rather than silent divergence.
 *
 * If you change one of these strings, change BOTH files in the same
 * commit. The contract is the strings; this is intentional duplication
 * with a CI guard, not abstraction failure.
 */

export const SOURCE_LABELS = Object.freeze({
  HUNT:       'Shared Hunt Pool',
  WONDERPICK: 'Wonderpick discovery',
  MANUAL:     'Manually added',
  UNKNOWN:    'Source unknown',
});

export function classifySource(src) {
  if (!src) return SOURCE_LABELS.UNKNOWN;
  const s = String(src).toLowerCase();
  if (s === 'hunt' || s.startsWith('headless_reroll')) return SOURCE_LABELS.HUNT;
  if (s.includes('wonder')) return SOURCE_LABELS.WONDERPICK;
  if (s === 'manual') return SOURCE_LABELS.MANUAL;
  return SOURCE_LABELS.UNKNOWN;
}

export const CONTAINER_EMOJI = Object.freeze({
  C1: '🟦',
  C2: '🟩',
  C3: '🟧',
  C4: '🟪',
});

export function containerEmoji(container) {
  if (!container) return '';
  return CONTAINER_EMOJI[container] || '';
}

export const RARITY_GLYPH = Object.freeze({
  SR:  '✨',
  SAR: '✨',
  SSR: '✨',
  AR:  '🟣',
  IM:  '🟣',
  UR:  '👑',
});

export function rarityGlyph(rarity) {
  if (!rarity) return '•';
  return RARITY_GLYPH[String(rarity).toUpperCase()] || '•';
}

export default {
  SOURCE_LABELS,
  classifySource,
  CONTAINER_EMOJI,
  containerEmoji,
  RARITY_GLYPH,
  rarityGlyph,
};
