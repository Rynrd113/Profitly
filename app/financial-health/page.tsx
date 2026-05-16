'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Plus, Trash2, Target,
  CalendarCheck, Wallet, AlertTriangle, CheckCircle,
  Clock, BarChart3, Edit3, Check, FileDown, Star,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { MenuEngineering } from '@/components/analytics/MenuEngineering';
import { MenuTable } from '@/components/analytics/MenuTable';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { storageGet, storageSet } from '@/lib/storage';
import { parseNum, formatRp, uid } from '@/lib/format';
import { getPricingTiers } from '@/lib/engine';
import { generateMonthlyReport } from '@/lib/generateReport';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvestmentItem {
  id: string;
  name: string;
  cost: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatYAxis(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function monthLabel(yearMonth: string) {
  const [y, m] = yearMonth.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('id-ID', {
    month: 'short', year: '2-digit',
  });
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-2)] mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[var(--text-2)]">{p.name}</span>
          <span className="font-semibold text-[var(--text)] ml-auto tabular-nums pl-4">
            {formatRp(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinancialHealthPage() {
  const { allRecords: records } = useSalesRecords();
  const { recipes } = useSavedRecipes();
  const { ingredients: rawIngredients } = useSavedRawIngredients();

  const [items, setItems] = useState<InvestmentItem[]>([]);
  const [opex, setOpex] = useState(0);
  const [editingOpex, setEditingOpex] = useState(false);
  const [opexInput, setOpexInput] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = storageGet<InvestmentItem[]>('profitly-investments');
    if (saved?.length) setItems(saved);
    else setItems([{ id: uid(), name: '', cost: '' }]);

    const o = storageGet<number>('profitly-monthly-opex');
    if (o !== null) { setOpex(o); setOpexInput(String(o)); }

    setMounted(true);
  }, []);

  // ── Investment CRUD ──────────────────────────────────────────────────────

  const updateItem = (id: string, field: 'name' | 'cost', value: string) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, [field]: value } : it);
      storageSet('profitly-investments', next);
      return next;
    });
  };

  const addItem = () => {
    setItems(prev => {
      const next = [...prev, { id: uid(), name: '', cost: '' }];
      storageSet('profitly-investments', next);
      return next;
    });
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const next = prev.filter(it => it.id !== id);
      storageSet('profitly-investments', next.length ? next : [{ id: uid(), name: '', cost: '' }]);
      return next.length ? next : [{ id: uid(), name: '', cost: '' }];
    });
  };

  const saveOpex = () => {
    const v = parseNum(opexInput);
    if (v < 0) { toast.error('Biaya operasional tidak bisa negatif'); return; }
    setOpex(v);
    storageSet('profitly-monthly-opex', v);
    setEditingOpex(false);
    toast.success('Biaya operasional disimpan');
  };

  // ── Derived calculations ─────────────────────────────────────────────────

  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = now.toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const filteredRecords = useMemo(() => {
    const s = new Date(startDate || defaultStart);
    const e = new Date((endDate || defaultEnd) + 'T23:59:59');
    return records.filter(r => {
      const d = new Date(r.timestamp);
      return d >= s && d <= e;
    });
  }, [records, startDate, endDate]);

  const totalInvestment = useMemo(
    () => items.reduce((s, it) => s + parseNum(it.cost), 0),
    [items],
  );

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

  const avgMonthlyNet = useMemo(() => {
    if (monthlyData.length === 0) return 0;
    const sum = monthlyData.reduce((s, m) => s + m.netProfit, 0);
    return sum / monthlyData.length;
  }, [monthlyData]);

  const cumulativeData = useMemo(() => {
    let cum = 0;
    return monthlyData.map(m => {
      cum += m.netProfit;
      return { ...m, cumulative: cum };
    });
  }, [monthlyData]);

  const currentCumulative = cumulativeData.at(-1)?.cumulative ?? 0;

  const paybackMonths = useMemo(() => {
    if (avgMonthlyNet <= 0 || totalInvestment <= 0) return null;
    return Math.ceil(totalInvestment / avgMonthlyNet);
  }, [totalInvestment, avgMonthlyNet]);

  // Find which month (actual or projected) hits the investment line
  const { paybackReached, paybackLabel, projectedChartData } = useMemo(() => {
    if (totalInvestment <= 0 || avgMonthlyNet <= 0) {
      return { paybackReached: false, paybackLabel: null, projectedChartData: cumulativeData };
    }

    // Check if already reached in actual data
    const hitMonth = cumulativeData.find(m => m.cumulative >= totalInvestment);
    if (hitMonth) {
      return {
        paybackReached: true,
        paybackLabel: hitMonth.label,
        projectedChartData: cumulativeData,
      };
    }

    // Project forward from last known month
    const lastDate = monthlyData.length > 0
      ? (() => { const [y, m] = monthlyData.at(-1)!.ym.split('-'); return new Date(Number(y), Number(m) - 1); })()
      : new Date();

    const remainingMonths = Math.ceil((totalInvestment - currentCumulative) / avgMonthlyNet);
    const maxProject = Math.min(remainingMonths + 1, 36);

    let cum = currentCumulative;
    const projected = [...cumulativeData];
    for (let i = 1; i <= maxProject; i++) {
      cum += avgMonthlyNet;
      const d = addMonths(lastDate, i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      projected.push({
        ym,
        label: monthLabel(ym),
        grossProfit: avgMonthlyNet + opex,
        netProfit: avgMonthlyNet,
        cumulative: cum,
        isProjected: true,
      } as typeof projected[0] & { isProjected: boolean });
    }

    const targetDate = addMonths(lastDate, remainingMonths);
    const lbl = targetDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return { paybackReached: false, paybackLabel: lbl, projectedChartData: projected };
  }, [cumulativeData, totalInvestment, avgMonthlyNet, currentCumulative, monthlyData, opex]);

  const pct = totalInvestment > 0
    ? Math.min(1, currentCumulative / totalInvestment)
    : 0;

  const cashFlowForecast = useMemo(() => {
    const currentNow = new Date();
    const cutoff7d = new Date(currentNow.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7 = filteredRecords.filter(r => !r.cancelled && new Date(r.timestamp) >= cutoff7d);
    const dailyAvgRevenue = last7.reduce((s, r) => s + r.totalRevenue, 0) / 7;
    const dailyAvgProfit  = last7.reduce((s, r) => s + r.grossProfit,  0) / 7;
    const active = filteredRecords.filter(r => !r.cancelled);
    const mtdRevenue = active.reduce((s, r) => s + r.totalRevenue, 0);
    const mtdProfit  = active.reduce((s, r) => s + r.grossProfit,  0);
    const daysInMonth   = new Date(currentNow.getFullYear(), currentNow.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentNow.getDate();
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

        {/* ── Investment inputs ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={14} className="text-[#27B18A]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Investasi Awal
            </h2>
          </div>

          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-4)] w-5 text-right shrink-0">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={item.name}
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                  placeholder="cth: Mesin espresso, Grinder..."
                  className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2
                    text-sm focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20
                    focus:border-[#27B18A] placeholder:text-[var(--text-4)]"
                />
                <div className="relative w-40 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-4)]">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={item.cost}
                    onChange={e => {
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n) && n < 0) { toast.error('Nilai investasi tidak bisa negatif'); return; }
                      updateItem(item.id, 'cost', e.target.value === '' ? '' : e.target.value);
                    }}
                    placeholder="0"
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-8 pr-3
                      py-2 text-sm text-right focus:outline-none focus:ring-2
                      focus:ring-[#27B18A]/20 focus:border-[#27B18A] placeholder:text-[var(--text-4)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-4)]
                    hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#27B18A]
              hover:text-[#0E927A] transition-colors"
          >
            <Plus size={15} />
            Tambah item investasi
          </button>

          {/* Total */}
          {totalInvestment > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-sm text-[var(--text-2)]">Total Investasi</span>
              <span
                className="text-xl font-bold text-[var(--text)] tabular-nums"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                {formatRp(totalInvestment)}
              </span>
            </div>
          )}
        </div>

        {/* ── Opex input ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-[#27B18A]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
                  Biaya Operasional Bulanan
                </p>
                <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                  Sewa, gaji, listrik — digunakan untuk hitung profit bersih
                </p>
              </div>
            </div>
            {editingOpex ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-4)]">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={opexInput}
                    onChange={e => {
                      const n = parseFloat(e.target.value);
                      setOpexInput(e.target.value === '' ? '' : !isNaN(n) && n < 0 ? '0' : e.target.value);
                    }}
                    onKeyDown={e => e.key === 'Enter' && saveOpex()}
                    autoFocus
                    className="w-36 bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-8 pr-3 py-2
                      text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20
                      focus:border-[#27B18A]"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveOpex}
                  className="w-9 h-9 bg-[#27B18A] text-white rounded-xl flex items-center
                    justify-center hover:bg-[#0E927A] transition-colors"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setOpexInput(String(opex)); setEditingOpex(true); }}
                className="flex items-center gap-2 group shrink-0"
              >
                <span
                  className="text-xl font-bold text-[var(--text)] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {opex > 0 ? formatRp(opex) : '—'}
                </span>
                <Edit3 size={13} className="text-[var(--text-4)] group-hover:text-[var(--text-2)] transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* ── Cash Flow Forecast ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-[#27B18A]" />
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
                Proyeksi Cash Flow Bulan Ini
              </span>
              <p className="text-[11px] text-[var(--text-3)] mt-0.5">Berdasarkan tren 7 hari terakhir</p>
            </div>
          </div>
          {!cashFlowForecast.hasData ? (
            <p className="text-sm text-[var(--text-4)] py-2">Belum ada transaksi 7 hari terakhir</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1">
                  Realisasi MTD
                </p>
                <p
                  className="text-xl font-bold text-[var(--text)] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {formatRp(cashFlowForecast.mtdRevenue)}
                </p>
                <p className="text-[10px] text-[var(--text-3)] mt-0.5">
                  profit {formatRp(cashFlowForecast.mtdProfit)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1">
                  Avg / Hari (7h)
                </p>
                <p
                  className="text-xl font-bold text-[var(--text)] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {formatRp(cashFlowForecast.dailyAvgRevenue)}
                </p>
                <p className="text-[10px] text-[var(--text-3)] mt-0.5">
                  profit/hari {formatRp(cashFlowForecast.dailyAvgProfit)}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-[var(--tint-amber-deep)] rounded-xl p-3 border border-[#065F46]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#27B18A] mb-1">
                  Proyeksi Akhir Bulan
                </p>
                <p
                  className="text-xl font-bold text-[#27B18A] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {formatRp(cashFlowForecast.forecastRevenue)}
                </p>
                <p className="text-[10px] text-[#27B18A] mt-0.5">
                  est. profit {formatRp(cashFlowForecast.forecastProfit)}
                </p>
                <p className="text-[10px] text-[var(--text-3)] mt-1">
                  +{cashFlowForecast.daysRemaining} hari tersisa bulan ini
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {totalInvestment > 0 && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">
                  Total Investasi
                </p>
                <p
                  className="text-xl font-bold text-[var(--text)] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {formatRp(totalInvestment)}
                </p>
              </div>

              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">
                  Avg Profit Bersih / Bulan
                </p>
                {monthlyData.length === 0 ? (
                  <p className="text-sm text-[var(--text-4)]">Belum ada data</p>
                ) : (
                  <p
                    className="text-xl font-bold tabular-nums"
                    style={{
                      fontFamily: 'var(--font-bricolage, system-ui)',
                      color: avgMonthlyNet >= 0 ? '#27B18A' : '#DC2626',
                    }}
                  >
                    {formatRp(avgMonthlyNet)}
                  </p>
                )}
                {monthlyData.length > 0 && (
                  <p className="text-[10px] text-[var(--text-3)] mt-1">
                    rata-rata {monthlyData.length} bulan
                  </p>
                )}
              </div>

              <div className="col-span-2 sm:col-span-1 bg-[var(--surface)] rounded-2xl border shadow-sm p-4"
                style={{ borderColor: paybackMonths ? '#065F46' : 'var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">
                  Payback Period
                </p>
                {paybackMonths === null ? (
                  <p className="text-sm text-[var(--text-4)]">
                    {monthlyData.length === 0 ? 'Belum ada data penjualan' : 'Profit negatif — evaluasi biaya'}
                  </p>
                ) : (
                  <>
                    <p
                      className="text-xl font-bold text-[#27B18A] tabular-nums"
                      style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                    >
                      {paybackMonths} bulan
                    </p>
                    <p className="text-[10px] text-[var(--text-3)] mt-1">
                      ≈ {(paybackMonths / 12).toFixed(1)} tahun
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ── Payback highlight card ── */}
            {paybackMonths !== null && paybackLabel && (
              <div
                className="rounded-2xl border p-5 shadow-sm"
                style={{
                  background: paybackReached ? 'var(--tint-amber)' : 'var(--tint-amber)',
                  borderColor: paybackReached ? '#065F46' : '#065F46',
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: paybackReached ? '#D1FAE5' : 'var(--tint-amber)' }}
                  >
                    {paybackReached
                      ? <CheckCircle size={22} className="text-[#27B18A]" />
                      : <CalendarCheck size={22} className="text-[#27B18A]" />}
                  </div>
                  <div>
                    <p
                      className="text-base font-bold"
                      style={{ color: paybackReached ? '#27B18A' : '#065F46' }}
                    >
                      {paybackReached
                        ? `Investasi sudah balik modal sejak ${paybackLabel}!`
                        : `Estimasi balik modal: ${paybackLabel}`}
                    </p>
                    <p
                      className="text-sm mt-1"
                      style={{ color: paybackReached ? '#27B18A' : '#0E927A' }}
                    >
                      {paybackReached
                        ? `Total ${formatRp(currentCumulative)} profit bersih terkumpul — modal ${formatRp(totalInvestment)} sudah tertutup.`
                        : `Sisa ${formatRp(Math.max(0, totalInvestment - currentCumulative))} lagi dari target ${formatRp(totalInvestment)}.`}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span style={{ color: paybackReached ? '#27B18A' : '#065F46' }}>
                      {formatRp(Math.min(currentCumulative, totalInvestment))} terkumpul
                    </span>
                    <span
                      className="font-bold"
                      style={{ color: paybackReached ? '#27B18A' : '#27B18A' }}
                    >
                      {(pct * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-black/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct * 100}%`,
                        background: paybackReached ? '#27B18A' : '#27B18A',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Cumulative profit chart ── */}
            {projectedChartData.length > 0 && (
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-[#27B18A]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
                        Grafik Balik Modal
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-3)] mt-0.5">
                      Kumulatif profit bersih vs target investasi
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--text-2)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[#27B18A] rounded-full inline-block" />
                      Aktual
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[var(--text-3)] rounded-full inline-block" style={{ borderTop: '2px dashed var(--text-3)', height: 0 }} />
                      Proyeksi
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[#27B18A] rounded-full inline-block" />
                      Target
                    </span>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={projectedChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#27B18A" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#27B18A" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--text-4)' }}
                      axisLine={false} tickLine={false} dy={6}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fontSize: 11, fill: 'var(--text-4)' }}
                      axisLine={false} tickLine={false} width={44}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    {totalInvestment > 0 && (
                      <ReferenceLine
                        y={totalInvestment}
                        stroke="#27B18A"
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        label={{
                          value: `Target: ${formatRp(totalInvestment)}`,
                          position: 'insideTopRight',
                          fontSize: 10,
                          fill: '#27B18A',
                          fontWeight: 'bold',
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Kumulatif Profit"
                      stroke="#27B18A"
                      strokeWidth={2}
                      fill="url(#profitGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#27B18A', strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <p className="text-[10px] text-[var(--text-4)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  {cumulativeData.length > 0
                    ? `Data aktual ${cumulativeData.length} bulan · proyeksi menggunakan rata-rata profit bersih ${formatRp(avgMonthlyNet)}/bulan`
                    : 'Catat transaksi di Kasir untuk memulai tracking'}
                </p>
              </div>
            )}

            {/* ── Monthly breakdown table ── */}
            {monthlyData.length > 0 && (
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-subtle)]">
                  <Clock size={14} className="text-[#27B18A]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
                    Rincian Per Bulan
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        {['Bulan', 'Laba Kotor', 'Biaya Ops', 'Profit Bersih', 'Kumulatif'].map((h, i) => (
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
                      {cumulativeData.map((row, i) => {
                        const hitTarget = row.cumulative >= totalInvestment &&
                          (i === 0 || cumulativeData[i - 1].cumulative < totalInvestment);
                        return (
                          <tr
                            key={row.ym}
                            className={`border-b border-[var(--border-subtle)] last:border-0 ${
                              hitTarget ? 'bg-[var(--tint-amber)]' : i % 2 === 0 ? '' : 'bg-[var(--bg)]/40'
                            }`}
                          >
                            <td className="px-5 py-3 text-sm font-medium text-[var(--text)]">
                              {row.label}
                              {hitTarget && (
                                <span className="ml-2 text-[10px] font-bold text-[#F59E0B]
                                  bg-[var(--tint-amber)] border border-[#065F46] px-1.5 py-0.5 rounded-full">
                                  ✓ BEP
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-sm text-right tabular-nums text-[var(--text)]">
                              {formatRp(row.grossProfit)}
                            </td>
                            <td className="px-5 py-3 text-sm text-right tabular-nums text-[#27B18A]">
                              {opex > 0 ? `−${formatRp(opex)}` : '—'}
                            </td>
                            <td className="px-5 py-3 text-sm text-right tabular-nums font-semibold"
                              style={{ color: row.netProfit >= 0 ? '#27B18A' : '#DC2626' }}>
                              {row.netProfit >= 0 ? '+' : ''}{formatRp(row.netProfit)}
                            </td>
                            <td className="px-5 py-3 text-sm text-right tabular-nums font-bold"
                              style={{ color: row.cumulative >= totalInvestment ? '#27B18A' : 'var(--text)' }}>
                              {formatRp(row.cumulative)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {monthlyData.length === 0 && (
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-10 shadow-sm text-center">
                <AlertTriangle size={28} className="mx-auto text-[var(--text-4)] mb-3" />
                <p className="text-sm font-medium text-[var(--text-2)]">Belum ada data penjualan</p>
                <p className="text-xs text-[var(--text-4)] mt-1">
                  Catat transaksi di Kasir untuk melihat proyeksi balik modal.
                </p>
              </div>
            )}
          </>
        )}

        {/* Empty investment state */}
        {totalInvestment === 0 && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-10 shadow-sm text-center">
            <Target size={28} className="mx-auto text-[var(--text-4)] mb-3" />
            <p className="text-sm font-medium text-[var(--text-2)]">Isi investasi awal terlebih dahulu</p>
            <p className="text-xs text-[var(--text-4)] mt-1">
              Tambahkan item seperti mesin espresso, grinder, renovasi, dll.
            </p>
          </div>
        )}

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
