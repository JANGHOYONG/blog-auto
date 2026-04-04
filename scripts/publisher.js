/**
 * 자동 발행 스크립트
 * - DRAFT 글을 PUBLISHED 또는 SCHEDULED 상태로 전환
 * - 하루 발행 한도 관리
 * - 발행 시간 랜덤화
 *
 * 실행: node scripts/publisher.js
 * 옵션: --mode=immediate|schedule --limit=3
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');

// IndexNow: 네이버·빙에 새 URL 즉시 색인 요청
async function pingIndexNow(urls) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
  const key = '928bf1c4fe8f4ec2ae418e100cedd18e';
  const body = JSON.stringify({
    host: siteUrl.replace(/^https?:\/\//, ''),
    key,
    keyLocation: `${siteUrl}/${key}.txt`,
    urlList: urls,
  });

  const endpoints = [
    'api.indexnow.org',
    'www.bing.com',
    'searchadvisor.naver.com',
  ];

  for (const host of endpoints) {
    await new Promise((resolve) => {
      const req = https.request(
        { host, path: '/indexnow', method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } },
        (res) => { console.log(`  📡 IndexNow(${host}): ${res.statusCode}`); resolve(); }
      );
      req.on('error', () => resolve());
      req.write(body);
      req.end();
    });
  }
}

function callRevalidate() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
  const secret = process.env.REVALIDATE_SECRET || 'blog-revalidate';
  const url = `${siteUrl}/api/revalidate?secret=${secret}`;
  const lib = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const req = lib.request(url, { method: 'POST' }, (res) => {
      console.log(`  🔄 캐시 갱신: ${res.statusCode}`);
      resolve();
    });
    req.on('error', () => resolve());
    req.end();
  });
}

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : null;
};

const mode = getArg('mode') || 'schedule';              // immediate | schedule
const runLimit  = parseInt(getArg('limit') || '1');      // 1회 실행당 최대 발행 수
const dailyLimit = parseInt(process.env.DAILY_POST_LIMIT || '5'); // 하루 최대 발행 수
const startHour = parseInt(process.env.PUBLISH_START_HOUR || '9');
const endHour   = parseInt(process.env.PUBLISH_END_HOUR   || '21');

// 오늘 날짜의 랜덤 발행 시간 생성
function getRandomPublishTime(index, total) {
  const now = new Date();
  const today = new Date(now);

  // 발행 가능 시간대 분할
  const range = (endHour - startHour) * 60; // 분 단위
  const interval = Math.floor(range / total);
  const baseMinutes = index * interval + Math.floor(Math.random() * interval * 0.8);

  today.setHours(startHour, 0, 0, 0);
  today.setMinutes(today.getMinutes() + baseMinutes);

  // 과거 시간이면 즉시 발행으로
  if (today <= now) {
    today.setTime(now.getTime() + (index + 1) * 30 * 60 * 1000); // 30분 간격
  }

  return today;
}

// 오늘 발행 수 확인
async function getTodayPublishCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.post.count({
    where: {
      status: 'PUBLISHED',
      publishedAt: { gte: today, lt: tomorrow },
    },
  });
}

// 예약된 글 발행 처리 (스케줄러에서 호출)
async function processScheduledPosts() {
  const now = new Date();
  const scheduled = await prisma.post.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    take: 10,
  });

  if (scheduled.length === 0) return 0;

  let published = 0;
  for (const post of scheduled) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: post.scheduledAt,
      },
    });
    published++;
    console.log(`  📢 발행: "${post.title}"`);
  }

  return published;
}

async function main() {
  console.log('=== 자동 발행 시작 ===');
  console.log(`모드: ${mode}, 1회 한도: ${runLimit}개, 일일 한도: ${dailyLimit}개`);

  try {
    // 예약 발행 먼저 처리
    const scheduledPublished = await processScheduledPosts();
    if (scheduledPublished > 0) {
      console.log(`예약 발행 ${scheduledPublished}개 처리 완료`);
    }

    // 오늘 발행 수 확인
    const todayCount = await getTodayPublishCount();
    const dailyRemaining = dailyLimit - todayCount;
    const remaining = Math.min(runLimit, dailyRemaining);

    console.log(`오늘 발행: ${todayCount}/${dailyLimit} (이번 실행 최대: ${runLimit}개, 일일 잔여: ${dailyRemaining}개)`);

    if (dailyRemaining <= 0) {
      console.log('오늘 일일 발행 한도에 도달했습니다.');
      return;
    }

    // DRAFT 글 가져오기 (생성 순)
    const drafts = await prisma.post.findMany({
      where: { status: 'DRAFT' },
      orderBy: { createdAt: 'asc' },
      take: remaining,
      include: { category: true },
    });

    if (drafts.length === 0) {
      console.log('발행할 DRAFT 글이 없습니다.');
      return;
    }

    console.log(`\n발행 대상: ${drafts.length}개\n`);

    let publishedCount = 0;
    const publishedUrls = [];

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const postUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr'}/${draft.category.slug}/${draft.slug}`;

      if (mode === 'immediate') {
        // 즉시 발행
        await prisma.post.update({
          where: { id: draft.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
        console.log(`[즉시] 발행: "${draft.title}"`);
        publishedUrls.push(postUrl);
      } else {
        // 예약 발행 (랜덤 시간)
        const scheduledAt = getRandomPublishTime(i, drafts.length);
        await prisma.post.update({
          where: { id: draft.id },
          data: {
            status: 'SCHEDULED',
            scheduledAt,
          },
        });
        console.log(`[예약] "${draft.title}"`);
        console.log(`  → 발행 예정: ${scheduledAt.toLocaleString('ko-KR')}`);
      }

      publishedCount++;
    }

    // 로그 저장
    await prisma.automationLog.create({
      data: {
        type: 'POST_PUBLISH',
        status: 'SUCCESS',
        message: `${publishedCount}개 ${mode === 'immediate' ? '즉시 발행' : '예약 등록'} 완료`,
        details: JSON.stringify({ mode, publishedCount, todayTotal: todayCount + publishedCount }),
      },
    });

    if (publishedCount > 0) {
      await callRevalidate();
      // 즉시 발행된 URL만 IndexNow 핑 전송
      if (publishedUrls.length > 0) {
        await pingIndexNow(publishedUrls);
      }
    }
    console.log(`\n✅ ${publishedCount}개 ${mode === 'immediate' ? '발행 완료' : '예약 완료'}`);
  } catch (error) {
    console.error('오류:', error);

    await prisma.automationLog.create({
      data: {
        type: 'POST_PUBLISH',
        status: 'FAILED',
        message: error.message,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main();
