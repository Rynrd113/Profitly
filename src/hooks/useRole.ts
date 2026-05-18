'use client';
import { useCallback, useEffect, useState } from 'react';

export type AppRole = 'owner' | 'kasir';

const ROLE_KEY = 'profitly-role';
const PIN_KEY  = 'profitly-owner-pin';

export function useRole() {
  const [role, setRole] = useState<AppRole>('owner');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(ROLE_KEY) as AppRole | null;
    if (saved === 'kasir') setRole('kasir');
    setReady(true);
  }, []);

  const switchToKasir = useCallback(() => {
    localStorage.setItem(ROLE_KEY, 'kasir');
    setRole('kasir');
  }, []);

  /** Returns true on success. Requires correct PIN if one is set. */
  const switchToOwner = useCallback((pin?: string): boolean => {
    const savedPin = localStorage.getItem(PIN_KEY);
    if (savedPin && pin !== savedPin) return false;
    localStorage.setItem(ROLE_KEY, 'owner');
    setRole('owner');
    return true;
  }, []);

  const setPin = useCallback((pin: string) => {
    if (pin.trim()) localStorage.setItem(PIN_KEY, pin.trim());
    else localStorage.removeItem(PIN_KEY);
  }, []);

  const hasPin = (): boolean => !!localStorage.getItem(PIN_KEY);

  return { role, isOwner: role === 'owner', ready, switchToKasir, switchToOwner, setPin, hasPin };
}
