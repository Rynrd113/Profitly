# Pilih Mode Bisnis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three calculator modes (Satuan, Batch, Bahan Turunan) with mode selector cards, replacing the existing Per Satuan/Per Produksi toggle, and introduce a localStorage-backed derived ingredients system.

**Architecture:** Extract shared UI primitives and the results panel into separate components; unify Satuan/Batch into one `HPPCalculator` component with a `mode` prop; build `TurunanCalculator` as a separate component; lift `useDerivedIngredients` state to `page.tsx` so that ingredients saved in Turunan are immediately available in Satuan/Batch without remounting.

**Tech Stack:** Next.js 16.2.6 App Router, TypeScript strict, Tailwind v4, Bun (bun test), Lucide React, localStorage.

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/format.ts` | `uid`, `parseNum`, `formatRp` shared by all components |
| Modify | `src/types/hpp.ts` | Add `ProcessingCost`, `DerivedIngredient`, `DerivedProductOutput` |
| Modify | `src/lib/engine.ts` | Add `calculateDerivedHPP` |
| Modify | `src/lib/engine.test.ts` | Add tests for `calculateDerivedHPP` |
| Create | `src/hooks/useDerivedIngredients.ts` | localStorage hook + exported pure fns |
| Create | `src/hooks/useDerivedIngredients.test.ts` | Tests for the pure fns |
| Create | `src/components/CalculatorShared.tsx` | `TextInput`, `NumInput`, `DeleteBtn`, `AddRowBtn`, `SectionHeader`, `PricingCard`, `TIER_META` |
| Create | `src/components/ResultsPanel.tsx` | HPP display + pricing cards + BEP block |
| Create | `src/components/ModeSelectorCards.tsx` | 3 mode selector cards |
| Create | `src/components/HPPCalculator.tsx` | Satuan + Batch unified (accepts `mode` prop) |
| Create | `src/components/TurunanCalculator.tsx` | Bahan Turunan calculator |
| Modify | `app/calculator/page.tsx` | Thin orchestrator: mode state + hook + layout |

---

## Task 1: Format utilities + new types

**Files:**
- Create: `src/lib/format.ts`
- Modify: `src/types/hpp.ts`

- [ ] **Step 1: Create `src/lib/format.ts`**

```typescript
let _counter = 0;
export const uid = (): string => `r${++_counter}`;
export const parseNum = (s: string): number => parseFloat(s) || 0;

const _fmt = new Intl.NumberFormat('id-ID');
export const formatRp = (n: number): string => 'Rp ' + _fmt.format(Math.round(n));
```

- [ ] **Step 2: Add new types to `src/types/hpp.ts`**

Append these three interfaces after the existing `CalculationResult`:

```typescript
export interface ProcessingCost {
  id: string;
  name: string;
  price: number;
}

export interface DerivedIngredient {
  id: string;
  name: string;
  unit: 'gr' | 'ml' | 'pcs';
  costPerUnit: number;
}

export interface DerivedProductOutput {
  id: string;
  name: string;
  qty: number;
  unit: 'gr' | 'ml' | 'pcs';
  sellPrice: number;
  hpp: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts src/types/hpp.ts
git commit -m "feat: add format utilities and derived ingredient types"
```

---

## Task 2: `calculateDerivedHPP` in engine (TDD)

**Files:**
- Modify: `src/lib/engine.test.ts`
- Modify: `src/lib/engine.ts`

**Algorithm:** Allocate total cost proportionally by `sellPrice × qty` (relative sales value). If all `sellPrice` are 0, fall back to equal-per-unit allocation.

- [ ] **Step 1: Write the failing tests — append to `src/lib/engine.test.ts`**

```typescript
import {
  calculateIngredientCost,
  calculateTotalHPP,
  getPricingTiers,
  getTierPrice,
  calculateBEP,
  getBEPScenarios,
  calculateDerivedHPP,   // add this import
} from './engine';
```

Then append at the end of the file:

```typescript
// ─── calculateDerivedHPP ─────────────────────────────────────────────────────

describe('calculateDerivedHPP', () => {
  test('mengembalikan array kosong jika outputs kosong', () => {
    expect(calculateDerivedHPP({ ingredients: [], processingCosts: [], outputs: [] })).toEqual([]);
  });

  test('alokasi proporsional berdasarkan harga jual × qty', () => {
    // Ayam 1 ekor Rp45.000 + potong Rp5.000 = total Rp50.000
    // Dada 250gr @Rp80/gr → revenue 20.000 | Ceker 50gr @Rp20/gr → revenue 1.000
    // totalRevenue = 21.000
    // dada: 50.000 × (20.000/21.000) / 250 = 190.48
    // ceker: 50.000 × (1.000/21.000) / 50  =  47.62
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'a1', name: 'Ayam', purchasePrice: 45_000,
          purchaseVolume: 1, unit: 'pcs', usage: 1,
        },
      }],
      processingCosts: [{ id: 'p1', name: 'Tenaga potong', price: 5_000 }],
      outputs: [
        { id: 'o1', name: 'Dada', qty: 250, unit: 'gr', sellPrice: 80 },
        { id: 'o2', name: 'Ceker', qty: 50,  unit: 'gr', sellPrice: 20 },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0].hpp).toBeCloseTo(190.48, 1);
    expect(result[1].hpp).toBeCloseTo(47.62, 1);
  });

  test('fallback ke rata per unit saat semua sellPrice = 0', () => {
    // Kopi 1000gr Rp100.000, output 850gr, sellPrice 0
    // fallback: 100.000 / 850 = 117.65
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'k1', name: 'Kopi', purchasePrice: 100_000,
          purchaseVolume: 1_000, unit: 'gr', usage: 1_000,
        },
      }],
      processingCosts: [],
      outputs: [{ id: 'o1', name: 'Bubuk', qty: 850, unit: 'gr', sellPrice: 0 }],
    });
    expect(result[0].hpp).toBeCloseTo(117.65, 1);
  });

  test('menghitung dengan benar saat ada processing costs dan satu output', () => {
    // Gula 1000gr Rp13.000 + gas Rp2.000 = Rp15.000, output simple syrup 1000ml
    // hpp = 15.000 / 1.000 = 15/ml (single output → rata per unit krn 1 output)
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'g1', name: 'Gula', purchasePrice: 13_000,
          purchaseVolume: 1_000, unit: 'gr', usage: 1_000,
        },
      }],
      processingCosts: [{ id: 'p1', name: 'Gas', price: 2_000 }],
      outputs: [{ id: 'o1', name: 'Simple Syrup', qty: 1_000, unit: 'ml', sellPrice: 0 }],
    });
    expect(result[0].hpp).toBe(15);
  });

  test('menerapkan yieldFactor pada bahan baku', () => {
    // Kopi 1000gr Rp100.000 dengan susut 15% → yieldFactor 0.85
    // biaya efektif = (100.000/1.000 × 1.000) / 0.85 = 117.647...
    // output 850gr → hpp = 117.647.../850 = 138.41
    const result = calculateDerivedHPP({
      ingredients: [{
        ingredient: {
          id: 'k1', name: 'Kopi', purchasePrice: 100_000,
          purchaseVolume: 1_000, unit: 'gr', usage: 1_000,
        },
        yieldFactor: 0.85,
      }],
      processingCosts: [],
      outputs: [{ id: 'o1', name: 'Bubuk', qty: 850, unit: 'gr', sellPrice: 0 }],
    });
    expect(result[0].hpp).toBeCloseTo(138.41, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/lib/engine.test.ts
```

Expected: tests referencing `calculateDerivedHPP` fail with "is not a function" or import error. Other tests still pass.

- [ ] **Step 3: Implement `calculateDerivedHPP` in `src/lib/engine.ts`**

Add these imports at the top of engine.ts (add to existing import):
```typescript
import type { Ingredient, OperationalCost, PricingTier, ProcessingCost, DerivedProductOutput } from '@/types/hpp';
```

Then append after `getBEPScenarios`:

```typescript
// ─── Bahan Turunan ───────────────────────────────────────────────────────────

interface DerivedHPPInput {
  ingredients: Array<{ ingredient: Ingredient; yieldFactor?: number }>;
  processingCosts: ProcessingCost[];
  outputs: Array<{ id: string; name: string; qty: number; unit: 'gr' | 'ml' | 'pcs'; sellPrice: number }>;
}

export function calculateDerivedHPP(input: DerivedHPPInput): DerivedProductOutput[] {
  const { ingredients, processingCosts, outputs } = input;
  if (outputs.length === 0) return [];

  const totalIngredientCost = ingredients.reduce(
    (sum, { ingredient, yieldFactor }) => sum + calculateIngredientCost(ingredient, yieldFactor),
    0,
  );
  const totalProcessingCost = processingCosts.reduce((sum, p) => sum + p.price, 0);
  const totalCost = totalIngredientCost + totalProcessingCost;

  const totalRevenue = outputs.reduce((sum, o) => sum + o.sellPrice * o.qty, 0);

  return outputs.map(o => {
    let hpp: number;
    if (totalRevenue === 0) {
      const totalQty = outputs.reduce((s, x) => s + x.qty, 0);
      hpp = totalQty > 0 ? round(totalCost / totalQty) : 0;
    } else {
      const share = (o.sellPrice * o.qty) / totalRevenue;
      hpp = o.qty > 0 ? round((totalCost * share) / o.qty) : 0;
    }
    return { ...o, hpp };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/lib/engine.test.ts
```

Expected: all tests pass including the new `calculateDerivedHPP` suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine.ts src/lib/engine.test.ts
git commit -m "feat: add calculateDerivedHPP with relative sales value allocation"
```

---

## Task 3: `useDerivedIngredients` hook

**Files:**
- Create: `src/hooks/useDerivedIngredients.ts`
- Create: `src/hooks/useDerivedIngredients.test.ts`

- [ ] **Step 1: Write the failing tests — create `src/hooks/useDerivedIngredients.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/hooks/useDerivedIngredients.test.ts
```

Expected: fail with "Cannot find module" or "is not a function".

- [ ] **Step 3: Create `src/hooks/useDerivedIngredients.ts`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { DerivedIngredient } from '@/types/hpp';

const STORAGE_KEY = 'profitly-derived-ingredients';

export function loadDerivedIngredients(): DerivedIngredient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DerivedIngredient[];
  } catch {
    return [];
  }
}

export function saveToDerivedStorage(items: DerivedIngredient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useDerivedIngredients() {
  const [ingredients, setIngredients] = useState<DerivedIngredient[]>([]);

  useEffect(() => {
    setIngredients(loadDerivedIngredients());
  }, []);

  const save = (newItems: DerivedIngredient[]) => {
    setIngredients(prev => {
      const merged = [...prev];
      for (const item of newItems) {
        const idx = merged.findIndex(x => x.id === item.id);
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      }
      saveToDerivedStorage(merged);
      return merged;
    });
  };

  const remove = (id: string) => {
    setIngredients(prev => {
      const updated = prev.filter(x => x.id !== id);
      saveToDerivedStorage(updated);
      return updated;
    });
  };

  return { ingredients, save, remove };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test src/hooks/useDerivedIngredients.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests pass (39 existing + 5 new engine tests + 4 hook tests = 48).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDerivedIngredients.ts src/hooks/useDerivedIngredients.test.ts
git commit -m "feat: add useDerivedIngredients hook with localStorage persistence"
```

---

## Task 4: Shared UI components

**Files:**
- Create: `src/components/CalculatorShared.tsx`
- Create: `src/components/ResultsPanel.tsx`

These extract code from `app/calculator/page.tsx` — no logic changes, just moving.

- [ ] **Step 1: Create `src/components/CalculatorShared.tsx`**

```typescript
'use client';

import { Trash2, Plus } from 'lucide-react';
import { Star } from 'lucide-react';
import type { PricingTier } from '@/types/hpp';

export const TIER_META = {
  competitive: {
    label: 'Kompetitif', desc: 'Margin 20%',
    color: '#6B7280', ring: '#E5E7EB', bg: '#F9FAFB', bar: '#9CA3AF',
  },
  standard: {
    label: 'Standar', desc: 'Margin 35%',
    color: '#1A6B3C', ring: '#BBF7D0', bg: '#F0FDF4', bar: '#1A6B3C',
  },
  premium: {
    label: 'Premium', desc: 'Margin 50%',
    color: '#92400E', ring: '#FDE68A', bg: '#FFFBEB', bar: '#D97706',
  },
} as const;

export function TextInput({
  value, onChange, placeholder, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
        focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
        transition-colors placeholder:text-[#C4BFBA] ${className}`}
    />
  );
}

export function NumInput({
  value, onChange, placeholder, prefix, suffix, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {prefix && (
        <span className="absolute left-2.5 text-xs text-[#C4BFBA] pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className={`w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl text-sm text-right
          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
          transition-colors placeholder:text-[#C4BFBA] py-2
          ${prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'}`}
      />
      {suffix && (
        <span className="absolute right-2.5 text-xs text-[#C4BFBA] pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[#C4BFBA]
        hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
    >
      <Trash2 size={14} />
    </button>
  );
}

export function AddRowBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#1A6B3C]
        hover:text-[#15803D] transition-colors"
    >
      <Plus size={15} />
      {label}
    </button>
  );
}

export function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#1A6B3C]">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#1A1A18]">{label}</h2>
    </div>
  );
}

export function PricingCard({
  tier, isHighlighted, batch,
}: {
  tier: PricingTier; isHighlighted: boolean; batch: number | null;
}) {
  const m = TIER_META[tier.label];
  const formatRpLocal = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  return (
    <div
      className="rounded-2xl p-4 border transition-shadow"
      style={{
        background: m.bg,
        borderColor: isHighlighted ? m.ring : '#E5E3DD',
        borderWidth: isHighlighted ? '1.5px' : '1px',
        boxShadow: isHighlighted ? `0 0 0 3px ${m.ring}50` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</span>
            {isHighlighted && (
              <span className="inline-flex items-center gap-0.5 bg-[#D97706] text-white
                text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                <Star size={8} fill="white" />
                SWEET SPOT
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: m.color + '99' }}>{m.desc}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold leading-none"
            style={{ color: m.color, fontFamily: 'var(--font-bricolage, system-ui)', fontVariantNumeric: 'tabular-nums' }}>
            {formatRpLocal(tier.sellPrice)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: m.color + '88' }}>
            untung {formatRpLocal(tier.profit)} / cup
          </p>
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full overflow-hidden bg-black/5">
        <div className="h-full rounded-full" style={{ width: `${tier.margin * 100}%`, background: m.bar }} />
      </div>
      {batch && (
        <div className="mt-3 pt-3 border-t border-black/5 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: m.color + '88' }}>
              Omzet {batch} cup
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>
              {formatRpLocal(tier.sellPrice * batch)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: m.color + '88' }}>
              Profit {batch} cup
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>
              {formatRpLocal(tier.profit * batch)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ResultsPanel.tsx`**

```typescript
'use client';

import { TrendingUp } from 'lucide-react';
import { PricingCard } from '@/components/CalculatorShared';
import type { PricingTier } from '@/types/hpp';
import type { BEPResult } from '@/lib/engine';
import { formatRp } from '@/lib/format';

interface ResultsPanelProps {
  result: {
    hpp: number;
    tiers: PricingTier[];
    bep: BEPResult | null;
    batch: number | null;
  } | null;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <div className="mt-5 lg:mt-0 lg:sticky lg:top-[73px] space-y-4">
      <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
            HPP per Porsi
          </span>
          <TrendingUp size={15} className="text-[#1A6B3C]" />
        </div>
        {result ? (
          <>
            <p className="text-[2.25rem] font-bold leading-none text-[#1A1A18] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {formatRp(result.hpp)}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-2">Harga Pokok Produksi</p>
            {result.batch && (
              <div className="mt-3 pt-3 border-t border-[#F0EDE8] flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Total {result.batch} cup</span>
                <span className="text-sm font-bold text-[#1A6B3C] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                  {formatRp(result.hpp * result.batch)}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[2.25rem] font-bold leading-none text-[#D1CBC3]"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              Rp —
            </p>
            <p className="text-xs text-[#C4BFBA] mt-2">Masukkan data bahan baku terlebih dahulu</p>
          </>
        )}
      </div>

      {result ? (
        <div className="space-y-3">
          {result.tiers.map((tier, i) => (
            <PricingCard key={tier.label} tier={tier} isHighlighted={i === 1} batch={result.batch} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm text-center">
          <p className="text-sm text-[#C4BFBA]">Saran harga jual akan muncul otomatis di sini</p>
        </div>
      )}

      {result?.bep && (
        <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
            Titik Impas (BEP) — Harga Standar
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#1A1A18] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {Math.ceil(result.bep.bepUnit).toLocaleString('id-ID')}
            </span>
            <span className="text-sm text-[#9CA3AF]">porsi / bulan</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1.5">
            {formatRp(result.bep.bepRevenue)} omzet minimal untuk balik modal
          </p>
        </div>
      )}

      <p className="text-[11px] text-[#C4BFBA] text-center pb-2">
        Semua perhitungan otomatis · data tidak disimpan
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CalculatorShared.tsx src/components/ResultsPanel.tsx
git commit -m "feat: extract shared calculator UI components and results panel"
```

---

## Task 5: `ModeSelectorCards`

**Files:**
- Create: `src/components/ModeSelectorCards.tsx`

- [ ] **Step 1: Create `src/components/ModeSelectorCards.tsx`**

```typescript
'use client';

import { Coffee, Package, FlaskConical } from 'lucide-react';

export type CalcMode = 'satuan' | 'batch' | 'turunan';

const MODES: Array<{ id: CalcMode; label: string; icon: React.ReactNode }> = [
  { id: 'satuan',   label: 'Satuan',  icon: <Coffee size={14} /> },
  { id: 'batch',    label: 'Batch',   icon: <Package size={14} /> },
  { id: 'turunan',  label: 'Turunan', icon: <FlaskConical size={14} /> },
];

export function ModeSelectorCards({
  activeMode,
  onChange,
}: {
  activeMode: CalcMode;
  onChange: (mode: CalcMode) => void;
}) {
  return (
    <div className="flex gap-2 mb-5">
      {MODES.map(m => {
        const isActive = m.id === activeMode;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`flex-1 relative flex flex-col items-center gap-1.5 py-3 px-2
              rounded-xl border text-xs font-semibold transition-all overflow-hidden
              ${isActive
                ? 'border-[#1A6B3C] text-[#1A6B3C] bg-white'
                : 'border-[#E5E3DD] text-[#9CA3AF] bg-white hover:text-[#1A1A18]'
              }`}
          >
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-[3px] bg-[#1A6B3C]" />
            )}
            {m.icon}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ModeSelectorCards.tsx
git commit -m "feat: add mode selector cards component"
```

---

## Task 6: `HPPCalculator` (Satuan + Batch unified)

**Files:**
- Create: `src/components/HPPCalculator.tsx`

This is largely the form from current `page.tsx`, refactored to accept a `mode` prop and `derivedIngredients`. The Per Satuan / Per Produksi toggle is removed — mode comes from the prop. Adds "+ Dari Bahan Turunan" button that opens an inline picker dropdown.

- [ ] **Step 1: Create `src/components/HPPCalculator.tsx`**

```typescript
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Package, Zap, SlidersHorizontal, ChevronDown } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { ResultsPanel } from '@/components/ResultsPanel';
import { calculateTotalHPP, getPricingTiers, calculateBEP } from '@/lib/engine';
import { uid, parseNum } from '@/lib/format';
import type { Ingredient, OperationalCost, DerivedIngredient } from '@/types/hpp';
import type { CalcMode } from '@/components/ModeSelectorCards';

interface IngredientRow {
  id: string; name: string;
  purchasePrice: string; purchaseVolume: string;
  unit: 'gr' | 'ml' | 'pcs'; usage: string;
  yieldFactor: string; isDerived?: boolean;
}

interface OperationalRow {
  id: string; name: string; price: string; usage: string;
}

const emptyIngredient = (): IngredientRow => ({
  id: uid(), name: '', purchasePrice: '', purchaseVolume: '',
  unit: 'gr', usage: '', yieldFactor: '0',
});

const emptyOp = (): OperationalRow => ({
  id: uid(), name: '', price: '', usage: '10',
});

export function HPPCalculator({
  mode,
  derivedIngredients,
}: {
  mode: Exclude<CalcMode, 'turunan'>;
  derivedIngredients: DerivedIngredient[];
}) {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [ops, setOps] = useState<OperationalRow[]>([emptyOp()]);
  const [batchSize, setBatchSize] = useState('50');
  const [fixedCost, setFixedCost] = useState('5000000');
  const [showDerivedPicker, setShowDerivedPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDerivedPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDerivedPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDerivedPicker]);

  const updateIng = (id: string, field: keyof IngredientRow, val: string) =>
    setIngredients(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addIng = () => setIngredients(prev => [...prev, emptyIngredient()]);
  const removeIng = (id: string) => setIngredients(prev => prev.filter(r => r.id !== id));

  const addFromDerived = (di: DerivedIngredient) => {
    setIngredients(prev => [...prev, {
      id: uid(),
      name: di.name,
      purchasePrice: String(di.costPerUnit * 1000),
      purchaseVolume: '1000',
      unit: di.unit,
      usage: '',
      yieldFactor: '0',
      isDerived: true,
    }]);
    setShowDerivedPicker(false);
  };

  const updateOp = (id: string, field: keyof OperationalRow, val: string) =>
    setOps(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addOp = () => setOps(prev => [...prev, emptyOp()]);
  const removeOp = (id: string) => setOps(prev => prev.filter(r => r.id !== id));

  const result = useMemo(() => {
    try {
      const ingList = ingredients
        .filter(r => parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0 && parseNum(r.usage) > 0)
        .map(r => ({
          ingredient: {
            id: r.id, name: r.name,
            purchasePrice: parseNum(r.purchasePrice),
            purchaseVolume: parseNum(r.purchaseVolume),
            unit: r.unit, usage: parseNum(r.usage),
          } satisfies Ingredient,
          yieldFactor: Math.max(0.01, 1 - Math.min(0.99, parseNum(r.yieldFactor) / 100)),
        }));

      const opList: OperationalCost[] = ops
        .filter(r => parseNum(r.price) > 0)
        .map(r => ({
          id: r.id, name: r.name,
          price: parseNum(r.price),
          usage: Math.min(1, parseNum(r.usage) / 100),
        }));

      const output = mode === 'satuan' ? 1 : Math.max(1, parseNum(batchSize));
      if (ingList.length === 0 && opList.length === 0) return null;

      const hpp = calculateTotalHPP(ingList, opList, output);
      if (hpp <= 0) return null;

      const tiers = getPricingTiers(hpp);
      const fc = parseNum(fixedCost);
      const bep = fc > 0 ? calculateBEP(fc, tiers[1].sellPrice, hpp) : null;
      const batch = mode === 'batch' ? Math.max(1, parseNum(batchSize)) : null;

      return { hpp, tiers, bep, batch };
    } catch {
      return null;
    }
  }, [ingredients, ops, batchSize, fixedCost, mode]);

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
      <div className="space-y-5">

        {/* Bahan Baku */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<Package size={15} />} label="Bahan Baku" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
            {['Nama Bahan', 'Harga Beli', 'Volume', 'Satuan', 'Pakai', 'Susut %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {ingredients.map(row => (
              <div key={row.id}>
                {/* Mobile card */}
                <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5">
                      <TextInput value={row.name} onChange={v => updateIng(row.id, 'name', v)}
                        placeholder="Nama bahan" className="flex-1" />
                      {row.isDerived && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                          bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                      )}
                    </div>
                    <DeleteBtn onClick={() => removeIng(row.id)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Harga Beli</p>
                      <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)}
                        placeholder="14000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Volume</p>
                      <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)}
                        placeholder="1000" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Satuan</p>
                      <select value={row.unit}
                        onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                        className="w-full bg-white border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Pemakaian</p>
                      <NumInput value={row.usage} onChange={v => updateIng(row.id, 'usage', v)} placeholder="200" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Susut</p>
                      <NumInput value={row.yieldFactor} onChange={v => updateIng(row.id, 'yieldFactor', v)}
                        placeholder="0" suffix="%" />
                    </div>
                  </div>
                </div>
                {/* Desktop row */}
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
                  <div className="flex items-center gap-1.5">
                    <TextInput value={row.name} onChange={v => updateIng(row.id, 'name', v)}
                      placeholder="Nama bahan" className="flex-1" />
                    {row.isDerived && (
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                        bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                    )}
                  </div>
                  <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)}
                    placeholder="14000" prefix="Rp" />
                  <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)}
                    placeholder="1000" />
                  <select value={row.unit}
                    onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                    className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                    <option value="gr">gr</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                  <NumInput value={row.usage} onChange={v => updateIng(row.id, 'usage', v)} placeholder="200" />
                  <NumInput value={row.yieldFactor} onChange={v => updateIng(row.id, 'yieldFactor', v)}
                    placeholder="0" suffix="%" />
                  <DeleteBtn onClick={() => removeIng(row.id)} />
                </div>
              </div>
            ))}
          </div>

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
          </div>
        </section>

        {/* Biaya Operasional */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<Zap size={15} />} label="Biaya Operasional" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}>
            {['Nama Biaya', 'Biaya Bulanan', 'Porsi %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {ops.map(row => (
              <div key={row.id}>
                <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)}
                      placeholder="Listrik, sewa, dsb." className="flex-1" />
                    <DeleteBtn onClick={() => removeOp(row.id)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Biaya Bulanan</p>
                      <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)}
                        placeholder="500000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Porsi dibebankan</p>
                      <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)}
                        placeholder="10" suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}>
                  <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)}
                    placeholder="Listrik, sewa, dsb." />
                  <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)}
                    placeholder="500000" prefix="Rp" />
                  <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)}
                    placeholder="10" suffix="%" />
                  <DeleteBtn onClick={() => removeOp(row.id)} />
                </div>
              </div>
            ))}
          </div>
          <AddRowBtn onClick={addOp} label="Tambah Biaya" />
        </section>

        {/* Parameter */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<SlidersHorizontal size={15} />} label="Parameter Produksi" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mode === 'batch' && (
              <div>
                <label className="block text-sm font-medium text-[#1A1A18] mb-1.5">Jumlah Produksi</label>
                <div className="relative flex items-center">
                  <input type="number" min="1" value={batchSize}
                    onChange={e => setBatchSize(e.target.value)}
                    className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl
                      px-3 pr-14 py-2.5 text-sm text-right focus:outline-none
                      focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] transition-colors" />
                  <span className="absolute right-3 text-xs text-[#C4BFBA] select-none">cup</span>
                </div>
                <p className="text-[11px] text-[#C4BFBA] mt-1.5">Berapa cup dalam satu sesi produksi</p>
              </div>
            )}
            <div className={mode === 'satuan' ? 'sm:col-span-1' : ''}>
              <label className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                Biaya Tetap Bulanan
                <span className="ml-1.5 text-[11px] font-normal text-[#9CA3AF]">untuk BEP</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[#C4BFBA] select-none">Rp</span>
                <input type="number" min="0" value={fixedCost}
                  onChange={e => setFixedCost(e.target.value)}
                  className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl
                    pl-8 pr-3 py-2.5 text-sm text-right focus:outline-none
                    focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] transition-colors" />
              </div>
              <p className="text-[11px] text-[#C4BFBA] mt-1.5">Total sewa, gaji, dan biaya tetap lainnya</p>
            </div>
          </div>
        </section>
      </div>

      <ResultsPanel result={result} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HPPCalculator.tsx
git commit -m "feat: add HPPCalculator component (satuan + batch modes)"
```

---

## Task 7: `TurunanCalculator`

**Files:**
- Create: `src/components/TurunanCalculator.tsx`

- [ ] **Step 1: Create `src/components/TurunanCalculator.tsx`**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Package, Zap, FlaskConical, Save, Trash2 } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { calculateDerivedHPP } from '@/lib/engine';
import { uid, parseNum, formatRp } from '@/lib/format';
import type { Ingredient, ProcessingCost, DerivedIngredient } from '@/types/hpp';

interface TurunanIngredientRow {
  id: string; name: string;
  purchasePrice: string; purchaseVolume: string;
  unit: 'gr' | 'ml' | 'pcs'; usage: string; yieldFactor: string;
}

interface ProcessingCostRow {
  id: string; name: string; price: string;
}

interface OutputProductRow {
  id: string; name: string; qty: string;
  unit: 'gr' | 'ml' | 'pcs'; sellPrice: string;
}

const emptyIngredient = (): TurunanIngredientRow => ({
  id: uid(), name: '', purchasePrice: '', purchaseVolume: '',
  unit: 'gr', usage: '', yieldFactor: '0',
});

const emptyProcessing = (): ProcessingCostRow => ({
  id: uid(), name: '', price: '',
});

const emptyOutput = (): OutputProductRow => ({
  id: uid(), name: '', qty: '', unit: 'gr', sellPrice: '',
});

export function TurunanCalculator({
  derivedIngredients,
  onSave,
  onRemove,
}: {
  derivedIngredients: DerivedIngredient[];
  onSave: (items: DerivedIngredient[]) => void;
  onRemove: (id: string) => void;
}) {
  const [processName, setProcessName] = useState('');
  const [inputs, setInputs] = useState<TurunanIngredientRow[]>([emptyIngredient()]);
  const [processingCosts, setProcessingCosts] = useState<ProcessingCostRow[]>([emptyProcessing()]);
  const [outputs, setOutputs] = useState<OutputProductRow[]>([emptyOutput()]);

  const updateInput = (id: string, field: keyof TurunanIngredientRow, val: string) =>
    setInputs(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const updateProcessing = (id: string, field: keyof ProcessingCostRow, val: string) =>
    setProcessingCosts(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const updateOutput = (id: string, field: keyof OutputProductRow, val: string) =>
    setOutputs(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const derivedResults = useMemo(() => {
    try {
      const ingList = inputs
        .filter(r => parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0 && parseNum(r.usage) > 0)
        .map(r => ({
          ingredient: {
            id: r.id, name: r.name,
            purchasePrice: parseNum(r.purchasePrice),
            purchaseVolume: parseNum(r.purchaseVolume),
            unit: r.unit, usage: parseNum(r.usage),
          } satisfies Ingredient,
          yieldFactor: Math.max(0.01, 1 - Math.min(0.99, parseNum(r.yieldFactor) / 100)),
        }));

      const procList: ProcessingCost[] = processingCosts
        .filter(r => parseNum(r.price) > 0)
        .map(r => ({ id: r.id, name: r.name, price: parseNum(r.price) }));

      const outputList = outputs
        .filter(r => parseNum(r.qty) > 0 && r.name.trim())
        .map(r => ({
          id: r.id, name: r.name,
          qty: parseNum(r.qty), unit: r.unit,
          sellPrice: parseNum(r.sellPrice),
        }));

      if (ingList.length === 0 && procList.length === 0) return [];
      if (outputList.length === 0) return [];

      return calculateDerivedHPP({ ingredients: ingList, processingCosts: procList, outputs: outputList });
    } catch {
      return [];
    }
  }, [inputs, processingCosts, outputs]);

  const totalCost = useMemo(() => {
    const ingCost = inputs
      .filter(r => parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0 && parseNum(r.usage) > 0)
      .reduce((sum, r) => {
        const ppu = parseNum(r.purchasePrice) / parseNum(r.purchaseVolume);
        const yf = Math.max(0.01, 1 - Math.min(0.99, parseNum(r.yieldFactor) / 100));
        return sum + (ppu * parseNum(r.usage)) / yf;
      }, 0);
    const procCost = processingCosts.reduce((sum, r) => sum + parseNum(r.price), 0);
    return ingCost + procCost;
  }, [inputs, processingCosts]);

  const handleSaveAll = () => {
    if (derivedResults.length === 0) return;
    const items: DerivedIngredient[] = derivedResults.map(r => ({
      id: r.id, name: r.name, unit: r.unit, costPerUnit: r.hpp,
    }));
    onSave(items);
  };

  return (
    <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">
      <div className="space-y-5">

        {/* Nama proses */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<FlaskConical size={15} />} label="Nama Proses" />
          <TextInput
            value={processName}
            onChange={setProcessName}
            placeholder="cth. Roasting Kopi Maelo, Breakdown Ayam Kampung"
            className="w-full"
          />
          <p className="text-[11px] text-[#C4BFBA] mt-1.5">Nama proses pengolahan bahan baku</p>
        </section>

        {/* Bahan Baku */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<Package size={15} />} label="Bahan Baku" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
            {['Nama Bahan', 'Harga Beli', 'Volume', 'Satuan', 'Pakai', 'Susut %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {inputs.map(row => (
              <div key={row.id}>
                <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <TextInput value={row.name} onChange={v => updateInput(row.id, 'name', v)}
                      placeholder="Nama bahan" className="flex-1" />
                    <DeleteBtn onClick={() => setInputs(prev => prev.filter(r => r.id !== row.id))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Harga Beli</p>
                      <NumInput value={row.purchasePrice} onChange={v => updateInput(row.id, 'purchasePrice', v)}
                        placeholder="14000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Volume</p>
                      <NumInput value={row.purchaseVolume} onChange={v => updateInput(row.id, 'purchaseVolume', v)}
                        placeholder="1000" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Satuan</p>
                      <select value={row.unit}
                        onChange={e => updateInput(row.id, 'unit', e.target.value as TurunanIngredientRow['unit'])}
                        className="w-full bg-white border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Pemakaian</p>
                      <NumInput value={row.usage} onChange={v => updateInput(row.id, 'usage', v)} placeholder="200" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Susut</p>
                      <NumInput value={row.yieldFactor} onChange={v => updateInput(row.id, 'yieldFactor', v)}
                        placeholder="0" suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
                  <TextInput value={row.name} onChange={v => updateInput(row.id, 'name', v)} placeholder="Nama bahan" />
                  <NumInput value={row.purchasePrice} onChange={v => updateInput(row.id, 'purchasePrice', v)}
                    placeholder="14000" prefix="Rp" />
                  <NumInput value={row.purchaseVolume} onChange={v => updateInput(row.id, 'purchaseVolume', v)}
                    placeholder="1000" />
                  <select value={row.unit}
                    onChange={e => updateInput(row.id, 'unit', e.target.value as TurunanIngredientRow['unit'])}
                    className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                    <option value="gr">gr</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                  <NumInput value={row.usage} onChange={v => updateInput(row.id, 'usage', v)} placeholder="200" />
                  <NumInput value={row.yieldFactor} onChange={v => updateInput(row.id, 'yieldFactor', v)}
                    placeholder="0" suffix="%" />
                  <DeleteBtn onClick={() => setInputs(prev => prev.filter(r => r.id !== row.id))} />
                </div>
              </div>
            ))}
          </div>
          <AddRowBtn onClick={() => setInputs(prev => [...prev, emptyIngredient()])} label="Tambah Bahan" />
        </section>

        {/* Biaya Pengolahan */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<Zap size={15} />} label="Biaya Pengolahan" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 148px 36px' }}>
            {['Nama Biaya', 'Harga', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {processingCosts.map(row => (
              <div key={row.id} className="flex gap-2 items-center">
                <TextInput value={row.name} onChange={v => updateProcessing(row.id, 'name', v)}
                  placeholder="Tenaga potong, listrik, gas…" className="flex-1" />
                <NumInput value={row.price} onChange={v => updateProcessing(row.id, 'price', v)}
                  placeholder="5000" prefix="Rp" className="w-36" />
                <DeleteBtn onClick={() => setProcessingCosts(prev => prev.filter(r => r.id !== row.id))} />
              </div>
            ))}
          </div>
          <AddRowBtn onClick={() => setProcessingCosts(prev => [...prev, emptyProcessing()])} label="Tambah Biaya" />
        </section>

        {/* Produk Turunan (outputs) */}
        <section className="bg-white rounded-2xl border-2 border-[#1A6B3C]/30 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#1A6B3C]"><FlaskConical size={15} /></span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#1A1A18]">Produk yang Dihasilkan</h2>
            </div>
            {totalCost > 0 && (
              <span className="text-[11px] text-[#78716C]">
                Total biaya: <strong className="text-[#1A1A18]">{formatRp(totalCost)}</strong>
              </span>
            )}
          </div>
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 80px 72px 104px 1fr 36px' }}>
            {['Nama Produk', 'Jumlah', 'Satuan', 'Harga Jual/Sat', 'HPP/Satuan', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {outputs.map((row, i) => {
              const res = derivedResults.find(r => r.id === row.id);
              return (
                <div key={row.id}>
                  <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <TextInput value={row.name} onChange={v => updateOutput(row.id, 'name', v)}
                        placeholder="Nama produk" className="flex-1" />
                      <DeleteBtn onClick={() => setOutputs(prev => prev.filter(r => r.id !== row.id))} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-[#C4BFBA] mb-1">Jumlah</p>
                        <NumInput value={row.qty} onChange={v => updateOutput(row.id, 'qty', v)} placeholder="250" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[#C4BFBA] mb-1">Satuan</p>
                        <select value={row.unit}
                          onChange={e => updateOutput(row.id, 'unit', e.target.value as OutputProductRow['unit'])}
                          className="w-full bg-white border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                            focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                          <option value="gr">gr</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#C4BFBA] mb-1">Harga Jual</p>
                        <NumInput value={row.sellPrice} onChange={v => updateOutput(row.id, 'sellPrice', v)}
                          placeholder="80" prefix="Rp" />
                      </div>
                    </div>
                    {res && (
                      <div className="flex items-center justify-between bg-[#ECFDF5] rounded-lg px-3 py-2">
                        <span className="text-[10px] text-[#1A6B3C]">HPP per {row.unit}</span>
                        <span className="text-sm font-bold text-[#1A6B3C]">{formatRp(res.hpp)}</span>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:grid gap-2 items-center"
                    style={{ gridTemplateColumns: '1fr 80px 72px 104px 1fr 36px' }}>
                    <TextInput value={row.name} onChange={v => updateOutput(row.id, 'name', v)} placeholder="Nama produk" />
                    <NumInput value={row.qty} onChange={v => updateOutput(row.id, 'qty', v)} placeholder="250" />
                    <select value={row.unit}
                      onChange={e => updateOutput(row.id, 'unit', e.target.value as OutputProductRow['unit'])}
                      className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                      <option value="gr">gr</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                    <NumInput value={row.sellPrice} onChange={v => updateOutput(row.id, 'sellPrice', v)}
                      placeholder="80" prefix="Rp" />
                    <div className={`rounded-xl px-3 py-2 text-sm text-right font-bold
                      ${res ? 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#1A6B3C]' : 'text-[#C4BFBA]'}`}>
                      {res ? formatRp(res.hpp) : '—'}
                    </div>
                    <DeleteBtn onClick={() => setOutputs(prev => prev.filter(r => r.id !== row.id))} />
                  </div>
                </div>
              );
            })}
          </div>
          <AddRowBtn onClick={() => setOutputs(prev => [...prev, emptyOutput()])} label="Tambah Produk" />
        </section>
      </div>

      {/* Right panel */}
      <div className="mt-5 lg:mt-0 lg:sticky lg:top-[73px] space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
            Ringkasan
          </span>
          <div className="mb-3">
            <p className="text-[11px] text-[#78716C]">Total biaya input</p>
            <p className="text-2xl font-bold text-[#1A1A18] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {totalCost > 0 ? formatRp(totalCost) : 'Rp —'}
            </p>
          </div>
          {derivedResults.length > 0 && (
            <div className="border-t border-[#E5E3DD] pt-3 space-y-2">
              {derivedResults.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-[#1A1A18] truncate mr-2">{r.name}</span>
                  <span className="text-[11px] font-bold text-[#1A6B3C] shrink-0">
                    {formatRp(r.hpp)}/{r.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={derivedResults.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-[#1A6B3C] text-white
            rounded-xl py-3 text-sm font-bold transition-opacity
            disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#15803D]"
        >
          <Save size={15} />
          Simpan {derivedResults.length > 0 ? `${derivedResults.length} Produk` : 'Produk'}
        </button>

        {/* Saved list */}
        {derivedIngredients.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
              Tersimpan
            </span>
            <div className="space-y-1">
              {derivedIngredients.map(di => (
                <div key={di.id} className="flex items-center justify-between py-1.5
                  border-b border-[#F0EDE8] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A18]">{di.name}</p>
                    <p className="text-[11px] text-[#78716C]">
                      {formatRp(di.costPerUnit)}/{di.unit}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemove(di.id)}
                    className="text-[#C4BFBA] hover:text-red-400 transition-colors ml-2">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TurunanCalculator.tsx
git commit -m "feat: add TurunanCalculator component with multi-output HPP allocation"
```

---

## Task 8: Refactor `page.tsx` to thin orchestrator

**Files:**
- Modify: `app/calculator/page.tsx`

Replace the entire contents of `app/calculator/page.tsx` with:

- [ ] **Step 1: Rewrite `app/calculator/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { ChefHat } from 'lucide-react';
import { ModeSelectorCards, type CalcMode } from '@/components/ModeSelectorCards';
import { HPPCalculator } from '@/components/HPPCalculator';
import { TurunanCalculator } from '@/components/TurunanCalculator';
import { useDerivedIngredients } from '@/hooks/useDerivedIngredients';

export default function CalculatorPage() {
  const [activeMode, setActiveMode] = useState<CalcMode>('satuan');
  const { ingredients: derivedIngredients, save, remove } = useDerivedIngredients();

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
          />
        </div>
        <div className={activeMode !== 'turunan' ? 'hidden' : ''}>
          <TurunanCalculator
            derivedIngredients={derivedIngredients}
            onSave={save}
            onRemove={remove}
          />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and verify**

```bash
bun run dev
```

Open http://localhost:3000 and verify:
- Mode cards appear at top (Satuan active by default with green accent bar)
- Switching between Satuan and Batch works, form state is preserved
- Satuan mode: no batch size field, results show HPP per cup only
- Batch mode: batch size field appears, results show total per batch
- Turunan mode: shows the full 4-section form
- Saving a derived ingredient in Turunan, then switching to Satuan: "Dari Bahan Turunan" button appears, clicking shows saved item in dropdown
- Adding a derived ingredient via the picker adds a row with green "Turunan" badge
- Refreshing the page: derived ingredients persist (localStorage)

- [ ] **Step 3: Run full test suite**

```bash
bun test
```

Expected: all 48 tests pass, no errors.

- [ ] **Step 4: Commit**

```bash
git add app/calculator/page.tsx
git commit -m "feat: wire up mode selector, HPPCalculator, and TurunanCalculator in page"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 3 mode cards at top (Task 5)
- ✅ Mode cards: Option C design — minimal with accent bar (Task 5)
- ✅ Toggle replaced by mode cards (Task 8)
- ✅ Satuan mode: HPP per cup (Task 6)
- ✅ Batch mode: HPP per cup + total per batch (Task 6)
- ✅ Bahan Turunan: nama proses, bahan baku, biaya pengolahan, produk output (Task 7)
- ✅ Multiple output products (Task 7)
- ✅ Relative sales value allocation (Task 2 + 7)
- ✅ Fallback to equal-per-unit when sellPrice = 0 (Task 2)
- ✅ localStorage persistence (Task 3)
- ✅ "+ Dari Bahan Turunan" picker in Satuan/Batch (Task 6)
- ✅ "Turunan" badge on derived ingredient rows (Task 6)
- ✅ Saved ingredients panel in TurunanCalculator with delete (Task 7)
- ✅ State lifted to page.tsx so Turunan saves sync to Satuan/Batch without remount (Task 8)

**Type consistency:**
- `DerivedIngredient` (hpp.ts) used in: hook, HPPCalculator props, TurunanCalculator props, page.tsx
- `DerivedProductOutput` (hpp.ts) used in: engine return type, TurunanCalculator useMemo
- `ProcessingCost` (hpp.ts) used in: engine input, TurunanCalculator
- `CalcMode` (ModeSelectorCards.tsx) exported and used by page.tsx
- `BEPResult` (engine.ts) used in ResultsPanel — must import from `@/lib/engine`

**Note on `BEPResult` import in `ResultsPanel.tsx`:** `BEPResult` is defined in `engine.ts` (not `hpp.ts`). The import `import type { BEPResult } from '@/lib/engine'` is correct.
