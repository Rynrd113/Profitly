export interface Expense {
  id: string;
  type: 'fixed' | 'variable';
  category: string;
  amount: number;
  date: string;   // YYYY-MM-DD
  note?: string;
}

export type FixedExpense    = Expense & { type: 'fixed' };
export type VariableExpense = Expense & { type: 'variable' };

export const FIXED_CATEGORIES    = ['Sewa', 'Listrik', 'Internet', 'Lainnya'] as const;
export const VARIABLE_CATEGORIES = ['Gaji', 'Bahan Baku', 'Marketing', 'Lainnya'] as const;
