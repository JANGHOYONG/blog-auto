/**
 * 콘텐츠 자동 생성 스크립트 (GPT-4o-mini + Unsplash 이미지)
 * 실행: node scripts/content-generator.js
 * 옵션: --count=3 --category=tech
 */

require('dotenv').config();
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const args = process.argv.slice(2);
const getArg = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : null;
};
const generateCount = parseInt(getArg('count') || process.env.DAILY_POST_LIMIT || '3');
const targetCategory = getArg('category');

// ─── 쿠팡파트너스 구글 시트 연동 ─────────────────────────────────────────────
const COUPANG_SHEET_ID = '19oPpfTbJaeTn6YtHS7QTRv1Q1XiZuMSCfO7PRU4bL-I';

// 7대 주제 → 구글 시트 탭 이름 매핑
const TOPIC_TO_SHEET = {
  blood_sugar:    '혈당당뇨',
  blood_pressure: '혈압심장',
  joint:          '관절근육',
  sleep:          '수면피로',
  brain:          '뇌건강',
  menopause:      '갱년기',
  nutrition:      '영양식이',
};

// 주제별 배너 카테고리 문구
const TOPIC_CTA_TEXT = {
  blood_sugar:    '혈당·당뇨 건강 추천 제품',
  blood_pressure: '혈압·혈관 건강 추천 제품',
  joint:          '관절·연골 건강 추천 제품',
  sleep:          '수면·피로 개선 추천 제품',
  brain:          '뇌건강·기억력 추천 제품',
  menopause:      '갱년기 건강 추천 제품',
  nutrition:      '영양·건강식품 추천 제품',
};

// 구글 시트에서 해당 주제 상품 목록 읽기 (CSV 파싱)
async function fetchCoupangProducts(topicId) {
  const sheetName = TOPIC_TO_SHEET[topicId];
  if (!sheetName) {
    console.log(`    [쿠팡] topicId="${topicId}" 에 해당하는 시트 없음`);
    return [];
  }
  try {
    const url = `https://docs.google.com/spreadsheets/d/${COUPANG_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    console.log(`    [쿠팡] 시트 로딩: "${sheetName}" (${url.slice(0, 80)}...)`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`    [쿠팡] HTTP 오류: ${res.status}`);
      return [];
    }
    const csv = await res.text();
    const lines = csv.trim().split('\n').slice(1); // 헤더 제거
    const products = lines
      .map((line) => {
        // CSV 파싱: "상품명","URL","이미지URL(선택)","가격(선택)"
        const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const clean = (v) => (v || '').replace(/^"|"$/g, '').trim();
        const name  = clean(cols[0]);
        const url   = clean(cols[1]);
        const image = clean(cols[2]); // 선택: 구글 시트 C열
        // 가격 정규화: ₩13,900 / 13900 / 13,900원 → "13,900원"
        const rawPrice = clean(cols[3]);
        const price = rawPrice
          ? rawPrice.replace(/₩/g, '').replace(/원$/, '').trim().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'
          : null;
        return name && url ? { name, url, image: image || null, price: price || null } : null;
      })
      .filter(Boolean);
    console.log(`    [쿠팡] "${sheetName}" 시트에서 ${products.length}개 상품 로딩 완료`);
    return products;
  } catch (e) {
    console.log(`    [쿠팡] fetch 오류: ${e.message}`);
    return [];
  }
}

// 쿠팡 배너 HTML 생성 — 인라인 스타일 (CSS 클래스 의존 제거)
function makeCoupangHtml(product, topicId) {
  const ctaText = TOPIC_CTA_TEXT[topicId] || '건강 추천 제품';
  return `
<div style="margin:2rem 0;">
  <a href="${product.url}" target="_blank" rel="noopener sponsored" style="display:flex;align-items:center;justify-content:space-between;text-decoration:none;padding:1rem 1.25rem;border-radius:16px;background:linear-gradient(90deg,#FF6B35 0%,#FF8A38 100%);box-shadow:0 3px 12px rgba(255,107,53,0.22);">
    <span style="color:#ffffff;font-size:1.1875rem;font-weight:700;line-height:1.3;">🛒 ${ctaText}</span>
    <span style="background:#ffffff;color:#FF6B35;padding:0.5rem 1rem;border-radius:12px;font-weight:700;font-size:0.875rem;white-space:nowrap;margin-left:0.75rem;flex-shrink:0;">쿠팡에서 보기 →</span>
  </a>
  <p style="font-size:0.75rem;margin-top:0.5rem;margin-bottom:0;color:#AAAAAA;line-height:1.6;">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
</div>`;
}

// 삽입 위치 탐색 헬퍼 — 특정 위치 앞의 <section 찾기 (최소 위치 100 이상만 유효)
function findValidSectionBefore(content, idx) {
  let pos = content.lastIndexOf('<section', idx);
  while (pos !== -1 && pos < 100) {
    pos = content.lastIndexOf('<section', pos - 1);
  }
  return pos > 100 ? pos : -1;
}

// 본문 중간 </section> 기준으로 쿠팡 박스 삽입
function insertCoupangBox(content, product, topicId) {
  if (!product) return content;
  const box = makeCoupangHtml(product, topicId);

  // 1순위: </section> 중간 지점에 삽입
  const matches = [...content.matchAll(/<\/section>/g)];
  if (matches.length >= 3) {
    const midIdx = Math.floor(matches.length / 2);
    const pos = matches[midIdx].index + '</section>'.length;
    return content.slice(0, pos) + '\n' + box + '\n' + content.slice(pos);
  }

  // fallback: </article> 바로 앞
  if (content.includes('</article>')) {
    return content.replace('</article>', box + '\n</article>');
  }
  return content + box;
}

// ─── Pexels 이미지 ───────────────────────────────────────────────────────────
async function fetchPexelsImage(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.photos || !data.photos.length) return null;
    // 상위 5개 중 랜덤 선택
    const pool = data.photos.slice(0, 5);
    const photo = pool[Math.floor(Math.random() * pool.length)];
    return {
      url: photo.src.large,
      alt: photo.alt || query,
      credit: `Photo by ${photo.photographer} on Pexels`,
      creditUrl: photo.photographer_url,
    };
  } catch {
    return null;
  }
}

async function fetchBodyImages(keywords, count = 3) {
  const results = [];
  // 키워드가 부족하면 'senior health' 기본 쿼리로 채움
  const queries = [...keywords.slice(0, count)];
  while (queries.length < count) queries.push('senior health wellness');
  for (const q of queries) {
    const img = await fetchPexelsImage(q);
    if (img) results.push(img);
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}

function makeImgHtml(img) {
  return `
<figure style="margin:2rem 0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(30,158,122,0.10)">
  <img src="${img.url}" alt="${img.alt}" style="width:100%;max-height:420px;object-fit:cover;display:block" loading="lazy" />
  <figcaption style="font-size:0.75rem;text-align:center;padding:0.5rem 1rem;background:#E3F4ED;color:#4B7A6A">
    <a href="${img.creditUrl}" target="_blank" rel="noopener noreferrer" style="color:#1E9E7A">${img.credit}</a>
  </figcaption>
</figure>`;
}

function injectBodyImages(content, images) {
  if (!images.length) return content;

  // 1순위: </section> 기준 2번째, 4번째, 6번째 뒤에 삽입 (3장)
  const sectionCount = (content.match(/<\/section>/g) || []).length;
  if (sectionCount >= 2) {
    let count = 0;
    let imgIdx = 0;
    return content.replace(/<\/section>/g, (match) => {
      count++;
      if ((count === 2 || count === 4 || count === 6) && imgIdx < images.length) {
        return match + makeImgHtml(images[imgIdx++]);
      }
      return match;
    });
  }

  // 2순위: </section> 없으면 </h2> 기준 2번째, 4번째, 6번째 뒤에 삽입
  const h2Count = (content.match(/<\/h2>/g) || []).length;
  if (h2Count >= 2) {
    let count = 0;
    let imgIdx = 0;
    return content.replace(/<\/h2>/g, (match) => {
      count++;
      if ((count === 2 || count === 4 || count === 6) && imgIdx < images.length) {
        return match + makeImgHtml(images[imgIdx++]);
      }
      return match;
    });
  }

  // 3순위: 글 1/3, 2/3, 끝 부분에 강제 삽입
  const third = Math.floor(content.length / 3);
  const insertPos = content.indexOf('</p>', third);
  if (insertPos !== -1 && images.length >= 1) {
    const after = insertPos + 4;
    let result = content.slice(0, after) + makeImgHtml(images[0]) + content.slice(after);
    if (images.length >= 2) {
      const twoThird = Math.floor(result.length * 0.6);
      const insertPos2 = result.indexOf('</p>', twoThird);
      if (insertPos2 !== -1) {
        result = result.slice(0, insertPos2 + 4) + makeImgHtml(images[1]) + result.slice(insertPos2 + 4);
      }
    }
    if (images.length >= 3) {
      const threeQ = Math.floor(result.length * 0.85);
      const insertPos3 = result.indexOf('</p>', threeQ);
      if (insertPos3 !== -1) {
        result = result.slice(0, insertPos3 + 4) + makeImgHtml(images[2]) + result.slice(insertPos3 + 4);
      }
    }
    return result;
  }

  return content;
}

// ─── 건강 15개 주제 (순차 로테이션) ─────────────────────────────────────────
// health 카테고리 7개 → knowledge 카테고리 8개 순으로 이어짐
const HEALTH_TOPICS = [
  // ── health 카테고리 (쿠팡 시트 연동) ──────────────────────────────────────
  { id: 'blood_sugar',    label: '혈당·당뇨',         category: 'health',    words: ['혈당', '당뇨', '인슐린', '혈액당', '공복혈당'] },
  { id: 'blood_pressure', label: '혈압·심장',         category: 'health',    words: ['혈압', '심장', '심혈관', '고혈압', '심근', '부정맥', '콜레스테롤', '동맥경화', '심부전'] },
  { id: 'joint',          label: '관절·근육',         category: 'health',    words: ['관절', '무릎', '연골', '허리', '척추', '근육', '근감소', '골다공증', '어깨', '힘줄', '류마티스'] },
  { id: 'sleep',          label: '수면·피로',         category: 'health',    words: ['수면', '불면', '피로', '수면장애', '잠', '멜라토닌', '불면증', '만성피로', '졸음'] },
  { id: 'brain',          label: '뇌건강·치매',       category: 'health',    words: ['치매', '뇌', '기억력', '인지', '파킨슨', '뇌졸중', '알츠하이머', '뇌건강', '인지저하'] },
  { id: 'menopause',      label: '갱년기',            category: 'health',    words: ['갱년기', '폐경', '호르몬', '안면홍조', '골밀도', '에스트로겐', '남성갱년기'] },
  { id: 'nutrition',      label: '영양·식이',         category: 'health',    words: ['영양', '영양제', '비타민', '식이', '음식', '식단', '건강식', '단백질', '오메가', '식품', '보충제'] },
  // ── knowledge 카테고리 (다이나믹 배너) ────────────────────────────────────
  { id: 'immunity',       label: '면역력·감염',       category: 'knowledge', words: ['면역', '면역력', '감기', '독감', '폐렴', '바이러스', '항체', '항바이러스', '감염'] },
  { id: 'digestion',      label: '소화·장건강',       category: 'knowledge', words: ['소화', '위염', '역류성', '장건강', '변비', '대장', '위장', '장내세균', '과민성', '위산', '헬리코박터'] },
  { id: 'eye',            label: '눈건강·시력',       category: 'knowledge', words: ['눈', '시력', '노안', '황반', '백내장', '안구건조', '녹내장', '망막', '눈건강'] },
  { id: 'skin',           label: '피부·노화',         category: 'knowledge', words: ['피부', '주름', '노화', '검버섯', '피부탄력', '콜라겐', '자외선', '피부노화'] },
  { id: 'oral',           label: '구강·치아',         category: 'knowledge', words: ['치아', '잇몸', '구강', '치주염', '임플란트', '구취', '치석', '구강건강', '틀니'] },
  { id: 'liver',          label: '간·해독',           category: 'knowledge', words: ['간', '지방간', '간수치', '간건강', '해독', '간염', '간경화', 'ALT', 'AST'] },
  { id: 'lung',           label: '폐·호흡기',         category: 'knowledge', words: ['폐', '호흡기', '기관지', '폐기능', '폐건강', '천식', '만성기침', 'COPD'] },
  { id: 'mental',         label: '정신건강·스트레스', category: 'knowledge', words: ['우울', '불안', '스트레스', '정신건강', '노년우울', '무기력', '공황', '불안장애'] },
];

// 7개 주제 ID 순서 배열
const TOPIC_ROTATION = HEALTH_TOPICS.map((t) => t.id);

function getSubTopic(keyword) {
  for (const topic of HEALTH_TOPICS) {
    if (topic.words.some((w) => keyword.includes(w))) return topic.id;
  }
  return null; // 분류 불가
}

// 다음 로테이션 주제 결정
function getNextTopic(lastTopicId) {
  if (!lastTopicId) return TOPIC_ROTATION[0];
  const idx = TOPIC_ROTATION.indexOf(lastTopicId);
  return TOPIC_ROTATION[(idx + 1) % TOPIC_ROTATION.length];
}

// ─── 슬러그 생성 ──────────────────────────────────────────────────────────────
function generateSlug(title) {
  const timestamp = Date.now();
  const simplified = title
    .replace(/[가-힣]+/g, (m) => `p${m.charCodeAt(0) % 10000}`)
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 50);
  return `${simplified}-${timestamp}`;
}

// ─── 주제별 콘텐츠 각도 (흥미 유발·반전·충격 정보 중심) ──────────────────────
const TOPIC_CONTENT_ANGLES = {
  blood_sugar: {
    angle: '반전형 — 건강하다고 알려진 것들의 반전 + 혈당 관리의 의외의 진실',
    forbidden: '운동 열심히 하세요, 균형 잡힌 식단, 설탕 줄이세요 같은 뻔한 조언',
    focus: [
      '건강식품·다이어트 식품인데 실제로 혈당을 폭등시키는 의외의 식품들',
      '스트레스·수면 부족이 혈당에 미치는 충격적인 수치 (잠 1시간 부족 = 혈당 23% 상승 등)',
      '혈당 강하제보다 효과 있다고 밝혀진 특정 음식/행동 최신 연구',
      '공복혈당은 정상인데 당뇨 전단계인 경우 — 병원에서 안 잡아내는 이유',
    ],
  },
  blood_pressure: {
    angle: '경고형 — 혈압 환자들이 모르고 하는 위험한 행동 + 약의 의외의 부작용',
    forbidden: '규칙적인 운동, 저염식 식단, 금연·금주 같은 뻔한 조언',
    focus: [
      '혈압약과 함께 먹으면 위험한 음식·영양제 조합 (자몽, 칼슘, 특정 진통제 등)',
      '아침에 혈압이 특히 높은 이유와 뇌졸중과의 관계 — 최신 연구',
      '혈압 측정을 잘못하면 수치가 20mmHg 달라지는 이유',
      '백의고혈압·가면고혈압 — 병원에서 검사해도 안 잡히는 진짜 고혈압',
    ],
  },
  joint: {
    angle: '반전형 — 관절에 좋다는 통념의 반전 + 잘못된 운동·식품의 위험성',
    forbidden: '운동 꾸준히 하세요, 체중 관리, 연골에 좋은 콜라겐 같은 뻔한 조언',
    focus: [
      '걷기·계단 운동이 무릎 연골을 망가뜨리는 경우 (잘못된 자세·각도)',
      '콜라겐 영양제가 관절에 효과 없다는 최신 연구와 실제로 효과 있는 성분',
      '무릎 통증의 진짜 원인이 무릎이 아닌 경우 (고관절·발목 문제)',
      '항염증 음식 먹으면서 동시에 염증 폭발시키는 조합',
    ],
  },
  sleep: {
    angle: '증상체크형 — 수면과 치매·혈당·심장의 충격적 연관성',
    forbidden: '일찍 자고 일찍 일어나세요, 7-8시간 주무세요 같은 뻔한 조언',
    focus: [
      '수면 중 이 증상 있으면 치매 위험 3배 — 수면무호흡증과 뇌 노폐물 관계',
      '잠자리에 드는 시간보다 기상 시간이 더 중요한 이유 — 심장마비 위험과 연관',
      '수면제가 치매를 앞당긴다는 연구 + 수면제 대신 실제로 효과 있는 방법',
      '낮잠 20분의 역설 — 잘못 자면 밤잠 망치는 낮잠, 제대로 자는 법',
    ],
  },
  brain: {
    angle: '의사가 안 알려주는형 — 치매 전조 신호 + 뇌를 망가뜨리는 일상 속 의외의 원인',
    forbidden: '두뇌 게임, 독서, 사회활동 같은 뻔한 조언',
    focus: [
      '치매 10년 전 나타나는 신호 — 대부분이 노화로 착각하는 초기 증상',
      '위장약·수면제·항히스타민제가 뇌를 망가뜨린다는 연구 (항콜린제 부작용)',
      '당뇨·고혈압이 치매를 일으키는 정확한 메커니즘 — 뇌혈관 손상 단계별',
      '입속 세균이 뇌에 들어가 알츠하이머 유발 — 구강 건강과 치매의 충격적 연관성',
    ],
  },
  menopause: {
    angle: '숫자/기간형 — 갱년기 증상 완화의 구체적 수치 + 효과 없는 속설 타파',
    forbidden: '콩 많이 드세요, 긍정적으로 생각하세요, 운동하세요 같은 뻔한 조언',
    focus: [
      '갱년기 여성 10명 중 7명이 모르는 — 안면홍조의 진짜 원인은 따로 있다',
      '호르몬 치료가 암을 유발한다는 오해 — 최신 연구로 완전히 뒤집힌 사실',
      '갱년기에 살이 찌는 진짜 이유 — 식이조절이 오히려 역효과인 경우',
      '남성 갱년기 — 60대 남성 2명 중 1명이 겪지만 모르고 지나가는 이유',
    ],
  },
  nutrition: {
    angle: '금지/경고형 — 건강하다는 영양제·식품의 충격적 부작용 + 잘못된 복용법',
    forbidden: '비타민C, 오메가3 좋아요, 채소 과일 많이 드세요 같은 뻔한 조언',
    focus: [
      '60대 이후 절대 같이 먹으면 안 되는 영양제 조합 (칼슘+마그네슘, 철분+칼슘 등)',
      '건강기능식품이 처방약 효과를 완전히 없애버리는 경우 — 실제 사례',
      '공복에 먹으면 위험한 영양제 + 반드시 식후에 먹어야 흡수되는 것',
      '지용성 비타민(A·D·E·K) 과다복용이 일으키는 독성 — 많이 먹을수록 좋다는 착각',
    ],
  },
  // ── knowledge 카테고리 신규 8개 ────────────────────────────────────────────
  immunity: {
    angle: '반전형 — 면역력 강화 속설의 반전 + 면역 과잉이 더 위험한 이유',
    forbidden: '비타민C 많이 드세요, 운동하세요, 충분히 주무세요 같은 뻔한 조언',
    focus: [
      '면역력 강화 영양제·건강기능식품이 자가면역질환을 악화시키는 경우',
      '50대 이후 면역 과잉 반응(만성염증)이 암·심혈관 질환의 진짜 원인이 되는 이유',
      '독감 백신 맞아도 걸리는 이유 — 항체와 T세포 면역의 차이',
      '코로나 후유증이 면역계를 장기간 망가뜨리는 메커니즘과 회복법',
    ],
  },
  digestion: {
    angle: '충격형 — 장이 제2의 뇌라는 증거 + 소화약·유산균의 충격적 부작용',
    forbidden: '천천히 꼭꼭 씹으세요, 규칙적인 식사, 자극적 음식 피하세요 같은 뻔한 조언',
    focus: [
      '장내세균 불균형이 치매·우울증·당뇨를 일으키는 최신 연구',
      '프로바이오틱스(유산균)가 오히려 장을 망가뜨릴 수 있는 경우',
      '위산억제제(PPI)를 6개월 이상 먹으면 생기는 충격적 부작용',
      '변비약 장기복용이 대장을 게으르게 만들고 의존성이 생기는 원리',
    ],
  },
  eye: {
    angle: '경고형 — 실명으로 가는 초기 신호 + 눈에 좋다는 상식의 반전',
    forbidden: '당근 드세요, 스마트폰 줄이세요, 눈 운동하세요 같은 뻔한 조언',
    focus: [
      '황반변성 10년 전부터 나타나는 신호 — 대부분이 노화로 착각하는 증상',
      '블루라이트 차단 안경이 효과 없다는 최신 임상 연구 결과',
      '당뇨·고혈압이 눈을 망가뜨리는 정확한 메커니즘 — 실명까지의 단계',
      '루테인·지아잔틴 영양제, 정말 효과 있는지 최신 연구로 확인하는 법',
    ],
  },
  skin: {
    angle: '반전형 — 안티에이징 케어가 오히려 피부 노화를 앞당기는 경우',
    forbidden: '자외선차단제 바르세요, 수분 충분히 드세요 같은 뻔한 조언',
    focus: [
      '레티놀·비타민C 세럼이 50~60대 피부에 역효과가 나는 경우와 이유',
      '피부과 시술 후 더 빠르게 노화하는 피부 유형 — 콜라겐 생성 메커니즘',
      '검버섯·기미가 피부암으로 변하는 경계 신호와 자가진단법',
      '수면 자세와 베개가 얼굴 주름에 미치는 충격적 영향',
    ],
  },
  oral: {
    angle: '연결형 — 구강 건강이 심장·치매·당뇨와 연결되는 충격적 메커니즘',
    forbidden: '양치질 잘 하세요, 치실 사용하세요 같은 뻔한 조언',
    focus: [
      '잇몸 세균이 혈관을 타고 심근경색·알츠하이머를 일으키는 경로',
      '임플란트 시술 후 절대 해서는 안 되는 것들 — 실패 원인 TOP5',
      '구강건조증이 단순 불편함이 아닌 이유 — 당뇨·면역질환 신호일 수 있다',
      '틀니·임플란트 관리비 절반으로 줄이는 치과에서 안 알려주는 방법',
    ],
  },
  liver: {
    angle: '경고형 — 지방간 방치하면 생기는 일 + 간에 좋다는 속설의 반전',
    forbidden: '술 줄이세요, 기름진 음식 피하세요 같은 뻔한 조언',
    focus: [
      '술 한 방울 안 마셔도 생기는 비알코올성 지방간 — 50대 3명 중 1명 해당',
      'ALT·AST 수치가 정상 범위 내여도 간이 위험한 경우',
      '간에 좋다는 건강기능식품(밀크시슬·헛개나무)이 오히려 간을 망가뜨리는 경우',
      '지방간이 당뇨·심혈관 질환·간암으로 이어지는 정확한 진행 경로',
    ],
  },
  lung: {
    angle: '자가진단형 — 폐암·COPD 초기 신호 + 비흡연자도 폐가 망가지는 이유',
    forbidden: '금연하세요, 환기하세요 같은 뻔한 조언',
    focus: [
      '비흡연 여성 폐암이 급증하는 이유 — 요리 연기·미세먼지의 충격적 위험',
      'COPD 10년 전 나타나는 신호 — 대부분이 노화로 착각하는 증상',
      '폐 기능 검사가 정상이어도 폐가 망가져 있는 경우',
      '폐 건강 회복에 실제 효과 있는 것 vs 효과 없다고 밝혀진 것',
    ],
  },
  mental: {
    angle: '증상체크형 — 노년 우울증의 숨겨진 신호 + 항우울제의 충격적 부작용',
    forbidden: '긍정적으로 생각하세요, 사람들과 어울리세요 같은 뻔한 조언',
    focus: [
      '노년 우울증이 치매로 이어지는 메커니즘 — 5년 내 치매 위험 2배',
      '항우울제 장기복용이 뇌 구조를 바꾸는 방식과 중단 증후군',
      '스트레스가 텔로미어를 단축시켜 세포 노화를 앞당기는 최신 연구',
      '50~60대 남성 우울증 — 여성보다 자살 위험 3배지만 병원을 안 가는 이유',
    ],
  },
};

// ─── 카테고리별 전문가 역할 ───────────────────────────────────────────────────
const SYSTEM_ROLES = {
  health:    '서울대 의대·서울아산병원 20년 경력 내과·가정의학과 전문의이자 5060 시니어 건강 전문 칼럼니스트. 고혈압·당뇨·관절·수면·갱년기·치매 예방 등 중장년 건강 문제를 최신 임상 근거 기반으로 설명. 독자는 주로 50~60대이므로 어려운 의학 용어는 반드시 쉽게 풀어쓰고, 당장 집에서 실천할 수 있는 구체적 방법 위주로 작성. 과잉 진단·과잉 치료 없이 신뢰할 수 있는 정보만 전달. ⚠️ 절대 금지: "운동 꾸준히 하세요", "균형 잡힌 식단", "금연·금주" 같이 누구나 아는 뻔한 조언은 절대 쓰지 않습니다. 독자가 이미 알고 있는 상식을 반복하는 것은 글의 가치를 0으로 만듭니다. 반드시 독자가 "이런 사실이 있었어?" 하고 놀랄 만한 반전 정보, 최신 연구 기반의 새로운 사실, 의사도 잘 알려주지 않는 숨겨진 위험을 중심으로 작성하세요.',
  tech:      '실리콘밸리 출신 시니어 엔지니어 겸 IT 전문 저널리스트. 20년 현장 경험으로 쌓은 기술 트렌드 분석 능력과 일반인도 이해할 수 있는 설명력 보유. 실제 사용해본 경험 기반으로 장단점 솔직하게 작성.',
  economy:   '10년 경력 공인 재무설계사(CFP) 겸 경제 칼럼니스트. 주식, 부동산, 절세 전략까지 실제 돈이 되는 정보를 구체적 수치와 함께 제공. 독자가 바로 실행할 수 있는 단계별 방법 위주로 작성.',
  lifestyle: '라이프스타일 전문 에디터. 수천 건의 제품 리뷰와 생활 실험을 거친 실용 정보 전문가. 독자 삶의 질을 실제로 높일 수 있는 검증된 팁과 노하우 중심으로 작성.',
  travel:    '20년 경력 여행·여가 전문 작가 겸 라이프스타일 큐레이터. 국내외 여행지, 취미·문화생활, 힐링·휴가 정보를 5060 중장년층 시각에서 생생하게 전달. 가성비 있는 여행 코스, 시니어 친화 관광지, 건강한 여가생활 팁을 구체적으로 안내.',
};

// ─── 글 생성 (2단계: 메타데이터 → 본문 분리) ──────────────────────────────────
async function generatePost(keyword, categorySlug, topicId = null) {
  // knowledge 카테고리도 health 전문의 역할 + 시니어 지침 적용
  const effectiveSlug = categorySlug === 'knowledge' ? 'health' : categorySlug;
  const role = SYSTEM_ROLES[effectiveSlug] || '전문 블로그 작가.';
  const isHealth = effectiveSlug === 'health';

  // 주제별 콘텐츠 각도 — health 카테고리이고 topicId가 있을 때만 적용
  const angleInfo = isHealth && topicId ? TOPIC_CONTENT_ANGLES[topicId] : null;
  const angleBlock = angleInfo ? `
[이번 글의 콘텐츠 전략 — 반드시 준수]
▪ 콘텐츠 각도: ${angleInfo.angle}
▪ 절대 쓰지 말 것: ${angleInfo.forbidden}
▪ 반드시 다룰 핵심 주제 (4가지 중 최소 2가지 이상 포함):
  1. ${angleInfo.focus[0]}
  2. ${angleInfo.focus[1]}
  3. ${angleInfo.focus[2]}
  4. ${angleInfo.focus[3]}

독자가 "이건 정말 몰랐다!", "이걸 왜 지금 알았지?" 라고 반응해야 성공적인 글입니다.
상식·뻔한 조언을 쓰면 즉시 실격입니다. 반드시 놀라운 반전과 새로운 정보 중심으로 쓰세요.
` : '';

  const systemPrompt = `당신은 ${role}
모든 텍스트는 순수 한국어로만 작성합니다. 외국어 문자(중국어·일본어·베트남어·러시아어 등) 사용 금지.
영어는 IT 용어, 브랜드명 등 꼭 필요한 경우에만 사용합니다.
AI가 쓴 티가 나지 않도록 실제 전문가가 직접 쓴 것처럼 자연스럽게 작성합니다.
제목과 본문에 특정 연도(2023년, 2024년 등 과거 연도)를 절대 사용하지 않습니다. 시간이 지나도 유효한 정보(Evergreen Content)로 작성합니다.
${isHealth ? `
[5060 시니어 독자 특화 지침]
- 주요 독자: 50~60대 중장년층 (건강에 관심 높고, 실천 의지 강함)
- 문장은 짧고 명확하게. 한 문장에 한 가지 정보만.
- 어려운 의학 용어는 반드시 괄호로 쉬운 설명 병기 (예: 인슐린 저항성(혈당을 낮추는 기능이 떨어진 상태))
- "당장 오늘부터 할 수 있는 것"을 항상 포함
- 병원 가야 할 위험 신호도 명확히 안내
- 자녀에게 공유하고 싶을 만큼 신뢰감 있는 톤 유지
` : ''}${angleBlock}
[구글 E-E-A-T 품질 기준 준수]
- Experience(경험): 실제 경험에서 나온 구체적 사례와 에피소드 포함
- Expertise(전문성): 전문 용어와 심화 개념을 쉽게 풀어서 설명
- Authoritativeness(권위): 공신력 있는 연구·기관·통계 수치 인용
- Trustworthiness(신뢰): 주의사항·한계·예외 케이스도 솔직하게 언급
- 독자가 이 글을 읽고 나서 다른 곳을 찾아볼 필요가 없을 만큼 완결성 있게 작성`;

  // ── 1단계: 메타데이터 생성 ──────────────────────────────────────────────────
  const metaRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `키워드: "${keyword}"
${angleInfo ? `콘텐츠 각도: ${angleInfo.angle}
제목도 이 각도를 반영해 "반전", "충격", "의외의 사실", "몰랐던", "위험한" 등 호기심·긴장감을 유발하는 표현을 포함하세요.` : ''}

아래 JSON 메타데이터만 생성하세요 (본문 제외).
⚠️ 제목에 특정 연도(2023, 2024 등 과거 연도) 절대 포함 금지. 시간이 지나도 유효한 제목으로 작성.
{
  "titles": ["반전형 제목 (예: '○○이 오히려 혈당 올린다')", "숫자+충격형 제목 (예: '10명 중 7명이 모르는 ○○의 진실')", "경고형 제목 (예: '지금 당장 멈춰야 할 ○○ 습관')"],
  "selectedTitle": "클릭률 높은 제목 1개 (30~45자, 핵심 키워드 포함, 연도 포함 금지, 반전·충격·호기심 유발)",
  "metaTitle": "검색결과 타이틀 (55자 이내, 키워드 포함)",
  "metaDescription": "검색결과 설명 (120~155자, 절대 160자 초과 금지, 키워드 + 50~60대 시니어가 공감할 궁금증 유발 + 클릭 유도)",
  "excerpt": "글 요약 (120~150자, 핵심 가치 전달)",
  "keywords": ["핵심키워드", "관련키워드2", "관련키워드3", "롱테일1", "롱테일2"],
  "sections": ["섹션1 소제목", "섹션2 소제목", "섹션3 소제목", "섹션4 소제목"],
  "unsplashQuery": "2-3 English words for Unsplash thumbnail photo search, specific to topic (e.g. 'healthy blood sugar food', 'youtube creator monetization', 'real estate investment')",
  "unsplashBodyQueries": ["English photo search term 1 related to topic", "English photo search term 2 related to topic"]
}`,
      },
    ],
  });

  const meta = JSON.parse(metaRes.choices[0].message.content);

  // ── 2단계: 본문 HTML 생성 ─────────────────────────────────────────────────
  const contentRes = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 5000,
    messages: [
      { role: 'system', content: `${systemPrompt}\nHTML 형식의 블로그 본문만 작성합니다. JSON 없이 HTML만 출력합니다.` },
      {
        role: 'user',
        content: `키워드: "${keyword}"
제목: "${meta.selectedTitle}"
섹션 구성: ${meta.sections.join(' / ')}
${angleInfo ? `
[이 글의 핵심 방향 — 반드시 지킬 것]
각도: ${angleInfo.angle}
금지 내용: ${angleInfo.forbidden}
반드시 포함할 놀라운 정보 (2가지 이상):
  - ${angleInfo.focus[0]}
  - ${angleInfo.focus[1]}
  - ${angleInfo.focus[2]}
` : ''}
위 구성으로 핵심만 담은 간결하고 완성도 높은 블로그 본문 HTML을 작성하세요.

[필수 조건]
1. 순수 텍스트 기준 1,800~2,500자 (HTML 태그 제외) — 간결하고 핵심만 담아야 합니다
2. 각 섹션 300~400자 내외 — 핵심 정보만 압축
3. 구체적 수치(연구 결과, 통계, %) 1~2개씩 포함
4. 문단은 2~3문장 단위로 짧고 명확하게
5. ⚠️ 뻔한 상식(운동하세요, 균형 잡힌 식단, 금연 등)은 절대 쓰지 말 것
6. 독자가 스크롤 없이 5분 안에 끝까지 읽을 수 있는 분량
7. 각 섹션은 핵심 포인트 1~2개에 집중 — 여러 가지 나열 금지

HTML 구조 (반드시 이 순서로, </article>로 반드시 닫을 것):
<article>

<section class="intro">
  <div class="summary-box">
    <ul>
      <li>핵심 포인트 1 (한 줄)</li>
      <li>핵심 포인트 2 (한 줄)</li>
      <li>핵심 포인트 3 (한 줄)</li>
    </ul>
  </div>
  <p>서론 (독자 공감 + 글 방향, 2~3문장)</p>
</section>

<section>
  <h2>${meta.sections[0] || '핵심 원인'}</h2>
  <p>핵심 내용 (3문장, 수치/근거 포함)</p>
  <div class="info-box"><p>핵심 요약 1줄</p></div>
</section>

<section>
  <h2>${meta.sections[1] || '당장 실천하는 방법'}</h2>
  <p>핵심 방법 설명 (2~3문장)</p>
  <ol>
    <li><strong>방법 1:</strong> 구체적 설명 (1~2문장)</li>
    <li><strong>방법 2:</strong> 구체적 설명 (1~2문장)</li>
    <li><strong>방법 3:</strong> 구체적 설명 (1~2문장)</li>
  </ol>
</section>

<section>
  <h2>${meta.sections[2] || '많이 하는 실수'}</h2>
  <p>흔한 오해 설명 (2~3문장, 반전 정보 포함)</p>
  <div class="warning-box">
    <ul>
      <li>주의사항 1 — 이유 한 줄</li>
      <li>주의사항 2 — 이유 한 줄</li>
    </ul>
  </div>
</section>

<section>
  <h2>${meta.sections[3] || '병원 가야 할 신호'}</h2>
  <p>위험 신호 설명 (2~3문장)</p>
  <div class="tip-box">
    <ul>
      <li>즉시 병원 가야 할 증상 1</li>
      <li>즉시 병원 가야 할 증상 2</li>
      <li>즉시 병원 가야 할 증상 3</li>
    </ul>
  </div>
</section>

<section>
  <h2>자주 묻는 질문</h2>
  <div class="faq-item"><p class="faq-q">Q. 자주 묻는 질문 1?</p><p>A. 간결한 답변 (2문장)</p></div>
  <div class="faq-item"><p class="faq-q">Q. 자주 묻는 질문 2?</p><p>A. 간결한 답변 (2문장)</p></div>
</section>

<section class="conclusion">
  <div class="info-box"><p>핵심 한 줄 요약: <strong>[오늘 당장 실천할 것]</strong></p></div>
  <div class="cta-box">
    <p class="cta-title">📌 이 글이 도움이 되셨나요?</p>
    <div class="cta-buttons">
      <a href="/" class="cta-btn cta-btn-primary">더 많은 건강 정보 보기 →</a>
      <button class="cta-btn cta-btn-share" onclick="navigator.share ? navigator.share({title: document.title, url: location.href}) : window.open('https://story.kakao.com/share?url=' + encodeURIComponent(location.href))">📤 카카오톡 공유</button>
    </div>
    <p class="cta-sub">가족·친구에게 공유하면 더 큰 도움이 됩니다 💚</p>
  </div>
</section>

</article>`,
      },
    ],
  });

  // GPT가 ```html ... ``` 마크다운 코드블록으로 감싸서 반환하는 경우 제거
  let content = contentRes.choices[0].message.content.trim();
  content = content.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  const textLen = content.replace(/<[^>]*>/g, '').length;
  console.log(`    본문 길이: ${textLen.toLocaleString()}자`);

  return {
    ...meta,
    content,
    readTime: Math.max(1, Math.ceil(textLen / 500)),
  };
}

// ─── 관련 글 연결 ─────────────────────────────────────────────────────────────
async function linkRelated(postId, categoryId, keywords) {
  const kwArr = Array.isArray(keywords) ? keywords : JSON.parse(keywords || '[]');
  const candidates = await prisma.post.findMany({
    where: { id: { not: postId }, categoryId },
    select: { id: true, keywords: true },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  const relatedIds = [];
  for (const c of candidates) {
    const cKws = JSON.parse(c.keywords || '[]');
    if (kwArr.some((k) => cKws.includes(k))) relatedIds.push(c.id);
    if (relatedIds.length >= 4) break;
  }

  for (const rid of relatedIds) {
    await prisma.postRelation.upsert({
      where: { postId_relatedId: { postId, relatedId: rid } },
      update: {},
      create: { postId, relatedId: rid },
    }).catch(() => {});
  }
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  const hasPexels = !!process.env.PEXELS_API_KEY;
  console.log(`=== 콘텐츠 생성 시작 (GPT-4o-mini${hasPexels ? ' + Pexels' : ''}) ===`);
  console.log(`생성 목표: ${generateCount}개\n`);

  let success = 0, fail = 0;

  try {
    const keywords = await prisma.keyword.findMany({
      where: {
        used: false,
        ...(targetCategory && { category: { slug: targetCategory } }),
      },
      include: { category: true },
      orderBy: [{ priority: 'asc' }, { searchVolume: 'desc' }],
      take: Math.max(generateCount * 15, 50), // 주제별 풀 확보를 위해 충분히 로드
    });

    if (!keywords.length) {
      console.log('사용 가능한 키워드 없음. npm run collect:keywords 먼저 실행하세요.');
      return;
    }

    // 카테고리 ID 캐싱
    const travelCat = await prisma.category.findUnique({ where: { slug: 'travel' } });
    // "건강지식" 카테고리 없으면 자동 생성
    const knowledgeCat = await prisma.category.upsert({
      where: { slug: 'knowledge' },
      update: {},
      create: { name: '건강지식', slug: 'knowledge', description: '면역력·소화·눈건강·피부 등 다양한 건강 정보' },
    });
    const knownSlugs = ['health', 'tech', 'economy', 'lifestyle', 'travel', 'knowledge'];

    // 알 수 없는 카테고리 키워드 → travel로 재배정
    for (const kw of keywords) {
      if (!knownSlugs.includes(kw.category?.slug) && travelCat) {
        kw.categoryId = travelCat.id;
        kw.category = travelCat;
      }
    }

    // 최근 발행 글로 중복 방지 + 마지막 주제 파악
    const recentPublished = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { title: true, keywords: true },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    const usedKeywordSet = new Set(
      recentPublished.flatMap((p) => JSON.parse(p.keywords || '[]'))
    );

    // 마지막 발행 글의 주제 파악 → 다음 주제 결정
    let lastTopicId = null;
    for (const p of recentPublished) {
      const kws = JSON.parse(p.keywords || '[]');
      const found = kws.map(getSubTopic).find((t) => t !== null);
      if (found) { lastTopicId = found; break; }
    }

    // 이번 실행에서 순서대로 발행할 주제 목록 결정
    const targetTopics = [];
    let nextTopic = getNextTopic(lastTopicId);
    for (let i = 0; i < generateCount; i++) {
      targetTopics.push(nextTopic);
      nextTopic = getNextTopic(nextTopic);
    }
    console.log(`\n마지막 발행 주제: ${lastTopicId || '없음'}`);
    console.log(`이번 발행 순서: ${targetTopics.map((t) => HEALTH_TOPICS.find((h) => h.id === t)?.label).join(' → ')}\n`);

    // 주제별로 키워드 미리 분류
    const keywordsByTopic = {};
    for (const kw of keywords) {
      const topic = getSubTopic(kw.keyword);
      if (!topic) continue;
      if (!keywordsByTopic[topic]) keywordsByTopic[topic] = [];
      keywordsByTopic[topic].push(kw);
    }

    for (const targetTopic of targetTopics) {
      if (success >= generateCount) break;

      // 해당 주제 키워드 풀에서 미사용·중복 없는 것 선택
      const pool = (keywordsByTopic[targetTopic] || [])
        .filter((kw) => !usedKeywordSet.has(kw.keyword));

      let kw;
      if (pool.length > 0) {
        kw = pool[0];
      } else {
        // 해당 주제 키워드가 없으면 미분류 키워드 중 아무거나
        const fallback = keywords.find(
          (k) => !usedKeywordSet.has(k.keyword) && !targetTopics.slice(0, success).includes(getSubTopic(k.keyword))
        );
        if (!fallback) {
          console.log(`  ⚠️  [${HEALTH_TOPICS.find((h) => h.id === targetTopic)?.label}] 사용 가능한 키워드 없음. 건너뜀.`);
          continue;
        }
        kw = fallback;
      }

      const topic = getSubTopic(kw.keyword) || targetTopic;
      const topicLabel = HEALTH_TOPICS.find((h) => h.id === topic)?.label || topic;
      console.log(`[${success + 1}/${generateCount}] [${topicLabel}] "${kw.keyword}" 생성 중...`);

      try {
        const gen = await generatePost(kw.keyword, kw.category.slug, topic);

        // Pexels 썸네일 + 본문 이미지
        let thumbnail = null;
        let content = gen.content;

        if (hasPexels) {
          // GPT가 생성한 영어 검색어 사용 (한국어 키워드는 Pexels에서 엉뚱한 결과 반환)
          const thumbQuery = gen.unsplashQuery || kw.keyword;
          const thumbImg = await fetchPexelsImage(thumbQuery);
          if (thumbImg) thumbnail = thumbImg.url;

          const bodyQueries = gen.unsplashBodyQueries && gen.unsplashBodyQueries.length
            ? gen.unsplashBodyQueries
            : gen.keywords.slice(0, 2);
          const bodyImgs = await fetchBodyImages(bodyQueries, 2);
          if (bodyImgs.length) content = injectBodyImages(content, bodyImgs);
        }

        // 쿠팡파트너스 상품 — DB 필드로 분리 저장 (사이드바 카드 렌더링용)
        let coupangProductJson = null;
        if (kw.category.slug === 'health' && TOPIC_TO_SHEET[topic]) {
          try {
            const coupangProducts = await fetchCoupangProducts(topic);
            if (coupangProducts.length) {
              const product = coupangProducts[Math.floor(Math.random() * coupangProducts.length)];
              coupangProductJson = JSON.stringify({
                name: product.name,
                url: product.url,
                image: product.image || null,
                price: product.price || null,
                ctaText: TOPIC_CTA_TEXT[topic] || '건강 추천 제품',
              });
              console.log(`    쿠팡 상품 [${topicLabel}]: "${product.name}"`);
            }
          } catch (e) {
            console.log(`    쿠팡 상품 로딩 실패 (건너뜀): ${e.message}`);
          }
        }

        // knowledge 토픽이면 knowledge 카테고리로 저장
        const knowledgeTopicIds = ['immunity', 'digestion', 'eye', 'skin', 'oral', 'liver', 'lung', 'mental'];
        const postCategoryId = knowledgeTopicIds.includes(topic)
          ? knowledgeCat.id
          : kw.categoryId;

        const slug = generateSlug(gen.selectedTitle);
        const post = await prisma.post.create({
          data: {
            title: gen.selectedTitle,
            slug,
            excerpt: gen.excerpt,
            content,
            keywords: JSON.stringify(gen.keywords),
            metaTitle: gen.metaTitle,
            metaDescription: gen.metaDescription,
            readTime: gen.readTime,
            thumbnail,
            coupangProduct: coupangProductJson,
            status: 'DRAFT',
            categoryId: postCategoryId,
            keywordId: kw.id,
          },
        });

        await prisma.keyword.update({ where: { id: kw.id }, data: { used: true } });
        await linkRelated(post.id, kw.categoryId, gen.keywords);

        success++;
        console.log(`  ✓ "${gen.selectedTitle}"`);
        console.log(`    읽기 ${gen.readTime}분 | 이미지: ${thumbnail ? '✅ Pexels' : '없음'}\n`);

        if (success < generateCount) await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        fail++;
        console.error(`  ✗ 실패: ${e.message}\n`);
      }
    }

    await prisma.automationLog.create({
      data: {
        type: 'CONTENT_GENERATE',
        status: success > 0 ? 'SUCCESS' : 'FAILED',
        message: `${success}개 생성, ${fail}개 실패`,
      },
    });

    console.log(`✅ 완료: ${success}개 생성`);
  } catch (e) {
    console.error('치명적 오류:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
