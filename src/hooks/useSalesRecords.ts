'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import { uid } from '@/lib/format';
import type { SaleRecord } from '@/types/hpp';

const KEY = 'profitly-sales-records';
const ARCHIVE_KEY = 'profitly-shift-archives';

export function useSalesRecords() {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [allRecords, setAllRecords] = useState<SaleRecord[]>([]);

  useEffect(() => {
    const active = storageGet<SaleRecord[]>(KEY) ?? [];
    const archives = storageGet<{ closedAt: string; records: SaleRecord[] }[]>(ARCHIVE_KEY) ?? [];
    const archived = archives.flatMap(a => a.records);
    setRecords(active);
    setAllRecords([...archived, ...active]);
  }, []);

  const add = (data: Omit<SaleRecord, 'id' | 'timestamp'>) => {
    const rec: SaleRecord = { ...data, id: uid(), timestamp: new Date().toISOString() };
    setRecords(prev => { const u = [rec, ...prev]; storageSet(KEY, u); return u; });
    setAllRecords(prev => [rec, ...prev]);
    return rec;
  };

  const cancel = (id: string) => {
    const upd = (r: SaleRecord) => r.id === id ? { ...r, cancelled: true } : r;
    setRecords(prev => { const u = prev.map(upd); storageSet(KEY, u); return u; });
    setAllRecords(prev => prev.map(upd));
  };

  const archiveShift = () => {
    const archives = storageGet<{ closedAt: string; records: SaleRecord[] }[]>(ARCHIVE_KEY) ?? [];
    archives.push({ closedAt: new Date().toISOString(), records });
    storageSet(ARCHIVE_KEY, archives);
    setRecords([]);
    storageSet(KEY, []);
  };

  return { records, allRecords, add, cancel, archiveShift };
}
