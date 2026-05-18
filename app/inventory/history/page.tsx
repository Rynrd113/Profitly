'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, History, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useInventoryLogStore } from '@/store/inventoryLogStore';
import { useSupplierStore } from '@/store/supplierStore';

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  IN:     { label: 'Masuk',   color: 'text-[#27B18A] bg-[var(--tint-green)]' },
  OUT:    { label: 'Keluar',  color: 'text-[#DC2626] bg-[var(--tint-red)]' },
  ADJUST: { label: 'Sesuai', color: 'text-[#D97706] bg-[var(--tint-amber)]' },
};

export default function InventoryHistoryPage() {
  const { stockLogs, clearLogs } = useInventoryLogStore();
  const { suppliers } = useSupplierStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stockLogs.filter(
      l => !q || l.ingredientId.toLowerCase().includes(q) || l.reason.toLowerCase().includes(q),
    );
  }, [stockLogs, search]);

  function supplierName(id?: string) {
    if (!id) return null;
    return suppliers.find(s => s.id === id)?.name ?? null;
  }

  function formatTs(iso: string) {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <AdminGuard>
      <div
        className="min-h-screen bg-[var(--bg)]"
        style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
      >
        <Navbar active="dashboard" />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/inventory"
              className="flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ArrowLeft size={14} /> Inventori
            </Link>
            <span className="text-[var(--border)]">/</span>
            <span className="text-sm font-semibold text-[var(--text)]">Riwayat Stok</span>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-2xl font-bold text-[var(--text)]"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                Riwayat Stok
              </h1>
              <p className="text-sm text-[var(--text-3)] mt-0.5">
                {filtered.length} entri
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cari bahan / alasan…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/30 w-52"
              />
              {stockLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => { if (confirm('Hapus semua log stok?')) clearLogs(); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--text-3)] hover:text-[#DC2626] hover:border-[#DC2626] transition-colors"
                >
                  <Trash2 size={13} /> Hapus Semua
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 shadow-sm text-center">
              <History size={32} className="mx-auto text-[var(--text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-2)]">Belum ada riwayat stok</p>
              <p className="text-xs text-[var(--text-4)] mt-1">
                Log otomatis tercatat saat ada transaksi, restock, atau pembatalan.
              </p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['Tanggal', 'Nama Bahan', 'Tipe', 'Jumlah', 'Alasan', 'Supplier'].map((h, i) => (
                        <th
                          key={i}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                            i === 0 || i === 1 || i === 4 || i === 5 ? 'text-left' : 'text-right'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(log => {
                      const t = TYPE_LABEL[log.type] ?? TYPE_LABEL.ADJUST;
                      const sup = supplierName(log.supplierId);
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-[var(--text-3)] whitespace-nowrap">
                            {formatTs(log.timestamp)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">
                            {log.ingredientId}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.color}`}>
                              {t.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right text-[var(--text)]">
                            {log.type === 'OUT' ? '-' : '+'}{log.amount}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--text-2)]">{log.reason}</td>
                          <td className="px-4 py-3 text-sm text-[var(--text-3)]">{sup ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
