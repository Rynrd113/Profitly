# Bahan Baku Tersimpan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah sistem katalog bahan baku berbasis localStorage dengan autocomplete pada kolom Nama Bahan, tombol "Simpan ke Katalog", dan panel katalog di kolom kanan.

**Architecture:** `useSavedRawIngredients` hook (pola identik dengan `useDerivedIngredients`) menyimpan katalog di `localStorage`. `IngredientNameInput` menggantikan `TextInput` pada kolom nama bahan di HPPCalculator dan TurunanCalculator. State hook di-lift ke `page.tsx` dan di-pass sebagai props.

**Tech Stack:** Next.js 16.2.6 App Router, TypeScript strict, Tailwind v4, Bun (bun test), localStorage.

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/hpp.ts` | Tambah `SavedRawIngredient` |
| Create | `src/hooks/useSavedRawIngredients.ts` | localStorage hook |
| Create | `src/hooks/useSavedRawIngredients.test.ts` | Tests untuk pure functions |
| Create | `src/components/IngredientNameInput.tsx` | Input nama dengan dropdown autocomplete |
| Modify | `src/components/HPPCalculator.tsx` | Autocomplete, tombol simpan, panel katalog |
| Modify | `src/components/TurunanCalculator.tsx` | Sama seperti HPPCalculator |
| Modify | `app/calculator/page.tsx` | Lift hook, pass props ke kedua kalkulator |

---

## Task 1: Tambah `SavedRawIngredient` ke types

**Files:**
- Modify: `src/types/hpp.ts`

- [ ] **Step 1: Tambah interface ke `src/types/hpp.ts`**

Append di akhir file (setelah `DerivedProductOutput`):

```typescript
export interface SavedRawIngredient {
  name: string;           // primary key — upsert by name
  purchasePrice: number;
  purchaseVolume: number;
  unit: 'gr' | 'ml' | 'pcs';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/hpp.ts
git commit -m "feat: add SavedRawIngredient type"
```

---

## Task 2: `useSavedRawIngredients` hook (TDD)

**Files:**
- Create: `src/hooks/useSavedRawIngredients.ts`
- Create: `src/hooks/useSavedRawIngredients.test.ts`

- [ ] **Step 1: Tulis failing tests — buat `src/hooks/useSavedRawIngredients.test.ts`**

```typescript
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
```

- [ ] **Step 2: Jalankan tests untuk verifikasi gagal**

```bash
bun test src/hooks/useSavedRawIngredients.test.ts
```

Expected: FAIL dengan "Cannot find module".

- [ ] **Step 3: Implementasi `src/hooks/useSavedRawIngredients.ts`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { SavedRawIngredient } from '@/types/hpp';

const STORAGE_KEY = 'profitly-saved-raw-ingredients';

export function loadSavedRawIngredients(): SavedRawIngredient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRawIngredient[];
  } catch {
    return [];
  }
}

export function saveToRawStorage(items: SavedRawIngredient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
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

  return { ingredients, save, remove };
}
```

- [ ] **Step 4: Jalankan tests untuk verifikasi lulus**

```bash
bun test src/hooks/useSavedRawIngredients.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Jalankan full test suite**

```bash
bun test
```

Expected: semua 48 tests pass + 4 baru = 52 total.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSavedRawIngredients.ts src/hooks/useSavedRawIngredients.test.ts
git commit -m "feat: add useSavedRawIngredients hook with localStorage persistence"
```

---

## Task 3: `IngredientNameInput` component

**Files:**
- Create: `src/components/IngredientNameInput.tsx`

- [ ] **Step 1: Buat `src/components/IngredientNameInput.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import type { SavedRawIngredient } from '@/types/hpp';

interface IngredientNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: SavedRawIngredient) => void;
  suggestions: SavedRawIngredient[];
  placeholder?: string;
  className?: string;
}

export function IngredientNameInput({
  value, onChange, onSelect, suggestions, placeholder, className = '',
}: IngredientNameInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim().length >= 1
    ? suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
    : [];

  const showDropdown = open && filtered.length > 0;

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleSelect = (item: SavedRawIngredient) => {
    onSelect(item);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
          transition-colors placeholder:text-[#C4BFBA]"
      />
      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E5E3DD]
          rounded-xl shadow-lg py-1 min-w-full max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={item.name}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors
                ${i === activeIdx ? 'bg-[#F0FDF4] text-[#1A6B3C]' : 'hover:bg-[#F8F7F2]'}`}
            >
              <span className="font-medium text-[#1A1A18] block">{item.name}</span>
              <span className="text-[11px] text-[#78716C]">
                {fmt(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/IngredientNameInput.tsx
git commit -m "feat: add IngredientNameInput component with autocomplete dropdown"
```

---

## Task 4: Update `HPPCalculator`

**Files:**
- Modify: `src/components/HPPCalculator.tsx`

- [ ] **Step 1: Update imports dan props**

Ganti baris import di bagian atas file:

```typescript
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Package, Zap, SlidersHorizontal, ChevronDown, Trash2, BookmarkPlus } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { IngredientNameInput } from '@/components/IngredientNameInput';
import { ResultsPanel } from '@/components/ResultsPanel';
import { calculateTotalHPP, getPricingTiers, calculateBEP } from '@/lib/engine';
import { uid, parseNum, formatRp } from '@/lib/format';
import type { Ingredient, OperationalCost, DerivedIngredient, SavedRawIngredient } from '@/types/hpp';
import type { CalcMode } from '@/components/ModeSelectorCards';
```

Ganti props function signature:

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

- [ ] **Step 2: Tambah handler functions**

Tambahkan dua fungsi ini setelah `addFromDerived`:

```typescript
  const handleSelectSaved = (id: string, item: SavedRawIngredient) => {
    setIngredients(prev => prev.map(r => r.id === id ? {
      ...r,
      name: item.name,
      purchasePrice: String(item.purchasePrice),
      purchaseVolume: String(item.purchaseVolume),
      unit: item.unit,
    } : r));
  };

  const handleSaveToKatalog = () => {
    const items: SavedRawIngredient[] = ingredients
      .filter(r => r.name.trim() && parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0)
      .map(r => ({
        name: r.name.trim(),
        purchasePrice: parseNum(r.purchasePrice),
        purchaseVolume: parseNum(r.purchaseVolume),
        unit: r.unit,
      }));
    if (items.length > 0) onSaveRawIngredients(items);
  };
```

- [ ] **Step 3: Ganti TextInput nama bahan dengan IngredientNameInput**

Di bagian **Mobile card** (sekitar baris 139–148 pada file asli), ganti:

```typescript
                  <div className="flex-1 flex items-center gap-1.5">
                      <TextInput value={row.name} onChange={v => updateIng(row.id, 'name', v)}
                        placeholder="Nama bahan" className="flex-1" />
                      {row.isDerived && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                          bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                      )}
                    </div>
```

Menjadi:

```typescript
                  <div className="flex-1 flex items-center gap-1.5">
                      <IngredientNameInput
                        value={row.name}
                        onChange={v => updateIng(row.id, 'name', v)}
                        onSelect={item => handleSelectSaved(row.id, item)}
                        suggestions={savedRawIngredients}
                        placeholder="Nama bahan"
                        className="flex-1"
                      />
                      {row.isDerived && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                          bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                      )}
                    </div>
```

Di bagian **Desktop row** (sekitar baris 186–195 pada file asli), ganti:

```typescript
                  <div className="flex items-center gap-1.5">
                    <TextInput value={row.name} onChange={v => updateIng(row.id, 'name', v)}
                      placeholder="Nama bahan" className="flex-1" />
                    {row.isDerived && (
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                        bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                    )}
                  </div>
```

Menjadi:

```typescript
                  <div className="flex items-center gap-1.5">
                    <IngredientNameInput
                      value={row.name}
                      onChange={v => updateIng(row.id, 'name', v)}
                      onSelect={item => handleSelectSaved(row.id, item)}
                      suggestions={savedRawIngredients}
                      placeholder="Nama bahan"
                      className="flex-1"
                    />
                    {row.isDerived && (
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                        bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                    )}
                  </div>
```

- [ ] **Step 4: Tambah tombol "Simpan ke Katalog" di footer tabel bahan baku**

Ganti div footer yang ada (yang berisi `AddRowBtn` dan derived picker):

```typescript
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <AddRowBtn onClick={addIng} label="Tambah Bahan" />
            {derivedIngredients.length > 0 && (
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setShowDerivedPicker(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                    hover:text-[#1A1A18] transition-colors"
                >
                  <ChevronDown size={14} />
                  Dari Bahan Turunan
                </button>
                {showDerivedPicker && (
                  <div className="absolute left-0 top-7 z-10 bg-white border border-[#E5E3DD]
                    rounded-xl shadow-lg py-1 min-w-[200px]">
                    {derivedIngredients.map(di => (
                      <button
                        key={di.id}
                        type="button"
                        onClick={() => addFromDerived(di)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8F7F2] transition-colors"
                      >
                        <span className="font-medium text-[#1A1A18]">{di.name}</span>
                        <span className="ml-2 text-[11px] text-[#78716C]">
                          Rp {di.costPerUnit.toLocaleString('id-ID')}/{di.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveToKatalog}
              className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                hover:text-[#1A6B3C] transition-colors"
            >
              <BookmarkPlus size={14} />
              Simpan ke Katalog
            </button>
          </div>
```

- [ ] **Step 5: Tambah panel katalog di kolom kanan**

Di bagian return, ganti `<ResultsPanel result={result} />` menjadi:

```typescript
      <div className="mt-5 lg:mt-0 space-y-4">
        <ResultsPanel result={result} />
        {savedRawIngredients.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
              Katalog Bahan
            </span>
            <div className="space-y-1">
              {savedRawIngredients.map(item => (
                <div key={item.name} className="flex items-center justify-between py-1.5
                  border-b border-[#F0EDE8] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A18]">{item.name}</p>
                    <p className="text-[11px] text-[#78716C]">
                      {formatRp(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemoveRawIngredient(item.name)}
                    className="text-[#C4BFBA] hover:text-red-400 transition-colors ml-2 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
```

Perhatikan: bungkus dua elemen (`ResultsPanel` + panel katalog) dalam satu `<div>` karena sebelumnya `ResultsPanel` adalah child langsung dari grid container. Grid container di HPPCalculator adalah:
```typescript
<div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
```
Kolom kanan (kedua) sebelumnya hanya `<ResultsPanel>`. Sekarang perlu dibungkus div karena ada dua elemen.

- [ ] **Step 6: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: hanya error pre-existing tentang `bun:test`, tidak ada error baru.

- [ ] **Step 7: Commit**

```bash
git add src/components/HPPCalculator.tsx
git commit -m "feat: add autocomplete, save to katalog, and katalog panel to HPPCalculator"
```

---

## Task 5: Update `TurunanCalculator`

**Files:**
- Modify: `src/components/TurunanCalculator.tsx`

- [ ] **Step 1: Update imports dan props**

Ganti baris import di bagian atas:

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Package, Zap, FlaskConical, Save, Trash2, BookmarkPlus } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { IngredientNameInput } from '@/components/IngredientNameInput';
import { calculateDerivedHPP } from '@/lib/engine';
import { uid, parseNum, formatRp } from '@/lib/format';
import type { Ingredient, ProcessingCost, DerivedIngredient, SavedRawIngredient } from '@/types/hpp';
```

Ganti props function signature:

```typescript
export function TurunanCalculator({
  derivedIngredients,
  onSave,
  onRemove,
  savedRawIngredients,
  onSaveRawIngredients,
  onRemoveRawIngredient,
}: {
  derivedIngredients: DerivedIngredient[];
  onSave: (items: DerivedIngredient[]) => void;
  onRemove: (id: string) => void;
  savedRawIngredients: SavedRawIngredient[];
  onSaveRawIngredients: (items: SavedRawIngredient[]) => void;
  onRemoveRawIngredient: (name: string) => void;
}) {
```

- [ ] **Step 2: Tambah handler functions**

Tambahkan dua fungsi ini setelah `updateOutput`:

```typescript
  const handleSelectSaved = (id: string, item: SavedRawIngredient) => {
    setInputs(prev => prev.map(r => r.id === id ? {
      ...r,
      name: item.name,
      purchasePrice: String(item.purchasePrice),
      purchaseVolume: String(item.purchaseVolume),
      unit: item.unit,
    } : r));
  };

  const handleSaveToKatalog = () => {
    const items: SavedRawIngredient[] = inputs
      .filter(r => r.name.trim() && parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0)
      .map(r => ({
        name: r.name.trim(),
        purchasePrice: parseNum(r.purchasePrice),
        purchaseVolume: parseNum(r.purchaseVolume),
        unit: r.unit,
      }));
    if (items.length > 0) onSaveRawIngredients(items);
  };
```

- [ ] **Step 3: Ganti TextInput nama bahan dengan IngredientNameInput**

Di bagian **Mobile card** bahan baku TurunanCalculator, ganti:

```typescript
                    <TextInput value={row.name} onChange={v => updateInput(row.id, 'name', v)}
                      placeholder="Nama bahan" className="flex-1" />
```

Menjadi:

```typescript
                    <IngredientNameInput
                      value={row.name}
                      onChange={v => updateInput(row.id, 'name', v)}
                      onSelect={item => handleSelectSaved(row.id, item)}
                      suggestions={savedRawIngredients}
                      placeholder="Nama bahan"
                      className="flex-1"
                    />
```

Di bagian **Desktop row** bahan baku TurunanCalculator, ganti:

```typescript
                  <TextInput value={row.name} onChange={v => updateInput(row.id, 'name', v)} placeholder="Nama bahan" />
```

Menjadi:

```typescript
                  <IngredientNameInput
                    value={row.name}
                    onChange={v => updateInput(row.id, 'name', v)}
                    onSelect={item => handleSelectSaved(row.id, item)}
                    suggestions={savedRawIngredients}
                    placeholder="Nama bahan"
                  />
```

- [ ] **Step 4: Tambah tombol "Simpan ke Katalog" di bahan baku section**

Ganti `<AddRowBtn onClick={...} label="Tambah Bahan" />` di akhir section Bahan Baku menjadi:

```typescript
          <div className="flex items-center gap-3 flex-wrap">
            <AddRowBtn onClick={() => setInputs(prev => [...prev, emptyIngredient()])} label="Tambah Bahan" />
            <button
              type="button"
              onClick={handleSaveToKatalog}
              className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                hover:text-[#1A6B3C] transition-colors"
            >
              <BookmarkPlus size={14} />
              Simpan ke Katalog
            </button>
          </div>
```

- [ ] **Step 5: Tambah panel katalog di kolom kanan**

Di bagian right panel (setelah `{derivedIngredients.length > 0 && (...)}` block), tambahkan:

```typescript
        {savedRawIngredients.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
              Katalog Bahan
            </span>
            <div className="space-y-1">
              {savedRawIngredients.map(item => (
                <div key={item.name} className="flex items-center justify-between py-1.5
                  border-b border-[#F0EDE8] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A18]">{item.name}</p>
                    <p className="text-[11px] text-[#78716C]">
                      {formatRp(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemoveRawIngredient(item.name)}
                    className="text-[#C4BFBA] hover:text-red-400 transition-colors ml-2 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 6: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: hanya error pre-existing, tidak ada error baru.

- [ ] **Step 7: Commit**

```bash
git add src/components/TurunanCalculator.tsx
git commit -m "feat: add autocomplete, save to katalog, and katalog panel to TurunanCalculator"
```

---

## Task 6: Update `page.tsx`

**Files:**
- Modify: `app/calculator/page.tsx`

- [ ] **Step 1: Rewrite `app/calculator/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { ChefHat } from 'lucide-react';
import { ModeSelectorCards, type CalcMode } from '@/components/ModeSelectorCards';
import { HPPCalculator } from '@/components/HPPCalculator';
import { TurunanCalculator } from '@/components/TurunanCalculator';
import { useDerivedIngredients } from '@/hooks/useDerivedIngredients';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';

export default function CalculatorPage() {
  const [activeMode, setActiveMode] = useState<CalcMode>('satuan');
  const { ingredients: derivedIngredients, save, remove } = useDerivedIngredients();
  const {
    ingredients: savedRawIngredients,
    save: saveRawIngredients,
    remove: removeRawIngredient,
  } = useSavedRawIngredients();

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
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Jalankan full test suite**

```bash
bun test
```

Expected: 52 tests pass.

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: hanya error pre-existing, tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add app/calculator/page.tsx
git commit -m "feat: lift useSavedRawIngredients to page and wire katalog props"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `SavedRawIngredient` type (Task 1)
- ✅ `useSavedRawIngredients` hook dengan upsert by name (Task 2)
- ✅ `IngredientNameInput` — filter case-insensitive, keyboard nav, click outside (Task 3)
- ✅ Auto-fill name/purchasePrice/purchaseVolume/unit saat pilih (Task 4 + 5)
- ✅ Tombol "Simpan ke Katalog" di HPPCalculator (Task 4)
- ✅ Tombol "Simpan ke Katalog" di TurunanCalculator (Task 5)
- ✅ Panel katalog di kolom kanan HPPCalculator (Task 4)
- ✅ Panel katalog di kolom kanan TurunanCalculator (Task 5)
- ✅ Tombol hapus per bahan di panel katalog (Task 4 + 5)
- ✅ State di-lift ke page.tsx (Task 6)

**Type consistency:**
- `SavedRawIngredient` → dipakai di hook, IngredientNameInput props, HPPCalculator props, TurunanCalculator props — konsisten
- `save(newItems: SavedRawIngredient[])` di hook → `onSaveRawIngredients` di components — konsisten
- `remove(name: string)` di hook → `onRemoveRawIngredient` di components — konsisten
