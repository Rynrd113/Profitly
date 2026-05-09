import { describe, test, expect, beforeEach } from 'bun:test';
import { loadDerivedIngredients, saveToDerivedStorage } from './useDerivedIngredients';
import type { DerivedIngredient } from '@/types/hpp';

const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  length: 0,
  key: () => null,
} as unknown as Storage;

beforeEach(() => {
  Object.keys(storage).forEach(k => delete storage[k]);
});

describe('loadDerivedIngredients', () => {
  test('mengembalikan array kosong saat belum ada data', () => {
    expect(loadDerivedIngredients()).toEqual([]);
  });

  test('mengembalikan array kosong saat data corrupt', () => {
    storage['profitly-derived-ingredients'] = 'bukan-json';
    expect(loadDerivedIngredients()).toEqual([]);
  });
});

describe('saveToDerivedStorage + loadDerivedIngredients', () => {
  test('menyimpan dan mengambil kembali dengan benar', () => {
    const items: DerivedIngredient[] = [
      { id: '1', name: 'Bubuk Kopi', unit: 'gr', costPerUnit: 159 },
      { id: '2', name: 'Simple Syrup', unit: 'ml', costPerUnit: 12 },
    ];
    saveToDerivedStorage(items);
    expect(loadDerivedIngredients()).toEqual(items);
  });

  test('menimpa data lama dengan data baru', () => {
    saveToDerivedStorage([{ id: '1', name: 'Lama', unit: 'gr', costPerUnit: 100 }]);
    saveToDerivedStorage([{ id: '2', name: 'Baru', unit: 'ml', costPerUnit: 50 }]);
    expect(loadDerivedIngredients()).toEqual([{ id: '2', name: 'Baru', unit: 'ml', costPerUnit: 50 }]);
  });
});
