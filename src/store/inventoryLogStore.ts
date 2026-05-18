'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '@/lib/format';
import type { StockLog } from '@/types/inventory';

interface InventoryLogState {
  stockLogs: StockLog[];
  addLog: (log: Omit<StockLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

export const useInventoryLogStore = create<InventoryLogState>()(
  persist(
    (set) => ({
      stockLogs: [],

      addLog: (log) => {
        const entry: StockLog = {
          ...log,
          id: uid(),
          timestamp: new Date().toISOString(),
        };
        set(s => ({ stockLogs: [entry, ...s.stockLogs] }));
      },

      clearLogs: () => set({ stockLogs: [] }),
    }),
    {
      name: 'profitly-inventory-logs',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
