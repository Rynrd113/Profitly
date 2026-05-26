'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, X,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Package,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useSalesStore } from '@/store/salesStore';
import { useFinanceStore } from '@/store/financeStore';
import { formatRp } from '@/lib/format';
import { FIXED_CATEGORIES, VARIABLE_CATEGORIES } from '@/types/finance';
import type { Expense, CashflowEntry } from '@/types/finance';
import type { SaleRecord } from '@/types/hpp';

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(ds: string) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

interface RecapItem {
  recipeName: string;
  portionUnit: string;
  totalQty: number;
  totalRevenue: number;
  totalHPP: number;
  grossProfit: number;
}

interface TooltipPayload { name: string; value: number; color: string; }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-[var(--text)] mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {formatRp(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function FinancePage() {
  const { allRecords, hydrate } = useSalesStore();
  const { entries, migrated, bulkAddEntries, addEntry, deleteEntry, setMigrated } = useFinanceStore();

  const migrationRanRef = useRef(false);

  useEffect(() => {
    hydrate();
  }, []);

  // One-time migration: old Expense[] + historical SaleRecords → CashflowEntry[]
  useEffect(() => {
    if (migrated || migrationRanRef.current) return;
    migrationRanRef.current = true;

    const toAdd: Omit<CashflowEntry, 'id'>[] = [];

    // Migrate old profitly-expenses (Expense[])
    try {
      const raw = localStorage.getItem('profitly-expenses');
      if (raw) {
        const d = JSON.parse(raw);
        const oldExp: Expense[] = d?.state?.expenses ?? [];
        for (const e of oldExp) {
          toAdd.push({ type: 'OUT', expenseType: e.type, category: e.category, amount: e.amount, date: e.date, note: e.note ?? '' });
        }
      }
    } catch { /* ignore */ }

    // Migrate historical sales as IN entries
    try {
      const dec = (r: string): unknown => {
        try { return JSON.parse(decodeURIComponent(atob(r))); }
        catch { return JSON.parse(r); }
      };
      const get = (k: string): unknown => { const r = localStorage.getItem(k); return r ? dec(r) : null; };

      const activeRaw = get('profitly-sales-records');
      const active: SaleRecord[] = Array.isArray(activeRaw) ? activeRaw
        : (activeRaw as Record<string, unknown>)?.state !== undefined
          ? ((activeRaw as { state: { records: SaleRecord[] } }).state?.records ?? [])
          : [];

      const archiveRaw = get('profitly-shift-archives');
      const archiveArr = Array.isArray(archiveRaw) ? archiveRaw : [];
      const archived: SaleRecord[] = archiveArr.flatMap((a: { records?: SaleRecord[] }) => a.records ?? []);

      const existingRefs = new Set(entries.filter(e => e.referenceId).map(e => e.referenceId!));
      for (const r of [...archived, ...active]) {
        if (r.cancelled || existingRefs.has(r.id)) continue;
        toAdd.push({
          type: 'IN',
          date: r.timestamp.slice(0, 10),
          amount: r.totalRevenue,
          category: 'Penjualan',
          note: r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', '),
          referenceId: r.id,
        });
      }
    } catch { /* ignore */ }

    bulkAddEntries(toAdd);
    setMigrated();
  }, [allRecords]); // re-evaluate after hydrate populates allRecords

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() =>
    toDateStr(new Date(today.getFullYear(), today.getMonth(), 1)).slice(0, 7)
  );

  const monthStart = useMemo(() => new Date(selectedMonth + '-01T00:00:00'), [selectedMonth]);
  const monthEnd   = useMemo(() => new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59), [monthStart]);
  const isCurrentMonth = selectedMonth === toDateStr(new Date(today.getFullYear(), today.getMonth(), 1)).slice(0, 7);

  const monthSales = useMemo(() =>
    allRecords.filter(r => {
      if (r.cancelled) return false;
      const d = new Date(r.timestamp);
      return d >= monthStart && d <= monthEnd;
    }),
    [allRecords, monthStart, monthEnd]
  );

  const monthEntries = useMemo(() =>
    entries.filter(e => e.date >= selectedMonth + '-01' && e.date <= selectedMonth + '-31'),
    [entries, selectedMonth]
  );
  const monthInEntries  = useMemo(() => monthEntries.filter(e => e.type === 'IN'),  [monthEntries]);
  const monthOutEntries = useMemo(() => monthEntries.filter(e => e.type === 'OUT'), [monthEntries]);

  const totalOmzet   = useMemo(() => monthSales.reduce((s, r) => s + r.totalRevenue, 0), [monthSales]);
  const totalProfit  = useMemo(() => monthSales.reduce((s, r) => s + r.grossProfit, 0),  [monthSales]);
  const totalInflow  = useMemo(() => monthInEntries.reduce((s, e) => s + e.amount, 0),   [monthInEntries]);
  const totalOutflow = useMemo(() => monthOutEntries.reduce((s, e) => s + e.amount, 0),  [monthOutEntries]);
  const saldoKas     = totalInflow - totalOutflow;

  // Chart: Pemasukan (from salesStore) vs Pengeluaran (from OUT entries) per day
  const chartData = useMemo(() => {
    const result: Array<{ date: string; Pemasukan: number; Pengeluaran: number }> = [];
    const cursor = new Date(monthStart);
    const limit  = isCurrentMonth ? today : monthEnd;
    while (cursor <= limit) {
      const ds = toDateStr(cursor);
      const inflow  = monthSales.filter(r => r.timestamp.startsWith(ds)).reduce((s, r) => s + r.totalRevenue, 0);
      const outflow = monthOutEntries.filter(e => e.date === ds).reduce((s, e) => s + e.amount, 0);
      if (inflow > 0 || outflow > 0) result.push({ date: ds.slice(8), Pemasukan: inflow, Pengeluaran: outflow });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [monthSales, monthOutEntries, monthStart, monthEnd, isCurrentMonth]);

  // Sales recap grouped by product
  const salesRecap = useMemo<RecapItem[]>(() => {
    const map = new Map<string, RecapItem>();
    for (const sale of monthSales) {
      for (const item of sale.items) {
        const existing = map.get(item.recipeName);
        if (existing) {
          existing.totalQty     += item.qty;
          existing.totalRevenue += item.subtotal;
          existing.totalHPP     += item.hpp * item.qty;
          existing.grossProfit  += (item.sellPrice - item.hpp) * item.qty;
        } else {
          map.set(item.recipeName, {
            recipeName:   item.recipeName,
            portionUnit:  item.portionUnit ?? 'porsi',
            totalQty:     item.qty,
            totalRevenue: item.subtotal,
            totalHPP:     item.hpp * item.qty,
            grossProfit:  (item.sellPrice - item.hpp) * item.qty,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [monthSales]);

  // Journal entries sorted newest-first
  const journalEntries = useMemo(() =>
    [...monthEntries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [monthEntries]
  );

  // Expense form state
  const [showForm, setShowForm]       = useState(false);
  const [expType, setExpType]         = useState<'fixed' | 'variable'>('variable');
  const [expCategory, setExpCategory] = useState<string>(VARIABLE_CATEGORIES[0]);
  const [expAmount, setExpAmount]     = useState('');
  const [expDate, setExpDate]         = useState(toDateStr(today));
  const [expNote, setExpNote]         = useState('');

  const handleTypeChange = (t: 'fixed' | 'variable') => {
    setExpType(t);
    setExpCategory(t === 'fixed' ? FIXED_CATEGORIES[0] : VARIABLE_CATEGORIES[0]);
  };

  const handleAddExpense = () => {
    const amount = parseFloat(expAmount.replace(/\D/g, ''));
    if (!amount || amount <= 0) return;
    addEntry({ type: 'OUT', expenseType: expType, category: expCategory, amount, date: expDate, note: expNote });
    setExpAmount(''); setExpNote('');
    setShowForm(false);
  };

  const hasData = monthSales.length > 0 || monthOutEntries.length > 0;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[var(--bg)]" style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}>
        <Navbar active="finance" />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">

          {/* Header + month selector */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                Dashboard Keuangan
              </h1>
              <p className="text-sm text-[var(--text-3)] mt-0.5">Rekap penjualan & arus kas</p>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
            />
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">Total Omzet</span>
                <TrendingUp size={14} className="text-[#27B18A]" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                {formatRp(totalOmzet)}
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                {monthSales.length} transaksi bulan ini
              </p>
            </div>

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">Total Laba Kotor</span>
                <TrendingUp size={14} className="text-[#27B18A]" />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${totalProfit >= 0 ? 'text-[var(--text)]' : 'text-red-500'}`}
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                {formatRp(totalProfit)}
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                {totalOmzet > 0 ? `${Math.round(totalProfit / totalOmzet * 100)}% margin` : 'Belum ada penjualan'}
              </p>
            </div>

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">Saldo Kas</span>
                <Wallet size={14} className={saldoKas >= 0 ? 'text-[#27B18A]' : 'text-red-500'} />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${saldoKas >= 0 ? 'text-[var(--text)]' : 'text-red-500'}`}
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                {formatRp(saldoKas)}
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                Masuk {formatRp(totalInflow)} · Keluar {formatRp(totalOutflow)}
              </p>
            </div>
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-4">
                Pemasukan vs Pengeluaran
              </p>
              <div className="h-52 -ml-2">
                <ResponsiveContainer width="100%" height={208}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-4)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-4)' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--tint-amber)', opacity: 0.3 }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="Pemasukan"   fill="#27B18A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pengeluaran" fill="#F87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasData && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] py-14 px-6 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#27B18A]/10 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={28} className="text-[#27B18A]" />
              </div>
              <p className="text-base font-semibold text-[var(--text)] mb-1">Belum ada data bulan ini</p>
              <p className="text-sm text-[var(--text-3)] max-w-xs mx-auto">
                Data penjualan sinkron otomatis dari Kasir. Catat pengeluaran dengan tombol di bawah.
              </p>
            </div>
          )}

          {/* ── Sales Recap Table ────────────────────────────────────────── */}
          {salesRecap.length > 0 && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
                <Package size={14} className="text-[#27B18A]" />
                <h2 className="text-sm font-bold text-[var(--text)]">Rekap Penjualan</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['Produk', 'Satuan', 'Qty', 'Total Penjualan', 'Laba Kotor'].map((h, i) => (
                        <th key={h} className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]
                          ${i >= 2 ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesRecap.map(item => (
                      <tr key={item.recipeName}
                        className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg)]/40 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{item.recipeName}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#27B18A]/10 text-[#27B18A]">
                            {item.portionUnit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-right text-[var(--text-2)]">
                          {item.totalQty.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right text-[var(--text)]">
                          {formatRp(item.totalRevenue)}
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold tabular-nums text-right
                          ${item.grossProfit >= 0 ? 'text-[#27B18A]' : 'text-red-500'}`}>
                          {formatRp(item.grossProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[var(--border)]">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-sm font-bold tabular-nums text-right text-[var(--text)]">{formatRp(totalOmzet)}</td>
                      <td className={`px-4 py-3 text-sm font-bold tabular-nums text-right ${totalProfit >= 0 ? 'text-[#27B18A]' : 'text-red-500'}`}>
                        {formatRp(totalProfit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Cashflow Journal ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--text)]">Jurnal Arus Kas</h2>
              <button
                type="button"
                onClick={() => setShowForm(v => !v)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors
                  ${showForm
                    ? 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)]'
                    : 'bg-[#27B18A] text-white hover:bg-[#0E927A]'
                  }`}
              >
                {showForm ? <X size={13} /> : <Plus size={13} />}
                {showForm ? 'Batal' : 'Catat Pengeluaran'}
              </button>
            </div>

            {/* Expense form */}
            {showForm && (
              <div className="bg-[var(--surface)] rounded-2xl border border-[#27B18A]/30 p-5 shadow-sm mb-4">
                <p className="text-sm font-semibold text-[var(--text)] mb-4">Catat Pengeluaran Baru</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Jenis</label>
                    <div className="flex gap-2">
                      {(['variable', 'fixed'] as const).map(t => (
                        <button key={t} type="button" onClick={() => handleTypeChange(t)}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                            ${expType === t ? 'bg-[#27B18A] text-white border-[#27B18A]' : 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)]'}`}>
                          {t === 'fixed' ? 'Biaya Tetap' : 'Biaya Variabel'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Kategori</label>
                    <select value={expCategory} onChange={e => setExpCategory(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]">
                      {(expType === 'fixed' ? FIXED_CATEGORIES : VARIABLE_CATEGORIES).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Jumlah</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-[var(--text-4)] select-none">Rp</span>
                      <input type="number" min="0" value={expAmount} onChange={e => setExpAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-9 pr-3 py-2
                          text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Tanggal</label>
                    <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">
                      Keterangan <span className="text-[var(--text-4)]">(opsional)</span>
                    </label>
                    <input type="text" value={expNote} onChange={e => setExpNote(e.target.value)}
                      placeholder="Misal: Bayar sewa, servis mesin"
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]" />
                  </div>
                </div>
                <button type="button" onClick={handleAddExpense}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#27B18A] text-white
                    text-sm font-semibold rounded-xl hover:bg-[#0E927A] transition-colors">
                  <Plus size={14} /> Simpan Pengeluaran
                </button>
              </div>
            )}

            {/* Journal list */}
            {journalEntries.length === 0 && hasData && (
              <p className="text-sm text-center text-[var(--text-4)] py-8">
                Belum ada entri jurnal bulan ini. Catat pengeluaran atau tunggu sinkronisasi penjualan.
              </p>
            )}
            {journalEntries.length > 0 && (
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
                {journalEntries.map((entry, idx) => {
                  const isIN = entry.type === 'IN';
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg)]/40
                        ${idx < journalEntries.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
                        ${isIN ? 'bg-[#27B18A]/10' : 'bg-red-50 dark:bg-red-900/20'}`}>
                        {isIN
                          ? <ArrowUpRight size={14} className="text-[#27B18A]" />
                          : <ArrowDownRight size={14} className="text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text)] truncate">
                          {entry.category}{entry.note ? ` — ${entry.note}` : ''}
                        </p>
                        <p className="text-[11px] text-[var(--text-3)]">
                          {formatDateLabel(entry.date)}
                          {!isIN && entry.expenseType && (
                            <span className="ml-1.5 font-semibold">
                              · {entry.expenseType === 'fixed' ? 'Tetap' : 'Variabel'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold tabular-nums
                          ${isIN ? 'text-[#27B18A]' : 'text-red-500'}`}>
                          {isIN ? '+' : '−'}{formatRp(entry.amount)}
                        </span>
                        {!isIN && (
                          <button type="button" onClick={() => deleteEntry(entry.id)}
                            className="text-[var(--text-4)] hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-[var(--text-4)] text-center pb-2">
            Data penjualan sinkron otomatis dari Kasir · Transaksi dibatalkan tidak dihitung
          </p>

        </main>
      </div>
    </AdminGuard>
  );
}
