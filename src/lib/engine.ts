import type { Ingredient, OperationalCost, PricingTier, ProcessingCost, DerivedProductOutput } from '@/types/hpp';
import { roundToThousand } from '@/lib/format';

export interface PricingTiers {
  competitive: number; // Margin 20%
  standard: number;    // Margin 35%
  premium: number;     // Margin 50%
}

// Avoid floating point drift by rounding to N decimal places
function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}


/**
 * Hitung biaya satu bahan baku untuk satu resep.
 *
 * yieldFactor (0–1): efisiensi bahan setelah shrinkage/wastage.
 * Contoh: bawang 500gr beli, setelah dikupas jadi 400gr → yieldFactor = 0.8
 * Maka butuh bahan lebih banyak, sehingga cost dibagi yieldFactor.
 */
export function calculateIngredientCost(
  ingredient: Ingredient,
  yieldFactor: number = 1
): number {
  if (ingredient.purchaseVolume === 0) return 0;
  if (yieldFactor <= 0 || yieldFactor > 1) {
    throw new RangeError(`yieldFactor harus antara 0 (eksklusif) dan 1, dapat: ${yieldFactor}`);
  }

  const pricePerUnit = round(ingredient.purchasePrice / ingredient.purchaseVolume, 6);
  return round((pricePerUnit * ingredient.usage) / yieldFactor);
}

/**
 * Hitung total HPP per unit output (misal: per cup).
 *
 * - ingredients: daftar bahan beserta yieldFactor masing-masing
 * - operationalCosts: biaya operasional; usage = porsi yang dibebankan (0–1)
 * - totalOutput: jumlah cup/porsi yang dihasilkan dari satu batch
 */
export function calculateTotalHPP(
  ingredients: Array<{ ingredient: Ingredient; yieldFactor?: number }>,
  operationalCosts: OperationalCost[],
  totalOutput: number
): number {
  if (totalOutput <= 0) throw new RangeError('totalOutput harus lebih dari 0');

  const totalIngredientCost = ingredients.reduce((sum, { ingredient, yieldFactor }) => {
    return sum + calculateIngredientCost(ingredient, yieldFactor);
  }, 0);

  const totalOperationalCost = operationalCosts.reduce((sum, op) => {
    return sum + op.price * op.usage;
  }, 0);

  return round((totalIngredientCost + totalOperationalCost) / totalOutput);
}

const TIER_DEFINITIONS = [
  { label: 'competitive', margin: 0.20 },
  { label: 'standard',    margin: 0.35 },
  { label: 'premium',     margin: 0.50 },
] as const;

/**
 * Hitung 3 tier harga jual berdasarkan HPP.
 * Harga dibulatkan ke atas ke kelipatan 500 terdekat.
 *
 * Formula: hargaJual = HPP / (1 - marginDecimal)
 */
export function getPricingTiers(hpp: number): PricingTier[] {
  if (hpp <= 0) throw new RangeError('HPP harus lebih dari 0');

  return TIER_DEFINITIONS.map(({ label, margin }) => {
    const sellPrice = roundToThousand(hpp / (1 - margin));
    return {
      label,
      margin,
      sellPrice,
      profit: round(sellPrice - hpp),
    };
  });
}

/** Convenience: ambil harga satu tier tertentu. */
export function getTierPrice(hpp: number, tier: PricingTier['label']): number {
  const found = getPricingTiers(hpp).find((t) => t.label === tier);
  if (!found) throw new Error(`Tier tidak dikenal: ${tier}`);
  return found.sellPrice;
}

// ─── BEP & Skenario ──────────────────────────────────────────────────────────

export interface BEPResult {
  contributionMargin: number; // Harga Jual - Variable Cost (per unit)
  bepUnit: number;            // Titik impas dalam satuan porsi
  bepRevenue: number;         // Titik impas dalam Rupiah
}

export interface BEPScenario {
  tier: PricingTier['label'];
  sellPrice: number;
  bep: BEPResult;
}

/**
 * Hitung titik impas (Break Even Point) untuk satu harga jual.
 *
 * - fixedCost   : total biaya tetap bulanan (sewa, gaji, listrik, dsb.)
 * - sellPrice   : harga jual per porsi
 * - variableCost: HPP per porsi (hasil calculateTotalHPP)
 */
export function calculateBEP(
  fixedCost: number,
  sellPrice: number,
  variableCost: number
): BEPResult {
  if (fixedCost < 0)   throw new RangeError('fixedCost tidak boleh negatif');
  if (sellPrice <= 0)  throw new RangeError('sellPrice harus lebih dari 0');
  if (variableCost < 0) throw new RangeError('variableCost tidak boleh negatif');

  const contributionMargin = sellPrice - variableCost;
  if (contributionMargin <= 0) {
    throw new RangeError('Harga jual harus lebih besar dari HPP (variable cost)');
  }

  const bepUnit    = round(fixedCost / contributionMargin, 2);
  const bepRevenue = round(bepUnit * sellPrice);

  return { contributionMargin: round(contributionMargin), bepUnit, bepRevenue };
}

/**
 * Hitung BEP untuk ketiga tier harga sekaligus.
 * Berguna untuk memperlihatkan skenario "bagaimana kalau harga naik/turun".
 *
 * - fixedCost   : total biaya tetap bulanan
 * - variableCost: HPP per porsi
 * - tiers       : hasil getPricingTiers(hpp)
 */
export function getBEPScenarios(
  fixedCost: number,
  variableCost: number,
  hpp: number
): BEPScenario[] {
  return getPricingTiers(hpp).map(({ label, sellPrice }) => ({
    tier: label,
    sellPrice,
    bep: calculateBEP(fixedCost, sellPrice, variableCost),
  }));
}

// ─── Bahan Turunan ───────────────────────────────────────────────────────────

interface DerivedHPPInput {
  ingredients: Array<{ ingredient: Ingredient; yieldFactor?: number }>;
  processingCosts: ProcessingCost[];
  outputs: Array<{ id: string; name: string; qty: number; unit: 'gr' | 'ml' | 'pcs'; sellPrice: number }>;
}

export function calculateDerivedHPP(input: DerivedHPPInput): DerivedProductOutput[] {
  const { ingredients, processingCosts, outputs } = input;
  if (outputs.length === 0) return [];

  const totalIngredientCost = ingredients.reduce(
    (sum, { ingredient, yieldFactor }) => sum + calculateIngredientCost(ingredient, yieldFactor),
    0,
  );
  const totalProcessingCost = processingCosts.reduce((sum, p) => sum + p.price, 0);
  const totalCost = totalIngredientCost + totalProcessingCost;

  const totalRevenue = outputs.reduce((sum, o) => sum + o.sellPrice * o.qty, 0);

  return outputs.map(o => {
    let hpp: number;
    if (totalRevenue === 0) {
      const totalQty = outputs.reduce((s, x) => s + x.qty, 0);
      hpp = totalQty > 0 ? round(totalCost / totalQty) : 0;
    } else {
      const share = (o.sellPrice * o.qty) / totalRevenue;
      hpp = o.qty > 0 ? round((totalCost * share) / o.qty) : 0;
    }
    return { ...o, hpp };
  });
}
