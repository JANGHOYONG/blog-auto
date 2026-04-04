import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { generateJsonLd } from '@/lib/seo';
import ArticleCard from '@/components/ArticleCard';
import SkeletonCard from '@/components/SkeletonCard';
import TopBar from '@/components/TopBar';
import AdSense from '@/components/AdSense';

export const revalidate = 1800;

const TOPICS = [
  { name: '혈당·당뇨', query: '혈당', icon: '🩸' },
  { name: '혈압·심장', query: '혈압', icon: '❤️' },
  { name: '관절·근육', query: '관절', icon: '🦴' },
  { name: '수면·피로', query: '수면', icon: '😴' },
  { name: '뇌건강·치매', query: '치매', icon: '🧠' },
  { name: '갱년기', query: '갱년기', icon: '🌸' },
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

      {/* 히어로 배너 */}
      <div style={{ background: 'linear-gradient(135deg, #177A5E 0%, #1E9E7A 50%, #4fc3a1 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-center text-white">
          <p className="text-3xl mb-2">🏥</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">시니어 건강백과</h1>
          <p className="text-base opacity-85 mb-6">시니어를 위한 정확하고 실천 가능한 건강 백과사전</p>
          {/* 주제 빠른 탐색 */}
          <div className="flex flex-wrap justify-center gap-2">
            {TOPICS.map((t) => (
              <Link
                key={t.query}
                href={`/search?q=${encodeURIComponent(t.query)}`}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}
              >
                {t.icon} {t.name}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          </Suspense>
        )}
      </div>
    </>
  );
}
