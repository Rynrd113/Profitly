'use client';

import { useState, useEffect } from 'react';
import type { DerivedIngredient } from '@/types/hpp';

const STORAGE_KEY = 'profitly-derived-ingredients';

export function loadDerivedIngredients(): DerivedIngredient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DerivedIngredient[];
  } catch {
    return [];
  }
}

export function saveToDerivedStorage(items: DerivedIngredient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useDerivedIngredients() {
  const [ingredients, setIngredients] = useState<DerivedIngredient[]>([]);

  useEffect(() => {
    setIngredients(loadDerivedIngredients());
  }, []);

  const save = (newItems: DerivedIngredient[]) => {
    setIngredients(prev => {
      const merged = [...prev];
      for (const item of newItems) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      }
      saveToDerivedStorage(merged);
      return merged;
    });
  };

  const remove = (id: string) => {
    setIngredients(prev => {
      const updated = prev.filter(x => x.id !== id);
      saveToDerivedStorage(updated);
      return updated;
    });
  };

  return { ingredients, save, remove };
}
