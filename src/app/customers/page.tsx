'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, Trash2, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useCustomerStore } from '@/store/customerStore';
import { formatRp } from '@/lib/format';

export default function CustomersPage() {
  const { customers, deleteCustomer } = useCustomerStore();

  const sorted = useMemo(
    () => [...customers].sort((a, b) => b.totalSpent - a.totalSpent),
    [customers],
  );

  return (
    <AdminGuard>
      <div
        className="min-h-screen bg-[var(--bg)]"
        style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
      >
        <Navbar active="dashboard" />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <span className="text-[var(--border)]">/</span>
            <span className="text-sm font-semibold text-[var(--text)]">Pelanggan</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-bold text-[var(--text)]"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                Daftar Pelanggan
              </h1>
              <p className="text-sm text-[var(--text-3)] mt-0.5">
                {sorted.length} pelanggan · diurutkan berdasarkan total belanja
              </p>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 shadow-sm text-center">
              <Users size={32} className="mx-auto text-[var(--text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-2)]">Belum ada pelanggan tercatat</p>
              <p className="text-xs text-[var(--text-4)] mt-1">
                Isi nama & nomor WA pelanggan saat transaksi di Kasir.
              </p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['#', 'Nama', 'WhatsApp', 'Transaksi', 'Total Belanja', ''].map((h, i) => (
                        <th
                          key={i}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] ${
                            i === 0 ? 'text-center w-8' : i >= 3 ? 'text-right' : 'text-left'
                          } ${i === 5 ? 'w-10' : ''}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((c, i) => (
                      <tr
                        key={c.id}
                        className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-center">
                          {i === 0 ? (
                            <span className="text-base">🥇</span>
                          ) : i === 1 ? (
                            <span className="text-base">🥈</span>
                          ) : i === 2 ? (
                            <span className="text-base">🥉</span>
                          ) : (
                            <span className="text-xs font-bold text-[var(--text-4)]">#{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{c.name}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-2)]">
                          <a
                            href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#27B18A] transition-colors"
                          >
                            {c.whatsapp}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-[var(--text-2)]">
                          {c.totalOrders}×
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-right tabular-nums text-[var(--text)]">
                          {formatRp(c.totalSpent)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => deleteCustomer(c.id)}
                            className="text-[var(--text-4)] hover:text-[#DC2626] transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
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
