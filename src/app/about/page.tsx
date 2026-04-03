import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '블로그 소개',
  description: '건강, IT, 경제, 생활정보, 여행까지 — 일상에 도움이 되는 정보를 전달하는 블로그입니다.',
};

export default function AboutPage() {
  const categories = [
    { icon: '💊', name: '건강·의학', slug: 'health', desc: '건강 정보, 질환 예방, 영양, 운동 등 건강한 삶을 위한 콘텐츠' },
    { icon: '💻', name: 'IT·테크', slug: 'tech', desc: 'AI, 스마트폰, 소프트웨어, 최신 기술 트렌드 정보' },
    { icon: '📈', name: '경제·재테크', slug: 'economy', desc: '주식, 부동산, 절약, 재테크 전략 등 경제 정보' },
    { icon: '🏠', name: '생활정보', slug: 'lifestyle', desc: '일상 팁, 정부 혜택, 생활 꿀팁 등 실용 정보' },
    { icon: '✈️', name: '여행·문화', slug: 'travel', desc: '국내외 여행지, 맛집, 문화 행사 추천' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* 헤더 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text)' }}>블로그 소개</h1>
        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
          당신의 일상을 더 스마트하게 만드는 정보 블로그
        </p>
      </div>

      {/* 소개 */}
      <section className="card p-8 mb-8">
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>
          안녕하세요! 👋
        </h2>
        <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          이 블로그는 <strong style={{ color: 'var(--text)' }}>건강, IT, 경제, 생활정보, 여행·문화</strong> 등 다양한 분야에서
          실생활에 바로 적용할 수 있는 유용한 정보를 제공합니다.
        </p>
        <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          복잡한 정보를 쉽고 명확하게 정리하여, 누구나 빠르게 핵심을 파악할 수 있도록 작성합니다.
          SEO 최적화와 정확한 정보 전달을 위해 꾸준히 업데이트하고 있습니다.
        </p>
        <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          매일 새로운 콘텐츠가 업데이트되니 즐겨찾기에 추가해두세요!
        </p>
      </section>

      {/* 카테고리 소개 */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>다루는 주제</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/${cat.slug}`}
              className="card p-5 flex gap-4 items-start hover:opacity-80 transition-opacity">
              <span className="text-3xl">{cat.icon}</span>
              <div>
                <h3 className="font-bold mb-1" style={{ color: 'var(--text)' }}>{cat.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 이 블로그의 특징 */}
      <section className="card p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>이 블로그의 특징</h2>
        <ul className="space-y-3">
          {[
            { icon: '✅', text: '정확하고 신뢰할 수 있는 정보 제공' },
            { icon: '📱', text: '모바일에서도 쾌적하게 읽을 수 있는 반응형 디자인' },
            { icon: '📅', text: '매일 새로운 콘텐츠 업데이트' },
{ icon: '🔍', text: '원하는 정보를 빠르게 찾는 검색 기능' },
            { icon: '🔗', text: '관련 글 추천으로 더 깊은 정보 탐색 가능' },
            { icon: '📋', text: '목차 제공으로 긴 글도 쉽게 탐색 가능' },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="text-xl">{icon}</span>
              <span style={{ color: 'var(--text-muted)' }}>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 면책 조항 */}
      <section className="card p-6 mb-8" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h2 className="font-bold mb-2" style={{ color: 'var(--text)' }}>면책 조항</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          본 블로그의 건강·의학 관련 콘텐츠는 일반적인 정보 제공 목적으로 작성되었으며,
          전문 의료 조언을 대체하지 않습니다. 건강 관련 결정은 반드시 전문 의료인과 상담하시기 바랍니다.
          경제·재테크 관련 콘텐츠 역시 투자 권유가 아닌 정보 제공 목적이며, 투자 손실에 대한 책임은 본인에게 있습니다.
        </p>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link href="/" className="btn-primary inline-block px-8 py-3 rounded-xl text-base">
          최신 글 보러 가기
        </Link>
      </div>
    </div>
  );
}
