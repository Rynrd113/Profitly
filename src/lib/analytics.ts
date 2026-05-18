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
