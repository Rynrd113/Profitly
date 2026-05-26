'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Minus, ShoppingBag,
  CheckCircle2, RotateCcw, Receipt, AlertTriangle, Loader2,
  Users, UserPlus, Search, Gift, X, Trash2,
  Archive, MessageCircle, Printer, Settings,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { getPricingTiers } from '@/lib/engine';
import { parseNum, formatRp } from '@/lib/format';
import { useCustomers } from '@/hooks/useCustomers';
import { useCustomerStore } from '@/store/customerStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';
import { logActivity } from '@/lib/logger';
import { printReceipt } from '@/lib/printer';
import { sendReceipt } from '@/lib/whatsapp';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';
import type { SaleRecord, StockTransaction, StockTransactionItem, Customer, SavedRecipe } from '@/types/hpp';

type TierKey = 'competitive' | 'standard' | 'premium';
type ViewTab = 'pos' | 'pelanggan' | 'tutup-shift';
type Cart = Record<string, number>;

const TIER_IDX: Record<TierKey, number> = { competitive: 0, standard: 1, premium: 2 };
const TIER_META: Record<TierKey, { label: string; margin: string; color: string; bg: string; border: string }> = {
  competitive: { label: 'Kompetitif', margin: '20%', color: 'var(--text-2)', bg: 'var(--surface)',  border: 'var(--border)' },
  standard:    { label: 'Standar',    margin: '35%', color: '#F59E0B', bg: 'var(--tint-amber)',  border: '#065F46' },
  premium:     { label: 'Premium',    margin: '50%', color: '#FB923C', bg: '#1A0900',  border: '#9A3412' },
};

// ─── Success screen ──────────────────────────────────────────────────────────

function SuccessScreen({
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

// ─── Main POS page ───────────────────────────────────────────────────────────

export default function POSPage() {
  const { recipes, patchRecipe } = useSavedRecipes();
  const { ingredients: rawIngredients, deductStock } = useSavedRawIngredients();
  const { transactions, add: addTransaction } = useStockTransactions();
  const { records, add: addSaleRecord, archiveShift } = useSalesRecords();

  const { customers, addCustomer, updateAfterOrder, deleteCustomer } = useCustomers();
  const { upsertCustomer } = useCustomerStore();
  const { reduceStock } = useInventoryStore();
  const { userRole } = useAuthStore();
  const { profile: businessProfile } = useSettingsStore();
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
    toast.success('Shift berhasil ditutup dan diarsipkan');
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

  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS'>('CASH');
  const [editingMapping, setEditingMapping] = useState<string | null>(null);

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
        portionUnit: l.recipe.portionUnit,
      })),
      totalRevenue: effectiveRevenue,
      totalHPP: totals.hpp,
      grossProfit: effectiveProfit,
      paymentMethod,
      deductions: Array.from(deductionMap.entries()).map(([name, { amount, unit }]) => ({
        name,
        amount,
        unit: unit as 'gr' | 'ml' | 'pcs',
      })),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(selectedCustomer ? {
        customerId: selectedCustomer.id,
        customerPhone: selectedCustomer.phone,
        customerName: selectedCustomer.name,
      } : {}),
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

    // Sync inventory via recipe-level ingredient mapping (ID-based)
    const inventoryDeductions = cartLines.flatMap(({ recipe, qty }) =>
      (recipe.inventoryIngredients ?? []).map(({ inventoryId, quantity }) => ({
        id: inventoryId,
        amount: quantity * qty,
      }))
    );
    if (inventoryDeductions.length > 0) reduceStock(inventoryDeductions);

    logActivity(`SALE:${record.id}`, userRole);

    setTimeout(() => {
      if (selectedCustomer) {
        updateAfterOrder(selectedCustomer.id, totalQty, isLoyaltyFree);
      }
      if (checkoutPhone.trim()) {
        upsertCustomer(checkoutName, checkoutPhone, effectiveRevenue);
      }
      setIsProcessing(false);
      setCart({});
      setNote('');
      setDiscountRaw('');
      setCheckoutName('');
      setCheckoutPhone('');
      setSelectedCustomer(null);
      setMobileSheetOpen(false);
      setPaymentMethod('CASH');
      setSuccessRecord(record);
    }, 400);
  };

  if (successRecord) {
    return (
      <div
        className="min-h-screen bg-[var(--bg)]"
        style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
      >
        <Header />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <SuccessScreen
            record={successRecord}
            onReset={() => setSuccessRecord(null)}
            onPrint={() => printReceipt(successRecord, businessProfile)}
            onWhatsApp={successRecord.customerPhone
              ? () => sendReceipt(successRecord.customerPhone!, successRecord)
              : undefined}
          />
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--bg)]"
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
                  ? 'bg-[#27B18A] text-white border-[#27B18A]'
                  : 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:border-[#27B18A]/30'
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
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 shadow-sm text-center mt-4">
            <Receipt size={32} className="mx-auto text-[var(--text-4)] mb-3" />
            <p className="text-sm font-medium text-[var(--text-2)]">Belum ada menu</p>
            <p className="text-xs text-[var(--text-4)] mt-1 mb-5">
              Simpan resep dari Kalkulator HPP untuk mulai berjualan.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white
                bg-[#27B18A] px-4 py-2.5 rounded-xl hover:bg-[#0E927A] transition-colors"
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] mb-1.5">
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
                <span className="text-xs text-[var(--text-2)] font-medium mr-1">Harga:</span>
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
                        : { background: 'var(--bg)', color: 'var(--text-4)', borderColor: 'var(--border-subtle)' }
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
                      role="button"
                      tabIndex={0}
                      onClick={() => setQty(recipe.id, 1)}
                      onKeyDown={e => e.key === 'Enter' && setQty(recipe.id, 1)}
                      className="bg-[var(--surface)] rounded-2xl border shadow-sm p-4 flex flex-col
                        transition-all duration-150 cursor-pointer hover:border-[#27B18A]/50"
                      style={{
                        borderColor: qty > 0 ? '#9A3412' : 'var(--border)',
                        boxShadow: qty > 0 ? '0 0 0 2px #9A341250' : undefined,
                      }}
                    >
                      {/* Name & mode badge */}
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-sm font-bold text-[var(--text)] leading-snug">{recipe.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setEditingMapping(recipe.id); }}
                            className="w-5 h-5 flex items-center justify-center rounded text-[var(--text-4)]
                              hover:text-[#27B18A] transition-colors"
                            title="Atur bahan baku"
                          >
                            <Settings size={11} />
                          </button>
                          {recipe.mode === 'batch' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                              bg-[var(--surface)] text-[var(--text-2)]">
                              batch
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Sell price */}
                      <p
                        className="text-xl font-bold text-[#27B18A] tabular-nums mt-1"
                        style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
                      >
                        {formatRp(sellPrice)}
                        {recipe.portionUnit && recipe.portionUnit !== 'porsi' && (
                          <span className="text-[11px] font-normal text-[var(--text-3)] ml-1">
                            /{recipe.portionUnit}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--text-4)] mb-3">
                        HPP {formatRp(recipe.hpp)}
                      </p>

                      {/* Stock hint */}
                      {!noStockData && !hasStock && (
                        <div className="flex items-center gap-1 mb-2">
                          <AlertTriangle size={11} className="text-[#27B18A]" />
                          <span className="text-[10px] text-[#27B18A]">Stok menipis</span>
                        </div>
                      )}

                      {/* Qty counter */}
                      <div className="mt-auto flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.88 }}
                          onClick={() => setQty(recipe.id, -1)}
                          disabled={qty === 0}
                          className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center
                            text-[var(--text-2)] hover:bg-[var(--surface)] disabled:opacity-30 disabled:cursor-not-allowed
                            transition-colors"
                        >
                          <Minus size={15} />
                        </motion.button>

                        <span
                          className="text-lg font-bold tabular-nums w-8 text-center"
                          style={{
                            fontFamily: 'var(--font-bricolage, system-ui)',
                            color: qty > 0 ? 'var(--text)' : '#A7C4BC',
                          }}
                        >
                          {qty}
                        </span>

                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.88 }}
                          onClick={() => setQty(recipe.id, 1)}
                          className="w-11 h-11 rounded-xl bg-[#27B18A] flex items-center justify-center
                            text-white hover:bg-[#0E927A] transition-colors"
                        >
                          <Plus size={15} />
                        </motion.button>
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
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                checkoutName={checkoutName}
                checkoutPhone={checkoutPhone}
                onCheckoutNameChange={setCheckoutName}
                onCheckoutPhoneChange={setCheckoutPhone}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile bottom bar + sheet ── */}
      {totalQty > 0 && (
        <>
          {/* Backdrop */}
          {mobileSheetOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/30 z-30"
              onClick={() => setMobileSheetOpen(false)}
            />
          )}

          {/* Sheet */}
          <div
            className={`lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] z-40 transition-all duration-300
              ${mobileSheetOpen ? 'rounded-t-2xl' : ''}`}
            style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.10)' }}
          >
            {/* Drag handle / header tap area */}
            {mobileSheetOpen && (
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                className="w-full flex flex-col items-center pt-3 pb-2"
              >
                <span className="w-10 h-1 bg-[var(--border)] rounded-full" />
              </button>
            )}

            {/* Expanded sheet content */}
            {mobileSheetOpen && (
              <div className="px-4 pb-2 max-h-[70vh] overflow-y-auto">
                {/* Cart lines */}
                <div className="space-y-2 mb-3">
                  {cartLines.map(line => (
                    <div key={line.recipe.id} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCart(prev => {
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
                          onClick={() => setCart(prev => ({ ...prev, [line.recipe.id]: (prev[line.recipe.id] ?? 0) + 1 }))}
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
                            onClick={() => setDiscountType(t)}
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
                        onChange={e => setDiscountRaw(e.target.value)}
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
                    onChange={e => setNote(e.target.value)}
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
                        onClick={() => setPaymentMethod(m)}
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
                    <span className="tabular-nums">{formatRp(totals.hpp)}</span>
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
                  onClick={() => setMobileSheetOpen(v => !v)}
                  className="flex-1 text-left"
                >
                  <p className="text-xs text-[var(--text-2)]">{totalQty} item
                    {selectedCustomer && (
                      <span className="ml-2 font-semibold text-[#27B18A]">· {selectedCustomer.name}</span>
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
                  onClick={handleCheckout}
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
      )}

      {/* ── Ingredient mapping modal ── */}
      {editingMapping !== null && (() => {
        const recipe = recipes.find(r => r.id === editingMapping);
        if (!recipe) return null;
        const catalogNames = rawIngredients.map(i => i.name);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div
              className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 max-w-sm w-full shadow-xl"
              style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">Bahan Baku</p>
                  <p className="text-base font-bold text-[var(--text)] mt-0.5">{recipe.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMapping(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-4)]
                    hover:bg-[var(--bg)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <IngredientMappingEditor
                key={recipe.id}
                recipe={recipe}
                catalogNames={catalogNames}
                onSave={mappings => {
                  patchRecipe(recipe.id, { inventoryIngredients: mappings });
                  setEditingMapping(null);
                  toast.success(`Mapping "${recipe.name}" disimpan`);
                }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Ingredient mapping editor ────────────────────────────────────────────────

function IngredientMappingEditor({
  recipe,
  catalogNames,
  onSave,
}: {
  recipe: SavedRecipe;
  catalogNames: string[];
  onSave: (mappings: Array<{ inventoryId: string; quantity: number }>) => void;
}) {
  const [rows, setRows] = useState<Array<{ inventoryId: string; quantity: number }>>(
    recipe.inventoryIngredients?.map(x => ({ ...x })) ?? []
  );

  const addRow = () => setRows(r => [...r, { inventoryId: catalogNames[0] ?? '', quantity: 0 }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'inventoryId' | 'quantity', val: string) =>
    setRows(r => r.map((row, idx) => idx !== i ? row : {
      ...row,
      [field]: field === 'quantity' ? Math.max(0, Number(val)) : val,
    }));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-[var(--text-4)] italic">
          Belum ada bahan. Tambahkan agar stok berkurang otomatis saat transaksi.
        </p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={row.inventoryId}
            onChange={e => update(i, 'inventoryId', e.target.value)}
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A] text-[var(--text)]"
          >
            {catalogNames.length === 0
              ? <option value="">— Belum ada bahan —</option>
              : catalogNames.map(n => <option key={n} value={n}>{n}</option>)
            }
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={row.quantity || ''}
            onChange={e => update(i, 'quantity', e.target.value)}
            placeholder="Qty"
            className="w-20 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
              text-[var(--text)] text-right"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#DC2626]
              hover:bg-[var(--tint-red)] transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addRow}
          disabled={catalogNames.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            border border-[var(--border)] text-[var(--text-2)] hover:border-[#27B18A]/40
            hover:text-[#27B18A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={12} /> Tambah
        </button>
        <button
          type="button"
          onClick={() => onSave(rows.filter(r => r.inventoryId && r.quantity > 0))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
            bg-[#27B18A] text-white hover:bg-[#0E927A] transition-colors"
        >
          Simpan
        </button>
      </div>
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
  paymentMethod,
  onPaymentMethodChange,
  checkoutName,
  checkoutPhone,
  onCheckoutNameChange,
  onCheckoutPhoneChange,
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
  paymentMethod: 'CASH' | 'QRIS';
  onPaymentMethodChange: (m: 'CASH' | 'QRIS') => void;
  checkoutName: string;
  checkoutPhone: string;
  onCheckoutNameChange: (v: string) => void;
  onCheckoutPhoneChange: (v: string) => void;
}) {
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
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[var(--tint-amber)] flex items-center justify-center shrink-0 text-xs">
              👤
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text)]">{selectedCustomer.name}</p>
              {selectedCustomer.phone && (
                <p className="text-[10px] text-[var(--text-3)]">{selectedCustomer.phone}</p>
              )}
            </div>
            {isLoyaltyFree && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                bg-[var(--tint-amber)] text-[#27B18A]">
                <Gift size={9} /> GRATIS!
              </span>
            )}
          </div>
          <button type="button" onClick={() => onSelect(null)} className="text-[var(--text-4)] hover:text-[var(--text-2)]">
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-0.5 mb-1">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{ background: i < selectedCustomer.stamps ? '#27B18A' : 'var(--surface)' }}
            />
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-3)]">
          {isLoyaltyFree
            ? '🎁 Cup ke-11 gratis! Selamat!'
            : `${selectedCustomer.stamps}/10 cup menuju hadiah`}
        </p>
      </div>
    );
  }

  if (addMode) {
    return (
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">Pelanggan Baru</p>
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
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
        />
        <input
          placeholder="No WA (opsional)"
          value={newPhone}
          onChange={e => setNewPhone(e.target.value)}
          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
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
            className="flex-1 bg-[#27B18A] text-white rounded-xl py-2 text-sm font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Simpan & Pilih
          </button>
          <button
            type="button"
            onClick={() => { setAddMode(false); setNewName(''); setNewPhone(''); }}
            className="px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] text-sm"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[var(--surface)] rounded-xl border border-[var(--border)] px-3
        focus-within:border-[#27B18A] focus-within:ring-2 focus-within:ring-[#27B18A]/20 transition-all">
        <Search size={13} className="text-[var(--text-4)] shrink-0" />
        <input
          placeholder="Cari pelanggan..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-[var(--text-4)]
            text-[var(--text)]"
        />
        <button
          type="button"
          onClick={() => setAddMode(true)}
          className="flex items-center gap-1 text-[10px] font-bold text-[#27B18A] shrink-0
            hover:text-[#0E927A] transition-colors"
        >
          <UserPlus size={12} /> Baru
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface)] border border-[var(--border)]
          rounded-xl shadow-lg z-50 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--text-4)] text-center">
              {query ? 'Tidak ditemukan' : 'Belum ada pelanggan'}
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => { onSelect(c); setQuery(''); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg)]
                  text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{c.name}</p>
                  {c.phone && <p className="text-[10px] text-[var(--text-3)]">{c.phone}</p>}
                </div>
                <span
                  className="text-[10px] font-bold shrink-0"
                  style={{ color: c.stamps >= 10 ? '#27B18A' : 'var(--text-3)' }}
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
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
        <Users size={14} className="text-[#27B18A]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
          Database Pelanggan
        </span>
        <span className="ml-auto text-xs text-[var(--text-3)]">{customers.length} pelanggan</span>
      </div>

      <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 bg-[var(--bg)] rounded-xl px-3">
          <Search size={13} className="text-[var(--text-4)] shrink-0" />
          <input
            placeholder="Cari nama atau No WA..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 py-2 text-sm bg-transparent focus:outline-none text-[var(--text)]
              placeholder:text-[var(--text-4)]"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users size={24} className="mx-auto text-[var(--text-4)] mb-2" />
          <p className="text-sm text-[var(--text-2)]">Belum ada pelanggan terdaftar</p>
          <p className="text-xs text-[var(--text-4)] mt-1">
            Pilih atau tambah pelanggan di tab Kasir saat transaksi.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {['Nama', 'No WA', 'Pembelian', 'Stamp', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={`sticky top-0 z-10 bg-[var(--surface)] px-5 py-3 text-[10px] font-bold
                      uppercase tracking-wider text-[var(--text-4)]
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
                  <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[var(--text)]">{c.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-[var(--text-2)]">{c.phone || '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-medium text-[var(--text)] tabular-nums">
                        {c.totalOrders}×
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.stamps >= 10 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                          bg-[var(--tint-amber)] text-[#27B18A]">
                          🎁 Gratis!
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <div className="flex gap-0.5 w-20">
                            {Array.from({ length: 10 }, (_, i) => (
                              <div
                                key={i}
                                className="flex-1 h-1 rounded-full"
                                style={{ background: i < c.stamps ? '#27B18A' : 'var(--surface)' }}
                              />
                            ))}
                          </div>
                          <span className="text-[9px] text-[var(--text-4)]">{c.stamps}/10</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-[11px] text-[var(--text-2)]">Hapus?</span>
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
                            className="text-[11px] font-semibold text-[var(--text-2)] bg-[var(--surface)]
                              px-2 py-1 rounded-lg"
                          >
                            Tidak
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(c.id)}
                          className="text-[var(--text-4)] hover:text-[#DC2626] transition-colors"
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
