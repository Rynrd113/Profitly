import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'OWNER' | 'STAFF';

interface AuthState {
  userRole: UserRole;
  setRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userRole: 'OWNER',
      setRole: (role) => set({ userRole: role }),
    }),
    { name: 'profitly-auth-role' },
  ),
);
