'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from 'sonner';
import type { SavedRawIngredient } from '@/types/hpp';

const KEY = 'profitly-saved-raw-ingredients';

function b64encode(data: unknown): string {
  try { return btoa(encodeURIComponent(JSON.stringify(data))); } catch { return JSON.stringify(data); }
}
function b64decode<T>(raw: string): T {
  try { return JSON.parse(decodeURIComponent(atob(raw))) as T; }
  catch { return JSON.parse(raw) as T; }
}

const storage = createJSONStorage<{ ingredients: SavedRawIngredient[] }>(() => ({
  getItem: (k) => {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    try { return b64decode<string>(raw); } catch { return null; }
  },
  setItem: (k, v) => localStorage.setItem(k, b64encode(v)),
  removeItem: (k) => localStorage.removeItem(k),
}));

interface IngredientState {
  ingredients: SavedRawIngredient[];
  upsert: (items: SavedRawIngredient[]) => void;
  remove: (name: string) => void;
  setStockLevel: (name: string, current: number, min: number) => void;
  deductStock: (deductions: { name: string; amount: number }[]) => void;
  restoreStock: (restorations: { name: string; amount: number }[]) => void;
  receiveStock: (name: string, qty: number, price: number, volume: number) => boolean;
}

export const useIngredientStore = create<IngredientState>()(
  persist(
    (set, get) => ({
      ingredients: [],

      upsert: (newItems) => set(state => {
        const merged = [...state.ingredients];
        for (const item of newItems) {
          const idx = merged.findIndex(x => x.name === item.name);
          const idxCI = idx < 0
            ? merged.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase())
            : -1;
          const target = idx >= 0 ? idx : idxCI;

          if (target >= 0) {
            if (idxCI >= 0)
              toast.warning(`"${item.name}" sudah ada sebagai "${merged[idxCI].name}" — diperbarui`);
            const ex = merged[target];
            const priceChanged = ex.purchasePrice !== item.purchasePrice || ex.purchaseVolume !== item.purchaseVolume;
            let history = ex.priceHistory ?? [];
            if (priceChanged) {
              if (!history.length) history = [{ price: ex.purchasePrice, volume: ex.purchaseVolume, recordedAt: new Date().toISOString() }];
              history = [...history, { price: item.purchasePrice, volume: item.purchaseVolume, recordedAt: new Date().toISOString() }];
            }
            merged[target] = { ...ex, ...item, name: ex.name, priceHistory: history };
          } else {
            merged.push({ ...item, priceHistory: [{ price: item.purchasePrice, volume: item.purchaseVolume, recordedAt: new Date().toISOString() }] });
          }
        }
        return { ingredients: merged };
      }),

      remove: (name) => set(s => ({ ingredients: s.ingredients.filter(x => x.name !== name) })),

      setStockLevel: (name, current, min) => set(s => ({
        ingredients: s.ingredients.map(x => x.name === name ? { ...x, currentStock: current, minStock: min } : x),
      })),

      deductStock: (deductions) => set(s => ({
        ingredients: s.ingredients.map(x => {
          const hit = deductions.find(d => d.name === x.name);
          if (!hit || x.currentStock === undefined) return x;
          return { ...x, currentStock: Math.max(0, x.currentStock - hit.amount) };
        }),
      })),

      restoreStock: (restorations) => set(s => ({
        ingredients: s.ingredients.map(x => {
          const hit = restorations.find(r => r.name === x.name);
          if (!hit || x.currentStock === undefined) return x;
          return { ...x, currentStock: x.currentStock + hit.amount };
        }),
      })),

      receiveStock: (name, qty, price, volume) => {
        const { ingredients } = get();
        const target = ingredients.find(x => x.name === name);
        const priceChanged = target
          ? target.purchasePrice !== price || target.purchaseVolume !== volume
          : false;

        set(s => ({
          ingredients: s.ingredients.map(x => {
            if (x.name !== name) return x;
            const priceDiff = x.purchasePrice !== price || x.purchaseVolume !== volume;
            const hist = x.priceHistory ?? [];
            return {
              ...x,
              currentStock: (x.currentStock ?? 0) + qty,
              purchasePrice: price,
              purchaseVolume: volume,
              priceHistory: priceDiff
                ? [...hist, { price, volume, recordedAt: new Date().toISOString() }]
                : hist,
            };
          }),
        }));

        return priceChanged;
      },
    }),
    { name: KEY, storage },
  ),
);
