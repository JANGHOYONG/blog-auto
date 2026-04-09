/**
 * 기존 발행 글 coupangProduct 백필 스크립트
 * - coupangProduct가 null인 health 카테고리 글에 Google Sheets에서 상품 데이터 채워넣기
 * - 본문 내 구버전 인라인 오렌지 배너 HTML 동시 제거
 *
 * 실행: node scripts/backfill-coupang.js
 * 옵션: --dry-run (실제 업데이트 없이 대상만 출력)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

// ─── content-generator.js와 동일한 설정 ────────────────────────────────────
const COUPANG_SHEET_ID = '19oPpfTbJaeTn6YtHS7QTRv1Q1XiZuMSCfO7PRU4bL-I';

const TOPIC_TO_SHEET = {
  blood_sugar:    '혈당당뇨',
  blood_pressure: '혈압심장',
  joint:          '관절근육',
  sleep:          '수면피로',
  brain:          '뇌건강',
  menopause:      '갱년기',
  nutrition:      '영양식이',
};

const TOPIC_CTA_TEXT = {
  blood_sugar:    '혈당·당뇨 건강 추천 제품',
  blood_pressure: '혈압·혈관 건강 추천 제품',
  joint:          '관절·연골 건강 추천 제품',
  sleep:          '수면·피로 개선 추천 제품',
  brain:          '뇌건강·기억력 추천 제품',
  menopause:      '갱년기 건강 추천 제품',
  nutrition:      '영양·건강식품 추천 제품',
};

const TOPIC_WORDS = {
  blood_sugar:    ['혈당', '당뇨', '인슐린', '혈액당', '공복혈당'],
  blood_pressure: ['혈압', '심장', '심혈관', '고혈압', '콜레스테롤', '동맥경화', '심부전', '부정맥'],
  joint:          ['관절', '무릎', '연골', '허리', '척추', '근육', '근감소', '골다공증', '어깨', '류마티스'],
  sleep:          ['수면', '불면', '피로', '수면장애', '멜라토닌', '불면증', '만성피로'],
  brain:          ['치매', '뇌', '기억력', '인지', '파킨슨', '뇌졸중', '알츠하이머'],
  menopause:      ['갱년기', '폐경', '호르몬', '안면홍조', '골밀도', '에스트로겐'],
  nutrition:      ['영양', '영양제', '비타민', '식이', '식단', '단백질', '오메가', '보충제'],
};

function getTopicFromKeywords(keywords) {
  const kws = Array.isArray(keywords) ? keywords : JSON.parse(keywords || '[]');
  for (const [topicId, words] of Object.entries(TOPIC_WORDS)) {
    if (kws.some((kw) => words.some((w) => kw.includes(w)))) {
      return topicId;
    }
  }
  // 제목/키워드 매칭 실패 시 blood_sugar 기본값
  return null;
}

async function fetchCoupangProducts(topicId) {
  const sheetName = TOPIC_TO_SHEET[topicId];
  if (!sheetName) return [];
  try {
    const url = `https://docs.google.com/spreadsheets/d/${COUPANG_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.trim().split('\n').slice(1);
    return lines.map((line) => {
      const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const clean = (v) => (v || '').replace(/^"|"$/g, '').trim();
      const name  = clean(cols[0]);
      const url   = clean(cols[1]);
      const image = clean(cols[2]);
      const rawPrice = clean(cols[3]);
      const price = rawPrice
        ? rawPrice.replace(/₩/g, '').replace(/원$/, '').trim().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'
        : null;
      return name && url ? { name, url, image: image || null, price: price || null } : null;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

// 구버전 인라인 오렌지 배너 제거
function stripOldCoupangBanner(content) {
  return content.replace(
    /<div style="margin:2rem 0;">\s*<a[^>]*rel="noopener sponsored"[^>]*>[\s\S]*?<\/a>\s*<p[^>]*>이 포스팅은 쿠팡 파트너스[\s\S]*?<\/p>\s*<\/div>/g,
    ''
  );
}

async function main() {
  console.log(`=== coupangProduct 백필 시작 ${isDryRun ? '[DRY RUN]' : ''} ===\n`);

  const posts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      category: { slug: 'health' },
      coupangProduct: null,
    },
    select: { id: true, title: true, keywords: true, content: true },
    orderBy: { id: 'asc' },
  });

  console.log(`대상 글: ${posts.length}개\n`);
  if (posts.length === 0) {
    console.log('백필 필요한 글 없음.');
    return;
  }

  let success = 0, skip = 0;

  for (const post of posts) {
    const topicId = getTopicFromKeywords(post.keywords);
    if (!topicId) {
      console.log(`  ⚠️  [id:${post.id}] 주제 분류 실패 — 건너뜀: "${post.title.slice(0, 30)}"`);
      skip++;
      continue;
    }

    const products = await fetchCoupangProducts(topicId);
    if (!products.length) {
      console.log(`  ⚠️  [id:${post.id}] [${TOPIC_TO_SHEET[topicId]}] 시트 상품 없음 — 건너뜀`);
      skip++;
      continue;
    }

    const product = products[Math.floor(Math.random() * products.length)];
    const coupangProductJson = JSON.stringify({
      name: product.name,
      url: product.url,
      image: product.image || null,
      price: product.price || null,
      ctaText: TOPIC_CTA_TEXT[topicId],
    });

    // 구버전 인라인 배너 제거
    const cleanedContent = stripOldCoupangBanner(post.content);
    const hadBanner = cleanedContent !== post.content;

    console.log(`  [id:${post.id}] [${TOPIC_CTA_TEXT[topicId]}]`);
    console.log(`    상품: "${product.name}" | 배너제거: ${hadBanner ? '✅' : '없었음'}`);

    if (!isDryRun) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          coupangProduct: coupangProductJson,
          content: cleanedContent,
        },
      });
      success++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ 완료: ${isDryRun ? '(dry-run)' : `${success}개 업데이트`}, ${skip}개 건너뜀`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
