/**
 * Export Utilities for Collection Data
 */

/**
 * Convert collection data to CSV format
 */
export function collectionToCSV(cards, options = {}) {
  const {
    includeOwned = true,
    includeMissing = true,
    fields = ['id', 'name', 'set', 'rarity', 'type', 'owned', 'quantity'],
  } = options;

  // Filter cards
  let filteredCards = cards;
  if (!includeOwned) {
    filteredCards = filteredCards.filter(c => !c.owned);
  }
  if (!includeMissing) {
    filteredCards = filteredCards.filter(c => c.owned);
  }

  // Field labels
  const fieldLabels = {
    id: 'Card ID',
    backend_id: 'Backend ID',
    name: 'Name',
    set: 'Set',
    set_code: 'Set Code',
    rarity: 'Rarity',
    type: 'Type',
    owned: 'Owned',
    quantity: 'Quantity',
    hp: 'HP',
    artist: 'Artist',
  };

  // Build CSV header
  const header = fields.map(f => fieldLabels[f] || f).join(',');

  // Build CSV rows
  const rows = filteredCards.map(card => {
    return fields.map(field => {
      let value = card[field];

      // Handle special fields
      if (field === 'owned') {
        value = card.owned ? 'Yes' : 'No';
      } else if (field === 'set') {
        value = card.set_name || card.set || card.set_code || '';
      }

      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string') {
        value = value.replace(/"/g, '""');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value}"`;
        }
      }

      return value ?? '';
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Convert collection data to JSON format
 */
export function collectionToJSON(cards, options = {}) {
  const {
    includeOwned = true,
    includeMissing = true,
    pretty = true,
    fields = null, // null = all fields
  } = options;

  // Filter cards
  let filteredCards = cards;
  if (!includeOwned) {
    filteredCards = filteredCards.filter(c => !c.owned);
  }
  if (!includeMissing) {
    filteredCards = filteredCards.filter(c => c.owned);
  }

  // Filter fields if specified
  if (fields) {
    filteredCards = filteredCards.map(card => {
      const filtered = {};
      fields.forEach(f => {
        if (card[f] !== undefined) {
          filtered[f] = card[f];
        }
      });
      return filtered;
    });
  }

  const exportData = {
    exportDate: new Date().toISOString(),
    totalCards: filteredCards.length,
    ownedCards: filteredCards.filter(c => c.owned).length,
    missingCards: filteredCards.filter(c => !c.owned).length,
    cards: filteredCards,
  };

  return pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData);
}

/**
 * Convert set progress to CSV
 */
export function setProgressToCSV(sets) {
  const header = 'Set Name,Set Code,Owned,Total,Completion %';
  const rows = sets.map(set => {
    const pct = set.total > 0 ? ((set.owned / set.total) * 100).toFixed(1) : '0.0';
    return `"${set.name}",${set.code || set.set_code || ''},${set.owned},${set.total},${pct}%`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Convert rarity stats to CSV
 */
export function rarityStatsToCSV(rarityStats) {
  const header = 'Rarity,Owned,Total,Completion %';
  const rows = rarityStats.map(stat => {
    const pct = stat.total > 0 ? ((stat.owned / stat.total) * 100).toFixed(1) : '0.0';
    return `"${stat.rarity}",${stat.owned},${stat.total},${pct}%`;
  });
  return [header, ...rows].join('\n');
}

/**
 * Trigger file download
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export collection as CSV
 */
export function exportCollectionCSV(cards, filename = 'collection.csv', options = {}) {
  const csv = collectionToCSV(cards, options);
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export collection as JSON
 */
export function exportCollectionJSON(cards, filename = 'collection.json', options = {}) {
  const json = collectionToJSON(cards, options);
  downloadFile(json, filename, 'application/json');
}

/**
 * Export set progress
 */
export function exportSetProgress(sets, filename = 'set-progress.csv') {
  const csv = setProgressToCSV(sets);
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export rarity stats
 */
export function exportRarityStats(rarityStats, filename = 'rarity-stats.csv') {
  const csv = rarityStatsToCSV(rarityStats);
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export full collection report
 */
export function exportFullReport(data, filename = 'collection-report.json') {
  const report = {
    exportDate: new Date().toISOString(),
    summary: data.summary,
    sets: data.sets,
    rarityStats: data.rarityStats,
    cards: data.cards,
  };
  downloadFile(JSON.stringify(report, null, 2), filename, 'application/json');
}

export default {
  collectionToCSV,
  collectionToJSON,
  setProgressToCSV,
  rarityStatsToCSV,
  downloadFile,
  exportCollectionCSV,
  exportCollectionJSON,
  exportSetProgress,
  exportRarityStats,
  exportFullReport,
};
