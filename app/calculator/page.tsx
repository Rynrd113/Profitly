'use client';

import { useState, useEffect } from 'react';
import { Calculator, Layers } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import dynamic from 'next/dynamic';
import { ModeSelectorCards, type CalcMode } from '@/components/ModeSelectorCards';
import { HPPCalculator } from '@/components/HPPCalculator';

const TurunanCalculator = dynamic(
  () => import('@/components/TurunanCalculator').then(m => ({ default: m.TurunanCalculator })),
  { ssr: false },
);

const StockManagement = dynamic(
  () => import('@/components/StockManagement').then(m => ({ default: m.StockManagement })),
  { ssr: false },
);
import { useDerivedIngredients } from '@/hooks/useDerivedIngredients';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { RecipeHistory } from '@/components/RecipeHistory';
import type { SavedRecipe } from '@/types/hpp';

type ActiveMenu = 'kalkulator' | 'stok';

export default function CalculatorPage() {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('kalkulator');
  const [activeMode, setActiveMode] = useState<CalcMode>('satuan');

  const { ingredients: derivedIngredients, save, remove } = useDerivedIngredients();
  const {
    ingredients: savedRawIngredients,
    save: saveRawIngredients,
    remove: removeRawIngredient,
    setStockLevel,
    deductStock,
    receiveStock,
  } = useSavedRawIngredients();
  const { recipes: savedRecipes, save: saveRecipe, remove: removeRecipe, recomputeHPPForIngredient } = useSavedRecipes();
  const { transactions, add: addTransaction } = useStockTransactions();

  const [recipeToLoad, setRecipeToLoad] = useState<SavedRecipe | null>(null);

  useEffect(() => {
    if (recipeToLoad) setRecipeToLoad(null);
  }, [recipeToLoad]);

  const handleSaveRecipe = (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => {
    saveRecipe(data);
  };

  const handleRestock = (name: string, qtyIn: number, newPrice: number, newVolume: number): boolean => {
    const priceChanged = receiveStock(name, qtyIn, newPrice, newVolume);
    if (priceChanged) recomputeHPPForIngredient(name, newPrice, newVolume);
    return priceChanged;
  };

  const handleLoadRecipe = (recipe: SavedRecipe) => {
    setActiveMode(recipe.mode);
    setActiveMenu('kalkulator');
    setRecipeToLoad(recipe);
  };

  const navTabs: { id: ActiveMenu; label: string; icon: React.ReactNode }[] = [
    { id: 'kalkulator', label: 'Kalkulator HPP', icon: <Calculator size={14} /> },
    { id: 'stok', label: 'Manajemen Stok', icon: <Layers size={14} /> },
  ];

  return (
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Navbar active="calculator" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">

        {/* Tab selector */}
        <div className="flex items-center gap-1 mb-6">
          {navTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMenu(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium
                transition-colors border ${activeMenu === tab.id
                  ? 'bg-[#1A6B3C] text-white border-[#1A6B3C]'
                  : 'bg-white text-[#78716C] border-[#E5E3DD] hover:border-[#1A6B3C]/30 hover:text-[#1A6B3C]'
                }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeMenu === 'kalkulator' && (
          <>
            <ModeSelectorCards activeMode={activeMode} onChange={setActiveMode} />
            <div className={activeMode === 'turunan' ? 'hidden' : ''}>
              <HPPCalculator
                mode={activeMode === 'batch' ? 'batch' : 'satuan'}
                derivedIngredients={derivedIngredients}
                savedRawIngredients={savedRawIngredients}
                onSaveRawIngredients={saveRawIngredients}
                onRemoveRawIngredient={removeRawIngredient}
                onSaveRecipe={handleSaveRecipe}
                recipeToLoad={recipeToLoad}
              />
            </div>
            <div className={activeMode !== 'turunan' ? 'hidden' : ''}>
              <TurunanCalculator
                derivedIngredients={derivedIngredients}
                onSave={save}
                onRemove={remove}
                savedRawIngredients={savedRawIngredients}
                onSaveRawIngredients={saveRawIngredients}
                onRemoveRawIngredient={removeRawIngredient}
              />
            </div>
            <RecipeHistory
              recipes={savedRecipes}
              onLoad={handleLoadRecipe}
              onRemove={removeRecipe}
            />
          </>
        )}

        {activeMenu === 'stok' && (
          <StockManagement
            savedRawIngredients={savedRawIngredients}
            savedRecipes={savedRecipes}
            onSetStockLevel={setStockLevel}
            onDeductStock={deductStock}
            transactions={transactions}
            onAddTransaction={addTransaction}
            onRestock={handleRestock}
          />
        )}
      </main>
    </div>
  );
}
