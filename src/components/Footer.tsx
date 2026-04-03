import Link from 'next/link';

const CATEGORIES = [
  { name: '건강·의학', slug: 'health' },
  { name: 'IT·테크',   slug: 'tech' },
  { name: '경제·재테크', slug: 'economy' },
  { name: '생활정보',  slug: 'lifestyle' },
  { name: '여행·문화', slug: 'travel' },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Smart Info Blog';

  return (
    <footer className="mt-16" style={{ background: 'var(--primary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-3 text-white">{siteName}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              건강, IT, 경제, 생활정보 등<br />
              일상에 도움이 되는 유용한 정보를 제공합니다.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-white">카테고리</h4>
            <ul className="space-y-2">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/${cat.slug}`} className="text-sm hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {cat.name}
                  </Link>
                </li>
              ))}
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
                  <Link href={href} className="hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t pt-6 text-sm text-center" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}>
          <p>© {year} {siteName}. All rights reserved.</p>
          <p className="mt-1">본 사이트의 정보는 참고용이며, 중요한 결정 전에 전문가와 상담하시기 바랍니다.</p>
          <p className="mt-2">
            <Link href="/privacy" className="hover:text-white transition-colors mx-2" style={{ color: 'rgba(255,255,255,0.6)' }}>개인정보처리방침</Link>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <Link href="/about" className="hover:text-white transition-colors mx-2" style={{ color: 'rgba(255,255,255,0.6)' }}>블로그 소개</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
