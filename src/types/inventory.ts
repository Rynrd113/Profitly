export interface StockLog {
  id: string;
  ingredientId: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  amount: number;
  reason: string;
  timestamp: string;
  supplierId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address: string;
  supplies: string[];
}
