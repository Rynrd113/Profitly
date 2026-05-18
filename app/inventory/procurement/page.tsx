'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Copy, Check, Truck } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useSupplierStore } from '@/store/supplierStore';
import { useIngredientStore } from '@/store/ingredientStore';
import { generateShoppingList } from '@/lib/procurement';

export default function ProcurementPage() {
  const { ingredients } = useIngredientStore();
  const { suppliers } = useSupplierStore();
  const [copied, setCopied] = useState(false);

  const groups = useMemo(
    () => generateShoppingList(ingredients, suppliers),
    [ingredients, suppliers],
  );

  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);

  function buildWhatsAppText(supplierName: string, items: typeof groups[0]['items']) {
    const lines = [
      `*Daftar Belanja – ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}*`,
      supplierName ? `Supplier: ${supplierName}` : 'Supplier: Belum diketahui',
      '',
      ...items.map((it, i) =>
        `${i + 1}. ${it.ingredient.name} — stok: ${it.currentStock} ${it.ingredient.unit}, butuh: ${it.deficit} ${it.ingredient.unit}`,
      ),
    ];
    return lines.join('\n');
  }

  function copyAll() {
    const text = groups
      .map(g => buildWhatsAppText(g.supplier?.name ?? 'Belum diketahui', g.items))
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AdminGuard>
      <div
        className="min-h-screen bg-[var(--bg)]"
        style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
      >
        <Navbar active="inventory" />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-8 space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/inventory"
              className="flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ArrowLeft size={14} /> Inventori
            </Link>
            <span className="text-[var(--border)]">/</span>
            <span className="text-sm font-semibold text-[var(--text)]">Daftar Belanja</span>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-2xl font-bold text-[var(--text)]"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                Daftar Belanja
              </h1>
              <p className="text-sm text-[var(--text-3)] mt-0.5">
                {totalItems} bahan perlu direstok
              </p>
            </div>
            {totalItems > 0 && (
              <button
                type="button"
                onClick={copyAll}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[#27B18A]/50 transition-colors"
              >
                {copied ? <Check size={14} className="text-[#27B18A]" /> : <Copy size={14} />}
                {copied ? 'Tersalin!' : 'Salin Semua'}
              </button>
            )}
          </div>

          {totalItems === 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 shadow-sm text-center">
              <ShoppingCart size={32} className="mx-auto text-[var(--text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-2)]">Semua stok aman</p>
              <p className="text-xs text-[var(--text-4)] mt-1">
                Tidak ada bahan yang berada di bawah batas minimum stok.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group, gi) => (
                <div
                  key={gi}
                  className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg)]/30">
                    <div className="flex items-center gap-2">
                      <Truck size={14} className="text-[#27B18A]" />
                      <span className="text-sm font-semibold text-[var(--text)]">
                        {group.supplier?.name ?? 'Supplier Tidak Diketahui'}
                      </span>
                      {group.supplier?.contact && (
                        <span className="text-xs text-[var(--text-4)]">· {group.supplier.contact}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const text = buildWhatsAppText(group.supplier?.name ?? 'Belum diketahui', group.items);
                        navigator.clipboard.writeText(text);
                      }}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-[#27B18A] transition-colors"
                    >
                      <Copy size={12} /> Salin
                    </button>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {group.items.map((item, ii) => (
                      <div key={ii} className="flex items-center justify-between px-5 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-[var(--text)]">{item.ingredient.name}</p>
                          <p className="text-xs text-[var(--text-3)] mt-0.5">
                            Stok: {item.currentStock} {item.ingredient.unit} · Min: {item.minStock} {item.ingredient.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold tabular-nums text-[#DC2626]">
                            −{item.deficit} {item.ingredient.unit}
                          </span>
                          <p className="text-[10px] text-[var(--text-4)] mt-0.5">defisit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
