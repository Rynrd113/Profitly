'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Package, ShoppingCart, History, AlertTriangle,
  CheckCircle, Edit2, X, Check, Plus, Minus,
  Bell, BellOff, Copy, CheckCheck, Loader2,
  TrendingUp, ChevronDown, ChevronUp, PackagePlus,
} from 'lucide-react';
import { parseNum, formatRp } from '@/lib/format';
import { toast } from 'sonner';
import type { SavedRawIngredient, SavedRecipe, StockTransaction, StockTransactionItem, PriceHistoryEntry } from '@/types/hpp';

interface Props {
  savedRawIngredients: SavedRawIngredient[];
  savedRecipes: SavedRecipe[];
  onSetStockLevel: (name: string, currentStock: number, minStock: number) => void;
  onDeductStock: (deductions: { name: string; amount: number }[]) => void;
  transactions: StockTransaction[];
  onAddTransaction: (tx: Omit<StockTransaction, 'id' | 'timestamp'>) => void;
  onRestock: (name: string, qtyIn: number, newPrice: number, newVolume: number) => boolean;
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#27B18A]">{icon}</span>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text)]">{label}</h2>
    </div>
  );
}

function StockBadge({ current, min }: { current?: number; min?: number }) {
  if (current === undefined) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-3)] font-medium">
        Belum diatur
      </span>
    );
  }
  if (current === 0) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tint-red)] text-[#DC2626] font-medium">
        Habis
      </span>
    );
  }
  if (min !== undefined && current < min) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tint-amber)] text-[#27B18A] font-medium">
        Menipis
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--tint-amber)] text-[#27B18A] font-medium">
      Aman
    </span>
  );
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PriceHistoryPanel({ entries, unit }: { entries: PriceHistoryEntry[]; unit: string }) {
  const sorted = [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return (
    <div className="mt-1 mx-1 mb-2 bg-[var(--tint-amber-deep)] border border-[#065F46] rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp size={12} className="text-[#27B18A]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#27B18A]">
          Riwayat Harga Beli
        </span>
      </div>
      <div className="relative pl-4">
        {/* vertical line */}
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-[#065F46]" />
        <div className="space-y-3">
          {sorted.map((entry, i) => {
            const isLatest = i === sorted.length - 1;
            const prevEntry = i > 0 ? sorted[i - 1] : null;
            const pricePerUnit = entry.volume > 0 ? entry.price / entry.volume : 0;
            const prevPpu = prevEntry && prevEntry.volume > 0 ? prevEntry.price / prevEntry.volume : null;
            const pctChange = prevPpu && prevPpu > 0
              ? ((pricePerUnit - prevPpu) / prevPpu) * 100
              : null;

            return (
              <div key={entry.recordedAt + i} className="relative">
                {/* dot */}
                <div className={`absolute -left-3.5 top-1 w-2.5 h-2.5 rounded-full border-2 ${
                  isLatest ? 'bg-[#27B18A] border-[#27B18A]' : 'bg-[var(--surface)] border-[#065F46]'
                }`} />
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div>
                    <p className="text-xs font-semibold text-[var(--text)]">
                      Rp {entry.price.toLocaleString('id-ID')} / {entry.volume.toLocaleString('id-ID')} {unit}
                    </p>
                    <p className="text-[10px] text-[var(--text-3)] mt-0.5">
                      {formatShortDate(entry.recordedAt)}
                      {isLatest && (
                        <span className="ml-1.5 text-[#27B18A] font-semibold">• sekarang</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[var(--text-2)]">
                      Rp {pricePerUnit.toFixed(2)} / {unit}
                    </p>
                    {pctChange !== null && (
                      <p className={`text-[10px] font-semibold mt-0.5 ${
                        pctChange > 0 ? 'text-[#DC2626]' : pctChange < 0 ? 'text-[#27B18A]' : 'text-[var(--text-3)]'
                      }`}>
                        {pctChange > 0 ? '▲' : pctChange < 0 ? '▼' : '—'}
                        {Math.abs(pctChange).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StockManagement({
  savedRawIngredients,
  savedRecipes,
  onSetStockLevel,
  onDeductStock,
  transactions,
  onAddTransaction,
  onRestock,
}: Props) {
  const [restockModal, setRestockModal] = useState(false);

  useEffect(() => {
    if (!restockModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setRestockModal(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [restockModal]);

  const [rstName, setRstName] = useState('');
  const [rstQty, setRstQty] = useState('');
  const [rstPrice, setRstPrice] = useState('');
  const [rstVolume, setRstVolume] = useState('');
  const [rstLoading, setRstLoading] = useState(false);

  function openRestock(name = '') {
    const ing = savedRawIngredients.find(x => x.name === name);
    setRstName(name);
    setRstQty('');
    setRstPrice(ing ? String(ing.purchasePrice) : '');
    setRstVolume(ing ? String(ing.purchaseVolume) : '');
    setRestockModal(true);
  }

  function handleRestockNameChange(name: string) {
    setRstName(name);
    const ing = savedRawIngredients.find(x => x.name === name);
    if (ing) { setRstPrice(String(ing.purchasePrice)); setRstVolume(String(ing.purchaseVolume)); }
    else { setRstPrice(''); setRstVolume(''); }
  }

  function handleRestockSubmit() {
    const qtyIn = parseNum(rstQty);
    const newPrice = parseNum(rstPrice);
    const newVolume = parseNum(rstVolume);
    if (!rstName || qtyIn <= 0 || newPrice <= 0 || newVolume <= 0) {
      toast.error('Lengkapi semua data dengan benar');
      return;
    }
    setRstLoading(true);
    const ing = savedRawIngredients.find(x => x.name === rstName);
    const stockBefore = ing?.currentStock ?? 0;
    const priceChanged = onRestock(rstName, qtyIn, newPrice, newVolume);
    onAddTransaction({
      note: `RESTOCK: ${rstName}`,
      items: [{
        ingredientName: rstName,
        delta: qtyIn,
        unit: (ing?.unit ?? 'pcs') as 'gr' | 'ml' | 'pcs',
        balanceBefore: stockBefore,
        balanceAfter: stockBefore + qtyIn,
      }],
    });
    setTimeout(() => {
      setRstLoading(false);
      setRestockModal(false);
      setRstName(''); setRstQty(''); setRstPrice(''); setRstVolume('');
      toast.success(
        priceChanged
          ? `Restock berhasil · HPP resep diperbarui otomatis`
          : `Restock ${rstName} +${qtyIn} ${ing?.unit ?? ''} berhasil`
      );
    }, 350);
  }

  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editCurrent, setEditCurrent] = useState('');
  const [editMin, setEditMin] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [saleQty, setSaleQty] = useState('1');
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [isCatatingPenjualan, setIsCatatPenjualan] = useState(false);

  // Smart Alert state
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | null>(null);
  const [alertToast, setAlertToast] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const prevStockRef = useRef<Map<string, number>>(new Map());

  // Read notification permission after mount (window not available during SSR)
  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  // Detect when stock newly crosses below minStock → in-app toast + browser notification
  useEffect(() => {
    const newAlerts: string[] = [];
    for (const item of savedRawIngredients) {
      if (item.currentStock === undefined || item.minStock === undefined) continue;
      const prev = prevStockRef.current.get(item.name);
      if (prev !== undefined && prev > item.minStock && item.currentStock <= item.minStock) {
        newAlerts.push(item.name);
      }
      prevStockRef.current.set(item.name, item.currentStock);
    }
    if (newAlerts.length === 0) return;

    setAlertToast(newAlerts);
    const timer = setTimeout(() => setAlertToast([]), 6000);

    if ('Notification' in window && Notification.permission === 'granted') {
      const body = newAlerts.map(name => {
        const it = savedRawIngredients.find(i => i.name === name);
        return it ? `${it.name}: ${it.currentStock} ${it.unit}` : name;
      }).join('\n');
      new Notification('⚠️ Stok Menipis — ProfitLy', { body, icon: '/icon-192.png' });
    }

    return () => clearTimeout(timer);
  }, [savedRawIngredients]);

  const handleRequestNotifPerm = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const handleCopyShoppingList = async () => {
    const emptyItems = lowStockItems.filter(i => (i.currentStock ?? 0) === 0);
    const lowItems   = lowStockItems.filter(i => (i.currentStock ?? 0) > 0);
    const date = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const lines: string[] = [`🛒 *Daftar Belanja*`, `📅 ${date}`, ''];
    if (emptyItems.length > 0) {
      lines.push('❌ *Habis:*');
      emptyItems.forEach(i => lines.push(`• ${i.name} (butuh min: ${i.minStock} ${i.unit})`));
      lines.push('');
    }
    if (lowItems.length > 0) {
      lines.push('⚠️ *Menipis:*');
      lowItems.forEach(i =>
        lines.push(`• ${i.name}: sisa ${i.currentStock} ${i.unit} (min: ${i.minStock} ${i.unit})`),
      );
      lines.push('');
    }
    lines.push('_Dikirim dari ProfitLy_ 🌿');

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      const el = document.createElement('textarea');
      el.value = lines.join('\n');
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const stockValuation = useMemo(() => {
    const items = savedRawIngredients
      .filter(item => item.currentStock !== undefined && item.purchaseVolume > 0)
      .map(item => ({
        name: item.name,
        unit: item.unit,
        currentStock: item.currentStock!,
        pricePerUnit: item.purchasePrice / item.purchaseVolume,
        value: item.currentStock! * (item.purchasePrice / item.purchaseVolume),
      }))
      .sort((a, b) => b.value - a.value);

    return {
      items,
      totalValue: items.reduce((sum, i) => sum + i.value, 0),
      trackedCount: items.length,
      totalCount: savedRawIngredients.length,
    };
  }, [savedRawIngredients]);

  const lowStockItems = savedRawIngredients.filter(
    item => item.currentStock !== undefined
      && item.minStock !== undefined
      && item.currentStock < item.minStock,
  );

  const selectedRecipe = savedRecipes.find(r => r.id === selectedRecipeId) ?? null;

  const deductionPreview = useMemo(() => {
    if (!selectedRecipe) return [];
    const qty = Math.max(1, parseNum(saleQty));
    const batchSize = selectedRecipe.mode === 'batch'
      ? Math.max(1, parseNum(selectedRecipe.batchSize))
      : 1;

    return selectedRecipe.ingredients
      .filter(ing => ing.name.trim() && parseNum(ing.usage) > 0)
      .map(ing => {
        const usagePerUnit = parseNum(ing.usage) / batchSize;
        const totalDeduct = usagePerUnit * qty;
        const catalogItem = savedRawIngredients.find(s => s.name === ing.name);
        const stockBefore = catalogItem?.currentStock;
        return {
          name: ing.name,
          unit: ing.unit,
          totalDeduct,
          stockBefore,
          inCatalog: !!catalogItem,
          willEmpty: stockBefore !== undefined && stockBefore < totalDeduct,
        };
      });
  }, [selectedRecipe, saleQty, savedRawIngredients]);

  const handleStartEdit = (item: SavedRawIngredient) => {
    setEditingName(item.name);
    setEditCurrent(item.currentStock !== undefined ? String(item.currentStock) : '');
    setEditMin(item.minStock !== undefined ? String(item.minStock) : '');
  };

  const handleSaveEdit = () => {
    if (!editingName || isSavingEdit) return;
    const rawCurrent = parseNum(editCurrent);
    const rawMin = parseNum(editMin);
    if (rawCurrent < 0 || rawMin < 0) {
      toast.error('Stok tidak bisa bernilai negatif');
      return;
    }
    setIsSavingEdit(true);
    const newCurrent = rawCurrent;
    const newMin = rawMin;
    const prevItem = savedRawIngredients.find(x => x.name === editingName);
    const prevStock = prevItem?.currentStock;
    onSetStockLevel(editingName, newCurrent, newMin);
    if (prevItem) {
      onAddTransaction({
        note: `Penyesuaian stok: ${editingName}`,
        items: [{
          ingredientName: editingName,
          delta: newCurrent - (prevStock ?? 0),
          unit: prevItem.unit,
          balanceBefore: prevStock ?? 0,
          balanceAfter: newCurrent,
        }],
      });
    }
    setTimeout(() => {
      setIsSavingEdit(false);
      setEditingName(null);
      toast.success(`Stok ${editingName} berhasil diperbarui`);
    }, 350);
  };

  const handleConfirmSale = () => {
    if (!selectedRecipe || deductionPreview.length === 0 || isCatatingPenjualan) return;
    setIsCatatPenjualan(true);
    const qty = Math.max(1, parseNum(saleQty));

    const matchedItems = deductionPreview.filter(d => d.inCatalog);
    if (matchedItems.length === 0) return;

    const deductions = matchedItems.map(d => ({ name: d.name, amount: d.totalDeduct }));

    const txItems: StockTransactionItem[] = matchedItems.map(d => ({
      ingredientName: d.name,
      delta: -d.totalDeduct,
      unit: d.unit,
      balanceBefore: d.stockBefore ?? 0,
      balanceAfter: Math.max(0, (d.stockBefore ?? 0) - d.totalDeduct),
    }));

    onDeductStock(deductions);
    onAddTransaction({
      note: `Penjualan: ${qty}× ${selectedRecipe.name}`,
      items: txItems,
    });

    setTimeout(() => {
      setSaleQty('1');
      setIsCatatPenjualan(false);
      setSaleSuccess(true);
      setTimeout(() => setSaleSuccess(false), 2000);
    }, 400);
  };

  if (savedRawIngredients.length === 0) {
    return (
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-10 shadow-sm text-center mt-6">
        <Package size={32} className="mx-auto text-[var(--text-4)] mb-3" />
        <p className="text-sm font-medium text-[var(--text-2)]">Belum ada bahan di katalog</p>
        <p className="text-xs text-[var(--text-4)] mt-1">
          Tambahkan bahan lewat Kalkulator HPP.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-6">

      {/* Notification permission prompt — hidden once granted */}
      {notifPerm !== null && notifPerm !== 'granted' && (
        <div className="flex items-center gap-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)]
          px-4 py-3 shadow-sm">
          {notifPerm === 'denied'
            ? <BellOff size={14} className="text-[var(--text-3)] shrink-0" />
            : <Bell size={14} className="text-[var(--text-3)] shrink-0" />}
          <p className="text-xs text-[var(--text-2)] flex-1">
            {notifPerm === 'denied'
              ? 'Notifikasi diblokir. Aktifkan di pengaturan browser untuk menerima peringatan stok.'
              : 'Aktifkan notifikasi browser untuk peringatan otomatis saat stok menyentuh minimum.'}
          </p>
          {notifPerm !== 'denied' && (
            <button
              type="button"
              onClick={handleRequestNotifPerm}
              className="text-xs font-semibold text-[#27B18A] hover:text-[#0E927A]
                transition-colors shrink-0 whitespace-nowrap"
            >
              Aktifkan
            </button>
          )}
        </div>
      )}

      {/* Valuasi Stok */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="p-5 lg:grid lg:grid-cols-[1fr_auto] lg:gap-8 lg:items-start">

          {/* Angka utama */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-2">
              Valuasi Stok Gudang
            </span>
            <p
              className="text-[2.5rem] font-bold leading-none text-[var(--text)] tabular-nums"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              {formatRp(stockValuation.totalValue)}
            </p>
            <p className="text-xs text-[var(--text-3)] mt-2">
              {stockValuation.trackedCount === 0
                ? 'Belum ada stok yang diatur'
                : `${stockValuation.trackedCount} dari ${stockValuation.totalCount} bahan terlacak`}
            </p>
          </div>

          {/* Breakdown per bahan */}
          {stockValuation.items.length > 0 && (
            <div className="mt-4 lg:mt-0 lg:min-w-[280px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)] block mb-2">
                Rincian
              </span>
              <div className="space-y-1.5">
                {stockValuation.items.map(item => {
                  const pct = stockValuation.totalValue > 0
                    ? (item.value / stockValuation.totalValue) * 100
                    : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-[var(--text)] font-medium truncate mr-3">{item.name}</span>
                        <span className="text-[var(--text-2)] tabular-nums shrink-0">
                          {item.currentStock.toLocaleString('id-ID')} {item.unit}
                          <span className="text-[var(--text)] font-semibold ml-2">
                            {formatRp(item.value)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#27B18A] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {stockValuation.trackedCount < stockValuation.totalCount && (
                <p className="text-[11px] text-[var(--text-4)] mt-2">
                  {stockValuation.totalCount - stockValuation.trackedCount} bahan belum diatur stoknya
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alert stok menipis */}
      {lowStockItems.length > 0 && (
        <div className="bg-[var(--tint-amber)] border border-[#065F46] rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-[#27B18A] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#065F46]">
                {lowStockItems.length} bahan stok di bawah minimum
              </p>
              <p className="text-xs text-[#0E927A] mt-0.5">
                {lowStockItems.map(i => i.name).join(', ')}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleCopyShoppingList}
              className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2
                rounded-xl transition-all ${copySuccess
                  ? 'bg-[#27B18A] text-white'
                  : 'bg-[#065F46] text-white hover:bg-[#065F46]'
                }`}
            >
              {copySuccess
                ? <><CheckCheck size={13} /> Disalin ke Clipboard!</>
                : <><Copy size={13} /> Kirim Daftar Belanja</>}
            </button>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">

        {/* Kiri: Tabel Stok + Catat Penjualan */}
        <div className="space-y-5">

          {/* Tabel Stok */}
          <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[#27B18A]"><Package size={15} /></span>
                <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text)]">Stok Bahan Baku</h2>
              </div>
              <button
                type="button"
                onClick={() => openRestock()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                  bg-[#27B18A] text-white hover:bg-[#0E927A] transition-colors"
              >
                <PackagePlus size={12} /> Restock
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto scrollbar-thin -mx-5 px-5">
            {/* Desktop header */}
            <div className="hidden md:grid gap-3 sticky top-0 z-10 bg-[var(--surface)] pb-2 mb-1 px-1"
              style={{ gridTemplateColumns: '1fr 100px 100px 80px 80px' }}>
              {['Bahan', 'Stok Saat Ini', 'Min. Stok', 'Status', ''].map(h => (
                <span key={h} className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider">{h}</span>
              ))}
            </div>

            <div className="space-y-2">
              {savedRawIngredients.map(item => (
                <div key={item.name}>
                  {editingName === item.name ? (
                    /* Edit row */
                    <div className="bg-[var(--tint-amber-deep)] border border-[#065F46] rounded-xl p-3 space-y-2">
                      <p className="text-sm font-semibold text-[var(--text)]">{item.name}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-[var(--text-2)] font-medium mb-1 block">
                            Stok Saat Ini ({item.unit})
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editCurrent}
                            onChange={e => {
                              const n = parseFloat(e.target.value);
                              setEditCurrent(e.target.value === '' ? '' : !isNaN(n) && n < 0 ? '0' : e.target.value);
                            }}
                            autoFocus
                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                              text-right focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20
                              focus:border-[#27B18A]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[var(--text-2)] font-medium mb-1 block">
                            Min. Stok ({item.unit})
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={editMin}
                            onChange={e => {
                              const n = parseFloat(e.target.value);
                              setEditMin(e.target.value === '' ? '' : !isNaN(n) && n < 0 ? '0' : e.target.value);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') setEditingName(null);
                            }}
                            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm
                              text-right focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20
                              focus:border-[#27B18A]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingName(null)}
                          className="flex items-center gap-1 text-xs text-[var(--text-2)] hover:text-[var(--text)]
                            transition-colors px-2 py-1"
                        >
                          <X size={12} /> Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                          className="inline-flex items-center gap-1 text-xs font-medium text-white
                            bg-[#27B18A] hover:bg-[#0E927A] px-3 py-1.5 rounded-lg transition-colors
                            disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isSavingEdit
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Check size={12} />}
                          Simpan
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display row — mobile card / desktop grid */
                    <div>
                      <div className="md:hidden bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-sm font-semibold text-[var(--text)] flex-1 min-w-0 truncate">
                            {item.name}
                          </p>
                          <StockBadge current={item.currentStock} min={item.minStock} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-4)] mb-0.5">
                              Stok Saat Ini
                            </p>
                            <p className="text-base font-bold text-[var(--text)] tabular-nums">
                              {item.currentStock !== undefined
                                ? item.currentStock.toLocaleString('id-ID')
                                : '—'}
                              {item.currentStock !== undefined && (
                                <span className="text-xs font-normal text-[var(--text-3)] ml-1">{item.unit}</span>
                              )}
                            </p>
                          </div>
                          <div className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-4)] mb-0.5">
                              Min. Stok
                            </p>
                            <p className="text-base font-bold text-[var(--text-2)] tabular-nums">
                              {item.minStock !== undefined
                                ? item.minStock.toLocaleString('id-ID')
                                : '—'}
                              {item.minStock !== undefined && (
                                <span className="text-xs font-normal text-[var(--text-3)] ml-1">{item.unit}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openRestock(item.name)}
                            className="flex items-center justify-center gap-1.5 min-h-[44px] px-4
                              bg-[#27B18A] text-white rounded-xl text-sm font-medium
                              hover:bg-[#0E927A] transition-colors"
                          >
                            <PackagePlus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="flex-1 flex items-center justify-center gap-2 min-h-[44px]
                              bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-medium
                              text-[var(--text-2)] hover:text-[#27B18A] hover:border-[#27B18A]/30 transition-colors"
                          >
                            <Edit2 size={14} /> Edit Stok
                          </button>
                          {item.priceHistory && item.priceHistory.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setHistoryOpen(historyOpen === item.name ? null : item.name)}
                              className="flex items-center justify-center gap-1 min-h-[44px] px-4
                                border border-[var(--border)] rounded-xl text-[var(--text-3)]
                                hover:text-[#27B18A] hover:border-[#27B18A]/30 transition-colors"
                            >
                              <TrendingUp size={13} />
                              {historyOpen === item.name ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop row */}
                      <div className="hidden md:grid gap-3 items-center py-1.5 px-1
                        border-b border-[var(--border-subtle)] last:border-0"
                        style={{ gridTemplateColumns: '1fr 100px 100px 80px 100px' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text)] truncate">{item.name}</p>
                          {item.priceHistory && item.priceHistory.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setHistoryOpen(historyOpen === item.name ? null : item.name)}
                              className="flex items-center gap-1 text-[10px] text-[var(--text-3)]
                                hover:text-[#27B18A] transition-colors mt-0.5"
                            >
                              <TrendingUp size={9} />
                              {item.priceHistory.length - 1}× perubahan harga
                              {historyOpen === item.name ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-right text-[var(--text)] tabular-nums">
                          {item.currentStock !== undefined
                            ? `${item.currentStock.toLocaleString('id-ID')} ${item.unit}`
                            : <span className="text-[var(--text-4)]">—</span>}
                        </p>
                        <p className="text-sm text-right text-[var(--text-2)] tabular-nums">
                          {item.minStock !== undefined
                            ? `${item.minStock.toLocaleString('id-ID')} ${item.unit}`
                            : <span className="text-[var(--text-4)]">—</span>}
                        </p>
                        <div className="flex justify-center">
                          <StockBadge current={item.currentStock} min={item.minStock} />
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openRestock(item.name)}
                            className="text-[#27B18A] hover:bg-[var(--tint-amber)] transition-colors
                              p-2 rounded-lg"
                            title="Restock"
                          >
                            <PackagePlus size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="text-[var(--text-4)] hover:text-[#27B18A] transition-colors
                              p-2 rounded-lg hover:bg-[var(--tint-amber-deep)]"
                            title="Edit stok"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Price history panel */}
                      {historyOpen === item.name && item.priceHistory && item.priceHistory.length > 0 && (
                        <PriceHistoryPanel entries={item.priceHistory} unit={item.unit} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </div>
          </section>

          {/* Catat Penjualan */}
          <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
            <SectionHeader icon={<ShoppingCart size={15} />} label="Catat Penjualan" />

            {savedRecipes.length === 0 ? (
              <p className="text-sm text-[var(--text-4)]">
                Belum ada resep tersimpan. Simpan dari Kalkulator HPP.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider mb-1.5 block">
                      Pilih Menu
                    </label>
                    <select
                      value={selectedRecipeId}
                      onChange={e => setSelectedRecipeId(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                        text-[var(--text)]"
                    >
                      <option value="">— Pilih resep —</option>
                      {savedRecipes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.mode === 'batch' ? `batch ${r.batchSize} cup` : 'per cup'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider mb-1.5 block">
                      {selectedRecipe?.mode === 'batch' ? 'Jumlah Batch' : 'Jumlah Porsi'}
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSaleQty(q => String(Math.max(1, parseNum(q) - 1)))}
                        className="w-9 h-10 flex items-center justify-center rounded-xl border
                          border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:bg-[var(--surface)]
                          transition-colors shrink-0"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={saleQty}
                        onChange={e => setSaleQty(e.target.value)}
                        className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2 py-2.5
                          text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20
                          focus:border-[#27B18A]"
                      />
                      <button
                        type="button"
                        onClick={() => setSaleQty(q => String(parseNum(q) + 1))}
                        className="w-9 h-10 flex items-center justify-center rounded-xl border
                          border-[var(--border)] bg-[var(--bg)] text-[var(--text-2)] hover:bg-[var(--surface)]
                          transition-colors shrink-0"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview deduction */}
                {selectedRecipe && deductionPreview.length > 0 && (
                  <div className="bg-[var(--bg)] rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-bold text-[var(--text-4)] uppercase tracking-wider mb-2">
                      Bahan yang akan dikurangi
                    </p>
                    {deductionPreview.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {d.inCatalog ? (
                            <CheckCircle size={13} className="text-[#27B18A] shrink-0" />
                          ) : (
                            <AlertTriangle size={13} className="text-[#27B18A] shrink-0" />
                          )}
                          <span className="text-sm text-[var(--text)]">{d.name}</span>
                          {!d.inCatalog && (
                            <span className="text-[10px] text-[#27B18A]">tidak di katalog</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium tabular-nums ${d.willEmpty ? 'text-[#DC2626]' : 'text-[var(--text)]'}`}>
                            −{d.totalDeduct % 1 === 0
                              ? d.totalDeduct.toLocaleString('id-ID')
                              : d.totalDeduct.toFixed(1)} {d.unit}
                          </span>
                          {d.stockBefore !== undefined && (
                            <p className="text-[10px] text-[var(--text-2)]">
                              sisa: {Math.max(0, d.stockBefore - d.totalDeduct).toFixed(d.totalDeduct % 1 === 0 ? 0 : 1)} {d.unit}
                              {d.willEmpty && <span className="text-[#DC2626] ml-1">⚠ kurang</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRecipe && deductionPreview.length === 0 && (
                  <p className="text-sm text-[var(--text-4)]">
                    Resep ini tidak memiliki bahan baku yang terdaftar di katalog.
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmSale}
                    disabled={!selectedRecipe || deductionPreview.filter(d => d.inCatalog).length === 0 || isCatatingPenjualan}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#27B18A] text-white
                      text-sm font-semibold rounded-xl hover:bg-[#0E927A] transition-colors
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isCatatingPenjualan && <Loader2 size={14} className="animate-spin" />}
                    Catat Penjualan
                  </button>
                  {saleSuccess && (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[#27B18A]">
                      <CheckCircle size={14} /> Stok diperbarui
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Kanan: Riwayat Transaksi + Smart Alert Toast */}
        <div className="mt-5 lg:mt-0">
          <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm lg:sticky lg:top-[73px]">
            <SectionHeader icon={<History size={15} />} label="Riwayat Mutasi Stok" />

            {transactions.length === 0 ? (
              <p className="text-sm text-[var(--text-4)] text-center py-6">
                Belum ada transaksi stok. Catat penjualan untuk update otomatis.
              </p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
                {transactions.map(tx => (
                  <div key={tx.id} className="border-b border-[var(--border-subtle)] last:border-0 pb-3 last:pb-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-medium text-[var(--text)] leading-snug">{tx.note}</p>
                      <span className="text-[10px] text-[var(--text-4)] shrink-0 mt-0.5">
                        {formatTimestamp(tx.timestamp)}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {tx.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-[var(--text-2)]">
                          <span>{item.ingredientName}</span>
                          <span className={item.delta < 0 ? 'text-[#DC2626]' : 'text-[#27B18A]'}>
                            {item.delta < 0 ? '−' : '+'}{Math.abs(item.delta).toFixed(item.delta % 1 === 0 ? 0 : 1)} {item.unit}
                            <span className="text-[var(--text-4)] ml-1">
                              → {item.balanceAfter.toFixed(item.delta % 1 === 0 ? 0 : 1)} {item.unit}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Restock Modal */}
      {restockModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setRestockModal(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <PackagePlus size={15} className="text-[#27B18A]" />
                <h3 className="text-sm font-bold text-[var(--text)]">Restock Bahan</h3>
              </div>
              <button
                type="button"
                onClick={() => setRestockModal(false)}
                className="text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                  Bahan
                </label>
                <select
                  value={rstName}
                  onChange={e => handleRestockNameChange(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A] text-[var(--text)]"
                >
                  <option value="">— Pilih bahan —</option>
                  {savedRawIngredients.map(ing => (
                    <option key={ing.name} value={ing.name}>
                      {ing.name}{ing.currentStock !== undefined ? ` (stok: ${ing.currentStock} ${ing.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                  Jumlah Masuk{rstName ? ` (${savedRawIngredients.find(x => x.name === rstName)?.unit ?? ''})` : ''}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={rstQty}
                  onChange={e => setRstQty(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                    Harga Beli Baru (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rstPrice}
                    onChange={e => setRstPrice(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                    Volume Beli
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rstVolume}
                    onChange={e => setRstVolume(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
              </div>

              {(() => {
                const ing = savedRawIngredients.find(x => x.name === rstName);
                if (!ing || !rstPrice || !rstVolume) return null;
                const newPpu = parseNum(rstVolume) > 0 ? parseNum(rstPrice) / parseNum(rstVolume) : 0;
                const oldPpu = ing.purchaseVolume > 0 ? ing.purchasePrice / ing.purchaseVolume : 0;
                const pct = oldPpu > 0 ? ((newPpu - oldPpu) / oldPpu) * 100 : 0;
                if (ing.purchasePrice === parseNum(rstPrice) && ing.purchaseVolume === parseNum(rstVolume)) return null;
                return (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                    pct > 0 ? 'bg-[var(--tint-red)] text-[#DC2626]' : 'bg-[var(--tint-amber)] text-[#27B18A]'
                  }`}>
                    {pct > 0 ? '▲' : '▼'} Harga per {ing.unit} berubah {Math.abs(pct).toFixed(1)}% — HPP resep akan dihitung ulang
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleRestockSubmit}
                disabled={rstLoading || !rstName}
                className="w-full flex items-center justify-center gap-2 bg-[#27B18A] text-white
                  py-3 rounded-xl font-semibold text-sm hover:bg-[#0E927A] transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed mt-1"
              >
                {rstLoading ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />}
                Simpan Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Alert — fixed bottom-right toast */}
      {alertToast.length > 0 && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50
            w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-[var(--surface)] rounded-2xl shadow-2xl
            border border-[#065F46] p-4"
          style={{ animation: 'slideIn 0.25s ease-out' }}
        >
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(16px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
          `}</style>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--tint-amber)] flex items-center
              justify-center shrink-0">
              <AlertTriangle size={16} className="text-[#27B18A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#065F46]">Stok Menyentuh Minimum!</p>
              <p className="text-xs text-[#0E927A] mt-0.5 leading-relaxed">
                {alertToast.join(', ')} sudah menyentuh batas minimum.
              </p>
              {notifPerm === 'granted' && (
                <p className="text-[10px] text-[#27B18A] mt-1 flex items-center gap-1">
                  <Bell size={9} /> Notifikasi browser dikirim
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAlertToast([])}
              className="text-[#27B18A] hover:text-[#065F46] transition-colors shrink-0 mt-0.5"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
