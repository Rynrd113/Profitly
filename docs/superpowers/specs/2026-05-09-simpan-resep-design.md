# Simpan Resep — Design Spec

**Date:** 2026-05-09
**Project:** ProfitLy — Kalkulator HPP F&B
**Status:** Approved

---

## Overview

Setelah HPP terhitung, user bisa menekan "Simpan ke Riwayat" untuk menyimpan seluruh state kalkulator ke localStorage beserta tanggalnya. Daftar resep tersimpan tampil sebagai section di bawah kalkulator. Tiap resep bisa dimuat ulang (restore ke form) atau dihapus.

Fitur ini hanya berlaku di **mode Satuan dan Batch** (HPPCalculator). TurunanCalculator punya sistem simpan sendiri untuk bahan turunan.

---

## Arsitektur

### File Baru

```
src/
  hooks/
    useSavedRecipes.ts          ← localStorage hook (CRUD resep)
    useSavedRecipes.test.ts     ← unit tests pure functions
  components/
    RecipeHistory.tsx           ← section riwayat di bawah kalkulator
```

### File Diubah

```
src/types/hpp.ts                ← tambah SavedRecipe, SavedRecipeIngredient, SavedRecipeOp
src/components/HPPCalculator.tsx ← tombol "Simpan ke Riwayat", props onSaveRecipe + recipeToLoad
app/calculator/page.tsx         ← lift useSavedRecipes, pass props, render RecipeHistory
```

### State di `page.tsx`

```typescript
const { recipes: savedRecipes, save: saveRecipe, remove: removeRecipe }
  = useSavedRecipes();
const [recipeToLoad, setRecipeToLoad] = useState<SavedRecipe | null>(null);
```

Props baru HPPCalculator:

```typescript
onSaveRecipe: (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => void;
recipeToLoad: SavedRecipe | null;
```

---

## Type Definitions

Ditambahkan ke `src/types/hpp.ts`:

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
  savedAt: string;                      // ISO date string
  mode: 'satuan' | 'batch';
  ingredients: SavedRecipeIngredient[]; // full form state untuk restore
  ops: SavedRecipeOp[];
  batchSize: string;
  fixedCost: string;
  hpp: number;                          // snapshot HPP saat disimpan
}
```

---

## Hook: `useSavedRecipes`

localStorage key: `'profitly-saved-recipes'`

```typescript
// src/hooks/useSavedRecipes.ts
export function loadSavedRecipes(): SavedRecipe[]
export function saveToRecipeStorage(recipes: SavedRecipe[]): void

export function useSavedRecipes() {
  // Returns: { recipes, save(data), remove(id) }
  // save: terima Omit<SavedRecipe, 'id' | 'savedAt'>, tambahkan id (uid()) + savedAt (new Date().toISOString())
  // remove: filter by id
  // recipes: diurutkan terbaru dulu (sort by savedAt descending)
}
```

---

## HPPCalculator: Tombol "Simpan ke Riwayat"

### Kondisi tampil

Tombol hanya muncul saat `result !== null` (HPP sudah terhitung). Letaknya di bawah section Parameter Produksi, sejajar kiri form.

### Flow saat diklik

1. Inline mini-form muncul:
   ```
   [ Nama resep...           ] [Simpan]
   ```
   Default value: nama bahan pertama yang `name.trim() !== ''`, fallback ke `"Resep baru"`.

2. User edit nama (opsional), klik "Simpan" atau tekan Enter.

3. `onSaveRecipe` dipanggil dengan:
   ```typescript
   {
     name,
     mode,
     ingredients,   // state saat ini
     ops,           // state saat ini
     batchSize,
     fixedCost,
     hpp: result.hpp,
   }
   ```

4. Mini-form tertutup. Teks tombol berubah sementara menjadi "✓ Tersimpan" (1.5 detik) lalu kembali normal.

### Flow muat ulang (`recipeToLoad` prop)

```typescript
useEffect(() => {
  if (!recipeToLoad) return;
  setIngredients(recipeToLoad.ingredients);
  setOps(recipeToLoad.ops);
  setBatchSize(recipeToLoad.batchSize);
  setFixedCost(recipeToLoad.fixedCost);
}, [recipeToLoad]);
```

HPPCalculator tidak memanggil callback setelah load — page.tsx reset `recipeToLoad = null` via `useEffect` setelah satu render cycle (atau segera setelah pass).

---

## RecipeHistory Component

### Props

```typescript
interface RecipeHistoryProps {
  recipes: SavedRecipe[];
  onLoad: (recipe: SavedRecipe) => void;
  onRemove: (id: string) => void;
}
```

### Tampilan

Section full-width, muncul di bawah kalkulator (di bawah `<div className="hidden/...">` wrapper). Hanya render jika `recipes.length > 0`.

```
┌──────────────────────────────────────────────────────────┐
│ RIWAYAT RESEP                                            │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Kopi Arabika Cold Brew         9 Mei 2026, 14:32   │  │
│ │ Satuan · HPP Rp 8.750          3 bahan · 2 biaya   │  │
│ │                                  [Muat]  [Hapus]   │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Es Teh Maelo                   8 Mei 2026, 10:15   │  │
│ │ Batch 50 cup · HPP Rp 3.200    2 bahan · 1 biaya   │  │
│ │                                  [Muat]  [Hapus]   │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Detail tiap card

| Elemen | Konten |
|--------|--------|
| Nama resep | `recipe.name`, font medium, `#1A1A18` |
| Tanggal | format `d MMM yyyy, HH:mm` dari `recipe.savedAt`, warna `#78716C` |
| Mode + HPP | `"Satuan · HPP Rp X"` atau `"Batch Y cup · HPP Rp X/cup"` |
| Info ringkas | `"{n} bahan · {m} biaya"` |
| Tombol Muat | hijau outline, panggil `onLoad(recipe)` |
| Tombol Hapus | ikon `Trash2`, panggil `onRemove(recipe.id)` |

**Urutan:** terbaru di atas (recipes sudah di-sort di hook).

### Format tanggal

Gunakan `Intl.DateTimeFormat` dengan locale `'id-ID'`:
```typescript
new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).format(new Date(recipe.savedAt))
```

---

## page.tsx — Integrasi

```typescript
// Tambah state
const { recipes: savedRecipes, save: saveRecipe, remove: removeRecipe } = useSavedRecipes();
const [recipeToLoad, setRecipeToLoad] = useState<SavedRecipe | null>(null);

// Handler
const handleSaveRecipe = (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => {
  saveRecipe(data);
};
const handleLoadRecipe = (recipe: SavedRecipe) => {
  setActiveMode(recipe.mode);
  setRecipeToLoad(recipe);
};

// Reset recipeToLoad setelah satu render cycle
useEffect(() => {
  if (recipeToLoad) setRecipeToLoad(null);
}, [recipeToLoad]);

// Render RecipeHistory di bawah calculator div
<RecipeHistory
  recipes={savedRecipes}
  onLoad={handleLoadRecipe}
  onRemove={removeRecipe}
/>
```

---

## localStorage Schema

```json
// Key: "profitly-saved-recipes"
[
  {
    "id": "r1",
    "name": "Kopi Arabika Cold Brew",
    "savedAt": "2026-05-09T07:32:00.000Z",
    "mode": "satuan",
    "ingredients": [
      { "id": "r2", "name": "Green Bean Ethiopia", "purchasePrice": "135000",
        "purchaseVolume": "1000", "unit": "gr", "usage": "18", "yieldFactor": "15" }
    ],
    "ops": [
      { "id": "r3", "name": "Listrik", "price": "500000", "usage": "10" }
    ],
    "batchSize": "50",
    "fixedCost": "5000000",
    "hpp": 8750
  }
]
```

---

## Urutan Build

1. Tambah types (`SavedRecipeIngredient`, `SavedRecipeOp`, `SavedRecipe`) ke `src/types/hpp.ts`
2. Buat `useSavedRecipes.ts` + `useSavedRecipes.test.ts` (TDD)
3. Buat `RecipeHistory.tsx`
4. Update `HPPCalculator.tsx` — tombol simpan, inline name form, `recipeToLoad` useEffect
5. Update `app/calculator/page.tsx` — hook, handlers, render RecipeHistory

---

## Tidak Termasuk dalam Scope Ini

- Edit nama resep setelah disimpan
- Bandingkan dua resep side-by-side
- Export ke PDF/Excel
- Simpan resep dari mode Turunan
- Sinkronisasi antar perangkat
