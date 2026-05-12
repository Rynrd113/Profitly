'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import type { DerivedIngredient } from '@/types/hpp';

const KEY = 'profitly-derived-ingredients';

export function loadDerivedIngredients(): DerivedIngredient[] {
  return storageGet<DerivedIngredient[]>(KEY) ?? [];
}

export function saveToDerivedStorage(items: DerivedIngredient[]): void {
  storageSet(KEY, items);
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
