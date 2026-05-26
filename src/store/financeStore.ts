'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '@/lib/format';
import type { CashflowEntry } from '@/types/finance';

const STORAGE_KEY = 'profitly-cashflow';

interface FinanceState {
  entries: CashflowEntry[];
  migrated: boolean;
  addEntry: (data: Omit<CashflowEntry, 'id'>) => void;
  bulkAddEntries: (dataList: Omit<CashflowEntry, 'id'>[]) => void;
  deleteEntry: (id: string) => void;
  deleteEntriesByRef: (referenceId: string) => void;
  setMigrated: () => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      entries: [],
      migrated: false,

      addEntry: (data) => {
        const entry: CashflowEntry = { ...data, id: uid() };
        set(s => ({ entries: [...s.entries, entry] }));
      },

      bulkAddEntries: (dataList) => {
        if (dataList.length === 0) return;
        const newEntries = dataList.map(d => ({ ...d, id: uid() }));
        set(s => ({ entries: [...s.entries, ...newEntries] }));
      },

      deleteEntry: (id) => {
        set(s => ({ entries: s.entries.filter(e => e.id !== id) }));
      },

      deleteEntriesByRef: (referenceId) => {
        set(s => ({ entries: s.entries.filter(e => e.referenceId !== referenceId) }));
      },

      setMigrated: () => set({ migrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && !Array.isArray(state.entries)) state.entries = [];
      },
    },
  ),
);
