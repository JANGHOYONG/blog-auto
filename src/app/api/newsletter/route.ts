import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // SiteConfig 테이블에 구독자 이메일 누적 저장 (간단 구현)
    const key = 'newsletter_subscribers';
    const existing = await prisma.siteConfig.findUnique({ where: { key } });
    const subscribers: string[] = existing ? JSON.parse(existing.value) : [];

    if (!subscribers.includes(email)) {
      subscribers.push(email);
      await prisma.siteConfig.upsert({
        where: { key },
        update: { value: JSON.stringify(subscribers) },
        create: { key, value: JSON.stringify(subscribers) },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
