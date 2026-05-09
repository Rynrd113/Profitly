'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Package, Zap, SlidersHorizontal, ChevronDown, Trash2, BookmarkPlus, History } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { ResultsPanel } from '@/components/ResultsPanel';
import { IngredientNameInput } from '@/components/IngredientNameInput';
import { calculateTotalHPP, getPricingTiers, calculateBEP } from '@/lib/engine';
import { uid, parseNum, formatRp } from '@/lib/format';
import type { Ingredient, OperationalCost, DerivedIngredient, SavedRawIngredient, SavedRecipeIngredient, SavedRecipeOp, SavedRecipe } from '@/types/hpp';
import type { CalcMode } from '@/components/ModeSelectorCards';

interface IngredientRow {
  id: string; name: string;
  purchasePrice: string; purchaseVolume: string;
  unit: 'gr' | 'ml' | 'pcs'; usage: string;
  yieldFactor: string; isDerived?: boolean;
}

interface OperationalRow {
  id: string; name: string; price: string; usage: string;
}

const emptyIngredient = (): IngredientRow => ({
  id: uid(), name: '', purchasePrice: '', purchaseVolume: '',
  unit: 'gr', usage: '', yieldFactor: '0',
});

const emptyOp = (): OperationalRow => ({
  id: uid(), name: '', price: '', usage: '10',
});

export function HPPCalculator({
  mode,
  derivedIngredients,
  savedRawIngredients,
  onSaveRawIngredients,
  onRemoveRawIngredient,
  onSaveRecipe,
  recipeToLoad,
}: {
  mode: Exclude<CalcMode, 'turunan'>;
  derivedIngredients: DerivedIngredient[];
  savedRawIngredients: SavedRawIngredient[];
  onSaveRawIngredients: (items: SavedRawIngredient[]) => void;
  onRemoveRawIngredient: (name: string) => void;
  onSaveRecipe: (data: Omit<SavedRecipe, 'id' | 'savedAt'>) => void;
  recipeToLoad: SavedRecipe | null;
}) {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [ops, setOps] = useState<OperationalRow[]>([emptyOp()]);
  const [batchSize, setBatchSize] = useState('50');
  const [fixedCost, setFixedCost] = useState('5000000');
  const [showDerivedPicker, setShowDerivedPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!showDerivedPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDerivedPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDerivedPicker]);

  useEffect(() => {
    if (!recipeToLoad) return;
    setIngredients(recipeToLoad.ingredients);
    setOps(recipeToLoad.ops);
    setBatchSize(recipeToLoad.batchSize);
    setFixedCost(recipeToLoad.fixedCost);
  }, [recipeToLoad]);

  const updateIng = (id: string, field: keyof IngredientRow, val: string) =>
    setIngredients(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addIng = () => setIngredients(prev => [...prev, emptyIngredient()]);
  const removeIng = (id: string) => setIngredients(prev => prev.filter(r => r.id !== id));

  const addFromDerived = (di: DerivedIngredient) => {
    setIngredients(prev => [...prev, {
      id: uid(),
      name: di.name,
      purchasePrice: String(di.costPerUnit * 1000),
      purchaseVolume: '1000',
      unit: di.unit,
      usage: '',
      yieldFactor: '0',
      isDerived: true,
    }]);
    setShowDerivedPicker(false);
  };

  const handleSelectSaved = (id: string, item: SavedRawIngredient) => {
    setIngredients(prev => prev.map(r => r.id === id ? {
      ...r,
      name: item.name,
      purchasePrice: String(item.purchasePrice),
      purchaseVolume: String(item.purchaseVolume),
      unit: item.unit,
    } : r));
  };

  const handleSaveToKatalog = () => {
    const items: SavedRawIngredient[] = ingredients
      .filter(r => r.name.trim() && parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0)
      .map(r => ({
        name: r.name.trim(),
        purchasePrice: parseNum(r.purchasePrice),
        purchaseVolume: parseNum(r.purchaseVolume),
        unit: r.unit,
      }));
    if (items.length > 0) onSaveRawIngredients(items);
  };

  const handleClickSave = () => {
    const defaultName = ingredients.find(r => r.name.trim())?.name ?? 'Resep baru';
    setSavedName(defaultName);
    setShowSaveForm(true);
  };

  const handleConfirmSave = () => {
    if (!result) return;
    onSaveRecipe({
      name: savedName.trim() || 'Resep baru',
      mode,
      ingredients: ingredients as SavedRecipeIngredient[],
      ops: ops as SavedRecipeOp[],
      batchSize,
      fixedCost,
      hpp: result.hpp,
    });
    setShowSaveForm(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  const updateOp = (id: string, field: keyof OperationalRow, val: string) =>
    setOps(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addOp = () => setOps(prev => [...prev, emptyOp()]);
  const removeOp = (id: string) => setOps(prev => prev.filter(r => r.id !== id));

  const result = useMemo(() => {
    try {
      const ingList = ingredients
        .filter(r => parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0 && parseNum(r.usage) > 0)
        .map(r => ({
          ingredient: {
            id: r.id, name: r.name,
            purchasePrice: parseNum(r.purchasePrice),
            purchaseVolume: parseNum(r.purchaseVolume),
            unit: r.unit, usage: parseNum(r.usage),
          } satisfies Ingredient,
          yieldFactor: Math.max(0.01, 1 - Math.min(0.99, parseNum(r.yieldFactor) / 100)),
        }));

      const opList: OperationalCost[] = ops
        .filter(r => parseNum(r.price) > 0)
        .map(r => ({
          id: r.id, name: r.name,
          price: parseNum(r.price),
          usage: Math.min(1, parseNum(r.usage) / 100),
        }));

      const output = mode === 'satuan' ? 1 : Math.max(1, parseNum(batchSize));
      if (ingList.length === 0 && opList.length === 0) return null;

      const hpp = calculateTotalHPP(ingList, opList, output);
      if (hpp <= 0) return null;

      const tiers = getPricingTiers(hpp);
      const fc = parseNum(fixedCost);
      const bep = fc > 0 ? calculateBEP(fc, tiers[1].sellPrice, hpp) : null;
      const batch = mode === 'batch' ? Math.max(1, parseNum(batchSize)) : null;

      return { hpp, tiers, bep, batch };
    } catch {
      return null;
    }
  }, [ingredients, ops, batchSize, fixedCost, mode]);

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
      <div className="space-y-5">

        {/* Bahan Baku */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<Package size={15} />} label="Bahan Baku" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
            {['Nama Bahan', 'Harga Beli', 'Volume', 'Satuan', 'Pakai', 'Susut %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {ingredients.map(row => (
              <div key={row.id}>
                {/* Mobile card */}
                <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5">
                      <IngredientNameInput
                        value={row.name}
                        onChange={v => updateIng(row.id, 'name', v)}
                        onSelect={item => handleSelectSaved(row.id, item)}
                        suggestions={savedRawIngredients}
                        placeholder="Nama bahan"
                        className="flex-1"
                      />
                      {row.isDerived && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                          bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                      )}
                    </div>
                    <DeleteBtn onClick={() => removeIng(row.id)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Harga Beli</p>
                      <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)}
                        placeholder="14000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Volume</p>
                      <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)}
                        placeholder="1000" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Satuan</p>
                      <select value={row.unit}
                        onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                        className="w-full bg-white border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Pemakaian</p>
                      <NumInput value={row.usage} onChange={v => updateIng(row.id, 'usage', v)} placeholder="200" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Susut</p>
                      <NumInput value={row.yieldFactor} onChange={v => updateIng(row.id, 'yieldFactor', v)}
                        placeholder="0" suffix="%" />
                    </div>
                  </div>
                </div>
                {/* Desktop row */}
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
                  <div className="flex items-center gap-1.5">
                    <IngredientNameInput
                      value={row.name}
                      onChange={v => updateIng(row.id, 'name', v)}
                      onSelect={item => handleSelectSaved(row.id, item)}
                      suggestions={savedRawIngredients}
                      placeholder="Nama bahan"
                      className="flex-1"
                    />
                    {row.isDerived && (
                      <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                        bg-[#ECFDF5] text-[#1A6B3C] border border-[#A7F3D0]">Turunan</span>
                    )}
                  </div>
                  <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)}
                    placeholder="14000" prefix="Rp" />
                  <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)}
                    placeholder="1000" />
                  <select value={row.unit}
                    onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                    className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]">
                    <option value="gr">gr</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                  <NumInput value={row.usage} onChange={v => updateIng(row.id, 'usage', v)} placeholder="200" />
                  <NumInput value={row.yieldFactor} onChange={v => updateIng(row.id, 'yieldFactor', v)}
                    placeholder="0" suffix="%" />
                  <DeleteBtn onClick={() => removeIng(row.id)} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <AddRowBtn onClick={addIng} label="Tambah Bahan" />
            {derivedIngredients.length > 0 && (
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setShowDerivedPicker(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                    hover:text-[#1A1A18] transition-colors"
                >
                  <ChevronDown size={14} />
                  Dari Bahan Turunan
                </button>
                {showDerivedPicker && (
                  <div className="absolute left-0 top-7 z-10 bg-white border border-[#E5E3DD]
                    rounded-xl shadow-lg py-1 min-w-[200px]">
                    {derivedIngredients.map(di => (
                      <button
                        key={di.id}
                        type="button"
                        onClick={() => addFromDerived(di)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#F8F7F2] transition-colors"
                      >
                        <span className="font-medium text-[#1A1A18]">{di.name}</span>
                        <span className="ml-2 text-[11px] text-[#78716C]">
                          Rp {di.costPerUnit.toLocaleString('id-ID')}/{di.unit}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleSaveToKatalog}
              className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                hover:text-[#1A6B3C] transition-colors"
            >
              <BookmarkPlus size={14} />
              Simpan ke Katalog
            </button>
          </div>
        </section>

        {/* Biaya Operasional */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<Zap size={15} />} label="Biaya Operasional" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}>
            {['Nama Biaya', 'Biaya Bulanan', 'Porsi %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {ops.map(row => (
              <div key={row.id}>
                <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)}
                      placeholder="Listrik, sewa, dsb." className="flex-1" />
                    <DeleteBtn onClick={() => removeOp(row.id)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Biaya Bulanan</p>
                      <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)}
                        placeholder="500000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[#C4BFBA] mb-1">Porsi dibebankan</p>
                      <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)}
                        placeholder="10" suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}>
                  <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)}
                    placeholder="Listrik, sewa, dsb." />
                  <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)}
                    placeholder="500000" prefix="Rp" />
                  <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)}
                    placeholder="10" suffix="%" />
                  <DeleteBtn onClick={() => removeOp(row.id)} />
                </div>
              </div>
            ))}
          </div>
          <AddRowBtn onClick={addOp} label="Tambah Biaya" />
        </section>

        {/* Parameter */}
        <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <SectionHeader icon={<SlidersHorizontal size={15} />} label="Parameter Produksi" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mode === 'batch' && (
              <div>
                <label className="block text-sm font-medium text-[#1A1A18] mb-1.5">Jumlah Produksi</label>
                <div className="relative flex items-center">
                  <input type="number" min="1" value={batchSize}
                    onChange={e => setBatchSize(e.target.value)}
                    className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl
                      px-3 pr-14 py-2.5 text-sm text-right focus:outline-none
                      focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] transition-colors" />
                  <span className="absolute right-3 text-xs text-[#C4BFBA] select-none">cup</span>
                </div>
                <p className="text-[11px] text-[#C4BFBA] mt-1.5">Berapa cup dalam satu sesi produksi</p>
              </div>
            )}
            <div className={mode === 'satuan' ? 'sm:col-span-1' : ''}>
              <label className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                Biaya Tetap Bulanan
                <span className="ml-1.5 text-[11px] font-normal text-[#9CA3AF]">untuk BEP</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs text-[#C4BFBA] select-none">Rp</span>
                <input type="number" min="0" value={fixedCost}
                  onChange={e => setFixedCost(e.target.value)}
                  className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl
                    pl-8 pr-3 py-2.5 text-sm text-right focus:outline-none
                    focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] transition-colors" />
              </div>
              <p className="text-[11px] text-[#C4BFBA] mt-1.5">Total sewa, gaji, dan biaya tetap lainnya</p>
            </div>
          </div>
        </section>

        {result !== null && (
          <div className="flex items-center gap-3">
            {!showSaveForm && !saveSuccess && (
              <button
                type="button"
                onClick={handleClickSave}
                className="flex items-center gap-1.5 text-sm font-medium text-[#78716C]
                  hover:text-[#1A6B3C] transition-colors"
              >
                <History size={14} />
                Simpan ke Riwayat
              </button>
            )}
            {saveSuccess && (
              <span className="text-sm font-medium text-[#1A6B3C]">✓ Tersimpan</span>
            )}
            {showSaveForm && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={savedName}
                  onChange={e => setSavedName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmSave();
                    if (e.key === 'Escape') setShowSaveForm(false);
                  }}
                  placeholder="Nama resep..."
                  autoFocus
                  className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-1.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] w-48"
                />
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="px-3 py-1.5 bg-[#1A6B3C] text-white text-sm font-medium
                    rounded-xl hover:bg-[#15593A] transition-colors"
                >
                  Simpan
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 lg:mt-0 space-y-4">
        <ResultsPanel result={result} />
        {savedRawIngredients.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
              Katalog Bahan
            </span>
            <div className="space-y-1">
              {savedRawIngredients.map(item => (
                <div key={item.name} className="flex items-center justify-between py-1.5
                  border-b border-[#F0EDE8] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A18]">{item.name}</p>
                    <p className="text-[11px] text-[#78716C]">
                      {formatRp(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemoveRawIngredient(item.name)}
                    className="text-[#C4BFBA] hover:text-red-400 transition-colors ml-2 shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
