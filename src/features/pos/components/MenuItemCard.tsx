'use client';

import { Plus, Minus, AlertTriangle, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatRp } from '@/lib/format';

interface MenuItemCardProps {
  recipe: {
    id: string;
    name: string;
    hpp: number;
    mode?: string;
    portionUnit?: string;
    ingredients: Array<{ name: string; usage: string; unit: string }>;
  };
  sellPrice: number;
  qty: number;
  hasStock: boolean;
  noStockData: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onEditMapping: () => void;
}

export function MenuItemCard({
  recipe,
  sellPrice,
  qty,
  hasStock,
  noStockData,
  onAdd,
  onIncrement,
  onDecrement,
  onEditMapping,
}: MenuItemCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={e => e.key === 'Enter' && onAdd()}
      className="bg-[var(--surface)] rounded-2xl border shadow-sm p-4 flex flex-col
        transition-all duration-150 cursor-pointer hover:border-[#27B18A]/50"
      style={{
        borderColor: qty > 0 ? '#9A3412' : 'var(--border)',
        boxShadow: qty > 0 ? '0 0 0 2px #9A341250' : undefined,
      }}
    >
      {/* Name & mode badge */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-bold text-[var(--text)] leading-snug">{recipe.name}</p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEditMapping(); }}
            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-4)]
              hover:text-[#27B18A] transition-colors"
            title="Atur bahan baku"
          >
            <Settings size={11} />
          </button>
          {recipe.mode === 'batch' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
              bg-[var(--surface)] text-[var(--text-2)]">
              batch
            </span>
          )}
        </div>
      </div>

      {/* Sell price */}
      <p
        className="text-xl font-bold text-[#27B18A] tabular-nums mt-1"
        style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
      >
        {formatRp(sellPrice)}
        {recipe.portionUnit && recipe.portionUnit !== 'porsi' && (
          <span className="text-[11px] font-normal text-[var(--text-3)] ml-1">
            /{recipe.portionUnit}
          </span>
        )}
      </p>
      <p className="text-[10px] text-[var(--text-4)] mb-3">
        HPP {formatRp(recipe.hpp)}
      </p>

      {/* Stock hint */}
      {!noStockData && !hasStock && (
        <div className="flex items-center gap-1 mb-2">
          <AlertTriangle size={11} className="text-[#27B18A]" />
          <span className="text-[10px] text-[#27B18A]">Stok menipis</span>
        </div>
      )}

      {/* Qty counter */}
      <div className="mt-auto flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={onDecrement}
          disabled={qty === 0}
          className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center
            text-[var(--text-2)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:cursor-not-allowed
            transition-colors"
        >
          <Minus size={15} />
        </motion.button>

        <span
          className="text-lg font-bold tabular-nums w-8 text-center"
          style={{
            fontFamily: 'var(--font-bricolage, system-ui)',
            color: qty > 0 ? 'var(--text)' : '#A7C4BC',
          }}
        >
          {qty}
        </span>

        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={onIncrement}
          className="w-11 h-11 rounded-xl bg-[#27B18A] flex items-center justify-center
            text-white hover:bg-[#0E927A] transition-colors"
        >
          <Plus size={15} />
        </motion.button>
      </div>
    </div>
  );
}
