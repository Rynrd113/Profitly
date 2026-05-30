'use client';

import { CheckCircle2, RotateCcw, Printer, MessageCircle, Gift } from 'lucide-react';
import { formatRp } from '@/lib/format';
import type { SaleRecord } from '@/types/hpp';

export function SuccessScreen({
  record,
  onReset,
  onPrint,
  onWhatsApp,
}: {
  record: SaleRecord;
  onReset: () => void;
  onPrint: () => void;
  onWhatsApp?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--tint-amber)] flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-[#27B18A]" />
        </div>
        <h2
          className="text-xl font-bold text-[var(--text)] mb-1"
          style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
        >
          Transaksi Selesai
        </h2>
        <p className="text-xs text-[var(--text-3)] mb-2">
          {new Date(record.timestamp).toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        {record.note && (
          <p className="text-xs text-[var(--text-2)] italic mb-4 px-2">
            "{record.note}"
          </p>
        )}

        <div className="space-y-1.5 mb-6 text-left">
          {record.items.map(item => (
            <div key={item.recipeId} className="flex justify-between text-sm">
              <span className="text-[var(--text-2)]">{item.qty}× {item.recipeName}</span>
              <span className="font-medium text-[var(--text)] tabular-nums">{formatRp(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {record.loyaltyRedeemed && (
          <div className="flex items-center gap-2 bg-[var(--tint-amber)] border border-[#065F46]
            rounded-xl px-3 py-2 mb-3">
            <Gift size={13} className="text-[#27B18A]" />
            <span className="text-xs font-bold text-[#27B18A]">Loyalty reward! Cup ke-11 gratis 🎉</span>
          </div>
        )}

        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2 text-sm">
          <div className="flex justify-between font-bold text-base">
            <span className="text-[var(--text)]">Total</span>
            <span
              className="text-[#27B18A] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              {record.loyaltyRedeemed ? 'GRATIS' : formatRp(record.totalRevenue)}
            </span>
          </div>
          {record.discountAmount && record.discountAmount > 0 ? (
            <div className="flex justify-between text-[#DC2626]">
              <span>
                Diskon{record.discountType === 'percent' ? ` (${record.discountValue}%)` : ''}
              </span>
              <span className="tabular-nums">−{formatRp(record.discountAmount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-[var(--text-2)]">
            <span>HPP</span>
            <span className="tabular-nums">{formatRp(record.totalHPP)}</span>
          </div>
          <div className="flex justify-between font-semibold text-[#27B18A]">
            <span>Laba Kotor</span>
            <span className="tabular-nums">{formatRp(record.grossProfit)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                border border-[var(--border)] text-[var(--text-2)] rounded-xl font-semibold text-sm
                hover:bg-[var(--surface-2)] transition-colors"
            >
              <Printer size={14} />
              Cetak Struk
            </button>
            {onWhatsApp && (
              <button
                type="button"
                onClick={onWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                  border border-[#25D366]/40 text-[#25D366] rounded-xl font-semibold text-sm
                  hover:bg-[#25D366]/10 transition-colors"
              >
                <MessageCircle size={14} />
                Kirim WA
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onReset}
            className="w-full flex items-center justify-center gap-2 px-4 py-3
              bg-[#27B18A] text-white rounded-xl font-semibold text-sm
              hover:bg-[#0E927A] transition-colors"
          >
            <RotateCcw size={15} />
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}
