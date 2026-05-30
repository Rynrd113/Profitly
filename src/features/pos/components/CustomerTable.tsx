'use client';

import { useState, useMemo } from 'react';
import { Users, Search, Trash2 } from 'lucide-react';
import type { Customer } from '@/types/hpp';

export function CustomerTable({
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
