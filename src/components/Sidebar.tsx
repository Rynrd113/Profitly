'use client';

import Link from 'next/link';
import {
  BarChart3, FlaskConical, Package, HeartPulse, Settings,
  History, ShoppingCart as ShoppingCartIcon, Truck, Users,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface SidebarLink {
  href: string;
  label: string;
  Icon: React.ElementType;
  ownerOnly?: boolean;
}

const NAV_LINKS: SidebarLink[] = [
  { href: '/dashboard',          label: 'Dashboard',        Icon: BarChart3     },
  { href: '/calculator',         label: 'Kalkulator',       Icon: FlaskConical  },
  { href: '/inventory',          label: 'Inventori',        Icon: Package       },
  { href: '/inventory/history',  label: 'Riwayat Stok',     Icon: History,       ownerOnly: true },
  { href: '/inventory/suppliers',label: 'Supplier',         Icon: Truck         },
  { href: '/inventory/procurement', label: 'Daftar Belanja',Icon: ShoppingCartIcon },
  { href: '/financial-health',   label: 'Kesehatan Keuangan', Icon: HeartPulse,  ownerOnly: true },
  { href: '/customers',          label: 'Pelanggan',        Icon: Users         },
  { href: '/settings',           label: 'Pengaturan',       Icon: Settings,      ownerOnly: true },
];

interface Props {
  activeHref?: string;
  className?: string;
}

export function Sidebar({ activeHref, className = '' }: Props) {
  const { userRole } = useAuthStore();
  const visible = NAV_LINKS.filter(l => !l.ownerOnly || userRole === 'OWNER');

  return (
    <nav
      className={`flex flex-col gap-0.5 ${className}`}
      aria-label="Sidebar navigation"
    >
      {visible.map(({ href, label, Icon, ownerOnly }) => {
        const isActive = activeHref === href;
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
              ${isActive
                ? 'bg-[#27B18A] text-white'
                : 'text-[var(--text-2)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
          >
            <span className="flex items-center gap-3">
              <Icon size={16} />
              {label}
            </span>
            {!isActive && (
              <ChevronRight
                size={13}
                className="opacity-0 group-hover:opacity-40 transition-opacity"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
