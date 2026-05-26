'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, X,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight, ShoppingBag,
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
import type { Expense } from '@/types/finance';
import type { SaleRecord } from '@/types/hpp';

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(ds: string) {
  return new Date(ds + 'T12:00:00').toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

interface DayGroup {
  date: string;
  sales: SaleRecord[];
  expenses: Expense[];
  inflow: number;
  outflow: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

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
  const { expenses, addExpense, deleteExpense } = useFinanceStore();

  useEffect(() => { hydrate(); }, []);

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

  const monthExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= monthStart && d <= monthEnd;
    }),
    [expenses, monthStart, monthEnd]
  );

  const totalInflow  = useMemo(() => monthSales.reduce((s, r) => s + r.totalRevenue, 0), [monthSales]);
  const totalOutflow = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount, 0), [monthExpenses]);
  const totalSaldo   = totalInflow - totalOutflow;
  const totalProfit  = useMemo(() => monthSales.reduce((s, r) => s + r.grossProfit, 0), [monthSales]);

  const totalFixedExpenses = useMemo(() =>
    expenses.filter(e => e.type === 'fixed').reduce((s, e) => s + e.amount, 0),
    [expenses]
  );
  const daysSoFar = isCurrentMonth ? Math.max(1, today.getDate()) : monthEnd.getDate();
  const avgDailyProfit = totalProfit / daysSoFar;
  const bepDays = totalFixedExpenses > 0 && avgDailyProfit > 0
    ? Math.ceil(totalFixedExpenses / avgDailyProfit)
    : null;

  // Chart: day-by-day data up to today (current month) or full month (past)
  const chartData = useMemo(() => {
    const result: Array<{ date: string; Pemasukan: number; Pengeluaran: number }> = [];
    const cursor = new Date(monthStart);
    const limit  = isCurrentMonth ? today : monthEnd;
    while (cursor <= limit) {
      const ds = toDateStr(cursor);
      const inflow  = monthSales.filter(r => r.timestamp.slice(0, 10) === ds).reduce((s, r) => s + r.totalRevenue, 0);
      const outflow = monthExpenses.filter(e => e.date === ds).reduce((s, e) => s + e.amount, 0);
      if (inflow > 0 || outflow > 0) result.push({ date: ds.slice(8), Pemasukan: inflow, Pengeluaran: outflow });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [monthSales, monthExpenses, monthStart, monthEnd, isCurrentMonth]);

  // Cashflow register grouped by date, newest first
  const cashflowByDate = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const r of monthSales) {
      const ds = r.timestamp.slice(0, 10);
      if (!map.has(ds)) map.set(ds, { date: ds, sales: [], expenses: [], inflow: 0, outflow: 0 });
      const g = map.get(ds)!;
      g.sales.push(r);
      g.inflow += r.totalRevenue;
    }
    for (const e of monthExpenses) {
      if (!map.has(e.date)) map.set(e.date, { date: e.date, sales: [], expenses: [], inflow: 0, outflow: 0 });
      const g = map.get(e.date)!;
      g.expenses.push(e);
      g.outflow += e.amount;
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthSales, monthExpenses]);

  // Expense form state
  const [showForm, setShowForm]       = useState(false);
  const [expType, setExpType]         = useState<'fixed' | 'variable'>('variable');
  const [expCategory, setExpCategory] = useState<string>(VARIABLE_CATEGORIES[0]);
  const [expAmount, setExpAmount]     = useState('');
  const [expDate, setExpDate]         = useState(toDateStr(today));
  const [expNote, setExpNote]         = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const handleTypeChange = (t: 'fixed' | 'variable') => {
    setExpType(t);
    setExpCategory(t === 'fixed' ? FIXED_CATEGORIES[0] : VARIABLE_CATEGORIES[0]);
  };

  const handleAddExpense = () => {
    const amount = parseFloat(expAmount.replace(/\D/g, ''));
    if (!amount || amount <= 0) return;
    addExpense({ type: expType, category: expCategory, amount, date: expDate, note: expNote || undefined });
    setExpAmount(''); setExpNote('');
    setShowForm(false);
  };

  const toggleDate = (ds: string) =>
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(ds) ? next.delete(ds) : next.add(ds);
      return next;
    });

  const hasAnyData = monthSales.length > 0 || monthExpenses.length > 0;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[var(--bg)]" style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}>
        <Navbar active="finance" />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">

          {/* Page header + month selector */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                Arus Kas
              </h1>
              <p className="text-sm text-[var(--text-3)] mt-0.5">Ringkasan pemasukan dan pengeluaran</p>
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
            />
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">Saldo Bulan Ini</span>
                <Wallet size={14} className={totalSaldo >= 0 ? 'text-[#27B18A]' : 'text-red-500'} />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${totalSaldo >= 0 ? 'text-[var(--text)]' : 'text-red-500'}`}
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                {formatRp(totalSaldo)}
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                Masuk {formatRp(totalInflow)} · Keluar {formatRp(totalOutflow)}
              </p>
            </div>

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">Gross Profit</span>
                <TrendingUp size={14} className="text-[#27B18A]" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-[var(--text)]"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                {formatRp(totalProfit)}
              </p>
              <p className="text-[11px] text-[var(--text-3)] mt-1">
                {monthSales.length} transaksi bulan ini
              </p>
            </div>

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">Estimasi BEP</span>
                <TrendingDown size={14} className="text-amber-500" />
              </div>
              {bepDays !== null ? (
                <>
                  <p className="text-2xl font-bold tabular-nums text-[var(--text)]"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                    {bepDays} hari
                  </p>
                  <p className="text-[11px] text-[var(--text-3)] mt-1">
                    Balik biaya tetap {formatRp(totalFixedExpenses)} / bulan
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-[var(--text-4)]">—</p>
                  <p className="text-[11px] text-[var(--text-3)] mt-1">
                    {totalFixedExpenses === 0 ? 'Belum ada biaya tetap tercatat' : 'Belum ada data profit'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Chart */}
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

          {/* Cashflow register header + add expense */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text)]">Rincian Arus Kas</h2>
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

          {/* Inline expense form */}
          {showForm && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[#27B18A]/30 p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--text)] mb-4">Catat Pengeluaran Baru</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Jenis</label>
                  <div className="flex gap-2">
                    {(['variable', 'fixed'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTypeChange(t)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors
                          ${expType === t
                            ? 'bg-[#27B18A] text-white border-[#27B18A]'
                            : 'bg-[var(--bg)] text-[var(--text-2)] border-[var(--border)]'
                          }`}
                      >
                        {t === 'fixed' ? 'Biaya Tetap' : 'Biaya Variabel'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Kategori</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  >
                    {(expType === 'fixed' ? FIXED_CATEGORIES : VARIABLE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Jumlah</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs text-[var(--text-4)] select-none">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={expAmount}
                      onChange={e => setExpAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl
                        pl-9 pr-3 py-2 text-sm text-right focus:outline-none
                        focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Keterangan <span className="text-[var(--text-4)]">(opsional)</span></label>
                  <input
                    type="text"
                    value={expNote}
                    onChange={e => setExpNote(e.target.value)}
                    placeholder="Misal: Servis mesin, bayar langganan"
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddExpense}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#27B18A] text-white
                  text-sm font-semibold rounded-xl hover:bg-[#0E927A] transition-colors"
              >
                <Plus size={14} />
                Simpan Pengeluaran
              </button>
            </div>
          )}

          {/* Empty state */}
          {!hasAnyData && (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] py-14 px-6 text-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#27B18A]/10 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={28} className="text-[#27B18A]" />
              </div>
              <p className="text-base font-semibold text-[var(--text)] mb-1">Belum ada transaksi</p>
              <p className="text-sm text-[var(--text-3)] max-w-xs mx-auto">
                Arus kas akan muncul otomatis saat ada penjualan di Kasir atau pengeluaran yang kamu catat.
              </p>
            </div>
          )}

          {/* Cashflow register */}
          {hasAnyData && (
            <div className="space-y-2">
              {cashflowByDate.map(group => {
                const net = group.inflow - group.outflow;
                const expanded = expandedDates.has(group.date);
                return (
                  <div key={group.date} className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
                    {/* Day header row */}
                    <button
                      type="button"
                      onClick={() => toggleDate(group.date)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--bg)] transition-colors"
                    >
                      {expanded
                        ? <ChevronDown size={14} className="text-[var(--text-4)] shrink-0" />
                        : <ChevronRight size={14} className="text-[var(--text-4)] shrink-0" />
                      }
                      <span className="flex-1 text-sm font-semibold text-[var(--text)]">
                        {formatDateLabel(group.date)}
                      </span>
                      <div className="flex items-center gap-4 text-xs shrink-0">
                        {group.inflow > 0 && (
                          <span className="flex items-center gap-1 text-[#27B18A] font-semibold">
                            <ArrowUpRight size={12} />
                            {formatRp(group.inflow)}
                          </span>
                        )}
                        {group.outflow > 0 && (
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <ArrowDownRight size={12} />
                            {formatRp(group.outflow)}
                          </span>
                        )}
                        <span className={`font-bold text-sm tabular-nums ${net >= 0 ? 'text-[#27B18A]' : 'text-red-500'}`}>
                          {net >= 0 ? '+' : ''}{formatRp(net)}
                        </span>
                      </div>
                    </button>

                    {/* Expanded: sales + expenses */}
                    {expanded && (
                      <div className="border-t border-[var(--border)] divide-y divide-[var(--border-subtle)]">
                        {group.sales.map(r => (
                          <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                            <ArrowUpRight size={13} className="text-[#27B18A] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[var(--text)] truncate">
                                Penjualan — {r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}
                              </p>
                              <p className="text-[11px] text-[var(--text-3)]">
                                {new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                {r.paymentMethod ? ` · ${r.paymentMethod}` : ''}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[#27B18A] shrink-0">{formatRp(r.totalRevenue)}</span>
                          </div>
                        ))}
                        {group.expenses.map(e => (
                          <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                            <ArrowDownRight size={13} className="text-red-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[var(--text)]">
                                {e.category}{e.note ? ` — ${e.note}` : ''}
                              </p>
                              <p className="text-[11px] text-[var(--text-3)]">
                                {e.type === 'fixed' ? 'Biaya Tetap' : 'Biaya Variabel'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold text-red-500">{formatRp(e.amount)}</span>
                              <button
                                type="button"
                                onClick={() => deleteExpense(e.id)}
                                className="text-[var(--text-4)] hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-[var(--text-4)] text-center pb-2">
            Data penjualan sinkron otomatis dari Kasir · Transaksi dibatalkan tidak dihitung
          </p>

        </main>
      </div>
    </AdminGuard>
  );
}
