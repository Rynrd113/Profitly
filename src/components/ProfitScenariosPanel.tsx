'use client';

import type { PricingTier } from '@/types/hpp';
import type { BEPResult } from '@/lib/engine';
import { formatRp } from '@/lib/format';

interface ProfitScenariosPanelProps {
  hpp: number;
  tiers: PricingTier[];
  bep: BEPResult;
  fixedCost: number;
  targetUnits: number;
}

interface Scenario {
  label: string;
  sublabel: string;
  units: number;
  revenue: number;
  totalCost: number;
  profit: number;
}

function buildScenarios(
  hpp: number,
  sellPrice: number,
  fixedCost: number,
  targetUnits: number,
  bepUnit: number,
): Scenario[] {
  const calc = (n: number): Omit<Scenario, 'label' | 'sublabel'> => ({
    units: n,
    revenue: sellPrice * n,
    totalCost: fixedCost + hpp * n,
    profit: (sellPrice - hpp) * n - fixedCost,
  });

  return [
    { label: 'Sepi', sublabel: '20% target', ...calc(Math.floor(targetUnits * 0.2)) },
    { label: 'BEP', sublabel: 'balik modal', ...calc(Math.ceil(bepUnit)) },
    { label: 'Target', sublabel: '100% target', ...calc(targetUnits) },
    { label: 'Rame', sublabel: '150% target', ...calc(Math.floor(targetUnits * 1.5)) },
  ];
}

function ProfitBadge({ profit }: { profit: number }) {
  if (profit < -1) {
    return (
      <span className="tabular-nums font-semibold text-[#DC2626]">
        {formatRp(profit)}
      </span>
    );
  }
  if (profit <= 1) {
    return (
      <span className="tabular-nums font-semibold text-[#D97706]">
        Rp 0
      </span>
    );
  }
  return (
    <span className="tabular-nums font-semibold text-[#1A6B3C]">
      +{formatRp(profit)}
    </span>
  );
}

export function ProfitScenariosPanel({
  hpp, tiers, bep, fixedCost, targetUnits,
}: ProfitScenariosPanelProps) {
  if (targetUnits <= 0) return null;

  const sellPrice = tiers[1]?.sellPrice ?? tiers[0]?.sellPrice ?? 0;
  if (!sellPrice) return null;

  const scenarios = buildScenarios(hpp, sellPrice, fixedCost, targetUnits, bep.bepUnit);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-1">
        4 Skenario Profit
      </span>
      <p className="text-xs text-[#9CA3AF] mb-4">
        Estimasi pada harga standar ·{' '}
        <span className="font-medium text-[#1A1A18]">
          target {targetUnits.toLocaleString('id-ID')} porsi/bulan
        </span>
      </p>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[320px]">
          <thead>
            <tr className="border-b border-[#F0EDE8]">
              <th className="text-left pb-2 pr-2 text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA]">
                Skenario
              </th>
              <th className="text-right pb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA]">
                Porsi
              </th>
              <th className="text-right pb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA]">
                Pendapatan
              </th>
              <th className="text-right pb-2 pl-2 text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA]">
                Profit
              </th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => {
              const isHighlighted = s.label === 'Target';
              return (
                <tr
                  key={s.label}
                  className={`border-b border-[#F0EDE8] last:border-0 ${
                    isHighlighted ? 'bg-[#F0F9F4]' : ''
                  }`}
                >
                  <td className="py-2.5 pr-2">
                    <span className={`font-semibold ${isHighlighted ? 'text-[#1A6B3C]' : 'text-[#1A1A18]'}`}>
                      {s.label}
                    </span>
                    <span className="block text-[10px] text-[#9CA3AF]">{s.sublabel}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-[#6B7280]">
                    {s.units.toLocaleString('id-ID')}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-[#6B7280]">
                    {formatRp(s.revenue)}
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <ProfitBadge profit={s.profit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[#C4BFBA] mt-3">
        Profit = Pendapatan − (HPP × porsi) − biaya tetap
      </p>
    </div>
  );
}
