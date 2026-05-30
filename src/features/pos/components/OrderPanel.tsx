'use client';

import { ShoppingBag, Loader2, Plus, Minus, Gift } from 'lucide-react';
import { formatRp } from '@/lib/format';

type CartLine = {
  recipe: { id: string; name: string; hpp: number };
  qty: number;
  sellPrice: number;
  subtotal: number;
};

interface OrderPanelProps {
  cartLines: CartLine[];
  totals: { revenue: number; hpp: number; profit: number };
  totalQty: number;
  isLoyaltyFree?: boolean;
  discountType: 'percent' | 'nominal';
  discountRaw: string;
  discountAmount: number;
  onDiscountTypeChange: (t: 'percent' | 'nominal') => void;
  onDiscountRawChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  onCheckout: () => void;
  isProcessing?: boolean;
  onSetQty: (id: string, qty: number) => void;
  paymentMethod: 'CASH' | 'QRIS';
  onPaymentMethodChange: (m: 'CASH' | 'QRIS') => void;
  checkoutName: string;
  checkoutPhone: string;
  onCheckoutNameChange: (v: string) => void;
  onCheckoutPhoneChange: (v: string) => void;
}

export function OrderPanel({
  cartLines,
  totals,
  totalQty,
  isLoyaltyFree = false,
  discountType,
  discountRaw,
  discountAmount,
  onDiscountTypeChange,
  onDiscountRawChange,
  note,
  onNoteChange,
  onCheckout,
  isProcessing = false,
  onSetQty,
  paymentMethod,
  onPaymentMethodChange,
  checkoutName,
  checkoutPhone,
  onCheckoutNameChange,
  onCheckoutPhoneChange,
}: OrderPanelProps) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">Pesanan</span>
        {totalQty > 0 && (
          <span className="text-xs font-bold bg-[#27B18A] text-white px-2 py-0.5 rounded-full">
            {totalQty}
          </span>
        )}
      </div>

      {cartLines.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <ShoppingBag size={24} className="mx-auto text-[#A7C4BC] mb-2" />
          <p className="text-sm text-[var(--text-4)]">Pilih menu di sebelah kiri</p>
        </div>
      ) : (
        <>
          <div className="px-5 py-3 space-y-2.5 max-h-[280px] overflow-y-auto">
            {cartLines.map(line => (
              <div key={line.recipe.id} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSetQty(line.recipe.id, line.qty - 1)}
                    className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center
                      text-[var(--text-2)] hover:bg-[var(--surface)] transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-sm font-bold tabular-nums w-5 text-center
                    text-[var(--text)]">{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => onSetQty(line.recipe.id, line.qty + 1)}
                    className="w-6 h-6 rounded-md bg-[var(--bg)] border border-[var(--border)] flex items-center
                      justify-center text-[var(--text-2)] hover:bg-[var(--surface)] transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </div>
                <span className="flex-1 text-sm text-[var(--text)] truncate">{line.recipe.name}</span>
                <span className="text-sm font-semibold text-[var(--text)] tabular-nums shrink-0">
                  {formatRp(line.subtotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-[var(--border-subtle)] space-y-2">
            {isLoyaltyFree && (
              <div className="flex items-center gap-2 bg-[var(--tint-amber)] border border-[#065F46]
                rounded-xl px-3 py-2 mb-1">
                <Gift size={13} className="text-[#27B18A] shrink-0" />
                <span className="text-xs font-bold text-[#27B18A]">🎉 Loyalty reward! Cup ke-11 gratis</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-2)]">HPP</span>
              <span className="tabular-nums text-[var(--text-2)]">{formatRp(totals.hpp)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-[#DC2626]">
                <span>Diskon</span>
                <span className="tabular-nums">−{formatRp(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold" style={{
              color: totals.profit >= 0 ? '#27B18A' : '#DC2626',
            }}>
              <span>Estimasi Laba</span>
              <span className="tabular-nums">{formatRp(totals.profit)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text)]">Total</span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-bricolage, system-ui)',
                  color: isLoyaltyFree ? '#27B18A' : 'var(--text)',
                }}
              >
                {isLoyaltyFree ? 'GRATIS' : formatRp(totals.revenue)}
              </span>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-3">
            {/* Diskon */}
            {!isLoyaltyFree && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                  Diskon (opsional)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl overflow-hidden border border-[var(--border)] shrink-0">
                    {(['percent', 'nominal'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onDiscountTypeChange(t)}
                        className={`px-3 py-2 text-xs font-bold transition-colors ${
                          discountType === t ? 'bg-[#27B18A] text-white' : 'bg-[var(--surface)] text-[var(--text-2)]'
                        }`}
                      >
                        {t === 'percent' ? '%' : 'Rp'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountRaw}
                    onChange={e => onDiscountRawChange(e.target.value)}
                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
              </div>
            )}

            {/* Customer info (CRM) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={checkoutName}
                  onChange={e => onCheckoutNameChange(e.target.value)}
                  placeholder="Nama (opsional)"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                    placeholder:text-[var(--text-4)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={checkoutPhone}
                  onChange={e => onCheckoutPhoneChange(e.target.value)}
                  placeholder="08xx (opsional)"
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                    placeholder:text-[var(--text-4)] text-[var(--text)]"
                />
              </div>
            </div>

            {/* Note field */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                Catatan (opsional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder="Catatan"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                  resize-none focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                  placeholder:text-[var(--text-4)] text-[var(--text)]"
              />
            </div>
            {/* Metode Pembayaran */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                Metode Pembayaran
              </label>
              <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
                {(['CASH', 'QRIS'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onPaymentMethodChange(m)}
                    className={`flex-1 py-2 text-xs font-bold transition-colors ${
                      paymentMethod === m
                        ? 'bg-[#27B18A] text-white'
                        : 'bg-[var(--surface)] text-[var(--text-2)]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={onCheckout}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#27B18A] text-white
                py-3 rounded-xl font-semibold text-sm hover:bg-[#0E927A] transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
              Selesaikan Transaksi
            </button>
          </div>
        </>
      )}
    </div>
  );
}
