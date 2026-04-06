'use client';

import { useEffect, useRef } from 'react';

/**
 * 쿠팡파트너스 다이나믹 배너 (비건강 카테고리용)
 * 카루셀 타입 | 728×90
 */
export default function CoupangDynamicBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // g.js 로드 후 배너 초기화
    const script1 = document.createElement('script');
    script1.src = 'https://ads-partners.coupang.com/g.js';
    script1.async = true;
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.textContent = `
        try {
          new PartnersCoupang.G({
            "id": 978610,
            "template": "carousel",
            "trackingCode": "AF2509108",
            "width": "728",
            "height": "90",
            "tsource": ""
          });
        } catch(e) {}
      `;
      container.appendChild(script2);
    };
    container.appendChild(script1);

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div className="my-8">
      <div
        ref={containerRef}
        className="overflow-x-auto"
        style={{ minHeight: '90px' }}
      />
      <p className="text-xs mt-2 text-center" style={{ color: '#AAAAAA' }}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
