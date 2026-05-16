'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown,
  ShoppingCart, Receipt, BarChart3, Wallet,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
  Star, HelpCircle, BarChart2, Edit3, Check, XCircle, RotateCcw, FlaskConical,
  Clock, Trophy, CheckCircle, AlertTriangle, Target,
  FileDown, MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { formatRp, parseNum } from '@/lib/format';
import { storageGet, storageSet } from '@/lib/storage';
import { toast } from 'sonner';
import { BackupRestore } from '@/components/BackupRestore';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { generateSalesReport, getPaymentSummary } from '@/lib/generateReport';
import type { SaleRecord, StockTransactionItem } from '@/types/hpp';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterByPeriod(records: SaleRecord[], period: Period, customStart = '', customEnd = ''): SaleRecord[] {
  const now = new Date();
  return records.filter(r => {
    const d = new Date(r.timestamp);
    if (period === 'today') return d.toDateString() === now.toDateString();
    if (period === 'month')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'custom') {
      const s = customStart ? new Date(customStart) : new Date(0);
      const e = customEnd   ? new Date(customEnd + 'T23:59:59Z') : now;
      return d >= s && d <= e;
    }
    return true;
  });
}

function filterPrevPeriod(records: SaleRecord[], period: Period): SaleRecord[] {
  if (period === 'custom' || period === 'all') return [];
  const now = new Date();
  return records.filter(r => {
    const d = new Date(r.timestamp);
    if (period === 'today') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return d.toDateString() === yesterday.toDateString();
    }
    if (period === 'month') {
      const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getMonth() === pm && d.getFullYear() === py;
    }
    return false;
  });
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function formatPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TrendPill({ change, prevLabel }: { change: number | null; prevLabel: string }) {
  if (change === null || prevLabel === '') return null;
  const up = change >= 0;
  const flat = Math.abs(change) < 0.1;
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold
        px-1.5 py-0.5 rounded-full ${
          flat ? 'bg-[var(--surface)] text-[var(--text-3)]'
          : up  ? 'bg-[var(--tint-amber)] text-[#27B18A]'
                : 'bg-[var(--tint-red)] text-[#DC2626]'
        }`}>
        {flat ? <MinusIcon size={8} /> : up ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
        {flat ? 'Sama' : formatPct(change)}
      </span>
      <span className="text-[10px] text-[var(--text-4)]">vs {prevLabel}</span>
    </div>
  );
}

function MetricCard({
  label, value, icon, iconBg, iconColor,
  sub, trend, prevLabel, highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sub?: string;
  trend?: number | null;
  prevLabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-[var(--surface)] rounded-2xl border shadow-sm p-5 transition-shadow
      hover:shadow-md ${highlight ? 'border-[#065F46]' : 'border-[var(--border)]'}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
      </div>
      <p
        className="text-[2rem] font-bold leading-none tabular-nums"
        style={{
          fontFamily: 'var(--font-bricolage, system-ui)',
          color: highlight ? '#27B18A' : 'var(--text)',
        }}
      >
        {value}
      </p>
      {trend !== undefined && prevLabel && (
        <TrendPill change={trend ?? null} prevLabel={prevLabel} />
      )}
      {sub && <p className="text-[11px] text-[var(--text-3)] mt-1.5">{sub}</p>}
    </div>
  );
}

function SmallCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-2">{label}</p>
      <p
        className="text-xl font-bold text-[var(--text)] tabular-nums"
        style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-3)] mt-1">{sub}</p>}
    </div>
  );
}

function formatYAxis(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-2)] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[var(--text-2)]">{p.name}</span>
          <span className="font-semibold text-[var(--text)] ml-2 tabular-nums">
            {formatRp(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SalesTrendChart({ data }: {
  data: { date: string; omzet: number; profit: number }[];
}) {
  const hasAnyData = data.some(d => d.omzet > 0 || d.profit > 0);

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
            Tren Penjualan
          </span>
          <p className="text-xs text-[var(--text-3)] mt-0.5">7 Hari Terakhir</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-2)]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2563EB] rounded-full inline-block" />
            Omzet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#27B18A] rounded-full inline-block" />
            Profit
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-[var(--text-4)]">Belum ada data 7 hari terakhir</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'var(--font-jakarta, system-ui)' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'var(--font-jakarta, system-ui)' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="omzet"
              name="Omzet"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke="#27B18A"
              strokeWidth={2}
              dot={{ r: 3, fill: '#27B18A', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#27B18A', strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Quick-Overview Cards ─────────────────────────────────────────────────────

interface StockLifetimeRow {
  name: string; unit: string; currentStock: number;
  dailyAvg: number; daysLeft: number | null; isOut: boolean;
}

function formatDays(d: number): string {
  if (d < 1) return '< 1 hari';
  return `~${Math.floor(d)} hari`;
}

function StockLifetimeCard({ items }: { items: StockLifetimeRow[] }) {
  const urgent  = items.filter(i => i.isOut || (i.daysLeft !== null && i.daysLeft < 3));
  const warning = items.filter(i => !i.isOut && i.daysLeft !== null && i.daysLeft >= 3 && i.daysLeft < 7);
  const shown   = [...urgent, ...warning].slice(0, 5);
  const okCount = items.filter(i => !i.isOut && (i.daysLeft === null || i.daysLeft >= 7)).length;
  const noData  = items.length === 0;

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-[#27B18A]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
          Estimasi Umur Stok
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-4)]">14 hari terakhir</span>
      </div>

      {noData ? (
        <p className="text-xs text-[var(--text-4)] py-4 text-center">
          Belum ada data konsumsi. Catat penjualan agar estimasi muncul.
        </p>
      ) : shown.length === 0 ? (
        <div className="flex items-center gap-2.5 py-2">
          <CheckCircle size={16} className="text-[#27B18A] shrink-0" />
          <p className="text-sm font-medium text-[#27B18A]">Semua stok masih aman ≥ 7 hari</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(item => {
            const hot = item.isOut || (item.daysLeft !== null && item.daysLeft < 3);
            return (
              <div key={item.name} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  hot ? 'bg-[var(--tint-red)]' : 'bg-[var(--tint-amber)]'
                }`}>
                  {item.isOut
                    ? <span className="text-base leading-none">📦</span>
                    : <AlertTriangle size={13} className={hot ? 'text-[#DC2626]' : 'text-[#27B18A]'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--text)] truncate">{item.name}</span>
                    <span className={`text-xs font-bold shrink-0 ${
                      hot ? 'text-[#DC2626]' : 'text-[#27B18A]'
                    }`}>
                      {item.isOut ? 'Habis!' : formatDays(item.daysLeft!)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-3)] leading-relaxed">
                    {item.isOut
                      ? 'Stok = 0 · restok segera'
                      : `Sisa ${item.currentStock.toLocaleString('id-ID')} ${item.unit} · avg ${item.dailyAvg.toFixed(1)} ${item.unit}/hari`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!noData && okCount > 0 && (
        <p className="text-[10px] text-[var(--text-4)] mt-3 pt-3 border-t border-[var(--border-subtle)]
          flex items-center gap-1">
          <CheckCircle size={9} className="text-[#27B18A]" />
          {okCount} bahan lain aman (≥ 7 hari)
        </p>
      )}
    </div>
  );
}

function WeeklyTop3Card({
  items,
}: {
  items: { name: string; qty: number; revenue: number }[];
}) {
  const MEDALS = ['🥇', '🥈', '🥉'];
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={14} className="text-[#27B18A]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
          Menu Terlaris Minggu Ini
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-4)] py-4 text-center">
          Belum ada transaksi 7 hari terakhir
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((menu, i) => {
            const maxQty = items[0].qty;
            const pct    = maxQty > 0 ? (menu.qty / maxQty) * 100 : 0;
            return (
              <div key={menu.name}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-xl leading-none shrink-0 w-7">{MEDALS[i]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text)] truncate">{menu.name}</p>
                      <span className="text-sm font-bold text-[#27B18A] tabular-nums shrink-0">
                        {formatRp(menu.revenue)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-3)]">{menu.qty}× terjual minggu ini</p>
                  </div>
                </div>
                <div className="ml-10 h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: i === 0 ? '#27B18A' : i === 1 ? '#27B18A' : 'var(--text-3)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MonthlyTargetCard({
  target, omzet,
  editingTarget, targetInput,
  onSetTargetInput, onStartEdit, onSave,
}: {
  target: number; omzet: number;
  editingTarget: boolean; targetInput: string;
  onSetTargetInput: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
}) {
  const pct = target > 0 ? Math.min(1, omzet / target) : 0;
  const reached = omzet >= target && target > 0;
  const shortfall = target > omzet ? target - omzet : 0;

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={14} className="text-[#27B18A]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
            Target Omzet Bulanan
          </span>
        </div>

        {editingTarget ? (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-4)]">Rp</span>
              <input
                type="number"
                min="0"
                value={targetInput}
                onChange={e => {
                  const n = parseFloat(e.target.value);
                  onSetTargetInput(e.target.value === '' ? '' : !isNaN(n) && n < 0 ? '0' : e.target.value);
                }}
                onKeyDown={e => e.key === 'Enter' && onSave()}
                autoFocus
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl pl-8 pr-2 py-2 text-sm
                  text-right focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
              />
            </div>
            <button
              type="button"
              onClick={onSave}
              className="w-10 h-10 bg-[#27B18A] text-white rounded-xl flex items-center justify-center
                hover:bg-[#0E927A] transition-colors shrink-0"
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <div>
              <p
                className="text-2xl font-bold text-[var(--text)] tabular-nums"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                {target > 0 ? formatRp(target) : '—'}
              </p>
              {target === 0 && (
                <p className="text-xs text-[var(--text-4)] mt-0.5">Tap untuk atur target bulanan</p>
              )}
            </div>
            <button
              type="button"
              onClick={onStartEdit}
              className="text-xs font-medium text-[#27B18A] hover:text-[#0E927A] transition-colors
                flex items-center gap-1"
            >
              <Edit3 size={12} />
              {target > 0 ? 'Ubah' : 'Atur Target'}
            </button>
          </div>
        )}

        {target > 0 && (
          <>
            <div className="relative h-3 bg-[var(--surface)] rounded-full overflow-hidden mb-3">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct * 100}%`,
                  background: reached ? '#27B18A' : pct >= 0.75 ? '#27B18A' : '#2563EB',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <span
                  className="font-bold tabular-nums"
                  style={{
                    color: reached ? '#27B18A' : pct >= 0.75 ? '#27B18A' : '#2563EB',
                    fontFamily: 'var(--font-bricolage, system-ui)',
                  }}
                >
                  {(pct * 100).toFixed(1)}%
                </span>
                <span className="text-[var(--text-3)] ml-1">tercapai</span>
              </div>
              {reached ? (
                <span className="flex items-center gap-1 text-[#27B18A] font-semibold">
                  <CheckCircle size={12} />
                  Target tercapai!
                </span>
              ) : (
                <span className="text-[var(--text-3)]">
                  kurang <span className="font-semibold text-[var(--text)] tabular-nums">{formatRp(shortfall)}</span>
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 shadow-sm text-center">
      <BarChart3 size={32} className="mx-auto text-[var(--text-4)] mb-3" />
      <p className="text-sm font-medium text-[var(--text-2)]">Belum ada data penjualan</p>
      <p className="text-xs text-[var(--text-4)] mt-1 mb-5">
        Buka halaman Kasir dan selesaikan transaksi pertama.
      </p>
      <Link
        href="/pos"
        className="inline-flex items-center gap-2 text-sm font-semibold text-white
          bg-[#27B18A] px-4 py-2.5 rounded-xl hover:bg-[#0E927A] transition-colors"
      >
        Buka Kasir
      </Link>
    </div>
  );
}

// ─── Menu Engineering Matrix ─────────────────────────────────────────────────

type MenuCategory = 'star' | 'puzzle' | 'plowhorse' | 'dog';

interface MenuAnalysisItem {
  recipeId: string;
  name: string;
  totalQty: number;
  totalRevenue: number;
  profitMargin: number;
  foodCostPct: number;
  category: MenuCategory;
}

const CATEGORY_CFG: Record<MenuCategory, {
  label: string; icon: React.ReactNode;
  cardBg: string; borderL: string; textColor: string; desc: string; advice: string;
  badgeBg: string; badgeBorder: string;
}> = {
  star:      { label: 'STAR',      icon: <Star size={14} />,          cardBg: '#E8F5E9', borderL: '#27B18A', textColor: '#27B18A', badgeBg: '#E8F5E9CC', badgeBorder: '#27B18A33', desc: 'Laris · Profit Tinggi', advice: 'Pertahankan & tonjolkan!' },
  puzzle:    { label: 'PUZZLE',    icon: <HelpCircle size={14} />,    cardBg: '#F1F3F5', borderL: '#8892A9', textColor: '#495057', badgeBg: '#F1F3F5CC', badgeBorder: '#8892A933', desc: 'Sepi · Profit Tinggi',  advice: 'Promosikan lebih kencang' },
  plowhorse: { label: 'PLOWHORSE', icon: <BarChart2 size={14} />,     cardBg: '#FDF2E9', borderL: '#845C58', textColor: '#845C58', badgeBg: '#FDF2E9CC', badgeBorder: '#845C5833', desc: 'Laris · Profit Rendah', advice: 'Naikkan harga / kurangi HPP' },
  dog:       { label: 'DOG',       icon: <AlertTriangle size={14} />, cardBg: '#FFF5F5', borderL: '#E11D48', textColor: '#E11D48', badgeBg: '#FFF5F5CC', badgeBorder: '#E11D4833', desc: 'Sepi · Profit Rendah',  advice: 'Hapus atau repositioning' },
};

const CATEGORY_ORDER: MenuCategory[] = ['star', 'puzzle', 'plowhorse', 'dog'];

function MenuAnalysis({ items, period }: { items: MenuAnalysisItem[]; period: Period }) {
  if (items.length < 2) return null;

  const counts = Object.fromEntries(
    CATEGORY_ORDER.map(c => [c, items.filter(i => i.category === c).length]),
  ) as Record<MenuCategory, number>;

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-[#27B18A]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
              Analisis Menu
            </span>
          </div>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Matriks menu engineering · {PERIOD_LABELS[period].toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {CATEGORY_ORDER.map(c => (
            <span
              key={c}
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap border"
              style={{ background: CATEGORY_CFG[c].badgeBg, color: CATEGORY_CFG[c].textColor, borderColor: CATEGORY_CFG[c].badgeBorder }}
            >
              {CATEGORY_CFG[c].icon}
              {counts[c]}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <div className="grid grid-cols-2 gap-1.5">
          {(['star', 'puzzle', 'plowhorse', 'dog'] as MenuCategory[]).map(cat => {
            const cfg = CATEGORY_CFG[cat];
            const catItems = items.filter(i => i.category === cat);
            return (
              <div
                key={cat}
                className="rounded-xl p-3 border border-[var(--border-subtle)]"
                style={{ background: cfg.cardBg, borderLeftColor: cfg.borderL, borderLeftWidth: '3px' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: cfg.textColor }}>{cfg.icon}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cfg.textColor }}>
                    {cfg.label}
                  </span>
                  <span
                    className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{ background: cfg.badgeBg, color: cfg.textColor, borderColor: cfg.badgeBorder }}
                  >
                    {catItems.length}
                  </span>
                </div>
                <p className="text-[9px] text-[#6B7280] mb-1.5">{cfg.desc}</p>
                <p className="text-[10px] font-semibold mb-2.5" style={{ color: cfg.textColor }}>
                  → {cfg.advice}
                </p>
                <div className="space-y-0.5 min-h-[1.5rem]">
                  {catItems.length === 0 ? (
                    <p className="text-[10px] text-[#6B7280] italic">Tidak ada</p>
                  ) : (
                    catItems.slice(0, 4).map(i => (
                      <div key={i.recipeId} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: cfg.textColor }} />
                        <p className="text-[10px] truncate" style={{ color: cfg.textColor }}>{i.name}</p>
                      </div>
                    ))
                  )}
                  {catItems.length > 4 && (
                    <p className="text-[9px] text-[#6B7280]">+{catItems.length - 4} lainnya</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 px-0.5">
          <span className="text-[9px] text-[var(--text-4)] font-bold uppercase tracking-wider">← Populer</span>
          <span className="text-[9px] text-[var(--text-4)] font-bold uppercase tracking-wider">Kurang Populer →</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              {['#', 'Menu', 'Terjual', 'Margin', 'Food Cost %', 'Kategori'].map((h, i) => (
                <th
                  key={h}
                  className={`pb-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]
                    ${i === 0 ? 'w-8 text-left' : i <= 1 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const cfg = CATEGORY_CFG[item.category];
              return (
                <tr key={item.recipeId} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-3 pr-3 text-[11px] font-bold text-[var(--text-4)] w-8">{idx + 1}</td>
                  <td className="py-3 pr-4">
                    <span className="text-sm font-medium text-[var(--text)]">{item.name}</span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-sm font-medium text-[var(--text)]">
                    {item.totalQty.toLocaleString('id-ID')}×
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-sm font-semibold" style={{ color: '#27B18A' }}>
                    {(item.profitMargin * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        color: item.foodCostPct <= 45 ? '#27B18A' : '#DC2626',
                        background: item.foodCostPct <= 45 ? '#E8F5E91A' : '#FFF5F51A',
                        borderColor: item.foodCostPct <= 45 ? '#27B18A33' : '#DC262633',
                      }}
                    >
                      {item.foodCostPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex flex-col items-end gap-0.5">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap border"
                        style={{ background: cfg.badgeBg, color: cfg.textColor, borderColor: cfg.badgeBorder }}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      <span className="text-[9px] text-[var(--text-3)]">{cfg.advice}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[var(--text-4)] mt-4 pt-3 border-t border-[var(--border-subtle)]">
        Ambang batas: rata-rata penjualan & margin dari semua menu pada periode ini.
        Puzzle = volume rendah, margin tinggi.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { records, cancel: cancelRecord } = useSalesRecords();
  const { ingredients: rawIngredients, restoreStock } = useSavedRawIngredients();
  const { add: addTransaction } = useStockTransactions();
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [opex, setOpex] = useState(0);
  const [opexInput, setOpexInput] = useState('');
  const [editingOpex, setEditingOpex] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [histPage, setHistPage] = useState(0);
  const HIST_PAGE_SIZE = 20;
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [targetInput, setTargetInput] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const v = storageGet<number>('profitly-monthly-opex');
    if (v !== null) { setOpex(v); setOpexInput(String(v)); }
    const t = storageGet<number>('profitly-monthly-target');
    if (t !== null) { setMonthlyTarget(t); setTargetInput(String(t)); }
  }, []);

  const saveOpex = () => {
    const v = parseNum(opexInput);
    if (v < 0) { toast.error('Biaya operasional tidak bisa negatif'); return; }
    setOpex(v);
    storageSet('profitly-monthly-opex', v);
    setEditingOpex(false);
    toast.success('Biaya operasional disimpan');
  };

  const saveTarget = () => {
    const v = parseNum(targetInput);
    if (v < 0) { toast.error('Target omzet tidak bisa negatif'); return; }
    setMonthlyTarget(v);
    storageSet('profitly-monthly-target', v);
    setEditingTarget(false);
    toast.success('Target omzet disimpan');
  };

  const handleExportPdf = () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const pmtSummary = getPaymentSummary(current);
      generateSalesReport({
        periodLabel: PERIOD_LABELS[period],
        omzet: metrics.omzet,
        modal: metrics.modal,
        labaKotor: metrics.labaKotor,
        labaBersih: metrics.labaBersih,
        opex: metrics.opexDeduction,
        txCount: metrics.txCount,
        avgTx: metrics.avgTx,
        margin: metrics.margin,
        monthlyTarget: period === 'month' ? monthlyTarget : undefined,
        cashTotal: pmtSummary.totalCash,
        qrisTotal: pmtSummary.totalQRIS,
        topMenus,
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
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const current = useMemo(
    () => filterByPeriod(records, period, customStart, customEnd).filter(r => !r.cancelled),
    [records, period, customStart, customEnd],
  );
  const previous = useMemo(
    () => filterPrevPeriod(records, period).filter(r => !r.cancelled),
    [records, period],
  );

  const metrics = useMemo(() => {
    const omzet     = current.reduce((s, r) => s + r.totalRevenue, 0);
    const modal     = current.reduce((s, r) => s + r.totalHPP, 0);
    const labaKotor = current.reduce((s, r) => s + (r.totalRevenue - r.totalHPP), 0);
    const txCount   = current.length;
    const avgTx     = txCount > 0 ? omzet / txCount : 0;
    const margin    = omzet > 0 ? (labaKotor / omzet) * 100 : 0;

    const monthsElapsed = (() => {
      if (period === 'today') return 1 / 30;
      if (period === 'month') return 1;
      if (period === 'custom') {
        const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
        const s = customStart ? new Date(customStart).getTime() : (current.length > 0 ? new Date(current[current.length - 1].timestamp).getTime() : Date.now());
        const e = customEnd ? new Date(customEnd + 'T23:59:59Z').getTime() : Date.now();
        return Math.max(1 / 30, (e - s) / msPerMonth);
      }
      if (current.length === 0) return 0;
      const earliest = Math.min(...current.map(r => new Date(r.timestamp).getTime()));
      const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
      return Math.max(1, (Date.now() - earliest) / msPerMonth);
    })();
    const opexDeduction = opex * monthsElapsed;
    const labaBersih = labaKotor - opexDeduction;

    const pOmzet  = previous.reduce((s, r) => s + r.totalRevenue, 0);
    const pModal  = previous.reduce((s, r) => s + r.totalHPP, 0);
    const pLabaK  = previous.reduce((s, r) => s + (r.totalRevenue - r.totalHPP), 0);

    return {
      omzet, modal, labaKotor, labaBersih,
      txCount, avgTx, margin, opexDeduction,
      trendOmzet:  pctChange(omzet,     pOmzet),
      trendModal:  pctChange(modal,     pModal),
      trendLabaK:  pctChange(labaKotor, pLabaK),
    };
  }, [current, previous, opex, period, customStart, customEnd]);

  const topMenus = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const rec of current) {
      for (const item of rec.items) {
        const e = map.get(item.recipeId);
        if (e) { e.qty += item.qty; e.revenue += item.subtotal; }
        else map.set(item.recipeId, { name: item.recipeName, qty: item.qty, revenue: item.subtotal });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [current]);

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toDateString();
      const dayRecords = records.filter(r => !r.cancelled && new Date(r.timestamp).toDateString() === dateStr);
      return {
        date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
        omzet:  dayRecords.reduce((s, r) => s + r.totalRevenue, 0),
        profit: dayRecords.reduce((s, r) => s + r.grossProfit, 0),
      };
    });
  }, [records]);

  const stockLifetime = useMemo((): StockLifetimeRow[] => {
    const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const consumed = new Map<string, number>();
    for (const rec of records) {
      if (rec.cancelled || !rec.deductions) continue;
      if (new Date(rec.timestamp).getTime() < cutoffMs) continue;
      for (const ded of rec.deductions) {
        consumed.set(ded.name, (consumed.get(ded.name) ?? 0) + ded.amount);
      }
    }
    return rawIngredients
      .filter(ing => ing.currentStock !== undefined)
      .map(ing => {
        const stock     = ing.currentStock!;
        const totalUsed = consumed.get(ing.name) ?? 0;
        const dailyAvg  = totalUsed / 14;
        const daysLeft  = dailyAvg > 0 ? stock / dailyAvg : null;
        return { name: ing.name, unit: ing.unit, currentStock: stock, dailyAvg, daysLeft, isOut: stock === 0 };
      })
      .filter(i => i.isOut || i.daysLeft !== null)
      .sort((a, b) => {
        if (a.isOut && !b.isOut) return -1;
        if (!a.isOut && b.isOut) return 1;
        if (a.daysLeft === null) return 1;
        if (b.daysLeft === null) return -1;
        return a.daysLeft - b.daysLeft;
      });
  }, [records, rawIngredients]);

  const weeklyTop3 = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const rec of records) {
      if (rec.cancelled || new Date(rec.timestamp) < cutoff) continue;
      for (const item of rec.items) {
        const e = map.get(item.recipeId);
        if (e) { e.qty += item.qty; e.revenue += item.subtotal; }
        else map.set(item.recipeId, { name: item.recipeName, qty: item.qty, revenue: item.subtotal });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 3);
  }, [records]);

  const menuAnalysis = useMemo((): MenuAnalysisItem[] => {
    const map = new Map<string, {
      name: string; totalQty: number; totalRevenue: number; totalCost: number;
    }>();
    for (const rec of current) {
      for (const item of rec.items) {
        const e = map.get(item.recipeId);
        const cost = item.qty * item.hpp;
        if (e) {
          e.totalQty     += item.qty;
          e.totalRevenue += item.subtotal;
          e.totalCost    += cost;
        } else {
          map.set(item.recipeId, {
            name: item.recipeName, totalQty: item.qty,
            totalRevenue: item.subtotal, totalCost: cost,
          });
        }
      }
    }

    const raw = Array.from(map.entries()).map(([recipeId, v]) => ({
      recipeId,
      name: v.name,
      totalQty: v.totalQty,
      totalRevenue: v.totalRevenue,
      totalCost: v.totalCost,
      profitMargin: v.totalRevenue > 0 ? (v.totalRevenue - v.totalCost) / v.totalRevenue : 0,
      foodCostPct: v.totalRevenue > 0 ? (v.totalCost / v.totalRevenue) * 100 : 0,
    }));

    if (raw.length < 2) return [];

    const totalQtyAll = raw.reduce((s, i) => s + i.totalQty, 0);
    const popThreshold = (totalQtyAll / raw.length) * 0.7;
    const avgCM = totalQtyAll > 0
      ? raw.reduce((s, i) => s + (i.totalRevenue - i.totalCost), 0) / totalQtyAll
      : 0;

    return raw
      .map(item => {
        const cmPerUnit = item.totalQty > 0
          ? (item.totalRevenue - item.totalCost) / item.totalQty
          : 0;
        return {
          ...item,
          category: ((): MenuCategory => {
            const hi = item.totalQty >= popThreshold;
            const hp = cmPerUnit >= avgCM;
            if (hi && hp)  return 'star';
            if (hi && !hp) return 'plowhorse';
            if (!hi && hp) return 'puzzle';
            return 'dog';
          })(),
        };
      })
      .sort((a, b) => {
        const order: Record<MenuCategory, number> = { star: 0, puzzle: 1, plowhorse: 2, dog: 3 };
        const oc = order[a.category] - order[b.category];
        return oc !== 0 ? oc : b.totalQty - a.totalQty;
      });
  }, [current]);

  const cashFlowForecast = useMemo(() => {
    const now = new Date();
    const totalRevenue7d = chartData.reduce((s, d) => s + d.omzet, 0);
    const totalProfit7d = chartData.reduce((s, d) => s + d.profit, 0);
    const dailyAvgRevenue = totalRevenue7d / 7;
    const dailyAvgProfit = totalProfit7d / 7;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const mtd = records.filter(r => !r.cancelled && new Date(r.timestamp) >= startOfMonth);
    const mtdRevenue = mtd.reduce((s, r) => s + r.totalRevenue, 0);
    const mtdProfit = mtd.reduce((s, r) => s + r.grossProfit, 0);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    return {
      dailyAvgRevenue, dailyAvgProfit, mtdRevenue, mtdProfit, daysRemaining,
      forecastRevenue: mtdRevenue + dailyAvgRevenue * daysRemaining,
      forecastProfit: mtdProfit + dailyAvgProfit * daysRemaining,
    };
  }, [chartData, records]);

  const handleCancel = (record: SaleRecord) => {
    if (record.deductions && record.deductions.length > 0) {
      restoreStock(record.deductions.map(d => ({ name: d.name, amount: d.amount })));
      const items: StockTransactionItem[] = record.deductions.map(d => {
        const raw = rawIngredients.find(ri => ri.name === d.name);
        const before = raw?.currentStock ?? 0;
        return {
          ingredientName: d.name,
          delta: d.amount,
          unit: d.unit,
          balanceBefore: before,
          balanceAfter: before + d.amount,
        };
      });
      addTransaction({
        note: `Rollback: ${record.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}`,
        items,
      });
    }
    cancelRecord(record.id);
    setCancellingId(null);
  };

  const prevLabel = PREV_PERIOD_LABELS[period];
  const hasData = current.length > 0;

  return (
    <AdminGuard>
    <div
      className="min-h-screen bg-[var(--bg)]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Navbar active="dashboard" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <StockLifetimeCard items={stockLifetime} />
          <WeeklyTop3Card items={weeklyTop3} />
        </div>

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

        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Total Omzet"
                value={formatRp(metrics.omzet)}
                icon={<TrendingUp size={16} />}
                iconBg="var(--tint-amber)"
                iconColor="#27B18A"
                sub="Pendapatan kotor dari penjualan"
                trend={metrics.trendOmzet}
                prevLabel={prevLabel}
              />
              <MetricCard
                label="Total Modal (COGS)"
                value={formatRp(metrics.modal)}
                icon={<ShoppingCart size={16} />}
                iconBg="var(--surface)"
                iconColor="var(--text-2)"
                sub="Harga pokok semua produk terjual"
                trend={metrics.trendModal}
                prevLabel={prevLabel}
              />
              <MetricCard
                label="Laba Kotor"
                value={formatRp(metrics.labaKotor)}
                icon={metrics.labaKotor >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                iconBg={metrics.labaKotor >= 0 ? 'var(--tint-amber-deep)' : 'var(--tint-red)'}
                iconColor={metrics.labaKotor >= 0 ? '#27B18A' : '#DC2626'}
                sub={`Margin ${metrics.margin.toFixed(1)}% dari omzet`}
                trend={metrics.trendLabaK}
                prevLabel={prevLabel}
                highlight={metrics.labaKotor > 0}
              />
            </div>

            {period === 'month' && (
              <MonthlyTargetCard
                target={monthlyTarget}
                omzet={metrics.omzet}
                editingTarget={editingTarget}
                targetInput={targetInput}
                onSetTargetInput={setTargetInput}
                onStartEdit={() => { setTargetInput(String(monthlyTarget)); setEditingTarget(true); }}
                onSave={saveTarget}
              />
            )}

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="p-5 sm:grid sm:grid-cols-[1fr_auto] sm:gap-8 sm:items-center">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
                      Profit Bersih
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-[var(--tint-amber)] flex items-center justify-center">
                      <Wallet size={12} className="text-[#27B18A]" />
                    </div>
                  </div>
                  <p
                    className="text-[2.5rem] font-bold leading-none tabular-nums"
                    style={{
                      fontFamily: 'var(--font-bricolage, system-ui)',
                      color: metrics.labaBersih >= 0 ? 'var(--text)' : '#DC2626',
                    }}
                  >
                    {formatRp(metrics.labaBersih)}
                  </p>
                  <div className="mt-4 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-[var(--text-2)]">
                      <span className="w-3 h-px bg-[#27B18A] inline-block" />
                      <span>Laba Kotor</span>
                      <span className="ml-auto tabular-nums font-medium text-[#27B18A]">
                        {formatRp(metrics.labaKotor)}
                      </span>
                    </div>
                    {metrics.opexDeduction > 0 && (
                      <div className="flex items-center gap-2 text-[var(--text-2)]">
                        <span className="w-3 h-px bg-[#27B18A] inline-block" />
                        <span>Biaya Operasional{period === 'today' ? ' (est. harian)' : period === 'custom' ? ' (est. proporsional)' : ''}</span>
                        <span className="ml-auto tabular-nums font-medium text-[#27B18A]">
                          − {formatRp(metrics.opexDeduction)}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center gap-2 font-semibold">
                      <span className="w-3 h-px bg-[var(--text)] inline-block" />
                      <span className="text-[var(--text)]">Profit Bersih</span>
                      <span
                        className="ml-auto tabular-nums"
                        style={{ color: metrics.labaBersih >= 0 ? 'var(--text)' : '#DC2626' }}
                      >
                        {formatRp(metrics.labaBersih)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-0 sm:min-w-[240px] bg-[var(--bg)] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-3">
                    Biaya Operasional Bulanan
                  </p>
                  {editingOpex ? (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-4)]">Rp</span>
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
                          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl
                            pl-8 pr-2 py-2 text-sm text-right focus:outline-none
                            focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveOpex}
                        className="w-10 h-10 bg-[#27B18A] text-white rounded-xl flex items-center
                          justify-center hover:bg-[#0E927A] transition-colors shrink-0"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setOpexInput(String(opex)); setEditingOpex(true); }}
                      className="w-full flex items-center justify-between group"
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
                  <p className="text-[10px] text-[var(--text-4)] mt-2">
                    Sewa, gaji, listrik, dan biaya tetap lainnya per bulan
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <SmallCard label="Transaksi" value={metrics.txCount.toLocaleString('id-ID')} sub={PERIOD_LABELS[period].toLowerCase()} />
              <SmallCard label="Rata-rata / Transaksi" value={metrics.avgTx > 0 ? formatRp(metrics.avgTx) : '—'} sub="nilai per transaksi" />
              <SmallCard label="Margin Kotor" value={metrics.margin > 0 ? `${metrics.margin.toFixed(1)}%` : '—'} sub="dari total omzet" />
            </div>

            <SalesTrendChart data={chartData} />

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-[#27B18A]" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
                    Proyeksi Cash Flow
                  </span>
                  <p className="text-xs text-[var(--text-3)] mt-0.5">Estimasi akhir bulan · tren 7 hari</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1">Realisasi MTD</p>
                  <p className="text-xl font-bold text-[var(--text)] tabular-nums" style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                    {formatRp(cashFlowForecast.mtdRevenue)}
                  </p>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">profit {formatRp(cashFlowForecast.mtdProfit)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1">Avg / Hari (7h)</p>
                  <p className="text-xl font-bold text-[var(--text)] tabular-nums" style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                    {formatRp(cashFlowForecast.dailyAvgRevenue)}
                  </p>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">profit {formatRp(cashFlowForecast.dailyAvgProfit)}</p>
                </div>
                <div className="rounded-xl p-3 border border-[#E5E7EB] bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1">Proyeksi Bulan Ini</p>
                  <p className="text-xl font-bold text-[#27B18A] tabular-nums" style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                    {formatRp(cashFlowForecast.forecastRevenue)}
                  </p>
                  <p className="text-[10px] text-[#27B18A] mt-0.5">est. profit {formatRp(cashFlowForecast.forecastProfit)}</p>
                  <p className="text-[10px] text-[var(--text-3)] mt-1">+{cashFlowForecast.daysRemaining} hari tersisa</p>
                </div>
              </div>
            </div>

            <MenuAnalysis items={menuAnalysis} period={period} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {topMenus.length > 0 && (
                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={14} className="text-[#27B18A]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">Menu Terlaris</span>
                  </div>
                  <div className="space-y-3">
                    {topMenus.map((menu, i) => {
                      const maxQty = topMenus[0].qty;
                      const pct = maxQty > 0 ? (menu.qty / maxQty) * 100 : 0;
                      return (
                        <div key={menu.name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold w-4 text-center ${i === 0 ? 'text-[#27B18A]' : 'text-[var(--text-4)]'}`}>{i + 1}</span>
                              <span className="font-medium text-[var(--text)]">{menu.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-[var(--text)] tabular-nums">{menu.qty}×</span>
                              <span className="text-[var(--text-3)] ml-2 tabular-nums text-xs">{formatRp(menu.revenue)}</span>
                            </div>
                          </div>
                          <div className="h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#27B18A' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Receipt size={14} className="text-[#27B18A]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">Transaksi Terakhir</span>
                </div>
                {current.length === 0 ? (
                  <p className="text-sm text-[var(--text-4)] py-4 text-center">Belum ada transaksi</p>
                ) : (
                  <div className="space-y-2.5">
                    {current.slice(0, 7).map(rec => (
                      <div key={rec.id} className="flex items-start justify-between gap-3 pb-2.5 border-b border-[var(--border-subtle)] last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text)] truncate">
                            {rec.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}
                          </p>
                          <p className="text-[11px] text-[var(--text-3)] mt-0.5">
                            {new Date(rec.timestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            <span className="ml-2 capitalize opacity-70">{rec.tier}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[var(--text)] tabular-nums">{formatRp(rec.totalRevenue)}</p>
                          <p className="text-[11px] text-[#27B18A] tabular-nums font-medium">+{formatRp(rec.grossProfit)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {records.length > 0 && (() => {
          const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const totalPages = Math.ceil(sorted.length / HIST_PAGE_SIZE);
          const page = Math.min(histPage, totalPages - 1);
          const pageRecords = sorted.slice(page * HIST_PAGE_SIZE, (page + 1) * HIST_PAGE_SIZE);

          return (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-subtle)]">
                <Receipt size={14} className="text-[#27B18A]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">Histori Transaksi</span>
                <span className="ml-auto text-xs text-[var(--text-3)] mr-3">{records.length} transaksi</span>
                {hasData && (
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white
                      bg-[#27B18A] px-3 py-1.5 rounded-xl hover:bg-[#0E927A] transition-colors
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <FileDown size={12} />
                    Export PDF
                  </button>
                )}
              </div>

              <div className="divide-y divide-[var(--border-subtle)]">
                {pageRecords.map(rec => {
                  const isCancelled = !!rec.cancelled;
                  const isConfirming = cancellingId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                        isCancelled ? 'bg-[var(--surface-2)] opacity-60' : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-[var(--text)]">
                            {rec.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}
                          </p>
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold
                              bg-[var(--tint-red)] text-[#DC2626] px-2 py-0.5 rounded-full shrink-0">
                              <XCircle size={8} />
                              Dibatalkan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-3)]">
                          {new Date(rec.timestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="capitalize">{rec.tier}</span>
                          <span className="mx-1.5 opacity-40">·</span>
                          {rec.items.reduce((s, i) => s + i.qty, 0)} item
                        </p>
                        {rec.note && (
                          <p className="text-[11px] text-[var(--text-2)] italic mt-0.5 flex items-center gap-1">
                            <MessageSquare size={9} className="shrink-0" />
                            {rec.note}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${isCancelled ? 'line-through text-[var(--text-3)]' : 'text-[var(--text)]'}`}>
                          {formatRp(rec.totalRevenue)}
                        </p>
                        <p className={`text-[11px] tabular-nums font-medium ${isCancelled ? 'text-[var(--text-4)]' : 'text-[#27B18A]'}`}>
                          +{formatRp(rec.grossProfit)}
                        </p>
                        {!isCancelled && (
                          <div className="mt-2">
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-[11px] text-[var(--text-2)]">Yakin?</span>
                                <button type="button" onClick={() => handleCancel(rec)}
                                  className="text-[11px] font-semibold text-white bg-[#DC2626] px-2.5 py-1 rounded-lg hover:bg-[#B91C1C] transition-colors">
                                  Ya
                                </button>
                                <button type="button" onClick={() => setCancellingId(null)}
                                  className="text-[11px] font-semibold text-[var(--text-2)] bg-[var(--surface)] px-2.5 py-1 rounded-lg hover:bg-[var(--border)] transition-colors">
                                  Tidak
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setCancellingId(rec.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#DC2626] hover:text-[#B91C1C] transition-colors">
                                <RotateCcw size={10} />
                                Batalkan
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-subtle)]">
                  <button type="button" onClick={() => { setHistPage(p => Math.max(0, p - 1)); setCancellingId(null); }}
                    disabled={page === 0}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg)]">
                    <ChevronLeft size={14} /> Sebelumnya
                  </button>
                  <span className="text-xs text-[var(--text-3)] tabular-nums">
                    {page + 1} / {totalPages}
                    <span className="text-[var(--text-4)] ml-1.5">({page * HIST_PAGE_SIZE + 1}–{Math.min((page + 1) * HIST_PAGE_SIZE, sorted.length)} dari {sorted.length})</span>
                  </span>
                  <button type="button" onClick={() => { setHistPage(p => Math.min(totalPages - 1, p + 1)); setCancellingId(null); }}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--bg)]">
                    Berikutnya <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <BackupRestore />

      </main>
    </div>
    </AdminGuard>
  );
}
