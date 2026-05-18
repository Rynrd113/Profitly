'use client';

import { useIngredientStore } from '@/store/ingredientStore';
import { toast } from 'sonner';

export function useInventoryStore() {
  const { ingredients, deductStock: baseDeduct } = useIngredientStore();

  const reduceStock = (items: Array<{ id: string; amount: number }>) => {
    baseDeduct(items.map(({ id, amount }) => ({ name: id, amount })));

    const after = useIngredientStore.getState().ingredients;
    for (const { id } of items) {
      const ing = after.find(x => x.name === id);
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
