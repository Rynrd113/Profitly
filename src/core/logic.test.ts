import { describe, it, expect } from 'bun:test';
import { ingredientCost, totalHPP, pricingTiers, bep, roundUpToThousand } from './domain/hpp';
import { classifyMenuItems } from './domain/menuEngineering';
import { stockStatus, totalInventoryValue, applyDeductions, lowStockItems } from './domain/stock';

// ─── HPP ─────────────────────────────────────────────────────────────────────

describe('roundUpToThousand', () => {
  it('rounds exact thousands unchanged', () => expect(roundUpToThousand(5000)).toBe(5000));
  it('rounds 5001 → 6000', () => expect(roundUpToThousand(5001)).toBe(6000));
  it('rounds 4999 → 5000', () => expect(roundUpToThousand(4999)).toBe(5000));
  it('rounds 0 → 0',       () => expect(roundUpToThousand(0)).toBe(0));
});

describe('ingredientCost', () => {
  const susu = { purchasePrice: 14_000, purchaseVolume: 1_000, usage: 200, unit: 'ml' as const };

  it('calculates cost correctly', () => expect(ingredientCost(susu)).toBe(2800));
  it('divides by yieldFactor < 1', () => {
    expect(ingredientCost(susu, 0.8)).toBeCloseTo(3500, 1);
  });
  it('returns 0 when purchaseVolume is 0', () => {
    expect(ingredientCost({ ...susu, purchaseVolume: 0 })).toBe(0);
  });
  it('throws on invalid yieldFactor', () => {
    expect(() => ingredientCost(susu, 0)).toThrow();
    expect(() => ingredientCost(susu, 1.1)).toThrow();
  });
});

describe('totalHPP', () => {
  const ings = [
    { ing: { purchasePrice: 14_000, purchaseVolume: 1_000, usage: 200, unit: 'ml' as const } },
    { ing: { purchasePrice: 5_000,  purchaseVolume: 500,   usage: 10,  unit: 'gr' as const } },
  ];
  const ops = [{ price: 50_000, usage: 0.1 }];

  it('computes HPP per output unit', () => {
    const hpp = totalHPP(ings, ops, 50);
    expect(hpp).toBeGreaterThan(0);
    expect(Number.isFinite(hpp)).toBe(true);
  });

  it('throws when totalOutput ≤ 0', () => {
    expect(() => totalHPP(ings, ops, 0)).toThrow();
  });
});

describe('pricingTiers', () => {
  it('returns 3 tiers in ascending order', () => {
    // hpp=5000: competitive≈6250→7000, standard≈7692→8000, premium≈10000→10000
    const tiers = pricingTiers(5000);
    expect(tiers).toHaveLength(3);
    expect(tiers[0].sellPrice).toBeLessThanOrEqual(tiers[1].sellPrice);
    expect(tiers[1].sellPrice).toBeLessThanOrEqual(tiers[2].sellPrice);
  });

  it('sellPrice ≥ hpp for all tiers', () => {
    pricingTiers(2500).forEach(t => expect(t.sellPrice).toBeGreaterThanOrEqual(2500));
  });

  it('rounds sell price up to nearest 1000', () => {
    pricingTiers(3000).forEach(t => expect(t.sellPrice % 1000).toBe(0));
  });

  it('throws on hpp ≤ 0', () => expect(() => pricingTiers(0)).toThrow());
});

describe('bep', () => {
  it('calculates breakeven units', () => {
    const result = bep(5_000_000, 10_000, 4_000);
    expect(result.bepUnit).toBeCloseTo(833.33, 1);
    expect(result.contributionMargin).toBe(6_000);
  });

  it('throws when sell price ≤ variable cost', () => {
    expect(() => bep(1_000_000, 4_000, 4_000)).toThrow();
    expect(() => bep(1_000_000, 3_000, 4_000)).toThrow();
  });

  it('throws on negative values', () => {
    expect(() => bep(-1, 10_000, 4_000)).toThrow();
    expect(() => bep(0, -1, 4_000)).toThrow();
  });
});

// ─── Menu Engineering ────────────────────────────────────────────────────────

describe('classifyMenuItems', () => {
  const menu = [
    { id: '1', name: 'Kopi Susu',    unitsSold: 120, sellPrice: 18_000, hpp: 8_000 },
    { id: '2', name: 'Matcha Latte', unitsSold:  30, sellPrice: 25_000, hpp: 10_000 },
    { id: '3', name: 'Es Teh',       unitsSold: 200, sellPrice: 8_000,  hpp: 1_500  },
    { id: '4', name: 'Smoothie',     unitsSold:   5, sellPrice: 30_000, hpp: 25_000 },
  ];

  it('returns same count as input', () => {
    expect(classifyMenuItems(menu)).toHaveLength(4);
  });

  it('classifies high-volume high-margin as star', () => {
    const results = classifyMenuItems(menu);
    const kopiSusu = results.find(r => r.id === '1')!;
    expect(['star', 'plow']).toContain(kopiSusu.classification);
  });

  it('classifies low-volume low-margin as dog', () => {
    const results = classifyMenuItems(menu);
    const smoothie = results.find(r => r.id === '4')!;
    expect(smoothie.classification).toBe('dog');
  });

  it('returns empty array for empty input', () => {
    expect(classifyMenuItems([])).toHaveLength(0);
  });

  it('contribution margin = sellPrice − hpp', () => {
    classifyMenuItems(menu).forEach(r => {
      expect(r.contributionMargin).toBe(r.sellPrice - r.hpp);
    });
  });
});

// ─── Stock ───────────────────────────────────────────────────────────────────

describe('stockStatus', () => {
  it('"aman" when currentStock ≥ minStock', () =>
    expect(stockStatus({ currentStock: 100, minStock: 50 })).toBe('aman'));
  it('"menipis" when 0 < currentStock < minStock', () =>
    expect(stockStatus({ currentStock: 30,  minStock: 50 })).toBe('menipis'));
  it('"habis" when currentStock === 0', () =>
    expect(stockStatus({ currentStock: 0,   minStock: 50 })).toBe('habis'));
});

describe('totalInventoryValue', () => {
  it('sums value correctly', () => {
    const items = [
      { name: 'Susu', currentStock: 500, purchasePrice: 14_000, purchaseVolume: 1_000, minStock: 200, unit: 'ml' },
      { name: 'Gula', currentStock: 200, purchasePrice: 8_000,  purchaseVolume: 1_000, minStock: 100, unit: 'gr' },
    ];
    expect(totalInventoryValue(items)).toBeCloseTo(8_600, 0);
  });
});

describe('applyDeductions', () => {
  const base = [
    { name: 'Susu', currentStock: 500, purchasePrice: 14_000, purchaseVolume: 1_000, minStock: 200, unit: 'ml' },
  ];

  it('deducts the correct amount', () => {
    const result = applyDeductions(base, [{ name: 'Susu', amount: 100 }]);
    expect(result[0].currentStock).toBe(400);
  });

  it('floors at 0, never goes negative', () => {
    const result = applyDeductions(base, [{ name: 'Susu', amount: 9999 }]);
    expect(result[0].currentStock).toBe(0);
  });

  it('does not mutate the original array', () => {
    applyDeductions(base, [{ name: 'Susu', amount: 100 }]);
    expect(base[0].currentStock).toBe(500);
  });
});

describe('lowStockItems', () => {
  it('returns only items below minStock', () => {
    const items = [
      { name: 'Susu', currentStock: 30,  purchasePrice: 14_000, purchaseVolume: 1_000, minStock: 200, unit: 'ml' },
      { name: 'Gula', currentStock: 500, purchasePrice: 8_000,  purchaseVolume: 1_000, minStock: 100, unit: 'gr' },
    ];
    expect(lowStockItems(items)).toHaveLength(1);
    expect(lowStockItems(items)[0].name).toBe('Susu');
  });
});
