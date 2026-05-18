'use client';

import { Star, HelpCircle, BarChart2, AlertTriangle } from 'lucide-react';

type MECategory = 'star' | 'puzzle' | 'plowhorse' | 'dog';

interface MEItem {
  name: string;
  qty: number;
  revenue: number;
  margin: number;
  category: MECategory;
}

interface BadgeMeta {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const BADGE_META: Record<MECategory, BadgeMeta> = {
  star:      { label: 'STAR',      icon: <Star size={9} />,          color: '#27B18A', bg: '#E8F5E9' },
  puzzle:    { label: 'PUZZLE',    icon: <HelpCircle size={9} />,    color: '#8892A9', bg: '#F1F3F5' },
  plowhorse: { label: 'PLOWHORSE', icon: <BarChart2 size={9} />,     color: '#845C58', bg: '#FDF2E9' },
  dog:       { label: 'DOG',       icon: <AlertTriangle size={9} />, color: '#E11D48', bg: '#FFF5F5' },
};

interface MenuTableProps {
  items: MEItem[];
}

export function MenuTable({ items }: MenuTableProps) {
  if (items.length === 0) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {['Menu', 'Qty', 'Revenue', 'Margin', 'Kategori'].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] bg-[var(--surface)]
                  ${i === 0 ? 'text-left' : 'text-right'}
                  ${i === 4 ? 'text-center' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => {
            const b = BADGE_META[item.category];
            const marginHigh = item.margin >= 0.35;
            return (
              <tr
                key={item.name}
                className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--bg)]"
              >
                <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                  <span className="text-[11px] text-[var(--text-4)] mr-2 tabular-nums">{idx + 1}.</span>
                  {item.name}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[var(--text-2)]">
                  {item.qty.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 text-sm text-right tabular-nums text-[var(--text)]">
                  {fmt(item.revenue)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(1, item.margin) * 100}%`,
                          background: marginHigh ? 'linear-gradient(90deg, #3ED1A5, #0E927A)' : 'var(--text-4)',
                        }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums font-medium text-[var(--text-2)] w-10 text-right">
                      {(item.margin * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide leading-none border"
                    style={{
                      color: b.color,
                      background: b.bg + '1A',
                      borderColor: b.color + '33',
                    }}
                  >
                    {b.icon}
                    {b.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
