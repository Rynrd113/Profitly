'use client';

import { useState, useMemo } from 'react';
import { Package, Zap, FlaskConical, Save, Trash2, BookmarkPlus } from 'lucide-react';
import {
  TextInput, NumInput, DeleteBtn, AddRowBtn, SectionHeader,
} from '@/components/CalculatorShared';
import { IngredientNameInput } from '@/components/IngredientNameInput';
import { calculateDerivedHPP } from '@/lib/engine';
import { uid, parseNum, formatRp } from '@/lib/format';
import type { Ingredient, IngredientUnit, ProcessingCost, DerivedIngredient, SavedRawIngredient } from '@/types/hpp';

interface TurunanIngredientRow {
  id: string; name: string;
  purchasePrice: string; purchaseVolume: string;
  unit: IngredientUnit; usage: string; yieldFactor: string;
}

interface ProcessingCostRow {
  id: string; name: string; price: string;
}

interface OutputProductRow {
  id: string; name: string; qty: string;
  unit: IngredientUnit; sellPrice: string;
}

const emptyIngredient = (): TurunanIngredientRow => ({
  id: uid(), name: '', purchasePrice: '', purchaseVolume: '',
  unit: 'gr', usage: '', yieldFactor: '0',
});

const emptyProcessing = (): ProcessingCostRow => ({
  id: uid(), name: '', price: '',
});

const emptyOutput = (): OutputProductRow => ({
  id: uid(), name: '', qty: '', unit: 'gr', sellPrice: '',
});

export function TurunanCalculator({
  derivedIngredients,
  onSave,
  onRemove,
  savedRawIngredients,
  onSaveRawIngredients,
  onRemoveRawIngredient,
}: {
  derivedIngredients: DerivedIngredient[];
  onSave: (items: DerivedIngredient[]) => void;
  onRemove: (id: string) => void;
  savedRawIngredients: SavedRawIngredient[];
  onSaveRawIngredients: (items: SavedRawIngredient[]) => void;
  onRemoveRawIngredient: (name: string) => void;
}) {
  const [processName, setProcessName] = useState('');
  const [inputs, setInputs] = useState<TurunanIngredientRow[]>([emptyIngredient()]);
  const [processingCosts, setProcessingCosts] = useState<ProcessingCostRow[]>([emptyProcessing()]);
  const [outputs, setOutputs] = useState<OutputProductRow[]>([emptyOutput()]);

  const updateInput = (id: string, field: keyof TurunanIngredientRow, val: string) =>
    setInputs(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const updateProcessing = (id: string, field: keyof ProcessingCostRow, val: string) =>
    setProcessingCosts(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const updateOutput = (id: string, field: keyof OutputProductRow, val: string) =>
    setOutputs(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const derivedResults = useMemo(() => {
    try {
      const ingList = inputs
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

      const procList: ProcessingCost[] = processingCosts
        .filter(r => parseNum(r.price) > 0)
        .map(r => ({ id: r.id, name: r.name, price: parseNum(r.price) }));

      const outputList = outputs
        .filter(r => parseNum(r.qty) > 0 && r.name.trim())
        .map(r => ({
          id: r.id, name: r.name,
          qty: parseNum(r.qty), unit: r.unit,
          sellPrice: parseNum(r.sellPrice),
        }));

      if (ingList.length === 0 && procList.length === 0) return [];
      if (outputList.length === 0) return [];

      return calculateDerivedHPP({ ingredients: ingList, processingCosts: procList, outputs: outputList });
    } catch {
      return [];
    }
  }, [inputs, processingCosts, outputs]);

  const totalCost = useMemo(() => {
    const ingCost = inputs
      .filter(r => parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0 && parseNum(r.usage) > 0)
      .reduce((sum, r) => {
        const ppu = parseNum(r.purchasePrice) / parseNum(r.purchaseVolume);
        const yf = Math.max(0.01, 1 - Math.min(0.99, parseNum(r.yieldFactor) / 100));
        return sum + (ppu * parseNum(r.usage)) / yf;
      }, 0);
    const procCost = processingCosts.reduce((sum, r) => sum + parseNum(r.price), 0);
    return ingCost + procCost;
  }, [inputs, processingCosts]);

  const handleSaveAll = () => {
    if (derivedResults.length === 0) return;
    const items: DerivedIngredient[] = derivedResults.map(r => ({
      id: r.id, name: r.name, unit: r.unit, costPerUnit: r.hpp,
    }));
    onSave(items);
  };

  const handleSelectSaved = (id: string, item: SavedRawIngredient) => {
    setInputs(prev => prev.map(r => r.id === id ? {
      ...r,
      name: item.name,
      purchasePrice: String(item.purchasePrice),
      purchaseVolume: String(item.purchaseVolume),
      unit: item.unit,
    } : r));
  };

  const handleSaveToKatalog = () => {
    const items: SavedRawIngredient[] = inputs
      .filter(r => r.name.trim() && parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0)
      .map(r => ({
        name: r.name.trim(),
        purchasePrice: parseNum(r.purchasePrice),
        purchaseVolume: parseNum(r.purchaseVolume),
        unit: r.unit,
      }));
    if (items.length > 0) onSaveRawIngredients(items);
  };

  return (
    <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">
      <div className="space-y-5">

        {/* Nama proses */}
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <SectionHeader icon={<FlaskConical size={15} />} label="Nama Proses" />
          <TextInput
            value={processName}
            onChange={setProcessName}
            placeholder="Nama Proses / Item"
            className="w-full"
          />
          <p className="text-[11px] text-[var(--text-4)] mt-1.5">Nama proses pengolahan bahan baku</p>
        </section>

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
            {inputs.map(row => (
              <div key={row.id}>
                <div className="md:hidden bg-[var(--bg)] rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <IngredientNameInput
                      value={row.name}
                      onChange={v => updateInput(row.id, 'name', v)}
                      onSelect={item => handleSelectSaved(row.id, item)}
                      suggestions={savedRawIngredients}
                      placeholder="Nama bahan"
                      className="flex-1"
                    />
                    <DeleteBtn onClick={() => setInputs(prev => prev.filter(r => r.id !== row.id))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Harga Beli</p>
                      <NumInput value={row.purchasePrice} onChange={v => updateInput(row.id, 'purchasePrice', v)}
                        placeholder="14000" prefix="Rp" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Volume</p>
                      <NumInput value={row.purchaseVolume} onChange={v => updateInput(row.id, 'purchaseVolume', v)}
                        placeholder="1000" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Satuan</p>
                      <select value={row.unit}
                        onChange={e => updateInput(row.id, 'unit', e.target.value as TurunanIngredientRow['unit'])}
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
                      <NumInput value={row.usage} onChange={v => updateInput(row.id, 'usage', v)} placeholder="200" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-4)] mb-1">Susut</p>
                      <NumInput value={row.yieldFactor} onChange={v => updateInput(row.id, 'yieldFactor', v)}
                        placeholder="0" suffix="%" />
                    </div>
                  </div>
                </div>
                <div className="hidden md:grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}>
                  <IngredientNameInput
                    value={row.name}
                    onChange={v => updateInput(row.id, 'name', v)}
                    onSelect={item => handleSelectSaved(row.id, item)}
                    suggestions={savedRawIngredients}
                    placeholder="Nama bahan"
                  />
                  <NumInput value={row.purchasePrice} onChange={v => updateInput(row.id, 'purchasePrice', v)}
                    placeholder="14000" prefix="Rp" />
                  <NumInput value={row.purchaseVolume} onChange={v => updateInput(row.id, 'purchaseVolume', v)}
                    placeholder="1000" />
                  <select value={row.unit}
                    onChange={e => updateInput(row.id, 'unit', e.target.value as TurunanIngredientRow['unit'])}
                    className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]">
                    <option value="gr">gr</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                  </select>
                  <NumInput value={row.usage} onChange={v => updateInput(row.id, 'usage', v)} placeholder="200" />
                  <NumInput value={row.yieldFactor} onChange={v => updateInput(row.id, 'yieldFactor', v)}
                    placeholder="0" suffix="%" />
                  <DeleteBtn onClick={() => setInputs(prev => prev.filter(r => r.id !== row.id))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <AddRowBtn onClick={() => setInputs(prev => [...prev, emptyIngredient()])} label="Tambah Bahan" />
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

        {/* Biaya Pengolahan */}
        <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <SectionHeader icon={<Zap size={15} />} label="Biaya Pengolahan" />
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 148px 36px' }}>
            {['Nama Biaya', 'Harga', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {processingCosts.map(row => (
              <div key={row.id} className="flex gap-2 items-center">
                <TextInput value={row.name} onChange={v => updateProcessing(row.id, 'name', v)}
                  placeholder="Nama Biaya" className="flex-1" />
                <NumInput value={row.price} onChange={v => updateProcessing(row.id, 'price', v)}
                  placeholder="5000" prefix="Rp" className="w-36" />
                <DeleteBtn onClick={() => setProcessingCosts(prev => prev.filter(r => r.id !== row.id))} />
              </div>
            ))}
          </div>
          <AddRowBtn onClick={() => setProcessingCosts(prev => [...prev, emptyProcessing()])} label="Tambah Biaya" />
        </section>

        {/* Produk Turunan (outputs) */}
        <section className="bg-[var(--surface)] rounded-2xl border-2 border-[#27B18A]/30 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#27B18A]"><FlaskConical size={15} /></span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text)]">Produk yang Dihasilkan</h2>
            </div>
            {totalCost > 0 && (
              <span className="text-[11px] text-[var(--text-2)]">
                Total biaya: <strong className="text-[var(--text)]">{formatRp(totalCost)}</strong>
              </span>
            )}
          </div>
          <div className="hidden md:grid gap-2 mb-2 px-1"
            style={{ gridTemplateColumns: '1fr 80px 72px 104px 1fr 36px' }}>
            {['Nama Produk', 'Jumlah', 'Satuan', 'Harga Jual/Sat', 'HPP/Satuan', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider">{h}</span>
            ))}
          </div>
          <div className="space-y-2.5">
            {outputs.map((row, i) => {
              const res = derivedResults.find(r => r.id === row.id);
              return (
                <div key={row.id}>
                  <div className="md:hidden bg-[var(--bg)] rounded-xl p-3 space-y-2">
                    <div className="flex gap-2">
                      <TextInput value={row.name} onChange={v => updateOutput(row.id, 'name', v)}
                        placeholder="Nama produk" className="flex-1" />
                      <DeleteBtn onClick={() => setOutputs(prev => prev.filter(r => r.id !== row.id))} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-[var(--text-4)] mb-1">Jumlah</p>
                        <NumInput value={row.qty} onChange={v => updateOutput(row.id, 'qty', v)} placeholder="250" />
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-4)] mb-1">Satuan</p>
                        <select value={row.unit}
                          onChange={e => updateOutput(row.id, 'unit', e.target.value as OutputProductRow['unit'])}
                          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2 py-2 text-sm
                            focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]">
                          <option value="gr">gr</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-4)] mb-1">Harga Jual</p>
                        <NumInput value={row.sellPrice} onChange={v => updateOutput(row.id, 'sellPrice', v)}
                          placeholder="80" prefix="Rp" />
                      </div>
                    </div>
                    {res && (
                      <div className="flex items-center justify-between bg-[var(--tint-amber)] rounded-lg px-3 py-2">
                        <span className="text-[10px] text-[#27B18A]">HPP per {row.unit}</span>
                        <span className="text-sm font-bold text-[#27B18A]">{formatRp(res.hpp)}</span>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:grid gap-2 items-center"
                    style={{ gridTemplateColumns: '1fr 80px 72px 104px 1fr 36px' }}>
                    <TextInput value={row.name} onChange={v => updateOutput(row.id, 'name', v)} placeholder="Nama produk" />
                    <NumInput value={row.qty} onChange={v => updateOutput(row.id, 'qty', v)} placeholder="250" />
                    <select value={row.unit}
                      onChange={e => updateOutput(row.id, 'unit', e.target.value as OutputProductRow['unit'])}
                      className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]">
                      <option value="gr">gr</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                    <NumInput value={row.sellPrice} onChange={v => updateOutput(row.id, 'sellPrice', v)}
                      placeholder="80" prefix="Rp" />
                    <div className={`rounded-xl px-3 py-2 text-sm text-right font-bold
                      ${res ? 'bg-[var(--tint-amber)] border border-[#065F46] text-[#27B18A]' : 'text-[var(--text-4)]'}`}>
                      {res ? formatRp(res.hpp) : '—'}
                    </div>
                    <DeleteBtn onClick={() => setOutputs(prev => prev.filter(r => r.id !== row.id))} />
                  </div>
                </div>
              );
            })}
          </div>
          <AddRowBtn onClick={() => setOutputs(prev => [...prev, emptyOutput()])} label="Tambah Produk" />
        </section>
      </div>

      {/* Right panel */}
      <div className="mt-5 lg:mt-0 space-y-4">
        {/* Summary */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-3">
            Ringkasan
          </span>
          <div className="mb-3">
            <p className="text-[11px] text-[var(--text-2)]">Total biaya input</p>
            <p className="text-2xl font-bold text-[var(--text)] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {totalCost > 0 ? formatRp(totalCost) : 'Rp —'}
            </p>
          </div>
          {derivedResults.length > 0 && (
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              {derivedResults.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text)] truncate mr-2">{r.name}</span>
                  <span className="text-[11px] font-bold text-[#27B18A] shrink-0">
                    {formatRp(r.hpp)}/{r.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={derivedResults.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-[#27B18A] text-white
            rounded-xl py-3 text-sm font-bold transition-opacity
            disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0E927A]"
        >
          <Save size={15} />
          Simpan {derivedResults.length > 0 ? `${derivedResults.length} Produk` : 'Produk'}
        </button>

        {/* Saved list */}
        {derivedIngredients.length > 0 && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-3">
              Tersimpan
            </span>
            <div className="space-y-1">
              {derivedIngredients.map(di => (
                <div key={di.id} className="flex items-center justify-between py-1.5
                  border-b border-[var(--border-subtle)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{di.name}</p>
                    <p className="text-[11px] text-[var(--text-2)]">
                      {formatRp(di.costPerUnit)}/{di.unit}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRemove(di.id)}
                    className="text-[var(--text-4)] hover:text-red-400 transition-colors ml-2">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <button type="button" onClick={() => onRemoveRawIngredient(item.name)}
                    className="text-[var(--text-4)] hover:text-red-400 transition-colors ml-2 shrink-0">
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
