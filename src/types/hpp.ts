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

export interface PriceHistoryEntry {
  price: number;
  volume: number;
  recordedAt: string;
}

export interface SavedRawIngredient {
  name: string;           // primary key — upsert by name
  purchasePrice: number;
  purchaseVolume: number;
  unit: 'gr' | 'ml' | 'pcs';
  currentStock?: number;
  minStock?: number;
  priceHistory?: PriceHistoryEntry[];
}

export interface StockTransactionItem {
  ingredientName: string;
  delta: number;          // negative = deduct, positive = restock/adjustment
  unit: 'gr' | 'ml' | 'pcs';
  balanceBefore: number;
  balanceAfter: number;
}

export interface StockTransaction {
  id: string;
  timestamp: string;
  note: string;
  items: StockTransactionItem[];
}

export interface SaleItem {
  recipeId: string;
  recipeName: string;
  qty: number;
  sellPrice: number;
  hpp: number;
  subtotal: number;
}

export interface SaleDeduction {
  name: string;
  amount: number;
  unit: 'gr' | 'ml' | 'pcs';
}

export interface SaleRecord {
  id: string;
  businessId?: string;
  timestamp: string;
  tier: 'competitive' | 'standard' | 'premium';
  items: SaleItem[];
  totalRevenue: number;
  totalHPP: number;
  grossProfit: number;
  deductions?: SaleDeduction[];
  cancelled?: boolean;
  note?: string;
  paymentMethod?: 'CASH' | 'QRIS';
  customerId?: string;
  loyaltyRedeemed?: boolean;
  discountType?: 'percent' | 'nominal';
  discountValue?: number;
  discountAmount?: number;
  customerPhone?: string;
  customerName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  stamps: number;
  totalOrders: number;
  createdAt: string;
}

export interface SavedRecipeIngredient {
  id: string;
  name: string;
  purchasePrice: string;
  purchaseVolume: string;
  unit: 'gr' | 'ml' | 'pcs';
  usage: string;
  yieldFactor: string;
  isDerived?: boolean;
}

export interface SavedRecipeOp {
  id: string;
  name: string;
  price: string;
  usage: string;
}

export interface SavedRecipe {
  id: string;
  name: string;
  savedAt: string;                       // ISO date string
  mode: 'satuan' | 'batch';
  ingredients: SavedRecipeIngredient[];
  ops: SavedRecipeOp[];
  batchSize: string;
  fixedCost: string;
  hpp: number;
  inventoryIngredients?: Array<{ inventoryId: string; quantity: number }>;
}
