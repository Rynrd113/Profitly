'use client';

import { useEffect, useState } from 'react';
import { Star, HelpCircle, BarChart2, AlertTriangle } from 'lucide-react';

type MECategory = 'star' | 'puzzle' | 'plowhorse' | 'dog';

interface MEItem {
  name: string;
  qty: number;
  revenue: number;
  margin: number;
  category: MECategory;
}

interface QuadrantMeta {
  label: string;
  desc: string;
  icon: React.ReactNode;
  lightBg: string;
  lightBorderLeft: string;
  lightText: string;
  darkBorderLeft: string;
  darkText: string;
}

const QUADRANT_META: Record<MECategory, QuadrantMeta> = {
  star: {
    label: 'STAR',
    desc: 'Laris & Profit Tinggi — Pertahankan',
    icon: <Star size={16} />,
    lightBg: '#E8F5E9',
    lightBorderLeft: '#27B18A',
    lightText: '#27B18A',
    darkBorderLeft: '#27B18A66',
    darkText: '#6EE7B7',
  },
  puzzle: {
    label: 'PUZZLE',
    desc: 'Sepi tapi Margin Bagus — Promosikan',
    icon: <HelpCircle size={16} />,
    lightBg: '#F1F3F5',
    lightBorderLeft: '#8892A9',
    lightText: '#495057',
    darkBorderLeft: '#8892A966',
    darkText: '#CBD5E1',
  },
  plowhorse: {
    label: 'PLOWHORSE',
    desc: 'Laris tapi Margin Kecil — Naikkan Harga',
    icon: <BarChart2 size={16} />,
    lightBg: '#FDF2E9',
    lightBorderLeft: '#845C58',
    lightText: '#845C58',
    darkBorderLeft: '#845C5866',
    darkText: '#D4A76A',
  },
  dog: {
    label: 'DOG',
    desc: 'Sepi & Margin Rendah — Evaluasi',
    icon: <AlertTriangle size={16} />,
    lightBg: '#FFF5F5',
    lightBorderLeft: '#E11D48',
    lightText: '#E11D48',
    darkBorderLeft: '#E11D4866',
    darkText: '#FB7185',
  },
};

const ORDER: MECategory[] = ['star', 'puzzle', 'plowhorse', 'dog'];

function useIsLight() {
  const [isLight, setIsLight] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light',
  );
  useEffect(() => {
    const check = () => setIsLight(document.documentElement.dataset.theme === 'light');
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return isLight;
}

interface MenuEngineeringProps {
  items: MEItem[];
}

export function MenuEngineering({ items }: MenuEngineeringProps) {
  const isLight = useIsLight();

  if (items.length === 0) return null;

  const byCategory = ORDER.reduce<Record<MECategory, MEItem[]>>(
    (acc, cat) => { acc[cat] = items.filter(i => i.category === cat); return acc; },
    { star: [], puzzle: [], plowhorse: [], dog: [] },
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const descColor   = isLight ? '#6B7280' : '#94A3B8';
  const dividerDark = 'rgba(255,255,255,0.06)';

  return (
    <div className="grid grid-cols-2 gap-3">
      {ORDER.map(cat => {
        const m = QUADRANT_META[cat];
        const catItems = byCategory[cat];

        const cardBg      = isLight ? m.lightBg : '#1A1A1A';
        const borderL     = isLight ? m.lightBorderLeft : m.darkBorderLeft;
        const textColor   = isLight ? m.lightText : m.darkText;
        const badgeBg     = isLight ? m.lightBg + 'AA' : 'transparent';
        const badgeBorder = isLight ? m.lightBorderLeft + '33' : m.darkBorderLeft;
        const divider     = isLight ? m.lightBorderLeft + '25' : dividerDark;

        return (
          <div
            key={cat}
            className="rounded-2xl p-4 border border-[var(--border-subtle)]"
            style={{ background: cardBg, borderLeftColor: borderL, borderLeftWidth: '4px' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: textColor }}>{m.icon}</span>
              <span
                className="text-[12px] font-bold uppercase tracking-wider"
                style={{ color: textColor, fontFamily: 'var(--font-jakarta, system-ui)' }}
              >
                {m.label}
              </span>
              <span
                className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full leading-none border"
                style={{ color: textColor, background: badgeBg, borderColor: badgeBorder }}
              >
                {catItems.length}
              </span>
            </div>
            <p className="text-[11px] mb-3 leading-snug" style={{ color: descColor }}>{m.desc}</p>

            {catItems.length === 0 ? (
              <p className="text-[11px] italic" style={{ color: descColor }}>Tidak ada menu</p>
            ) : (
              <div className="space-y-1.5">
                {catItems.map(item => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium truncate" style={{ color: textColor }}>
                      {item.name}
                    </span>
                    <span className="text-[10px] tabular-nums shrink-0" style={{ color: descColor }}>
                      {item.qty}×
                    </span>
                  </div>
                ))}
              </div>
            )}

            {catItems.length > 0 && (
              <div
                className="mt-3 pt-2.5 border-t flex items-center justify-between"
                style={{ borderColor: divider }}
              >
                <span className="text-[10px] font-medium" style={{ color: descColor }}>Total</span>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: textColor }}
                >
                  {fmt(catItems.reduce((s, i) => s + i.revenue, 0))}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
