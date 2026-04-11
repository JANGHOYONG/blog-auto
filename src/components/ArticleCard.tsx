import Link from 'next/link';
import { Post, Category } from '@prisma/client';

type PostWithCategory = Post & { category: Category };

const CAT_GRADIENT: Record<string, string> = {
  health:    'from-emerald-100 to-teal-200',
  tech:      'from-sky-200 to-blue-300',
  economy:   'from-amber-200 to-yellow-300',
  lifestyle: 'from-pink-200 to-fuchsia-200',
  travel:    'from-teal-200 to-emerald-200',
};

const CAT_EMOJI: Record<string, string> = {
  health: '🏥', tech: '💻', economy: '📈', lifestyle: '🏠', travel: '✈️',
};

interface Props {
  post: PostWithCategory;
  size?: 'default' | 'compact';
}

export default function ArticleCard({ post, size = 'default' }: Props) {
  const href = `/${post.category.slug}/${post.slug}`;
  const gradient = CAT_GRADIENT[post.category.slug] || 'from-stone-200 to-stone-300';
  const emoji = CAT_EMOJI[post.category.slug] || '📝';
  const thumbnail = (post as any).thumbnail as string | null;

  if (size === 'compact') {
    return (
      <article className="flex gap-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex-1 min-w-0">
          <Link href={href} className="text-sm font-medium line-clamp-2 block hover:opacity-75 transition-opacity" style={{ color: 'var(--text)' }}>
            {post.title}
          </Link>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="card group flex flex-col">
      {/* 썸네일 */}
      <Link href={href} className="block overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={post.title}
            className="w-full h-36 sm:h-48 object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            width={600}
            height={400}
          />
        ) : (
          <div className={`h-36 sm:h-48 bg-gradient-to-br ${gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}>
            <span className="text-5xl opacity-60">{emoji}</span>
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {/* 카테고리 + 날짜 */}
        <div className="flex items-center justify-between mb-2">
          <span className="category-badge text-xs">{post.category.name}</span>
          {post.publishedAt && (
            <time className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(post.publishedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </time>
          )}
        </div>

        {/* 제목 */}
        <h2 className="font-bold mb-2 line-clamp-3 leading-snug text-base flex-1 group-hover:opacity-75 transition-opacity" style={{ color: 'var(--text)' }}>
          <Link href={href}>{post.title}</Link>
        </h2>

        {/* 요약 */}
        <p className="text-sm line-clamp-2 leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
          {post.excerpt}
        </p>

        {/* 메타 */}
        <div className="flex items-center justify-between text-xs pt-3 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <div className="flex gap-3">
            {post.readTime && <span>⏱ {post.readTime}분</span>}
            <span>👁 {post.viewCount.toLocaleString()}</span>
          </div>
          <Link href={href} className="font-semibold text-xs transition-opacity hover:opacity-70 py-2 px-3" style={{ color: 'var(--primary)', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
            읽기 →
          </Link>
        </div>
      </div>
    </article>
  );
}
