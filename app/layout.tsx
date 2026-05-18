import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { OnlineStatus } from "@/components/OnlineStatus";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProfitLy — Kalkulator HPP Otomatis",
  description: "Hitung HPP, saran harga jual, dan titik impas untuk bisnis kuliner Anda.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProfitLy",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${bricolage.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#27B18A" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Script id="sw-register" strategy="afterInteractive">{`
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}
        `}</Script>
      </head>
      <body>
        {children}
        <OnlineStatus />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{ style: { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' } }}
        />
      </body>
    </html>
  );
}
