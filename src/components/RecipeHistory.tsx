'use client';

import { Trash2 } from 'lucide-react';
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
  if (recipes.length === 0) return null;

  return (
    <div className="mt-6">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
        Riwayat Resep
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recipes.map(recipe => (
          <div key={recipe.id} className="bg-white rounded-2xl border border-[#E5E3DD] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="font-medium text-[#1A1A18] text-sm leading-snug">{recipe.name}</p>
              <span className="text-[11px] text-[#78716C] shrink-0 whitespace-nowrap">
                {formatDate(recipe.savedAt)}
              </span>
            </div>
            <p className="text-[11px] text-[#78716C] mb-0.5">
              {recipe.mode === 'satuan'
                ? `Satuan · HPP ${formatRp(recipe.hpp)}`
                : `Batch ${recipe.batchSize} cup · HPP ${formatRp(recipe.hpp)}/cup`
              }
            </p>
            <p className="text-[11px] text-[#78716C] mb-3">
              {recipe.ingredients.length} bahan · {recipe.ops.length} biaya
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onLoad(recipe)}
                className="text-sm px-3 py-1.5 rounded-xl border border-[#1A6B3C] text-[#1A6B3C]
                  hover:bg-[#ECFDF5] transition-colors font-medium"
              >
                Muat
              </button>
              <button
                type="button"
                onClick={() => onRemove(recipe.id)}
                className="text-[#C4BFBA] hover:text-red-400 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
