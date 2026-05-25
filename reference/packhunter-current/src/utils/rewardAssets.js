/**
 * Reward asset registry — canonical reward-key → local asset path.
 *
 * Backend route /api/tasks/wonder-picks emits a stable `rewardKey`
 * (e.g. 'event_hourglass', 'shop_ticket') on each substitution item.
 * The UI calls getRewardAsset(rewardKey) to resolve to a local PNG
 * served from /assets/rewards/. Assets are bundled into the webui
 * docker image — no external hotlinks at runtime.
 *
 * Add new reward types here (and drop the matching PNG into
 * webui/client/public/assets/rewards/) — no DB schema changes needed.
 */

const ASSET_BASE = '/assets/rewards'

// Canonical key → { src, label, alt }. Keys are STABLE identifiers
// produced by the backend; never derive from user-visible labels.
export const REWARD_ASSETS = Object.freeze({
  event_shop_ticket: { src: `${ASSET_BASE}/event_shop_ticket.png`, label: 'Event Shop Ticket', alt: 'Event Shop Ticket icon' },
  event_hourglass:   { src: `${ASSET_BASE}/event_hourglass.png`,   label: 'Event Hourglass',   alt: 'Event Hourglass icon' },
  shop_ticket:       { src: `${ASSET_BASE}/shop_ticket.png`,       label: 'Shop Ticket',       alt: 'Shop Ticket icon' },
  wonder_hourglass:  { src: `${ASSET_BASE}/wonder_hourglass.png`,  label: 'Wonder Hourglass',  alt: 'Wonder Hourglass icon' },
  pack_hourglass:    { src: `${ASSET_BASE}/pack_hourglass.png`,    label: 'Pack Hourglass',    alt: 'Pack Hourglass icon' },
  shinedust:         { src: `${ASSET_BASE}/shinedust.png`,         label: 'Shinedust',         alt: 'Shinedust icon' },
  trade_hourglass:   { src: `${ASSET_BASE}/trade_hourglass.png`,   label: 'Trade Hourglass',   alt: 'Trade Hourglass icon' },
})

/**
 * Resolve a reward key to its local asset descriptor.
 * Returns null when the key is unknown so callers can render a
 * generic fallback (e.g. a Chip with the label only) instead of a
 * broken image. Falls back to fuzzy matching by normalizing the key
 * so frontend code that gets a near-match label still resolves.
 */
export function getRewardAsset(rewardKey) {
  if (!rewardKey) return null
  const k = String(rewardKey).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return REWARD_ASSETS[k] || null
}
