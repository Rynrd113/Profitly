'use client';

import { Coffee, Package, FlaskConical } from 'lucide-react';

export type CalcMode = 'satuan' | 'batch' | 'turunan';

const MODES: Array<{ id: CalcMode; label: string; icon: React.ReactNode }> = [
  { id: 'satuan',   label: 'Satuan',  icon: <Coffee size={14} /> },
  { id: 'batch',    label: 'Batch',   icon: <Package size={14} /> },
  { id: 'turunan',  label: 'Turunan', icon: <FlaskConical size={14} /> },
];

export function ModeSelectorCards({
  activeMode,
  onChange,
}: {
  activeMode: CalcMode;
  onChange: (mode: CalcMode) => void;
}) {
  return (
    <div className="flex gap-2 mb-5">
      {MODES.map(m => {
        const isActive = m.id === activeMode;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`flex-1 relative flex flex-col items-center gap-1.5 py-3 px-2
              rounded-xl border text-xs font-semibold transition-all overflow-hidden
              ${isActive
                ? 'border-[#27B18A] text-[#27B18A] bg-[var(--surface)]'
                : 'border-[var(--border)] text-[var(--text-3)] bg-[var(--surface)] hover:text-[var(--text)]'
              }`}
          >
            {isActive && (
              <span className="absolute top-0 left-0 right-0 h-[3px] bg-[#27B18A]" />
            )}
            {m.icon}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
