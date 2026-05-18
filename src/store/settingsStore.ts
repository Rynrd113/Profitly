import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BusinessProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  footer: string;
}

interface SettingsState {
  profile: BusinessProfile;
  setProfile: (p: Partial<BusinessProfile>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      profile: {
        name: 'ProfitLy',
        tagline: '',
        address: '',
        phone: '',
        footer: 'Terima kasih atas kunjungan Anda!',
      },
      setProfile: (p) => set(s => ({ profile: { ...s.profile, ...p } })),
    }),
    { name: 'profitly-settings' },
  ),
);
