'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '@/lib/format';
import type { Expense } from '@/types/finance';

const STORAGE_KEY = 'profitly-expenses';

interface FinanceState {
  expenses: Expense[];
  addExpense: (data: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      expenses: [],

      addExpense: (data) => {
        const expense: Expense = { ...data, id: uid() };
        set(s => ({ expenses: [...s.expenses, expense] }));
      },

      deleteExpense: (id) => {
        set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
