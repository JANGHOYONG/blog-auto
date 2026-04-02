import type { Metadata } from 'next';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProgressBar from '@/components/ProgressBar';
import './globals.css';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Smart Info Blog';
const SITE_DESC = process.env.NEXT_PUBLIC_SITE_DESCRIPTION || '유용한 정보 블로그';
const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
const GA_ID     = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const ADSENSE   = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESC,
  openGraph: { type: 'website', locale: 'ko_KR', url: SITE_URL, siteName: SITE_NAME },
  twitter: { card: 'summary_large_image' },
  verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseReady = ADSENSE && !ADSENSE.includes('XXXXXX');

  return (
    <html lang="ko">
      <head>
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
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
