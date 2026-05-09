import { describe, test, expect, beforeEach } from 'bun:test';
import { loadSavedRawIngredients, saveToRawStorage } from './useSavedRawIngredients';
import type { SavedRawIngredient } from '@/types/hpp';

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

describe('loadSavedRawIngredients', () => {
  test('mengembalikan array kosong saat belum ada data', () => {
    expect(loadSavedRawIngredients()).toEqual([]);
  });

  test('mengembalikan array kosong saat data corrupt', () => {
    storage['profitly-saved-raw-ingredients'] = 'bukan-json';
    expect(loadSavedRawIngredients()).toEqual([]);
  });
});

describe('saveToRawStorage + loadSavedRawIngredients', () => {
  test('menyimpan dan mengambil kembali dengan benar', () => {
    const items: SavedRawIngredient[] = [
      { name: 'Kopi Arabika', purchasePrice: 135000, purchaseVolume: 1000, unit: 'gr' },
    ];
    saveToRawStorage(items);
    expect(loadSavedRawIngredients()).toEqual(items);
  });

  test('menimpa data lama dengan data baru', () => {
    saveToRawStorage([{ name: 'Lama', purchasePrice: 1000, purchaseVolume: 100, unit: 'gr' }]);
    saveToRawStorage([{ name: 'Baru', purchasePrice: 2000, purchaseVolume: 200, unit: 'ml' }]);
    expect(loadSavedRawIngredients()).toEqual([
      { name: 'Baru', purchasePrice: 2000, purchaseVolume: 200, unit: 'ml' },
    ]);
  });
});
