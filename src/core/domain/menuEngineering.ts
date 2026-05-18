/**
 * Menu Engineering Domain
 * Classifies menu items into BCG-style quadrants based on
 * popularity (volume) and profitability (contribution margin).
 *
 * Quadrant matrix:
 *   High Popularity + High Profit  → Star    ⭐
 *   High Popularity + Low  Profit  → Plow    🐄
 *   Low  Popularity + High Profit  → Puzzle  ❓
 *   Low  Popularity + Low  Profit  → Dog     🐕
 */

export type MEClass = 'star' | 'plow' | 'puzzle' | 'dog';

export interface MEInput {
  id: string;
  name: string;
  /** Number of units sold in the period */
  unitsSold: number;
  /** Sell price per unit */
  sellPrice: number;
  /** HPP / variable cost per unit */
  hpp: number;
}

export interface MEResult extends MEInput {
  contributionMargin: number;
  totalContribution: number;
  popularityPct: number;
  classification: MEClass;
  popularityIndex: number;
  profitabilityIndex: number;
}

/**
 * Classify menu items using the Menu Engineering matrix.
 *
 * @param items       - Array of menu items with sales and cost data.
 * @param popThreshold - Popularity threshold multiplier (default 0.7 per Kasavana & Smith).
 * @returns Classified results sorted by totalContribution descending.
 */
export function classifyMenuItems(items: MEInput[], popThreshold = 0.7): MEResult[] {
  if (items.length === 0) return [];

  const totalSold = items.reduce((s, i) => s + i.unitsSold, 0);
  if (totalSold === 0) return items.map(i => ({
    ...i,
    contributionMargin: i.sellPrice - i.hpp,
    totalContribution: 0,
    popularityPct: 0,
    classification: 'dog',
    popularityIndex: 0,
    profitabilityIndex: 0,
  }));

  const avgPopularity = totalSold / items.length;
  const popThresholdVal = avgPopularity * popThreshold;

  // Weighted average CM per unit = Total Gross Profit / Total Units Sold
  const avgCM = items.reduce((s, i) => s + (i.sellPrice - i.hpp) * i.unitsSold, 0) / totalSold;

  return items
    .map((item) => {
      const cm = item.sellPrice - item.hpp;
      const totalContribution = cm * item.unitsSold;
      const popularityPct = totalSold > 0 ? (item.unitsSold / totalSold) * 100 : 0;
      const isPopular = item.unitsSold >= popThresholdVal;
      const isProfitable = cm >= avgCM;

      const classification: MEClass =
        isPopular && isProfitable  ? 'star'   :
        isPopular && !isProfitable ? 'plow'   :
        !isPopular && isProfitable ? 'puzzle' : 'dog';

      return {
        ...item,
        contributionMargin: cm,
        totalContribution,
        popularityPct,
        classification,
        popularityIndex: avgPopularity > 0 ? item.unitsSold / avgPopularity : 0,
        profitabilityIndex: avgCM > 0 ? cm / avgCM : 0,
      };
    })
    .sort((a, b) => b.totalContribution - a.totalContribution);
}

export const ME_LABELS: Record<MEClass, { label: string; emoji: string; desc: string }> = {
  star:   { label: 'Star',   emoji: '⭐', desc: 'Populer & Menguntungkan — Pertahankan' },
  plow:   { label: 'Plow',   emoji: '🐄', desc: 'Populer tapi Margin Kecil — Naikkan Harga' },
  puzzle: { label: 'Puzzle', emoji: '❓', desc: 'Margin Bagus tapi Jarang Dibeli — Promosikan' },
  dog:    { label: 'Dog',    emoji: '🐕', desc: 'Jarang Dibeli & Tidak Menguntungkan — Evaluasi' },
};
