import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { generateJsonLd } from '@/lib/seo';
import ArticleCard from '@/components/ArticleCard';
import SkeletonCard from '@/components/SkeletonCard';
import TopBar from '@/components/TopBar';
import AdSense from '@/components/AdSense';
import NewsletterCTA from '@/components/NewsletterCTA';
import DailyHealthTip from '@/components/DailyHealthTip';
import AppDownloadBanner from '@/components/AppDownloadBanner';

export const revalidate = 1800;

export const metadata: Metadata = {
  title: '시니어 건강백과 — 50·60대를 위한 건강 정보',
  description: '시니어를 위한 혈당·혈압·관절·수면·뇌건강·갱년기 건강 정보. 전문의가 검토한 신뢰할 수 있는 최신 건강 지식으로 오늘부터 건강을 지키세요.',
  keywords: ['시니어 건강', '5060 건강', '혈당 관리', '혈압 관리', '관절 건강', '수면 건강', '치매 예방', '갱년기'],
  openGraph: {
    title: '시니어 건강백과',
    description: '50·60대를 위한 혈당·혈압·관절·수면·치매 예방 건강 백과사전',
    url: 'https://smartinfoblog.co.kr',
    siteName: '시니어 건강백과',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default async function HomePage() {
  const recentPosts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
    orderBy: { publishedAt: 'desc' },
    take: 12,
  });

  const jsonLd = generateJsonLd({
    type: 'WebSite',
    title: '시니어 건강백과',
    description: '시니어를 위한 혈당·혈압·관절·수면·치매 예방 건강 백과사전',
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 방문자 통계 + 인기글 바 */}
      <Suspense fallback={null}>
        <TopBar />
      </Suspense>

      {/* 오늘의 건강 궁금증 */}
      <Suspense fallback={null}>
        <DailyHealthTip />
      </Suspense>

      {/* 앱 다운로드 배너 */}
      <AppDownloadBanner />

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* 상단 광고 */}
        <div className="mb-8">
          <AdSense slot="top-banner" format="horizontal" />
        </div>

        {/* 최신 글 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>최신 건강 정보</h2>
          <Link href="/health" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            전체 보기 →
          </Link>
        </div>

        {recentPosts.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl mb-3">✍️</p>
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>아직 게시된 글이 없습니다.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>곧 새 글이 업로드됩니다!</p>
          </div>
        ) : (
          <Suspense fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          }>
            {/* 1~4번 글 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentPosts.slice(0, 4).map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>

            {/* 뉴스레터 CTA */}
            <NewsletterCTA className="my-8" />

            {/* 5~8번 글 */}
            {recentPosts.length > 4 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                {recentPosts.slice(4, 8).map((post) => (
                  <ArticleCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* 중간 광고 */}
            {recentPosts.length > 8 && (
              <div className="my-8">
                <AdSense slot="home-middle" format="horizontal" />
              </div>
            )}

            {/* 9~12번 글 */}
            {recentPosts.length > 8 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recentPosts.slice(8, 12).map((post) => (
                  <ArticleCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </Suspense>
        )}
      </div>
    </>
  );
}
