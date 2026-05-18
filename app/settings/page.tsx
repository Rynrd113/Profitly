'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Trash2, Shield, Info, Database, PackagePlus, Loader2, UserCog, Lock, Unlock, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useRole } from '@/hooks/useRole';
import { exportBackup, importBackup } from '@/lib/backup';
import { exportSalesCSV, exportInventoryCSV, parseInventoryCSV } from '@/lib/dataExchange';
import { useSalesRecords } from '@/hooks/useSalesRecords';
import { useSavedRawIngredients } from '@/hooks/useSavedRawIngredients';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { parseNum } from '@/lib/format';

export default function SettingsPage() {
  const fileRef    = useRef<HTMLInputElement>(null);
  const csvRef     = useRef<HTMLInputElement>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const { switchToKasir, setPin } = useRole();
  const [showModeSection, setShowModeSection] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSaved, setPinSaved] = useState(false);

  const { ingredients, receiveStock, save: upsertIngredients } = useSavedRawIngredients();
  const { allRecords: salesRecords } = useSalesRecords();
  const { recomputeHPPForIngredient } = useSavedRecipes();
  const { add: addTransaction } = useStockTransactions();

  const storageKeys = [
    { label: 'Resep', key: 'profitly-saved-recipes' },
    { label: 'Bahan Baku', key: 'profitly-saved-raw-ingredients' },
    { label: 'Transaksi', key: 'profitly-sales-records' },
    { label: 'Stok', key: 'profitly-stock-transactions' },
  ];
  const [storageSizes, setStorageSizes] = useState<Record<string, number>>({});
  useEffect(() => {
    const sizes: Record<string, number> = {};
    for (const { key } of storageKeys) {
      sizes[key] = Math.round((localStorage.getItem(key)?.length ?? 0) / 1024 * 10) / 10;
    }
    setStorageSizes(sizes);
  }, []);

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
    const keys = Object.keys(localStorage).filter(k => k.startsWith('profitly-'));
    keys.forEach(k => localStorage.removeItem(k));
    setClearConfirm(false);
    toast.success('Semua data telah dihapus');
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    try {
      const text = await file.text();
      const rows = parseInventoryCSV(text);
      if (rows.length === 0) { toast.error('CSV kosong atau format tidak dikenali'); return; }
      upsertIngredients(rows.map(r => ({
        name: r.name ?? '',
        purchasePrice: r.purchasePrice ?? 0,
        purchaseVolume: r.purchaseVolume ?? 1,
        unit: r.unit ?? 'gr',
        ...(r.currentStock !== undefined ? { currentStock: r.currentStock } : {}),
        ...(r.minStock !== undefined ? { minStock: r.minStock } : {}),
      })));
      toast.success(`${rows.length} bahan berhasil diimpor dari CSV`);
    } catch {
      toast.error('Gagal membaca file CSV');
    } finally {
      setCsvImporting(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  };

  return (
    <AdminGuard>
    <div
      className="min-h-screen bg-[var(--bg)]"
      style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
    >
      <Navbar active="settings" />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--text)]"
            style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
          >
            Pengaturan
          </h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">Kelola data dan keamanan aplikasi</p>
        </div>

        {/* ── Penerimaan Barang ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <PackagePlus size={14} className="text-[#27B18A]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Penerimaan Barang
            </h2>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-5">
            Tambah stok masuk dan perbarui harga beli. HPP semua resep terkait dihitung ulang otomatis.
          </p>

          {ingredients.length === 0 ? (
            <p className="text-sm text-[var(--text-4)]">
              Belum ada bahan di katalog. Simpan bahan lewat Kalkulator HPP terlebih dahulu.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                  Bahan Baku
                </label>
                <select
                  value={rcvName}
                  onChange={e => handleIngredientSelect(e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                    text-[var(--text)]"
                >
                  <option value="">— Pilih bahan —</option>
                  {ingredients.map(ing => (
                    <option key={ing.name} value={ing.name}>
                      {ing.name} {ing.currentStock !== undefined ? `(stok: ${ing.currentStock} ${ing.unit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                    Jumlah Masuk{rcvName ? ` (${ingredients.find(x => x.name === rcvName)?.unit ?? ''})` : ''}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rcvQty}
                    onChange={e => setRcvQty(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                    Harga Beli Baru (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={rcvPrice}
                    onChange={e => setRcvPrice(e.target.value)}
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
                    value={rcvVolume}
                    onChange={e => setRcvVolume(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
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
                    diff > 0 ? 'bg-[var(--tint-red)] text-[#DC2626]' : 'bg-[var(--tint-amber)] text-[#27B18A]'
                  }`}>
                    <span>{diff > 0 ? '▲' : '▼'} Harga per {ing.unit} berubah {Math.abs(diff).toFixed(1)}% — HPP resep akan dihitung ulang</span>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={handleReceiveStock}
                disabled={rcvLoading || !rcvName}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#27B18A] text-white
                  text-sm font-semibold rounded-xl hover:bg-[#0E927A] transition-colors
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
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-[#27B18A]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Backup & Restore
            </h2>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-5">
            Unduh semua data ke file JSON sebagai cadangan. Pulihkan kapan saja dengan upload file backup.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                text-sm font-semibold bg-[#27B18A] text-white border border-[#27B18A]
                hover:bg-[#0E927A] transition-colors"
            >
              <Download size={15} />
              Export Backup
            </button>
            <label
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                text-sm font-semibold bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)]
                hover:border-[#27B18A]/40 hover:text-[#27B18A] transition-colors cursor-pointer"
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

        {/* ── Portabilitas Data (CSV) ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet size={14} className="text-[#27B18A]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Portabilitas Data (CSV)
            </h2>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-5">
            Ekspor data ke CSV untuk dianalisis di Excel/Google Sheets. Impor bahan baku dari file CSV.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => exportSalesCSV(salesRecords)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                  text-sm font-semibold border border-[var(--border)] text-[var(--text-2)]
                  hover:border-[#27B18A]/40 hover:text-[#27B18A] transition-colors"
              >
                <Download size={13} />
                Ekspor Penjualan
              </button>
              <button
                type="button"
                onClick={() => exportInventoryCSV(ingredients)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                  text-sm font-semibold border border-[var(--border)] text-[var(--text-2)]
                  hover:border-[#27B18A]/40 hover:text-[#27B18A] transition-colors"
              >
                <Download size={13} />
                Ekspor Inventori
              </button>
            </div>
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
              text-sm font-semibold border border-[var(--border)] text-[var(--text-2)]
              hover:border-[#27B18A]/40 hover:text-[#27B18A] transition-colors cursor-pointer">
              {csvImporting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Impor Bahan (CSV)
              <input
                ref={csvRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSVImport}
              />
            </label>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database size={14} className="text-[var(--text-3)]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Penyimpanan Data
            </h2>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-4">
            Semua data tersimpan secara lokal di perangkat Anda dan dienkripsi dengan base64.
            Tidak ada data yang dikirim ke server.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {storageKeys.map(({ label, key }) => {
              const size = storageSizes[key] ?? 0;
              return (
                <div key={key} className="bg-[var(--bg)] rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-[var(--text)]">{size > 0 ? `${size} KB` : '—'}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[#7F1D1D] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 size={14} className="text-[#DC2626]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#DC2626]">
              Zona Berbahaya
            </h2>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-4">
            Menghapus semua data lokal secara permanen. Tidak dapat dipulihkan tanpa backup.
          </p>
          {clearConfirm ? (
            <div className="flex items-center gap-3 p-3 bg-[var(--tint-red)] border border-[#7F1D1D] rounded-xl">
              <p className="text-sm text-[#DC2626] font-medium flex-1">
                Yakin hapus semua data? Tidak bisa dibatalkan.
              </p>
              <button
                type="button"
                onClick={handleClearData}
                className="text-sm font-semibold text-white bg-[#DC2626] px-3 py-1.5 rounded-lg
                  hover:bg-[#B91C1C] transition-colors shrink-0"
              >
                Hapus
              </button>
              <button
                type="button"
                onClick={() => setClearConfirm(false)}
                className="text-sm text-[var(--text-2)] px-3 py-1.5 rounded-lg hover:bg-[var(--surface)]
                  transition-colors shrink-0"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-[var(--tint-red)] text-[#DC2626] border border-[#7F1D1D] hover:bg-[#450A0A] transition-colors"
            >
              <Trash2 size={14} />
              Hapus Semua Data
            </button>
          )}
        </div>

        {/* ── Mode Pengguna ── */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <UserCog size={14} className="text-[#27B18A]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Mode Pengguna
            </h2>
          </div>
          <p className="text-xs text-[var(--text-3)] mb-4">
            Aktifkan Mode Kasir agar staf hanya bisa mengakses halaman Kasir.
            Untuk kembali ke Mode Pengelola, PIN diperlukan jika sudah diset.
          </p>

          {!showModeSection ? (
            <button
              type="button"
              onClick={() => setShowModeSection(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-[var(--tint-amber)] text-[#27B18A] border border-[#9A3412]
                hover:bg-[var(--tint-amber-deep)] transition-colors"
            >
              <Lock size={14} />
              Aktifkan Mode Kasir
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                    PIN Pengelola (opsional)
                  </label>
                  <input
                    type="password"
                    placeholder="Kosongkan jika tanpa PIN"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block mb-1.5">
                    Konfirmasi PIN
                  </label>
                  <input
                    type="password"
                    placeholder="Ulangi PIN"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]"
                  />
                </div>
              </div>
              {newPin && confirmPin && newPin !== confirmPin && (
                <p className="text-xs text-[#DC2626]">PIN tidak cocok</p>
              )}
              {pinSaved && (
                <p className="text-xs text-[#27B18A]">PIN disimpan. Beralih ke Mode Kasir...</p>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={!!(newPin && newPin !== confirmPin)}
                  onClick={() => {
                    if (newPin && newPin !== confirmPin) return;
                    if (newPin) setPin(newPin);
                    setPinSaved(true);
                    setTimeout(() => {
                      switchToKasir();
                      window.location.href = '/pos';
                    }, 800);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#27B18A] text-white
                    text-sm font-semibold rounded-xl hover:bg-[#0E927A] transition-colors
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lock size={14} />
                  Konfirmasi & Aktifkan
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModeSection(false); setNewPin(''); setConfirmPin(''); }}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-2)]
                    text-sm font-semibold hover:bg-[var(--bg)] transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-[var(--text-3)]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--text-4)]">
              Tentang Aplikasi
            </h2>
          </div>
          <div className="space-y-2 text-sm text-[var(--text-2)]">
            {[
              ['Aplikasi', 'ProfitLy'],
              ['Versi', '0.1.0'],
              ['Platform', 'Web (PWA)'],
              ['Penyimpanan', 'localStorage (lokal)'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="font-semibold text-[var(--text)]">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
    </AdminGuard>
  );
}
