'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '@/lib/format';
import type { SaleRecord } from '@/types/hpp';

const ACTIVE_KEY  = 'profitly-sales-records';
const ARCHIVE_KEY = 'profitly-shift-archives';

function b64(d: unknown) { try { return btoa(encodeURIComponent(JSON.stringify(d))); } catch { return JSON.stringify(d); } }
function db64<T>(r: string): T { try { return JSON.parse(decodeURIComponent(atob(r))) as T; } catch { return JSON.parse(r) as T; } }

function makeStorage<S>(key: string) {
  return createJSONStorage<S>(() => ({
    getItem: (k) => { const r = localStorage.getItem(k); return r ? db64<string>(r) : null; },
    setItem: (k, v) => localStorage.setItem(k, b64(v)),
    removeItem: (k) => localStorage.removeItem(k),
  }));
}

interface SalesState {
  /** Active shift records only */
  records: SaleRecord[];
  /** Merged active + all archives — Financial Health reads this */
  allRecords: SaleRecord[];
  add: (data: Omit<SaleRecord, 'id' | 'timestamp'>) => SaleRecord;
  cancel: (id: string) => void;
  archiveShift: () => void;
  hydrate: () => void;
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get) => ({
      records: [],
      allRecords: [],

      hydrate: () => {
        const active = (() => {
          try {
            const r = localStorage.getItem(ACTIVE_KEY);
            return r ? db64<SaleRecord[]>(r) : [];
          } catch { return []; }
        })();
        const archives = (() => {
          try {
            const r = localStorage.getItem(ARCHIVE_KEY);
            return r ? db64<{ closedAt: string; records: SaleRecord[] }[]>(r) : [];
          } catch { return []; }
        })();
        const archived = archives.flatMap(a => a.records);
        set({ records: active, allRecords: [...archived, ...active] });
      },

      add: (data) => {
        const rec: SaleRecord = { paymentMethod: 'CASH', ...data, id: uid(), timestamp: new Date().toISOString() };
        set(s => {
          const records = [rec, ...s.records];
          localStorage.setItem(ACTIVE_KEY, b64(records));
          return { records, allRecords: [rec, ...s.allRecords] };
        });
        return rec;
      },

      cancel: (id) => {
        const upd = (r: SaleRecord) => r.id === id ? { ...r, cancelled: true } : r;
        set(s => {
          const records = s.records.map(upd);
          localStorage.setItem(ACTIVE_KEY, b64(records));
          return { records, allRecords: s.allRecords.map(upd) };
        });
      },

      archiveShift: () => {
        const { records } = get();
        try {
          const existing = (() => { const r = localStorage.getItem(ARCHIVE_KEY); return r ? db64<{ closedAt: string; records: SaleRecord[] }[]>(r) : []; })();
          existing.push({ closedAt: new Date().toISOString(), records });
          localStorage.setItem(ARCHIVE_KEY, b64(existing));
        } catch { /* non-fatal */ }
        localStorage.setItem(ACTIVE_KEY, b64([]));
        set(s => ({ records: [], allRecords: s.allRecords }));
      },
    }),
    { name: ACTIVE_KEY, storage: makeStorage(ACTIVE_KEY) },
  ),
);
