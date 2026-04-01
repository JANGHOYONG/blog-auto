import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== (process.env.REVALIDATE_SECRET || 'blog-revalidate')) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidatePath('/');
  revalidatePath('/[category]', 'page');
  revalidatePath('/[category]/[slug]', 'page');

  return NextResponse.json({ revalidated: true });
}
