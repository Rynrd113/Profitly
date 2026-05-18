# Design: Payment Method & Date Range Filter

**Date:** 2026-05-16  
**Scope:** POS payment toggle, Cash/QRIS recap widgets, Financial Health date filter

---

## 1. Data Layer — `src/types/hpp.ts`

Add one optional field to `SaleRecord`:

```ts
paymentMethod?: 'CASH' | 'QRIS';
```

Optional (not required) so existing records stored in localStorage remain valid. All display logic treats `undefined` as `'CASH'`.

No changes to `salesStore.ts` — `add()` already spreads arbitrary fields from `Omit<SaleRecord, 'id' | 'timestamp'>`.

---

## 2. POS — `app/page.tsx`

### State
```ts
const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
```

### UI Toggle
Placed in `OrderPanel` (between note textarea and checkout button) and duplicated in the mobile bottom sheet. Same pill-style toggle used for discount type (`%` / `Rp`):

```
[ CASH ]  [ QRIS ]
```

### Checkout
Pass `paymentMethod` into `addSaleRecord({ ..., paymentMethod })`.  
Reset `paymentMethod` back to `'CASH'` after checkout succeeds.

### ShiftClosing — Rekap Pembayaran
Below the existing 2×2 KPI grid, add a payment breakdown section:

| Metode | Transaksi | Omzet |
|--------|-----------|-------|
| CASH   | n×        | Rp X  |
| QRIS   | n×        | Rp X  |
| **Total** | **n×** | **Rp X** |

Logic:
```ts
const cashRecs = todayRecords.filter(r => (r.paymentMethod ?? 'CASH') === 'CASH');
const qrisRecs = todayRecords.filter(r => r.paymentMethod === 'QRIS');
```

Only rendered if `todayRecords.length > 0`.

---

## 3. Financial Health — `app/financial-health/page.tsx`

### Date Range State
```ts
const [startDate, setStartDate] = useState<string>(/* first day of current month, YYYY-MM-DD */);
const [endDate, setEndDate]     = useState<string>(/* today, YYYY-MM-DD */);
```

Default: first day of current month → today. If both fields are empty, fall back to current month.

### UI
Two `<input type="date">` side by side, placed below the page title / above the first card.  
A "Reset" chip resets both to the current month default.

### Filtered Records
```ts
const filteredRecords = useMemo(() => {
  const s = startDate ? new Date(startDate) : startOfMonth;
  const e = endDate   ? new Date(endDate + 'T23:59:59') : new Date();
  return records.filter(r => {
    if (r.cancelled) return false;
    const d = new Date(r.timestamp);
    return d >= s && d <= e;
  });
}, [records, startDate, endDate]);
```

All KPI `useMemo` hooks that currently reference `records` directly are updated to use `filteredRecords` instead:
- `monthlyData`, `currentMonthTrend`, `currentMonthStats`, `menuEngineeringData`

`cashFlowForecast` has its own 7-day rolling window (`cutoff7d`). It will also use `filteredRecords` — `hasData` will naturally be false if the filter window has no records in the last 7 days. Acceptable behavior.

`cumulativeData`, `paybackMonths`, and the investment/opex memos are NOT affected (they aggregate all-time profit for payback calculation, not period-specific KPIs).

**Edge case:** If `startDate > endDate`, `filteredRecords` is empty — zero state shown, no crash.

### Cash/QRIS Breakdown Widget
New card placed immediately below the date range picker (before the investment inputs), showing:

| Metode | Transaksi | Omzet |
|--------|-----------|-------|
| CASH   | n×        | Rp X  |
| QRIS   | n×        | Rp X  |
| **Total** | **n×** | **Rp X** |

Logic:
```ts
const cashRecs = filteredRecords.filter(r => (r.paymentMethod ?? 'CASH') === 'CASH');
const qrisRecs = filteredRecords.filter(r => r.paymentMethod === 'QRIS');
```

Only rendered if `filteredRecords.length > 0`.

---

## 4. PDF Report — `src/lib/generateReport.ts`

No changes. The `generateMonthlyReport` caller in `financial-health/page.tsx` already passes pre-computed stats derived from `filteredRecords`, so filtered data flows through naturally.

---

## Backward Compatibility

- Old `SaleRecord` entries without `paymentMethod` → treated as `'CASH'` everywhere via `?? 'CASH'`
- No migrations, no schema version bumps

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/hpp.ts` | Add `paymentMethod?: 'CASH' \| 'QRIS'` to `SaleRecord` |
| `app/page.tsx` | Payment state + toggle UI + pass to store + ShiftClosing breakdown |
| `app/financial-health/page.tsx` | Date range state + filteredRecords + replace records usages + breakdown widget |
