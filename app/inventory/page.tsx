'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { formatRp } from '@/lib/format';
import { Plus, Trash2, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import type { SavedRecipe } from '@/types/hpp';

type IngMapping = { inventoryId: string; quantity: number };

function RecipeIngredientEditor({
  recipe,
  catalogNames,
  onSave,
}: {
  recipe: SavedRecipe;
  catalogNames: string[];
  onSave: (mappings: IngMapping[]) => void;
}) {
  const [rows, setRows] = useState<IngMapping[]>(
    recipe.inventoryIngredients?.map(x => ({ ...x })) ?? []
  );

  const addRow = () => setRows(r => [...r, { inventoryId: catalogNames[0] ?? '', quantity: 0 }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof IngMapping, val: string) =>
    setRows(r => r.map((row, idx) => idx !== i ? row : {
      ...row,
      [field]: field === 'quantity' ? Math.max(0, Number(val)) : val,
    }));

  const handleSave = () => {
    const valid = rows.filter(r => r.inventoryId && r.quantity > 0);
    onSave(valid);
    toast.success(`Mapping bahan "${recipe.name}" disimpan`);
  };

  return (
    <div className="mt-3 space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-[var(--text-4)] italic">Belum ada bahan terhubung. Tambahkan untuk sync stok otomatis.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.inventoryId}
            onChange={e => update(i, 'inventoryId', e.target.value)}
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
              text-[var(--text)]"
          >
            {catalogNames.length === 0
              ? <option value="">— Belum ada bahan di katalog —</option>
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
            className="w-24 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
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
          <Plus size={12} /> Tambah Bahan
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            bg-[#27B18A] text-white hover:bg-[#0E927A] transition-colors"
        >
          Simpan Mapping
        </button>
      </div>
    </div>
  );
}

export default function InventoryMappingPage() {
  const { recipes, patchRecipe } = useSavedRecipes();
  const { ingredients } = useSavedRawIngredients();
  const [expanded, setExpanded] = useState<string | null>(null);

  const catalogNames = ingredients.map(i => i.name);

  const toggle = (id: string) => setExpanded(v => v === id ? null : id);

  return (
    <AdminGuard>
      <div
        className="min-h-screen bg-[var(--bg)]"
        style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
      >
        <Navbar active="calculator" />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <div className="mb-6">
            <h1
              className="text-2xl font-bold text-[var(--text)]"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              Pemetaan Bahan Baku
            </h1>
            <p className="text-sm text-[var(--text-3)] mt-1">
              Hubungkan setiap menu ke bahan inventori agar stok berkurang otomatis saat transaksi di Kasir.
            </p>
          </div>

          {recipes.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-10 text-center shadow-sm">
              <FlaskConical size={32} className="mx-auto text-[var(--text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-2)]">Belum ada menu tersimpan</p>
              <p className="text-xs text-[var(--text-4)] mt-1">Simpan resep dari Kalkulator HPP terlebih dahulu.</p>
            </div>
          ) : (
            recipes.map(recipe => {
              const mappedCount = recipe.inventoryIngredients?.filter(x => x.quantity > 0).length ?? 0;
              const isOpen = expanded === recipe.id;
              return (
                <div
                  key={recipe.id}
                  className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(recipe.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)] truncate">{recipe.name}</p>
                      <p className="text-xs text-[var(--text-3)] mt-0.5">
                        HPP {formatRp(recipe.hpp)} ·{' '}
                        {mappedCount > 0
                          ? <span className="text-[#27B18A] font-medium">{mappedCount} bahan terhubung</span>
                          : <span className="text-[#F59E0B]">Belum ada mapping</span>
                        }
                      </p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-[var(--text-3)] shrink-0" /> : <ChevronDown size={16} className="text-[var(--text-3)] shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-[var(--border)]">
                      <RecipeIngredientEditor
                        recipe={recipe}
                        catalogNames={catalogNames}
                        onSave={mappings => patchRecipe(recipe.id, { inventoryIngredients: mappings })}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
