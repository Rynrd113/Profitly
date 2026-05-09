import { describe, test, expect, beforeEach } from 'bun:test';
import { loadSavedRecipes, saveToRecipeStorage } from './useSavedRecipes';
import type { SavedRecipe } from '@/types/hpp';

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

const sample: SavedRecipe = {
  id: 'r1',
  name: 'Kopi Arabika',
  savedAt: '2026-05-10T07:00:00.000Z',
  mode: 'satuan',
  ingredients: [],
  ops: [],
  batchSize: '50',
  fixedCost: '5000000',
  hpp: 8750,
};

describe('loadSavedRecipes', () => {
  test('mengembalikan array kosong saat belum ada data', () => {
    expect(loadSavedRecipes()).toEqual([]);
  });

  test('mengembalikan array kosong saat data corrupt', () => {
    storage['profitly-saved-recipes'] = 'bukan-json';
    expect(loadSavedRecipes()).toEqual([]);
  });
});

describe('saveToRecipeStorage + loadSavedRecipes', () => {
  test('menyimpan dan mengambil kembali dengan benar', () => {
    saveToRecipeStorage([sample]);
    expect(loadSavedRecipes()).toEqual([sample]);
  });

  test('menimpa data lama dengan data baru', () => {
    saveToRecipeStorage([sample]);
    const newer = { ...sample, id: 'r2', name: 'Es Teh' };
    saveToRecipeStorage([newer]);
    expect(loadSavedRecipes()).toEqual([newer]);
  });
});
