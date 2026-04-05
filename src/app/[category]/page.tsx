import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import ArticleCard from '@/components/ArticleCard';
import AdSense from '@/components/AdSense';

export const revalidate = 3600;

interface Props {
  params: { category: string };
  searchParams: { page?: string };
}

const PAGE_SIZE = 12;

// 카테고리별 풍부한 SEO 메타 description 맵
const CATEGORY_META: Record<string, { title: string; description: string; keywords: string[] }> = {
  health: {
    title: '시니어 건강 정보 — 5060 중장년 건강 백과',
    description: '50·60대를 위한 혈압·혈당·관절·수면·치매 예방 건강 정보. 전문의가 검토한 신뢰할 수 있는 건강 지식과 오늘 당장 실천할 수 있는 생활 습관 가이드를 제공합니다.',
    keywords: ['시니어 건강', '5060 건강', '중장년 건강', '건강 정보', '혈압 관리', '혈당 조절'],
  },
  tech: {
    title: 'IT·테크 정보 — 스마트폰·앱 활용 가이드',
    description: '시니어도 쉽게 따라하는 스마트폰·앱·AI 활용법. 디지털 세상을 편리하게 만드는 실용 IT 정보와 최신 기술 트렌드를 알기 쉽게 안내합니다.',
    keywords: ['시니어 IT', '스마트폰 활용', '앱 사용법', 'IT 정보', '디지털 생활'],
  },
  economy: {
    title: '재테크·경제 정보 — 은퇴 준비 & 자산 관리',
    description: '5060 중장년층을 위한 은퇴 준비·연금·부동산·절세 전략. 공인 재무설계사가 알려주는 실전 재테크 가이드로 노후 자산을 든든하게 지키세요.',
    keywords: ['은퇴 준비', '노후 자산 관리', '연금', '재테크', '절세', '부동산 투자'],
  },
  lifestyle: {
    title: '라이프스타일 — 건강한 일상·취미·여가',
    description: '건강하고 활기찬 중장년 라이프스타일 정보. 취미·운동·요리·여가 활용까지, 삶의 질을 높이는 생활 습관과 실용 꿀팁을 소개합니다.',
    keywords: ['중장년 라이프스타일', '시니어 취미', '건강한 일상', '생활 꿀팁'],
  },
  travel: {
    title: '여행 정보 — 5060 시니어 국내외 여행 가이드',
    description: '중장년이 편안하게 즐기는 국내외 여행 정보. 시니어 친화 여행지·코스·숙소 추천과 여행 준비 노하우, 건강한 여행을 위한 실용 팁을 제공합니다.',
    keywords: ['시니어 여행', '5060 여행', '국내 여행', '해외 여행', '여행 준비'],
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await prisma.category.findUnique({
    where: { slug: params.category },
  });

  if (!category) return {};

  const meta = CATEGORY_META[params.category];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';

  return {
    title: meta?.title || `${category.name} 글 모음 | 시니어 건강백과`,
    description: category.description || meta?.description || `${category.name} 관련 유용한 정보 모음. 전문가가 검토한 신뢰할 수 있는 최신 정보를 확인하세요.`,
    keywords: meta?.keywords,
    alternates: {
      canonical: `${siteUrl}/${params.category}`,
    },
    openGraph: {
      title: meta?.title || `${category.name} | 시니어 건강백과`,
      description: category.description || meta?.description || `${category.name} 관련 정보`,
      url: `${siteUrl}/${params.category}`,
      siteName: '시니어 건강백과',
      locale: 'ko_KR',
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  const categories = await prisma.category.findMany();
  return categories.map((cat) => ({ category: cat.slug }));
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await prisma.category.findUnique({
    where: { slug: params.category },
  });

  if (!category) notFound();

  const page = parseInt(searchParams.page || '1');
  const skip = (page - 1) * PAGE_SIZE;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'PUBLISHED', categoryId: category.id },
      include: { category: true },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.post.count({
      where: { status: 'PUBLISHED', categoryId: category.id },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '홈',
        item: process.env.NEXT_PUBLIC_SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.name,
        item: `${process.env.NEXT_PUBLIC_SITE_URL}/${category.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 카테고리 헤더 */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <nav className="text-sm text-gray-400 mb-3">
            <a href="/" className="hover:text-primary-600">홈</a>
            <span className="mx-2">/</span>
            <span className="text-gray-700">{category.name}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
          {category.description && (
            <p className="text-gray-500 mt-2">{category.description}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">총 {total}개의 글</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 상단 광고 */}
        <AdSense slot="category-top" format="horizontal" className="mb-8" />

        {posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>아직 글이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <nav className="mt-10 flex justify-center gap-2" aria-label="페이지 탐색">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/${category.slug}?page=${p}`}
                className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </a>
            ))}
          </nav>
        )}

        {/* 하단 광고 */}
        <AdSense slot="category-bottom" format="horizontal" className="mt-8" />
      </div>
    </>
  );
}
