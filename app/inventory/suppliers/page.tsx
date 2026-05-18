'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Truck, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AdminGuard } from '@/components/AdminGuard';
import { useSupplierStore } from '@/store/supplierStore';
import type { Supplier } from '@/types/inventory';

const EMPTY_FORM = { name: '', contact: '', address: '', supplies: '' };

export default function SuppliersPage() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplierStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState(EMPTY_FORM);

  const formValid = form.name.trim().length > 0;

  function handleAdd() {
    if (!formValid) return;
    addSupplier({
      name: form.name.trim(),
      contact: form.contact.trim(),
      address: form.address.trim(),
      supplies: form.supplies.split(',').map(s => s.trim()).filter(Boolean),
    });
    setForm(EMPTY_FORM);
  }

  function startEdit(s: Supplier) {
    setEditId(s.id);
    setEditData({ name: s.name, contact: s.contact, address: s.address, supplies: s.supplies.join(', ') });
  }

  function saveEdit() {
    if (!editId) return;
    updateSupplier(editId, {
      name: editData.name.trim(),
      contact: editData.contact.trim(),
      address: editData.address.trim(),
      supplies: editData.supplies.split(',').map(s => s.trim()).filter(Boolean),
    });
    setEditId(null);
  }

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
              href="/inventory"
              className="flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            >
              <ArrowLeft size={14} /> Inventori
            </Link>
            <span className="text-[var(--border)]">/</span>
            <span className="text-sm font-semibold text-[var(--text)]">Supplier</span>
          </div>

          <div>
            <h1
              className="text-2xl font-bold text-[var(--text)]"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              Manajemen Supplier
            </h1>
            <p className="text-sm text-[var(--text-3)] mt-0.5">
              {suppliers.length} supplier tercatat
            </p>
          </div>

          {/* Add form */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-4)]">Tambah Supplier</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Nama supplier *"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-sm px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/30"
              />
              <input
                type="text"
                placeholder="Kontak (WA / telp)"
                value={form.contact}
                onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                className="text-sm px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/30"
              />
              <input
                type="text"
                placeholder="Alamat"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="text-sm px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/30"
              />
              <input
                type="text"
                placeholder="Bahan yang disuplai (pisah koma)"
                value={form.supplies}
                onChange={e => setForm(f => ({ ...f, supplies: e.target.value }))}
                className="text-sm px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-4)] focus:outline-none focus:ring-2 focus:ring-[#27B18A]/30"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formValid}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-[#27B18A] text-white hover:bg-[#22a07d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} /> Tambah Supplier
            </button>
          </div>

          {/* Supplier list */}
          {suppliers.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-12 shadow-sm text-center">
              <Truck size={32} className="mx-auto text-[var(--text-4)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-2)]">Belum ada supplier</p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['Nama', 'Kontak', 'Alamat', 'Bahan Suplai', ''].map((h, i) => (
                        <th
                          key={i}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] text-left ${i === 4 ? 'w-16' : ''}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg)]/40 transition-colors"
                      >
                        {editId === s.id ? (
                          <>
                            <td className="px-3 py-2">
                              <input
                                value={editData.name}
                                onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                                className="text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none w-full"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editData.contact}
                                onChange={e => setEditData(d => ({ ...d, contact: e.target.value }))}
                                className="text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none w-full"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editData.address}
                                onChange={e => setEditData(d => ({ ...d, address: e.target.value }))}
                                className="text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none w-full"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editData.supplies}
                                onChange={e => setEditData(d => ({ ...d, supplies: e.target.value }))}
                                className="text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none w-full"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={saveEdit} className="text-[#27B18A] hover:opacity-70 transition-opacity">
                                  <Check size={15} />
                                </button>
                                <button type="button" onClick={() => setEditId(null)} className="text-[var(--text-4)] hover:text-[var(--text)] transition-colors">
                                  <X size={15} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{s.name}</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-2)]">{s.contact || '—'}</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-2)]">{s.address || '—'}</td>
                            <td className="px-4 py-3 text-sm text-[var(--text-3)]">
                              {s.supplies.length > 0
                                ? s.supplies.join(', ')
                                : <span className="text-[var(--text-4)]">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(s)}
                                  className="text-[var(--text-4)] hover:text-[var(--text)] transition-colors"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSupplier(s.id)}
                                  className="text-[var(--text-4)] hover:text-[#DC2626] transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
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
