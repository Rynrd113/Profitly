'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uid } from '@/lib/format';

export interface CRMCustomer {
  id: string;
  name: string;
  whatsapp: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

interface CustomerState {
  customers: CRMCustomer[];
  upsertCustomer: (name: string, whatsapp: string, amount: number) => void;
  deleteCustomer: (id: string) => void;
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: [],

      upsertCustomer: (name, whatsapp, amount) => {
        const wa = whatsapp.trim();
        const existing = get().customers.find(c => c.whatsapp === wa);
        if (existing) {
          set(s => ({
            customers: s.customers.map(c =>
              c.whatsapp === wa
                ? { ...c, totalOrders: c.totalOrders + 1, totalSpent: c.totalSpent + amount }
                : c,
            ),
          }));
        } else {
          const customer: CRMCustomer = {
            id: uid(),
            name: name.trim() || wa,
            whatsapp: wa,
            totalOrders: 1,
            totalSpent: amount,
            createdAt: new Date().toISOString(),
          };
          set(s => ({ customers: [...s.customers, customer] }));
        }
      },

      deleteCustomer: (id) => {
        set(s => ({ customers: s.customers.filter(c => c.id !== id) }));
      },
    }),
    {
      name: 'profitly-crm-customers',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
