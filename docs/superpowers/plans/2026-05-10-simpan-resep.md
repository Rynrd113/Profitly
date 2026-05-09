# Simpan Resep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beri user kemampuan menyimpan state kalkulator ke localStorage sebagai resep bernama, melihat riwayat resep di section bawah kalkulator, dan memuat ulang resep ke form.

**Architecture:** `useSavedRecipes` hook (pola identik `useDerivedIngredients`) menyimpan daftar resep. `RecipeHistory` merender daftar card di bawah kalkulator. `HPPCalculator` mendapat dua props baru: `onSaveRecipe` + `recipeToLoad`. State dan handler di-lift ke `page.tsx`.

**Context penting:** Plan ini dieksekusi SETELAH plan "Bahan Baku Tersimpan". Pada saat plan ini dijalankan, `HPPCalculator` sudah memiliki props `savedRawIngredients`, `onSaveRawIngredients`, `onRemoveRawIngredient` dan `page.tsx` sudah menggunakan `useSavedRawIngredients`. Semua perubahan di plan ini adalah tambahan di atas state tersebut.

**Tech Stack:** Next.js 16.2.6 App Router, TypeScript strict, Tailwind v4, Bun (bun test), localStorage.

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/hpp.ts` | Tambah `SavedRecipeIngredient`, `SavedRecipeOp`, `SavedRecipe` |
| Create | `src/hooks/useSavedRecipes.ts` | localStorage hook |
| Create | `src/hooks/useSavedRecipes.test.ts` | Tests pure functions |
| Create | `src/components/RecipeHistory.tsx` | Section riwayat resep |
| Modify | `src/components/HPPCalculator.tsx` | Props + inline save form + recipeToLoad useEffect |
| Modify | `app/calculator/page.tsx` | Lift hook, handlers, render RecipeHistory |

---

## Task 1: Tambah types resep ke `hpp.ts`

**Files:**
- Modify: `src/types/hpp.ts`

- [ ] **Step 1: Append tiga interface ke akhir `src/types/hpp.ts`**

Append setelah interface `SavedRawIngredient` yang sudah ada (atau setelah `DerivedProductOutput` jika Plan 1 belum dijalankan):

```typescript
export interface SavedRecipeIngredient {
  id: string;
  name: string;
  purchasePrice: string;
  purchaseVolume: string;
  unit: 'gr' | 'ml' | 'pcs';
  usage: string;
  yieldFactor: string;
  isDerived?: boolean;
}

export interface SavedRecipeOp {
  id: string;
  name: string;
  price: string;
  usage: string;
}

export interface SavedRecipe {
  id: string;
  name: string;
  savedAt: string;                       // ISO date string
  mode: 'satuan' | 'batch';
  ingredients: SavedRecipeIngredient[];
  ops: SavedRecipeOp[];
  batchSize: string;
  fixedCost: string;
  hpp: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/hpp.ts
git commit -m "feat: add SavedRecipe types"
```

---

## Task 2: `useSavedRecipes` hook (TDD)

**Files:**
- Create: `src/hooks/useSavedRecipes.ts`
- Create: `src/hooks/useSavedRecipes.test.ts`

- [ ] **Step 1: Tulis failing tests — buat `src/hooks/useSavedRecipes.test.ts`**

```typescript
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
```

- [ ] **Step 2: Jalankan tests untuk verifikasi gagal**

```bash
bun test src/hooks/useSavedRecipes.test.ts
```

Expected: FAIL dengan "Cannot find module".

- [ ] **Step 3: Implementasi `src/hooks/useSavedRecipes.ts`**

```typescript
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
```

- [ ] **Step 4: Jalankan tests untuk verifikasi lulus**

```bash
bun test src/hooks/useSavedRecipes.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Jalankan full test suite**

```bash
bun test
```

Expected: semua tests pass (jumlah tergantung apakah Plan 1 sudah dieksekusi).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSavedRecipes.ts src/hooks/useSavedRecipes.test.ts
git commit -m "feat: add useSavedRecipes hook with localStorage persistence"
```

---

## Task 3: `RecipeHistory` component

**Files:**
- Create: `src/components/RecipeHistory.tsx`

- [ ] **Step 1: Buat `src/components/RecipeHistory.tsx`**

```typescript
'use client';

import { Trash2 } from 'lucide-react';
import type { SavedRecipe } from '@/types/hpp';
import { formatRp } from '@/lib/format';

interface RecipeHistoryProps {
  recipes: SavedRecipe[];
  onLoad: (recipe: SavedRecipe) => void;
  onRemove: (id: string) => void;
}

function formatDate(isoStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoStr));
}

export function RecipeHistory({ recipes, onLoad, onRemove }: RecipeHistoryProps) {
  if (recipes.length === 0) return null;

  return (
    <div className="mt-6">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
        Riwayat Resep
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recipes.map(recipe => (
          <div key={recipe.id} className="bg-white rounded-2xl border border-[#E5E3DD] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="font-medium text-[#1A1A18] text-sm leading-snug">{recipe.name}</p>
              <span className="text-[11px] text-[#78716C] shrink-0 whitespace-nowrap">
                {formatDate(recipe.savedAt)}
              </span>
            </div>
            <p className="text-[11px] text-[#78716C] mb-0.5">
              {recipe.mode === 'satuan'
                ? `Satuan · HPP ${formatRp(recipe.hpp)}`
                : `Batch ${recipe.batchSize} cup · HPP ${formatRp(recipe.hpp)}/cup`
              }
            </p>
            <p className="text-[11px] text-[#78716C] mb-3">
              {recipe.ingredients.length} bahan · {recipe.ops.length} biaya
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onLoad(recipe)}
                className="text-sm px-3 py-1.5 rounded-xl border border-[#1A6B3C] text-[#1A6B3C]
                  hover:bg-[#ECFDF5] transition-colors font-medium"
              >
                Muat
              </button>
              <button
                type="button"
                onClick={() => onRemove(recipe.id)}
                className="text-[#C4BFBA] hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RecipeHistory.tsx
git commit -m "feat: add RecipeHistory component"
```

---

## Task 4: Update `HPPCalculator`

**Files:**
- Modify: `src/components/HPPCalculator.tsx`

Catatan: Saat plan ini dieksekusi, HPPCalculator sudah dimodifikasi oleh plan "Bahan Baku Tersimpan" dan memiliki props `savedRawIngredients`, `onSaveRawIngredients`, `onRemoveRawIngredient` serta handler `handleSelectSaved` dan `handleSaveToKatalog`. Semua perubahan di bawah adalah TAMBAHAN di atas state tersebut.

- [ ] **Step 1: Update imports**

Pada baris import lucide-react, tambahkan `History`:

```typescript
import { Package, Zap, SlidersHorizontal, ChevronDown, Trash2, BookmarkPlus, History } from 'lucide-react';
```

Pada baris import types, tambahkan `SavedRecipeIngredient`, `SavedRecipeOp`, `SavedRecipe`:

```typescript
import type { Ingredient, OperationalCost, DerivedIngredient, SavedRawIngredient, SavedRecipeIngredient, SavedRecipeOp, SavedRecipe } from '@/types/hpp';
```

- [ ] **Step 2: Tambah dua props baru ke function signature**

Cari function signature HPPCalculator yang saat ini memiliki bentuk:

```typescript
export function HPPCalculator({
  mode,
  derivedIngredients,
  savedRawIngredients,
  onSaveRawIngredients,
  onRemoveRawIngredient,
}: {
  mode: Exclude<CalcMode, 'turunan'>;
  derivedIngredients: DerivedIngredient[];
  savedRawIngredients: SavedRawIngredient[];
  onSaveRawIngredients: (items: SavedRawIngredient[]) => void;
  onRemoveRawIngredient: (name: string) => void;
}) {
```

Ganti menjadi:

```typescript
export function HPPCalculator({
  mode,
  derivedIngredients,
  savedRawIngredients,
  onSaveRawIngredients,
  onRemoveRawIngredient,
  onSaveRecipe,
  recipeToLoad,
}: {
  mode: Exclude<CalcMode, 'turunan'>;
  derivedIngredients: DerivedIngredient[];
  savedRawIngredients: SavedRawIngredient[];
  onSaveRawIngredients: (items: SavedRawIngredient[]) => void;
  onRemoveRawIngredient: (name: string) => void;
  onSaveRecipe: (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => void;
  recipeToLoad: SavedRecipe | null;
}) {
```

- [ ] **Step 3: Tambah state baru**

Di dalam body fungsi, setelah baris `const [showDerivedPicker, setShowDerivedPicker] = useState(false);`, tambahkan:

```typescript
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
```

- [ ] **Step 4: Tambah useEffect untuk `recipeToLoad`**

Setelah useEffect untuk pickerRef (click-outside), tambahkan:

```typescript
  useEffect(() => {
    if (!recipeToLoad) return;
    setIngredients(recipeToLoad.ingredients);
    setOps(recipeToLoad.ops);
    setBatchSize(recipeToLoad.batchSize);
    setFixedCost(recipeToLoad.fixedCost);
  }, [recipeToLoad]);
```

- [ ] **Step 5: Tambah handler functions**

Setelah `handleSaveToKatalog`, tambahkan:

```typescript
  const handleClickSave = () => {
    const defaultName = ingredients.find(r => r.name.trim())?.name ?? 'Resep baru';
    setSavedName(defaultName);
    setShowSaveForm(true);
  };

  const handleConfirmSave = () => {
    if (!result) return;
    onSaveRecipe({
      name: savedName.trim() || 'Resep baru',
      mode,
      ingredients: ingredients as SavedRecipeIngredient[],
      ops: ops as SavedRecipeOp[],
      batchSize,
      fixedCost,
      hpp: result.hpp,
    });
    setShowSaveForm(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };
```

- [ ] **Step 6: Tambah UI "Simpan ke Riwayat" di bawah Parameter Produksi**

Di dalam JSX, di `<div className="space-y-5">`, tambahkan tepat setelah `</section>` penutup section Parameter Produksi dan sebelum `</div>` penutup div kiri:

```typescript
        {result !== null && (
          <div className="flex items-center gap-3">
            {!showSaveForm && !saveSuccess && (
              <button
                type="button"
                onClick={handleClickSave}
                className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                  hover:text-[#1A6B3C] transition-colors"
              >
                <History size={14} />
                Simpan ke Riwayat
              </button>
            )}
            {saveSuccess && (
              <span className="text-sm font-medium text-[#1A6B3C]">✓ Tersimpan</span>
            )}
            {showSaveForm && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={savedName}
                  onChange={e => setSavedName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmSave();
                    if (e.key === 'Escape') setShowSaveForm(false);
                  }}
                  placeholder="Nama resep..."
                  autoFocus
                  className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-1.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] w-48"
                />
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="px-3 py-1.5 bg-[#1A6B3C] text-white text-sm font-medium
                    rounded-xl hover:bg-[#15593A] transition-colors"
                >
                  Simpan
                </button>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 7: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: hanya error pre-existing, tidak ada error baru.

- [ ] **Step 8: Commit**

```bash
git add src/components/HPPCalculator.tsx
git commit -m "feat: add simpan ke riwayat button and recipeToLoad restore to HPPCalculator"
```

---

## Task 5: Update `page.tsx`

**Files:**
- Modify: `app/calculator/page.tsx`

Pada saat plan ini dieksekusi, `page.tsx` sudah memiliki `useSavedRawIngredients` dan props katalog wired ke kedua kalkulator. Rewrite seluruh file dengan konten final di bawah.

- [ ] **Step 1: Rewrite `app/calculator/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { ChefHat } from 'lucide-react';
import { ModeSelectorCards, type CalcMode } from '@/components/ModeSelectorCards';
import { HPPCalculator } from '@/components/HPPCalculator';
import { TurunanCalculator } from '@/components/TurunanCalculator';
import { useDerivedIngredients } from '@/hooks/useDerivedIngredients';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { RecipeHistory } from '@/components/RecipeHistory';
import type { SavedRecipe } from '@/types/hpp';

export default function CalculatorPage() {
  const [activeMode, setActiveMode] = useState<CalcMode>('satuan');
  const { ingredients: derivedIngredients, save, remove } = useDerivedIngredients();
  const {
    ingredients: savedRawIngredients,
    save: saveRawIngredients,
    remove: removeRawIngredient,
  } = useSavedRawIngredients();
  const { recipes: savedRecipes, save: saveRecipe, remove: removeRecipe } = useSavedRecipes();
  const [recipeToLoad, setRecipeToLoad] = useState<SavedRecipe | null>(null);

  useEffect(() => {
    if (recipeToLoad) setRecipeToLoad(null);
  }, [recipeToLoad]);

  const handleSaveRecipe = (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => {
    saveRecipe(data);
  };

  const handleLoadRecipe = (recipe: SavedRecipe) => {
    setActiveMode(recipe.mode);
    setRecipeToLoad(recipe);
  };

  return (
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E5E3DD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1A6B3C] flex items-center justify-center">
              <ChefHat size={15} color="white" />
            </div>
            <span
              className="font-bold text-[#1A1A18] text-lg tracking-tight"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              ProfitLy
            </span>
          </div>
          <span className="text-xs text-[#9CA3AF] bg-[#F8F7F2] border border-[#E5E3DD]
            px-3 py-1 rounded-full font-medium">
            Kalkulator HPP
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <ModeSelectorCards activeMode={activeMode} onChange={setActiveMode} />

        <div className={activeMode === 'turunan' ? 'hidden' : ''}>
          <HPPCalculator
            mode={activeMode === 'batch' ? 'batch' : 'satuan'}
            derivedIngredients={derivedIngredients}
            savedRawIngredients={savedRawIngredients}
            onSaveRawIngredients={saveRawIngredients}
            onRemoveRawIngredient={removeRawIngredient}
            onSaveRecipe={handleSaveRecipe}
            recipeToLoad={recipeToLoad}
          />
        </div>
        <div className={activeMode !== 'turunan' ? 'hidden' : ''}>
          <TurunanCalculator
            derivedIngredients={derivedIngredients}
            onSave={save}
            onRemove={remove}
            savedRawIngredients={savedRawIngredients}
            onSaveRawIngredients={saveRawIngredients}
            onRemoveRawIngredient={removeRawIngredient}
          />
        </div>
        <RecipeHistory
          recipes={savedRecipes}
          onLoad={handleLoadRecipe}
          onRemove={removeRecipe}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Jalankan full test suite**

```bash
bun test
```

Expected: semua tests pass.

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: hanya error pre-existing, tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add app/calculator/page.tsx
git commit -m "feat: lift useSavedRecipes to page, wire recipe save/load, render RecipeHistory"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `SavedRecipeIngredient`, `SavedRecipeOp`, `SavedRecipe` types (Task 1)
- ✅ `useSavedRecipes` hook — save adds id+savedAt, sorted newest first (Task 2)
- ✅ `RecipeHistory` — grid card per resep, formatDate id-ID, Muat + Hapus (Task 3)
- ✅ Tombol "Simpan ke Riwayat" hanya tampil saat `result !== null` (Task 4)
- ✅ Inline mini-form dengan default name dari bahan pertama / "Resep baru" (Task 4)
- ✅ "✓ Tersimpan" feedback 1.5 detik setelah simpan (Task 4)
- ✅ Enter/Escape keyboard pada mini-form (Task 4)
- ✅ `recipeToLoad` useEffect — restore ingredients, ops, batchSize, fixedCost (Task 4)
- ✅ `handleLoadRecipe` setActiveMode + setRecipeToLoad (Task 5)
- ✅ `useEffect` reset recipeToLoad ke null setelah satu render cycle (Task 5)
- ✅ `RecipeHistory` dirender di bawah kedua calculator div (Task 5)

**Type consistency:**
- `SavedRecipeIngredient` shape identik dengan `IngredientRow` (string fields) → cast `ingredients as SavedRecipeIngredient[]` valid
- `SavedRecipeOp` shape identik dengan `OperationalRow` → cast `ops as SavedRecipeOp[]` valid
- `onSaveRecipe: (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => void` → `useSavedRecipes.save(data)` — konsisten
- `onLoad: (recipe: SavedRecipe) => void` di RecipeHistory → `handleLoadRecipe` — konsisten
