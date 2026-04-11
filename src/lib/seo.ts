import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Smart Info Blog';

export function generateMetadata({
  title,
  description,
  slug,
  category,
  publishedAt,
  keywords,
  thumbnail,
}: {
  title: string;
  description: string;
  slug?: string;
  category?: string;
  publishedAt?: Date;
  keywords?: string[];
  thumbnail?: string | null;
}): Metadata {
  const url = slug
    ? category
      ? `${SITE_URL}/${category}/${slug}`
      : `${SITE_URL}/${slug}`
    : SITE_URL;

  const ogImage = thumbnail
    ? [{ url: thumbnail, width: 1200, height: 630, alt: title }]
    : [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: SITE_NAME }];

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    keywords: keywords?.join(', '),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'ko_KR',
      type: publishedAt ? 'article' : 'website',
      images: ogImage,
      ...(publishedAt && {
        publishedTime: publishedAt.toISOString(),
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage.map((i) => i.url),
    },
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export function generateJsonLd({
  type,
  title,
  description,
  slug,
  category,
  publishedAt,
  updatedAt,
  keywords,
}: {
  type: 'Article' | 'WebSite' | 'BreadcrumbList';
  title: string;
  description: string;
  slug?: string;
  category?: string;
  publishedAt?: Date;
  updatedAt?: Date;
  keywords?: string[];
}) {
  const url = slug
    ? category
      ? `${SITE_URL}/${category}/${slug}`
      : `${SITE_URL}/${slug}`
    : SITE_URL;

  if (type === 'WebSite') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    };
  }

  if (type === 'Article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url,
      datePublished: publishedAt?.toISOString(),
      dateModified: updatedAt?.toISOString() || publishedAt?.toISOString(),
      author: {
        '@type': 'Person',
        name: '시니어 건강백과 의료 자문단',
        description: '내과·가정의학과 전문의 및 시니어 건강 전문 칼럼니스트로 구성된 자문단',
        url: `${SITE_URL}/about`,
      },
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/icon`,
        },
      },
      keywords: keywords?.join(', '),
      inLanguage: 'ko-KR',
    };
  }

  return null;
}

// 읽기 시간 계산 (한국어 기준 분당 약 500자)
export function calculateReadTime(content: string): number {
  const textLength = content.replace(/<[^>]*>/g, '').length;
  return Math.max(1, Math.ceil(textLength / 500));
}

// 발췌문 생성
export function generateExcerpt(content: string, maxLength = 160): string {
  const text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}
