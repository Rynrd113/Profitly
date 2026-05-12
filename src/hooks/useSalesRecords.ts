'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import { uid } from '@/lib/format';
import type { SaleRecord } from '@/types/hpp';

const KEY = 'profitly-sales-records';

export function useSalesRecords() {
  const [records, setRecords] = useState<SaleRecord[]>([]);

  useEffect(() => {
    const loaded = storageGet<SaleRecord[]>(KEY);
    if (loaded) setRecords(loaded);
  }, []);

  const add = (data: Omit<SaleRecord, 'id' | 'timestamp'>) => {
    const newRecord: SaleRecord = {
      ...data,
      id: uid(),
      timestamp: new Date().toISOString(),
    };
    setRecords(prev => {
      const updated = [newRecord, ...prev];
      storageSet(KEY, updated);
      return updated;
    });
    return newRecord;
  };

  const cancel = (id: string) => {
    setRecords(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, cancelled: true } : r);
      storageSet(KEY, updated);
      return updated;
    });
  };

  const archiveShift = () => {
    const archives = storageGet<{ closedAt: string; records: SaleRecord[] }[]>('profitly-shift-archives') ?? [];
    archives.push({ closedAt: new Date().toISOString(), records });
    storageSet('profitly-shift-archives', archives);
    setRecords([]);
    storageSet(KEY, []);
  };

  return { records, add, cancel, archiveShift };
}
