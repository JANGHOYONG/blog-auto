import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { generateMetadata as genMeta, generateJsonLd } from '@/lib/seo';
import { processContent } from '@/lib/content';
import AdFitSlot from '@/components/AdFitSlot';
import InsuranceCTA from '@/components/InsuranceCTA';
import RelatedPosts from '@/components/RelatedPosts';
import TOC from '@/components/TOC';
import ShareButtons from '@/components/ShareButtons';
import ArticleCard from '@/components/ArticleCard';
import CoupangCategoryBanner from '@/components/CoupangCategoryBanner';
import CoupangProductCard, { type CoupangProduct } from '@/components/CoupangProductCard';
import NewsletterCTA from '@/components/NewsletterCTA';
import FontSizeControl from '@/components/FontSizeControl';

export const revalidate = 86400;

interface Props {
  params: { category: string; slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    include: { category: true },
  });
  if (!post || post.category.slug !== params.category) return {};
  return genMeta({
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    slug: post.slug,
    category: post.category.slug,
    publishedAt: post.publishedAt ?? undefined,
    keywords: JSON.parse(post.keywords || '[]'),
    thumbnail: post.thumbnail,
  });
}

async function incrementView(id: number) {
  await prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });
}

export default async function PostPage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    include: {
      category: true,
      relatedPosts: {
        include: { related: { include: { category: true } } },
        take: 4,
      },
    },
  });

  if (!post || post.status !== 'PUBLISHED' || post.category.slug !== params.category) notFound();

  incrementView(post.id).catch(() => {});

  const keywords: string[] = JSON.parse(post.keywords || '[]');
  const { html: processedContent, headings } = processContent(post.content);
  const relatedPosts = post.relatedPosts.map((r) => r.related);

  const isHealth = post.category.slug === 'health';
  const youtubeId = post.longformVideoId || post.shortsVideoId || null;

  // 사이드바 쿠팡 카드 — coupangProduct DB 필드가 있으면 파싱 (이후 로직에서 사용)
  const coupangProduct: CoupangProduct | null = (() => {
    try {
      const raw = (post as Record<string, unknown>).coupangProduct as string | null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const cleanContent = processedContent
    .replace(/<div class=["']ad-slot ad-top["']><\/div>/g, '')
    .replace(/<div class=["']ad-slot ad-middle["']><\/div>/g, '')
    .replace(/<div class=["']ad-slot ad-bottom["']><\/div>/g, '')
    // 구버전 인라인 쿠팡 오렌지 배너 제거 (coupangProduct DB 필드로 대체됨)
    .replace(/<div style="margin:2rem 0;">\s*<a[^>]*rel="noopener sponsored"[^>]*>[\s\S]*?<\/a>\s*<p[^>]*>이 포스팅은 쿠팡 파트너스[\s\S]*?<\/p>\s*<\/div>/g, '');

  // 항상 본문을 중간 분할 — 상품카드(모바일) or 다이나믹배너를 중간에 삽입
  const [contentFirst, contentSecond] = (() => {
    const matches = [...cleanContent.matchAll(/<\/section>/g)];
    if (matches.length < 3) return [cleanContent, ''] as [string, string];
    const midIdx = Math.floor(matches.length / 2);
    const pos = (matches[midIdx].index ?? 0) + '</section>'.length;
    return [cleanContent.slice(0, pos), cleanContent.slice(pos)] as [string, string];
  })();

  // 이전/다음 글
  const [prevPost, nextPost] = await Promise.all([
    prisma.post.findFirst({
      where: { status: 'PUBLISHED', categoryId: post.categoryId, publishedAt: { lt: post.publishedAt ?? new Date() } },
      orderBy: { publishedAt: 'desc' },
      select: { title: true, slug: true, category: { select: { slug: true } } },
    }),
    prisma.post.findFirst({
      where: { status: 'PUBLISHED', categoryId: post.categoryId, publishedAt: { gt: post.publishedAt ?? new Date() } },
      orderBy: { publishedAt: 'asc' },
      select: { title: true, slug: true, category: { select: { slug: true } } },
    }),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com';
  const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;

  const articleJsonLd = generateJsonLd({
    type: 'Article',
    title: post.title,
    description: post.excerpt,
    slug: post.slug,
    category: post.category.slug,
    publishedAt: post.publishedAt ?? undefined,
    updatedAt: post.updatedAt,
    keywords,
  });

  // FAQ 섹션에서 FAQPage 스키마 추출
  const faqMatches = [...post.content.matchAll(
    /<p[^>]*class=["']faq-q["'][^>]*>Q\.\s*(.*?)<\/p>\s*<p>([\s\S]*?)<\/p>/g
  )];
  const faqJsonLd = faqMatches.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqMatches.map(([, q, a]) => ({
      '@type': 'Question',
      name: q.replace(/<[^>]*>/g, '').trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: a.replace(/<[^>]*>/g, '').trim(),
      },
    })),
  } : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: post.category.name, item: `${siteUrl}/${post.category.slug}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 브레드크럼 */}
        <nav className="text-sm mb-4 flex gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <a href="/" style={{ color: 'var(--primary)' }}>홈</a>
          <span>/</span>
          <a href={`/${post.category.slug}`} style={{ color: 'var(--primary)' }}>{post.category.name}</a>
          <span>/</span>
          <span className="line-clamp-1">{post.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 본문 영역 */}
          <div className="lg:col-span-3">
            {/* 헤더 */}
            <header className="mb-8">
              <span className="category-badge bg-sky-100 text-sky-700 mb-3 inline-block">
                {post.category.name}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: 'var(--text)' }}>
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                {post.publishedAt && (
                  <time dateTime={post.publishedAt.toISOString()}>
                    📅 {post.publishedAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </time>
                )}
                {post.updatedAt && post.updatedAt > (post.publishedAt ?? new Date(0)) && (
                  <span>✏️ 수정 {post.updatedAt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</span>
                )}
                {post.readTime && <span>⏱ {post.readTime}분</span>}
                <span>👁 {post.viewCount.toLocaleString()}</span>
                <FontSizeControl />
              </div>
            </header>

            {/* 의료 면책 조항 — YMYL 건강 콘텐츠 */}
            <div className="mb-6 px-4 py-3 rounded-xl text-sm flex gap-2 items-start" style={{ background: 'var(--bg-bar)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span className="shrink-0 mt-0.5">⚕️</span>
              <p className="m-0 leading-relaxed">
                본 콘텐츠는 <strong>건강 정보 제공 목적</strong>으로 작성되었으며, 의료 전문가의 진단·처방을 대체하지 않습니다. 건강 이상 증상이 있을 경우 반드시 병원을 방문하세요.
              </p>
            </div>

            {/* 본문 상단 광고 */}
            <div className="mb-6">
              <AdFitSlot slot="top" />
            </div>

            {/* 본문 전반부 */}
            <article
              className="prose-custom"
              dangerouslySetInnerHTML={{ __html: contentFirst }}
            />

            {/* ── 본문 중간 쿠팡 영역: 항상 3개 그리드 (모바일+데스크톱) ── */}
            <CoupangCategoryBanner categorySlug={post.category.slug} />

            {/* 본문 후반부 */}
            {contentSecond && (
              <article
                className="prose-custom"
                dangerouslySetInnerHTML={{ __html: contentSecond }}
              />
            )}

            {/* 유튜브 영상 (있을 경우) */}
            {youtubeId && (
              <div className="my-8">
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                  📺 관련 영상
                </p>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full rounded-xl"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={post.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* 뉴스레터 CTA */}
            <NewsletterCTA className="my-8" />

            {/* 보험·건강검진 제휴 CTA */}
            <InsuranceCTA />

            {/* 본문 중간 광고 */}
            <div className="my-8">
              <AdFitSlot slot="middle" />
            </div>

            {/* 키워드 태그 */}
            {keywords.length > 0 && (
              <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>관련 키워드</p>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => <span key={kw} className="tag">#{kw}</span>)}
                </div>
              </div>
            )}

            {/* 공유 버튼 */}
            <ShareButtons title={post.title} url={postUrl} />

            {/* 이전/다음 글 */}
            <nav className="mt-8 grid grid-cols-2 gap-4">
              {prevPost ? (
                <a href={`/${prevPost.category.slug}/${prevPost.slug}`}
                  className="card p-4 hover:opacity-75 transition-opacity">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>← 이전 글</p>
                  <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text)' }}>{prevPost.title}</p>
                </a>
              ) : <div />}
              {nextPost ? (
                <a href={`/${nextPost.category.slug}/${nextPost.slug}`}
                  className="card p-4 text-right hover:opacity-75 transition-opacity">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>다음 글 →</p>
                  <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text)' }}>{nextPost.title}</p>
                </a>
              ) : <div />}
            </nav>

            {/* 하단 광고 */}
            <div className="mt-8">
              <AdFitSlot slot="bottom" />
            </div>
          </div>

          {/* 사이드바 */}
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <TOC headings={headings} />
            {/* 쿠팡 추천 상품 1개 카드 — 데스크톱 전용 */}
            <div className="hidden lg:block">
              <CoupangCategoryBanner categorySlug={post.category.slug} sidebar />
            </div>
            <AdFitSlot slot="sidebar" />
          </aside>
        </div>

        {/* 관련 글 */}
        {relatedPosts.length > 0 && (
          <RelatedPosts posts={relatedPosts} currentSlug={post.slug} />
        )}
      </div>
    </>
  );
}
