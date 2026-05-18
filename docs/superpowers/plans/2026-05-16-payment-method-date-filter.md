# Payment Method & Date Range Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah toggle CASH/QRIS di kasir, rekap pembayaran per metode di ShiftClosing dan Financial Health, dan date range filter di Financial Health.

**Architecture:** Tiga file dimodifikasi. `SaleRecord` mendapat field opsional `paymentMethod`. POS mendapat state + toggle UI + pass ke store. FinancialHealth mendapat `filteredRecords` useMemo yang menggantikan semua akses langsung ke `records` di KPI memos, plus breakdown widget dan date range picker.

**Tech Stack:** React (useState, useMemo), TypeScript, Tailwind CSS

---

## File Map

| File | Perubahan |
|------|-----------|
| `src/types/hpp.ts` | Tambah `paymentMethod?: 'CASH' \| 'QRIS'` ke `SaleRecord` |
| `app/page.tsx` | State + toggle UI di OrderPanel + mobile sheet + pass ke addSaleRecord + ShiftClosing breakdown table |
| `app/financial-health/page.tsx` | State date range + `filteredRecords` useMemo + ganti semua `records` di KPI memos + breakdown widget |

---

## Task 1: Add `paymentMethod` to SaleRecord type

**Files:**
- Modify: `src/types/hpp.ts:99-115`

- [ ] **Tambah field opsional ke SaleRecord**

Di `src/types/hpp.ts`, tambahkan satu baris setelah `note?: string;` (baris ~109):

```ts
export interface SaleRecord {
  id: string;
  timestamp: string;
  tier: 'competitive' | 'standard' | 'premium';
  items: SaleItem[];
  totalRevenue: number;
  totalHPP: number;
  grossProfit: number;
  deductions?: SaleDeduction[];
  cancelled?: boolean;
  note?: string;
  paymentMethod?: 'CASH' | 'QRIS';   // ← tambah ini
  customerId?: string;
  loyaltyRedeemed?: boolean;
  discountType?: 'percent' | 'nominal';
  discountValue?: number;
  discountAmount?: number;
}
```

- [ ] **Verifikasi TypeScript tidak error**

```powershell
cd C:\Users\Rafael\Herd\profitly && npx tsc --noEmit 2>&1 | head -20
```

Expected: tidak ada output error baru.

- [ ] **Commit**

```powershell
git add src/types/hpp.ts
git commit -m "feat: add paymentMethod field to SaleRecord"
```

---

## Task 2: POS — Payment method state, toggle UI, dan checkout

**Files:**
- Modify: `app/page.tsx`

### 2a — State dan pass ke OrderPanel

- [ ] **Tambah state `paymentMethod` di POSPage**

Di `app/page.tsx`, di dalam `POSPage()` setelah baris `const [mobileSheetOpen, setMobileSheetOpen] = useState(false);` (~baris 200), tambahkan:

```tsx
const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
```

- [ ] **Sertakan paymentMethod di addSaleRecord**

Di `handleCheckout`, ganti blok `const record = addSaleRecord({...})`. Tambah field `paymentMethod` setelah field `grossProfit`:

```tsx
const record = addSaleRecord({
  tier,
  items: cartLines.map(l => ({
    recipeId: l.recipe.id,
    recipeName: l.recipe.name,
    qty: l.qty,
    sellPrice: isLoyaltyFree ? 0 : l.sellPrice,
    hpp: l.recipe.hpp,
    subtotal: isLoyaltyFree ? 0 : l.subtotal,
  })),
  totalRevenue: effectiveRevenue,
  totalHPP: totals.hpp,
  grossProfit: effectiveProfit,
  paymentMethod,                          // ← tambah ini
  deductions: Array.from(deductionMap.entries()).map(([name, { amount, unit }]) => ({
    name,
    amount,
    unit: unit as 'gr' | 'ml' | 'pcs',
  })),
  ...(note.trim() ? { note: note.trim() } : {}),
  ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
  ...(isLoyaltyFree ? { loyaltyRedeemed: true } : {}),
  ...(discountAmount > 0 ? {
    discountType,
    discountValue: parseNum(discountRaw),
    discountAmount,
  } : {}),
});
```

- [ ] **Reset paymentMethod setelah checkout berhasil**

Di dalam `setTimeout(...)` setelah `setCart({})`, tambahkan:

```tsx
setPaymentMethod('CASH');
```

- [ ] **Pass paymentMethod dan setter ke OrderPanel (desktop)**

Ganti panggilan `<OrderPanel` yang ada dengan:

```tsx
<OrderPanel
  cartLines={cartLines}
  totals={{ revenue: effectiveRevenue, hpp: totals.hpp, profit: effectiveProfit }}
  totalQty={totalQty}
  isLoyaltyFree={isLoyaltyFree}
  discountType={discountType}
  discountRaw={discountRaw}
  discountAmount={discountAmount}
  onDiscountTypeChange={setDiscountType}
  onDiscountRawChange={setDiscountRaw}
  note={note}
  onNoteChange={setNote}
  paymentMethod={paymentMethod}
  onPaymentMethodChange={setPaymentMethod}
  onCheckout={handleCheckout}
  isProcessing={isProcessing}
  onSetQty={(id, qty) => setCart(prev => qty === 0 ? (() => { const { [id]: _, ...r } = prev; return r; })() : { ...prev, [id]: qty })}
/>
```

### 2b — Toggle UI di OrderPanel

- [ ] **Tambah props ke tipe OrderPanel**

Di definisi props tipe `OrderPanel` (sekitar baris 728), tambahkan dua prop baru:

```tsx
function OrderPanel({
  cartLines,
  totals,
  totalQty,
  isLoyaltyFree = false,
  discountType,
  discountRaw,
  discountAmount,
  onDiscountTypeChange,
  onDiscountRawChange,
  note,
  onNoteChange,
  paymentMethod,                     // ← tambah
  onPaymentMethodChange,             // ← tambah
  onCheckout,
  isProcessing = false,
  onSetQty,
}: {
  cartLines: { recipe: { id: string; name: string; hpp: number }; qty: number; sellPrice: number; subtotal: number }[];
  totals: { revenue: number; hpp: number; profit: number };
  totalQty: number;
  isLoyaltyFree?: boolean;
  discountType: 'percent' | 'nominal';
  discountRaw: string;
  discountAmount: number;
  onDiscountTypeChange: (t: 'percent' | 'nominal') => void;
  onDiscountRawChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  paymentMethod: 'CASH' | 'QRIS';                       // ← tambah
  onPaymentMethodChange: (m: 'CASH' | 'QRIS') => void;  // ← tambah
  onCheckout: () => void;
  isProcessing?: boolean;
  onSetQty: (id: string, qty: number) => void;
})
```

- [ ] **Tambah toggle UI di dalam OrderPanel**

Di dalam `<div className="px-5 pb-5 space-y-3">` (area bawah OrderPanel, setelah blok `{/* Note field */}` dan sebelum tombol Selesaikan), tambahkan:

```tsx
{/* Metode Pembayaran */}
<div>
  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
    Metode Pembayaran
  </label>
  <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
    {(['CASH', 'QRIS'] as const).map(m => (
      <button
        key={m}
        type="button"
        onClick={() => onPaymentMethodChange(m)}
        className={`flex-1 py-2 text-xs font-bold transition-colors ${
          paymentMethod === m
            ? 'bg-[#27B18A] text-white'
            : 'bg-[var(--surface)] text-[var(--text-2)]'
        }`}
      >
        {m}
      </button>
    ))}
  </div>
</div>
```

### 2c — Toggle UI di mobile sheet

- [ ] **Tambah toggle metode pembayaran di mobile bottom sheet**

Di dalam blok `{mobileSheetOpen && (<div className="px-4 pb-2 ...">)}`, setelah blok `{/* Note */}` dan sebelum `{/* Totals summary */}`, tambahkan:

```tsx
{/* Metode Pembayaran */}
<div className="mb-3">
  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
    Metode Pembayaran
  </label>
  <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
    {(['CASH', 'QRIS'] as const).map(m => (
      <button
        key={m}
        type="button"
        onClick={() => setPaymentMethod(m)}
        className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
          paymentMethod === m
            ? 'bg-[#27B18A] text-white'
            : 'bg-[var(--surface)] text-[var(--text-2)]'
        }`}
      >
        {m}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Verifikasi TypeScript**

```powershell
npx tsc --noEmit 2>&1 | head -20
```

Expected: tidak ada error baru.

- [ ] **Commit**

```powershell
git add app/page.tsx
git commit -m "feat: add payment method toggle to POS checkout"
```

---

## Task 3: ShiftClosing — Tabel rekap pembayaran Cash/QRIS

**Files:**
- Modify: `app/page.tsx` (komponen `ShiftClosing`)

- [ ] **Tambah tabel rekap di ShiftClosing**

Di dalam fungsi `ShiftClosing`, setelah `const topIngredients = ...`, tambahkan dua konstanta:

```tsx
const cashRecs = todayRecords.filter(r => (r.paymentMethod ?? 'CASH') === 'CASH');
const qrisRecs = todayRecords.filter(r => r.paymentMethod === 'QRIS');
```

Lalu di JSX, setelah blok `{topIngredients.length > 0 && (...)}` dan sebelum `<div className="space-y-2.5">` (area tombol WA + arsipkan), tambahkan:

```tsx
{todayRecords.length > 0 && (
  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
    <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
        Rekap Pembayaran
      </span>
    </div>
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-subtle)]">
          {(['Metode', 'Transaksi', 'Omzet'] as const).map((h, i) => (
            <th
              key={h}
              className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                i === 0 ? 'text-left' : 'text-right'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {([
          { label: 'CASH', recs: cashRecs },
          { label: 'QRIS', recs: qrisRecs },
        ] as { label: string; recs: typeof todayRecords }[]).map(({ label, recs }) => (
          <tr key={label} className="border-b border-[var(--border-subtle)]">
            <td className="px-5 py-2.5 text-sm font-medium text-[var(--text)]">{label}</td>
            <td className="px-5 py-2.5 text-sm text-right tabular-nums text-[var(--text-2)]">
              {recs.length}×
            </td>
            <td className="px-5 py-2.5 text-sm text-right tabular-nums text-[var(--text)]">
              {formatRp(recs.reduce((s, r) => s + r.totalRevenue, 0))}
            </td>
          </tr>
        ))}
        <tr className="bg-[var(--bg)]/40">
          <td className="px-5 py-2.5 text-sm font-bold text-[var(--text)]">Total</td>
          <td className="px-5 py-2.5 text-sm font-bold text-right tabular-nums text-[var(--text)]">
            {todayRecords.length}×
          </td>
          <td className="px-5 py-2.5 text-sm font-bold text-right tabular-nums text-[#27B18A]">
            {formatRp(omzet)}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Verifikasi TypeScript**

```powershell
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Commit**

```powershell
git add app/page.tsx
git commit -m "feat: add cash/qris breakdown table to shift closing"
```

---

## Task 4: Financial Health — Date range filter dan filteredRecords

**Files:**
- Modify: `app/financial-health/page.tsx`

### 4a — State date range

- [ ] **Tambah imports tambahan**

Di baris import, tambahkan `Calendar` dari lucide-react (jika belum ada) — atau cukup gunakan teks saja, tidak perlu ikon tambahan.

- [ ] **Tambah state date range**

Di `FinancialHealthPage`, cari baris `const now = new Date();` (sekitar baris 270, setelah semua useState). Langsung setelah baris itu, tambahkan:

```tsx
const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
const defaultEnd = now.toISOString().split('T')[0];
const [startDate, setStartDate] = useState(defaultStart);
const [endDate, setEndDate] = useState(defaultEnd);
```

### 4b — filteredRecords useMemo

- [ ] **Tambah filteredRecords setelah deklarasi `now` dan sebelum useMemo pertama**

Setelah baris `const periodLabel = now.toLocaleDateString(...)`, tambahkan:

```tsx
const filteredRecords = useMemo(() => {
  const s = new Date(startDate || defaultStart);
  const e = new Date((endDate || defaultEnd) + 'T23:59:59');
  return records.filter(r => {
    const d = new Date(r.timestamp);
    return d >= s && d <= e;
  });
}, [records, startDate, endDate]);
```

### 4c — Ganti `records` → `filteredRecords` di semua KPI memos

- [ ] **Update `monthlyData` memo**

Ganti seluruh `monthlyData` useMemo dengan:

```tsx
const monthlyData = useMemo(() => {
  const map = new Map<string, number>();
  for (const r of filteredRecords) {
    if (r.cancelled) continue;
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + r.grossProfit);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, gross]) => ({
      ym,
      label: monthLabel(ym),
      grossProfit: gross,
      netProfit: gross - opex,
    }));
}, [filteredRecords, opex]);
```

- [ ] **Update `cashFlowForecast` memo**

Ganti seluruh `cashFlowForecast` useMemo dengan:

```tsx
const cashFlowForecast = useMemo(() => {
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last7 = filteredRecords.filter(r => !r.cancelled && new Date(r.timestamp) >= cutoff7d);
  const dailyAvgRevenue = last7.reduce((s, r) => s + r.totalRevenue, 0) / 7;
  const dailyAvgProfit  = last7.reduce((s, r) => s + r.grossProfit,  0) / 7;
  const active = filteredRecords.filter(r => !r.cancelled);
  const mtdRevenue = active.reduce((s, r) => s + r.totalRevenue, 0);
  const mtdProfit  = active.reduce((s, r) => s + r.grossProfit,  0);
  const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();
  return {
    hasData: last7.length > 0,
    dailyAvgRevenue,
    dailyAvgProfit,
    mtdRevenue,
    mtdProfit,
    daysRemaining,
    forecastRevenue: mtdRevenue + dailyAvgRevenue * daysRemaining,
    forecastProfit:  mtdProfit  + dailyAvgProfit  * daysRemaining,
  };
}, [filteredRecords]);
```

- [ ] **Update `currentMonthTrend` memo**

Ganti seluruh `currentMonthTrend` useMemo dengan:

```tsx
const currentMonthTrend = useMemo(() => {
  const map = new Map<number, { omzet: number; profit: number }>();
  for (const r of filteredRecords) {
    if (r.cancelled) continue;
    const day = new Date(r.timestamp).getDate();
    const prev = map.get(day) ?? { omzet: 0, profit: 0 };
    map.set(day, { omzet: prev.omzet + r.totalRevenue, profit: prev.profit + r.grossProfit });
  }
  const endD = endDate ? new Date(endDate) : now;
  const daysInMonth = new Date(endD.getFullYear(), endD.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    omzet:  map.get(i + 1)?.omzet  ?? 0,
    profit: map.get(i + 1)?.profit ?? 0,
  }));
}, [filteredRecords, endDate]);
```

- [ ] **Update `currentMonthStats` memo**

Ganti seluruh `currentMonthStats` useMemo dengan:

```tsx
const currentMonthStats = useMemo(() => {
  const mtd = filteredRecords.filter(r => !r.cancelled);
  const omzet        = mtd.reduce((s, r) => s + r.totalRevenue, 0);
  const grossProfit  = mtd.reduce((s, r) => s + r.grossProfit,  0);
  const totalItemsSold = mtd.reduce((s, r) => s + r.items.reduce((a, it) => a + it.qty, 0), 0);
  return { omzet, grossProfit, txCount: mtd.length, totalItemsSold };
}, [filteredRecords]);
```

- [ ] **Update `menuEngineeringData` memo**

Ganti seluruh `menuEngineeringData` useMemo dengan:

```tsx
const menuEngineeringData = useMemo(() => {
  const qtyMap = new Map<string, number>();
  const revMap = new Map<string, number>();
  for (const r of filteredRecords) {
    if (r.cancelled) continue;
    for (const it of r.items) {
      qtyMap.set(it.recipeName, (qtyMap.get(it.recipeName) ?? 0) + it.qty);
      revMap.set(it.recipeName, (revMap.get(it.recipeName) ?? 0) + it.subtotal);
    }
  }
  const items = Array.from(qtyMap.entries()).map(([name, qty]) => {
    const recipe    = recipes.find(r => r.name === name);
    const revenue   = revMap.get(name) ?? 0;
    const sellPrice = revenue / qty || 0;
    const margin    = sellPrice > 0 && recipe ? (sellPrice - recipe.hpp) / sellPrice : 0;
    return { name, qty, revenue, margin };
  });
  if (items.length === 0) return [];
  const avgQty    = items.reduce((s, it) => s + it.qty,    0) / items.length;
  const avgMargin = items.reduce((s, it) => s + it.margin, 0) / items.length;
  return items.map(it => {
    const highQty    = it.qty    >= avgQty;
    const highMargin = it.margin >= avgMargin;
    const category = highQty && highMargin ? 'star'
      : !highQty && highMargin ? 'puzzle'
      : highQty && !highMargin ? 'plowhorse'
      : 'dog';
    return { ...it, category } as typeof it & { category: 'star' | 'puzzle' | 'plowhorse' | 'dog' };
  });
}, [filteredRecords, recipes]);
```

### 4d — Date range picker UI

- [ ] **Tambah date range picker setelah div judul halaman**

Di JSX, setelah `</div>` penutup blok `{/* ── Page title ── */}`, tambahkan card baru:

```tsx
{/* ── Date range filter ── */}
<div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4">
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] shrink-0">
      Rentang Waktu
    </span>
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <input
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        className="flex-1 min-w-0 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2
          text-sm focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
          text-[var(--text)]"
      />
      <span className="text-xs text-[var(--text-4)] shrink-0">—</span>
      <input
        type="date"
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
        className="flex-1 min-w-0 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2
          text-sm focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
          text-[var(--text)]"
      />
    </div>
    <button
      type="button"
      onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); }}
      className="text-xs font-medium text-[#27B18A] hover:text-[#0E927A] transition-colors shrink-0"
    >
      Reset bulan ini
    </button>
  </div>
</div>
```

- [ ] **Verifikasi TypeScript**

```powershell
npx tsc --noEmit 2>&1 | head -20
```

Expected: tidak ada error baru.

- [ ] **Commit**

```powershell
git add app/financial-health/page.tsx
git commit -m "feat: add date range filter to financial health"
```

---

## Task 5: Financial Health — Breakdown widget Cash/QRIS

**Files:**
- Modify: `app/financial-health/page.tsx`

- [ ] **Tambah breakdown widget setelah date range picker**

Di JSX, setelah card `{/* ── Date range filter ── */}` dan sebelum card `{/* ── Investment inputs ── */}`, tambahkan:

```tsx
{/* ── Payment breakdown ── */}
{filteredRecords.filter(r => !r.cancelled).length > 0 && (() => {
  const active   = filteredRecords.filter(r => !r.cancelled);
  const cashRecs = active.filter(r => (r.paymentMethod ?? 'CASH') === 'CASH');
  const qrisRecs = active.filter(r => r.paymentMethod === 'QRIS');
  const total    = active.reduce((s, r) => s + r.totalRevenue, 0);
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
          Rekap Pembayaran
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            {(['Metode', 'Transaksi', 'Omzet'] as const).map((h, i) => (
              <th
                key={h}
                className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                  i === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {([
            { label: 'CASH', recs: cashRecs },
            { label: 'QRIS', recs: qrisRecs },
          ] as { label: string; recs: typeof active }[]).map(({ label, recs }) => (
            <tr key={label} className="border-b border-[var(--border-subtle)]">
              <td className="px-5 py-2.5 text-sm font-medium text-[var(--text)]">{label}</td>
              <td className="px-5 py-2.5 text-sm text-right tabular-nums text-[var(--text-2)]">
                {recs.length}×
              </td>
              <td className="px-5 py-2.5 text-sm text-right tabular-nums text-[var(--text)]">
                {formatRp(recs.reduce((s, r) => s + r.totalRevenue, 0))}
              </td>
            </tr>
          ))}
          <tr className="bg-[var(--bg)]/40">
            <td className="px-5 py-2.5 text-sm font-bold text-[var(--text)]">Total</td>
            <td className="px-5 py-2.5 text-sm font-bold text-right tabular-nums text-[var(--text)]">
              {active.length}×
            </td>
            <td className="px-5 py-2.5 text-sm font-bold text-right tabular-nums text-[#27B18A]">
              {formatRp(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
})()}
```

- [ ] **Verifikasi TypeScript final**

```powershell
npx tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error.

- [ ] **Build check**

```powershell
npx next build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` atau sejenisnya tanpa error.

- [ ] **Commit final**

```powershell
git add app/financial-health/page.tsx
git commit -m "feat: add cash/qris breakdown widget to financial health"
```

---

## Checklist Verifikasi Manual

Setelah semua task selesai, verifikasi hal-hal berikut di browser:

- [ ] Di POS (tab Kasir), toggle CASH/QRIS muncul di panel pesanan desktop dan mobile sheet
- [ ] Transaksi berhasil dicatat — toggle kembali ke CASH setelah checkout
- [ ] Di Tutup Shift, tabel Rekap Pembayaran muncul dengan baris CASH, QRIS, Total
- [ ] Di Financial Health, date range picker muncul dengan default awal bulan → hari ini
- [ ] Mengubah date range memperbarui semua widget KPI di bawahnya
- [ ] Tombol "Reset bulan ini" mengembalikan ke default
- [ ] Widget Rekap Pembayaran muncul (jika ada transaksi di rentang tersebut)
- [ ] Record lama (tanpa `paymentMethod`) terhitung sebagai CASH, bukan QRIS
