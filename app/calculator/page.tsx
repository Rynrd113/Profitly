'use client';

import { useState } from 'react';
import { ChefHat } from 'lucide-react';
import { ModeSelectorCards, type CalcMode } from '@/components/ModeSelectorCards';
import { HPPCalculator } from '@/components/HPPCalculator';
import { TurunanCalculator } from '@/components/TurunanCalculator';
import { useDerivedIngredients } from '@/hooks/useDerivedIngredients';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';

export default function CalculatorPage() {
  const [activeMode, setActiveMode] = useState<CalcMode>('satuan');
  const { ingredients: derivedIngredients, save, remove } = useDerivedIngredients();
  const { ingredients: savedRawIngredients, save: saveRaw, remove: removeRaw } = useSavedRawIngredients();
  const { save: saveRecipe } = useSavedRecipes();

  return (
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E5E3DD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1A6B3C] flex items-center justify-center">
              <ChefHat size={15} color="white" />
            </div>
            <span
              className="font-bold text-[#1A1A18] text-lg tracking-tight"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              ProfitLy
            </span>
          </div>
          <span className="text-xs text-[#9CA3AF] bg-[#F8F7F2] border border-[#E5E3DD]
            px-3 py-1 rounded-full font-medium">
            Kalkulator HPP
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <ModeSelectorCards activeMode={activeMode} onChange={setActiveMode} />

        <div className={activeMode === 'turunan' ? 'hidden' : ''}>
          <HPPCalculator
            mode={activeMode === 'batch' ? 'batch' : 'satuan'}
            derivedIngredients={derivedIngredients}
            savedRawIngredients={savedRawIngredients}
            onSaveRawIngredients={saveRaw}
            onRemoveRawIngredient={removeRaw}
            onSaveRecipe={saveRecipe}
            recipeToLoad={null}
          />
        </div>
        <div className={activeMode !== 'turunan' ? 'hidden' : ''}>
          <TurunanCalculator
            derivedIngredients={derivedIngredients}
            onSave={save}
            onRemove={remove}
            savedRawIngredients={savedRawIngredients}
            onSaveRawIngredients={saveRaw}
            onRemoveRawIngredient={removeRaw}
          />
        </div>
      </main>
    </div>
  );
}
