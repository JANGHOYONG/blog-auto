import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
      // 네이버 검색 봇 명시적 허용
      {
        userAgent: 'Yeti',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
      // 다음 검색 봇 명시적 허용
      {
        userAgent: 'Daum',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
      // Bingbot (네이버 제휴 검색 인덱스)
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
      // AI 학습 봇 차단
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
