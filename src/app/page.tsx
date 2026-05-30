'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Receipt,
  X,
  Archive,
  Users,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { getPricingTiers } from '@/lib/engine';
import { parseNum } from '@/lib/format';
import { useCustomers } from '@/hooks/useCustomers';
import { useCustomerStore } from '@/store/customerStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useAuthStore } from '@/store/authStore';
import { logActivity } from '@/lib/logger';
import { printReceipt } from '@/lib/printer';
import { sendReceipt } from '@/lib/whatsapp';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';
import type { Customer, SaleRecord, StockTransactionItem } from '@/types/hpp';
import { SuccessScreen } from '@/features/pos/components/SuccessScreen';
import { OrderPanel } from '@/features/pos/components/OrderPanel';
import { CustomerSelector } from '@/features/pos/components/CustomerSelector';
import { ShiftClosing } from '@/features/pos/components/ShiftClosing';
import { CustomerTable } from '@/features/pos/components/CustomerTable';
import { IngredientMappingEditor } from '@/features/pos/components/IngredientMappingEditor';
import { MobileCartSheet } from '@/features/pos/components/MobileCartSheet';
import { MenuItemCard } from '@/features/pos/components/MenuItemCard';

type TierKey = 'competitive' | 'standard' | 'premium';
type ViewTab = 'pos' | 'pelanggan' | 'tutup-shift';
type Cart = Record<string, number>;

const TIER_IDX: Record<TierKey, number> = { competitive: 0, standard: 1, premium: 2 };
const TIER_META: Record<TierKey, { label: string; margin: string; color: string; bg: string; border: string }> = {
  competitive: { label: 'Kompetitif', margin: '20%', color: 'var(--text-2)', bg: 'var(--surface)',  border: 'var(--border)' },
  standard:    { label: 'Standar',    margin: '35%', color: '#F59E0B', bg: 'var(--tint-amber)',  border: '#065F46' },
  premium:     { label: 'Premium',    margin: '50%', color: '#FB923C', bg: '#1A0900',  border: '#9A3412' },
};

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
        <Navbar active="pos" />
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
      <Navbar active="pos" />

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
                    <MenuItemCard
                      key={recipe.id}
                      recipe={recipe}
                      sellPrice={sellPrice}
                      qty={qty}
                      hasStock={hasStock}
                      noStockData={noStockData}
                      onAdd={() => setQty(recipe.id, 1)}
                      onIncrement={() => setQty(recipe.id, 1)}
                      onDecrement={() => setQty(recipe.id, -1)}
                      onEditMapping={() => setEditingMapping(recipe.id)}
                    />
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
        <MobileCartSheet
          cartLines={cartLines}
          totalQty={totalQty}
          isLoyaltyFree={isLoyaltyFree}
          effectiveRevenue={effectiveRevenue}
          totalsHpp={totals.hpp}
          discountAmount={discountAmount}
          discountType={discountType}
          discountRaw={discountRaw}
          note={note}
          paymentMethod={paymentMethod}
          isProcessing={isProcessing}
          isOpen={mobileSheetOpen}
          selectedCustomerName={selectedCustomer?.name}
          onToggleOpen={() => setMobileSheetOpen(v => !v)}
          onClose={() => setMobileSheetOpen(false)}
          onSetCart={setCart}
          onDiscountTypeChange={setDiscountType}
          onDiscountRawChange={setDiscountRaw}
          onNoteChange={setNote}
          onPaymentMethodChange={setPaymentMethod}
          onCheckout={handleCheckout}
        />
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
