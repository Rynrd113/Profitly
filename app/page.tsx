'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown,
  ShoppingCart, Receipt, BarChart3, Wallet,
  ArrowUpRight, ArrowDownRight, Minus as MinusIcon,
  Star, Edit3, Check, XCircle, RotateCcw, FlaskConical,
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
import { generateSalesReport } from '@/lib/generateReport';
import type { SaleRecord, StockTransactionItem } from '@/types/hpp';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function filterPrevPeriod(records: SaleRecord[], period: Period): SaleRecord[] {
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
          flat ? 'bg-[#F3F4F6] text-[#9CA3AF]'
          : up  ? 'bg-[#ECFDF5] text-[#1A6B3C]'
                : 'bg-[#FEF2F2] text-[#DC2626]'
        }`}>
        {flat ? <MinusIcon size={8} /> : up ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
        {flat ? 'Sama' : formatPct(change)}
      </span>
      <span className="text-[10px] text-[#C4BFBA]">vs {prevLabel}</span>
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
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-shadow
      hover:shadow-md ${highlight ? 'border-[#BBF7D0]' : 'border-[#E5E3DD]'}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
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
          color: highlight ? '#1A6B3C' : '#1A1A18',
        }}
      >
        {value}
      </p>
      {trend !== undefined && prevLabel && (
        <TrendPill change={trend ?? null} prevLabel={prevLabel} />
      )}
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-1.5">{sub}</p>}
    </div>
  );
}

function SmallCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] mb-2">{label}</p>
      <p
        className="text-xl font-bold text-[#1A1A18] tabular-nums"
        style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-[#9CA3AF] mt-1">{sub}</p>}
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
    <div className="bg-white border border-[#E5E3DD] rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-[#78716C] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[#78716C]">{p.name}</span>
          <span className="font-semibold text-[#1A1A18] ml-2 tabular-nums">
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
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
            Tren Penjualan
          </span>
          <p className="text-xs text-[#9CA3AF] mt-0.5">7 Hari Terakhir</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#78716C]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2563EB] rounded-full inline-block" />
            Omzet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#1A6B3C] rounded-full inline-block" />
            Profit
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-[#C4BFBA]">Belum ada data 7 hari terakhir</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#F0EDE8"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#C4BFBA', fontFamily: 'var(--font-jakarta, system-ui)' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#C4BFBA', fontFamily: 'var(--font-jakarta, system-ui)' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E3DD', strokeWidth: 1 }} />
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
              stroke="#1A6B3C"
              strokeWidth={2}
              dot={{ r: 3, fill: '#1A6B3C', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#1A6B3C', strokeWidth: 2, stroke: '#fff' }}
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
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-[#1A6B3C]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
          Estimasi Umur Stok
        </span>
        <span className="ml-auto text-[10px] text-[#C4BFBA]">14 hari terakhir</span>
      </div>

      {noData ? (
        <p className="text-xs text-[#C4BFBA] py-4 text-center">
          Belum ada data konsumsi. Catat penjualan agar estimasi muncul.
        </p>
      ) : shown.length === 0 ? (
        <div className="flex items-center gap-2.5 py-2">
          <CheckCircle size={16} className="text-[#1A6B3C] shrink-0" />
          <p className="text-sm font-medium text-[#1A6B3C]">Semua stok masih aman ≥ 7 hari</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(item => {
            const hot = item.isOut || (item.daysLeft !== null && item.daysLeft < 3);
            return (
              <div key={item.name} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  hot ? 'bg-[#FEF2F2]' : 'bg-[#FEF3C7]'
                }`}>
                  {item.isOut
                    ? <span className="text-base leading-none">📦</span>
                    : <AlertTriangle size={13} className={hot ? 'text-[#DC2626]' : 'text-[#D97706]'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1A1A18] truncate">{item.name}</span>
                    <span className={`text-xs font-bold shrink-0 ${
                      hot ? 'text-[#DC2626]' : 'text-[#D97706]'
                    }`}>
                      {item.isOut ? 'Habis!' : formatDays(item.daysLeft!)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF] leading-relaxed">
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
        <p className="text-[10px] text-[#C4BFBA] mt-3 pt-3 border-t border-[#F0EDE8]
          flex items-center gap-1">
          <CheckCircle size={9} className="text-[#1A6B3C]" />
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
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={14} className="text-[#D97706]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
          Menu Terlaris Minggu Ini
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#C4BFBA] py-4 text-center">
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
                      <p className="text-sm font-semibold text-[#1A1A18] truncate">{menu.name}</p>
                      <span className="text-sm font-bold text-[#1A6B3C] tabular-nums shrink-0">
                        {formatRp(menu.revenue)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#9CA3AF]">{menu.qty}× terjual minggu ini</p>
                  </div>
                </div>
                <div className="ml-10 h-1 bg-[#F0EDE8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: i === 0 ? '#D97706' : i === 1 ? '#1A6B3C' : '#9CA3AF',
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
    <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={14} className="text-[#1A6B3C]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
            Target Omzet Bulanan
          </span>
        </div>

        {editingTarget ? (
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#C4BFBA]">Rp</span>
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
                className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl pl-8 pr-2 py-2 text-sm
                  text-right focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
              />
            </div>
            <button
              type="button"
              onClick={onSave}
              className="w-10 h-10 bg-[#1A6B3C] text-white rounded-xl flex items-center justify-center
                hover:bg-[#15593A] transition-colors shrink-0"
            >
              <Check size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <div>
              <p
                className="text-2xl font-bold text-[#1A1A18] tabular-nums"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                {target > 0 ? formatRp(target) : '—'}
              </p>
              {target === 0 && (
                <p className="text-xs text-[#C4BFBA] mt-0.5">Tap untuk atur target bulanan</p>
              )}
            </div>
            <button
              type="button"
              onClick={onStartEdit}
              className="text-xs font-medium text-[#1A6B3C] hover:text-[#15593A] transition-colors
                flex items-center gap-1"
            >
              <Edit3 size={12} />
              {target > 0 ? 'Ubah' : 'Atur Target'}
            </button>
          </div>
        )}

        {target > 0 && (
          <>
            {/* Progress bar */}
            <div className="relative h-3 bg-[#F0EDE8] rounded-full overflow-hidden mb-3">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct * 100}%`,
                  background: reached ? '#1A6B3C' : pct >= 0.75 ? '#D97706' : '#2563EB',
                }}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <span
                  className="font-bold tabular-nums"
                  style={{
                    color: reached ? '#1A6B3C' : pct >= 0.75 ? '#D97706' : '#2563EB',
                    fontFamily: 'var(--font-bricolage, system-ui)',
                  }}
                >
                  {(pct * 100).toFixed(1)}%
                </span>
                <span className="text-[#9CA3AF] ml-1">tercapai</span>
              </div>
              {reached ? (
                <span className="flex items-center gap-1 text-[#1A6B3C] font-semibold">
                  <CheckCircle size={12} />
                  Target tercapai!
                </span>
              ) : (
                <span className="text-[#9CA3AF]">
                  kurang <span className="font-semibold text-[#1A1A18] tabular-nums">{formatRp(shortfall)}</span>
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
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-12 shadow-sm text-center">
      <BarChart3 size={32} className="mx-auto text-[#C4BFBA] mb-3" />
      <p className="text-sm font-medium text-[#78716C]">Belum ada data penjualan</p>
      <p className="text-xs text-[#C4BFBA] mt-1 mb-5">
        Buka halaman Kasir dan selesaikan transaksi pertama.
      </p>
      <Link
        href="/pos"
        className="inline-flex items-center gap-2 text-sm font-semibold text-white
          bg-[#1A6B3C] px-4 py-2.5 rounded-xl hover:bg-[#15593A] transition-colors"
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
  label: string; emoji: string;
  tagBg: string; tagText: string; desc: string; advice: string;
}> = {
  star:      { label: 'Star',      emoji: '⭐', tagBg: '#ECFDF5', tagText: '#1A6B3C', desc: 'Laris · Profit Tinggi', advice: 'Pertahankan & tonjolkan!' },
  puzzle:    { label: 'Puzzle',    emoji: '❓', tagBg: '#EFF6FF', tagText: '#1D4ED8', desc: 'Sepi · Profit Tinggi',  advice: 'Promosikan lebih kencang' },
  plowhorse: { label: 'Plowhorse', emoji: '🐴', tagBg: '#FEF3C7', tagText: '#D97706', desc: 'Laris · Profit Rendah', advice: 'Naikkan harga / kurangi HPP' },
  dog:       { label: 'Dog',       emoji: '🐕', tagBg: '#FEF2F2', tagText: '#DC2626', desc: 'Sepi · Profit Rendah',  advice: 'Hapus atau repositioning' },
};

const CATEGORY_ORDER: MenuCategory[] = ['star', 'puzzle', 'plowhorse', 'dog'];

function MenuAnalysis({ items, period }: { items: MenuAnalysisItem[]; period: Period }) {
  if (items.length < 2) return null;

  const counts = Object.fromEntries(
    CATEGORY_ORDER.map(c => [c, items.filter(i => i.category === c).length]),
  ) as Record<MenuCategory, number>;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical size={14} className="text-[#1A6B3C]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
              Analisis Menu
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Matriks menu engineering · {PERIOD_LABELS[period].toLowerCase()}
          </p>
        </div>
        {/* Category count pills */}
        <div className="flex flex-wrap gap-1.5 justify-end">
          {CATEGORY_ORDER.map(c => (
            <span
              key={c}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: CATEGORY_CFG[c].tagBg, color: CATEGORY_CFG[c].tagText }}
            >
              {CATEGORY_CFG[c].emoji} {counts[c]}
            </span>
          ))}
        </div>
      </div>

      {/* 2×2 Matrix */}
      <div className="mb-5">
        <div className="grid grid-cols-2 gap-1.5">
          {(['star', 'puzzle', 'plowhorse', 'dog'] as MenuCategory[]).map(cat => {
            const cfg = CATEGORY_CFG[cat];
            const catItems = items.filter(i => i.category === cat);
            return (
              <div
                key={cat}
                className="rounded-xl p-3 border"
                style={{ background: cfg.tagBg, borderColor: `${cfg.tagText}30` }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base leading-none">{cfg.emoji}</span>
                  <span className="text-xs font-bold" style={{ color: cfg.tagText }}>{cfg.label}</span>
                  <span
                    className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.6)', color: cfg.tagText }}
                  >
                    {catItems.length}
                  </span>
                </div>
                <p className="text-[9px] text-[#9CA3AF] mb-1.5">{cfg.desc}</p>
                <p className="text-[10px] font-semibold mb-2.5" style={{ color: cfg.tagText }}>
                  → {cfg.advice}
                </p>
                <div className="space-y-0.5 min-h-[1.5rem]">
                  {catItems.length === 0 ? (
                    <p className="text-[10px] text-[#C4BFBA] italic">Tidak ada</p>
                  ) : (
                    catItems.slice(0, 4).map(i => (
                      <div key={i.recipeId} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: cfg.tagText }} />
                        <p className="text-[10px] truncate" style={{ color: cfg.tagText }}>{i.name}</p>
                      </div>
                    ))
                  )}
                  {catItems.length > 4 && (
                    <p className="text-[9px] text-[#C4BFBA]">+{catItems.length - 4} lainnya</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 px-0.5">
          <span className="text-[9px] text-[#C4BFBA] font-bold uppercase tracking-wider">← Populer</span>
          <span className="text-[9px] text-[#C4BFBA] font-bold uppercase tracking-wider">Kurang Populer →</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-[#F0EDE8]">
              {['#', 'Menu', 'Terjual', 'Margin', 'Food Cost %', 'Kategori'].map((h, i) => (
                <th
                  key={h}
                  className={`pb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA]
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
                <tr
                  key={item.recipeId}
                  className="border-b border-[#F0EDE8] last:border-0"
                >
                  <td className="py-3 pr-3 text-[11px] font-bold text-[#C4BFBA] w-8">
                    {idx + 1}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm font-medium text-[#1A1A18]">{item.name}</span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-sm font-medium text-[#1A1A18]">
                    {item.totalQty.toLocaleString('id-ID')}×
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-sm font-semibold"
                    style={{ color: item.profitMargin >= 0.25 ? '#1A6B3C' : '#D97706' }}>
                    {(item.profitMargin * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        color: item.foodCostPct < 35 ? '#1A6B3C' : item.foodCostPct <= 45 ? '#D97706' : '#DC2626',
                        background: item.foodCostPct < 35 ? '#ECFDF5' : item.foodCostPct <= 45 ? '#FEF3C7' : '#FEF2F2',
                      }}
                    >
                      {item.foodCostPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex flex-col items-end gap-0.5">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: cfg.tagBg, color: cfg.tagText }}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                      <span className="text-[9px] text-[#9CA3AF]">{cfg.advice}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[#C4BFBA] mt-4 pt-3 border-t border-[#F0EDE8]">
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
        topMenus,
        transactions: current.slice(0, 30).map(r => ({
          timestamp: r.timestamp,
          itemsLabel: r.items.map(i => `${i.qty}× ${i.recipeName}`).join(', '),
          tier: r.tier,
          revenue: r.totalRevenue,
          profit: r.grossProfit,
          note: r.note,
          cancelled: r.cancelled,
        })),
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const current = useMemo(
    () => filterByPeriod(records, period).filter(r => !r.cancelled),
    [records, period],
  );
  const previous = useMemo(
    () => filterPrevPeriod(records, period).filter(r => !r.cancelled),
    [records, period],
  );

  const metrics = useMemo(() => {
    const omzet     = current.reduce((s, r) => s + r.totalRevenue, 0);
    const modal     = current.reduce((s, r) => s + r.totalHPP, 0);
    const labaKotor = current.reduce((s, r) => s + r.grossProfit, 0);
    const txCount   = current.length;
    const avgTx     = txCount > 0 ? omzet / txCount : 0;
    const margin    = omzet > 0 ? (labaKotor / omzet) * 100 : 0;

    const opexDeduction = period === 'month' ? opex
                        : period === 'today' ? opex / 30
                        : 0;
    const labaBersih = labaKotor - opexDeduction;

    const pOmzet  = previous.reduce((s, r) => s + r.totalRevenue, 0);
    const pModal  = previous.reduce((s, r) => s + r.totalHPP, 0);
    const pLabaK  = previous.reduce((s, r) => s + r.grossProfit, 0);

    return {
      omzet, modal, labaKotor, labaBersih,
      txCount, avgTx, margin, opexDeduction,
      trendOmzet:  pctChange(omzet,     pOmzet),
      trendModal:  pctChange(modal,     pModal),
      trendLabaK:  pctChange(labaKotor, pLabaK),
    };
  }, [current, previous, opex, period]);

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

  // Stock lifetime: average daily consumption over last 14 days
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

  // Top 3 menus from the last 7 days (independent of period filter)
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
      profitMargin: v.totalRevenue > 0 ? (v.totalRevenue - v.totalCost) / v.totalRevenue : 0,
      foodCostPct: v.totalRevenue > 0 ? (v.totalCost / v.totalRevenue) * 100 : 0,
    }));

    if (raw.length < 2) return [];

    const avgQty    = raw.reduce((s, i) => s + i.totalQty,     0) / raw.length;
    const avgMargin = raw.reduce((s, i) => s + i.profitMargin, 0) / raw.length;

    return raw
      .map(item => ({
        ...item,
        category: ((): MenuCategory => {
          const hi = item.totalQty     >= avgQty;
          const hp = item.profitMargin >= avgMargin;
          if (hi && hp)  return 'star';
          if (hi && !hp) return 'plowhorse';
          if (!hi && hp) return 'puzzle';
          return 'dog';
        })(),
      }))
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
      dailyAvgRevenue,
      dailyAvgProfit,
      mtdRevenue,
      mtdProfit,
      daysRemaining,
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
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Navbar active="dashboard" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">

        {/* ── Quick Overview: always visible regardless of period ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <StockLifetimeCard items={stockLifetime} />
          <WeeklyTop3Card items={weeklyTop3} />
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                period === p
                  ? 'bg-[#1A6B3C] text-white border-[#1A6B3C]'
                  : 'bg-white text-[#78716C] border-[#E5E3DD] hover:border-[#1A6B3C]/30'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Row 1: 3 main financial cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Total Omzet"
                value={formatRp(metrics.omzet)}
                icon={<TrendingUp size={16} />}
                iconBg="#ECFDF5"
                iconColor="#1A6B3C"
                sub="Pendapatan kotor dari penjualan"
                trend={metrics.trendOmzet}
                prevLabel={prevLabel}
              />
              <MetricCard
                label="Total Modal (COGS)"
                value={formatRp(metrics.modal)}
                icon={<ShoppingCart size={16} />}
                iconBg="#F3F4F6"
                iconColor="#6B7280"
                sub="Harga pokok semua produk terjual"
                trend={metrics.trendModal}
                prevLabel={prevLabel}
              />
              <MetricCard
                label="Laba Kotor"
                value={formatRp(metrics.labaKotor)}
                icon={metrics.labaKotor >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                iconBg={metrics.labaKotor >= 0 ? '#F0FDF4' : '#FEF2F2'}
                iconColor={metrics.labaKotor >= 0 ? '#1A6B3C' : '#DC2626'}
                sub={`Margin ${metrics.margin.toFixed(1)}% dari omzet`}
                trend={metrics.trendLabaK}
                prevLabel={prevLabel}
                highlight={metrics.labaKotor > 0}
              />
            </div>

            {/* ── Monthly Target (only for month period) ── */}
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

            {/* ── Profit Bersih card (full width) ── */}
            <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
              <div className="p-5 sm:grid sm:grid-cols-[1fr_auto] sm:gap-8 sm:items-center">

                {/* Left: Profit Bersih number */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
                      Profit Bersih
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-[#FFFBEB] flex items-center justify-center">
                      <Wallet size={12} className="text-[#D97706]" />
                    </div>
                  </div>

                  <p
                    className="text-[2.5rem] font-bold leading-none tabular-nums"
                    style={{
                      fontFamily: 'var(--font-bricolage, system-ui)',
                      color: metrics.labaBersih >= 0 ? '#1A1A18' : '#DC2626',
                    }}
                  >
                    {formatRp(metrics.labaBersih)}
                  </p>

                  {/* Breakdown */}
                  <div className="mt-4 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-[#78716C]">
                      <span className="w-3 h-px bg-[#1A6B3C] inline-block" />
                      <span>Laba Kotor</span>
                      <span className="ml-auto tabular-nums font-medium text-[#1A6B3C]">
                        {formatRp(metrics.labaKotor)}
                      </span>
                    </div>
                    {metrics.opexDeduction > 0 && (
                      <div className="flex items-center gap-2 text-[#78716C]">
                        <span className="w-3 h-px bg-[#D97706] inline-block" />
                        <span>Biaya Operasional{period === 'today' ? ' (est. harian)' : ''}</span>
                        <span className="ml-auto tabular-nums font-medium text-[#D97706]">
                          − {formatRp(metrics.opexDeduction)}
                        </span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-[#F0EDE8] flex items-center gap-2 font-semibold">
                      <span className="w-3 h-px bg-[#1A1A18] inline-block" />
                      <span className="text-[#1A1A18]">Profit Bersih</span>
                      <span
                        className="ml-auto tabular-nums"
                        style={{ color: metrics.labaBersih >= 0 ? '#1A1A18' : '#DC2626' }}
                      >
                        {formatRp(metrics.labaBersih)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Biaya Operasional Bulanan input */}
                <div className="mt-5 sm:mt-0 sm:min-w-[240px] bg-[#F8F7F2] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] mb-3">
                    Biaya Operasional Bulanan
                  </p>
                  {editingOpex ? (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs
                          text-[#C4BFBA]">Rp</span>
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
                          className="w-full bg-white border border-[#E5E3DD] rounded-xl
                            pl-8 pr-2 py-2 text-sm text-right focus:outline-none
                            focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveOpex}
                        className="w-10 h-10 bg-[#1A6B3C] text-white rounded-xl flex items-center
                          justify-center hover:bg-[#15593A] transition-colors shrink-0"
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
                        className="text-xl font-bold text-[#1A1A18] tabular-nums"
                        style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                      >
                        {opex > 0 ? formatRp(opex) : '—'}
                      </span>
                      <Edit3 size={13} className="text-[#C4BFBA] group-hover:text-[#78716C]
                        transition-colors" />
                    </button>
                  )}
                  <p className="text-[10px] text-[#C4BFBA] mt-2">
                    Sewa, gaji, listrik, dan biaya tetap lainnya per bulan
                  </p>
                </div>
              </div>
            </div>

            {/* ── Row 3: Secondary metrics ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <SmallCard
                label="Transaksi"
                value={metrics.txCount.toLocaleString('id-ID')}
                sub={PERIOD_LABELS[period].toLowerCase()}
              />
              <SmallCard
                label="Rata-rata / Transaksi"
                value={metrics.avgTx > 0 ? formatRp(metrics.avgTx) : '—'}
                sub="nilai per transaksi"
              />
              <SmallCard
                label="Margin Kotor"
                value={metrics.margin > 0 ? `${metrics.margin.toFixed(1)}%` : '—'}
                sub="dari total omzet"
              />
            </div>

            {/* ── Tren 7 Hari ── */}
            <SalesTrendChart data={chartData} />

            {/* ── Cash Flow Forecast ── */}
            <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-[#1A6B3C]" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
                    Proyeksi Cash Flow
                  </span>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">Estimasi akhir bulan · tren 7 hari</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] mb-1">
                    Realisasi MTD
                  </p>
                  <p
                    className="text-xl font-bold text-[#1A1A18] tabular-nums"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                  >
                    {formatRp(cashFlowForecast.mtdRevenue)}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                    profit {formatRp(cashFlowForecast.mtdProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] mb-1">
                    Avg / Hari (7h)
                  </p>
                  <p
                    className="text-xl font-bold text-[#1A1A18] tabular-nums"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                  >
                    {formatRp(cashFlowForecast.dailyAvgRevenue)}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                    profit {formatRp(cashFlowForecast.dailyAvgProfit)}
                  </p>
                </div>
                <div className="bg-[#F0FDF4] rounded-xl p-3 border border-[#BBF7D0]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A6B3C] mb-1">
                    Proyeksi Bulan Ini
                  </p>
                  <p
                    className="text-xl font-bold text-[#1A6B3C] tabular-nums"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                  >
                    {formatRp(cashFlowForecast.forecastRevenue)}
                  </p>
                  <p className="text-[10px] text-[#059669] mt-0.5">
                    est. profit {formatRp(cashFlowForecast.forecastProfit)}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] mt-1">
                    +{cashFlowForecast.daysRemaining} hari tersisa
                  </p>
                </div>
              </div>
            </div>

            {/* ── Analisis Menu ── */}
            <MenuAnalysis items={menuAnalysis} period={period} />

            {/* ── Bottom: Top menu + Recent transactions ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Top menu */}
              {topMenus.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Star size={14} className="text-[#D97706]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
                      Menu Terlaris
                    </span>
                  </div>
                  <div className="space-y-3">
                    {topMenus.map((menu, i) => {
                      const maxQty = topMenus[0].qty;
                      const pct = maxQty > 0 ? (menu.qty / maxQty) * 100 : 0;
                      return (
                        <div key={menu.name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold w-4 text-center ${
                                i === 0 ? 'text-[#D97706]' : 'text-[#C4BFBA]'
                              }`}>
                                {i + 1}
                              </span>
                              <span className="font-medium text-[#1A1A18]">{menu.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-[#1A1A18] tabular-nums">
                                {menu.qty}×
                              </span>
                              <span className="text-[#9CA3AF] ml-2 tabular-nums text-xs">
                                {formatRp(menu.revenue)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1 bg-[#F0EDE8] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? '#D97706' : '#1A6B3C',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent transactions */}
              <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Receipt size={14} className="text-[#1A6B3C]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
                    Transaksi Terakhir
                  </span>
                </div>
                {current.length === 0 ? (
                  <p className="text-sm text-[#C4BFBA] py-4 text-center">Belum ada transaksi</p>
                ) : (
                  <div className="space-y-2.5">
                    {current.slice(0, 7).map(rec => (
                      <div key={rec.id}
                        className="flex items-start justify-between gap-3 pb-2.5
                          border-b border-[#F0EDE8] last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A1A18] truncate">
                            {rec.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {new Date(rec.timestamp).toLocaleString('id-ID', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                            <span className="ml-2 capitalize opacity-70">{rec.tier}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#1A1A18] tabular-nums">
                            {formatRp(rec.totalRevenue)}
                          </p>
                          <p className="text-[11px] text-[#1A6B3C] tabular-nums font-medium">
                            +{formatRp(rec.grossProfit)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── Histori Transaksi ── */}
        {records.length > 0 && (() => {
          const sorted = [...records].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          const totalPages = Math.ceil(sorted.length / HIST_PAGE_SIZE);
          const page = Math.min(histPage, totalPages - 1);
          const pageRecords = sorted.slice(page * HIST_PAGE_SIZE, (page + 1) * HIST_PAGE_SIZE);

          return (
            <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F0EDE8]">
                <Receipt size={14} className="text-[#1A6B3C]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
                  Histori Transaksi
                </span>
                <span className="ml-auto text-xs text-[#9CA3AF] mr-3">
                  {records.length} transaksi
                </span>
                {hasData && (
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white
                      bg-[#1A6B3C] px-3 py-1.5 rounded-xl hover:bg-[#15593A] transition-colors
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <FileDown size={12} />
                    Export PDF
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#F0EDE8]">
                {pageRecords.map(rec => {
                  const isCancelled = !!rec.cancelled;
                  const isConfirming = cancellingId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                        isCancelled ? 'bg-[#FAFAFA] opacity-60' : 'hover:bg-[#FAFAF9]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-[#1A1A18]">
                            {rec.items.map(i => `${i.qty}× ${i.recipeName}`).join(', ')}
                          </p>
                          {isCancelled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold
                              bg-[#FEF2F2] text-[#DC2626] px-2 py-0.5 rounded-full shrink-0">
                              <XCircle size={8} />
                              Dibatalkan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#9CA3AF]">
                          {new Date(rec.timestamp).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="capitalize">{rec.tier}</span>
                          <span className="mx-1.5 opacity-40">·</span>
                          {rec.items.reduce((s, i) => s + i.qty, 0)} item
                        </p>
                        {rec.note && (
                          <p className="text-[11px] text-[#78716C] italic mt-0.5 flex items-center gap-1">
                            <MessageSquare size={9} className="shrink-0" />
                            {rec.note}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${
                          isCancelled ? 'line-through text-[#9CA3AF]' : 'text-[#1A1A18]'
                        }`}>
                          {formatRp(rec.totalRevenue)}
                        </p>
                        <p className={`text-[11px] tabular-nums font-medium ${
                          isCancelled ? 'text-[#C4BFBA]' : 'text-[#1A6B3C]'
                        }`}>
                          +{formatRp(rec.grossProfit)}
                        </p>
                        {!isCancelled && (
                          <div className="mt-2">
                            {isConfirming ? (
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-[11px] text-[#78716C]">Yakin?</span>
                                <button
                                  type="button"
                                  onClick={() => handleCancel(rec)}
                                  className="text-[11px] font-semibold text-white bg-[#DC2626]
                                    px-2.5 py-1 rounded-lg hover:bg-[#B91C1C] transition-colors"
                                >
                                  Ya
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCancellingId(null)}
                                  className="text-[11px] font-semibold text-[#78716C] bg-[#F3F4F6]
                                    px-2.5 py-1 rounded-lg hover:bg-[#E5E7EB] transition-colors"
                                >
                                  Tidak
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCancellingId(rec.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium
                                  text-[#DC2626] hover:text-[#B91C1C] transition-colors"
                              >
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
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0EDE8]">
                  <button
                    type="button"
                    onClick={() => { setHistPage(p => Math.max(0, p - 1)); setCancellingId(null); }}
                    disabled={page === 0}
                    className="flex items-center gap-1 text-xs font-medium text-[#78716C]
                      hover:text-[#1A1A18] disabled:opacity-30 disabled:cursor-not-allowed
                      transition-colors px-2 py-1.5 rounded-lg hover:bg-[#F8F7F2]"
                  >
                    <ChevronLeft size={14} /> Sebelumnya
                  </button>
                  <span className="text-xs text-[#9CA3AF] tabular-nums">
                    {page + 1} / {totalPages}
                    <span className="text-[#C4BFBA] ml-1.5">
                      ({page * HIST_PAGE_SIZE + 1}–{Math.min((page + 1) * HIST_PAGE_SIZE, sorted.length)} dari {sorted.length})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setHistPage(p => Math.min(totalPages - 1, p + 1)); setCancellingId(null); }}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 text-xs font-medium text-[#78716C]
                      hover:text-[#1A1A18] disabled:opacity-30 disabled:cursor-not-allowed
                      transition-colors px-2 py-1.5 rounded-lg hover:bg-[#F8F7F2]"
                  >
                    Berikutnya <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Backup & Restore ── */}
        <BackupRestore />

      </main>
    </div>
  );
}
