import type { SavedRawIngredient } from '@/types/hpp';
import type { Supplier } from '@/types/inventory';

export interface ProcurementItem {
  ingredient: SavedRawIngredient;
  currentStock: number;
  minStock: number;
  deficit: number;
}

export interface SupplierGroup {
  supplier: Supplier | null;
  items: ProcurementItem[];
}

export function generateShoppingList(
  inventory: SavedRawIngredient[],
  suppliers: Supplier[],
): SupplierGroup[] {
  const critical = inventory.filter(
    ing =>
      ing.currentStock !== undefined &&
      ing.minStock !== undefined &&
      ing.currentStock < ing.minStock,
  );

  const groups = new Map<string, SupplierGroup>();
  for (const supplier of suppliers) {
    groups.set(supplier.id, { supplier, items: [] });
  }
  groups.set('__unknown__', { supplier: null, items: [] });

  for (const ing of critical) {
    const item: ProcurementItem = {
      ingredient: ing,
      currentStock: ing.currentStock!,
      minStock: ing.minStock!,
      deficit: ing.minStock! - ing.currentStock!,
    };
    const matched = suppliers.find(s =>
      s.supplies.some(n => n.toLowerCase() === ing.name.toLowerCase()),
    );
    groups.get(matched ? matched.id : '__unknown__')!.items.push(item);
  }

  return Array.from(groups.values()).filter(g => g.items.length > 0);
}
