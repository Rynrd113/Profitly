'use client';

import { useState, useEffect } from 'react';
import { Calculator, Layers } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import dynamic from 'next/dynamic';
import { ModeSelectorCards, type CalcMode } from '@/components/ModeSelectorCards';
import { BusinessTypeSelectorCards } from '@/components/BusinessTypeSelectorCards';
import { HPPCalculator } from '@/components/HPPCalculator';
import { useSettingsStore } from '@/store/settingsStore';
import type { BusinessType } from '@/types/business';

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

  const { profile, setProfile } = useSettingsStore();
  const [businessType, setBusinessType] = useState<BusinessType>(profile.businessType ?? 'FNB');

  // Sync if store hydrates after mount (e.g. SSR mismatch)
  useEffect(() => {
    setBusinessType(profile.businessType ?? 'FNB');
  }, [profile.businessType]);

  const handleBusinessTypeChange = (type: BusinessType) => {
    setBusinessType(type);
    setProfile({ businessType: type });
  };

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
    <AdminGuard>
    <div
      className="min-h-screen bg-[var(--bg)]"
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
                  ? 'bg-[#27B18A] text-white border-[#27B18A]'
                  : 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:border-[#27B18A]/30 hover:text-[#27B18A]'
                }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeMenu === 'kalkulator' && (
          <>
            {/* Business type selector — persists to settings store live */}
            <BusinessTypeSelectorCards value={businessType} onChange={handleBusinessTypeChange} />
            <ModeSelectorCards activeMode={activeMode} onChange={setActiveMode} />
            <div className={activeMode === 'turunan' ? 'hidden' : ''}>
              <HPPCalculator
                mode={activeMode === 'batch' ? 'batch' : 'satuan'}
                businessType={businessType}
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
    </AdminGuard>
  );
}
