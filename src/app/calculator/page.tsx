'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Trash2, TrendingUp, Package,
  Zap, Star, SlidersHorizontal, ChefHat,
} from 'lucide-react';
import { calculateTotalHPP, getPricingTiers, calculateBEP } from '@/lib/engine';
import type { Ingredient, OperationalCost, PricingTier } from '@/types/hpp';

// ─── Local form types ────────────────────────────────────────────────────────

interface IngredientRow {
  id: string;
  name: string;
  purchasePrice: string;
  purchaseVolume: string;
  unit: 'gr' | 'ml' | 'pcs';
  usage: string;
  yieldFactor: string; // "100" = 100%, "80" = 80% yield (20% waste)
}

interface OperationalRow {
  id: string;
  name: string;
  price: string;
  usage: string; // percentage: "10" = 10% of monthly cost charged to this recipe
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
const uid = () => `r${++_counter}`;
const parseNum = (s: string) => parseFloat(s) || 0;
const fmtId = new Intl.NumberFormat('id-ID');
const formatRp = (n: number) => 'Rp ' + fmtId.format(Math.round(n));

const emptyIngredient = (): IngredientRow => ({
  id: uid(), name: '', purchasePrice: '', purchaseVolume: '',
  unit: 'gr', usage: '', yieldFactor: '100',
});

const emptyOp = (): OperationalRow => ({
  id: uid(), name: '', price: '', usage: '10',
});

// ─── Shared input primitives ─────────────────────────────────────────────────

function TextInput({
  value, onChange, placeholder, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
        focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
        transition-colors placeholder:text-[#C4BFBA] ${className}`}
    />
  );
}

function NumInput({
  value, onChange, placeholder, prefix, suffix, className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      {prefix && (
        <span className="absolute left-2.5 text-xs text-[#C4BFBA] pointer-events-none select-none">{prefix}</span>
      )}
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className={`w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl text-sm text-right
          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
          transition-colors placeholder:text-[#C4BFBA] py-2
          ${prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'}`}
      />
      {suffix && (
        <span className="absolute right-2.5 text-xs text-[#C4BFBA] pointer-events-none select-none">{suffix}</span>
      )}
    </div>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[#C4BFBA]
        hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
    >
      <Trash2 size={14} />
    </button>
  );
}

function AddRowBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#1A6B3C]
        hover:text-[#15803D] transition-colors"
    >
      <Plus size={15} />
      {label}
    </button>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#1A6B3C]">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#1A1A18]">{label}</h2>
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────

const TIER_META = {
  competitive: {
    label: 'Kompetitif',
    desc: 'Margin 20%',
    color: '#6B7280',
    ring: '#E5E7EB',
    bg: '#F9FAFB',
    bar: '#9CA3AF',
  },
  standard: {
    label: 'Standar',
    desc: 'Margin 35%',
    color: '#1A6B3C',
    ring: '#BBF7D0',
    bg: '#F0FDF4',
    bar: '#1A6B3C',
  },
  premium: {
    label: 'Premium',
    desc: 'Margin 50%',
    color: '#92400E',
    ring: '#FDE68A',
    bg: '#FFFBEB',
    bar: '#D97706',
  },
} as const;

function PricingCard({
  tier, isHighlighted,
}: {
  tier: PricingTier; isHighlighted: boolean;
}) {
  const m = TIER_META[tier.label];
  return (
    <div
      className="rounded-2xl p-4 border transition-shadow"
      style={{
        background: m.bg,
        borderColor: isHighlighted ? m.ring : '#E5E3DD',
        borderWidth: isHighlighted ? '1.5px' : '1px',
        boxShadow: isHighlighted ? `0 0 0 3px ${m.ring}50` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: m.color }}>
              {m.label}
            </span>
            {isHighlighted && (
              <span className="inline-flex items-center gap-0.5 bg-[#D97706] text-white
                text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                <Star size={8} fill="white" />
                SWEET SPOT
              </span>
            )}
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: m.color + '99' }}>{m.desc}</p>
        </div>

        <div className="text-right shrink-0">
          <p
            className="text-2xl font-bold leading-none"
            style={{
              color: m.color,
              fontFamily: 'var(--font-bricolage, system-ui)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatRp(tier.sellPrice)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: m.color + '88' }}>
            untung {formatRp(tier.profit)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1 rounded-full overflow-hidden bg-black/5">
        <div
          className="h-full rounded-full"
          style={{ width: `${tier.margin * 100}%`, background: m.bar }}
        />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [ops, setOps] = useState<OperationalRow[]>([emptyOp()]);
  const [totalOutput, setTotalOutput] = useState('10');
  const [fixedCost, setFixedCost] = useState('5000000');

  // Ingredient CRUD
  const updateIng = (id: string, field: keyof IngredientRow, val: string) =>
    setIngredients(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addIng = () => setIngredients(prev => [...prev, emptyIngredient()]);
  const removeIng = (id: string) => setIngredients(prev => prev.filter(r => r.id !== id));

  // Op CRUD
  const updateOp = (id: string, field: keyof OperationalRow, val: string) =>
    setOps(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const addOp = () => setOps(prev => [...prev, emptyOp()]);
  const removeOp = (id: string) => setOps(prev => prev.filter(r => r.id !== id));

  // Live calculation
  const result = useMemo(() => {
    try {
      const ingList = ingredients
        .filter(r => parseNum(r.purchasePrice) > 0 && parseNum(r.purchaseVolume) > 0 && parseNum(r.usage) > 0)
        .map(r => ({
          ingredient: {
            id: r.id, name: r.name,
            purchasePrice: parseNum(r.purchasePrice),
            purchaseVolume: parseNum(r.purchaseVolume),
            unit: r.unit,
            usage: parseNum(r.usage),
          } satisfies Ingredient,
          yieldFactor: Math.min(1, Math.max(0.01, parseNum(r.yieldFactor) / 100)),
        }));

      const opList: OperationalCost[] = ops
        .filter(r => parseNum(r.price) > 0)
        .map(r => ({
          id: r.id, name: r.name,
          price: parseNum(r.price),
          usage: Math.min(1, parseNum(r.usage) / 100),
        }));

      const output = Math.max(1, parseNum(totalOutput));
      if (ingList.length === 0 && opList.length === 0) return null;

      const hpp = calculateTotalHPP(ingList, opList, output);
      if (hpp <= 0) return null;

      const tiers = getPricingTiers(hpp);
      const fc = parseNum(fixedCost);
      const bep = fc > 0 ? calculateBEP(fc, tiers[1].sellPrice, hpp) : null;

      return { hpp, tiers, bep };
    } catch {
      return null;
    }
  }, [ingredients, ops, totalOutput, fixedCost]);

  const colHeaders = (cols: string[]) => (
    <div
      className="hidden md:grid gap-2 mb-2 px-1"
      style={{ gridTemplateColumns: 'var(--ing-cols)' }}
    >
      {cols.map(h => (
        <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">
          {h}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      {/* Sticky header */}
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
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">

          {/* ── Left column: inputs ── */}
          <div className="space-y-5">

            {/* Bahan Baku */}
            <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
              <SectionHeader icon={<Package size={15} />} label="Bahan Baku" />

              {/* Desktop column headers */}
              <div
                className="hidden md:grid gap-2 mb-2 px-1"
                style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}
              >
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
                        <TextInput
                          value={row.name}
                          onChange={v => updateIng(row.id, 'name', v)}
                          placeholder="Nama bahan"
                          className="flex-1"
                        />
                        <DeleteBtn onClick={() => removeIng(row.id)} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[10px] text-[#C4BFBA] mb-1">Harga Beli</p>
                          <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)} placeholder="14000" prefix="Rp" />
                        </div>
                        <div>
                          <p className="text-[10px] text-[#C4BFBA] mb-1">Volume</p>
                          <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)} placeholder="1000" />
                        </div>
                        <div>
                          <p className="text-[10px] text-[#C4BFBA] mb-1">Satuan</p>
                          <select
                            value={row.unit}
                            onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                            className="w-full bg-white border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                              focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                          >
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
                          <NumInput value={row.yieldFactor} onChange={v => updateIng(row.id, 'yieldFactor', v)} placeholder="100" suffix="%" />
                        </div>
                      </div>
                    </div>

                    {/* Desktop row */}
                    <div
                      className="hidden md:grid gap-2 items-center"
                      style={{ gridTemplateColumns: '1fr 104px 76px 72px 76px 60px 36px' }}
                    >
                      <TextInput value={row.name} onChange={v => updateIng(row.id, 'name', v)} placeholder="Nama bahan" />
                      <NumInput value={row.purchasePrice} onChange={v => updateIng(row.id, 'purchasePrice', v)} placeholder="14000" prefix="Rp" />
                      <NumInput value={row.purchaseVolume} onChange={v => updateIng(row.id, 'purchaseVolume', v)} placeholder="1000" />
                      <select
                        value={row.unit}
                        onChange={e => updateIng(row.id, 'unit', e.target.value as IngredientRow['unit'])}
                        className="bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-2 py-2 text-sm
                          focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                      >
                        <option value="gr">gr</option>
                        <option value="ml">ml</option>
                        <option value="pcs">pcs</option>
                      </select>
                      <NumInput value={row.usage} onChange={v => updateIng(row.id, 'usage', v)} placeholder="200" />
                      <NumInput value={row.yieldFactor} onChange={v => updateIng(row.id, 'yieldFactor', v)} placeholder="100" suffix="%" />
                      <DeleteBtn onClick={() => removeIng(row.id)} />
                    </div>
                  </div>
                ))}
              </div>

              <AddRowBtn onClick={addIng} label="Tambah Bahan" />
            </section>

            {/* Biaya Operasional */}
            <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
              <SectionHeader icon={<Zap size={15} />} label="Biaya Operasional" />

              <div
                className="hidden md:grid gap-2 mb-2 px-1"
                style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}
              >
                {['Nama Biaya', 'Biaya Bulanan', 'Porsi %', ''].map(h => (
                  <span key={h} className="text-[10px] font-bold text-[#C4BFBA] uppercase tracking-wider">{h}</span>
                ))}
              </div>

              <div className="space-y-2.5">
                {ops.map(row => (
                  <div key={row.id}>
                    {/* Mobile */}
                    <div className="md:hidden bg-[#F8F7F2] rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <TextInput
                          value={row.name}
                          onChange={v => updateOp(row.id, 'name', v)}
                          placeholder="Listrik, sewa, dsb."
                          className="flex-1"
                        />
                        <DeleteBtn onClick={() => removeOp(row.id)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-[#C4BFBA] mb-1">Biaya Bulanan</p>
                          <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)} placeholder="500000" prefix="Rp" />
                        </div>
                        <div>
                          <p className="text-[10px] text-[#C4BFBA] mb-1">Porsi dibebankan</p>
                          <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)} placeholder="10" suffix="%" />
                        </div>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div
                      className="hidden md:grid gap-2 items-center"
                      style={{ gridTemplateColumns: '1fr 148px 80px 36px' }}
                    >
                      <TextInput value={row.name} onChange={v => updateOp(row.id, 'name', v)} placeholder="Listrik, sewa, dsb." />
                      <NumInput value={row.price} onChange={v => updateOp(row.id, 'price', v)} placeholder="500000" prefix="Rp" />
                      <NumInput value={row.usage} onChange={v => updateOp(row.id, 'usage', v)} placeholder="10" suffix="%" />
                      <DeleteBtn onClick={() => removeOp(row.id)} />
                    </div>
                  </div>
                ))}
              </div>

              <AddRowBtn onClick={addOp} label="Tambah Biaya" />
            </section>

            {/* Parameter produksi */}
            <section className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
              <SectionHeader icon={<SlidersHorizontal size={15} />} label="Parameter Produksi" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                    Total Porsi per Batch
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min="1"
                      value={totalOutput}
                      onChange={e => setTotalOutput(e.target.value)}
                      className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl
                        px-3 pr-14 py-2.5 text-sm text-right focus:outline-none
                        focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] transition-colors"
                    />
                    <span className="absolute right-3 text-xs text-[#C4BFBA] select-none">porsi</span>
                  </div>
                  <p className="text-[11px] text-[#C4BFBA] mt-1.5">Jumlah cup/porsi dalam satu kali produksi</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A1A18] mb-1.5">
                    Biaya Tetap Bulanan
                    <span className="ml-1.5 text-[11px] font-normal text-[#9CA3AF]">untuk BEP</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs text-[#C4BFBA] select-none">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={fixedCost}
                      onChange={e => setFixedCost(e.target.value)}
                      className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl
                        pl-8 pr-3 py-2.5 text-sm text-right focus:outline-none
                        focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C] transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[#C4BFBA] mt-1.5">Total sewa, gaji, dan biaya tetap lainnya</p>
                </div>
              </div>
            </section>
          </div>

          {/* ── Right column: results (sticky) ── */}
          <div className="mt-5 lg:mt-0 lg:sticky lg:top-[73px] space-y-4">

            {/* HPP */}
            <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
                  HPP per Porsi
                </span>
                <TrendingUp size={15} className="text-[#1A6B3C]" />
              </div>
              {result ? (
                <>
                  <p
                    className="text-[2.25rem] font-bold leading-none text-[#1A1A18] tabular-nums"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                  >
                    {formatRp(result.hpp)}
                  </p>
                  <p className="text-xs text-[#9CA3AF] mt-2">Harga Pokok Produksi</p>
                </>
              ) : (
                <>
                  <p
                    className="text-[2.25rem] font-bold leading-none text-[#D1CBC3]"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                  >
                    Rp —
                  </p>
                  <p className="text-xs text-[#C4BFBA] mt-2">Masukkan data bahan baku terlebih dahulu</p>
                </>
              )}
            </div>

            {/* Pricing tiers */}
            {result ? (
              <div className="space-y-3">
                {result.tiers.map((tier, i) => (
                  <PricingCard key={tier.label} tier={tier} isHighlighted={i === 1} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm text-center">
                <p className="text-sm text-[#C4BFBA]">
                  Saran harga jual akan muncul otomatis di sini
                </p>
              </div>
            )}

            {/* BEP */}
            {result?.bep && (
              <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
                  Titik Impas (BEP) — Harga Standar
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-3xl font-bold text-[#1A1A18] tabular-nums"
                    style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                  >
                    {Math.ceil(result.bep.bepUnit).toLocaleString('id-ID')}
                  </span>
                  <span className="text-sm text-[#9CA3AF]">porsi / bulan</span>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1.5">
                  {formatRp(result.bep.bepRevenue)} omzet minimal untuk balik modal
                </p>
              </div>
            )}

            {/* Footer note */}
            <p className="text-[11px] text-[#C4BFBA] text-center pb-2">
              Semua perhitungan otomatis · data tidak disimpan
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
