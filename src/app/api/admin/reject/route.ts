import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { postId, note } = await req.json();
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id: Number(postId) }, select: { status: true } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (!['REVIEW_REQUIRED', 'APPROVED'].includes(post.status)) {
      return NextResponse.json({ error: `Cannot reject from status: ${post.status}` }, { status: 400 });
    }

    const updated = await prisma.post.update({
      where: { id: Number(postId) },
      data: {
        status: 'DRAFT',
        reviewNotes: note || '반려 (사유 미입력)',
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, id: updated.id, status: updated.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
