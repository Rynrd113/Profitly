'use client';

import { useState, useRef } from 'react';
import { Download, Upload, Trash2, Shield, Info, Database, PackagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { exportBackup, importBackup } from '@/lib/backup';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { parseNum } from '@/lib/format';

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const { ingredients, receiveStock } = useSavedRawIngredients();
  const { recomputeHPPForIngredient } = useSavedRecipes();
  const { add: addTransaction } = useStockTransactions();

  const [rcvName, setRcvName] = useState('');
  const [rcvQty, setRcvQty] = useState('');
  const [rcvPrice, setRcvPrice] = useState('');
  const [rcvVolume, setRcvVolume] = useState('');
  const [rcvLoading, setRcvLoading] = useState(false);

  const handleIngredientSelect = (name: string) => {
    setRcvName(name);
    const ing = ingredients.find(x => x.name === name);
    if (ing) {
      setRcvPrice(String(ing.purchasePrice));
      setRcvVolume(String(ing.purchaseVolume));
    } else {
      setRcvPrice('');
      setRcvVolume('');
    }
  };

  const handleReceiveStock = () => {
    const qtyIn = parseNum(rcvQty);
    const newPrice = parseNum(rcvPrice);
    const newVolume = parseNum(rcvVolume);
    if (!rcvName || qtyIn <= 0 || newPrice <= 0 || newVolume <= 0) {
      toast.error('Lengkapi semua data dengan benar');
      return;
    }
    setRcvLoading(true);
    const ing = ingredients.find(x => x.name === rcvName);
    const stockBefore = ing?.currentStock ?? 0;

    const priceChanged = receiveStock(rcvName, qtyIn, newPrice, newVolume);

    addTransaction({
      note: `Penerimaan barang: ${rcvName}`,
      items: [{
        ingredientName: rcvName,
        delta: qtyIn,
        unit: (ing?.unit ?? 'pcs') as 'gr' | 'ml' | 'pcs',
        balanceBefore: stockBefore,
        balanceAfter: stockBefore + qtyIn,
      }],
    });

    if (priceChanged) {
      recomputeHPPForIngredient(rcvName, newPrice, newVolume);
    }

    setTimeout(() => {
      setRcvLoading(false);
      setRcvName('');
      setRcvQty('');
      setRcvPrice('');
      setRcvVolume('');
      toast.success(
        priceChanged
          ? `+${qtyIn} ${ing?.unit ?? ''} ${rcvName} · HPP resep diperbarui otomatis`
          : `+${qtyIn} ${ing?.unit ?? ''} ${rcvName} · Stok diperbarui`
      );
    }, 350);
  };

  const handleExport = () => {
    try {
      exportBackup();
      toast.success('Backup berhasil diunduh');
    } catch {
      toast.error('Gagal mengekspor backup');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      toast.success('Data berhasil dipulihkan! Memuat ulang...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat backup');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClearData = () => {
    if (!confirm('Hapus semua data? Tindakan ini tidak bisa dibatalkan.')) return;
    const keys = Object.keys(localStorage).filter(k => k.startsWith('profitly-'));
    keys.forEach(k => localStorage.removeItem(k));
    toast.success('Semua data telah dihapus');
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div
      className="min-h-screen bg-[#F8F7F2]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Navbar active="settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
        <div>
          <h1
            className="text-2xl font-bold text-[#1A1A18]"
            style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
          >
            Pengaturan
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-0.5">Kelola data dan keamanan aplikasi</p>
        </div>

        {/* ── Penerimaan Barang ── */}
        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <PackagePlus size={14} className="text-[#1A6B3C]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
              Penerimaan Barang
            </h2>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-5">
            Tambah stok masuk dan perbarui harga beli. HPP semua resep terkait dihitung ulang otomatis.
          </p>

          {ingredients.length === 0 ? (
            <p className="text-sm text-[#C4BFBA]">
              Belum ada bahan di katalog. Simpan bahan lewat Kalkulator HPP terlebih dahulu.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] block mb-1.5">
                  Bahan Baku
                </label>
                <select
                  value={rcvName}
                  onChange={e => handleIngredientSelect(e.target.value)}
                  className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]
                    text-[#1A1A18]"
                >
                  <option value="">— Pilih bahan —</option>
                  {ingredients.map(ing => (
                    <option key={ing.name} value={ing.name}>
                      {ing.name} {ing.currentStock !== undefined ? `(stok: ${ing.currentStock} ${ing.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] block mb-1.5">
                    Jumlah Masuk{rcvName ? ` (${ingredients.find(x => x.name === rcvName)?.unit ?? ''})` : ''}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rcvQty}
                    onChange={e => setRcvQty(e.target.value)}
                    className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] block mb-1.5">
                    Harga Beli Baru (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rcvPrice}
                    onChange={e => setRcvPrice(e.target.value)}
                    className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] block mb-1.5">
                    Volume Beli
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rcvVolume}
                    onChange={e => setRcvVolume(e.target.value)}
                    className="w-full bg-[#F8F7F2] border border-[#E5E3DD] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#1A6B3C]/20 focus:border-[#1A6B3C]"
                  />
                </div>
              </div>

              {rcvName && rcvPrice && rcvVolume && (() => {
                const ing = ingredients.find(x => x.name === rcvName);
                const newPpu = parseNum(rcvVolume) > 0 ? parseNum(rcvPrice) / parseNum(rcvVolume) : 0;
                const oldPpu = ing && ing.purchaseVolume > 0 ? ing.purchasePrice / ing.purchaseVolume : 0;
                const diff = oldPpu > 0 ? ((newPpu - oldPpu) / oldPpu) * 100 : 0;
                if (!ing || (ing.purchasePrice === parseNum(rcvPrice) && ing.purchaseVolume === parseNum(rcvVolume))) return null;
                return (
                  <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                    diff > 0 ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#ECFDF5] text-[#1A6B3C]'
                  }`}>
                    <span>{diff > 0 ? '▲' : '▼'} Harga per {ing.unit} berubah {Math.abs(diff).toFixed(1)}% — HPP resep akan dihitung ulang</span>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleReceiveStock}
                disabled={rcvLoading || !rcvName}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A6B3C] text-white
                  text-sm font-semibold rounded-xl hover:bg-[#15593A] transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {rcvLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <PackagePlus size={14} />}
                Terima Barang
              </button>
            </div>
          )}
        </div>

        {/* ── Backup & Restore ── */}
        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-[#1A6B3C]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
              Backup & Restore
            </h2>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-5">
            Unduh semua data ke file JSON sebagai cadangan. Pulihkan kapan saja dengan upload file backup.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                text-sm font-semibold bg-[#1A6B3C] text-white border border-[#1A6B3C]
                hover:bg-[#15593A] transition-colors"
            >
              <Download size={15} />
              Export Backup
            </button>
            <label
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                text-sm font-semibold bg-white text-[#78716C] border border-[#E5E3DD]
                hover:border-[#1A6B3C]/40 hover:text-[#1A6B3C] transition-colors cursor-pointer"
            >
              <Upload size={15} />
              Restore Backup
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database size={14} className="text-[#9CA3AF]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
              Penyimpanan Data
            </h2>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">
            Semua data tersimpan secara lokal di perangkat Anda dan dienkripsi dengan base64.
            Tidak ada data yang dikirim ke server.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Resep', key: 'profitly-saved-recipes' },
              { label: 'Bahan Baku', key: 'profitly-saved-raw-ingredients' },
              { label: 'Transaksi', key: 'profitly-sales-records' },
              { label: 'Stok', key: 'profitly-stock-transactions' },
            ].map(({ label, key }) => {
              const size = typeof window !== 'undefined'
                ? Math.round((localStorage.getItem(key)?.length ?? 0) / 1024 * 10) / 10
                : 0;
              return (
                <div key={key} className="bg-[#F8F7F2] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#C4BFBA] mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-[#1A1A18]">{size > 0 ? `${size} KB` : '—'}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#FECACA] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 size={14} className="text-[#DC2626]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#DC2626]">
              Zona Berbahaya
            </h2>
          </div>
          <p className="text-xs text-[#9CA3AF] mb-4">
            Menghapus semua data lokal secara permanen. Tidak dapat dipulihkan tanpa backup.
          </p>
          <button
            type="button"
            onClick={handleClearData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] transition-colors"
          >
            <Trash2 size={14} />
            Hapus Semua Data
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E3DD] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-[#9CA3AF]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#C4BFBA]">
              Tentang Aplikasi
            </h2>
          </div>
          <div className="space-y-2 text-sm text-[#78716C]">
            {[
              ['Aplikasi', 'ProfitLy'],
              ['Versi', '0.1.0'],
              ['Platform', 'Web (PWA)'],
              ['Penyimpanan', 'localStorage (lokal)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="font-semibold text-[#1A1A18]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
