'use client';

import { useState } from 'react';
import { Archive, MessageCircle } from 'lucide-react';
import { formatRp } from '@/lib/format';
import type { SaleRecord, StockTransaction } from '@/types/hpp';

export function ShiftClosing({
  records,
  transactions,
  onArchive,
}: {
  records: SaleRecord[];
  transactions: StockTransaction[];
  onArchive: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const today = new Date().toDateString();

  const todayRecords = records.filter(r => !r.cancelled && new Date(r.timestamp).toDateString() === today);
  const omzet = todayRecords.reduce((s, r) => s + r.totalRevenue, 0);
  const totalProfit = todayRecords.reduce((s, r) => s + r.grossProfit, 0);
  const totalItems = todayRecords.reduce((s, r) => s + r.items.reduce((si, i) => si + i.qty, 0), 0);

  const ingredientMap = new Map<string, { amount: number; unit: string }>();
  transactions
    .filter(tx => new Date(tx.timestamp).toDateString() === today)
    .forEach(tx => {
      tx.items.forEach(item => {
        if (item.delta < 0) {
          const ex = ingredientMap.get(item.ingredientName);
          if (ex) ex.amount += Math.abs(item.delta);
          else ingredientMap.set(item.ingredientName, { amount: Math.abs(item.delta), unit: item.unit });
        }
      });
    });
  const topIngredients = Array.from(ingredientMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5);

  const cashRecs = todayRecords.filter(r => (r.paymentMethod ?? 'CASH') === 'CASH');
  const qrisRecs = todayRecords.filter(r => r.paymentMethod === 'QRIS');

  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const waLines = [
    `*Laporan Shift - ${dateStr}*`,
    '',
    `Omzet: ${formatRp(omzet)}`,
    `Total Profit: ${formatRp(totalProfit)}`,
    `Transaksi: ${todayRecords.length}x`,
    `Item Terjual: ${totalItems} pcs`,
    ...(topIngredients.length > 0
      ? ['', '📦 Bahan Terpakai:', ...topIngredients.map(([n, { amount, unit }]) =>
          `- ${n}: ${amount % 1 === 0 ? amount : amount.toFixed(1)} ${unit}`
        )]
      : []),
    '',
    '_Dibuat oleh ProfitLy_',
  ];
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waLines.join('\n'))}`;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Archive size={14} className="text-[#27B18A]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">Tutup Shift</span>
        </div>
        <p className="text-sm text-[var(--text-2)]">{dateStr}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { label: 'Omzet',        value: formatRp(omzet),           green: true  },
          { label: 'Total Profit', value: formatRp(totalProfit),     green: totalProfit > 0 },
          { label: 'Transaksi',    value: `${todayRecords.length}×`, green: false },
          { label: 'Item Terjual', value: `${totalItems} pcs`,       green: false },
        ] as { label: string; value: string; green: boolean }[]).map(({ label, value, green }) => (
          <div key={label} className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] mb-1">{label}</p>
            <p
              className="text-xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)', color: green ? '#27B18A' : 'var(--text)' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {topIngredients.length > 0 && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
              Bahan Paling Banyak Terpakai
            </span>
          </div>
          <div className="px-5 py-3 space-y-2">
            {topIngredients.map(([name, { amount, unit }]) => (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-[var(--text-2)]">{name}</span>
                <span className="font-medium text-[var(--text)] tabular-nums">
                  {amount % 1 === 0 ? amount : amount.toFixed(1)} {unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {todayRecords.length > 0 && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
              Rekap Pembayaran
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {(['Metode', 'Transaksi', 'Omzet'] as const).map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { label: 'CASH', recs: cashRecs },
                { label: 'QRIS', recs: qrisRecs },
              ] as { label: string; recs: typeof todayRecords }[]).map(({ label, recs }) => (
                <tr key={label} className="border-b border-[var(--border-subtle)]">
                  <td className="px-5 py-2.5 text-sm font-medium text-[var(--text)]">{label}</td>
                  <td className="px-5 py-2.5 text-sm text-right tabular-nums text-[var(--text-2)]">
                    {recs.length}×
                  </td>
                  <td className="px-5 py-2.5 text-sm text-right tabular-nums text-[var(--text)]">
                    {formatRp(recs.reduce((s, r) => s + r.totalRevenue, 0))}
                  </td>
                </tr>
              ))}
              <tr className="bg-[var(--bg)]/40">
                <td className="px-5 py-2.5 text-sm font-bold text-[var(--text)]">Total</td>
                <td className="px-5 py-2.5 text-sm font-bold text-right tabular-nums text-[var(--text)]">
                  {todayRecords.length}×
                </td>
                <td className="px-5 py-2.5 text-sm font-bold text-right tabular-nums text-[#27B18A]">
                  {formatRp(omzet)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-2.5">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white
            py-3 rounded-xl font-semibold text-sm hover:bg-[#1DAA54] transition-colors"
        >
          <MessageCircle size={15} />
          Kirim Laporan via WhatsApp
        </a>

        {confirming ? (
          <div className="bg-[var(--tint-red)] border border-[#7F1D1D] rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-[#DC2626] text-center">
              Arsipkan {todayRecords.length} transaksi hari ini?
            </p>
            <p className="text-xs text-[var(--text-3)] text-center">
              Data tersimpan di histori. Dashboard besok mulai dari nol.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { onArchive(); setConfirming(false); }}
                className="flex-1 bg-[#DC2626] text-white py-2.5 rounded-xl font-semibold text-sm"
              >
                Ya, Arsipkan
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] py-2.5
                  rounded-xl font-semibold text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={todayRecords.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[var(--surface)] border border-[var(--border)]
              text-[var(--text-2)] py-3 rounded-xl font-semibold text-sm
              hover:border-[#DC2626]/40 hover:text-[#DC2626] transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Archive size={15} />
            Arsipkan & Reset
          </button>
        )}
      </div>
    </div>
  );
}
