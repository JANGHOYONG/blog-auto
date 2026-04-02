import Link from 'next/link';
import { prisma } from '@/lib/db';
import VisitorStats from './VisitorStats';

export default async function TopBar() {
  const popularPosts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
    orderBy: { viewCount: 'desc' },
    take: 3,
  });

  return (
    <div className="border-b" style={{ background: 'var(--bg-bar)', borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

          {/* 방문자 통계 */}
          <VisitorStats compact />

          {/* 구분선 */}
          {popularPosts.length > 0 && (
            <span className="hidden sm:block w-px h-4 mx-1" style={{ background: 'var(--border)' }} />
          )}

          {/* 인기글 */}
          {popularPosts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--primary)' }}>🔥 인기글</span>
              {popularPosts.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/${post.category.slug}/${post.slug}`}
                  className="text-xs px-3 py-1 rounded-full transition-colors hover:opacity-80 truncate max-w-[180px]"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  {i + 1}. {post.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
