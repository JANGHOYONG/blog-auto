/**
 * 오늘의 건강 궁금증 위젯
 * - 오늘 발행된 첫 번째 글을 가져와 제목(질문)·발췌문(힌트)으로 표시
 * - "전체 내용 읽기" → 해당 글로 직접 연결
 * - 오늘 발행 글이 없으면 최신 글 fallback
 */

import Link from 'next/link';
import { prisma } from '@/lib/db';

function formatKoreanDate(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = days[now.getDay()];
  return `${month}월 ${date}일 (${day})`;
}

export default async function DailyHealthTip() {
  let post: {
    title: string;
    slug: string;
    excerpt: string;
    thumbnail: string | null;
    category: { slug: string; name: string };
  } | null = null;

  try {
    // 오늘 자정 기준
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 오늘 발행된 첫 번째 글
    post = await prisma.post.findFirst({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: todayStart },
      },
      orderBy: { publishedAt: 'asc' },
      select: {
        title: true,
        slug: true,
        excerpt: true,
        thumbnail: true,
        category: { select: { slug: true, name: true } },
      },
    });

    // 오늘 발행 글 없으면 최신 글 fallback
    if (!post) {
      post = await prisma.post.findFirst({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select: {
          title: true,
          slug: true,
          excerpt: true,
          thumbnail: true,
          category: { select: { slug: true, name: true } },
        },
      });
    }
  } catch {
    // DB 접근 실패 시 위젯 숨김
  }

  if (!post) return null;

  const postHref = `/${post.category.slug}/${post.slug}`;
  const thumbnail = post.thumbnail ?? null;
  // 발췌문 앞 60자를 힌트로 사용
  const hint = post.excerpt.length > 60 ? post.excerpt.slice(0, 60) + '...' : post.excerpt;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div
        style={{
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1.5px solid var(--border)',
          boxShadow: '0 4px 20px rgba(30,158,122,0.10)',
          background: 'var(--bg-card)',
        }}
      >
        <div className="flex flex-col sm:flex-row">

          {/* 왼쪽: 오늘의 질문 */}
          <div
            className="flex-1 p-5 sm:p-7 flex flex-col justify-between"
            style={{ minWidth: 0 }}
          >
            {/* 상단 라벨 */}
            <div className="flex items-center gap-2 mb-4">
              <span
                style={{
                  background: 'linear-gradient(90deg, #1E9E7A, #4fc3a1)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  letterSpacing: '0.5px',
                }}
              >
                오늘의 건강 궁금증
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {formatKoreanDate()}
              </span>
            </div>

            {/* 질문 (오늘 글 제목) */}
            <div className="mb-5">
              <p
                className="font-bold leading-snug mb-3"
                style={{ fontSize: 'clamp(16px, 2.5vw, 21px)', color: 'var(--text)', lineHeight: 1.45 }}
              >
                🏥 {post.title}
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {hint}
              </p>
            </div>

            {/* CTA — 해당 글로 직접 연결 */}
            <Link
              href={postHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(90deg, #177A5E, #1E9E7A)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                padding: '11px 20px',
                borderRadius: '12px',
                textDecoration: 'none',
                alignSelf: 'flex-start',
                minHeight: '44px',
              }}
            >
              전체 내용 읽기 →
            </Link>
          </div>

          {/* 오른쪽: 글 썸네일 카드 */}
          <Link
            href={postHref}
            className="sm:w-64 flex-shrink-0 block"
            style={{ textDecoration: 'none' }}
          >
            <div
              className="h-full flex flex-col"
              style={{
                borderLeft: '1.5px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              {thumbnail && (
                <img
                  src={thumbnail}
                  alt={post.title}
                  style={{
                    width: '100%',
                    height: '140px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  loading="lazy"
                />
              )}
              <div style={{ padding: '14px 16px', flex: 1 }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'rgba(30,158,122,0.12)',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    marginBottom: '8px',
                  }}
                >
                  {post.category.name}
                </span>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.title}
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    marginTop: '10px',
                  }}
                >
                  읽어보기 →
                </p>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}
