# Design: Recap Table, PDF Payment Summary & Dashboard Custom Filter

**Date:** 2026-05-16
**Scope:** Transaction recap table in Financial Health, payment summary function + PDF updates, Dashboard custom date range

---

## Context

Previous session already implemented:
- `paymentMethod?: 'CASH' | 'QRIS'` on `SaleRecord`
- Payment toggle in POS + ShiftClosing breakdown
- DateRangePicker + Cash/QRIS breakdown widget in Financial Health

This spec adds three new capabilities on top of that foundation.

---

## 1. `getPaymentSummary` — `src/lib/generateReport.ts`

Export a pure utility function:

```ts
import type { SaleRecord } from '@/types/hpp';

export function getPaymentSummary(records: SaleRecord[]): {
  totalCash: number;
  totalQRIS: number;
  totalCombined: number;
} {
  const active = records.filter(r => !r.cancelled);
  const totalCash = active
    .filter(r => (r.paymentMethod ?? 'CASH') === 'CASH')
    .reduce((s, r) => s + r.totalRevenue, 0);
  const totalQRIS = active
    .filter(r => r.paymentMethod === 'QRIS')
    .reduce((s, r) => s + r.totalRevenue, 0);
  return { totalCash, totalQRIS, totalCombined: totalCash + totalQRIS };
}
```

Backward compat: `undefined` paymentMethod → treated as `'CASH'` via `?? 'CASH'`.

---

## 2. PDF Updates — `src/lib/generateReport.ts`

### 2a. `SalesReportData` interface extension

Add `paymentMethod?: string` to the transactions array member:

```ts
transactions: {
  timestamp: string;
  itemsLabel: string;
  tier: string;
  revenue: number;
  profit: number;
  note?: string;
  cancelled?: boolean;
  paymentMethod?: string;  // ← new
}[];
```

### 2b. `generateSalesReport` — Payment summary section

After KPI row 2, before the Top Menus table, add a "Rekap Pembayaran" section — rendered only if `data.txCount > 0`:

- Compute cash/QRIS totals inline from `data.transactions` (filter by `paymentMethod ?? 'CASH'`)
- Three side-by-side KPI boxes: `Total CASH`, `Total QRIS`, `Grand Total`
- Same `kpiBox()` helper used for other KPI rows

### 2c. `MonthlyReportData` interface extension

Add `transactions` field (same shape as `SalesReportData.transactions`):

```ts
transactions: {
  timestamp: string;
  itemsLabel: string;
  tier: string;
  revenue: number;
  profit: number;
  note?: string;
  cancelled?: boolean;
  paymentMethod?: string;
}[];
```

### 2d. `generateMonthlyReport` — Transaction detail table

After the Low Stock table (last section), add a transaction detail table — rendered only if `data.transactions.length > 0`.

Columns: `[Waktu, Menu, Tier, Metode, Omzet, Laba]`

Shows active (non-cancelled) transactions up to 30 rows, same styling as `generateSalesReport`'s transaction table. `paymentMethod ?? 'CASH'` for display.

### 2e. Callers to update

`app/dashboard/page.tsx` — `handleExportPdf` (line ~779) passes transactions; add `paymentMethod: r.paymentMethod` to each transaction object in the map call.

`app/financial-health/page.tsx` — `handleDownloadMonthlyReport` (line ~354) calls `generateMonthlyReport`; add `transactions` field built from `filteredRecords`:
```ts
transactions: filteredRecords
  .filter(r => !r.cancelled)
  .slice(0, 30)
  .map(r => ({
    timestamp: r.timestamp,
    itemsLabel: r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', '),
    tier: r.tier,
    revenue: r.totalRevenue,
    profit: r.grossProfit,
    note: r.note,
    paymentMethod: r.paymentMethod,
  })),
```

---

## 3. Recap Table — `app/financial-health/page.tsx`

### Placement

Below the Cash/QRIS breakdown widget, before the investment inputs section.

### Data source

```ts
const recapRecords = useMemo(
  () => filteredRecords.filter(r => !r.cancelled)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  [filteredRecords],
);
```

Rendered only if `recapRecords.length > 0`.

### State

```ts
const [recapPage, setRecapPage] = useState(0);
const RECAP_PAGE_SIZE = 20;
```

Reset `recapPage` to 0 when `filteredRecords` changes (useEffect dep on filteredRecords).

### Table columns

| Column | Source |
|--------|--------|
| Tanggal | `new Date(r.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })` |
| ID Transaksi | `r.id.slice(0, 8)` in monospace |
| Menu | `r.items.map(i => \`${i.qty}× ${i.recipeName}\`).join(', ')` |
| Qty | `r.items.reduce((s, i) => s + i.qty, 0)` |
| Total | `formatRp(r.totalRevenue)` |
| Metode | `r.paymentMethod ?? 'CASH'` — pill badge: green for CASH, blue for QRIS |

### UI card

```
[ REKAP TRANSAKSI ]  (n transaksi)
┌──────┬──────────┬────────────┬─────┬───────────┬────────┐
│Tgl   │ID        │Menu        │ Qty │ Total     │Metode  │
├──────┼──────────┼────────────┼─────┼───────────┼────────┤
│...   │...       │...         │  2  │ Rp 10.000 │CASH    │
└──────┴──────────┴────────────┴─────┴───────────┴────────┘
   [← Sebelumnya]  1 / 3  [Berikutnya →]
```

Card style: `bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden`.

---

## 4. Dashboard Custom Date Range — `app/dashboard/page.tsx`

### Type extension

```ts
type Period = 'today' | 'month' | 'all' | 'custom';
```

### New state

```ts
const [customStart, setCustomStart] = useState('');
const [customEnd,   setCustomEnd]   = useState('');
```

### `filterByPeriod` update

```ts
function filterByPeriod(
  records: SaleRecord[],
  period: Period,
  customStart?: string,
  customEnd?: string,
): SaleRecord[] {
  const now = new Date();
  return records.filter(r => {
    const d = new Date(r.timestamp);
    if (period === 'today')  return d.toDateString() === now.toDateString();
    if (period === 'month')  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'custom') {
      const s = customStart ? new Date(customStart) : new Date(0);
      const e = customEnd   ? new Date(customEnd + 'T23:59:59') : now;
      return d >= s && d <= e;
    }
    return true; // 'all'
  });
}
```

### `filterPrevPeriod` update

When `period === 'custom'`, return `[]` (no prev-period comparison available).

### `current` useMemo

```ts
const current = useMemo(
  () => filterByPeriod(records, period, customStart, customEnd).filter(r => !r.cancelled),
  [records, period, customStart, customEnd],
);
```

### UI — Period selector + date inputs

Period buttons row (4 buttons: Hari Ini, Bulan Ini, Semua Waktu, Custom).

When `period === 'custom'`, date inputs appear on the line below:

```
[ Hari Ini ] [ Bulan Ini ] [ Semua Waktu ] [ Custom ]
  [tanggal mulai ____]  —  [tanggal akhir ____]
```

Input style matches Financial Health date pickers. Both inputs optional; empty = no bound.

### `Profit Bersih` widget

No additional changes needed — `labaBersih` is already derived from `current` → automatically reflects the custom date range.

### `monthsElapsed` for opex

When `period === 'custom'`:
```ts
const msRange = (customEnd ? new Date(customEnd + 'T23:59:59') : now).getTime()
  - (customStart ? new Date(customStart).getTime() : (current[0] ? new Date(current[0].timestamp).getTime() : now.getTime()));
const monthsElapsed = Math.max(1/30, msRange / (30.44 * 24 * 60 * 60 * 1000));
```

---

## Backward Compatibility

- `transactions` in `MonthlyReportData` — callers that don't yet pass it receive an empty array by default (add `= []` default or make optional)
- All existing `SaleRecord` entries without `paymentMethod` display as `'CASH'`

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/generateReport.ts` | Add `getPaymentSummary`, extend interfaces, add PDF sections |
| `app/financial-health/page.tsx` | Add recap table + `recapPage` state |
| `app/dashboard/page.tsx` | Add `'custom'` period + date inputs + update `filterByPeriod` |
| `app/dashboard/page.tsx` | Pass `paymentMethod` in `handleExportPdf` transactions |
