import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import ApproveRejectButtons from './ApproveRejectButtons';

export const dynamic = 'force-dynamic';

export default async function ReviewPostPage({ params }: { params: { id: string } }) {
  const postId = parseInt(params.id);
  if (isNaN(postId)) notFound();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { category: true },
  });
  if (!post) notFound();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <a href="/admin/review" style={{ color: '#1E9E7A', textDecoration: 'none', fontSize: '14px' }}>← 목록</a>
        <span style={{ color: '#4B7A6A', fontSize: '14px' }}>|</span>
        <span style={{ fontSize: '14px', color: '#4B7A6A' }}>#{post.id} · {post.category?.name}</span>
        <span style={{
          padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
          background: post.status === 'REVIEW_REQUIRED' ? '#FFF3CD' : post.status === 'PUBLISHED' ? '#D5F5E3' : '#FEE2E2',
          color: post.status === 'REVIEW_REQUIRED' ? '#856404' : post.status === 'PUBLISHED' ? '#1E8449' : '#991B1B',
        }}>
          {post.status}
        </span>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1B3A2D', marginBottom: '8px' }}>{post.title}</h1>
      <p style={{ color: '#4B7A6A', fontSize: '14px', marginBottom: '20px' }}>{post.excerpt}</p>

      {/* 품질 정보 */}
      <div style={{ background: '#F0FDF4', border: '1px solid #C8E6C9', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '11px', color: '#4B7A6A', margin: 0 }}>품질 점수</p>
            <p style={{ fontSize: '24px', fontWeight: 800, margin: 0,
              color: (post.qualityScore ?? 0) >= 70 ? '#1E8449' : '#991B1B' }}>
              {post.qualityScore ?? '미검사'}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#4B7A6A', margin: 0 }}>읽기 시간</p>
            <p style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#1B3A2D' }}>
              {(post as any).readTime ?? '-'}분
            </p>
          </div>
        </div>
        {post.rejectReasons && post.rejectReasons.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#991B1B', margin: '0 0 6px' }}>품질 미달 사유</p>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {post.rejectReasons.map((r: string, i: number) => (
                <li key={i} style={{ fontSize: '13px', color: '#991B1B' }}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {post.reviewNotes && (
          <p style={{ fontSize: '12px', color: '#4B7A6A', marginTop: '8px', marginBottom: 0 }}>
            📝 {post.reviewNotes}
          </p>
        )}
      </div>

      {/* 승인/반려 버튼 */}
      {post.status === 'REVIEW_REQUIRED' && (
        <ApproveRejectButtons
          postId={post.id}
          currentStatus={post.status}
          qualityScore={post.qualityScore}
          rejectReasons={post.rejectReasons}
        />
      )}

      {/* 본문 미리보기 */}
      <div style={{ background: '#fff', border: '1px solid #C8E6C9', borderRadius: '16px', padding: '24px', marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#1B3A2D' }}>본문 미리보기</h2>
        {post.thumbnail && (
          <img src={post.thumbnail} alt="썸네일"
            style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px' }} />
        )}
        <div
          dangerouslySetInnerHTML={{ __html: (post as any).content || '' }}
          style={{ fontSize: '14px', lineHeight: 1.8, color: '#1B3A2D' }}
        />
      </div>
    </div>
  );
}
