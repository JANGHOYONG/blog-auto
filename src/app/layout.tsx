import type { Metadata } from 'next';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProgressBar from '@/components/ProgressBar';
import ScrollToTop from '@/components/ScrollToTop';
import './globals.css';

const SITE_NAME  = process.env.NEXT_PUBLIC_SITE_NAME || '시니어 건강백과';
const SITE_DESC  = process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '50·60대 시니어를 위한 혈당·혈압·관절·수면·치매 예방 건강 정보 백과사전';
const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
const GA_ID      = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const ADSENSE    = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const KAKAO_KEY  = process.env.NEXT_PUBLIC_KAKAO_API_KEY;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESC,
  openGraph: { type: 'website', locale: 'ko_KR', url: SITE_URL, siteName: SITE_NAME },
  twitter: { card: 'summary_large_image' },
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  other: { 'naver-site-verification': 'dee771838eccbe0167e4dcc16ab4e9d84d88a9bb' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseReady = ADSENSE && !ADSENSE.includes('XXXXXX');

  return (
    <html lang="ko">
      <head>
        {/* 모바일 Chrome·Safari 아이콘 명시 */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon" />
        {adsenseReady && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-screen flex flex-col">
        <ProgressBar />
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">{`
              window.dataLayer=window.dataLayer||[];
              function gtag(){dataLayer.push(arguments);}
              gtag('js',new Date());
              gtag('config','${GA_ID}');
            `}</Script>
          </>
        )}
        {KAKAO_KEY && (
          <>
            <Script
              src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
            <Script id="kakao-init" strategy="afterInteractive">{`
              window.addEventListener('load', function() {
                if (window.Kakao && !window.Kakao.isInitialized()) {
                  window.Kakao.init('${KAKAO_KEY}');
                }
              });
            `}</Script>
          </>
        )}
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <ScrollToTop />

        {/* Service Worker 등록 (PWA 설치 프롬프트 활성화) */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        `}</Script>
      </body>
    </html>
  );
}
