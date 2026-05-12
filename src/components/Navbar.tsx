'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChefHat, BarChart3, FlaskConical, ShoppingCart,
  HeartPulse, Settings, Menu, X,
} from 'lucide-react';

type ActivePage = 'dashboard' | 'calculator' | 'pos' | 'financial-health' | 'settings';

const links: { page: ActivePage; href: string; Icon: React.ElementType; label: string }[] = [
  { page: 'dashboard',        href: '/',                 Icon: BarChart3,    label: 'Dashboard'  },
  { page: 'calculator',       href: '/calculator',       Icon: FlaskConical, label: 'Kalkulator' },
  { page: 'pos',              href: '/pos',              Icon: ShoppingCart, label: 'Kasir'      },
  { page: 'financial-health', href: '/financial-health', Icon: HeartPulse,   label: 'Keuangan'   },
  { page: 'settings',         href: '/settings',         Icon: Settings,     label: 'Pengaturan' },
];

export function Navbar({ active }: { active: ActivePage }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E5E3DD]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#1A6B3C] flex items-center justify-center">
              <ChefHat size={15} color="white" />
            </div>
            <span
              className="font-bold text-[#1A1A18] text-lg tracking-tight"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              ProfitLy
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {links.map(({ page, href, Icon, label }) => {
              const isActive = active === page;
              return (
                <Link
                  key={page}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                    transition-colors ${isActive
                      ? 'bg-[#1A6B3C] text-white'
                      : 'bg-white border border-[#E5E3DD] text-[#78716C] hover:text-[#1A6B3C] hover:border-[#1A6B3C]/30'
                    }`}
                >
                  <Icon size={13} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
            className="sm:hidden w-11 h-11 flex items-center justify-center rounded-xl
              border border-[#E5E3DD] text-[#78716C] hover:bg-[#F8F7F2] transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {open && (
        <>
          <div
            className="sm:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="sm:hidden fixed top-0 right-0 bottom-0 z-40 w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-14 border-b border-[#E5E3DD] shrink-0">
              <span
                className="font-bold text-[#1A1A18] text-base"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="w-11 h-11 flex items-center justify-center rounded-xl
                  text-[#78716C] hover:bg-[#F8F7F2] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {links.map(({ page, href, Icon, label }) => {
                const isActive = active === page;
                return (
                  <Link
                    key={page}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold
                      transition-colors ${isActive
                        ? 'bg-[#1A6B3C] text-white'
                        : 'text-[#78716C] hover:bg-[#F8F7F2] hover:text-[#1A1A18]'
                      }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
