import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '블로그 소개 | 시니어 건강백과',
  description: '시니어 건강백과는 질병관리청·대한의학회 공식 데이터를 기반으로 50·60대 중장년층에게 신뢰할 수 있는 건강 정보를 제공하는 전문 블로그입니다.',
};

const TOPICS = [
  { icon: '🩸', name: '혈당·당뇨', slug: 'health', query: '혈당', desc: '공복혈당·당화혈색소 관리, 식후 혈당 낮추는 식단과 생활 습관' },
  { icon: '❤️', name: '혈압·심장', slug: 'health', query: '혈압', desc: '고혈압·심혈관 질환 예방, 콜레스테롤·동맥경화 관리 가이드' },
  { icon: '🦵', name: '관절·근육', slug: 'health', query: '관절', desc: '무릎·허리 통증 완화, 근감소증 예방, 골다공증 관리' },
  { icon: '😴', name: '수면·피로', slug: 'health', query: '수면', desc: '불면증 해소, 수면의 질 개선, 만성피로 극복 방법' },
  { icon: '🧠', name: '뇌건강·치매', slug: 'health', query: '치매', desc: '치매·알츠하이머 예방, 기억력 강화, 뇌 건강 유지 비결' },
  { icon: '🌸', name: '갱년기', slug: 'health', query: '갱년기', desc: '갱년기 증상 완화, 호르몬 균형, 여성·남성 갱년기 건강 관리' },
  { icon: '🥗', name: '영양·식이', slug: 'health', query: '영양', desc: '시니어 맞춤 영양제, 건강식품, 식단 설계 가이드' },
  { icon: '✈️', name: '여행·여가', slug: 'travel', query: '', desc: '시니어 친화 여행지·코스 추천, 건강한 여가생활 노하우' },
];

const SOURCES = [
  { name: '질병관리청', url: 'https://www.kdca.go.kr', desc: '국민건강통계, 만성질환 현황' },
  { name: '건강보험심사평가원', url: 'https://www.hira.or.kr', desc: '질병별 진료 통계' },
  { name: '국민건강영양조사', url: 'https://knhanes.kdca.go.kr', desc: '식이·영양 데이터' },
  { name: '대한의학회', url: 'https://www.kams.or.kr', desc: '임상 가이드라인' },
  { name: '통계청 사회통계', url: 'https://kostat.go.kr', desc: '고령화·사망원인 통계' },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">

      {/* 헤더 */}
      <div className="text-center mb-12">
        <p className="text-5xl mb-4">🏥</p>
        <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--text)' }}>시니어 건강백과</h1>
        <p className="text-lg mb-2" style={{ color: 'var(--text-muted)' }}>
          50·60대를 위한 근거 기반 건강 정보 전문 블로그
        </p>
        <div className="flex justify-center gap-6 text-sm mt-4 flex-wrap">
          <span className="flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            <strong>📅</strong> 2024년 운영 시작
          </span>
          <span className="flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            <strong>📝</strong> 누적 발행 글 500편+
          </span>
          <span className="flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            <strong>🗂️</strong> 건강 7대 주제 전문
          </span>
        </div>
      </div>

      {/* 운영 목적 */}
      <section className="card p-8 mb-8">
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>왜 이 블로그를 만들었나요?</h2>
        <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          한국의 50·60대는 고혈압, 당뇨, 관절염, 치매 등 만성질환의 핵심 위험 구간입니다.
          그런데 인터넷에는 출처가 불분명하거나 상업적 목적으로 과장된 건강 정보가 넘쳐납니다.
        </p>
        <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text)' }}>시니어 건강백과</strong>는 질병관리청·대한의학회 등
          국내 공인 의료기관 데이터를 근거로 작성된 콘텐츠만 발행합니다.
          "약을 끊을 수 있다", "완치된다"와 같은 과장 표현은 사용하지 않으며,
          개인차를 항상 명시하고 반드시 담당 의사 상담을 권고합니다.
        </p>
        <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          복잡한 의학 용어 없이, 오늘 바로 실천할 수 있는 생활 습관 가이드를 매일 제공합니다.
        </p>
      </section>

      {/* 콘텐츠 제작 원칙 */}
      <section className="card p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>콘텐츠 제작 원칙</h2>
        <ol className="space-y-5">
          {[
            {
              step: '01',
              title: '공인 데이터 기반 기획',
              desc: '질병관리청·건강보험심사평가원·국민건강영양조사 등 국가 공식 통계를 먼저 확인합니다.',
            },
            {
              step: '02',
              title: '의학 가이드라인 참조',
              desc: '대한의학회·대한내과학회 임상진료지침을 참고해 정확성을 검증합니다.',
            },
            {
              step: '03',
              title: '과장·오류 제거',
              desc: '근거 없는 효과 주장, 공포 유발 표현, 광고성 내용은 사전에 걸러냅니다.',
            },
            {
              step: '04',
              title: '의료 면책 조항 필수 삽입',
              desc: '모든 글 하단에 "개인차가 있으며 담당 의사 상담 필수" 문구를 반드시 포함합니다.',
            },
            {
              step: '05',
              title: '정기 업데이트',
              desc: '의학 가이드라인 개정 또는 신규 연구 발표 시 기존 글을 수정·보완합니다.',
            },
          ].map(({ step, title, desc }) => (
            <li key={step} className="flex gap-4 items-start">
              <span
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                {step}
              </span>
              <div>
                <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>{title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 주요 참고 데이터 출처 */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>주요 참고 데이터 출처</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          시니어 건강백과는 아래 국내 공인 의료·통계 기관의 자료를 참고합니다.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCES.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex items-start gap-3 hover:opacity-80 transition-opacity"
            >
              <span className="text-xl">🔗</span>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--primary)' }}>{s.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 다루는 건강 주제 */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>다루는 건강 주제</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TOPICS.map((t) => (
            <Link
              key={t.name}
              href={t.query ? `/search?q=${encodeURIComponent(t.query)}` : `/${t.slug}`}
              className="card p-5 flex gap-4 items-start hover:opacity-80 transition-opacity"
            >
              <span className="text-3xl">{t.icon}</span>
              <div>
                <h3 className="font-bold mb-1" style={{ color: 'var(--text)' }}>{t.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 이 블로그의 특징 */}
      <section className="card p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>이 블로그의 특징</h2>
        <ul className="space-y-4">
          {[
{ icon: '🩺', text: '국공립 기관 공식 데이터를 근거로 작성된 신뢰 콘텐츠' },
            { icon: '📱', text: '50·60대에 최적화된 큰 글씨, 모바일 친화 디자인' },
            { icon: '📋', text: '목차 제공으로 긴 글도 원하는 부분만 빠르게 탐색' },
            { icon: '🎬', text: '유튜브 쇼츠·롱폼 영상으로 이동 중에도 건강 정보 확인' },
            { icon: '🔍', text: '검색·관련 글 추천으로 더 깊은 건강 정보 탐색' },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="text-2xl">{icon}</span>
              <span className="text-base" style={{ color: 'var(--text-muted)' }}>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 문의·피드백 */}
      <section className="card p-8 mb-8">
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text)' }}>문의 및 피드백</h2>
        <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
          콘텐츠 오류 제보, 특정 건강 주제 요청, 광고·제휴 문의는 아래 이메일로 연락 주세요.
          독자분의 피드백은 콘텐츠 품질 향상에 직접 반영됩니다.
        </p>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">📧</span>
            <span style={{ color: 'var(--text)' }}>
              콘텐츠 오류 / 주제 요청 / 광고·제휴:{' '}
              <a
                href="mailto:ghdyd6913@gmail.com"
                className="underline"
                style={{ color: 'var(--primary)' }}
              >
                ghdyd6913@gmail.com
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">⏰</span>
            <span style={{ color: 'var(--text-muted)' }}>영업일 기준 1~3일 내 답변 드립니다.</span>
          </div>
        </div>
      </section>

      {/* 의료 면책 조항 */}
      <section
        className="card p-6 mb-8"
        style={{ borderLeft: '4px solid var(--primary)' }}
      >
        <h2 className="font-bold mb-3 text-base" style={{ color: 'var(--text)' }}>⚠️ 의료 면책 조항 (중요)</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          본 블로그의 건강·의학 관련 콘텐츠는{' '}
          <strong style={{ color: 'var(--text)' }}>일반적인 건강 정보 제공</strong>을
          목적으로 작성되었으며, 의사·약사·간호사 등 전문 의료인의 진단·처방·치료 조언을 대체하지 않습니다.
        </p>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          건강 상태, 복용 중인 약물, 기저질환에 따라 동일한 정보가 개인마다 다른 영향을 미칠 수 있습니다.
          건강 관련 중요한 결정은{' '}
          <strong style={{ color: 'var(--text)' }}>반드시 담당 의사와 상담</strong> 후 이행하시기 바랍니다.
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          본 블로그는 특정 제품·서비스의 효능을 보증하지 않으며, 콘텐츠 적용으로 인한 결과에 대해
          법적 책임을 지지 않습니다.
        </p>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link href="/" className="btn-primary inline-block px-8 py-3 rounded-xl text-base">
          최신 건강 글 보러 가기
        </Link>
      </div>

    </div>
  );
}
