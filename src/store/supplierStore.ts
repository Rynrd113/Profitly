'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '@/lib/format';
import type { Supplier } from '@/types/inventory';

interface SupplierState {
  suppliers: Supplier[];
  addSupplier: (data: Omit<Supplier, 'id'>) => void;
  updateSupplier: (id: string, data: Partial<Omit<Supplier, 'id'>>) => void;
  deleteSupplier: (id: string) => void;
}

export const useSupplierStore = create<SupplierState>()(
  persist(
    (set) => ({
      suppliers: [],

      addSupplier: (data) => {
        const supplier: Supplier = { ...data, id: uid() };
        set(s => ({ suppliers: [...s.suppliers, supplier] }));
      },

      updateSupplier: (id, data) => {
        set(s => ({
          suppliers: s.suppliers.map(s => s.id === id ? { ...s, ...data } : s),
        }));
      },

      deleteSupplier: (id) => {
        set(s => ({ suppliers: s.suppliers.filter(s => s.id !== id) }));
      },
    }),
    {
      name: 'profitly-suppliers',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
