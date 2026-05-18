import type { SaleRecord } from '@/types/hpp';

export interface DailyRevenue {
  date: string;
  revenue: number;
  profit: number;
}

export interface MenuMarginStat {
  name: string;
  totalRevenue: number;
  totalCost: number;
  totalQty: number;
  margin: number;
}

export function getDailyRevenueLast7Days(records: SaleRecord[]): DailyRevenue[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toDateString();
    const day = records.filter(r => !r.cancelled && new Date(r.timestamp).toDateString() === dateStr);
    return {
      date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
      revenue: day.reduce((s, r) => s + r.totalRevenue, 0),
      profit:  day.reduce((s, r) => s + r.grossProfit, 0),
    };
  });
}

export interface HourlyStat {
  hour: number;
  label: string;
  txCount: number;
  revenue: number;
}

export interface TopSellingItem {
  name: string;
  totalQty: number;
  totalRevenue: number;
}

export function getPeakHours(records: SaleRecord[]): HourlyStat[] {
  const map = new Map<number, { txCount: number; revenue: number }>();
  for (const r of records) {
    if (r.cancelled) continue;
    const h = new Date(r.timestamp).getHours();
    const prev = map.get(h) ?? { txCount: 0, revenue: 0 };
    map.set(h, { txCount: prev.txCount + 1, revenue: prev.revenue + r.totalRevenue });
  }
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    ...(map.get(h) ?? { txCount: 0, revenue: 0 }),
  }));
}

export function getTopSelling(records: SaleRecord[], n = 5): TopSellingItem[] {
  const map = new Map<string, { totalQty: number; totalRevenue: number }>();
  for (const r of records) {
    if (r.cancelled) continue;
    for (const item of r.items) {
      const prev = map.get(item.recipeName) ?? { totalQty: 0, totalRevenue: 0 };
      map.set(item.recipeName, {
        totalQty:     prev.totalQty     + item.qty,
        totalRevenue: prev.totalRevenue + item.subtotal,
      });
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, n);
}

export function getTopMenusByMargin(records: SaleRecord[], n = 3): MenuMarginStat[] {
  const map = new Map<string, { totalRevenue: number; totalCost: number; totalQty: number }>();
  for (const r of records) {
    if (r.cancelled) continue;
    for (const item of r.items) {
      const key = item.recipeName;
      const prev = map.get(key) ?? { totalRevenue: 0, totalCost: 0, totalQty: 0 };
      map.set(key, {
        totalRevenue: prev.totalRevenue + item.subtotal,
        totalCost:    prev.totalCost    + item.hpp * item.qty,
        totalQty:     prev.totalQty     + item.qty,
      });
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      ...v,
      margin: v.totalRevenue > 0 ? (v.totalRevenue - v.totalCost) / v.totalRevenue : 0,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, n);
}
