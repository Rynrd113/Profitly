'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import { toast } from 'sonner';
import type { SavedRawIngredient } from '@/types/hpp';

const KEY = 'profitly-saved-raw-ingredients';

export function loadSavedRawIngredients(): SavedRawIngredient[] {
  return storageGet<SavedRawIngredient[]>(KEY) ?? [];
}

export function saveToRawStorage(items: SavedRawIngredient[]): void {
  storageSet(KEY, items);
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
        const idxCI = idx < 0
          ? merged.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase())
          : -1;

        const targetIdx = idx >= 0 ? idx : idxCI;

        if (targetIdx >= 0) {
          if (idxCI >= 0) {
            toast.warning(`Bahan "${item.name}" sudah ada sebagai "${merged[idxCI].name}" — data diperbarui`);
          }
          const existing = merged[targetIdx];
          const priceChanged =
            existing.purchasePrice !== item.purchasePrice ||
            existing.purchaseVolume !== item.purchaseVolume;
          let history = existing.priceHistory ?? [];
          if (priceChanged) {
            if (history.length === 0)
              history = [{ price: existing.purchasePrice, volume: existing.purchaseVolume, recordedAt: new Date().toISOString() }];
            history = [...history, { price: item.purchasePrice, volume: item.purchaseVolume, recordedAt: new Date().toISOString() }];
          }
          merged[targetIdx] = { ...existing, ...item, name: existing.name, priceHistory: history };
        } else {
          merged.push({
            ...item,
            priceHistory: [{ price: item.purchasePrice, volume: item.purchaseVolume, recordedAt: new Date().toISOString() }],
          });
        }
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

  const setStockLevel = (name: string, currentStock: number, minStock: number) => {
    setIngredients(prev => {
      const updated = prev.map(x => x.name === name ? { ...x, currentStock, minStock } : x);
      saveToRawStorage(updated);
      return updated;
    });
  };

  const deductStock = (deductions: { name: string; amount: number }[]) => {
    setIngredients(prev => {
      const updated = prev.map(x => {
        const hit = deductions.find(d => d.name === x.name);
        if (!hit || x.currentStock === undefined) return x;
        return { ...x, currentStock: Math.max(0, x.currentStock - hit.amount) };
      });
      saveToRawStorage(updated);
      return updated;
    });
  };

  const restoreStock = (restorations: { name: string; amount: number }[]) => {
    setIngredients(prev => {
      const updated = prev.map(x => {
        const hit = restorations.find(r => r.name === x.name);
        if (!hit || x.currentStock === undefined) return x;
        return { ...x, currentStock: x.currentStock + hit.amount };
      });
      saveToRawStorage(updated);
      return updated;
    });
  };

  const receiveStock = (name: string, qtyIn: number, newPrice: number, newVolume: number): boolean => {
    const stored = loadSavedRawIngredients();
    const target = stored.find(x => x.name === name);
    const priceChanged = target
      ? target.purchasePrice !== newPrice || target.purchaseVolume !== newVolume
      : false;

    setIngredients(prev => {
      const updated = prev.map(x => {
        if (x.name !== name) return x;
        const priceDiff = x.purchasePrice !== newPrice || x.purchaseVolume !== newVolume;
        const history = x.priceHistory ?? [];
        return {
          ...x,
          currentStock: (x.currentStock ?? 0) + qtyIn,
          purchasePrice: newPrice,
          purchaseVolume: newVolume,
          priceHistory: priceDiff
            ? [...history, { price: newPrice, volume: newVolume, recordedAt: new Date().toISOString() }]
            : history,
        };
      });
      saveToRawStorage(updated);
      return updated;
    });

    return priceChanged;
  };

  return { ingredients, save, remove, setStockLevel, deductStock, restoreStock, receiveStock };
}
