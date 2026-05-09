'use client';

import { useState, useEffect } from 'react';
import { uid } from '@/lib/format';
import type { SavedRecipe } from '@/types/hpp';

const STORAGE_KEY = 'profitly-saved-recipes';

export function loadSavedRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRecipe[];
  } catch {
    return [];
  }
}

export function saveToRecipeStorage(recipes: SavedRecipe[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
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

  return { recipes, save, remove };
}
