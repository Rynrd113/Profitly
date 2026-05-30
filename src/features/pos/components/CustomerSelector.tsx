'use client';

import { useState, useMemo } from 'react';
import { Search, UserPlus, Gift, X } from 'lucide-react';
import type { Customer } from '@/types/hpp';

export function CustomerSelector({
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
