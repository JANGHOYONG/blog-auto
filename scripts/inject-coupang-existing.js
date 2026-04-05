/**
 * 기존 발행 글에 쿠팡파트너스 상품 박스 삽입
 * 실행: node scripts/inject-coupang-existing.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COUPANG_SHEET_ID = '19oPpfTbJaeTn6YtHS7QTRv1Q1XiZuMSCfO7PRU4bL-I';

const HEALTH_TOPICS = [
  { id: 'blood_sugar',    label: '혈당·당뇨',   words: ['혈당', '당뇨', '인슐린', '공복혈당', '혈액당'] },
  { id: 'blood_pressure', label: '혈압·심장',   words: ['혈압', '심장', '심혈관', '고혈압', '콜레스테롤', '동맥경화', '심근', '부정맥'] },
  { id: 'joint',          label: '관절·근육',   words: ['관절', '무릎', '연골', '허리', '척추', '근육', '근감소', '골다공증', '어깨', '류마티스'] },
  { id: 'sleep',          label: '수면·피로',   words: ['수면', '불면', '피로', '수면장애', '잠', '멜라토닌', '불면증', '만성피로'] },
  { id: 'brain',          label: '뇌건강·치매', words: ['치매', '뇌', '기억력', '인지', '파킨슨', '뇌졸중', '알츠하이머'] },
  { id: 'menopause',      label: '갱년기',      words: ['갱년기', '폐경', '호르몬', '안면홍조', '에스트로겐'] },
  { id: 'nutrition',      label: '영양·식이',   words: ['영양', '영양제', '비타민', '식이', '음식', '식단', '단백질', '오메가', '면역', '갑상선', '체중'] },
];

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
  blood_sugar:    '혈당 관리에 도움되는 추천 제품',
  blood_pressure: '혈압·혈관 건강에 도움되는 추천 제품',
  joint:          '관절·연골 건강에 도움되는 추천 제품',
  sleep:          '수면의 질 개선에 도움되는 추천 제품',
  brain:          '뇌 건강·기억력에 도움되는 추천 제품',
  menopause:      '갱년기 건강에 도움되는 추천 제품',
  nutrition:      '영양 보충에 도움되는 추천 제품',
};

function getSubTopic(keyword) {
  for (const topic of HEALTH_TOPICS) {
    if (topic.words.some((w) => keyword.includes(w))) return topic.id;
  }
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
    return lines
      .map((line) => {
        const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const name = (cols[0] || '').replace(/^"|"$/g, '').trim();
        const url  = (cols[1] || '').replace(/^"|"$/g, '').trim();
        return name && url ? { name, url } : null;
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function makeCoupangHtml(product, topicId) {
  const ctaText = TOPIC_CTA_TEXT[topicId] || '관련 추천 제품';
  return `
<div class="coupang-affiliate-box">
  <div class="coupang-header">
    <span class="coupang-badge">🛒 ${ctaText}</span>
    <span class="coupang-logo">COUPANG</span>
  </div>
  <div class="coupang-body">
    <span class="coupang-product-name">${product.name}</span>
    <a href="${product.url}" target="_blank" rel="noopener sponsored" class="coupang-link">
      👉 지금 쿠팡에서 확인하기
    </a>
  </div>
  <p class="coupang-disclosure">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
</div>`;
}

// 삽입 위치 탐색 헬퍼 — 특정 위치 앞의 <section 찾기 (최소 위치 100 이상만 유효)
function findValidSectionBefore(content, idx) {
  let pos = content.lastIndexOf('<section', idx);
  // 너무 앞(intro)이면 유효하지 않음
  while (pos !== -1 && pos < 100) {
    pos = content.lastIndexOf('<section', pos - 1);
  }
  return pos > 100 ? pos : -1;
}

function insertCoupangBox(content, product, topicId) {
  const box = makeCoupangHtml(product, topicId);

  // 1순위: faq-item 위치 직접 탐색 → 그 앞 section
  const faqItemIdx = content.indexOf('class="faq-item"');
  if (faqItemIdx !== -1) {
    const pos = findValidSectionBefore(content, faqItemIdx);
    if (pos !== -1) return content.slice(0, pos) + box + '\n' + content.slice(pos);
  }

  // 2순위: 자주 묻는 질문 / FAQ 키워드 → 그 앞 section 또는 h2
  for (const kw of ['자주 묻는 질문', '자주묻는질문']) {
    const idx = content.indexOf(kw);
    if (idx !== -1) {
      const pos = findValidSectionBefore(content, idx);
      if (pos !== -1) return content.slice(0, pos) + box + '\n' + content.slice(pos);
    }
  }

  // 3순위: conclusion 섹션 앞
  if (content.includes('<section class="conclusion">')) {
    return content.replace('<section class="conclusion">', box + '\n<section class="conclusion">');
  }

  // 4순위: 마무리 / 결론 h2 → 그 앞 section
  for (const kw of ['마무리', '결론', '오늘부터 바로']) {
    const idx = content.indexOf(kw);
    if (idx !== -1) {
      const pos = findValidSectionBefore(content, idx);
      if (pos !== -1) return content.slice(0, pos) + box + '\n' + content.slice(pos);
    }
  }

  // 5순위: 마지막 h2 앞에 직접 삽입 (h2가 3개 이상인 경우만)
  const allH2s = [...content.matchAll(/<h2/g)];
  if (allH2s.length >= 3) {
    const lastH2 = allH2s[allH2s.length - 1];
    if (lastH2.index > 200) {
      return content.slice(0, lastH2.index) + box + '\n' + content.slice(lastH2.index);
    }
  }

  // 최후: </article> 바로 앞
  if (content.includes('</article>')) {
    return content.replace('</article>', box + '\n</article>');
  }
  return content + box;
}

async function main() {
  console.log('=== 기존 발행 글 쿠팡 상품 삽입 시작 ===\n');

  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    include: { category: true },
    orderBy: { publishedAt: 'desc' },
  });

  let updated = 0, skipped = 0;

  for (const post of posts) {
    // 이미 쿠팡 박스가 있으면 건너뜀
    if (post.content.includes('coupang-affiliate-box')) {
      console.log(`⏭️  스킵 (이미 있음): ${post.title.slice(0, 35)}`);
      skipped++;
      continue;
    }

    // health 카테고리만 적용
    if (post.category.slug !== 'health') {
      console.log(`⏭️  스킵 (비건강 카테고리): ${post.title.slice(0, 35)}`);
      skipped++;
      continue;
    }

    // 키워드로 주제 파악
    const keywords = JSON.parse(post.keywords || '[]');
    const titleWords = post.title.split(/[\s,·]+/);
    const allWords = [...keywords, ...titleWords];

    let topicId = null;
    for (const word of allWords) {
      topicId = getSubTopic(word);
      if (topicId) break;
    }

    if (!topicId) {
      console.log(`⏭️  스킵 (주제 미분류): ${post.title.slice(0, 35)}`);
      skipped++;
      continue;
    }

    const topicLabel = HEALTH_TOPICS.find((t) => t.id === topicId)?.label;
    console.log(`\n[${topicLabel}] ${post.title.slice(0, 40)}`);

    // 구글 시트에서 상품 가져오기
    const products = await fetchCoupangProducts(topicId);
    if (!products.length) {
      console.log(`  ⚠️ 상품 없음`);
      skipped++;
      continue;
    }

    // 랜덤 상품 선택
    const product = products[Math.floor(Math.random() * products.length)];
    console.log(`  → 선택 상품: ${product.name.slice(0, 40)}`);

    // 본문에 삽입
    const newContent = insertCoupangBox(post.content, product, topicId);

    // DB 업데이트
    await prisma.post.update({
      where: { id: post.id },
      data: { content: newContent },
    });

    console.log(`  ✅ 업데이트 완료`);
    updated++;

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✅ 완료: ${updated}개 업데이트, ${skipped}개 스킵`);
  await prisma.$disconnect();
}

main().catch(console.error);
