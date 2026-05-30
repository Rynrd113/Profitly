'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SavedRecipe } from '@/types/hpp';

export function IngredientMappingEditor({
  recipe,
  catalogNames,
  onSave,
}: {
  recipe: SavedRecipe;
  catalogNames: string[];
  onSave: (mappings: Array<{ inventoryId: string; quantity: number }>) => void;
}) {
  const [rows, setRows] = useState<Array<{ inventoryId: string; quantity: number }>>(
    recipe.inventoryIngredients?.map(x => ({ ...x })) ?? []
  );

  const addRow = () => setRows(r => [...r, { inventoryId: catalogNames[0] ?? '', quantity: 0 }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'inventoryId' | 'quantity', val: string) =>
    setRows(r => r.map((row, idx) => idx !== i ? row : {
      ...row,
      [field]: field === 'quantity' ? Math.max(0, Number(val)) : val,
    }));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-[var(--text-4)] italic">
          Belum ada bahan. Tambahkan agar stok berkurang otomatis saat transaksi.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.inventoryId}
            onChange={e => update(i, 'inventoryId', e.target.value)}
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A] text-[var(--text)]"
          >
            {catalogNames.length === 0
              ? <option value="">— Belum ada bahan —</option>
              : catalogNames.map(n => <option key={n} value={n}>{n}</option>)
            }
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={row.quantity || ''}
            onChange={e => update(i, 'quantity', e.target.value)}
            placeholder="Qty"
            className="w-20 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
              text-[var(--text)] text-right"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#DC2626]
              hover:bg-[var(--tint-red)] transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addRow}
          disabled={catalogNames.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            border border-[var(--border)] text-[var(--text-2)] hover:border-[#27B18A]/40
            hover:text-[#27B18A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} /> Tambah
        </button>
        <button
          type="button"
          onClick={() => onSave(rows.filter(r => r.inventoryId && r.quantity > 0))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            bg-[#27B18A] text-white hover:bg-[#0E927A] transition-colors"
        >
          Simpan
        </button>
      </div>
    </div>
  );
}
