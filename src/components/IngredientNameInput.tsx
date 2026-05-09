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
        className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
          transition-colors placeholder:text-[#C4BFBA]"
      />
      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E5E3DD]
          rounded-xl shadow-lg py-1 min-w-full max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={item.name}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors
                ${i === activeIdx ? 'bg-[#F0FDF4] text-[#1A6B3C]' : 'hover:bg-[#F8F7F2]'}`}
            >
              <span className="font-medium text-[#1A1A18] block">{item.name}</span>
              <span className="text-[11px] text-[#78716C]">
                {fmt(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
