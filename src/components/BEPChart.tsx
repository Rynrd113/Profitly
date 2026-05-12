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
    <div className="bg-white border border-[#E5E3DD] rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-[#1A1A18] mb-1.5">{label} porsi</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {formatRp(p.value)}
        </p>
      ))}
    </div>
  );
};

export function BEPChart({ hpp, tiers, bep, fixedCost }: BEPChartProps) {
  const sellPrice = tiers[1]?.sellPrice ?? tiers[0]?.sellPrice ?? 0;
  if (!sellPrice || !bep) return null;

  const { data, maxUnits } = buildChartData(fixedCost, hpp, sellPrice, bep.bepUnit);
  const bepX = Math.ceil(bep.bepUnit);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] block mb-1">
        Grafik BEP — Harga Standar
      </span>
      <p className="text-xs text-[#9CA3AF] mb-4">
        Titik perpotongan = mulai untung pada{' '}
        <span className="font-semibold text-[#1A6B3C]">
          {bepX.toLocaleString('id-ID')} porsi
        </span>
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
          <XAxis
            dataKey="units"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={(v) => v === 0 ? '0' : formatK(v)}
            domain={[0, maxUnits]}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            tickFormatter={formatK}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-[11px] text-[#6B7280]">{value}</span>
            )}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <ReferenceLine
            x={bepX}
            stroke="#1A6B3C"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `BEP ${bepX.toLocaleString('id-ID')}`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: '#1A6B3C',
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
            stroke="#1A6B3C"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
