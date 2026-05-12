'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import { uid } from '@/lib/format';
import type { StockTransaction } from '@/types/hpp';

const KEY = 'profitly-stock-transactions';
const MAX_HISTORY = 50;

export function useStockTransactions() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);

  useEffect(() => {
    const loaded = storageGet<StockTransaction[]>(KEY);
    if (loaded) setTransactions(loaded);
  }, []);

  const add = (tx: Omit<StockTransaction, 'id' | 'timestamp'>) => {
    setTransactions(prev => {
      const newTx: StockTransaction = {
        ...tx,
        id: uid(),
        timestamp: new Date().toISOString(),
      };
      const updated = [newTx, ...prev].slice(0, MAX_HISTORY);
      storageSet(KEY, updated);
      return updated;
    });
  };

  return { transactions, add };
}
