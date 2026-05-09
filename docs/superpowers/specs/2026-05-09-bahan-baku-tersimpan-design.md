# Bahan Baku Tersimpan — Design Spec

**Date:** 2026-05-09
**Project:** ProfitLy — Kalkulator HPP F&B
**Status:** Approved

---

## Overview

Tambahkan sistem katalog bahan baku berbasis localStorage. Saat user mengetik nama bahan di tabel, muncul autocomplete dari bahan yang pernah disimpan. Jika dipilih, kolom Harga Beli, Volume, dan Satuan terisi otomatis. User bisa menyimpan bahan dari hasil kalkulator dengan tombol "Simpan ke Katalog", dan melihat/menghapus isi katalog dari panel di kolom kanan.

---

## Arsitektur

### File Baru

```
src/
  types/hpp.ts                       ← Tambah SavedRawIngredient
  hooks/
    useSavedRawIngredients.ts        ← localStorage hook
    useSavedRawIngredients.test.ts   ← unit tests (pure fns)
  components/
    IngredientNameInput.tsx          ← input nama dengan autocomplete dropdown
```

### File Diubah

```
app/calculator/page.tsx              ← lift useSavedRawIngredients, pass ke kedua kalkulator
src/components/HPPCalculator.tsx     ← terima props katalog, autocomplete, tombol + panel
src/components/TurunanCalculator.tsx ← sama dengan HPPCalculator
```

### State di `page.tsx`

```typescript
const { ingredients: savedRawIngredients, save: saveRawIngredients, remove: removeRawIngredient }
  = useSavedRawIngredients();
```

Props baru yang diterima HPPCalculator dan TurunanCalculator:

```typescript
savedRawIngredients: SavedRawIngredient[];
onSaveRawIngredients: (items: SavedRawIngredient[]) => void;
onRemoveRawIngredient: (name: string) => void;
```

---

## Type Definition

Ditambahkan ke `src/types/hpp.ts`:

```typescript
export interface SavedRawIngredient {
  name: string;           // primary key — upsert by name
  purchasePrice: number;
  purchaseVolume: number;
  unit: 'gr' | 'ml' | 'pcs';
}
```

`usage` dan `yieldFactor` tidak disimpan — keduanya spesifik per resep, bukan per bahan.

---

## Hook: `useSavedRawIngredients`

localStorage key: `'profitly-saved-raw-ingredients'`

```typescript
// src/hooks/useSavedRawIngredients.ts
export function loadSavedRawIngredients(): SavedRawIngredient[]
export function saveToRawStorage(items: SavedRawIngredient[]): void

export function useSavedRawIngredients() {
  // Returns: { ingredients, save(items), remove(name) }
  // save: upsert by name (case-sensitive)
  // remove: filter by name
}
```

Pola identik dengan `useDerivedIngredients`.

---

## Komponen: `IngredientNameInput`

Menggantikan `TextInput` pada kolom **Nama Bahan** di tabel bahan baku (HPPCalculator dan TurunanCalculator).

### Props

```typescript
interface IngredientNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: SavedRawIngredient) => void;
  suggestions: SavedRawIngredient[];
  placeholder?: string;
  className?: string;
}
```

### Perilaku Dropdown

- Muncul saat `value.length >= 1` dan ada bahan yang cocok
- Filter: case-insensitive, partial match (includes)
- Tiap item tampilkan: nama (tebal) + `Rp harga · volume satuan` (kecil abu)
- Klik item → panggil `onSelect`, tutup dropdown
- Keyboard: ArrowUp/Down navigasi, Enter pilih, Escape tutup
- Klik di luar → tutup dropdown (via `useRef` + `mousedown` listener)

### Saat `onSelect` dipanggil

Komponen induk (HPPCalculator / TurunanCalculator) mengisi baris ingredient:
- `name` = `item.name`
- `purchasePrice` = `String(item.purchasePrice)`
- `purchaseVolume` = `String(item.purchaseVolume)`
- `unit` = `item.unit`
- `usage` dan `yieldFactor` dibiarkan tidak berubah

---

## Tombol "Simpan ke Katalog"

Muncul di bawah tabel bahan baku, di samping "+ Tambah Bahan".

**Logika saat diklik:**
1. Filter baris yang lengkap: `name.trim() && purchasePrice > 0 && purchaseVolume > 0`
2. Map ke `SavedRawIngredient[]`
3. Panggil `onSaveRawIngredients(items)`
4. Hook upsert by name — bahan yang sudah ada di katalog ter-update

Baris yang belum lengkap dilewati tanpa error.

---

## Panel Katalog Bahan

Muncul di kolom kanan:
- Mode Satuan/Batch: di bawah ResultsPanel
- Mode Turunan: di bawah panel "Tersimpan"

Panel hanya render jika `savedRawIngredients.length > 0`.

### Tampilan per baris

```
┌──────────────────────────────┐
│ KATALOG BAHAN                │
│                              │
│ Green Bean Ethiopia          │
│ Rp 135.000 · 1.000 gr  [×]  │
│──────────────────────────────│
│ Ayam Kampung                 │
│ Rp 45.000 · 1 pcs      [×]  │
└──────────────────────────────┘
```

- Nama bahan: font medium, warna `#1A1A18`
- Detail: `Rp {purchasePrice} · {purchaseVolume} {unit}`, font kecil, warna `#78716C`
- Tombol `×`: ikon `Trash2`, panggil `onRemoveRawIngredient(name)`

---

## localStorage Schema

```json
// Key: "profitly-saved-raw-ingredients"
[
  { "name": "Green Bean Ethiopia", "purchasePrice": 135000, "purchaseVolume": 1000, "unit": "gr" },
  { "name": "Ayam Kampung",        "purchasePrice": 45000,  "purchaseVolume": 1,    "unit": "pcs" }
]
```

---

## Urutan Build

1. Tambah `SavedRawIngredient` ke `src/types/hpp.ts`
2. Buat `useSavedRawIngredients.ts` + `useSavedRawIngredients.test.ts` (TDD)
3. Buat `IngredientNameInput.tsx`
4. Update `HPPCalculator.tsx` — props baru, autocomplete, tombol, panel katalog
5. Update `TurunanCalculator.tsx` — sama
6. Update `app/calculator/page.tsx` — lift hook, pass props

---

## Tidak Termasuk dalam Scope Ini

- Edit bahan dari panel katalog (hanya lihat + hapus)
- Import/export katalog
- Sinkronisasi antar perangkat
- Autocomplete pada kolom selain Nama Bahan
