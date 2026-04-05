'use client';

import { useEffect, useRef } from 'react';

interface Props {
  slot: string;
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical';
  className?: string;
  sticky?: boolean;
}

export default function AdSense({ slot, format = 'auto', className = '', sticky = false }: Props) {
  const adRef = useRef<HTMLModElement>(null);
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  // 슬롯 ID 매핑 (환경변수로 관리)
  const slotIds: Record<string, string> = {
    'top-banner':      process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP     || '',
    'post-middle':     process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE  || '',
    'post-bottom':     process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM  || '',
    'post-sidebar':    process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR || '',
    'category-top':    process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP     || '',
    'category-bottom': process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM  || '',
  };

  const adSlot = slotIds[slot] || '';

  useEffect(() => {
    if (!clientId || !adSlot) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // 광고 로드 실패 무시
    }
  }, [clientId, adSlot]);

  // AdSense 미설정 또는 더미값이면 플레이스홀더만 표시
  const isConfigured =
    clientId &&
    adSlot &&
    !clientId.includes('XXXXXX') &&
    !adSlot.includes('XXXXXX');

  if (!isConfigured) {
    return (
      <div
        className={`ad-slot ad-placeholder ${className}`}
        style={{
          background: '#f5f5f5',
          border: '2px dashed #ddd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: format === 'rectangle' ? '250px' : '90px',
          borderRadius: '8px',
        }}
      >
        <span className="text-gray-400 text-sm">광고 영역 ({slot})</span>
      </div>
    );
  }

  return (
    <div
      className={`ad-slot ${sticky ? 'sticky top-20' : ''} ${className}`}
    >
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
