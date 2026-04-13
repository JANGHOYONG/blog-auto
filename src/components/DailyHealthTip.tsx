/**
 * 오늘의 건강 궁금증 위젯
 * - 오늘 발행된 첫 번째 글 제목을 질문형으로 변환해 표시
 * - 발췌문 앞부분을 힌트로 노출
 * - "답 확인하러 가기 →" 클릭 시 해당 글로 이동
 */

import Link from 'next/link';
import { prisma } from '@/lib/db';

function formatKoreanDate(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = now.getMonth() + 1;
  const date  = now.getDate();
  const day   = days[now.getDay()];
  return `${month}월 ${date}일 (${day})`;
}

/**
 * 서술형 제목 → 질문형 변환
 * 예) "혈압 낮추는 방법 5가지"  → "혈압 낮추는 방법 5가지, 모두 알고 계셨나요?"
 *     "당뇨 초기 증상"          → "당뇨 초기 증상, 알고 계셨나요?"
 *     "왜 피곤할까요?"          → (이미 물음표) 그대로 반환
 */
function toQuestion(title: string): string {
  const t = title.trim();

  // 이미 질문형이면 그대로
  if (t.endsWith('?') || t.endsWith('요?') || t.endsWith('까?') || t.endsWith('죠?')) return t;

  // 패턴별 변환
  if (/방법$|하는\s*법$/.test(t))           return `${t}, 제대로 알고 계신가요?`;
  if (/이유$|이유는$|원인$/.test(t))         return `${t}, 무엇 때문일까요?`;
  if (/효과$|효능$/.test(t))                 return `${t}, 얼마나 될까요?`;
  if (/[0-9]+가지$|[0-9]+개$/.test(t))       return `${t}, 모두 알고 계셨나요?`;
  if (/주의사항$|부작용$|위험$/.test(t))      return `${t}, 알고 계셨나요?`;
  if (/차이$|비교$|vs/.test(t))              return `${t}, 뭐가 더 좋을까요?`;
  if (/시간$|타이밍$/.test(t))               return `${t}, 언제가 제일 좋을까요?`;
  if (/얼마나$|몇\s*mg|몇\s*분/.test(t))     return `${t}, 정답을 알고 계신가요?`;
  if (/증상$|징후$|신호$/.test(t))           return `${t}, 알고 계셨나요?`;
  if (/음식$|식품$|식재료$/.test(t))         return `${t}, 드시고 계신가요?`;

  // 기본: "~, 알고 계셨나요?"
  return `${t}, 알고 계셨나요?`;
}

export default async function DailyHealthTip() {
  let post: {
    title:    string;
    slug:     string;
    excerpt:  string;
    thumbnail: string | null;
    category: { slug: string; name: string };
  } | null = null;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    post = await prisma.post.findFirst({
      where:   { status: 'PUBLISHED', publishedAt: { gte: todayStart } },
      orderBy: { publishedAt: 'asc' },
      select:  { title: true, slug: true, excerpt: true, thumbnail: true,
                 category: { select: { slug: true, name: true } } },
    });

    if (!post) {
      post = await prisma.post.findFirst({
        where:   { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        select:  { title: true, slug: true, excerpt: true, thumbnail: true,
                   category: { select: { slug: true, name: true } } },
      });
    }
  } catch { /* DB 접근 실패 시 숨김 */ }

  if (!post) return null;

  const postHref = `/${post.category.slug}/${post.slug}`;
  const question = toQuestion(post.title);
  // 발췌문 앞 55자를 힌트로 (질문에 대한 단서 느낌)
  const hint = post.excerpt.length > 55
    ? post.excerpt.slice(0, 55) + '...'
    : post.excerpt;

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

          {/* 왼쪽: 질문 + 힌트 + CTA */}
          <div className="flex-1 p-5 sm:p-7 flex flex-col justify-between" style={{ minWidth: 0 }}>

            {/* 상단 라벨 + 날짜 */}
            <div className="flex items-center gap-2 mb-4">
              <span style={{
                background: 'linear-gradient(90deg, #1E9E7A, #4fc3a1)',
                color: '#fff', fontSize: '11px', fontWeight: 700,
                padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.5px',
              }}>
                오늘의 건강 궁금증
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {formatKoreanDate()}
              </span>
            </div>

            {/* Q. 질문 */}
            <div className="mb-4">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                <span style={{
                  flexShrink: 0,
                  background: '#1E9E7A',
                  color: '#fff',
                  fontSize: '13px', fontWeight: 900,
                  padding: '2px 9px', borderRadius: '8px',
                  marginTop: '3px',
                }}>
                  Q
                </span>
                <p
                  className="font-bold leading-snug"
                  style={{ fontSize: 'clamp(15px, 2.4vw, 20px)', color: 'var(--text)', lineHeight: 1.50 }}
                >
                  {question}
                </p>
              </div>

              {/* 힌트 */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                background: 'rgba(30,158,122,0.07)',
                borderRadius: '10px', padding: '10px 12px',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>💡</span>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.65, margin: 0 }}>
                  <strong style={{ color: '#1E9E7A', marginRight: '4px' }}>힌트</strong>
                  {hint}
                </p>
              </div>
            </div>

            {/* CTA */}
            <Link
              href={postHref}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'linear-gradient(90deg, #177A5E, #1E9E7A)',
                color: '#fff', fontWeight: 700, fontSize: '14px',
                padding: '11px 22px', borderRadius: '12px',
                textDecoration: 'none', alignSelf: 'flex-start', minHeight: '44px',
              }}
            >
              답 확인하러 가기 →
            </Link>
          </div>

          {/* 오른쪽: 썸네일 카드 */}
          <Link href={postHref} className="sm:w-60 flex-shrink-0 block" style={{ textDecoration: 'none' }}>
            <div className="h-full flex flex-col" style={{ borderLeft: '1.5px solid var(--border)', background: 'var(--bg)' }}>
              {post.thumbnail && (
                <img
                  src={post.thumbnail} alt={post.title}
                  style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
              )}
              <div style={{ padding: '14px 16px', flex: 1 }}>
                <span style={{
                  display: 'inline-block', fontSize: '11px', fontWeight: 700,
                  color: 'var(--primary)', background: 'rgba(30,158,122,0.12)',
                  padding: '2px 8px', borderRadius: '20px', marginBottom: '8px',
                }}>
                  {post.category.name}
                </span>
                <p style={{
                  fontSize: '13px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {post.title}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, marginTop: '10px' }}>
                  정답 보기 →
                </p>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}
