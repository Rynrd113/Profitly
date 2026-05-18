import { describe, test, expect } from 'bun:test';
import {
  calculateIngredientCost,
  calculateTotalHPP,
  getPricingTiers,
  getTierPrice,
  calculateBEP,
  getBEPScenarios,
  calculateDerivedHPP,   // add this
} from './engine';
import type { Ingredient, OperationalCost } from '../types/hpp';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const susu: Ingredient = {
  id: '1',
  name: 'Susu UHT',
  purchasePrice: 14_000,
  purchaseVolume: 1_000,
  unit: 'ml',
  usage: 200,
};

const gula: Ingredient = {
  id: '2',
  name: 'Gula Pasir',
  purchasePrice: 13_000,
  purchaseVolume: 1_000,
  unit: 'gr',
  usage: 50,
};

const listrik: OperationalCost = {
  id: 'op1',
  name: 'Listrik',
  price: 500_000,
  usage: 0.1, // 10% dibebankan ke produk ini
};

// ─── calculateIngredientCost ─────────────────────────────────────────────────

describe('calculateIngredientCost', () => {
  test('menghitung biaya bahan dengan benar tanpa yield loss', () => {
    // 14.000 / 1.000 = Rp14/ml × 200ml = Rp2.800
    expect(calculateIngredientCost(susu)).toBe(2_800);
  });

  test('menaikkan biaya saat yieldFactor < 1 (ada susut)', () => {
    // (14/ml × 200ml) / 0.8 = Rp3.500
    expect(calculateIngredientCost(susu, 0.8)).toBe(3_500);
  });

  test('yieldFactor default 1 menghasilkan nilai sama dengan tanpa parameter', () => {
    expect(calculateIngredientCost(susu, 1)).toBe(calculateIngredientCost(susu));
  });

  test('mengembalikan 0 jika purchaseVolume adalah 0', () => {
    const invalid: Ingredient = { ...susu, purchaseVolume: 0 };
    expect(calculateIngredientCost(invalid)).toBe(0);
  });

  test('membulatkan hasil ke 2 desimal (presisi floating point)', () => {
    // 10.000 / 3.000 = 3.333333... per gr × 100gr = 333.33
    const tepung: Ingredient = {
      id: '3',
      name: 'Tepung',
      purchasePrice: 10_000,
      purchaseVolume: 3_000,
      unit: 'gr',
      usage: 100,
    };
    expect(calculateIngredientCost(tepung)).toBe(333.33);
  });

  test('melempar RangeError jika yieldFactor = 0', () => {
    expect(() => calculateIngredientCost(susu, 0)).toThrow(RangeError);
  });

  test('melempar RangeError jika yieldFactor > 1', () => {
    expect(() => calculateIngredientCost(susu, 1.1)).toThrow(RangeError);
  });

  test('melempar RangeError jika yieldFactor negatif', () => {
    expect(() => calculateIngredientCost(susu, -0.5)).toThrow(RangeError);
  });
});

// ─── calculateTotalHPP ───────────────────────────────────────────────────────

describe('calculateTotalHPP', () => {
  test('menggabungkan biaya bahan dan operasional lalu dibagi totalOutput', () => {
    // susu: 2.800 | gula: 650 | listrik: 500.000 × 0.1 = 50.000
    // total = 53.450 / 10 = 5.345
    const hpp = calculateTotalHPP(
      [{ ingredient: susu }, { ingredient: gula }],
      [listrik],
      10
    );
    expect(hpp).toBe(5_345);
  });

  test('menghitung dengan benar tanpa biaya operasional', () => {
    // susu 2.800 + gula 650 = 3.450 / 5 = 690
    const hpp = calculateTotalHPP(
      [{ ingredient: susu }, { ingredient: gula }],
      [],
      5
    );
    expect(hpp).toBe(690);
  });

  test('menerapkan yieldFactor per bahan', () => {
    // susu tanpa yield: 2.800 | gula dengan yield 0.5: 650 / 0.5 = 1.300
    // total = 4.100 / 1 = 4.100
    const hpp = calculateTotalHPP(
      [{ ingredient: susu }, { ingredient: gula, yieldFactor: 0.5 }],
      [],
      1
    );
    expect(hpp).toBe(4_100);
  });

  test('melempar RangeError jika totalOutput = 0', () => {
    expect(() =>
      calculateTotalHPP([{ ingredient: susu }], [], 0)
    ).toThrow(RangeError);
  });

  test('melempar RangeError jika totalOutput negatif', () => {
    expect(() =>
      calculateTotalHPP([{ ingredient: susu }], [], -1)
    ).toThrow(RangeError);
  });
});

// ─── getPricingTiers ─────────────────────────────────────────────────────────

describe('getPricingTiers', () => {
  const hpp = 4_200;

  test('mengembalikan tepat 3 tier', () => {
    expect(getPricingTiers(hpp)).toHaveLength(3);
  });

  test('label tier benar dan urut', () => {
    const labels = getPricingTiers(hpp).map((t) => t.label);
    expect(labels).toEqual(['competitive', 'standard', 'premium']);
  });

  test('margin tier sesuai definisi', () => {
    const [comp, std, prem] = getPricingTiers(hpp);
    expect(comp.margin).toBe(0.20);
    expect(std.margin).toBe(0.35);
    expect(prem.margin).toBe(0.50);
  });

  test('harga competitive dibulatkan ke kelipatan 1000 terdekat ke atas', () => {
    // 4.200 / 0.8 = 5.250 → ceilTo1000 = 6.000
    const [comp] = getPricingTiers(hpp);
    expect(comp.sellPrice).toBe(6_000);
  });

  test('harga standard dibulatkan ke kelipatan 1000 terdekat ke atas', () => {
    // 4.200 / 0.65 = 6.461.5... → ceilTo1000 = 7.000
    const [, std] = getPricingTiers(hpp);
    expect(std.sellPrice).toBe(7_000);
  });

  test('harga premium dibulatkan ke kelipatan 1000 terdekat ke atas', () => {
    // 4.200 / 0.5 = 8.400 → ceilTo1000 = 9.000
    const [, , prem] = getPricingTiers(hpp);
    expect(prem.sellPrice).toBe(9_000);
  });

  test('profit = sellPrice - hpp untuk setiap tier', () => {
    getPricingTiers(hpp).forEach((tier) => {
      expect(tier.profit).toBe(tier.sellPrice - hpp);
    });
  });

  test('sellPrice yang sudah tepat kelipatan 1000 tidak berubah', () => {
    // hpp = 4.000 | premium: 4.000/0.5 = 8.000 → sudah kelipatan 1000
    const [, , prem] = getPricingTiers(4_000);
    expect(prem.sellPrice).toBe(8_000);
  });

  test('melempar RangeError jika hpp = 0', () => {
    expect(() => getPricingTiers(0)).toThrow(RangeError);
  });

  test('melempar RangeError jika hpp negatif', () => {
    expect(() => getPricingTiers(-1)).toThrow(RangeError);
  });
});

// ─── getTierPrice ────────────────────────────────────────────────────────────

describe('getTierPrice', () => {
  test('mengembalikan harga tier yang diminta', () => {
    const tiers = getPricingTiers(4_200);
    expect(getTierPrice(4_200, 'competitive')).toBe(tiers[0].sellPrice);
    expect(getTierPrice(4_200, 'standard')).toBe(tiers[1].sellPrice);
    expect(getTierPrice(4_200, 'premium')).toBe(tiers[2].sellPrice);
  });

  test('melempar Error jika tier tidak dikenal', () => {
    expect(() => getTierPrice(4_200, 'unknown' as any)).toThrow(Error);
  });
});

// ─── calculateBEP ────────────────────────────────────────────────────────────

describe('calculateBEP', () => {
  const fixedCost = 5_000_000;
  const sellPrice = 8_500;
  const variableCost = 4_200;

  test('menghitung contributionMargin dengan benar', () => {
    const { contributionMargin } = calculateBEP(fixedCost, sellPrice, variableCost);
    expect(contributionMargin).toBe(4_300);
  });

  test('menghitung bepUnit dengan benar', () => {
    // 5.000.000 / 4.300 = 1162.79...
    const { bepUnit } = calculateBEP(fixedCost, sellPrice, variableCost);
    expect(bepUnit).toBe(1_162.79);
  });

  test('menghitung bepRevenue dengan benar', () => {
    // 1162.79 × 8.500 = 9.883.715
    const { bepRevenue } = calculateBEP(fixedCost, sellPrice, variableCost);
    expect(bepRevenue).toBe(9_883_715);
  });

  test('BEP = 0 unit saat fixedCost = 0', () => {
    const { bepUnit, bepRevenue } = calculateBEP(0, sellPrice, variableCost);
    expect(bepUnit).toBe(0);
    expect(bepRevenue).toBe(0);
  });

  test('melempar RangeError jika harga jual sama dengan HPP', () => {
    expect(() => calculateBEP(fixedCost, 4_200, 4_200)).toThrow(RangeError);
  });

  test('melempar RangeError jika harga jual lebih kecil dari HPP', () => {
    expect(() => calculateBEP(fixedCost, 4_000, 4_200)).toThrow(RangeError);
  });

  test('melempar RangeError jika fixedCost negatif', () => {
    expect(() => calculateBEP(-1, sellPrice, variableCost)).toThrow(RangeError);
  });

  test('melempar RangeError jika sellPrice = 0', () => {
    expect(() => calculateBEP(fixedCost, 0, variableCost)).toThrow(RangeError);
  });

  test('melempar RangeError jika variableCost negatif', () => {
    expect(() => calculateBEP(fixedCost, sellPrice, -100)).toThrow(RangeError);
  });
});

// ─── getBEPScenarios ─────────────────────────────────────────────────────────

describe('getBEPScenarios', () => {
  const fixedCost = 5_000_000;
  const hpp = 4_200;

  test('mengembalikan tepat 3 skenario', () => {
    expect(getBEPScenarios(fixedCost, hpp, hpp)).toHaveLength(3);
  });

  test('label skenario sesuai dengan tier', () => {
    const labels = getBEPScenarios(fixedCost, hpp, hpp).map((s) => s.tier);
    expect(labels).toEqual(['competitive', 'standard', 'premium']);
  });

  test('sellPrice setiap skenario sesuai dengan getPricingTiers', () => {
    const tiers = getPricingTiers(hpp);
    const scenarios = getBEPScenarios(fixedCost, hpp, hpp);
    scenarios.forEach((scenario, i) => {
      expect(scenario.sellPrice).toBe(tiers[i].sellPrice);
    });
  });

  test('BEP per skenario konsisten dengan calculateBEP individual', () => {
    const scenarios = getBEPScenarios(fixedCost, hpp, hpp);
    scenarios.forEach((scenario) => {
      const expected = calculateBEP(fixedCost, scenario.sellPrice, hpp);
      expect(scenario.bep).toEqual(expected);
    });
  });

  test('tier premium selalu butuh unit BEP paling sedikit', () => {
    const [comp, , prem] = getBEPScenarios(fixedCost, hpp, hpp);
    expect(prem.bep.bepUnit).toBeLessThan(comp.bep.bepUnit);
  });
});

// ─── calculateDerivedHPP ─────────────────────────────────────────────────────

describe('calculateDerivedHPP', () => {
  test('mengembalikan array kosong jika outputs kosong', () => {
    expect(calculateDerivedHPP({ ingredients: [], processingCosts: [], outputs: [] })).toEqual([]);
  });

  test('alokasi proporsional berdasarkan harga jual × qty', () => {
    // Ayam 1 ekor Rp45.000 + potong Rp5.000 = total Rp50.000
    // Dada 250gr @Rp80/gr → revenue 20.000 | Ceker 50gr @Rp20/gr → revenue 1.000
    // totalRevenue = 21.000
    // dada: 50.000 × (20.000/21.000) / 250 = 190.48
    // ceker: 50.000 × (1.000/21.000) / 50  =  47.62
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'a1', name: 'Ayam', purchasePrice: 45_000,
          purchaseVolume: 1, unit: 'pcs', usage: 1,
        },
      }],
      processingCosts: [{ id: 'p1', name: 'Tenaga potong', price: 5_000 }],
      outputs: [
        { id: 'o1', name: 'Dada', qty: 250, unit: 'gr', sellPrice: 80 },
        { id: 'o2', name: 'Ceker', qty: 50,  unit: 'gr', sellPrice: 20 },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0].hpp).toBeCloseTo(190.48, 1);
    expect(result[1].hpp).toBeCloseTo(47.62, 1);
  });

  test('fallback ke rata per unit saat semua sellPrice = 0', () => {
    // Kopi 1000gr Rp100.000, output 850gr, sellPrice 0
    // fallback: 100.000 / 850 = 117.65
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'k1', name: 'Kopi', purchasePrice: 100_000,
          purchaseVolume: 1_000, unit: 'gr', usage: 1_000,
        },
      }],
      processingCosts: [],
      outputs: [{ id: 'o1', name: 'Bubuk', qty: 850, unit: 'gr', sellPrice: 0 }],
    });
    expect(result[0].hpp).toBeCloseTo(117.65, 1);
  });

  test('menghitung dengan benar saat ada processing costs dan satu output', () => {
    // Gula 1000gr Rp13.000 + gas Rp2.000 = Rp15.000, output simple syrup 1000ml
    // hpp = 15.000 / 1.000 = 15/ml (single output → rata per unit krn sellPrice=0)
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'g1', name: 'Gula', purchasePrice: 13_000,
          purchaseVolume: 1_000, unit: 'gr', usage: 1_000,
        },
      }],
      processingCosts: [{ id: 'p1', name: 'Gas', price: 2_000 }],
      outputs: [{ id: 'o1', name: 'Simple Syrup', qty: 1_000, unit: 'ml', sellPrice: 0 }],
    });
    expect(result[0].hpp).toBe(15);
  });

  test('menerapkan yieldFactor pada bahan baku', () => {
    // Kopi 1000gr Rp100.000 dengan susut 15% → yieldFactor 0.85
    // biaya efektif = (100.000/1.000 × 1.000) / 0.85 = 117.647...
    // output 850gr → hpp = 117.647.../850 = 138.41
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'k1', name: 'Kopi', purchasePrice: 100_000,
          purchaseVolume: 1_000, unit: 'gr', usage: 1_000,
        },
        yieldFactor: 0.85,
      }],
      processingCosts: [],
      outputs: [{ id: 'o1', name: 'Bubuk', qty: 850, unit: 'gr', sellPrice: 0 }],
    });
    expect(result[0].hpp).toBeCloseTo(138.41, 1);
  });
});
