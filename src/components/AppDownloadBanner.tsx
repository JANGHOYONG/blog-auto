'use client';

/**
 * 앱 다운로드 가로형 배너
 * - DailyHealthTip 아래, 최신 건강 정보 위에 위치
 * - 클릭 시: Android → 네이티브 설치, iOS → 안내 시트
 */

import { useEffect, useState } from 'react';

export default function AppDownloadBanner() {
  const [isIOS, setIsIOS]         = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [prompt, setPrompt]       = useState<any>(null);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => {
    setMounted(true);

    // 이미 PWA 설치된 경우 숨김
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as any).standalone === true) return;

    const ua = navigator.userAgent;
    const ios    = /iphone|ipad|ipod/i.test(ua);
    const safari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    if (ios && safari) setIsIOS(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
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

  // SSR에서는 렌더링하지 않음 (hydration mismatch 방지)
  if (!mounted) return null;

  return (
    <>
      {/* 가로형 배너 */}
      <div
        style={{
          background: 'linear-gradient(90deg, #177A5E 0%, #1E9E7A 100%)',
          padding: '14px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* 왼쪽: 아이콘 + 문구 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>📲</span>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '2px' }}>
                앱처럼 저장하고 바로 열어보세요
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>
                홈 화면에 추가하면 언제든 빠르게 접속할 수 있어요
              </p>
            </div>
          </div>

          {/* 오른쪽: 버튼 */}
          <button
            onClick={handleClick}
            style={{
              flexShrink: 0,
              padding: '10px 18px',
              background: '#ffffff',
              color: '#177A5E',
              borderRadius: '10px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            앱 다운로드
          </button>
        </div>
      </div>

      {/* iOS / 기타 안내 시트 */}
      {showSheet && (
        <>
          <div
            onClick={() => setShowSheet(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(3px)',
            }}
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
              <div
                style={{
                  width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #177A5E, #1E9E7A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px',
                }}
              >
                🏥
              </div>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#1B3A32', marginBottom: '3px' }}>
                  시니어 건강백과
                </p>
                <p style={{ fontSize: '13px', color: '#2E5A4D' }}>홈 화면에 추가하면 앱처럼 바로 열려요</p>
              </div>
            </div>

            <div
              style={{
                background: '#F2FAF7',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '14px',
                border: '1.5px solid #C5E8DA',
              }}
            >
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#1B3A32', marginBottom: '10px' }}>
                📌 홈 화면에 추가하는 방법
              </p>
              <p style={{ fontSize: '14px', color: '#1B3A32', lineHeight: 1.9 }}>
                1. 하단 <strong>공유 버튼 (⬆)</strong> 탭<br />
                2. <strong>"홈 화면에 추가"</strong> 선택<br />
                3. <strong>"추가"</strong> 버튼 탭
              </p>
            </div>

            <button
              onClick={() => setShowSheet(false)}
              style={{
                width: '100%', padding: '13px',
                background: 'transparent', color: '#2E5A4D',
                borderRadius: '12px', border: '1.5px solid #C5E8DA',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>

          {isIOS && (
            <div
              style={{
                position: 'fixed', bottom: '12px', left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                fontSize: '36px',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
                animation: 'pwa-bounce 1.2s infinite',
              }}
            >
              ⬇️
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pwa-bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </>
  );
}
