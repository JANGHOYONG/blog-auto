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
  const [confirmApprove, setConfirmApprove] = useState(false); // 인라인 확인 UI
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [publishedPath, setPublishedPath] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
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
      setConfirmApprove(false);
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
        router.push('/admin/review');
      } else {
        const err = await res.json();
        alert('오류: ' + (err.error || '알 수 없는 오류'));
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── 발행 완료 상태 ── */
  if (publishedPath) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    return (
      <div style={{
        padding: '16px 20px', background: '#D5F5E3', borderRadius: '12px',
        color: '#1E8449', fontWeight: 700, fontSize: '15px', marginBottom: '20px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        <span>✅ 발행 완료!</span>
        <a href={`${siteUrl}${publishedPath}`} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center', padding: '12px',
            background: '#1E9E7A', color: '#fff', borderRadius: '10px',
            fontWeight: 700, fontSize: '14px', textDecoration: 'none',
          }}>
          발행된 글 바로 보기 →
        </a>
        <button onClick={() => router.push('/admin/review')}
          style={{
            width: '100%', padding: '12px', background: '#fff', color: '#1E8449',
            border: '2px solid #1E9E7A', borderRadius: '10px',
            cursor: 'pointer', fontWeight: 700, fontSize: '14px',
          }}>
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

      {/* 품질 점수 */}
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

      {/* 1단계: 버튼 */}
      {!confirmApprove && !showReject && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => setConfirmApprove(true)}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', background: '#1E9E7A', color: '#fff',
              borderRadius: '12px', border: 'none', fontWeight: 700,
              cursor: 'pointer', fontSize: '16px', letterSpacing: '-0.3px',
            }}
          >
            ✅ 즉시 발행
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', background: '#FEE2E2', color: '#991B1B',
              borderRadius: '12px', border: 'none', fontWeight: 700,
              cursor: 'pointer', fontSize: '16px',
            }}
          >
            ❌ 반려 (DRAFT로 복귀)
          </button>
        </div>
      )}

      {/* 2단계: 발행 인라인 확인 (confirm 대신) */}
      {confirmApprove && (
        <div style={{
          background: '#F0FDF4', border: '2px solid #1E9E7A', borderRadius: '12px',
          padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#1B3A2D' }}>
            이 글을 즉시 발행하시겠습니까?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                flex: 1, padding: '14px', background: '#1E9E7A', color: '#fff',
                borderRadius: '10px', border: 'none', fontWeight: 700,
                cursor: 'pointer', fontSize: '15px',
              }}
            >
              {loading ? '발행 중...' : '✅ 발행 확인'}
            </button>
            <button
              onClick={() => setConfirmApprove(false)}
              disabled={loading}
              style={{
                flex: 1, padding: '14px', background: '#E5E7EB', color: '#374151',
                borderRadius: '10px', border: 'none', fontWeight: 700,
                cursor: 'pointer', fontSize: '15px',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 반려 입력 */}
      {showReject && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="반려 사유를 입력하세요 (필수)"
            style={{
              width: '100%', minHeight: '80px', padding: '12px',
              border: '1px solid #C8E6C9', borderRadius: '8px',
              fontSize: '15px', fontFamily: 'inherit',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleReject}
              disabled={loading || !rejectNote.trim()}
              style={{
                flex: 1, padding: '14px', background: '#991B1B', color: '#fff',
                borderRadius: '10px', border: 'none', fontWeight: 700,
                cursor: 'pointer', fontSize: '15px',
                opacity: rejectNote.trim() ? 1 : 0.5,
              }}
            >
              {loading ? '처리 중...' : '반려 확정'}
            </button>
            <button
              onClick={() => setShowReject(false)}
              disabled={loading}
              style={{
                flex: 1, padding: '14px', background: '#E5E7EB', color: '#374151',
                borderRadius: '10px', border: 'none', fontWeight: 700,
                cursor: 'pointer', fontSize: '15px',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
