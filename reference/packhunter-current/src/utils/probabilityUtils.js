/**
 * Probability Utilities for Pack Opening Calculations
 */

// Rarity pull rates (per card slot)
export const RARITY_ODDS = {
  'C': 0.60,
  'U': 0.25,
  'R': 0.10,
  'RR': 0.035,
  'AR': 0.01,
  'SR': 0.004,
  'SAR': 0.001,
  'IM': 0.0002,
  'UR': 0.0001,
};

// God pack probability
export const GOD_PACK_ODDS = 0.0005; // 0.05%

// Cards per pack
export const CARDS_PER_PACK = 5;

/**
 * Calculate probability of getting at least one card of a rarity in N packs
 * Uses: P(at least 1) = 1 - P(none)
 */
export function probabilityOfRarityInPacks(rarity, numPacks) {
  const oddsPerCard = RARITY_ODDS[rarity] || 0;
  const oddsPerPack = 1 - Math.pow(1 - oddsPerCard, CARDS_PER_PACK);
  const probNone = Math.pow(1 - oddsPerPack, numPacks);
  return 1 - probNone;
}

/**
 * Calculate probability of getting a specific card
 * @param {number} cardPoolSize - Total cards of that rarity in the set
 * @param {string} rarity - Card rarity
 * @param {number} numPacks - Number of packs to open
 */
export function probabilityOfSpecificCard(cardPoolSize, rarity, numPacks) {
  const rarityOdds = RARITY_ODDS[rarity] || 0;
  const cardOdds = rarityOdds / cardPoolSize;
  const oddsPerPack = 1 - Math.pow(1 - cardOdds, CARDS_PER_PACK);
  const probNone = Math.pow(1 - oddsPerPack, numPacks);
  return 1 - probNone;
}

/**
 * Calculate expected number of packs to get at least one of a rarity
 * Uses geometric distribution: E[X] = 1/p
 */
export function expectedPacksForRarity(rarity) {
  const oddsPerCard = RARITY_ODDS[rarity] || 0;
  const oddsPerPack = 1 - Math.pow(1 - oddsPerCard, CARDS_PER_PACK);
  return oddsPerPack > 0 ? Math.ceil(1 / oddsPerPack) : Infinity;
}

/**
 * Calculate expected packs to get a specific card
 */
export function expectedPacksForCard(cardPoolSize, rarity) {
  const rarityOdds = RARITY_ODDS[rarity] || 0;
  const cardOdds = rarityOdds / cardPoolSize;
  const oddsPerPack = 1 - Math.pow(1 - cardOdds, CARDS_PER_PACK);
  return oddsPerPack > 0 ? Math.ceil(1 / oddsPerPack) : Infinity;
}

/**
 * Calculate expected packs to complete a set
 * Uses Coupon Collector's Problem approximation
 * @param {Object} setCards - { rarity: count } mapping
 */
export function expectedPacksToCompleteSet(setCards) {
  let totalExpectedPacks = 0;

  for (const [rarity, count] of Object.entries(setCards)) {
    if (count > 0) {
      // For each card of this rarity, calculate expected packs
      // Coupon collector approximation: n * H(n) where H(n) is harmonic series
      const harmonicSum = Array.from({ length: count }, (_, i) => 1 / (i + 1))
        .reduce((a, b) => a + b, 0);
      const expectedForRarity = expectedPacksForCard(count, rarity) * harmonicSum;
      totalExpectedPacks = Math.max(totalExpectedPacks, expectedForRarity);
    }
  }

  return Math.ceil(totalExpectedPacks);
}

/**
 * Calculate probability of getting a god pack in N packs
 */
export function probabilityOfGodPack(numPacks) {
  return 1 - Math.pow(1 - GOD_PACK_ODDS, numPacks);
}

/**
 * Expected packs for at least one god pack
 */
export function expectedPacksForGodPack() {
  return Math.ceil(1 / GOD_PACK_ODDS);
}

/**
 * Monte Carlo simulation for set completion
 * @param {Array} cards - Array of cards with rarity_code
 * @param {number} iterations - Number of simulations to run
 * @param {number} targetOwned - Number of unique cards to collect (null = all)
 */
export function monteCarloSetCompletion(cards, iterations = 1000, targetOwned = null) {
  const target = targetOwned || cards.length;
  const results = [];

  // Group cards by rarity
  const cardsByRarity = {};
  for (const card of cards) {
    const rarity = card.rarity_code || 'C';
    if (!cardsByRarity[rarity]) cardsByRarity[rarity] = [];
    cardsByRarity[rarity].push(card.backend_id || card.id);
  }

  for (let i = 0; i < iterations; i++) {
    const owned = new Set();
    let packs = 0;

    while (owned.size < target && packs < 100000) {
      packs++;
      // Simulate 5 card pulls
      for (let j = 0; j < CARDS_PER_PACK; j++) {
        const rarity = getRandomRarity();
        const cardsOfRarity = cardsByRarity[rarity];
        if (cardsOfRarity && cardsOfRarity.length > 0) {
          const cardId = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
          owned.add(cardId);
        }
      }
    }

    results.push(packs);
  }

  // Calculate statistics
  results.sort((a, b) => a - b);
  return {
    min: results[0],
    max: results[results.length - 1],
    median: results[Math.floor(results.length / 2)],
    average: Math.round(results.reduce((a, b) => a + b, 0) / results.length),
    percentile25: results[Math.floor(results.length * 0.25)],
    percentile75: results[Math.floor(results.length * 0.75)],
    percentile90: results[Math.floor(results.length * 0.90)],
  };
}

/**
 * Get random rarity based on odds
 */
function getRandomRarity() {
  const rand = Math.random();
  let cumulative = 0;

  for (const [rarity, odds] of Object.entries(RARITY_ODDS)) {
    cumulative += odds;
    if (rand <= cumulative) return rarity;
  }

  return 'C';
}

/**
 * Calculate pack value based on missing cards
 * @param {Array} missingCards - Cards still needed
 * @param {string} packSetCode - Pack's set code to filter
 */
export function calculatePackValue(missingCards, packSetCode = null) {
  let value = 0;
  const weights = {
    'C': 1,
    'U': 2,
    'R': 5,
    'RR': 15,
    'AR': 25,
    'SR': 50,
    'SAR': 100,
    'IM': 200,
    'UR': 500,
  };

  const relevantCards = packSetCode
    ? missingCards.filter(c => c.set_code === packSetCode)
    : missingCards;

  for (const card of relevantCards) {
    const rarity = card.rarity_code || 'C';
    const weight = weights[rarity] || 1;
    const odds = RARITY_ODDS[rarity] || 0;
    value += weight * odds;
  }

  return value;
}

/**
 * Calculate luck rating based on actual vs expected pulls
 * @param {Object} actual - { rarity: count } actual pulls
 * @param {number} totalCards - Total cards pulled
 */
export function calculateLuckRating(actual, totalCards) {
  let luckScore = 0;

  for (const [rarity, count] of Object.entries(actual)) {
    const expected = totalCards * (RARITY_ODDS[rarity] || 0);
    if (expected > 0) {
      const ratio = count / expected;
      // Weight higher rarities more
      const weight = getWeight(rarity);
      luckScore += (ratio - 1) * weight;
    }
  }

  // Convert to grade
  if (luckScore > 1.5) return { grade: 'S+', label: 'Incredibly Lucky', color: '#ffd700' };
  if (luckScore > 1.0) return { grade: 'S', label: 'Very Lucky', color: '#ff9800' };
  if (luckScore > 0.5) return { grade: 'A', label: 'Lucky', color: '#4caf50' };
  if (luckScore > 0.0) return { grade: 'B', label: 'Slightly Lucky', color: '#8bc34a' };
  if (luckScore > -0.5) return { grade: 'C', label: 'Average', color: '#9e9e9e' };
  if (luckScore > -1.0) return { grade: 'D', label: 'Slightly Unlucky', color: '#ff5722' };
  return { grade: 'F', label: 'Unlucky', color: '#f44336' };
}

function getWeight(rarity) {
  const weights = { 'C': 0.1, 'U': 0.2, 'R': 0.5, 'RR': 1, 'AR': 2, 'SR': 5, 'SAR': 10, 'IM': 15, 'UR': 20 };
  return weights[rarity] || 1;
}

export default {
  RARITY_ODDS,
  GOD_PACK_ODDS,
  CARDS_PER_PACK,
  probabilityOfRarityInPacks,
  probabilityOfSpecificCard,
  expectedPacksForRarity,
  expectedPacksForCard,
  expectedPacksToCompleteSet,
  probabilityOfGodPack,
  expectedPacksForGodPack,
  monteCarloSetCompletion,
  calculatePackValue,
  calculateLuckRating,
};
