import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ProfitLy — Kalkulator HPP',
    short_name: 'ProfitLy',
    description: 'Hitung HPP, saran harga jual, dan titik impas untuk bisnis kuliner Anda.',
    start_url: '/calculator',
    display: 'standalone',
    background_color: '#F8F7F2',
    theme_color: '#1A6B3C',
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
