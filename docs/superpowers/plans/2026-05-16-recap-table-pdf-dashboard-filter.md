# Recap Table, PDF Payment Summary & Dashboard Custom Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `getPaymentSummary` utility, enrich Sales + Monthly PDFs with payment breakdown, show a paginated transaction recap table in Financial Health, and add a Custom date range option to the Dashboard period selector.

**Architecture:** Three independent layers — (1) a pure utility function in `generateReport.ts`, (2) UI additions to two existing pages (`financial-health/page.tsx`, `dashboard/page.tsx`), (3) PDF output enrichment in `generateReport.ts`. Each task is self-contained and can be committed separately. No new files are created.

**Tech Stack:** Next.js App Router, React (useState/useMemo/useEffect), TypeScript, jsPDF + jspdf-autotable, Tailwind CSS, Bun (tests via `bun test`)

---

## Context for implementers

- **Spec:** `docs/superpowers/specs/2026-05-16-recap-table-pdf-dashboard-filter-design.md`
- **Types:** `src/types/hpp.ts` — `SaleRecord` has `paymentMethod?: 'CASH' | 'QRIS'`; old records without this field default to `'CASH'` everywhere via `?? 'CASH'`
- **generateReport.ts** is at `src/lib/generateReport.ts`; it exports `generateSalesReport` and `generateMonthlyReport`; **it imports jsPDF (browser-only)** — do not import this module in Bun test files
- **Financial Health page** is at `app/financial-health/page.tsx` (~1013 lines). Already has `startDate`/`endDate` state, `filteredRecords` useMemo, and a Cash/QRIS breakdown widget at line 441. The payment breakdown ends at line 497; investment inputs start at line 499.
- **Dashboard page** is at `app/dashboard/page.tsx` (~1452 lines). Has `type Period = 'today' | 'month' | 'all'` and `filterByPeriod` helper function.
- Run `bun test` to run the test suite. Run `bun dev` to start the dev server for manual UI verification.

---

## File Map

| File | Changes |
|------|---------|
| `src/lib/generateReport.ts` | Add `getPaymentSummary`; extend `SalesReportData` + `MonthlyReportData`; add PDF sections |
| `app/financial-health/page.tsx` | Add `recapPage` state, `recapRecords` memo, recap table JSX, `handleDownloadMonthlyReport` update |
| `app/dashboard/page.tsx` | Add `'custom'` Period, `customStart`/`customEnd` state, update `filterByPeriod` + `filterPrevPeriod`, add UI date inputs, pass `paymentMethod` in PDF export |

---

## Task 1: `getPaymentSummary` + extend `SalesReportData`

**Files:**
- Modify: `src/lib/generateReport.ts:1-22` (imports + SalesReportData interface)

- [ ] **Step 1: Add `SaleRecord` import to `generateReport.ts`**

At the top of `src/lib/generateReport.ts`, line 3 currently reads:
```ts
import type { PricingTier } from '@/types/hpp';
```

Change it to:
```ts
import type { PricingTier, SaleRecord } from '@/types/hpp';
```

- [ ] **Step 2: Extend `SalesReportData.transactions[]` with `paymentMethod`**

In `src/lib/generateReport.ts`, find the `SalesReportData` interface (around line 9). The `transactions` field currently is:
```ts
transactions: { timestamp: string; itemsLabel: string; tier: string; revenue: number; profit: number; note?: string; cancelled?: boolean }[];
```

Add `paymentMethod?: string` to the end of the member type:
```ts
transactions: { timestamp: string; itemsLabel: string; tier: string; revenue: number; profit: number; note?: string; cancelled?: boolean; paymentMethod?: string }[];
```

- [ ] **Step 3: Add `getPaymentSummary` export to `generateReport.ts`**

After the `SalesReportData` interface (before `generateSalesReport` function), add:

```ts
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

- [ ] **Step 4: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors related to `getPaymentSummary` or `SalesReportData`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/generateReport.ts
git commit -m "feat: add getPaymentSummary and extend SalesReportData.transactions with paymentMethod"
```

---

## Task 2: Payment breakdown section in `generateSalesReport` + Dashboard PDF caller update

**Files:**
- Modify: `src/lib/generateReport.ts` (inside `generateSalesReport` function)
- Modify: `app/dashboard/page.tsx` (inside `handleExportPdf`)

- [ ] **Step 1: Add "Rekap Pembayaran" section to `generateSalesReport`**

In `src/lib/generateReport.ts`, inside `generateSalesReport`, find this block (it comes right after the second KPI row, before the monthly target section):

```ts
  // KPI row 2
  kpiBox(doc, ML,           y, kw, 17, 'Profit Bersih',   formatRp(data.labaBersih), data.labaBersih >= 0 ? C.green : C.red);
  kpiBox(doc, ML + kw + 3,  y, kw, 17, 'Jumlah Transaksi', String(data.txCount));
  kpiBox(doc, ML + kw*2+6,  y, kw, 17, 'Rata-rata / Tx',  data.avgTx > 0 ? formatRp(data.avgTx) : '—');
  y += 22;

  // Monthly target progress bar
```

Insert the following block **between** `y += 22;` and `// Monthly target progress bar`:

```ts
  // Payment breakdown
  if (data.txCount > 0) {
    const cashTotal = data.transactions
      .filter(t => !t.cancelled && (t.paymentMethod ?? 'CASH') === 'CASH')
      .reduce((s, t) => s + t.revenue, 0);
    const qrisTotal = data.transactions
      .filter(t => !t.cancelled && t.paymentMethod === 'QRIS')
      .reduce((s, t) => s + t.revenue, 0);
    sectionLabel(doc, 'Rekap Pembayaran', ML, y);
    y += 4;
    kpiBox(doc, ML,          y, kw, 17, 'Total CASH', formatRp(cashTotal));
    kpiBox(doc, ML + kw + 3, y, kw, 17, 'Total QRIS', formatRp(qrisTotal), C.green);
    kpiBox(doc, ML + kw*2+6, y, kw, 17, 'Grand Total', formatRp(cashTotal + qrisTotal), C.green);
    y += 22;
  }
```

- [ ] **Step 2: Update `handleExportPdf` in `app/dashboard/page.tsx` to pass `paymentMethod`**

In `app/dashboard/page.tsx`, find `handleExportPdf` (around line 775). The transactions map currently is:
```ts
transactions: current.slice(0, 30).map(r => ({
  timestamp: r.timestamp,
  itemsLabel: r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', '),
  tier: r.tier,
  revenue: r.totalRevenue,
  profit: r.grossProfit,
  note: r.note,
  cancelled: r.cancelled,
})),
```

Add `paymentMethod: r.paymentMethod` at the end of the object:
```ts
transactions: current.slice(0, 30).map(r => ({
  timestamp: r.timestamp,
  itemsLabel: r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', '),
  tier: r.tier,
  revenue: r.totalRevenue,
  profit: r.grossProfit,
  note: r.note,
  cancelled: r.cancelled,
  paymentMethod: r.paymentMethod,
})),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Manual verification**

Start dev server (`bun dev`), open dashboard, click "Export PDF". Confirm that:
- The PDF shows a "REKAP PEMBAYARAN" section with three KPI boxes (Total CASH, Total QRIS, Grand Total)
- Values add up correctly

- [ ] **Step 5: Commit**

```bash
git add src/lib/generateReport.ts app/dashboard/page.tsx
git commit -m "feat: add payment breakdown section to sales PDF report"
```

---

## Task 3: `MonthlyReportData` extension + transaction table in Monthly PDF + Financial Health caller update

**Files:**
- Modify: `src/lib/generateReport.ts` (`MonthlyReportData` interface + `generateMonthlyReport` function)
- Modify: `app/financial-health/page.tsx` (`handleDownloadMonthlyReport` at line ~354)

- [ ] **Step 1: Add optional `transactions` field to `MonthlyReportData`**

In `src/lib/generateReport.ts`, find the `MonthlyReportData` interface (around line 182):

```ts
export interface MonthlyReportData {
  periodLabel: string;
  omzet: number;
  grossProfit: number;
  netProfit: number;
  txCount: number;
  totalItemsSold: number;
  opex: number;
  trend: { day: number; omzet: number; profit: number }[];
  menuEngineering: {
    name: string;
    category: 'star' | 'puzzle' | 'plowhorse' | 'dog';
    qty: number;
    margin: number;
    revenue: number;
  }[];
  lowStock: {
    name: string;
    unit: string;
    current: number;
    min: number;
  }[];
}
```

Add `transactions?:` at the end (before the closing `}`):

```ts
  transactions?: {
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

- [ ] **Step 2: Add transaction detail table to `generateMonthlyReport`**

In `src/lib/generateReport.ts`, inside `generateMonthlyReport`, find the end of the Low Stock table section. It ends with:
```ts
    });
  }

  const totalPages: number = (doc as any).internal.getNumberOfPages();
```

Insert the following block **between** the closing `}` of the Low Stock section and the `const totalPages` line:

```ts
  // Transaction detail table
  const txList = data.transactions ?? [];
  const activeTx = txList.filter(t => !t.cancelled);
  if (activeTx.length > 0) {
    if (y + 40 > FOOT) { doc.addPage(); y = 20; }
    sectionLabel(doc, `Detail Transaksi (${activeTx.length})`, ML, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Waktu', 'Menu', 'Tier', 'Metode', 'Omzet', 'Laba']],
      body: activeTx.map(t => [
        new Date(t.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        t.itemsLabel,
        t.tier,
        t.paymentMethod ?? 'CASH',
        formatRp(t.revenue),
        formatRp(t.profit),
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 2.5, right: 4, bottom: 2.5, left: 4 }, lineColor: C.border, lineWidth: 0.15 },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      bodyStyles: { textColor: C.dark },
      alternateRowStyles: { fillColor: C.beige },
      margin: { left: ML, right: MR },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }
```

- [ ] **Step 3: Update `handleDownloadMonthlyReport` in `app/financial-health/page.tsx`**

Find `handleDownloadMonthlyReport` (line ~354):

```ts
  const handleDownloadMonthlyReport = () => {
    generateMonthlyReport({
      periodLabel,
      omzet: currentMonthStats.omzet,
      grossProfit: currentMonthStats.grossProfit,
      netProfit: currentMonthStats.grossProfit - opex,
      txCount: currentMonthStats.txCount,
      totalItemsSold: currentMonthStats.totalItemsSold,
      opex,
      trend: currentMonthTrend,
      menuEngineering: menuEngineeringData,
      lowStock: lowStockData,
    });
    toast.success(`Laporan ${periodLabel} diunduh`);
  };
```

Add `transactions:` field before the closing `});`:

```ts
  const handleDownloadMonthlyReport = () => {
    generateMonthlyReport({
      periodLabel,
      omzet: currentMonthStats.omzet,
      grossProfit: currentMonthStats.grossProfit,
      netProfit: currentMonthStats.grossProfit - opex,
      txCount: currentMonthStats.txCount,
      totalItemsSold: currentMonthStats.totalItemsSold,
      opex,
      trend: currentMonthTrend,
      menuEngineering: menuEngineeringData,
      lowStock: lowStockData,
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
    });
    toast.success(`Laporan ${periodLabel} diunduh`);
  };
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Manual verification**

Open Financial Health page, click "Unduh Laporan Bulanan" (or equivalent PDF button). Confirm the PDF has a "DETAIL TRANSAKSI" table at the end with Waktu, Menu, Tier, Metode, Omzet, Laba columns.

- [ ] **Step 6: Commit**

```bash
git add src/lib/generateReport.ts app/financial-health/page.tsx
git commit -m "feat: add transaction detail table to monthly PDF report"
```

---

## Task 4: Recap Table in Financial Health

**Files:**
- Modify: `app/financial-health/page.tsx`

- [ ] **Step 1: Add `ChevronLeft` and `ChevronRight` to lucide imports**

Find the lucide import block at the top of `app/financial-health/page.tsx`:
```ts
import {
  TrendingUp, TrendingDown, Plus, Trash2, Target,
  CalendarCheck, Wallet, AlertTriangle, CheckCircle,
  Clock, BarChart3, Edit3, Check, FileDown, Star,
} from 'lucide-react';
```

Add `ChevronLeft, ChevronRight` to the list:
```ts
import {
  TrendingUp, TrendingDown, Plus, Trash2, Target,
  CalendarCheck, Wallet, AlertTriangle, CheckCircle,
  Clock, BarChart3, Edit3, Check, FileDown, Star,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
```

- [ ] **Step 2: Add `recapPage` state and `RECAP_PAGE_SIZE` constant**

Find the block where other state variables are declared near the top of `DashboardPage` / the page function (around line 84–100 in `app/financial-health/page.tsx`). Add after the existing `useState` declarations (e.g., after `startDate`/`endDate` state):

```ts
  const [recapPage, setRecapPage] = useState(0);
  const RECAP_PAGE_SIZE = 20;
```

- [ ] **Step 3: Add `recapRecords` useMemo**

After the `filteredRecords` useMemo (around line 153), add:

```ts
  const recapRecords = useMemo(
    () => filteredRecords
      .filter(r => !r.cancelled)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filteredRecords],
  );
```

- [ ] **Step 4: Add useEffect to reset page when filter changes**

After the `recapRecords` useMemo, add:

```ts
  useEffect(() => { setRecapPage(0); }, [filteredRecords]);
```

(`useEffect` is already imported on line 3 — no import change needed.)

- [ ] **Step 5: Add recap table JSX**

In the JSX, find the comment `{/* ── Investment inputs ── */}` (around line 499). Insert the following block **immediately before** it (after the closing `})()}` of the payment breakdown widget at line 497):

```tsx
        {/* ── Recap Table ── */}
        {recapRecords.length > 0 && (() => {
          const totalPages = Math.ceil(recapRecords.length / RECAP_PAGE_SIZE);
          const page = Math.min(recapPage, Math.max(0, totalPages - 1));
          const pageRecs = recapRecords.slice(page * RECAP_PAGE_SIZE, (page + 1) * RECAP_PAGE_SIZE);
          return (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-subtle)]">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
                  Rekap Transaksi
                </span>
                <span className="ml-auto text-xs text-[var(--text-3)]">
                  {recapRecords.length} transaksi
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['Tanggal', 'ID', 'Menu', 'Qty', 'Total', 'Metode'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                            i >= 3 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRecs.map(r => {
                      const method = r.paymentMethod ?? 'CASH';
                      const qty = r.items.reduce((s, i) => s + i.qty, 0);
                      return (
                        <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                          <td className="px-4 py-3 text-xs text-[var(--text-2)] whitespace-nowrap">
                            {new Date(r.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-[11px] font-mono text-[var(--text-3)]">
                            {r.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text)] max-w-[200px] truncate">
                            {r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}
                          </td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums text-[var(--text-2)]">
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-xs text-right tabular-nums font-medium text-[var(--text)]">
                            {formatRp(r.totalRevenue)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              method === 'QRIS'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-[var(--tint-amber)] text-[#27B18A]'
                            }`}>
                              {method}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setRecapPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg)]"
                  >
                    <ChevronLeft size={14} /> Sebelumnya
                  </button>
                  <span className="text-xs text-[var(--text-3)] tabular-nums">
                    {page + 1} / {totalPages}
                    <span className="text-[var(--text-4)] ml-1.5">
                      ({page * RECAP_PAGE_SIZE + 1}–{Math.min((page + 1) * RECAP_PAGE_SIZE, recapRecords.length)} dari {recapRecords.length})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecapPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg)]"
                  >
                    Berikutnya <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })()}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Manual verification**

Open Financial Health page with some transactions in the current date range. Confirm:
- Recap table appears between the Cash/QRIS breakdown and investment inputs
- Columns show: Tanggal, ID (8 chars), Menu, Qty, Total, Metode (pill badge — green for CASH, blue for QRIS)
- Paginator appears only when > 20 records
- Changing the date range resets the table to page 1

- [ ] **Step 8: Commit**

```bash
git add app/financial-health/page.tsx
git commit -m "feat: add paginated transaction recap table to financial health"
```

---

## Task 5: Dashboard Custom Date Range Period

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Extend `Period` type and update label maps**

In `app/dashboard/page.tsx`, find:
```ts
type Period = 'today' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hari Ini',
  month: 'Bulan Ini',
  all: 'Semua Waktu',
};

const PREV_PERIOD_LABELS: Record<Period, string> = {
  today: 'kemarin',
  month: 'bulan lalu',
  all: '',
};
```

Replace with:
```ts
type Period = 'today' | 'month' | 'all' | 'custom';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hari Ini',
  month: 'Bulan Ini',
  all: 'Semua Waktu',
  custom: 'Custom',
};

const PREV_PERIOD_LABELS: Record<Period, string> = {
  today: 'kemarin',
  month: 'bulan lalu',
  all: '',
  custom: '',
};
```

- [ ] **Step 2: Update `filterByPeriod` to handle `'custom'`**

Find `filterByPeriod`:
```ts
function filterByPeriod(records: SaleRecord[], period: Period): SaleRecord[] {
  const now = new Date();
  return records.filter(r => {
    const d = new Date(r.timestamp);
    if (period === 'today') return d.toDateString() === now.toDateString();
    if (period === 'month')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });
}
```

Replace with:
```ts
function filterByPeriod(records: SaleRecord[], period: Period, customStart = '', customEnd = ''): SaleRecord[] {
  const now = new Date();
  return records.filter(r => {
    const d = new Date(r.timestamp);
    if (period === 'today') return d.toDateString() === now.toDateString();
    if (period === 'month')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'custom') {
      const s = customStart ? new Date(customStart) : new Date(0);
      const e = customEnd   ? new Date(customEnd + 'T23:59:59') : now;
      return d >= s && d <= e;
    }
    return true;
  });
}
```

- [ ] **Step 3: Update `filterPrevPeriod` to return `[]` for `'custom'`**

Find `filterPrevPeriod`:
```ts
function filterPrevPeriod(records: SaleRecord[], period: Period): SaleRecord[] {
  const now = new Date();
  return records.filter(r => {
```

Add an early return at the top of the function:
```ts
function filterPrevPeriod(records: SaleRecord[], period: Period): SaleRecord[] {
  if (period === 'custom' || period === 'all') return [];
  const now = new Date();
  return records.filter(r => {
```

(Note: the existing code already falls through to `return false` for `'all'`, but making it explicit avoids confusion.)

- [ ] **Step 4: Add `customStart`/`customEnd` state in `DashboardPage`**

In `DashboardPage`, find the existing `useState` declarations (around line 738). Add after `const [period, setPeriod] = useState<Period>('month');`:

```ts
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
```

- [ ] **Step 5: Update `current` and `previous` useMemos to pass custom dates**

Find:
```ts
  const current = useMemo(
    () => filterByPeriod(records, period).filter(r => !r.cancelled),
    [records, period],
  );
  const previous = useMemo(
    () => filterPrevPeriod(records, period).filter(r => !r.cancelled),
    [records, period],
  );
```

Replace with:
```ts
  const current = useMemo(
    () => filterByPeriod(records, period, customStart, customEnd).filter(r => !r.cancelled),
    [records, period, customStart, customEnd],
  );
  const previous = useMemo(
    () => filterPrevPeriod(records, period).filter(r => !r.cancelled),
    [records, period],
  );
```

- [ ] **Step 6: Update `monthsElapsed` calculation inside `metrics` useMemo**

In the `metrics` useMemo (around line 815), find:
```ts
    const monthsElapsed = (() => {
      if (period === 'today') return 1 / 30;
      if (period === 'month') return 1;
      if (current.length === 0) return 0;
      const earliest = Math.min(...current.map(r => new Date(r.timestamp).getTime()));
      const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
      return Math.max(1, (Date.now() - earliest) / msPerMonth);
    })();
```

Replace with:
```ts
    const monthsElapsed = (() => {
      if (period === 'today') return 1 / 30;
      if (period === 'month') return 1;
      if (period === 'custom') {
        const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
        const s = customStart ? new Date(customStart).getTime() : (current.length > 0 ? new Date(current[current.length - 1].timestamp).getTime() : Date.now());
        const e = customEnd ? new Date(customEnd + 'T23:59:59').getTime() : Date.now();
        return Math.max(1 / 30, (e - s) / msPerMonth);
      }
      if (current.length === 0) return 0;
      const earliest = Math.min(...current.map(r => new Date(r.timestamp).getTime()));
      const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
      return Math.max(1, (Date.now() - earliest) / msPerMonth);
    })();
```

Note: `metrics` useMemo currently has `[current, previous, opex, period]` in its deps. Add `customStart, customEnd`:
```ts
  }, [current, previous, opex, period, customStart, customEnd]);
```

- [ ] **Step 7: Update the period selector UI**

Find the period selector buttons block in the JSX (around line 1040):
```tsx
        <div className="flex items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                period === p
                  ? 'bg-[#27B18A] text-white border-[#27B18A]'
                  : 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:border-[#27B18A]/30'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
```

Replace with:
```tsx
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  period === p
                    ? 'bg-[#27B18A] text-white border-[#27B18A]'
                    : 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:border-[#27B18A]/30'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[#27B18A]"
              />
              <span className="text-[var(--text-3)] text-sm">—</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[#27B18A]"
              />
            </div>
          )}
        </div>
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `bun run tsc --noEmit`
Expected: No errors.

- [ ] **Step 9: Manual verification**

Open Dashboard, click "Custom". Confirm:
- Date inputs appear below the period buttons
- Selecting a date range updates all KPIs including "Profit Bersih"
- TrendPill shows `null` (no percentage) when period is `'custom'` (since `prevLabel` is `''`)
- Switching back to "Bulan Ini" hides the date inputs

- [ ] **Step 10: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add custom date range period to dashboard"
```

---

## Self-Review Checklist (for the plan author)

- [x] **Spec coverage:**
  - Spec §1 `getPaymentSummary` → Task 1 ✓
  - Spec §2a `SalesReportData.transactions[].paymentMethod` → Task 1 ✓
  - Spec §2b "Rekap Pembayaran" in `generateSalesReport` → Task 2 ✓
  - Spec §2c `MonthlyReportData.transactions?` → Task 3 ✓
  - Spec §2d transaction table in `generateMonthlyReport` → Task 3 ✓
  - Spec §2e callers updated → Task 2 (dashboard) + Task 3 (financial-health) ✓
  - Spec §3 Recap Table in Financial Health → Task 4 ✓
  - Spec §4 Dashboard Custom Period → Task 5 ✓
- [x] **Placeholder scan:** All steps have complete code blocks. No TBD.
- [x] **Type consistency:** `paymentMethod?: string` used consistently across interfaces. `filterByPeriod` signature matches all call sites.
