import { create } from 'zustand';

interface AdminStore {
  isAuthenticated: boolean;
  authenticate: () => void;
  reset: () => void;
}

export const useAdminStore = create<AdminStore>(set => ({
  isAuthenticated: false,
  authenticate: () => set({ isAuthenticated: true }),
  reset: () => set({ isAuthenticated: false }),
}));
