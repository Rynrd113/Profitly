# Pilih Mode Bisnis — Design Spec

**Date:** 2026-05-09  
**Project:** ProfitLy — Kalkulator HPP F&B  
**Status:** Approved

---

## Overview

Tambahkan tiga mode kalkulasi yang bisa dipilih di bagian atas halaman kalkulator, menggantikan toggle "Per Satuan / Per Produksi" yang ada sekarang. Setiap mode punya form dan logika berbeda, tapi semua memakai `engine.ts` yang sama.

**3 Mode:**
1. **Unit / Satuan** — HPP per 1 produk (cup, porsi, pcs)
2. **Batch / Produksi Massal** — HPP untuk satu batch + total per batch
3. **Bahan Turunan** — Hitung HPP bahan setengah jadi, simpan ke localStorage, pakai di mode lain

---

## Arsitektur

### Komponen yang Dibuat / Diubah

```
app/
  calculator/
    page.tsx                  ← Ramping: hanya activeMode state + render komponen aktif

src/
  components/
    ModeSelectorCards.tsx     ← 3 kartu mode (desain Option C)
    SatuanCalculator.tsx      ← Dipindah dari page.tsx (mode per cup/produk)
    BatchCalculator.tsx       ← Dipindah dari page.tsx (mode per batch)
    TurunanCalculator.tsx     ← Baru: kalkulator bahan turunan
  hooks/
    useDerivedIngredients.ts  ← localStorage hook, dipakai di semua mode
  types/hpp.ts                ← Tambah DerivedIngredient + DerivedProduct types
  lib/engine.ts               ← Tambah calculateDerivedHPP()
```

### State di `page.tsx`

```typescript
const [activeMode, setActiveMode] = useState<'satuan' | 'batch' | 'turunan'>('satuan');
```

Toggle "Per Satuan / Per Produksi" yang ada dihapus — digantikan oleh mode cards.

---

## Mode Selector Cards

**Desain:** Kartu minimal, 3 sejajar, mode aktif ditandai border hijau + accent bar 3px di atas kartu.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓│  │             │  │             │  ← bar hijau = aktif
│  ☕ Satuan  │  │  📦 Batch   │  │ 🔬 Turunan  │
└─────────────┘  └─────────────┘  └─────────────┘
border #1A6B3C      border #E5E3DD   border #E5E3DD
```

**Icons:** Lucide React — `Coffee` (Satuan), `Package` (Batch), `FlaskConical` (Turunan).

---

## Mode 1: Unit / Satuan

Identik dengan kalkulator yang sudah ada, minus toggle Satuan/Produksi. Form bahan baku + biaya operasional + panel hasil HPP per produk + tier harga + BEP.

**Tambahan:** Tombol "**+ Dari Bahan Turunan**" di footer tabel bahan baku. Klik → dropdown list bahan tersimpan (dari `useDerivedIngredients`). Setelah dipilih, baris terisi otomatis; user hanya isi kolom **Pakai**. Baris ini tampilkan badge kecil `Turunan` di samping nama.

---

## Mode 2: Batch / Produksi Massal

Identik dengan mode yang sudah ada saat toggle = 'produksi': form sama, field "Jumlah Produk per Batch", panel hasil tambah baris "Total per Batch".

**Tambahan:** Tombol "+ Dari Bahan Turunan" sama seperti Mode 1.

---

## Mode 3: Bahan Turunan

### Form (Panel Kiri)

**Bagian 1 — Nama Proses**
- Input teks: nama proses (e.g., "Roasting Kopi Maelo", "Breakdown Ayam Kampung")

**Bagian 2 — Bahan Baku**
- Tabel sama dengan mode Satuan: Nama, Harga Beli, Volume, Satuan, Pakai, Susut%
- Bisa multiple baris
- Tombol "+ Tambah bahan baku"

**Bagian 3 — Biaya Pengolahan**
- Tabel: Nama Biaya, Harga
- Bisa multiple baris
- Tombol "+ Tambah biaya"

**Bagian 4 — Produk yang Dihasilkan** (output, ditandai border hijau)
- Tabel: Nama Produk, Jumlah, Satuan (gr/ml/pcs), Harga Jual/Satuan
- HPP/Satuan ditampilkan otomatis (read-only, warna hijau)
- Bisa multiple baris
- Tombol "+ Tambah produk turunan"

### Panel Kanan

- **Ringkasan:** Total biaya input, list produk + HPP masing-masing
- **Tombol "Simpan Semua":** Simpan semua produk ke `useDerivedIngredients` (localStorage)
- **Daftar Tersimpan:** List bahan turunan yang sudah disimpan sebelumnya (nama + HPP/unit), dengan tombol hapus

### Logika Alokasi Biaya

**Metode:** Relative Sales Value — biaya dialokasikan proporsional terhadap nilai jual masing-masing produk.

```
totalBiaya = Σ biaya bahan baku + Σ biaya pengolahan

nilaiJual_i = hargaJual_i × qty_i
totalNilai  = Σ nilaiJual_i

alokasiBiaya_i = totalBiaya × (nilaiJual_i / totalNilai)
hpp_i          = alokasiBiaya_i / qty_i
```

**Edge case:** Jika semua `hargaJual = 0`, fallback ke alokasi rata per unit:  
`hpp_i = totalBiaya / Σ qty_i`

Fungsi baru di `engine.ts`: `calculateDerivedHPP(inputs, processingCosts, outputs)`

---

## Type Definitions (tambahan ke `src/types/hpp.ts`)

```typescript
export interface DerivedProduct {
  id: string;
  name: string;
  qty: number;
  unit: 'gr' | 'ml' | 'pcs';
  sellPrice: number;   // harga jual per satuan
  hpp: number;         // dihitung otomatis
}

export interface DerivedIngredient {
  id: string;
  name: string;
  unit: 'gr' | 'ml' | 'pcs';
  costPerUnit: number;  // HPP per satuan (dari DerivedProduct.hpp)
}

export interface ProcessingCost {
  id: string;
  name: string;
  price: number;
}
```

---

## Hook: `useDerivedIngredients`

```typescript
// src/hooks/useDerivedIngredients.ts
// Reads/writes localStorage key: 'profitly-derived-ingredients'
// Returns: { ingredients, save(items: DerivedIngredient[]), remove(id) }
```

- `save(items)` menerima array (satu proses bisa menghasilkan beberapa produk sekaligus)
- `remove(id)` hapus satu bahan
- Sinkron: read/write langsung ke localStorage, tidak async

---

## localStorage Schema

```json
// Key: "profitly-derived-ingredients"
[
  { "id": "uuid", "name": "Bubuk Kopi Maelo", "unit": "gr", "costPerUnit": 159 },
  { "id": "uuid", "name": "Simple Syrup", "unit": "ml", "costPerUnit": 12 }
]
```

---

## Integrasi: Bahan Turunan di Mode Satuan/Batch

Tombol "+ Dari Bahan Turunan" di tabel bahan baku membuka dropdown/popover yang list semua `DerivedIngredient` tersimpan. Setelah user memilih satu:

1. Baris baru ditambah ke tabel bahan
2. Nama terisi otomatis
3. `Harga Beli` = `costPerUnit × 1000`, `Volume` = `1000`, `Satuan` = unit bahan
4. `Susut` = `0` (HPP sudah di-embed)
5. User hanya perlu isi kolom **Pakai**
6. Badge kecil `Turunan` muncul di baris tersebut

Pendekatan ini memastikan formula HPP di engine tidak perlu diubah — bahan turunan diperlakukan identik dengan bahan biasa dari sudut pandang engine.

---

## Urutan Build

1. Tambah types ke `src/types/hpp.ts`
2. Tambah `calculateDerivedHPP()` ke `engine.ts` + test
3. Buat `useDerivedIngredients.ts`
4. Buat `ModeSelectorCards.tsx`
5. Ekstrak `SatuanCalculator.tsx` dari `page.tsx`
6. Ekstrak `BatchCalculator.tsx` dari `page.tsx`
7. Buat `TurunanCalculator.tsx`
8. Update `page.tsx` jadi orchestrator ramping
9. Integrasi tombol "+ Dari Bahan Turunan" di Satuan & Batch

---

## Tidak Termasuk dalam Scope Ini

- AI-assisted input ("Bantu Isi dengan AI")
- Riwayat kalkulasi
- Export/print hasil
- Periode biaya (Per Batch / Per Bulan) — bisa ditambah di iterasi berikutnya
