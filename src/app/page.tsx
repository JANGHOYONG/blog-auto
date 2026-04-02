import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { generateJsonLd } from '@/lib/seo';
import ArticleCard from '@/components/ArticleCard';
import SkeletonCard from '@/components/SkeletonCard';
import TopBar from '@/components/TopBar';
import AdSense from '@/components/AdSense';

export const revalidate = 1800;

const CATEGORIES = [
  { name: '전체', slug: '' },
  { name: '건강·의학', slug: 'health' },
  { name: 'IT·테크', slug: 'tech' },
  { name: '경제·재테크', slug: 'economy' },
  { name: '생활정보', slug: 'lifestyle' },
  { name: '여행·문화', slug: 'travel' },
];

export default async function HomePage() {
  const recentPosts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
    orderBy: { publishedAt: 'desc' },
    take: 12,
  });

  const jsonLd = generateJsonLd({
    type: 'WebSite',
    title: process.env.NEXT_PUBLIC_SITE_NAME || 'Smart Info Blog',
    description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '유용한 정보 블로그',
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 방문자 통계 + 인기글 바 */}
      <Suspense fallback={null}>
        <TopBar />
      </Suspense>

      {/* 카테고리 필터 탭 */}
      <div className="border-b bg-white" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug || 'all'}
                href={cat.slug ? `/${cat.slug}` : '/'}
                className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                style={{ color: 'var(--text-muted)' }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* 상단 광고 */}
        <div className="mb-8">
          <AdSense slot="top-banner" format="horizontal" />
        </div>

        {recentPosts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl mb-3">✍️</p>
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>아직 게시된 글이 없습니다.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>곧 새 글이 업로드됩니다!</p>
          </div>
        ) : (
          <>
            <Suspense fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            }>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recentPosts.map((post) => (
                  <ArticleCard key={post.id} post={post} />
                ))}
              </div>
            </Suspense>

            {/* 더보기 안내 */}
            {recentPosts.length >= 12 && (
              <div className="text-center mt-10">
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>카테고리별로 더 많은 글을 확인하세요</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {CATEGORIES.slice(1).map((cat) => (
                    <Link key={cat.slug} href={`/${cat.slug}`}
                      className="px-5 py-2 rounded-full text-sm font-medium transition-colors border hover:opacity-80"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'transparent' }}>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
