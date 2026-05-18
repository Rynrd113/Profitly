'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid, parseNum } from '@/lib/format';
import { calculateTotalHPP } from '@/lib/engine';
import type { Ingredient, OperationalCost, SavedRecipe } from '@/types/hpp';

const KEY = 'profitly-saved-recipes';

function b64(data: unknown) {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); } catch { return JSON.stringify(data); }
}
function db64<T>(raw: string): T {
  try { return JSON.parse(decodeURIComponent(atob(raw))) as T; }
  catch { return JSON.parse(raw) as T; }
}

const storage = createJSONStorage<{ recipes: SavedRecipe[] }>(() => ({
  getItem: (k) => { const r = localStorage.getItem(k); return r ? db64<string>(r) : null; },
  setItem: (k, v) => localStorage.setItem(k, b64(v)),
  removeItem: (k) => localStorage.removeItem(k),
}));

interface RecipeState {
  recipes: SavedRecipe[];
  save: (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => void;
  remove: (id: string) => void;
  recomputeHPP: (ingredientName: string, newPrice: number, newVolume: number) => void;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set) => ({
      recipes: [],

      save: (data) => set(s => {
        const recipe: SavedRecipe = { ...data, id: uid(), savedAt: new Date().toISOString() };
        const updated = [recipe, ...s.recipes].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        return { recipes: updated };
      }),

      remove: (id) => set(s => ({ recipes: s.recipes.filter(r => r.id !== id) })),

      recomputeHPP: (ingredientName, newPrice, newVolume) => set(s => ({
        recipes: s.recipes.map(recipe => {
          if (!recipe.ingredients.some(i => i.name === ingredientName && !i.isDerived)) return recipe;
          const totalOutput = recipe.mode === 'batch' ? Math.max(1, parseNum(recipe.batchSize)) : 1;
          const updatedIngs = recipe.ingredients.map(i =>
            i.name === ingredientName && !i.isDerived
              ? { ...i, purchasePrice: String(newPrice), purchaseVolume: String(newVolume) }
              : i
          );
          const ings: { ingredient: Ingredient; yieldFactor: number }[] = updatedIngs
            .filter(i => !i.isDerived)
            .map(i => ({
              ingredient: { id: i.id, name: i.name, purchasePrice: parseNum(i.purchasePrice), purchaseVolume: parseNum(i.purchaseVolume), unit: i.unit, usage: parseNum(i.usage) },
              yieldFactor: Math.min(1, Math.max(0.01, parseNum(i.yieldFactor) || 1)),
            }));
          const ops: OperationalCost[] = recipe.ops.map(op => ({ id: op.id, name: op.name, price: parseNum(op.price), usage: parseNum(op.usage) }));
          let hpp = recipe.hpp;
          try { hpp = calculateTotalHPP(ings, ops, totalOutput); } catch { /* keep existing */ }
          return { ...recipe, ingredients: updatedIngs, hpp };
        }),
      })),
    }),
    { name: KEY, storage },
  ),
);
