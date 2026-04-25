import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ReviewQueue() {
  let posts: any[] = [];
  try {
    posts = await prisma.post.findMany({
      where: { status: { in: ['REVIEW_REQUIRED', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { category: true },
    });
  } catch (e) {
    console.error('DB error:', e);
  }

  const statusLabel: Record<string, string> = {
    REVIEW_REQUIRED: '감수 필요',
    APPROVED: '승인됨',
  };

  const statusStyle: Record<string, React.CSSProperties> = {
    REVIEW_REQUIRED: { background: '#FFF3CD', color: '#856404', padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 },
    APPROVED:        { background: '#D5F5E3', color: '#1E8449', padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 },
  };

  const reviewNeeded = posts.filter((p) => p.status === 'REVIEW_REQUIRED').length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px', color: '#1B3A2D' }}>감수 큐</h1>
      <p style={{ fontSize: '13px', color: '#4B7A6A', marginBottom: '24px' }}>승인 즉시 블로그에 발행됩니다.</p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFF3CD', padding: '12px 20px', borderRadius: '12px' }}>
          <p style={{ fontSize: '12px', color: '#856404', margin: 0 }}>감수 필요</p>
          <p style={{ fontSize: '24px', fontWeight: 800, color: '#856404', margin: 0 }}>{reviewNeeded}</p>
        </div>
        <div style={{ background: '#D5F5E3', padding: '12px 20px', borderRadius: '12px' }}>
          <p style={{ fontSize: '12px', color: '#1E8449', margin: 0 }}>전체 대기</p>
          <p style={{ fontSize: '24px', fontWeight: 800, color: '#1E8449', margin: 0 }}>{posts.length}</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#4B7A6A' }}>감수할 글이 없습니다 ✅</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #C8E6C9', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#F0FDF4', borderBottom: '1px solid #C8E6C9' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1B3A2D' }}>제목</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#1B3A2D' }}>카테고리</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: '#1B3A2D' }}>상태</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: '#1B3A2D' }}>점수</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1B3A2D' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} style={{ borderBottom: '1px solid #E8F5E9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <a href={`/admin/review/${post.id}`} style={{ color: '#1B3A2D', textDecoration: 'none', fontWeight: 600 }}>
                      {post.title.length > 50 ? post.title.slice(0, 50) + '…' : post.title}
                    </a>
                    {post.rejectReasons && post.rejectReasons.length > 0 && (
                      <p style={{ fontSize: '11px', color: '#991B1B', margin: '2px 0 0' }}>
                        {post.rejectReasons.slice(0, 2).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4B7A6A' }}>{post.category?.name || '-'}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <span style={statusStyle[post.status] || {}}>
                      {statusLabel[post.status] || post.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700,
                    color: (post.qualityScore ?? 0) >= 70 ? '#1E8449' : '#991B1B' }}>
                    {post.qualityScore ?? '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <a href={`/admin/review/${post.id}`}
                      style={{ padding: '6px 14px', background: '#1E9E7A', borderRadius: '8px',
                        fontSize: '12px', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
                      검토
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
