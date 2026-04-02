'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { name: '건강·의학', slug: 'health' },
  { name: 'IT·테크',   slug: 'tech' },
  { name: '경제·재테크', slug: 'economy' },
  { name: '생활정보',  slug: 'lifestyle' },
  { name: '여행·문화', slug: 'travel' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Smart Info Blog';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-4">

          {/* 로고 */}
          <Link href="/" className="shrink-0 font-bold text-lg tracking-wide" style={{ color: 'var(--primary)' }}>
            {siteName}
          </Link>

          {/* 데스크탑 카테고리 내비 */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/${cat.slug}`}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors hover:text-primary"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* 우측: 검색 */}
          <div className="flex items-center gap-1 ml-auto">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="검색어 입력..."
                  className="w-36 sm:w-52 px-3 py-1.5 text-sm rounded-xl border outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  onBlur={() => { if (!query) setSearchOpen(false); }}
                />
                <button type="submit" className="btn-ghost p-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </form>
            ) : (
              <button className="btn-ghost p-2" onClick={() => setSearchOpen(true)} aria-label="검색">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {/* 모바일 메뉴 버튼 */}
            <button
              className="md:hidden btn-ghost p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="메뉴"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {menuOpen && (
          <div className="md:hidden py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/${cat.slug}`}
                className="block px-2 py-2.5 text-sm font-medium rounded-lg"
                style={{ color: 'var(--text)' }}
                onClick={() => setMenuOpen(false)}
              >
                {cat.name}
              </Link>
            ))}
            <Link href="/about" className="block px-2 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setMenuOpen(false)}>
              소개
            </Link>
          </div>
        )}
      </div>

      {/* 테라코타 하단 포인트 라인 */}
      <div className="h-0.5 w-full" style={{ background: 'var(--primary)' }} />
    </header>
  );
}
