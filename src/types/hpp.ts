export interface Ingredient {
  id: string;
  name: string;
  purchasePrice: number;    // Harga beli total
  purchaseVolume: number;   // Isi/berat total (misal 1000)
  unit: 'gr' | 'ml' | 'pcs';
  usage: number;            // Jumlah yang dipakai di resep
}

export interface OperationalCost {
  id: string;
  name: string;
  price: number;
  usage: number;            // Persentase atau porsi yang dibebankan
}

export interface PricingTier {
  label: 'competitive' | 'standard' | 'premium';
  margin: number;       // Desimal, misal 0.20
  sellPrice: number;    // Sudah dibulatkan ke kelipatan 500
  profit: number;       // sellPrice - hpp
}

export interface CalculationResult {
  hpp: number;
  tiers: PricingTier[];
  bepUnit: number;
  bepRevenue: number;
}

export interface ProcessingCost {
  id: string;
  name: string;
  price: number;
}

export interface DerivedIngredient {
  id: string;
  name: string;
  unit: 'gr' | 'ml' | 'pcs';
  costPerUnit: number;
}

export interface DerivedProductOutput {
  id: string;
  name: string;
  qty: number;
  unit: 'gr' | 'ml' | 'pcs';
  sellPrice: number;
  hpp: number;
}
