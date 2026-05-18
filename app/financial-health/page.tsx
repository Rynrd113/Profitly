'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, FileDown, Star,
  ChevronLeft, ChevronRight, Plus, Trash2,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { MenuEngineering } from '@/components/analytics/MenuEngineering';
import { MenuTable } from '@/components/analytics/MenuTable';
import { InvestmentSection } from '@/components/InvestmentSection';
import { useFinanceStore } from '@/store/financeStore';
import { FIXED_CATEGORIES, VARIABLE_CATEGORIES } from '@/types/finance';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { storageGet } from '@/lib/storage';
import { formatRp } from '@/lib/format';
import { getPricingTiers } from '@/lib/engine';
import { generateMonthlyReport } from '@/lib/generateReport';
import { toast } from 'sonner';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinancialHealthPage() {
  const { allRecords: records } = useSalesRecords();
  const { recipes } = useSavedRecipes();
  const { ingredients: rawIngredients } = useSavedRawIngredients();
  const { expenses, addExpense, deleteExpense } = useFinanceStore();

  const [expType,     setExpType]     = useState<'fixed' | 'variable'>('fixed');
  const [expCategory, setExpCategory] = useState<string>(FIXED_CATEGORIES[0]);
  const [expAmount,   setExpAmount]   = useState('');
  const [expDate,     setExpDate]     = useState('');
  const [expNote,     setExpNote]     = useState('');

  const [opex, setOpex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const o = storageGet<number>('profitly-monthly-opex');
    if (o !== null) setOpex(o);
    setMounted(true);
  }, []);

  // ── Derived calculations ─────────────────────────────────────────────────

  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = now.toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [recapPage, setRecapPage] = useState(0);
  const RECAP_PAGE_SIZE = 20;

  const filteredRecords = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate + 'T23:59:59');
    return records.filter(r => {
      const d = new Date(r.timestamp);
      return d >= s && d <= e;
    });
  }, [records, startDate, endDate]);

  const recapRecords = useMemo(
    () => filteredRecords
      .filter(r => !r.cancelled)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filteredRecords],
  );

  useEffect(() => { setRecapPage(0); }, [filteredRecords]);

  const foodCostItems = useMemo(() =>
    recipes
      .filter(r => r.hpp > 0)
      .map(r => {
        const stdPrice = getPricingTiers(r.hpp)[1].sellPrice;
        const pct = (r.hpp / stdPrice) * 100;
        return { id: r.id, name: r.name, hpp: r.hpp, stdPrice, pct };
      })
      .sort((a, b) => b.pct - a.pct),
    [recipes],
  );

  const periodLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const currentMonthTrend = useMemo(() => {
    const map = new Map<number, { omzet: number; profit: number }>();
    for (const r of filteredRecords) {
      if (r.cancelled) continue;
      const day = new Date(r.timestamp).getDate();
      const prev = map.get(day) ?? { omzet: 0, profit: 0 };
      map.set(day, { omzet: prev.omzet + r.totalRevenue, profit: prev.profit + r.grossProfit });
    }
    const endD = new Date(endDate);
    const daysInMonth = new Date(endD.getFullYear(), endD.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      omzet:  map.get(i + 1)?.omzet  ?? 0,
      profit: map.get(i + 1)?.profit ?? 0,
    }));
  }, [filteredRecords, endDate]);

  const currentMonthStats = useMemo(() => {
    const mtd = filteredRecords.filter(r => !r.cancelled);
    const omzet        = mtd.reduce((s, r) => s + r.totalRevenue, 0);
    const grossProfit  = mtd.reduce((s, r) => s + r.grossProfit,  0);
    const totalItemsSold = mtd.reduce((s, r) => s + r.items.reduce((a, it) => a + it.qty, 0), 0);
    return { omzet, grossProfit, txCount: mtd.length, totalItemsSold };
  }, [filteredRecords]);

  const totalExpenses = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate + 'T23:59:59');
    return expenses
      .filter(ex => { const d = new Date(ex.date); return d >= s && d <= e; })
      .reduce((sum, ex) => sum + ex.amount, 0);
  }, [expenses, startDate, endDate]);

  const netProfit = currentMonthStats.grossProfit - totalExpenses;

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

  const lowStockData = useMemo(() =>
    rawIngredients
      .filter(ing => ing.minStock != null && ing.currentStock != null && ing.currentStock < ing.minStock)
      .map(ing => ({
        name: ing.name,
        unit: ing.unit,
        current: ing.currentStock ?? 0,
        min: ing.minStock ?? 0,
      })),
    [rawIngredients],
  );

  const handleDownloadMonthlyReport = () => {
    generateMonthlyReport({
      periodLabel,
      omzet: currentMonthStats.omzet,
      grossProfit: currentMonthStats.grossProfit,
      netProfit: currentMonthStats.grossProfit - totalExpenses,
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

  if (!mounted) return null;

  return (
    <AdminGuard>
    <div
      className="min-h-screen bg-[var(--bg)]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Navbar active="financial-health" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">

        {/* ── Page title ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-[var(--text)]"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              Financial Health
            </h1>
            <p className="text-sm text-[var(--text-3)] mt-0.5">
              Pantau kapan investasi awal kamu kembali modal
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadMonthlyReport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
              bg-[#27B18A] text-white hover:bg-[#0E927A] transition-colors shrink-0"
          >
            <FileDown size={14} />
            <span>Laporan {periodLabel}</span>
          </button>
        </div>

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
                            {r.id}
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
                                : 'bg-green-50 text-[#27B18A]'
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

        {/* ── Net Profit Summary ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Gross Profit', value: currentMonthStats.grossProfit, color: '#27B18A' },
            { label: 'Total Pengeluaran', value: totalExpenses, color: '#F59E0B' },
            { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? '#27B18A' : '#DC2626' },
          ].map(card => (
            <div key={card.label} className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1">{card.label}</p>
              <p className="text-base font-bold tabular-nums" style={{ color: card.color }}>
                {formatRp(card.value)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Expense Management ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
              Pengeluaran Bulanan
            </span>
          </div>

          {/* Add form */}
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(['fixed', 'variable'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setExpType(t);
                    setExpCategory(t === 'fixed' ? FIXED_CATEGORIES[0] : VARIABLE_CATEGORIES[0]);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    expType === t
                      ? 'bg-[#27B18A] text-white'
                      : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-2)]'
                  }`}
                >
                  {t === 'fixed' ? 'Tetap (Sewa/Listrik)' : 'Variabel (Gaji/Lainnya)'}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={expCategory}
                onChange={e => setExpCategory(e.target.value)}
                className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                  text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
              >
                {(expType === 'fixed' ? FIXED_CATEGORIES : VARIABLE_CATEGORIES).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="date"
                value={expDate}
                onChange={e => setExpDate(e.target.value)}
                className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                  text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
              />
              <input
                type="number"
                min="0"
                placeholder="Jumlah (Rp)"
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                className="flex-1 min-w-[120px] bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                  text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
              />
              <input
                type="text"
                placeholder="Catatan (opsional)"
                value={expNote}
                onChange={e => setExpNote(e.target.value)}
                className="flex-1 min-w-[120px] bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                  text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
              />
              <button
                type="button"
                disabled={!expAmount || !expDate || Number(expAmount) <= 0}
                onClick={() => {
                  addExpense({ type: expType, category: expCategory, amount: Number(expAmount), date: expDate, note: expNote || undefined });
                  setExpAmount('');
                  setExpNote('');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#27B18A] text-white text-sm font-semibold
                  hover:bg-[#0E927A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>
          </div>

          {/* List */}
          {expenses.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-[var(--text-4)]">Belum ada pengeluaran dicatat</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    {['Tanggal', 'Tipe', 'Kategori', 'Catatan', 'Jumlah', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                          i === 4 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(ex => (
                    <tr key={ex.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg)]/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-[var(--text-2)] whitespace-nowrap">{ex.date}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ex.type === 'fixed'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-[var(--tint-amber)] text-[#F59E0B]'
                        }`}>
                          {ex.type === 'fixed' ? 'Tetap' : 'Variabel'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text)]">{ex.category}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-3)] max-w-[160px] truncate">{ex.note ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums text-[var(--text)]">
                        {formatRp(ex.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => deleteExpense(ex.id)}
                          className="text-[var(--text-4)] hover:text-[#DC2626] transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <InvestmentSection
          filteredRecords={filteredRecords}
          endDate={endDate}
          opex={opex}
          onOpexChange={setOpex}
        />

        {/* ── Food Cost % per Menu ── */}
        {foodCostItems.length > 0 && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-subtle)]">
              <BarChart3 size={14} className="text-[#27B18A]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
                Food Cost % per Menu
              </span>
              <span className="ml-auto text-[10px] text-[var(--text-4)]">harga standar (35% margin)</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
              <table className="w-full min-w-[360px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    {['Menu', 'HPP', 'Harga Jual', 'Food Cost %'].map((h, i) => (
                      <th
                        key={h}
                        className={`sticky top-0 z-10 bg-[var(--surface)] px-5 py-3 text-[10px] font-bold
                          uppercase tracking-wider text-[var(--text-4)]
                          ${i === 0 ? 'text-left' : 'text-right'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {foodCostItems.map(item => {
                    const green = item.pct < 35;
                    const yellow = item.pct >= 35 && item.pct <= 45;
                    const color = green ? '#27B18A' : yellow ? '#27B18A' : '#DC2626';
                    const bg = green ? 'var(--tint-amber)' : yellow ? 'var(--tint-amber)' : 'var(--tint-red)';
                    return (
                      <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="px-5 py-3 text-sm font-medium text-[var(--text)]">{item.name}</td>
                        <td className="px-5 py-3 text-sm text-right tabular-nums text-[var(--text-2)]">
                          {formatRp(item.hpp)}
                        </td>
                        <td className="px-5 py-3 text-sm text-right tabular-nums text-[var(--text-2)]">
                          {formatRp(item.stdPrice)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ color, background: bg }}
                          >
                            {item.pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center gap-3 flex-wrap">
              {[
                { label: '< 35% Ideal', color: '#27B18A', bg: 'var(--tint-amber)' },
                { label: '35–45% Waspada', color: '#27B18A', bg: 'var(--tint-amber)' },
                { label: '> 45% Kritis', color: '#DC2626', bg: 'var(--tint-red)' },
              ].map(l => (
                <span
                  key={l.label}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: l.color, background: l.bg }}
                >
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Menu Engineering Matrix ── */}
        {menuEngineeringData.length > 0 && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-subtle)]">
              <Star size={14} className="text-[#27B18A]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
                Analisis Menu — {periodLabel}
              </span>
            </div>
            <div className="p-5 space-y-5">
              <MenuEngineering items={menuEngineeringData} />
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
                <MenuTable items={menuEngineeringData} />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
    </AdminGuard>
  );
}
