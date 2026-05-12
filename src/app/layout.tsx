import type { Metadata } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProfitLy — Kalkulator HPP Otomatis',
  description: 'Hitung HPP, saran harga jual, dan titik impas untuk bisnis kuliner Anda.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${bricolage.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
