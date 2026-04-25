import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  try {
    const { postId } = await req.json();
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id: Number(postId) }, select: { status: true } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.status !== 'REVIEW_REQUIRED') {
      return NextResponse.json({ error: `Cannot approve from status: ${post.status}` }, { status: 400 });
    }

    // 승인 즉시 PUBLISHED로 전환
    const now = new Date();
    const updated = await prisma.post.update({
      where: { id: Number(postId) },
      data: {
        status: 'PUBLISHED',
        reviewedAt: now,
        publishedAt: now,
      },
      select: { id: true, status: true, slug: true },
    });

    // Next.js 캐시 무효화
    try {
      revalidatePath('/');
      revalidatePath(`/${updated.slug}`);
    } catch (_) {}

    return NextResponse.json({ success: true, id: updated.id, status: updated.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
