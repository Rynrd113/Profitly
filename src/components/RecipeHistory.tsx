'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { SavedRecipe } from '@/types/hpp';
import { formatRp } from '@/lib/format';

interface RecipeHistoryProps {
  recipes: SavedRecipe[];
  onLoad: (recipe: SavedRecipe) => void;
  onRemove: (id: string) => void;
}

function formatDate(isoStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoStr));
}

export function RecipeHistory({ recipes, onLoad, onRemove }: RecipeHistoryProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (recipes.length === 0) return null;

  return (
    <div className="mt-6">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-3">
        Riwayat Resep
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recipes.map(recipe => (
          <div key={recipe.id} className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="font-medium text-[var(--text)] text-sm leading-snug">{recipe.name}</p>
              <span className="text-[11px] text-[var(--text-2)] shrink-0 whitespace-nowrap">
                {formatDate(recipe.savedAt)}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-2)] mb-0.5">
              {recipe.mode === 'satuan'
                ? `Satuan · HPP ${formatRp(recipe.hpp)}`
                : `Batch ${recipe.batchSize} cup · HPP ${formatRp(recipe.hpp)}/cup`
              }
            </p>
            <p className="text-[11px] text-[var(--text-2)] mb-3">
              {recipe.ingredients.length} bahan · {recipe.ops.length} biaya
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onLoad(recipe)}
                className="text-sm px-3 py-1.5 rounded-xl border border-[#27B18A] text-[#27B18A]
                  hover:bg-[var(--tint-amber)] transition-colors font-medium"
              >
                Muat
              </button>
              {confirmId === recipe.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--text-2)]">Hapus?</span>
                  <button
                    type="button"
                    onClick={() => { onRemove(recipe.id); setConfirmId(null); }}
                    className="text-[11px] font-semibold text-white bg-[#DC2626] px-2 py-1 rounded-lg"
                  >
                    Ya
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(recipe.id)}
                  className="text-[var(--text-4)] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
