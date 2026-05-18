/**
 * Stock Domain — pure inventory logic, no I/O or framework deps.
 */

export interface StockItem {
  name: string;
  currentStock: number;
  minStock: number;
  purchasePrice: number;
  purchaseVolume: number;
  unit: string;
}

export type StockStatus = 'aman' | 'menipis' | 'habis' | 'belum_diatur';

/** Determine stock status for a single item. */
export function stockStatus(item: Pick<StockItem, 'currentStock' | 'minStock'>): StockStatus {
  if (item.currentStock === undefined || item.minStock === undefined) return 'belum_diatur';
  if (item.currentStock === 0) return 'habis';
  if (item.currentStock < item.minStock) return 'menipis';
  return 'aman';
}

/**
 * Total inventory valuation across all tracked items.
 * Items without currentStock are excluded.
 */
export function totalInventoryValue(items: StockItem[]): number {
  return items.reduce((sum, item) => {
    if (item.currentStock === undefined || item.purchaseVolume === 0) return sum;
    const ppu = item.purchasePrice / item.purchaseVolume;
    return sum + ppu * item.currentStock;
  }, 0);
}

/**
 * Apply deductions to a stock list.
 * Returns a new array (immutable). Stock floors at 0.
 */
export function applyDeductions(
  items: StockItem[],
  deductions: { name: string; amount: number }[],
): StockItem[] {
  return items.map(item => {
    const hit = deductions.find(d => d.name === item.name);
    if (!hit) return item;
    return { ...item, currentStock: Math.max(0, item.currentStock - hit.amount) };
  });
}

/**
 * Items whose stock is at or below their minStock threshold.
 */
export function lowStockItems(items: StockItem[]): StockItem[] {
  return items.filter(
    i => i.currentStock !== undefined && i.minStock !== undefined && i.currentStock < i.minStock,
  );
}
