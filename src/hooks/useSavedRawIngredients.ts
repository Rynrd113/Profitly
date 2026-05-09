'use client';

import { useState, useEffect } from 'react';
import type { SavedRawIngredient } from '@/types/hpp';

const STORAGE_KEY = 'profitly-saved-raw-ingredients';

export function loadSavedRawIngredients(): SavedRawIngredient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRawIngredient[];
  } catch {
    return [];
  }
}

export function saveToRawStorage(items: SavedRawIngredient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useSavedRawIngredients() {
  const [ingredients, setIngredients] = useState<SavedRawIngredient[]>([]);

  useEffect(() => {
    setIngredients(loadSavedRawIngredients());
  }, []);

  const save = (newItems: SavedRawIngredient[]) => {
    setIngredients(prev => {
      const merged = [...prev];
      for (const item of newItems) {
        const idx = merged.findIndex(x => x.name === item.name);
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      }
      saveToRawStorage(merged);
      return merged;
    });
  };

  const remove = (name: string) => {
    setIngredients(prev => {
      const updated = prev.filter(x => x.name !== name);
      saveToRawStorage(updated);
      return updated;
    });
  };

  return { ingredients, save, remove };
}
