'use client';

import { useState, useRef, useEffect } from 'react';
import type { SavedRawIngredient } from '@/types/hpp';

interface IngredientNameInputProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: SavedRawIngredient) => void;
  suggestions: SavedRawIngredient[];
  placeholder?: string;
  className?: string;
}

export function IngredientNameInput({
  value, onChange, onSelect, suggestions, placeholder, className = '',
}: IngredientNameInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim().length >= 1
    ? suggestions.filter(s => s.name.toLowerCase().includes(value.toLowerCase()))
    : [];

  const showDropdown = open && filtered.length > 0;

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleSelect = (item: SavedRawIngredient) => {
    onSelect(item);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const fmt = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
          transition-colors placeholder:text-[var(--text-4)]"
      />
      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-[var(--surface)] border border-[var(--border)]
          rounded-xl shadow-lg py-1 min-w-full max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={item.name}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors
                ${i === activeIdx ? 'bg-[var(--tint-amber-deep)] text-[#27B18A]' : 'hover:bg-[var(--bg)]'}`}
            >
              <span className="font-medium text-[var(--text)] block">{item.name}</span>
              <span className="text-[11px] text-[var(--text-2)]">
                {fmt(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
