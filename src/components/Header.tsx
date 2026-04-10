'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** 모바일 헤더 전용 앱 다운로드 버튼 */
function AppDownloadHeaderBtn() {
  const [show, setShow]           = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [isIOS, setIsIOS]         = useState(false);
  const [prompt, setPrompt]       = useState<any>(null);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as any).standalone === true) return;

    const ua   = navigator.userAgent;
    const ios    = /iphone|ipad|ipod/i.test(ua);
    const safari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    if (ios && safari) setIsIOS(true);

    setShow(true);

    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = async () => {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else {
      setShowSheet(true);
    }
  };

  if (!show) return null;

  return (
    <>
      {/* 모바일에서만 표시 */}
      <button
        onClick={handleClick}
        className="md:hidden"
        style={{
          padding: '5px 10px',
          background: 'linear-gradient(90deg, #177A5E, #1E9E7A)',
          color: '#fff',
          borderRadius: '8px',
          border: 'none',
          fontSize: '11px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(23,122,94,0.3)',
          flexShrink: 0,
        }}
      >
        📲 앱 다운로드
      </button>

      {showSheet && (
        <>
          <div
            onClick={() => setShowSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: isIOS ? '80px' : '24px',
              left: '50%', transform: 'translateX(-50%)',
              width: 'calc(100% - 32px)', maxWidth: '400px',
              zIndex: 9999,
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 8px 48px rgba(0,0,0,0.28)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0, background: 'linear-gradient(135deg,#177A5E,#1E9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🏥</div>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#1B3A32', marginBottom: '3px' }}>시니어 건강백과</p>
                <p style={{ fontSize: '13px', color: '#2E5A4D' }}>홈 화면에 추가하면 앱처럼 바로 열려요</p>
              </div>
            </div>
            <div style={{ background: '#F2FAF7', borderRadius: '12px', padding: '16px', marginBottom: '14px', border: '1.5px solid #C5E8DA' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#1B3A32', marginBottom: '10px' }}>📌 홈 화면에 추가하는 방법</p>
              <p style={{ fontSize: '14px', color: '#1B3A32', lineHeight: 1.9 }}>
                1. 하단 <strong>공유 버튼 (⬆)</strong> 탭<br />
                2. <strong>"홈 화면에 추가"</strong> 선택<br />
                3. <strong>"추가"</strong> 버튼 탭
              </p>
            </div>
            <button onClick={() => setShowSheet(false)} style={{ width: '100%', padding: '13px', background: 'transparent', color: '#2E5A4D', borderRadius: '12px', border: '1.5px solid #C5E8DA', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
          {isIOS && (
            <div style={{ position: 'fixed', bottom: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000, fontSize: '36px', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))', animation: 'pwa-bounce 1.2s infinite' }}>⬇️</div>
          )}
        </>
      )}
      <style>{`@keyframes pwa-bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-10px)} }`}</style>
    </>
  );
}

const TOPICS = [
  { name: '혈당·당뇨', query: '혈당' },
  { name: '혈압·심장', query: '혈압' },
  { name: '관절·근육', query: '관절' },
  { name: '수면·피로', query: '수면' },
  { name: '뇌건강·치매', query: '치매' },
  { name: '갱년기', query: '갱년기' },
  { name: '영양·식이', query: '영양' },
  { name: '건강지식', href: '/knowledge' },
  { name: '여행·여가', href: '/travel' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

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
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <span className="text-xl">🏥</span>
            <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--primary)' }}>
              시니어 건강백과
            </span>
          </Link>

          {/* 데스크탑 주제별 네비 */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <Link
              href="/health"
              className="px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors"
              style={{ color: 'var(--primary)' }}
            >
              전체 글
            </Link>
            {TOPICS.map((t) => (
              <Link
                key={t.name}
                href={t.href ?? `/search?q=${encodeURIComponent(t.query ?? '')}`}
                className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {t.name}
              </Link>
            ))}
          </nav>

          {/* 모바일 앱 다운로드 버튼 */}
          <AppDownloadHeaderBtn />

          {/* 우측: 검색 */}
          <div className="flex items-center gap-2 ml-auto">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="건강 검색..."
                  className="w-36 sm:w-52 px-3 py-2.5 text-base rounded-xl border outline-none"
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
              className="md:hidden btn-ghost p-3"
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
            <Link
              href="/health"
              className="block px-3 py-3.5 text-base font-semibold rounded-lg"
              style={{ color: 'var(--primary)', minHeight: '44px', display: 'flex', alignItems: 'center' }}
              onClick={() => setMenuOpen(false)}
            >
              📋 전체 글
            </Link>
            {TOPICS.map((t) => (
              <Link
                key={t.name}
                href={t.href ?? `/search?q=${encodeURIComponent(t.query ?? '')}`}
                className="block px-3 py-3.5 text-base font-medium rounded-lg"
                style={{ color: 'var(--text)', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                onClick={() => setMenuOpen(false)}
              >
                {t.name}
              </Link>
            ))}
            <Link href="/about" className="block px-3 py-3.5 text-base" style={{ color: 'var(--text-muted)', minHeight: '44px', display: 'flex', alignItems: 'center' }} onClick={() => setMenuOpen(false)}>
              소개
            </Link>
          </div>
        )}
      </div>

      {/* 하단 포인트 라인 */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--primary), #4fc3a1)' }} />
    </header>
  );
}
