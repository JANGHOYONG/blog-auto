import Link from 'next/link';
import AddToHomeScreen from './AddToHomeScreen';

const TOPICS = [
  { name: '혈당·당뇨', query: '혈당' },
  { name: '혈압·심장', query: '혈압' },
  { name: '관절·근육', query: '관절' },
  { name: '수면·피로', query: '수면' },
  { name: '뇌건강·치매', query: '치매' },
  { name: '갱년기', query: '갱년기' },
  { name: '영양·식이', query: '영양' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16" style={{ background: 'var(--primary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-3 text-white flex items-center gap-2">
              <span>🏥</span> 시니어 건강백과
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.92)' }}>
              50·60대 중장년층을 위한<br />
              신뢰할 수 있는 건강 정보를 제공합니다.<br />
              혈당·혈압·관절·수면·치매 예방까지.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-white">건강 주제</h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
              {TOPICS.map((t) => (
                <li key={t.query}>
                  <Link
                    href={`/search?q=${encodeURIComponent(t.query)}`}
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: 'rgba(255,255,255,0.92)' }}
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/health" className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  전체 글 보기
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-white">바로가기</h4>
            <ul className="space-y-2 text-sm">
              {[
                { href: '/about', label: '블로그 소개' },
                { href: '/privacy', label: '개인정보처리방침' },
                { href: '/search', label: '검색' },
                { href: '/sitemap.xml', label: '사이트맵' },
                { href: '/api/rss', label: 'RSS 피드' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <AddToHomeScreen />
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t pt-6 text-sm text-center" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }}>
          <p>© {year} 시니어 건강백과. All rights reserved.</p>
          <p className="mt-1">본 사이트의 건강 정보는 참고용이며, 증상이 있을 경우 반드시 전문의와 상담하시기 바랍니다.</p>
          <p className="mt-2">
            <Link href="/privacy" className="hover:text-white transition-colors mx-2" style={{ color: 'rgba(255,255,255,0.85)' }}>개인정보처리방침</Link>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <Link href="/about" className="hover:text-white transition-colors mx-2" style={{ color: 'rgba(255,255,255,0.85)' }}>블로그 소개</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
