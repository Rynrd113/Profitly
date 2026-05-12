'use client';

import { useState } from 'react';
import { TrendingUp, FileDown, Loader2 } from 'lucide-react';
import { PricingCard } from '@/components/CalculatorShared';
import { BEPChart } from '@/components/BEPChart';
import { ProfitScenariosPanel } from '@/components/ProfitScenariosPanel';
import type { PricingTier } from '@/types/hpp';
import type { BEPResult } from '@/lib/engine';
import { formatRp } from '@/lib/format';

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
      <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
            HPP per Porsi
          </span>
          <TrendingUp size={15} className="text-[#1A6B3C]" />
        </div>
        {result ? (
          <>
            <p className="text-[2.25rem] font-bold leading-none text-[#1A1A18] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {formatRp(result.hpp)}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-2">Harga Pokok Produksi</p>
            {result.batch && (
              <div className="mt-3 pt-3 border-t border-[#F0EDE8] flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Total {result.batch} cup</span>
                <span className="text-sm font-bold text-[#1A6B3C] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
                  {formatRp(result.hpp * result.batch)}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[2.25rem] font-bold leading-none text-[#D1CBC3]"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              Rp —
            </p>
            <p className="text-xs text-[#C4BFBA] mt-2">Masukkan data bahan baku terlebih dahulu</p>
          </>
        )}
      </div>

      {result ? (
        <div className="space-y-3">
          {result.tiers.map((tier, i) => (
            <PricingCard key={tier.label} tier={tier} isHighlighted={i === 1} batch={result.batch} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm text-center">
          <p className="text-sm text-[#C4BFBA]">Saran harga jual akan muncul otomatis di sini</p>
        </div>
      )}

      {result?.bep && (
        <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-3">
            Titik Impas (BEP) — Harga Standar
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#1A1A18] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}>
              {Math.ceil(result.bep.bepUnit).toLocaleString('id-ID')}
            </span>
            <span className="text-sm text-[#9CA3AF]">porsi / bulan</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1.5">
            {formatRp(result.bep.bepRevenue)} omzet minimal untuk balik modal
          </p>
        </div>
      )}

      {result?.bep && (
        <BEPChart
          hpp={result.hpp}
          tiers={result.tiers}
          bep={result.bep}
          fixedCost={fixedCost}
        />
      )}

      {result?.bep && (
        <ProfitScenariosPanel
          hpp={result.hpp}
          tiers={result.tiers}
          bep={result.bep}
          fixedCost={fixedCost}
          targetUnits={targetUnits}
        />
      )}

      {result && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4
            bg-[#1A6B3C] hover:bg-[#15593A] active:bg-[#114A31]
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

      <p className="text-[11px] text-[#C4BFBA] text-center pb-2">
        Semua perhitungan otomatis · data tidak disimpan
      </p>
    </div>
  );
}
