export const WHOLESALE_UNITS = ['kg', 'ton', 'kwintal', 'liter', 'pcs'] as const;
export type WholesaleUnit = typeof WHOLESALE_UNITS[number];
