'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Dot,
} from 'recharts';
import type { BEPResult } from '@/lib/engine';
import type { PricingTier } from '@/types/hpp';
import { formatRp } from '@/lib/format';

interface BEPChartProps {
  hpp: number;
  tiers: PricingTier[];
  bep: BEPResult;
  fixedCost: number;
  selectedSellPrice?: number;
}

function buildChartData(fixedCost: number, hpp: number, sellPrice: number, bepUnit: number) {
  const maxUnits = Math.ceil(bepUnit * 2);
  const steps = 40;
  const step = maxUnits / steps;
  const data = [];
  for (let i = 0; i <= steps; i++) {
    const units = Math.round(i * step);
    data.push({
      units,
      totalBiaya: fixedCost + hpp * units,
      pendapatan: sellPrice * units,
    });
  }
  return { data, maxUnits };
}

const formatK = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-[var(--text)] mb-1.5">{label} porsi</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {formatRp(p.value)}
        </p>
      ))}
    </div>
  );
};

export function BEPChart({ hpp, tiers, bep, fixedCost, selectedSellPrice }: BEPChartProps) {
  const sellPrice = selectedSellPrice ?? tiers[1]?.sellPrice ?? tiers[0]?.sellPrice ?? 0;
  if (!sellPrice || !bep) return null;

  const { data, maxUnits } = buildChartData(fixedCost, hpp, sellPrice, bep.bepUnit);
  const bepX = Math.ceil(bep.bepUnit);

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-1">
        Grafik BEP — Harga Standar
      </span>
      <p className="text-xs text-[var(--text-3)] mb-4">
        Titik perpotongan = mulai untung pada{' '}
        <span className="font-semibold text-[#27B18A]">
          {bepX.toLocaleString('id-ID')} porsi
        </span>
        {selectedSellPrice && <span className="ml-1 text-[10px] text-[var(--text-4)]">(harga dipilih)</span>}
      </p>
      <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="units"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--text-3)' }}
            tickFormatter={(v) => v === 0 ? '0' : formatK(v)}
            domain={[0, maxUnits]}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--text-3)' }}
            tickFormatter={formatK}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-[11px] text-[var(--text-2)]">{value}</span>
            )}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <ReferenceLine
            x={bepX}
            stroke="#27B18A"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `BEP ${bepX.toLocaleString('id-ID')}`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: '#27B18A',
              dy: -2,
            }}
          />
          <Line
            type="monotone"
            dataKey="totalBiaya"
            name="Total Biaya"
            stroke="#E57373"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="pendapatan"
            name="Estimasi Pendapatan"
            stroke="#27B18A"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
