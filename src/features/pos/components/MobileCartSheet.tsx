'use client';

import { ShoppingBag, Loader2, Plus, Minus, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatRp } from '@/lib/format';

type CartLine = {
  recipe: { id: string; name: string; hpp: number };
  qty: number;
  sellPrice: number;
  subtotal: number;
};

interface MobileCartSheetProps {
  cartLines: CartLine[];
  totalQty: number;
  isLoyaltyFree: boolean;
  effectiveRevenue: number;
  totalsHpp: number;
  discountAmount: number;
  discountType: 'percent' | 'nominal';
  discountRaw: string;
  note: string;
  paymentMethod: 'CASH' | 'QRIS';
  isProcessing: boolean;
  isOpen: boolean;
  selectedCustomerName?: string;
  onToggleOpen: () => void;
  onClose: () => void;
  onSetCart: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  onDiscountTypeChange: (t: 'percent' | 'nominal') => void;
  onDiscountRawChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onPaymentMethodChange: (m: 'CASH' | 'QRIS') => void;
  onCheckout: () => void;
}

export function MobileCartSheet({
  cartLines,
  totalQty,
  isLoyaltyFree,
  effectiveRevenue,
  totalsHpp,
  discountAmount,
  discountType,
  discountRaw,
  note,
  paymentMethod,
  isProcessing,
  isOpen,
  selectedCustomerName,
  onToggleOpen,
  onClose,
  onSetCart,
  onDiscountTypeChange,
  onDiscountRawChange,
  onNoteChange,
  onPaymentMethodChange,
  onCheckout,
}: MobileCartSheetProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-30"
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] z-40 transition-all duration-300
          ${isOpen ? 'rounded-t-2xl' : ''}`}
        style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.10)' }}
      >
        {/* Drag handle / header tap area */}
        {isOpen && (
          <button
            type="button"
            onClick={onClose}
            className="w-full flex flex-col items-center pt-3 pb-2"
          >
            <span className="w-10 h-1 bg-[var(--border)] rounded-full" />
          </button>
        )}

        {/* Expanded sheet content */}
        {isOpen && (
          <div className="px-4 pb-2 max-h-[70vh] overflow-y-auto">
            {/* Cart lines */}
            <div className="space-y-2 mb-3">
              {cartLines.map(line => (
                <div key={line.recipe.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSetCart(prev => {
                        const qty = (prev[line.recipe.id] ?? 0) - 1;
                        if (qty <= 0) { const { [line.recipe.id]: _, ...r } = prev; return r; }
                        return { ...prev, [line.recipe.id]: qty };
                      })}
                      className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center
                        justify-center text-[var(--text-2)]"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold tabular-nums w-5 text-center">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => onSetCart(prev => ({ ...prev, [line.recipe.id]: (prev[line.recipe.id] ?? 0) + 1 }))}
                      className="w-8 h-8 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center
                        justify-center text-[var(--text-2)]"
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                  <span className="flex-1 text-sm text-[var(--text)] truncate">{line.recipe.name}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{formatRp(line.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Discount */}
            {!isLoyaltyFree && (
              <div className="mb-3">
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
                        className={`px-3 py-2.5 text-xs font-bold transition-colors ${
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
                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
              </div>
            )}

            {/* Note */}
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                Catatan (opsional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder="Catatan"
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                  resize-none focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20
                  focus:border-[#27B18A] placeholder:text-[var(--text-4)]"
              />
            </div>

            {/* Metode Pembayaran */}
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                Metode Pembayaran
              </label>
              <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
                {(['CASH', 'QRIS'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onPaymentMethodChange(m)}
                    className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
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

            {/* Totals summary */}
            <div className="border-t border-[var(--border-subtle)] pt-3 mb-3 space-y-1.5 text-sm">
              {isLoyaltyFree && (
                <div className="flex items-center gap-2 bg-[var(--tint-amber)] border border-[#065F46]
                  rounded-xl px-3 py-2 mb-2">
                  <Gift size={13} className="text-[#27B18A]" />
                  <span className="text-xs font-bold text-[#27B18A]">🎉 Cup ke-11 gratis!</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-2)]">
                <span>HPP</span>
                <span className="tabular-nums">{formatRp(totalsHpp)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#DC2626]">
                  <span>Diskon</span>
                  <span className="tabular-nums">−{formatRp(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-[var(--border-subtle)]">
                <span>Total</span>
                <span
                  className="tabular-nums"
                  style={{ color: isLoyaltyFree ? '#27B18A' : 'var(--text)', fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {isLoyaltyFree ? 'GRATIS' : formatRp(effectiveRevenue)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Always-visible bottom bar */}
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleOpen}
              className="flex-1 text-left"
            >
              <p className="text-xs text-[var(--text-2)]">{totalQty} item
                {selectedCustomerName && (
                  <span className="ml-2 font-semibold text-[#27B18A]">· {selectedCustomerName}</span>
                )}
                {(discountAmount > 0 || note) && (
                  <span className="ml-2 text-[#27B18A]">· ada catatan/diskon</span>
                )}
              </p>
              {isLoyaltyFree ? (
                <p className="text-lg font-bold text-[#27B18A] flex items-center gap-1.5">
                  <Gift size={14} /> GRATIS!
                </p>
              ) : (
                <p
                  className="text-lg font-bold text-[var(--text)] tabular-nums"
                  style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                >
                  {formatRp(effectiveRevenue)}
                  {discountAmount > 0 && (
                    <span className="text-xs font-normal text-[#DC2626] ml-1.5">
                      −{formatRp(discountAmount)}
                    </span>
                  )}
                </p>
              )}
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onCheckout}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 bg-[#27B18A] text-white px-6 py-3
                rounded-xl font-semibold text-sm hover:bg-[#0E927A] transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
              Selesaikan
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
}
