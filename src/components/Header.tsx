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
      // Android: 네이티브 설치 다이얼로그
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else {
      // iOS 및 기타: 안내 팝업
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
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 48px)', maxWidth: '360px',
              zIndex: 9999,
              background: '#ffffff',
              borderRadius: '20px',
              padding: '28px 24px',
              boxShadow: '0 8px 48px rgba(0,0,0,0.28)',
            }}
          >
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0, background: 'linear-gradient(135deg,#177A5E,#1E9E7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🏥</div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#1B3A32' }}>홈 화면에 추가하기</p>
                <p style={{ fontSize: '12px', color: '#2E5A4D', marginTop: '2px' }}>앱처럼 바로 실행할 수 있어요</p>
              </div>
            </div>

            {/* 단계 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {/* Step 1 */}
              <div style={{ background: '#F2FAF7', borderRadius: '12px', padding: '14px 16px', border: '1.5px solid #C5E8DA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#177A5E,#1E9E7A)', color: '#fff', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                  <p style={{ fontSize: '13px', color: '#1B3A32', fontWeight: 600 }}>Safari를 열고 아래 링크를 복사해주세요</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ flex: 1, fontSize: '12px', color: '#555', background: '#fff', borderRadius: '8px', padding: '7px 10px', border: '1px solid #C5E8DA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    smartinfoblog.co.kr
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('https://smartinfoblog.co.kr').then(() => {
                        alert('링크가 복사되었습니다!');
                      });
                    }}
                    style={{ flexShrink: 0, padding: '7px 12px', background: 'linear-gradient(90deg,#177A5E,#1E9E7A)', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    링크 복사
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F2FAF7', borderRadius: '12px', padding: '14px 16px', border: '1.5px solid #C5E8DA' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#177A5E,#1E9E7A)', color: '#fff', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                <p style={{ fontSize: '13px', color: '#1B3A32', fontWeight: 600 }}>하단 <strong>⋯ 버튼</strong> → <strong>공유</strong> 버튼을 눌러주세요</p>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F2FAF7', borderRadius: '12px', padding: '14px 16px', border: '1.5px solid #C5E8DA' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#177A5E,#1E9E7A)', color: '#fff', fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</div>
                <p style={{ fontSize: '13px', color: '#1B3A32', fontWeight: 600 }}><strong>"홈 화면에 추가"</strong> 버튼을 눌러주세요</p>
              </div>
            </div>

            <button onClick={() => setShowSheet(false)} style={{ width: '100%', padding: '14px', background: 'linear-gradient(90deg,#177A5E,#1E9E7A)', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              확인
            </button>
          </div>
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
