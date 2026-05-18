'use client';

import { useState, useEffect } from 'react';

export function OnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
        px-4 py-2 rounded-full border text-xs font-semibold shadow-lg
        bg-[#422006] border-[#92400E] text-[#FCD34D]"
    >
      <span className="w-2 h-2 rounded-full bg-[#FCD34D] animate-pulse" />
      Offline — data disimpan lokal
    </div>
  );
}
