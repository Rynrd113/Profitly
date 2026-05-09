'use client';

import { TrendingUp } from 'lucide-react';
import { PricingCard } from '@/components/CalculatorShared';
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
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  return (
    <div className="mt-5 lg:mt-0 lg:sticky lg:top-[73px] space-y-4">
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

      <p className="text-[11px] text-[#C4BFBA] text-center pb-2">
        Semua perhitungan otomatis · data tidak disimpan
      </p>
    </div>
  );
}
