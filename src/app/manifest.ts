import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '시니어 건강백과',
    short_name: '건강백과',
    description: '50·60대를 위한 건강 정보 블로그',
    start_url: '/',
    display: 'standalone',
    background_color: '#F2FAF7',
    theme_color: '#1E9E7A',
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
    ],
  };
}
