'use client';

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PricingCard } from '@/components/CalculatorShared';
import type { PricingTier } from '@/types/hpp';
import type { BEPResult } from '@/lib/engine';
import { calculateBEP } from '@/lib/engine';
import { formatRp } from '@/lib/format';
import { usePriceStore } from '@/store/priceStore';

interface ResultsPanelProps {
  result: {
    hpp: number;
    tiers: PricingTier[];
    bep: BEPResult | null;
    batch: number | null;
  } | null;
  fixedCost: number;
  targetUnits: number;
}

export function ResultsPanel({ result, fixedCost, targetUnits }: ResultsPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const { targetPrice, setTargetPrice, clearTargetPrice } = usePriceStore();

  useEffect(() => {
    clearTargetPrice();
  }, [result?.hpp]);

  const effectiveSellPrice = targetPrice ?? result?.tiers[1]?.sellPrice ?? 0;

  const effectiveBep = useMemo(() => {
    if (!result || effectiveSellPrice <= 0 || fixedCost <= 0) return result?.bep ?? null;
    try { return calculateBEP(fixedCost, effectiveSellPrice, result.hpp); }
    catch { return result?.bep ?? null; }
  }, [result, effectiveSellPrice, fixedCost]);

  const handleSelectPrice = (price: number) => {
    setTargetPrice(price);
    navigator.clipboard?.writeText(String(price)).catch(() => {});
    const tierLabel = result?.tiers.find(t => t.sellPrice === price)?.label;
    const tierName = tierLabel === 'competitive' ? 'Kompetitif' : tierLabel === 'premium' ? 'Premium' : 'Standar';
    toast.success(`Harga ${tierName} ${new Intl.NumberFormat('id-ID').format(price)} dipilih — BEP diperbarui`);
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const { generateReport } = await import('@/lib/generateReport');
      generateReport({ ...result, fixedCost, targetUnits });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-5 lg:mt-0 space-y-4">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
            HPP per Porsi
          </span>
          <TrendingUp size={15} className="text-[#27B18A]" />
        </div>
        {result ? (
          <>
            <p className="text-[2.25rem] font-bold leading-none text-[var(--text)] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {formatRp(result.hpp)}
            </p>
            <p className="text-xs text-[var(--text-3)] mt-2">Harga Pokok Produksi</p>
            {result.batch && (
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-3)]">Total {result.batch} cup</span>
                <span className="text-sm font-bold text-[#27B18A] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                  {formatRp(result.hpp * result.batch)}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[2.25rem] font-bold leading-none text-[#A7C4BC]"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              Rp —
            </p>
            <p className="text-xs text-[var(--text-4)] mt-2">Masukkan data bahan baku terlebih dahulu</p>
          </>
        )}
      </div>

      {result ? (
        <>
          <p className="text-[10px] text-[var(--text-4)] text-center">
            Klik harga untuk memilih & perbarui BEP
          </p>
          <div className="space-y-3">
            {result.tiers.map((tier, i) => (
              <PricingCard
                key={tier.label} tier={tier}
                isHighlighted={targetPrice !== null && tier.sellPrice === targetPrice}
                isStarred={i === 1}
                batch={result.batch} onSelect={handleSelectPrice}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm text-center">
          <p className="text-sm text-[var(--text-4)]">Saran harga jual akan muncul otomatis di sini</p>
        </div>
      )}

      {effectiveBep && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-3">
            Titik Impas (BEP){targetPrice ? ` — Harga dipilih` : ` — Harga Standar (default)`}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[var(--text)] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {Math.ceil(effectiveBep.bepUnit).toLocaleString('id-ID')}
            </span>
            <span className="text-sm text-[var(--text-3)]">porsi / bulan</span>
          </div>
          <p className="text-xs text-[var(--text-3)] mt-1.5">
            {formatRp(effectiveBep.bepRevenue)} omzet minimal untuk balik modal
          </p>
        </div>
      )}

      {result && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4
            bg-[#27B18A] hover:bg-[#0E927A] active:bg-[#0E927A]
            disabled:opacity-60 disabled:cursor-not-allowed
            text-white text-sm font-semibold rounded-2xl
            shadow-sm transition-colors"
        >
          {downloading
            ? <><Loader2 size={15} className="animate-spin" /> Membuat laporan…</>
            : <><FileDown size={15} /> Download Laporan PDF</>
          }
        </button>
      )}

      <p className="text-[11px] text-[var(--text-4)] text-center pb-2">
        Semua perhitungan otomatis · data tidak disimpan
      </p>
    </div>
  );
}
