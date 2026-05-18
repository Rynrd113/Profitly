'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Package, Zap, SlidersHorizontal, ChevronDown, Trash2, BookmarkPlus, History, Loader2, X } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { ResultsPanel } from '@/components/ResultsPanel';
import { BEPChart } from '@/components/BEPChart';
import { ProfitScenariosPanel } from '@/components/ProfitScenariosPanel';
import { IngredientNameInput } from '@/components/IngredientNameInput';
import { calculateTotalHPP, getPricingTiers, calculateBEP } from '@/lib/engine';
import { uid, parseNum, formatRp } from '@/lib/format';
import { usePriceStore } from '@/store/priceStore';
import { toast } from 'sonner';
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
  const [targetUnits, setTargetUnits] = useState('100');
  const { targetPrice } = usePriceStore();
  const [showDerivedPicker, setShowDerivedPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRemoveIng, setConfirmRemoveIng] = useState<string | null>(null);

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
    if (!result || isSaving) return;
    const invalid = ingredients.filter(r =>
      r.name.trim() && (parseNum(r.purchasePrice) <= 0 || parseNum(r.purchaseVolume) <= 0)
    );
    if (invalid.length > 0) {
      toast.error('Harga beli dan volume bahan harus lebih dari 0');
      return;
    }
    setIsSaving(true);
    setShowSaveForm(false);
    onSaveRecipe({
      name: savedName.trim() || 'Resep baru',
      mode,
      ingredients: ingredients as SavedRecipeIngredient[],
      ops: ops as SavedRecipeOp[],
      batchSize,
      fixedCost,
      hpp: result.hpp,
    });
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      toast.success(`Resep "${savedName.trim() || 'Resep baru'}" berhasil disimpan`);
      setTimeout(() => setSaveSuccess(false), 1500);
      setIngredients([emptyIngredient()]);
      setOps([emptyOp()]);
      setBatchSize('50');
      setFixedCost('5000000');
      setTargetUnits('100');
    }, 400);
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
      const targetVol = Math.max(1, parseNum(targetUnits));
      if (ingList.length === 0 && opList.length === 0) return null;

      const hpp = calculateTotalHPP(ingList, opList, output, targetVol);
      if (hpp <= 0) return null;

      const tiers = getPricingTiers(hpp);
      const fc = parseNum(fixedCost);
      const bep = fc > 0 ? calculateBEP(fc, tiers[1].sellPrice, hpp) : null;
      const batch = mode === 'batch' ? Math.max(1, parseNum(batchSize)) : null;

      return { hpp, tiers, bep, batch };
    } catch {
      return null;
    }
  }, [ingredients, ops, batchSize, fixedCost, mode, targetUnits]);

  const effectiveSellPrice = targetPrice ?? result?.tiers[1]?.sellPrice ?? 0;

  const effectiveBep = useMemo(() => {
    if (!result || effectiveSellPrice <= 0 || parseNum(fixedCost) <= 0) return null;
    try { return calculateBEP(parseNum(fixedCost), effectiveSellPrice, result.hpp); }
    catch { return null; }
  }, [result, effectiveSellPrice, fixedCost]);

  return (
    <div className="space-y-6">
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
      <div className="space-y-5">

        {/* Bahan Baku */}
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <SectionHeader icon={<Package size={15} />} label="Bahan Baku" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
            {['Nama Bahan', 'Harga Beli', 'Volume', 'Satuan', 'Pakai', 'Susut %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {ingredients.map(row => (
              <div key={row.id}>
                {/* Mobile card */}
                <div className="md:hidden bg-[var(--bg)] rounded-xl p-3 space-y-2">
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
                          bg-[var(--tint-amber)] text-[#27B18A] border border-[#065F46]">Turunan</span>
                      )}
                    </div>
                    <DeleteBtn onClick={() => removeIng(row.id)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Harga Beli</p>
                      <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)}
                        placeholder="14000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Volume</p>
                      <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)}
                        placeholder="1000" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Satuan</p>
                      <select value={row.unit}
                        onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2 py-2 text-sm
                          focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]">
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Pemakaian</p>
                      <NumInput value={row.usage} onChange={v => updateIng(row.id, 'usage', v)} placeholder="200" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Susut</p>
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
                        bg-[var(--tint-amber)] text-[#27B18A] border border-[#065F46]">Turunan</span>
                    )}
                  </div>
                  <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)}
                    placeholder="14000" prefix="Rp" />
                  <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)}
                    placeholder="1000" />
                  <select value={row.unit}
                    onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                    className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]">
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
                  className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)]
                    hover:text-[var(--text)] transition-colors"
                >
                  <ChevronDown size={14} />
                  Dari Bahan Turunan
                </button>
                {showDerivedPicker && (
                  <div className="absolute left-0 top-7 z-10 bg-[var(--surface)] border border-[var(--border)]
                    rounded-xl shadow-lg py-1 min-w-[200px]">
                    {derivedIngredients.map(di => (
                      <button
                        key={di.id}
                        type="button"
                        onClick={() => addFromDerived(di)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg)] transition-colors"
                      >
                        <span className="font-medium text-[var(--text)]">{di.name}</span>
                        <span className="ml-2 text-[11px] text-[var(--text-2)]">
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
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)]
                hover:text-[#27B18A] transition-colors"
            >
              <BookmarkPlus size={14} />
              Simpan ke Katalog
            </button>
          </div>
        </section>

        {/* Biaya Operasional */}
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <SectionHeader icon={<Zap size={15} />} label="Biaya Operasional" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}>
            {['Nama Biaya', 'Biaya Bulanan', 'Porsi %', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {ops.map(row => (
              <div key={row.id}>
                <div className="md:hidden bg-[var(--bg)] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)}
                      placeholder="Nama Biaya" className="flex-1" />
                    <DeleteBtn onClick={() => removeOp(row.id)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Biaya Bulanan</p>
                      <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)}
                        placeholder="500000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Porsi dibebankan</p>
                      <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)}
                        placeholder="10" suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}>
                  <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)}
                    placeholder="Nama Biaya" />
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
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <SectionHeader icon={<SlidersHorizontal size={15} />} label="Parameter Produksi" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mode === 'batch' && (
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Jumlah Produksi</label>
                <div className="relative flex items-center">
                  <input type="number" min="1" value={batchSize}
                    onChange={e => {
                      const n = parseFloat(e.target.value);
                      setBatchSize(e.target.value === '' ? '' : isNaN(n) || n < 1 ? '1' : e.target.value);
                    }}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl
                      px-3 pr-14 py-2.5 text-sm text-right focus:outline-none
                      focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A] transition-colors" />
                  <span className="absolute right-3 text-xs text-[var(--text-4)] select-none">cup</span>
                </div>
                <p className="text-[11px] text-[var(--text-4)] mt-1.5">Berapa cup dalam satu sesi produksi</p>
              </div>
            )}
            <div className={mode === 'satuan' ? 'sm:col-span-1' : ''}>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                Biaya Tetap Bulanan
                <span className="ml-1.5 text-[11px] font-normal text-[var(--text-3)]">untuk BEP</span>
              </label>
              <NumInput value={fixedCost} onChange={setFixedCost} placeholder="5000000" prefix="Rp" />
              <p className="text-[11px] text-[var(--text-4)] mt-1.5">Total sewa, gaji, dan biaya tetap lainnya</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                Target Penjualan
                <span className="ml-1.5 text-[11px] font-normal text-[var(--text-3)]">untuk skenario</span>
              </label>
              <div className="relative flex items-center">
                <input type="number" min="1" value={targetUnits}
                  onChange={e => {
                    const n = parseFloat(e.target.value);
                    setTargetUnits(e.target.value === '' ? '' : isNaN(n) || n < 1 ? '1' : e.target.value);
                  }}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl
                    px-3 pr-14 py-2.5 text-sm text-right focus:outline-none
                    focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A] transition-colors" />
                <span className="absolute right-3 text-xs text-[var(--text-4)] select-none">porsi</span>
              </div>
              <p className="text-[11px] text-[var(--text-4)] mt-1.5">Rencana penjualan per bulan</p>
            </div>
          </div>
        </section>

        {result !== null && (
          <div className="flex items-center gap-3">
            {!showSaveForm && !saveSuccess && (
              <button
                type="button"
                onClick={handleClickSave}
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)]
                  hover:text-[#27B18A] transition-colors"
              >
                <History size={14} />
                Simpan ke Riwayat
              </button>
            )}
            {saveSuccess && (
              <span className="text-sm font-medium text-[#27B18A]">✓ Tersimpan</span>
            )}
            {showSaveForm && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={savedName}
                  onChange={e => setSavedName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmSave();
                    if (e.key === 'Escape') setShowSaveForm(false);
                  }}
                  placeholder="Nama Resep"
                  autoFocus
                  className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                    min-w-0 flex-1 sm:flex-none sm:w-48"
                />
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#27B18A] text-white
                    text-sm font-medium rounded-xl hover:bg-[#0E927A] transition-colors
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                  Simpan
                </button>
              </div>
            )}
            {isSaving && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-[#27B18A]">
                <Loader2 size={13} className="animate-spin" /> Menyimpan…
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 lg:mt-0 space-y-4">
        <ResultsPanel result={result} fixedCost={parseNum(fixedCost)} targetUnits={parseNum(targetUnits)} />
        {savedRawIngredients.length > 0 && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-3">
              Katalog Bahan
            </span>
            <div className="space-y-1">
              {savedRawIngredients.map(item => (
                <div key={item.name} className="flex items-center justify-between py-1.5
                  border-b border-[var(--border-subtle)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{item.name}</p>
                    <p className="text-[11px] text-[var(--text-2)]">
                      {formatRp(item.purchasePrice)} · {item.purchaseVolume.toLocaleString('id-ID')} {item.unit}
                    </p>
                  </div>
                  {confirmRemoveIng === item.name ? (
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <span className="text-[10px] text-[var(--text-2)]">Hapus?</span>
                      <button
                        type="button"
                        onClick={() => { onRemoveRawIngredient(item.name); setConfirmRemoveIng(null); }}
                        className="text-[10px] font-semibold text-white bg-[#DC2626] px-2 py-0.5 rounded-lg"
                      >
                        Ya
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveIng(null)}
                        className="text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemoveIng(item.name)}
                      className="text-[var(--text-4)] hover:text-red-400 transition-colors ml-2 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    {result && effectiveBep && (
      <BEPChart
        hpp={result.hpp}
        tiers={result.tiers}
        bep={effectiveBep}
        fixedCost={parseNum(fixedCost)}
        selectedSellPrice={effectiveSellPrice}
      />
    )}

    {result && effectiveBep && (
      <ProfitScenariosPanel
        hpp={result.hpp}
        tiers={result.tiers}
        bep={effectiveBep}
        fixedCost={parseNum(fixedCost)}
        targetUnits={parseNum(targetUnits)}
        selectedSellPrice={effectiveSellPrice}
      />
    )}
    </div>
  );
}
