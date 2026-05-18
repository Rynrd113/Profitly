import { create } from 'zustand';

interface PriceStore {
  targetPrice: number | null;
  setTargetPrice: (price: number) => void;
  clearTargetPrice: () => void;
}

export const usePriceStore = create<PriceStore>(set => ({
  targetPrice: null,
  setTargetPrice: (price) => set({ targetPrice: price }),
  clearTargetPrice: () => set({ targetPrice: null }),
}));
