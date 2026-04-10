import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '시니어 건강백과',
    short_name: '건강백과',
    description: '50·60대를 위한 혈당·혈압·관절·수면·치매 예방 건강 정보',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F2FAF7',
    theme_color: '#1E9E7A',
    categories: ['health', 'lifestyle', 'medical'],
    lang: 'ko',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa-icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
