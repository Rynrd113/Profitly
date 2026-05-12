import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
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
    <html lang="id" className={`${bricolage.variable} ${jakarta.variable}`}>
      <head>
        <meta name="theme-color" content="#1A6B3C" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}
        `.trim() }} />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
