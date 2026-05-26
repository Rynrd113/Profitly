'use client';

import { UtensilsCrossed, Briefcase, ShoppingBag, Wheat } from 'lucide-react';
import type { BusinessType } from '@/types/business';

const TYPES: Array<{ id: BusinessType; label: string; sub: string; icon: React.ReactNode }> = [
  { id: 'FNB',         label: 'F&B',        sub: 'Kafe / Resto',  icon: <UtensilsCrossed size={14} /> },
  { id: 'SERVICE',     label: 'Jasa',       sub: 'Salon / Servis', icon: <Briefcase size={14} /> },
  { id: 'MARKETPLACE', label: 'Marketplace', sub: 'Toko Online',   icon: <ShoppingBag size={14} /> },
  { id: 'WHOLESALE',   label: 'Wholesale',  sub: 'Ternak / Agro',  icon: <Wheat size={14} /> },
];

export function BusinessTypeSelectorCards({
  value,
  onChange,
}: {
  value: BusinessType;
  onChange: (type: BusinessType) => void;
}) {
  return (
    <div className="flex gap-2 mb-4">
      {TYPES.map(t => {
        const isActive = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex-1 relative flex flex-col items-center gap-1 py-2.5 px-2
              rounded-xl border text-xs font-semibold transition-all overflow-hidden
              ${isActive
                ? 'border-[#27B18A] text-[#27B18A] bg-[var(--surface)]'
                : 'border-[var(--border)] text-[var(--text-3)] bg-[var(--surface)] hover:text-[var(--text)]'
              }`}
          >
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-[3px] bg-[#27B18A]" />
            )}
            {t.icon}
            <span>{t.label}</span>
            <span className={`text-[10px] font-normal ${isActive ? 'text-[#27B18A]/70' : 'text-[var(--text-4)]'}`}>
              {t.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
