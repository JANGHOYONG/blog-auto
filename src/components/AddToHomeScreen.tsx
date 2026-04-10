'use client';

/**
 * 홈 화면 추가 유도 배너 (PWA 설치)
 * - Android Chrome: beforeinstallprompt → 네이티브 설치 다이얼로그
 * - iOS Safari: 공유 → 홈 화면에 추가 안내
 * - 7일간 닫기 유지 (localStorage)
 */

import { useEffect, useState } from 'react';

export default function AddToHomeScreen() {
  const [show, setShow]               = useState(false);
  const [isIOS, setIsIOS]             = useState(false);
  const [deferredPrompt, setDeferred] = useState<any>(null);

  useEffect(() => {
    // 이미 PWA 모드로 실행 중이면 표시 안 함
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as any).standalone === true) return;

    // 7일 이내 닫은 경우 표시 안 함
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    const ua = navigator.userAgent;
    const ios     = /iphone|ipad|ipod/i.test(ua);
    const safari  = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
    const android = /android/i.test(ua);

    if (ios && safari) {
      // iOS Safari: 공유 버튼 안내
      setIsIOS(true);
      setTimeout(() => setShow(true), 4000);
    } else if (android) {
      // Android Chrome: beforeinstallprompt 이벤트 대기
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferred(e);
        setTimeout(() => setShow(true), 4000);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShow(false);
    setDeferred(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <>
      {/* 배경 딤 */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* 배너 카드 */}
      <div
        style={{
          position: 'fixed',
          bottom: isIOS ? '80px' : '16px',
          left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)', maxWidth: '420px',
          zIndex: 9999,
          background: '#ffffff',
          borderRadius: '24px',
          padding: '24px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.28)',
        }}
      >
        {/* 앱 정보 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              width: '60px', height: '60px', borderRadius: '14px', flexShrink: 0,
              background: 'linear-gradient(135deg, #177A5E, #1E9E7A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            🏥
          </div>
          <div>
            <p style={{ fontSize: '17px', fontWeight: 800, color: '#1B3A32', marginBottom: '4px' }}>
              시니어 건강백과
            </p>
            <p style={{ fontSize: '13px', color: '#2E5A4D', lineHeight: 1.5 }}>
              홈 화면에 추가하면 앱처럼{'\n'}바로 열 수 있어요 📲
            </p>
          </div>
        </div>

        {/* iOS 안내 */}
        {isIOS ? (
          <div
            style={{
              background: '#F2FAF7',
              borderRadius: '14px',
              padding: '16px 18px',
              marginBottom: '16px',
              border: '1.5px solid #C5E8DA',
            }}
          >
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#1B3A32', marginBottom: '10px' }}>
              📌 홈 화면에 추가하는 방법
            </p>
            <p style={{ fontSize: '14px', color: '#1B3A32', lineHeight: 1.8 }}>
              1. 하단 <strong>공유 버튼(⬆)</strong> 탭<br />
              2. <strong>"홈 화면에 추가"</strong> 선택<br />
              3. <strong>"추가"</strong> 버튼 탭
            </p>
          </div>
        ) : (
          /* Android: 설치 버튼 */
          <button
            onClick={handleInstall}
            style={{
              width: '100%', padding: '15px',
              background: 'linear-gradient(90deg, #177A5E, #1E9E7A)',
              color: '#fff', borderRadius: '14px', border: 'none',
              fontSize: '16px', fontWeight: 800, cursor: 'pointer',
              marginBottom: '10px', letterSpacing: '0.3px',
            }}
          >
            📲 홈 화면에 추가하기
          </button>
        )}

        {/* 닫기 */}
        <button
          onClick={handleDismiss}
          style={{
            width: '100%', padding: '13px',
            background: 'transparent', color: '#2E5A4D',
            borderRadius: '14px', border: '1.5px solid #C5E8DA',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          나중에 할게요
        </button>
      </div>

      {/* iOS: 하단 화살표 (공유 버튼 위치 가리킴) */}
      {isIOS && (
        <div
          style={{
            position: 'fixed', bottom: '12px', left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            fontSize: '40px',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
            animation: 'bounce 1.2s infinite',
          }}
        >
          ⬇️
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </>
  );
}
