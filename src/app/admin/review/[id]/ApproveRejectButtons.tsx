'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApproveRejectButtons({
  postId,
  currentStatus,
  qualityScore,
  rejectReasons,
}: {
  postId: number;
  currentStatus: string;
  qualityScore?: number | null;
  rejectReasons?: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [publishedPath, setPublishedPath] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
    if (!confirm('이 글을 즉시 발행하시겠습니까?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublishedPath(data.postPath || null);
      } else {
        const err = await res.json();
        alert('오류: ' + (err.error || '알 수 없는 오류'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { alert('반려 사유를 입력해주세요.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, note: rejectNote }),
      });
      if (res.ok) {
        alert('반려 완료. DRAFT 상태로 되돌렸습니다.');
        router.push('/admin/review');
      } else {
        const err = await res.json();
        alert('오류: ' + (err.error || '알 수 없는 오류'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (publishedPath) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    return (
      <div style={{ padding: '16px 20px', background: '#D5F5E3', borderRadius: '12px',
        color: '#1E8449', fontWeight: 700, fontSize: '14px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span>✅ 발행 완료!</span>
        <a href={`${siteUrl}${publishedPath}`} target="_blank" rel="noopener noreferrer"
          style={{ color: '#1E9E7A', textDecoration: 'underline', fontWeight: 700 }}>
          발행된 글 바로 보기 →
        </a>
        <button onClick={() => router.push('/admin/review')}
          style={{ marginLeft: 'auto', padding: '6px 14px', background: '#1E9E7A', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
          목록으로
        </button>
      </div>
    );
  }

  if (currentStatus === 'PUBLISHED') {
    return (
      <div style={{ padding: '16px 20px', background: '#D5F5E3', borderRadius: '12px',
        color: '#1E8449', fontWeight: 700, fontSize: '14px', marginBottom: '20px' }}>
        ✅ 이미 발행됨 — 블로그에서 확인하세요
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
      {qualityScore !== null && qualityScore !== undefined && (
        <div style={{
          marginBottom: '16px', padding: '10px 14px', borderRadius: '8px',
          background: qualityScore >= 90 ? '#D5F5E3' : qualityScore >= 70 ? '#FFF3CD' : '#FEE2E2',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '22px', fontWeight: 900,
            color: qualityScore >= 90 ? '#1E8449' : qualityScore >= 70 ? '#856404' : '#991B1B' }}>
            {qualityScore}점
          </span>
          {rejectReasons && rejectReasons.length > 0 && (
            <span style={{ fontSize: '12px', color: '#4B7A6A' }}>
              {rejectReasons.slice(0, 2).join(' · ')}
            </span>
          )}
        </div>
      )}

      <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#1B3A2D' }}>감수 결정</p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleApprove}
          disabled={loading}
          style={{ padding: '10px 24px', background: '#1E9E7A', color: '#fff',
            borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
        >
          {loading ? '처리 중...' : '✅ 즉시 발행'}
        </button>
        <button
          onClick={() => setShowReject(!showReject)}
          disabled={loading}
          style={{ padding: '10px 24px', background: '#FEE2E2', color: '#991B1B',
            borderRadius: '10px', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
        >
          ❌ 반려 (DRAFT로 복귀)
        </button>
      </div>

      {showReject && (
        <div style={{ marginTop: '16px' }}>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="반려 사유를 입력하세요 (필수)"
            style={{ width: '100%', minHeight: '80px', padding: '10px',
              border: '1px solid #C8E6C9', borderRadius: '8px', fontSize: '14px',
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <button
            onClick={handleReject}
            disabled={loading || !rejectNote.trim()}
            style={{ marginTop: '8px', padding: '8px 20px', background: '#991B1B',
              color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 700,
              cursor: 'pointer', fontSize: '13px' }}
          >
            반려 확정
          </button>
        </div>
      )}
    </div>
  );
}
