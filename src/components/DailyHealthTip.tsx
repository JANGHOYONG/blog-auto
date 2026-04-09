/**
 * 오늘의 건강 한 줄 + 추천 글
 * - 날짜별로 건강 질문이 바뀜 (day-of-year 기반 순환)
 * - 질문과 관련된 인기 글 1개를 DB에서 가져와 카드로 표시
 */

import Link from 'next/link';
import { prisma } from '@/lib/db';

// ── 35개 건강 팁 (7개 주제 × 5개씩, 날마다 순환) ─────────────────────────────
const DAILY_TIPS = [
  // 혈당·당뇨
  { emoji: '🩸', question: '귀리가 혈당에 좋다는데, 오히려 혈당을 올리는 경우가 있다?', hint: '조리 방법에 따라 혈당 반응이 완전히 달라집니다.', query: '혈당', label: '혈당·당뇨' },
  { emoji: '🩸', question: '공복혈당이 정상인데도 당뇨 전단계일 수 있다?', hint: '식후 혈당이 더 중요한 지표일 수 있습니다.', query: '혈당', label: '혈당·당뇨' },
  { emoji: '🩸', question: '잠을 6시간 미만으로 자면 혈당이 얼마나 오를까?', hint: '수면 부족이 혈당 수치에 미치는 충격적인 수치가 있습니다.', query: '혈당', label: '혈당·당뇨' },
  { emoji: '🩸', question: '스트레스받을 때 혈당이 오르는 원리, 알고 계셨나요?', hint: '코르티솔 호르몬이 혈당을 직접 끌어올립니다.', query: '혈당', label: '혈당·당뇨' },
  { emoji: '🩸', question: '식사 후 10분 걷기, 혈당에 얼마나 효과가 있을까?', hint: '30분 운동보다 효과적이라는 연구 결과가 있습니다.', query: '당뇨', label: '혈당·당뇨' },
  // 혈압·심장
  { emoji: '❤️', question: '혈압약, 아침에 먹어야 할까요 저녁에 먹어야 할까요?', hint: '복용 시간에 따라 심장 보호 효과가 달라진다는 연구가 있습니다.', query: '혈압', label: '혈압·심장' },
  { emoji: '❤️', question: '혈압 측정을 잘못하면 수치가 20mmHg 차이난다?', hint: '측정 자세와 시간대만 바꿔도 정확도가 크게 달라집니다.', query: '혈압', label: '혈압·심장' },
  { emoji: '❤️', question: '자몽이 혈압약과 함께 먹으면 위험한 이유는?', hint: '특정 과일이 약 성분 분해를 막아 과다복용 효과를 냅니다.', query: '혈압', label: '혈압·심장' },
  { emoji: '❤️', question: '아침에 혈압이 유독 높은 이유, 뇌졸중과 연관 있다?', hint: '기상 직후 2시간이 심혈관 사고가 가장 많이 발생하는 시간대입니다.', query: '심장', label: '혈압·심장' },
  { emoji: '❤️', question: '콜레스테롤 수치 정상인데 심근경색이 오는 이유?', hint: '진짜 위험 지표는 따로 있습니다.', query: '콜레스테롤', label: '혈압·심장' },
  // 관절·근육
  { emoji: '🦴', question: '계단 내려갈 때 무릎이 아픈 이유, 연골 문제가 아닐 수 있다?', hint: '고관절이나 발목 문제가 무릎 통증으로 나타나는 경우가 많습니다.', query: '무릎', label: '관절·근육' },
  { emoji: '🦴', question: '콜라겐 영양제, 정말 관절 연골을 재생시킬 수 있을까?', hint: '최신 연구 결과가 기존 상식과 다릅니다.', query: '관절', label: '관절·근육' },
  { emoji: '🦴', question: '50대 이후 근육이 빠지는 속도, 1년에 얼마나 될까?', hint: '근감소증은 당뇨·심장병만큼 위험한 질환입니다.', query: '근육', label: '관절·근육' },
  { emoji: '🦴', question: '걷기 운동이 오히려 무릎을 망가뜨리는 경우가 있다?', hint: '잘못된 자세와 신발이 문제입니다.', query: '관절', label: '관절·근육' },
  { emoji: '🦴', question: '척추관 협착증, 수술 없이 나아질 수 있을까?', hint: '80% 이상이 비수술 치료로 개선된다는 데이터가 있습니다.', query: '허리', label: '관절·근육' },
  // 수면·피로
  { emoji: '😴', question: '낮잠 20분이 밤잠을 망치는 경우, 언제일까?', hint: '낮잠 시간과 깨는 방법이 핵심입니다.', query: '수면', label: '수면·피로' },
  { emoji: '😴', question: '수면제 장기복용이 치매 위험을 높인다는 연구, 사실일까?', hint: '특정 계열의 수면제가 뇌에 미치는 영향이 다릅니다.', query: '불면', label: '수면·피로' },
  { emoji: '😴', question: '잠자리에 드는 시간 vs 기상 시간, 어느 게 더 중요할까?', hint: '일정한 기상 시간이 심장 건강과 직결됩니다.', query: '수면', label: '수면·피로' },
  { emoji: '😴', question: '코골이가 단순 습관이 아닌 위험 신호인 경우는?', hint: '수면무호흡증은 치매 위험을 3배 높입니다.', query: '수면무호흡', label: '수면·피로' },
  { emoji: '😴', question: '만성피로, 단순히 피곤한 게 아닐 수 있다?', hint: '갑상선·빈혈·당뇨의 초기 신호일 수 있습니다.', query: '피로', label: '수면·피로' },
  // 뇌건강·치매
  { emoji: '🧠', question: '치매 10년 전에 나타나는 신호, 노화랑 어떻게 구별할까?', hint: '대부분이 놓치는 초기 증상이 따로 있습니다.', query: '치매', label: '뇌건강·치매' },
  { emoji: '🧠', question: '위장약·항히스타민제가 뇌를 망가뜨린다는 연구, 들어보셨나요?', hint: '항콜린 성분이 포함된 약이 문제입니다.', query: '치매', label: '뇌건강·치매' },
  { emoji: '🧠', question: '입속 세균이 알츠하이머를 유발할 수 있다?', hint: '잇몸 세균이 뇌에서 발견된 충격적인 연구 결과입니다.', query: '뇌건강', label: '뇌건강·치매' },
  { emoji: '🧠', question: '당뇨가 있으면 치매 위험이 몇 배나 높아질까?', hint: '뇌혈관 손상 메커니즘을 알면 예방이 가능합니다.', query: '인지', label: '뇌건강·치매' },
  { emoji: '🧠', question: '두뇌 게임·독서가 치매 예방에 효과 없다는 연구?', hint: '실제로 효과 있다고 밝혀진 방법은 따로 있습니다.', query: '기억력', label: '뇌건강·치매' },
  // 갱년기
  { emoji: '🌸', question: '갱년기 호르몬 치료, 암 위험을 높인다는 게 사실일까?', hint: '최신 연구가 기존 통념을 완전히 뒤집었습니다.', query: '갱년기', label: '갱년기' },
  { emoji: '🌸', question: '안면홍조의 진짜 원인, 에스트로겐 감소만이 아니다?', hint: '뇌의 체온 조절 중추 변화가 핵심입니다.', query: '갱년기', label: '갱년기' },
  { emoji: '🌸', question: '갱년기에 살이 찌는 이유, 식이조절이 오히려 역효과인 경우?', hint: '호르몬 변화로 인한 체지방 재배치 원리를 알아야 합니다.', query: '갱년기', label: '갱년기' },
  { emoji: '🌸', question: '남성도 갱년기를 겪는다? 60대 남성 2명 중 1명의 이야기', hint: '테스토스테론 감소 증상이 여성 갱년기와 다릅니다.', query: '남성갱년기', label: '갱년기' },
  { emoji: '🌸', question: '갱년기 우울감, 정신과 치료가 필요한 시점은 언제일까?', hint: '갱년기 우울증과 일반 우울증의 차이가 있습니다.', query: '갱년기', label: '갱년기' },
  // 영양·식이
  { emoji: '💊', question: '칼슘+마그네슘, 함께 먹으면 오히려 흡수가 방해된다?', hint: '영양제 복용 순서와 시간대가 중요합니다.', query: '영양제', label: '영양·식이' },
  { emoji: '💊', question: '공복에 먹으면 위험한 영양제, 알고 계신가요?', hint: '지용성 비타민과 철분은 특히 주의가 필요합니다.', query: '영양', label: '영양·식이' },
  { emoji: '💊', question: '비타민D, 무조건 많이 먹을수록 좋다는 게 맞을까?', hint: '지용성 비타민 과다복용은 독성을 유발합니다.', query: '비타민', label: '영양·식이' },
  { emoji: '💊', question: '건강기능식품이 처방약 효과를 0으로 만드는 경우가 있다?', hint: '오메가3와 항응고제의 위험한 조합을 아시나요?', query: '영양제', label: '영양·식이' },
  { emoji: '💊', question: '단백질, 60대 이후엔 젊을 때보다 더 먹어야 한다?', hint: '근감소증 예방을 위한 단백질 섭취 기준이 따로 있습니다.', query: '단백질', label: '영양·식이' },
];

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function formatKoreanDate(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const day = days[now.getDay()];
  return `${month}월 ${date}일 (${day})`;
}

export default async function DailyHealthTip() {
  const dayIdx = getDayOfYear() % DAILY_TIPS.length;
  const tip = DAILY_TIPS[dayIdx];

  // DB 쿼리 — 실패해도 tip만 보여주는 fallback 처리
  let post: { title: string; slug: string; thumbnail: string | null; category: { slug: string; name: string } } | null = null;
  try {
    // 관련 주제에서 가장 조회수 높은 글 1개
    const featured = await prisma.post.findFirst({
      where: {
        status: 'PUBLISHED',
        OR: [
          { title: { contains: tip.query } },
          { excerpt: { contains: tip.query } },
          { keywords: { contains: tip.query } },
        ],
      },
      select: { title: true, slug: true, thumbnail: true, category: { select: { slug: true, name: true } } },
      orderBy: { viewCount: 'desc' },
    });

    // 관련 글 없으면 최신 글 1개
    post = featured ?? await prisma.post.findFirst({
      where: { status: 'PUBLISHED' },
      select: { title: true, slug: true, thumbnail: true, category: { select: { slug: true, name: true } } },
      orderBy: { publishedAt: 'desc' },
    });
  } catch {
    // DB 접근 실패 시 tip 텍스트만 표시
  }

  const postHref = post ? `/${post.category.slug}/${post.slug}` : '/health';
  const thumbnail = post?.thumbnail ?? null;

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

          {/* 왼쪽: 오늘의 건강 질문 */}
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

            {/* 질문 */}
            <div className="mb-5">
              <p
                className="font-bold leading-snug mb-3"
                style={{ fontSize: 'clamp(17px, 2.5vw, 22px)', color: 'var(--text)', lineHeight: 1.45 }}
              >
                {tip.emoji} {tip.question}
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {tip.hint}
              </p>
            </div>

            {/* CTA */}
            {post && (
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
                답 확인하기 →
              </Link>
            )}
          </div>

          {/* 오른쪽: 추천 글 카드 */}
          {post && (
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
                {/* 썸네일 */}
                {thumbnail ? (
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
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '140px',
                      background: 'linear-gradient(135deg, #E3F4ED, #C5E8DA)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '40px',
                    }}
                  >
                    {tip.emoji}
                  </div>
                )}

                {/* 글 정보 */}
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
                    {tip.label}
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
          )}

        </div>
      </div>
    </div>
  );
}
