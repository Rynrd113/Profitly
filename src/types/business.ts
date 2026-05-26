export type BusinessType = 'FNB' | 'SERVICE' | 'MARKETPLACE' | 'WHOLESALE';

export interface ServicePrice {
  hourRate: number;
  toolCost: number;
}

export interface MarketplaceFee {
  adminPercent: number;
  fixedFee: number;
  adCost: number;
}
