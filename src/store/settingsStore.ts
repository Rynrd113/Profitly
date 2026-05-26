import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BusinessType } from '@/types/business';

export interface BusinessProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  footer: string;
  businessType: BusinessType;
  wholesaleUnitName?: string;
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
        businessType: 'FNB',
      },
      setProfile: (p) => set(s => ({ profile: { ...s.profile, ...p } })),
    }),
    { name: 'profitly-settings' },
  ),
);
