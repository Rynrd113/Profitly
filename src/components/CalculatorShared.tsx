'use client';

import { Trash2, Plus, Star } from 'lucide-react';
import type { PricingTier } from '@/types/hpp';

export const TIER_META = {
  competitive: {
    label: 'Kompetitif', desc: 'Margin 20%',
    color: '#6B7280', ring: '#E5E7EB', bg: '#F9FAFB', bar: '#9CA3AF',
  },
  standard: {
    label: 'Standar', desc: 'Margin 35%',
    color: '#1A6B3C', ring: '#BBF7D0', bg: '#F0FDF4', bar: '#1A6B3C',
  },
  premium: {
    label: 'Premium', desc: 'Margin 50%',
    color: '#92400E', ring: '#FDE68A', bg: '#FFFBEB', bar: '#D97706',
  },
} as const;

export function TextInput({
  value, onChange, placeholder, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
        focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
        transition-colors placeholder:text-[#C4BFBA] ${className}`}
    />
  );
}

export function NumInput({
  value, onChange, placeholder, prefix, suffix, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {prefix && (
        <span className="absolute left-2.5 text-xs text-[#C4BFBA] pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => {
          const raw = e.target.value;
          if (raw === '' || raw === '-') { onChange(raw); return; }
          const n = parseFloat(raw);
          onChange(!isNaN(n) && n < 0 ? '0' : raw);
        }}
        placeholder={placeholder}
        inputMode="decimal"
        className={`w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl text-sm text-right
          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
          transition-colors placeholder:text-[#C4BFBA] py-2
          ${prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'}`}
      />
      {suffix && (
        <span className="absolute right-2.5 text-xs text-[#C4BFBA] pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[#C4BFBA]
        hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
    >
      <Trash2 size={14} />
    </button>
  );
}

export function AddRowBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#1A6B3C]
        hover:text-[#15803D] transition-colors"
    >
      <Plus size={15} />
      {label}
    </button>
  );
}

export function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#1A6B3C]">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#1A1A18]">{label}</h2>
    </div>
  );
}

export function PricingCard({
  tier, isHighlighted, batch,
}: {
  tier: PricingTier; isHighlighted: boolean; batch: number | null;
}) {
  const m = TIER_META[tier.label];
  const formatRpLocal = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  return (
    <div
      className="rounded-2xl p-4 border transition-shadow"
      style={{
        background: m.bg,
        borderColor: isHighlighted ? m.ring : '#E5E3DD',
        borderWidth: isHighlighted ? '1.5px' : '1px',
        boxShadow: isHighlighted ? `0 0 0 3px ${m.ring}50` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</span>
            {isHighlighted && (
              <span className="inline-flex items-center gap-0.5 bg-[#D97706] text-white
                text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                <Star size={8} fill="white" />
                SWEET SPOT
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: m.color + '99' }}>{m.desc}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold leading-none"
            style={{ color: m.color, fontFamily: 'var(--font-bricolage, system-ui)', fontVariantNumeric: 'tabular-nums' }}>
            {formatRpLocal(tier.sellPrice)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: m.color + '88' }}>
            untung {formatRpLocal(tier.profit)} / cup
          </p>
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full overflow-hidden bg-black/5">
        <div className="h-full rounded-full" style={{ width: `${tier.margin * 100}%`, background: m.bar }} />
      </div>
      {batch && (
        <div className="mt-3 pt-3 border-t border-black/5 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: m.color + '88' }}>
              Omzet {batch} cup
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>
              {formatRpLocal(tier.sellPrice * batch)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: m.color + '88' }}>
              Profit {batch} cup
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: m.color }}>
              {formatRpLocal(tier.profit * batch)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
