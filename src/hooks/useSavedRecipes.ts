'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import { uid, parseNum } from '@/lib/format';
import { calculateTotalHPP } from '@/lib/engine';
import type { Ingredient, OperationalCost, SavedRecipe } from '@/types/hpp';

const KEY = 'profitly-saved-recipes';

export function loadSavedRecipes(): SavedRecipe[] {
  return storageGet<SavedRecipe[]>(KEY) ?? [];
}

export function saveToRecipeStorage(recipes: SavedRecipe[]): void {
  storageSet(KEY, recipes);
}

export function useSavedRecipes() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);

  useEffect(() => {
    const loaded = loadSavedRecipes();
    setRecipes(loaded.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
  }, []);

  const save = (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => {
    setRecipes(prev => {
      const newRecipe: SavedRecipe = {
        ...data,
        id: uid(),
        savedAt: new Date().toISOString(),
      };
      const updated = [newRecipe, ...prev].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      saveToRecipeStorage(updated);
      return updated;
    });
  };

  const remove = (id: string) => {
    setRecipes(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveToRecipeStorage(updated);
      return updated;
    });
  };

  const recomputeHPPForIngredient = (ingredientName: string, newPrice: number, newVolume: number) => {
    setRecipes(prev => {
      const updated = prev.map(recipe => {
        const isAffected = recipe.ingredients.some(ing => ing.name === ingredientName && !ing.isDerived);
        if (!isAffected) return recipe;

        const totalOutput = recipe.mode === 'batch' ? Math.max(1, parseNum(recipe.batchSize)) : 1;

        const updatedIngredients = recipe.ingredients.map(ing =>
          (ing.name === ingredientName && !ing.isDerived)
            ? { ...ing, purchasePrice: String(newPrice), purchaseVolume: String(newVolume) }
            : ing
        );

        const ingredients: Array<{ ingredient: Ingredient; yieldFactor: number }> = updatedIngredients
          .filter(ing => !ing.isDerived)
          .map(ing => ({
            ingredient: {
              id: ing.id,
              name: ing.name,
              purchasePrice: parseNum(ing.purchasePrice),
              purchaseVolume: parseNum(ing.purchaseVolume),
              unit: ing.unit,
              usage: parseNum(ing.usage),
            },
            yieldFactor: Math.min(1, Math.max(0.01, parseNum(ing.yieldFactor) || 1)),
          }));

        const ops: OperationalCost[] = recipe.ops.map(op => ({
          id: op.id,
          name: op.name,
          price: parseNum(op.price),
          usage: parseNum(op.usage),
        }));

        let newHPP = recipe.hpp;
        try {
          newHPP = calculateTotalHPP(ingredients, ops, totalOutput);
        } catch { /* keep existing if calc fails */ }

        return { ...recipe, ingredients: updatedIngredients, hpp: newHPP };
      });
      saveToRecipeStorage(updated);
      return updated;
    });
  };

  const patchRecipe = (id: string, patch: Partial<SavedRecipe>) => {
    setRecipes(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...patch } : r);
      saveToRecipeStorage(updated);
      return updated;
    });
  };

  return { recipes, save, remove, recomputeHPPForIngredient, patchRecipe };
}
