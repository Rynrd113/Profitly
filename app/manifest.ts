import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ProfitLy — Kalkulator HPP',
    short_name: 'ProfitLy',
    description: 'Hitung HPP, saran harga jual, dan titik impas untuk bisnis kuliner Anda.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#27B18A',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
