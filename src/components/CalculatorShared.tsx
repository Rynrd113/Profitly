'use client';

import { Trash2, Plus, Star } from 'lucide-react';
import type { PricingTier } from '@/types/hpp';

export const TIER_META = {
  competitive: {
    label: 'Kompetitif', desc: 'Margin 20%',
    color: 'var(--text-2)', ring: 'var(--border)', bar: 'var(--text-3)',
  },
  standard: {
    label: 'Standar', desc: 'Margin 35%',
    color: '#27B18A', ring: '#065F46', bar: '#27B18A',
  },
  premium: {
    label: 'Premium', desc: 'Margin 50%',
    color: '#27B18A', ring: '#065F46', bar: '#27B18A',
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
      className={`bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
        focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
        transition-colors placeholder:text-[var(--text-4)] ${className}`}
    />
  );
}

const _numFmt = new Intl.NumberFormat('id-ID');

export function NumInput({
  value, onChange, placeholder, prefix, suffix, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; className?: string;
}) {
  const isRupiah = prefix === 'Rp';

  const displayValue = (() => {
    if (!isRupiah || value === '' || value === '-') return value;
    const n = parseInt(value.replace(/\./g, ''), 10);
    return isNaN(n) ? value : _numFmt.format(n);
  })();

  const displayPlaceholder = (() => {
    if (!isRupiah || !placeholder) return placeholder;
    const n = parseInt(placeholder, 10);
    return isNaN(n) ? placeholder : _numFmt.format(n);
  })();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isRupiah) {
      const stripped = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
      if (stripped === '') { onChange(''); return; }
      const n = parseInt(stripped, 10);
      onChange(isNaN(n) || n < 0 ? '0' : String(n));
    } else {
      const raw = e.target.value;
      if (raw === '' || raw === '-') { onChange(raw); return; }
      const n = parseFloat(raw);
      onChange(!isNaN(n) && n < 0 ? '0' : raw);
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {prefix && (
        <span className="absolute left-2.5 text-xs text-[var(--text-4)] pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        type={isRupiah ? 'text' : 'number'}
        min={isRupiah ? undefined : '0'}
        value={displayValue}
        onChange={handleChange}
        placeholder={displayPlaceholder}
        inputMode={isRupiah ? 'numeric' : 'decimal'}
        className={`w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm text-right
          focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
          transition-colors placeholder:text-[var(--text-4)] py-2
          ${prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'}`}
      />
      {suffix && (
        <span className="absolute right-2.5 text-xs text-[var(--text-4)] pointer-events-none select-none">
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
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-4)]
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
      className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#27B18A]
        hover:text-[#0E927A] transition-colors"
    >
      <Plus size={15} />
      {label}
    </button>
  );
}

export function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#27B18A]">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text)]">{label}</h2>
    </div>
  );
}

export function PricingCard({
  tier, isHighlighted, isStarred, batch, onSelect,
}: {
  tier: PricingTier; isHighlighted: boolean; isStarred?: boolean; batch: number | null;
  onSelect?: (price: number) => void;
}) {
  const starred = isStarred ?? isHighlighted;
  const m = TIER_META[tier.label];
  const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
  const Tag = onSelect ? 'button' : 'div';

  const cardStyle = isHighlighted
    ? { background: 'linear-gradient(135deg,#3ED1A5,#0E927A)', borderColor: '#0E927A', boxShadow: '0 4px 20px rgba(14,146,122,0.28)' }
    : { background: '#FDFDFD', borderColor: 'var(--border)', boxShadow: 'none' };
  const txt   = isHighlighted ? '#FFFFFF' : '#1A1A1A';
  const sub   = isHighlighted ? 'rgba(255,255,255,0.72)' : '#6B7280';
  const divider = isHighlighted ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';

  return (
    <Tag
      {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(tier.sellPrice) } : {})}
      className={`rounded-2xl p-4 border transition-all duration-300 text-left w-full${onSelect ? ' cursor-pointer hover:scale-[1.01] active:scale-95 active:shadow-inner' : ''}`}
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: isHighlighted ? '#FFFFFF' : m.color }}>{m.label}</span>
            {starred && (
              <span className="inline-flex items-center gap-0.5 bg-[#FBBF24] text-[#1A1A1A]
                text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                <Star size={8} fill="#1A1A1A" />
                SWEET SPOT
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: sub }}>{m.desc}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold leading-none"
            style={{ color: txt, fontFamily: 'var(--font-bricolage, system-ui)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(tier.sellPrice)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: sub }}>
            untung {fmt(tier.profit)} / cup
          </p>
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: divider }}>
        <div className="h-full rounded-full" style={{ width: `${tier.margin * 100}%`, background: isHighlighted ? 'rgba(255,255,255,0.55)' : m.bar }} />
      </div>
      {batch && (
        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: divider }}>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: sub }}>
              Omzet {batch} cup
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: txt }}>
              {fmt(tier.sellPrice * batch)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: sub }}>
              Profit {batch} cup
            </p>
            <p className="text-sm font-bold tabular-nums" style={{ color: txt }}>
              {fmt(tier.profit * batch)}
            </p>
          </div>
        </div>
      )}
      {onSelect && (
        <p className="mt-2 text-[10px] text-center" style={{ color: isHighlighted ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.32)' }}>
          {isHighlighted ? 'Harga terpilih ✓' : 'Klik untuk memilih harga'}
        </p>
      )}
    </Tag>
  );
}
