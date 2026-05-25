/**
 * Phase 5.6 (Apr 2026) — WebUI-side ESM mirror of lib/packLabel.js.
 *
 * Vite root is webui/client, so the React side cannot cross the root
 * boundary to require the canonical CJS module at /lib/. This file
 * literally duplicates the same regex ladder in ESM form. The
 * Phase 5.6 contract test asserts every rule here matches the CJS
 * module exactly, so a drift causes CI failure rather than silent
 * divergence.
 *
 * If you change one of these rules, change BOTH files in the same
 * commit. The contract is the strings; this is intentional
 * duplication with a CI guard, not abstraction failure.
 */

const STRIP_RULES = [
  { re: /^\([A-Za-z0-9-]+\)\s+/, to: '' },
  { re: /^Super Rise\s+/i,             to: '' },
  { re: /^Strongest Genes\s+/i,        to: '' },
  { re: /^Temporal Battle\s+/i,        to: '' },
  { re: /^Guardians of the Sky\s+/i,   to: '' },
  { re: /^Guidance of Sky and Sea\s+/i,to: '' },
  { re: /^Phantom Island\s*/i,         to: 'Mew' },
  { re: /^Transcendence Light\s*/i,    to: 'Arceus' },
  { re: /^Radiant Colors\s*/i,         to: 'Latias' },
  { re: /^Dimensional Crisis\s*/i,     to: 'Necrozma' },
  { re: /^Eevee Garden\s*/i,           to: 'Eevee' },
  { re: /^Unknown Waters\s*/i,         to: 'Kyogre' },
  { re: /^Premium Expansion Pack ex\s*/i, to: 'Premium' },
  { re: /^Pulsing Aura\s+/i,           to: '' },
];

export function humanizePackLabel(label) {
  if (!label || typeof label !== 'string') return '';
  let out = label;
  for (const { re, to } of STRIP_RULES) {
    out = out.replace(re, to);
  }
  return out;
}

export default humanizePackLabel;
