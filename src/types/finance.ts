export interface CashflowEntry {
  id: string;
  date: string;              // YYYY-MM-DD
  type: 'IN' | 'OUT';
  amount: number;
  category: string;
  note: string;
  referenceId?: string;      // SaleRecord.id for auto-synced IN entries
  expenseType?: 'fixed' | 'variable'; // only for OUT entries, used for BEP
}

// Legacy type kept for migration from old profitly-expenses storage
export interface Expense {
  id: string;
  type: 'fixed' | 'variable';
  category: string;
  amount: number;
  date: string;
  note?: string;
}

export const FIXED_CATEGORIES    = ['Sewa', 'Listrik', 'Internet', 'Lainnya'] as const;
export const VARIABLE_CATEGORIES = ['Gaji', 'Bahan Baku', 'Marketing', 'Lainnya'] as const;
