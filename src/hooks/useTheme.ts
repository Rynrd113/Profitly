'use client';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'profitly-theme';

export function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    const dark = saved !== 'light';
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, []);

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem(KEY, next ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { isDark, toggle };
}
