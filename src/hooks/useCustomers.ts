'use client';

import { useState, useEffect } from 'react';
import { storageGet, storageSet } from '@/lib/storage';
import type { Customer } from '@/types/hpp';

const KEY = 'profitly-customers';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const data = storageGet<Customer[]>(KEY);
    if (data) setCustomers(data);
  }, []);

  function persist(list: Customer[]) {
    setCustomers(list);
    storageSet(KEY, list);
  }

  function addCustomer(name: string, phone: string): Customer {
    const c: Customer = {
      id: uid(),
      name: name.trim(),
      phone: phone.trim(),
      stamps: 0,
      totalOrders: 0,
      createdAt: new Date().toISOString(),
    };
    const next = [...customers, c];
    persist(next);
    return c;
  }

  function updateAfterOrder(id: string, qtyBought: number, wasLoyaltyFree: boolean) {
    persist(customers.map(c => c.id !== id ? c : {
      ...c,
      stamps: wasLoyaltyFree ? 0 : Math.min(c.stamps + qtyBought, 10),
      totalOrders: c.totalOrders + 1,
    }));
  }

  function deleteCustomer(id: string) {
    persist(customers.filter(c => c.id !== id));
  }

  return { customers, addCustomer, updateAfterOrder, deleteCustomer };
}
