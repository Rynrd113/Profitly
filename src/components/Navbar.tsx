'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChefHat, BarChart3, FlaskConical, ShoppingCart, HeartPulse,
  Settings, Menu, X, Sun, Moon, Lock, Unlock, ChevronDown, Package, Wallet,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAdminStore } from '@/store/adminStore';
import { useAuthStore } from '@/store/authStore';

type ActivePage = 'dashboard' | 'calculator' | 'pos' | 'financial-health' | 'finance' | 'settings' | 'inventory';

const ADMIN_ROUTES = new Set(['/dashboard', '/calculator', '/financial-health', '/finance', '/settings', '/inventory']);

const adminLinks: { page: ActivePage; href: string; Icon: React.ElementType; label: string }[] = [
  { page: 'dashboard',        href: '/dashboard',        Icon: BarChart3,    label: 'Dashboard'  },
  { page: 'calculator',       href: '/calculator',       Icon: FlaskConical, label: 'Kalkulator' },
  { page: 'inventory',        href: '/inventory',        Icon: Package,      label: 'Inventori'  },
  { page: 'financial-health', href: '/financial-health', Icon: HeartPulse,   label: 'Keuangan'   },
  { page: 'finance',          href: '/finance',          Icon: Wallet,       label: 'Arus Kas'   },
  { page: 'settings',         href: '/settings',         Icon: Settings,     label: 'Pengaturan' },
];

const allLinks = [
  { page: 'pos' as ActivePage, href: '/pos', Icon: ShoppingCart, label: 'Kasir' },
  ...adminLinks,
];

const ADMIN_PAGES = new Set<ActivePage>(['dashboard', 'calculator', 'financial-health', 'finance', 'settings', 'inventory']);
const OWNER_ONLY_PAGES = new Set<ActivePage>(['financial-health', 'finance', 'settings']);

export function Navbar({ active }: { active: ActivePage }) {
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { isDark, toggle } = useTheme();
  const router = useRouter();
  const { isAuthenticated, authenticate } = useAdminStore();
  const { userRole: _role } = useAuthStore();
  const userRole = _role || 'OWNER';
  const visibleAdminLinks = adminLinks.filter(l => userRole === 'OWNER' || !OWNER_ONLY_PAGES.has(l.page));
  const visibleAllLinks = allLinks.filter(l => userRole === 'OWNER' || !OWNER_ONLY_PAGES.has(l.page));
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (pendingRoute === null) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleModalClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [pendingRoute]);

  const handleAdminNav = (e: React.MouseEvent, href: string) => {
    if (!ADMIN_ROUTES.has(href)) return;
    if (isAuthenticated) return;
    e.preventDefault();
    setOpen(false);
    setDropdownOpen(false);
    setPendingRoute(href);
    setPin('');
    setPinError(false);
  };

  const handleUnlock = () => {
    if (!useAuthStore.getState().verifyPin(pin)) {
      setPinError(true);
      return;
    }
    localStorage.setItem('profitly-role', 'owner');
    authenticate();
    const target = pendingRoute!;
    setPendingRoute(null);
    setPin('');
    router.push(target);
  };

  const handleModalClose = () => {
    setPendingRoute(null);
    setPin('');
    setPinError(false);
  };

  const isAdminActive = ADMIN_PAGES.has(active);

  return (
    <>
      <header className="sticky top-0 z-20 glass border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#27B18A] flex items-center justify-center">
              <ChefHat size={15} color="white" />
            </div>
            <span
              className="font-bold text-[var(--text)] text-lg tracking-tight"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              ProfitLy
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {/* POS — always accessible, first */}
            <Link
              href="/pos"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                transition-colors ${active === 'pos'
                  ? 'bg-[#27B18A] text-white'
                  : 'border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[#27B18A]/40 hover:bg-[#27B18A]/5'
                }`}
            >
              <ShoppingCart size={13} />
              Kasir
            </Link>

            {/* Admin dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                  transition-colors ${isAdminActive
                    ? 'bg-[#27B18A] text-white'
                    : 'border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[#27B18A]/40 hover:bg-[#27B18A]/5'
                  }`}
              >
                <Lock size={13} />
                Pengelola
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 top-10 z-30 bg-[var(--surface)] border border-[var(--border)]
                  rounded-xl shadow-xl py-1.5 min-w-[180px]">
                  {visibleAdminLinks.map(({ page, href, Icon, label }) => (
                    <Link
                      key={page}
                      href={href}
                      onClick={e => { handleAdminNav(e, href); setDropdownOpen(false); }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors
                        ${active === page
                          ? 'text-[#27B18A] bg-[#27B18A]/10'
                          : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg)]'
                        }`}
                    >
                      <Icon size={14} />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--border)]
                text-[var(--text-4)] hover:bg-[var(--surface)] hover:text-[var(--text-2)] transition-colors"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
              className="sm:hidden w-11 h-11 flex items-center justify-center rounded-xl
                border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface)] transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar */}
      {open && (
        <>
          <div className="sm:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="sm:hidden fixed top-0 right-0 bottom-0 z-40 w-72 bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border)] shrink-0">
              <span
                className="font-bold text-[var(--text)] text-base"
                style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
                className="w-11 h-11 flex items-center justify-center rounded-xl
                  text-[var(--text-2)] hover:bg-[var(--bg)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {visibleAllLinks.map(({ page, href, Icon, label }) => (
                <Link
                  key={page}
                  href={href}
                  onClick={e => { handleAdminNav(e, href); setOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold
                    transition-colors ${active === page
                      ? 'bg-[#27B18A] text-white'
                      : 'text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
                    }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* PIN unlock modal */}
      {pendingRoute !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 text-center max-w-sm w-full shadow-xl"
            style={{ fontFamily: 'var(--font-jakarta, system-ui, sans-serif)' }}
          >
            <div className="w-12 h-12 rounded-full bg-[var(--tint-red)] flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-[#DC2626]" />
            </div>
            <h2
              className="text-lg font-bold text-[var(--text)] mb-2"
              style={{ fontFamily: 'var(--font-bricolage, system-ui)' }}
            >
              Akses Pengelola
            </h2>
            <p className="text-sm text-[var(--text-3)] mb-5">
              Halaman ini hanya bisa diakses oleh Pengelola.
            </p>

            <div className="mb-4 text-left space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)] block">
                PIN Pengelola
              </label>
              <input
                type="password"
                placeholder="Masukkan PIN"
                value={pin}
                autoFocus
                onChange={e => { setPin(e.target.value); setPinError(false); }}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                className={`w-full bg-[var(--bg)] border rounded-xl px-3 py-2.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#27B18A]/20 focus:border-[#27B18A]
                  ${pinError ? 'border-[#DC2626]' : 'border-[var(--border)]'}`}
              />
              {pinError && <p className="text-xs text-[#DC2626]">PIN salah</p>}
              <button
                type="button"
                onClick={handleUnlock}
                className="w-full flex items-center justify-center gap-2 bg-[#27B18A] text-white
                  py-2.5 rounded-xl font-semibold text-sm hover:bg-[#0E927A] transition-colors"
              >
                <Unlock size={14} />
                Buka Kunci
              </button>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="w-full py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-2)]
                font-semibold text-sm hover:bg-[var(--bg)] transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </>
  );
}
