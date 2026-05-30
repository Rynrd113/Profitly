import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'OWNER' | 'STAFF';

interface AuthState {
  userRole: UserRole;
  ownerPin: string;
  setRole: (role: UserRole) => void;
  toggleRole: () => void;
  changePin: (newPin: string) => void;
  verifyPin: (input: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userRole: 'OWNER',
      ownerPin: '123456',
      setRole: (role) => set({ userRole: role }),
      toggleRole: () =>
        set({ userRole: get().userRole === 'OWNER' ? 'STAFF' : 'OWNER' }),
      changePin: (newPin) => set({ ownerPin: newPin }),
      verifyPin: (input) => input === get().ownerPin,
    }),
    { name: 'profitly-auth-role' },
  ),
);
