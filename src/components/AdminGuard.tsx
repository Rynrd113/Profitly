'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/store/adminStore';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, authenticate } = useAdminStore();

  useEffect(() => {
    const role = localStorage.getItem('profitly-role');
    if (isAuthenticated || role === 'owner') {
      if (!isAuthenticated) authenticate();
    } else {
      router.push('/pos');
    }
  }, []);

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
