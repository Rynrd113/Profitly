import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'OWNER' | 'STAFF';

interface AuthState {
  userRole: UserRole;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userRole: 'OWNER',
      setRole: (role) => set({ userRole: role }),
      toggleRole: () => set({ userRole: get().userRole === 'OWNER' ? 'STAFF' : 'OWNER' }),
    }),
    { name: 'profitly-auth-role' },
  ),
);
