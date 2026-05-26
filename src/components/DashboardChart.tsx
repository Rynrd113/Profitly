'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatRp } from '@/lib/format';

function formatYAxis(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 shadow-lg text-xs">
      <p className="font-bold text-[var(--text-2)] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[var(--text-2)]">{p.name}</span>
          <span className="font-semibold text-[var(--text)] ml-2 tabular-nums">
            {formatRp(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SalesTrendChart({ data }: {
  data: { date: string; omzet: number; profit: number }[];
}) {
  const hasAnyData = data.some(d => d.omzet > 0 || d.profit > 0);

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
            Tren Penjualan
          </span>
          <p className="text-xs text-[var(--text-3)] mt-0.5">7 Hari Terakhir</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-2)]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#2563EB] rounded-full inline-block" />
            Omzet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#27B18A] rounded-full inline-block" />
            Profit
          </span>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-[var(--text-4)]">Belum ada data 7 hari terakhir</p>
        </div>
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'var(--font-jakarta, system-ui)' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'var(--font-jakarta, system-ui)' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="omzet"
                name="Omzet"
                stroke="#2563EB"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#27B18A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#27B18A', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#27B18A', strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
