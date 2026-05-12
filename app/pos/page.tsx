'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Minus, ShoppingBag,
  CheckCircle2, RotateCcw, Receipt, AlertTriangle, Loader2,
  Users, UserPlus, Search, Gift, X, Trash2,
  Archive, MessageCircle,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { getPricingTiers } from '@/lib/engine';
import { parseNum, formatRp } from '@/lib/format';
import { useCustomers } from '@/hooks/useCustomers';
import type { SaleRecord, StockTransaction, StockTransactionItem, Customer } from '@/types/hpp';

type TierKey = 'competitive' | 'standard' | 'premium';
type ViewTab = 'pos' | 'pelanggan' | 'tutup-shift';
type Cart = Record<string, number>;

const TIER_IDX: Record<TierKey, number> = { competitive: 0, standard: 1, premium: 2 };
const TIER_META: Record<TierKey, { label: string; margin: string; color: string; bg: string; border: string }> = {
  competitive: { label: 'Kompetitif', margin: '20%', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  standard:    { label: 'Standar',    margin: '35%', color: '#1A6B3C', bg: '#F0FDF4', border: '#BBF7D0' },
  premium:     { label: 'Premium',    margin: '50%', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
};

// ─── Success screen ──────────────────────────────────────────────────────────

function SuccessScreen({
  record,
  onReset,
}: {
  record: SaleRecord;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-[#1A6B3C]" />
        </div>
        <h2
          className="text-xl font-bold text-[#1A1A18] mb-1"
          style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
        >
          Transaksi Selesai
        </h2>
        <p className="text-xs text-[#9CA3AF] mb-2">
          {new Date(record.timestamp).toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        {record.note && (
          <p className="text-xs text-[#78716C] italic mb-4 px-2">
            "{record.note}"
          </p>
        )}

        <div className="space-y-1.5 mb-6 text-left">
          {record.items.map(item => (
            <div key={item.recipeId} className="flex justify-between text-sm">
              <span className="text-[#78716C]">{item.qty}× {item.recipeName}</span>
              <span className="font-medium text-[#1A1A18] tabular-nums">{formatRp(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {record.loyaltyRedeemed && (
          <div className="flex items-center gap-2 bg-[#ECFDF5] border border-[#BBF7D0]
            rounded-xl px-3 py-2 mb-3">
            <Gift size={13} className="text-[#1A6B3C]" />
            <span className="text-xs font-bold text-[#1A6B3C]">Loyalty reward! Cup ke-11 gratis 🎉</span>
          </div>
        )}

        <div className="border-t border-[#F0EDE8] pt-4 space-y-2 text-sm">
          <div className="flex justify-between font-bold text-base">
            <span className="text-[#1A1A18]">Total</span>
            <span
              className="text-[#1A6B3C] tabular-nums"
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
          <div className="flex justify-between text-[#78716C]">
            <span>HPP</span>
            <span className="tabular-nums">{formatRp(record.totalHPP)}</span>
          </div>
          <div className="flex justify-between font-semibold text-[#1A6B3C]">
            <span>Laba Kotor</span>
            <span className="tabular-nums">{formatRp(record.grossProfit)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3
            bg-[#1A6B3C] text-white rounded-xl font-semibold text-sm
            hover:bg-[#15593A] transition-colors"
        >
          <RotateCcw size={15} />
          Transaksi Baru
        </button>
      </div>
    </div>
  );
}

// ─── Main POS page ───────────────────────────────────────────────────────────

export default function POSPage() {
  const { recipes } = useSavedRecipes();
  const { ingredients: rawIngredients, deductStock } = useSavedRawIngredients();
  const { transactions, add: addTransaction } = useStockTransactions();
  const { records, add: addSaleRecord, archiveShift } = useSalesRecords();

  const { customers, addCustomer, updateAfterOrder, deleteCustomer } = useCustomers();
  const [view, setView] = useState<ViewTab>('pos');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [cart, setCart] = useState<Cart>({});
  const [tier, setTier] = useState<TierKey>('standard');
  const [note, setNote] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'nominal'>('percent');
  const [discountRaw, setDiscountRaw] = useState('');
  const [successRecord, setSuccessRecord] = useState<SaleRecord | null>(null);

  const setQty = (id: string, delta: number) => {
    setCart(prev => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  // Recipes enriched with pricing for current tier
  const menuItems = useMemo(() =>
    recipes.map(r => {
      const tiers = getPricingTiers(r.hpp);
      return { recipe: r, sellPrice: tiers[TIER_IDX[tier]].sellPrice };
    }),
    [recipes, tier],
  );

  const cartLines = useMemo(() =>
    menuItems
      .filter(m => (cart[m.recipe.id] ?? 0) > 0)
      .map(m => ({ ...m, qty: cart[m.recipe.id], subtotal: m.sellPrice * cart[m.recipe.id] })),
    [menuItems, cart],
  );

  const totals = useMemo(() => {
    const revenue = cartLines.reduce((s, l) => s + l.subtotal, 0);
    const hpp = cartLines.reduce((s, l) => s + l.recipe.hpp * l.qty, 0);
    return { revenue, hpp, profit: revenue - hpp };
  }, [cartLines]);

  const totalQty = cartLines.reduce((s, l) => s + l.qty, 0);

  function handleArchive() {
    archiveShift();
    setView('pos');
  }

  const isLoyaltyFree = selectedCustomer !== null && selectedCustomer.stamps >= 10;

  const discountAmount = useMemo(() => {
    if (isLoyaltyFree || cartLines.length === 0) return 0;
    const raw = parseNum(discountRaw);
    if (raw <= 0) return 0;
    if (discountType === 'percent') return Math.min(totals.revenue, totals.revenue * raw / 100);
    return Math.min(totals.revenue, raw);
  }, [isLoyaltyFree, cartLines.length, discountRaw, discountType, totals.revenue]);

  const effectiveRevenue = isLoyaltyFree ? 0 : Math.max(0, totals.revenue - discountAmount);
  const effectiveProfit = effectiveRevenue - totals.hpp;

  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = () => {
    if (cartLines.length === 0 || isProcessing) return;
    setIsProcessing(true);

    // Aggregate deductions across all cart items
    const deductionMap = new Map<string, { amount: number; unit: string }>();
    for (const { recipe, qty } of cartLines) {
      const batchSize = recipe.mode === 'batch' ? Math.max(1, parseNum(recipe.batchSize)) : 1;
      for (const ing of recipe.ingredients) {
        if (!ing.name.trim() || parseNum(ing.usage) === 0) continue;
        const perUnit = parseNum(ing.usage) / batchSize;
        const total = perUnit * qty;
        const existing = deductionMap.get(ing.name);
        if (existing) existing.amount += total;
        else deductionMap.set(ing.name, { amount: total, unit: ing.unit });
      }
    }

    const deductions = Array.from(deductionMap.entries())
      .map(([name, { amount }]) => ({ name, amount }));

    const txItems: StockTransactionItem[] = Array.from(deductionMap.entries())
      .map(([name, { amount, unit }]) => {
        const raw = rawIngredients.find(r => r.name === name);
        const before = raw?.currentStock ?? 0;
        return {
          ingredientName: name,
          delta: -amount,
          unit: unit as 'gr' | 'ml' | 'pcs',
          balanceBefore: before,
          balanceAfter: Math.max(0, before - amount),
        };
      });

    const record = addSaleRecord({
      tier,
      items: cartLines.map(l => ({
        recipeId: l.recipe.id,
        recipeName: l.recipe.name,
        qty: l.qty,
        sellPrice: isLoyaltyFree ? 0 : l.sellPrice,
        hpp: l.recipe.hpp,
        subtotal: isLoyaltyFree ? 0 : l.subtotal,
      })),
      totalRevenue: effectiveRevenue,
      totalHPP: totals.hpp,
      grossProfit: effectiveProfit,
      deductions: Array.from(deductionMap.entries()).map(([name, { amount, unit }]) => ({
        name,
        amount,
        unit: unit as 'gr' | 'ml' | 'pcs',
      })),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
      ...(isLoyaltyFree ? { loyaltyRedeemed: true } : {}),
      ...(discountAmount > 0 ? {
        discountType,
        discountValue: parseNum(discountRaw),
        discountAmount,
      } : {}),
    });

    if (deductions.length > 0) deductStock(deductions);
    if (txItems.length > 0) {
      addTransaction({
        note: `POS: ${cartLines.map(l => `${l.qty}× ${l.recipe.name}`).join(', ')}`,
        items: txItems,
      });
    }

    setTimeout(() => {
      if (selectedCustomer) {
        updateAfterOrder(selectedCustomer.id, totalQty, isLoyaltyFree);
      }
      setIsProcessing(false);
      setCart({});
      setNote('');
      setDiscountRaw('');
      setSelectedCustomer(null);
      setSuccessRecord(record);
    }, 400);
  };

  if (successRecord) {
    return (
      <div
        className="min-h-screen bg-[#F8F7F2]"
        style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
      >
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <SuccessScreen record={successRecord} onReset={() => setSuccessRecord(null)} />
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">

        {/* ── Tabs ── */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {([
            { key: 'pos',          icon: <Receipt size={13} />,  label: 'Kasir'       },
            { key: 'pelanggan',    icon: <Users size={13} />,    label: 'Pelanggan'   },
            { key: 'tutup-shift',  icon: <Archive size={13} />,  label: 'Tutup Shift' },
          ] as { key: ViewTab; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                view === key
                  ? 'bg-[#1A6B3C] text-white border-[#1A6B3C]'
                  : 'bg-white text-[#78716C] border-[#E5E3DD] hover:border-[#1A6B3C]/30'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {view === 'tutup-shift' ? (
          <ShiftClosing records={records} transactions={transactions} onArchive={handleArchive} />
        ) : view === 'pelanggan' ? (
          <CustomerTable customers={customers} onDelete={deleteCustomer} />
        ) : recipes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E3DD] p-12 shadow-sm text-center mt-4">
            <Receipt size={32} className="mx-auto text-[#C4BFBA] mb-3" />
            <p className="text-sm font-medium text-[#78716C]">Belum ada menu tersimpan</p>
            <p className="text-xs text-[#C4BFBA] mt-1 mb-5">
              Simpan resep di Kalkulator HPP terlebih dahulu.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white
                bg-[#1A6B3C] px-4 py-2.5 rounded-xl hover:bg-[#15593A] transition-colors"
            >
              Buka Kalkulator
            </Link>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start">

            {/* ── Menu grid ── */}
            <div>
              {/* Customer selector */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA] mb-1.5">
                  Pelanggan (Loyalty)
                </p>
                <CustomerSelector
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onSelect={setSelectedCustomer}
                  onAddNew={addCustomer}
                  isLoyaltyFree={isLoyaltyFree}
                />
              </div>

              {/* Tier selector */}
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs text-[#78716C] font-medium mr-1">Harga:</span>
                {(Object.keys(TIER_META) as TierKey[]).map(t => {
                  const m = TIER_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={tier === t
                        ? { background: m.bg, color: m.color, borderColor: m.border }
                        : { background: 'white', color: '#9CA3AF', borderColor: '#E5E3DD' }
                      }
                    >
                      {m.label} <span className="opacity-60">{m.margin}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {menuItems.map(({ recipe, sellPrice }) => {
                  const qty = cart[recipe.id] ?? 0;
                  const hasStock = recipe.ingredients.some(ing => {
                    const raw = rawIngredients.find(r => r.name === ing.name);
                    return raw?.currentStock !== undefined && raw.currentStock > 0;
                  });
                  const noStockData = !recipe.ingredients.some(ing =>
                    rawIngredients.find(r => r.name === ing.name)?.currentStock !== undefined
                  );

                  return (
                    <div
                      key={recipe.id}
                      className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col
                        transition-all duration-150"
                      style={{
                        borderColor: qty > 0 ? '#BBF7D0' : '#E5E3DD',
                        boxShadow: qty > 0 ? '0 0 0 2px #BBF7D050' : undefined,
                      }}
                    >
                      {/* Name & mode badge */}
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-sm font-bold text-[#1A1A18] leading-snug">{recipe.name}</p>
                        {recipe.mode === 'batch' && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                            bg-[#F3F4F6] text-[#6B7280]">
                            batch
                          </span>
                        )}
                      </div>

                      {/* Sell price */}
                      <p
                        className="text-xl font-bold text-[#1A6B3C] tabular-nums mt-1"
                        style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                      >
                        {formatRp(sellPrice)}
                      </p>
                      <p className="text-[10px] text-[#C4BFBA] mb-3">
                        HPP {formatRp(recipe.hpp)}
                      </p>

                      {/* Stock hint */}
                      {!noStockData && !hasStock && (
                        <div className="flex items-center gap-1 mb-2">
                          <AlertTriangle size={11} className="text-[#D97706]" />
                          <span className="text-[10px] text-[#D97706]">Stok menipis</span>
                        </div>
                      )}

                      {/* Qty counter */}
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(recipe.id, -1)}
                          disabled={qty === 0}
                          className="w-11 h-11 rounded-xl border border-[#E5E3DD] flex items-center justify-center
                            text-[#78716C] hover:bg-[#F0EDE8] disabled:opacity-30 disabled:cursor-not-allowed
                            transition-colors"
                        >
                          <Minus size={15} />
                        </button>

                        <span
                          className="text-lg font-bold tabular-nums w-8 text-center"
                          style={{
                            fontFamily: 'var(--font-bricolage, system-ui)',
                            color: qty > 0 ? '#1A1A18' : '#D1CBC3',
                          }}
                        >
                          {qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => setQty(recipe.id, 1)}
                          className="w-11 h-11 rounded-xl bg-[#1A6B3C] flex items-center justify-center
                            text-white hover:bg-[#15593A] transition-colors"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Order panel (desktop sticky) ── */}
            <div className="hidden lg:block lg:sticky lg:top-[73px]">
              <OrderPanel
                cartLines={cartLines}
                totals={{ revenue: effectiveRevenue, hpp: totals.hpp, profit: effectiveProfit }}
                totalQty={totalQty}
                isLoyaltyFree={isLoyaltyFree}
                discountType={discountType}
                discountRaw={discountRaw}
                discountAmount={discountAmount}
                onDiscountTypeChange={setDiscountType}
                onDiscountRawChange={setDiscountRaw}
                note={note}
                onNoteChange={setNote}
                onCheckout={handleCheckout}
                isProcessing={isProcessing}
                onSetQty={(id, qty) => setCart(prev => qty === 0 ? (() => { const { [id]: _, ...r } = prev; return r; })() : { ...prev, [id]: qty })}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile bottom bar ── */}
      {totalQty > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E3DD]
          px-4 py-3 z-30">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-[#78716C]">{totalQty} item
                {selectedCustomer && (
                  <span className="ml-2 font-semibold text-[#1A6B3C]">· {selectedCustomer.name}</span>
                )}
              </p>
              {isLoyaltyFree ? (
                <p className="text-lg font-bold text-[#1A6B3C] flex items-center gap-1.5">
                  <Gift size={14} /> GRATIS!
                </p>
              ) : (
                <p
                  className="text-lg font-bold text-[#1A1A18] tabular-nums"
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
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 bg-[#1A6B3C] text-white px-6 py-3
                rounded-xl font-semibold text-sm hover:bg-[#15593A] transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
              Selesaikan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header() {
  return <Navbar active="pos" />;
}

function OrderPanel({
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
}: {
  cartLines: { recipe: { id: string; name: string; hpp: number }; qty: number; sellPrice: number; subtotal: number }[];
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
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0EDE8] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">Pesanan</span>
        {totalQty > 0 && (
          <span className="text-xs font-bold bg-[#1A6B3C] text-white px-2 py-0.5 rounded-full">
            {totalQty}
          </span>
        )}
      </div>

      {cartLines.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <ShoppingBag size={24} className="mx-auto text-[#D1CBC3] mb-2" />
          <p className="text-sm text-[#C4BFBA]">Pilih menu di sebelah kiri</p>
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
                    className="w-11 h-11 rounded-xl border border-[#E5E3DD] flex items-center justify-center
                      text-[#78716C] hover:bg-[#F0EDE8] transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-sm font-bold tabular-nums w-5 text-center
                    text-[#1A1A18]">{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => onSetQty(line.recipe.id, line.qty + 1)}
                    className="w-6 h-6 rounded-md bg-[#F8F7F2] border border-[#E5E3DD] flex items-center
                      justify-center text-[#78716C] hover:bg-[#F0EDE8] transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </div>
                <span className="flex-1 text-sm text-[#1A1A18] truncate">{line.recipe.name}</span>
                <span className="text-sm font-semibold text-[#1A1A18] tabular-nums shrink-0">
                  {formatRp(line.subtotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-[#F0EDE8] space-y-2">
            {isLoyaltyFree && (
              <div className="flex items-center gap-2 bg-[#ECFDF5] border border-[#BBF7D0]
                rounded-xl px-3 py-2 mb-1">
                <Gift size={13} className="text-[#1A6B3C] shrink-0" />
                <span className="text-xs font-bold text-[#1A6B3C]">🎉 Loyalty reward! Cup ke-11 gratis</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#78716C]">HPP</span>
              <span className="tabular-nums text-[#78716C]">{formatRp(totals.hpp)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-[#DC2626]">
                <span>Diskon</span>
                <span className="tabular-nums">−{formatRp(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold" style={{
              color: totals.profit >= 0 ? '#1A6B3C' : '#DC2626',
            }}>
              <span>Estimasi Laba</span>
              <span className="tabular-nums">{formatRp(totals.profit)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-[#F0EDE8]">
              <span className="text-[#1A1A18]">Total</span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-bricolage, system-ui)',
                  color: isLoyaltyFree ? '#1A6B3C' : '#1A1A18',
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] block mb-1.5">
                  Diskon (opsional)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl overflow-hidden border border-[#E5E3DD] shrink-0">
                    {(['percent', 'nominal'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onDiscountTypeChange(t)}
                        className={`px-3 py-2 text-xs font-bold transition-colors ${
                          discountType === t ? 'bg-[#1A6B3C] text-white' : 'bg-white text-[#78716C]'
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
                    className="flex-1 bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                  />
                </div>
              </div>
            )}

            {/* Note field */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] block mb-1.5">
                Catatan (opsional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={e => onNoteChange(e.target.value)}
                placeholder="cth: event catering, meja 3..."
                className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
                  resize-none focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
                  placeholder:text-[#C4BFBA] text-[#1A1A18]"
              />
            </div>
            <button
              type="button"
              onClick={onCheckout}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#1A6B3C] text-white
                py-3 rounded-xl font-semibold text-sm hover:bg-[#15593A] transition-colors
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

// ─── CustomerSelector ────────────────────────────────────────────────────────

function CustomerSelector({
  customers, selectedCustomer, onSelect, onAddNew, isLoyaltyFree,
}: {
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelect: (c: Customer | null) => void;
  onAddNew: (name: string, phone: string) => Customer;
  isLoyaltyFree: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filtered = useMemo(() =>
    query.length === 0
      ? customers.slice(0, 6)
      : customers.filter(c =>
          c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
        ).slice(0, 6),
    [customers, query],
  );

  if (selectedCustomer) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E3DD] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#ECFDF5] flex items-center justify-center shrink-0 text-xs">
              👤
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A1A18]">{selectedCustomer.name}</p>
              {selectedCustomer.phone && (
                <p className="text-[10px] text-[#9CA3AF]">{selectedCustomer.phone}</p>
              )}
            </div>
            {isLoyaltyFree && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                bg-[#ECFDF5] text-[#1A6B3C]">
                <Gift size={9} /> GRATIS!
              </span>
            )}
          </div>
          <button type="button" onClick={() => onSelect(null)} className="text-[#C4BFBA] hover:text-[#78716C]">
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-0.5 mb-1">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ background: i < selectedCustomer.stamps ? '#1A6B3C' : '#F0EDE8' }}
            />
          ))}
        </div>
        <p className="text-[10px] text-[#9CA3AF]">
          {isLoyaltyFree
            ? '🎁 Cup ke-11 gratis! Selamat!'
            : `${selectedCustomer.stamps}/10 cup menuju hadiah`}
        </p>
      </div>
    );
  }

  if (addMode) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E3DD] p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA]">Pelanggan Baru</p>
        <input
          autoFocus
          placeholder="Nama pelanggan"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newName.trim()) {
              const c = onAddNew(newName, newPhone);
              onSelect(c);
              setAddMode(false); setNewName(''); setNewPhone('');
            }
          }}
          className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
        />
        <input
          placeholder="No WA (opsional)"
          value={newPhone}
          onChange={e => setNewPhone(e.target.value)}
          className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={() => {
              const c = onAddNew(newName, newPhone);
              onSelect(c);
              setAddMode(false); setNewName(''); setNewPhone('');
            }}
            className="flex-1 bg-[#1A6B3C] text-white rounded-xl py-2 text-sm font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Simpan & Pilih
          </button>
          <button
            type="button"
            onClick={() => { setAddMode(false); setNewName(''); setNewPhone(''); }}
            className="px-3 py-2 rounded-xl border border-[#E5E3DD] text-[#78716C] text-sm"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white rounded-xl border border-[#E5E3DD] px-3
        focus-within:border-[#1A6B3C] focus-within:ring-2 focus-within:ring-[#1A6B3C]/20 transition-all">
        <Search size={13} className="text-[#C4BFBA] shrink-0" />
        <input
          placeholder="Cari pelanggan..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-[#C4BFBA]
            text-[#1A1A18]"
        />
        <button
          type="button"
          onClick={() => setAddMode(true)}
          className="flex items-center gap-1 text-[10px] font-bold text-[#1A6B3C] shrink-0
            hover:text-[#15593A] transition-colors"
        >
          <UserPlus size={12} /> Baru
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E3DD]
          rounded-xl shadow-lg z-50 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#C4BFBA] text-center">
              {query ? 'Tidak ditemukan' : 'Belum ada pelanggan'}
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => { onSelect(c); setQuery(''); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8F7F2]
                  text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A18] truncate">{c.name}</p>
                  {c.phone && <p className="text-[10px] text-[#9CA3AF]">{c.phone}</p>}
                </div>
                <span
                  className="text-[10px] font-bold shrink-0"
                  style={{ color: c.stamps >= 10 ? '#1A6B3C' : '#9CA3AF' }}
                >
                  {c.stamps >= 10 ? '🎁 Gratis!' : `${c.stamps}/10 ☕`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── ShiftClosing ─────────────────────────────────────────────────────────────

function ShiftClosing({
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
      <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Archive size={14} className="text-[#1A6B3C]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">Tutup Shift</span>
        </div>
        <p className="text-sm text-[#78716C]">{dateStr}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { label: 'Omzet',        value: formatRp(omzet),           green: true  },
          { label: 'Total Profit', value: formatRp(totalProfit),     green: totalProfit > 0 },
          { label: 'Transaksi',    value: `${todayRecords.length}×`, green: false },
          { label: 'Item Terjual', value: `${totalItems} pcs`,       green: false },
        ] as { label: string; value: string; green: boolean }[]).map(({ label, value, green }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] mb-1">{label}</p>
            <p
              className="text-xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)', color: green ? '#1A6B3C' : '#1A1A18' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {topIngredients.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F0EDE8]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
              Bahan Paling Banyak Terpakai
            </span>
          </div>
          <div className="px-5 py-3 space-y-2">
            {topIngredients.map(([name, { amount, unit }]) => (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-[#78716C]">{name}</span>
                <span className="font-medium text-[#1A1A18] tabular-nums">
                  {amount % 1 === 0 ? amount : amount.toFixed(1)} {unit}
                </span>
              </div>
            ))}
          </div>
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
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-[#DC2626] text-center">
              Arsipkan {todayRecords.length} transaksi hari ini?
            </p>
            <p className="text-xs text-[#9CA3AF] text-center">
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
                className="flex-1 bg-white border border-[#E5E3DD] text-[#78716C] py-2.5
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
            className="w-full flex items-center justify-center gap-2 bg-white border border-[#E5E3DD]
              text-[#78716C] py-3 rounded-xl font-semibold text-sm
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

// ─── CustomerTable ────────────────────────────────────────────────────────────

function CustomerTable({
  customers, onDelete,
}: {
  customers: Customer[];
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() =>
    query
      ? customers.filter(c =>
          c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
        )
      : customers,
    [customers, query],
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F0EDE8]">
        <Users size={14} className="text-[#1A6B3C]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
          Database Pelanggan
        </span>
        <span className="ml-auto text-xs text-[#9CA3AF]">{customers.length} pelanggan</span>
      </div>

      <div className="px-5 py-3 border-b border-[#F0EDE8]">
        <div className="flex items-center gap-2 bg-[#F8F7F2] rounded-xl px-3">
          <Search size={13} className="text-[#C4BFBA] shrink-0" />
          <input
            placeholder="Cari nama atau No WA..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none text-[#1A1A18]
              placeholder:text-[#C4BFBA]"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users size={24} className="mx-auto text-[#C4BFBA] mb-2" />
          <p className="text-sm text-[#78716C]">Belum ada pelanggan terdaftar</p>
          <p className="text-xs text-[#C4BFBA] mt-1">
            Pilih atau tambah pelanggan di tab Kasir saat transaksi.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F0EDE8]">
                {['Nama', 'No WA', 'Pembelian', 'Stamp', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={`sticky top-0 z-10 bg-white px-5 py-3 text-[10px] font-bold
                      uppercase tracking-wider text-[#C4BFBA]
                      ${i >= 2 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const isDeleting = deletingId === c.id;
                return (
                  <tr key={c.id} className="border-b border-[#F0EDE8] last:border-0 hover:bg-[#FAFAF9]">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[#1A1A18]">{c.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-[#78716C]">{c.phone || '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-medium text-[#1A1A18] tabular-nums">
                        {c.totalOrders}×
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.stamps >= 10 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                          bg-[#ECFDF5] text-[#1A6B3C]">
                          🎁 Gratis!
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <div className="flex gap-0.5 w-20">
                            {Array.from({ length: 10 }, (_, i) => (
                              <div
                                key={i}
                                className="flex-1 h-1 rounded-full"
                                style={{ background: i < c.stamps ? '#1A6B3C' : '#F0EDE8' }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] text-[#C4BFBA]">{c.stamps}/10</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-[11px] text-[#78716C]">Hapus?</span>
                          <button
                            type="button"
                            onClick={() => { onDelete(c.id); setDeletingId(null); }}
                            className="text-[11px] font-semibold text-white bg-[#DC2626]
                              px-2 py-1 rounded-lg"
                          >
                            Ya
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="text-[11px] font-semibold text-[#78716C] bg-[#F3F4F6]
                              px-2 py-1 rounded-lg"
                          >
                            Tidak
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(c.id)}
                          className="text-[#C4BFBA] hover:text-[#DC2626] transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
