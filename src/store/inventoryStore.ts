'use client';

import { useIngredientStore } from '@/store/ingredientStore';
import { useInventoryLogStore } from '@/store/inventoryLogStore';
import { toast } from 'sonner';

export function useInventoryStore() {
  const { ingredients, deductStock: baseDeduct } = useIngredientStore();

  const reduceStock = (items: Array<{ id: string; amount: number }>) => {
    baseDeduct(items.map(({ id, amount }) => ({ name: id, amount })));

    const after = useIngredientStore.getState().ingredients;
    const addLog = useInventoryLogStore.getState().addLog;
    for (const { id, amount } of items) {
      const ing = after.find(x => x.name === id);
      addLog({ ingredientId: id, type: 'OUT', amount, reason: 'Penjualan POS' });
      if (
        ing &&
        ing.currentStock !== undefined &&
        ing.minStock !== undefined &&
        ing.currentStock <= ing.minStock
      ) {
        toast.warning(`Stok "${ing.name}" tipis: ${ing.currentStock} ${ing.unit} (min: ${ing.minStock})`);
      }
    }
  };

  const deductIngredients = (items: Array<{ id: string; amount: number }>) => reduceStock(items);

  return { ingredients, reduceStock, deductIngredients };
}
