/**
 * HPP Domain — pure calculation functions, no I/O or framework deps.
 * All functions are deterministic and testable with bun test.
 */

export type Unit = 'gr' | 'ml' | 'pcs';
export type TierLabel = 'competitive' | 'standard' | 'premium';

export interface IngredientInput {
  purchasePrice: number;
  purchaseVolume: number;
  usage: number;
  unit: Unit;
}

export interface OpInput {
  price: number;
  /** portion allocated 0–1 */
  usage: number;
}

export interface PricingTierResult {
  label: TierLabel;
  margin: number;
  sellPrice: number;
  profit: number;
}

export interface BEPResult {
  contributionMargin: number;
  bepUnit: number;
  bepRevenue: number;
}

const TIER_DEFS: { label: TierLabel; margin: number }[] = [
  { label: 'competitive', margin: 0.20 },
  { label: 'standard',    margin: 0.35 },
  { label: 'premium',     margin: 0.50 },
];

function r(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Round up to nearest 1 000 */
export function roundUpToThousand(n: number): number {
  return Math.ceil(n / 1000) * 1000;
}

/**
 * Cost of one ingredient for one recipe unit.
 * @param yieldFactor - Efficiency after shrinkage, e.g. 0.8 means 20% waste (0 < y ≤ 1).
 */
export function ingredientCost(ing: IngredientInput, yieldFactor = 1): number {
  if (ing.purchaseVolume === 0) return 0;
  if (yieldFactor <= 0 || yieldFactor > 1)
    throw new RangeError(`yieldFactor must be 0 < y ≤ 1, got ${yieldFactor}`);
  return r((r(ing.purchasePrice / ing.purchaseVolume, 6) * ing.usage) / yieldFactor);
}

/**
 * Total HPP per output unit (e.g. per cup).
 * @param totalOutput - Number of units produced from one batch.
 * @param targetSalesVolume - Monthly sales target used to amortise OpEx across units.
 */
export function totalHPP(
  ingredients: { ing: IngredientInput; yieldFactor?: number }[],
  ops: OpInput[],
  totalOutput: number,
  targetSalesVolume: number = totalOutput,
): number {
  if (totalOutput <= 0) throw new RangeError('totalOutput must be > 0');
  if (targetSalesVolume <= 0) throw new RangeError('targetSalesVolume must be > 0');
  const ingCost = ingredients.reduce((s, { ing, yieldFactor }) => s + ingredientCost(ing, yieldFactor), 0);
  const opCostAllocated = ops.reduce((s, op) => s + op.price * op.usage, 0);
  return r(ingCost / totalOutput + opCostAllocated / targetSalesVolume);
}

/**
 * Three sell-price tiers from one HPP value.
 * Prices rounded up to nearest 1 000.
 */
export function pricingTiers(hpp: number): PricingTierResult[] {
  if (hpp <= 0) throw new RangeError('hpp must be > 0');
  return TIER_DEFS.map(({ label, margin }) => {
    const sellPrice = roundUpToThousand(hpp / (1 - margin));
    return { label, margin, sellPrice, profit: r(sellPrice - hpp) };
  });
}

/**
 * Break-even point for one sell price / variable cost pair.
 */
export function bep(fixedCost: number, sellPrice: number, variableCost: number): BEPResult {
  if (fixedCost < 0)     throw new RangeError('fixedCost must be ≥ 0');
  if (sellPrice <= 0)    throw new RangeError('sellPrice must be > 0');
  if (variableCost < 0)  throw new RangeError('variableCost must be ≥ 0');
  const cm = sellPrice - variableCost;
  if (cm <= 0) throw new RangeError('sellPrice must exceed variableCost');
  const bepUnit = r(fixedCost / cm, 2);
  return { contributionMargin: r(cm), bepUnit, bepRevenue: r(bepUnit * sellPrice) };
}
