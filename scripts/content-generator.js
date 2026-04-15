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
  { id: 'blood_sugar',    label: '혈당·당뇨',         category: 'blood_sugar',    words: ['혈당', '당뇨', '인슐린', '혈액당', '공복혈당', '혈당관리', '혈당수치', '당뇨병', '당화혈색소', '저혈당', '고혈당', '혈당스파이크', '당뇨전단계', '내당능', '혈당조절'] },
  { id: 'blood_pressure', label: '혈압·심장',         category: 'blood_pressure', words: ['혈압', '심장', '심혈관', '고혈압', '심근', '부정맥', '콜레스테롤', '동맥경화', '심부전', '혈압관리', '혈압수치', '심근경색', '협심증', '심방세동', '뇌졸중', '중성지방', '이완기', '수축기'] },
  { id: 'joint',          label: '관절·근육',         category: 'joint',          words: ['관절', '무릎', '연골', '허리', '척추', '근육', '근감소', '골다공증', '어깨', '힘줄', '류마티스', '관절염', '퇴행성', '디스크', '오십견', '근력', '고관절', '관절통', '관절염증', '근육통'] },
  { id: 'sleep',          label: '수면·피로',         category: 'sleep',          words: ['수면', '불면', '피로', '수면장애', '잠', '멜라토닌', '불면증', '만성피로', '졸음', '수면질', '수면시간', '수면부족', '야간뇨', '코골이', '수면무호흡', '낮잠', '피로감', '만성피로증후군'] },
  { id: 'brain',          label: '뇌건강·치매',       category: 'brain',          words: ['치매', '뇌', '기억력', '인지', '파킨슨', '뇌졸중', '알츠하이머', '뇌건강', '인지저하', '건망증', '인지기능', '치매예방', '뇌혈관', '기억력저하', '경도인지장애', '뇌경색', '뇌출혈'] },
  { id: 'menopause',      label: '갱년기',            category: 'menopause',      words: ['갱년기', '폐경', '호르몬', '안면홍조', '골밀도', '에스트로겐', '남성갱년기', '갱년기증상', '폐경기', '갱년기장애', '갱년기우울', '갱년기불면', '갱년기비만', '갱년기체중', '테스토스테론', '여성호르몬', '호르몬치료', '갱년기관리'] },
  { id: 'nutrition',      label: '영양·식이',         category: 'nutrition',      words: ['영양', '영양제', '비타민', '식이', '음식', '식단', '건강식', '단백질', '오메가', '식품', '보충제', '영양소', '무기질', '칼슘', '마그네슘', '아연', '철분', '엽산', '항산화', '건강기능식품'] },
  // ── knowledge 카테고리 (다이나믹 배너) ────────────────────────────────────
  { id: 'immunity',       label: '면역력·감염',       category: 'knowledge', words: ['면역', '면역력', '감기', '독감', '폐렴', '바이러스', '항체', '항바이러스', '감염', '면역계', '면역세포', '면역저하', '백신', '자연살해세포', '림프구', '면역강화'] },
  { id: 'digestion',      label: '소화·장건강',       category: 'knowledge', words: ['소화', '위염', '역류성', '장건강', '변비', '대장', '위장', '장내세균', '과민성', '위산', '헬리코박터', '소화불량', '위궤양', '장염', '복통', '설사', '장내미생물', '프로바이오틱스', '위식도역류'] },
  { id: 'eye',            label: '눈건강·시력',       category: 'knowledge', words: ['눈', '시력', '노안', '황반', '백내장', '안구건조', '녹내장', '망막', '눈건강', '눈피로', '비문증', '눈충혈', '안압', '황반변성', '당뇨망막병증', '눈영양제'] },
  { id: 'skin',           label: '피부·노화',         category: 'knowledge', words: ['피부', '주름', '노화', '검버섯', '피부탄력', '콜라겐', '자외선', '피부노화', '건조피부', '피부관리', '색소침착', '기미', '잡티', '피부재생', '히알루론산', '레티놀'] },
  { id: 'oral',           label: '구강·치아',         category: 'knowledge', words: ['치아', '잇몸', '구강', '치주염', '임플란트', '구취', '치석', '구강건강', '틀니', '충치', '잇몸병', '치은염', '치료', '스케일링', '구강위생', '치아미백'] },
  { id: 'liver',          label: '간·해독',           category: 'knowledge', words: ['간', '지방간', '간수치', '간건강', '해독', '간염', '간경화', 'ALT', 'AST', '간기능', 'GOT', 'GPT', '간질환', '알코올성지방간', '비알코올성지방간', '간섬유화'] },
  { id: 'lung',           label: '폐·호흡기',         category: 'knowledge', words: ['폐', '호흡기', '기관지', '폐기능', '폐건강', '천식', '만성기침', 'COPD', '폐렴', '기관지염', '폐기종', '폐섬유증', '폐활량', '호흡곤란', '기침'] },
  { id: 'mental',         label: '정신건강·스트레스', category: 'knowledge', words: ['우울', '불안', '스트레스', '정신건강', '노년우울', '무기력', '공황', '불안장애', '우울증', '정서', '심리', '외로움', '고립감', '번아웃', '수면우울', '노인우울'] },
];

// ─── 로테이션 순서: health/knowledge 교차 배치 ───────────────────────────────
// 기존: health 7개 → knowledge 8개 (같은 카테고리 연속 발행 문제)
// 변경: health-knowledge 교대로 골고루 분배
const TOPIC_ROTATION = [
  'blood_sugar',    // health
  'immunity',       // knowledge
  'blood_pressure', // health
  'digestion',      // knowledge
  'joint',          // health
  'eye',            // knowledge
  'sleep',          // health
  'skin',           // knowledge
  'brain',          // health
  'oral',           // knowledge
  'menopause',      // health
  'liver',          // knowledge
  'nutrition',      // health
  'lung',           // knowledge
  'mental',         // knowledge (15번째)
];

function getSubTopic(keyword) {
  for (const topic of HEALTH_TOPICS) {
    if (topic.words.some((w) => keyword.includes(w))) return topic.id;
  }
  return null;
}

// (구버전 lastTopicId 추론 방식 제거 — publishedCount 기반으로 대체)

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

// ─── 주제별 콘텐츠 각도 (긍정·실용·과학 정보 중심) ────────────────────────────
const TOPIC_CONTENT_ANGLES = {
  blood_sugar: {
    angle: '관리형 — 혈당을 안정적으로 유지하는 과학적 방법과 생활 습관 가이드',
    forbidden: '운동 열심히 하세요, 균형 잡힌 식단, 설탕 줄이세요 같은 뻔한 조언',
    focus: [
      '혈당 급등을 막아주는 식품 조합과 식사 순서 — 최신 임상 연구 결과',
      '식후 10분 걷기만으로도 혈당이 안정되는 구체적 메커니즘과 실천법',
      '혈당 관리에 효과적인 수면·스트레스 조절법 — 생활 습관과 혈당의 연관성',
      '당뇨 전단계에서 정상으로 되돌린 사람들의 공통 생활 패턴',
    ],
  },
  blood_pressure: {
    angle: '관리형 — 혈압을 자연스럽게 낮추는 생활 속 실천법과 올바른 약 복용 가이드',
    forbidden: '규칙적인 운동, 저염식 식단, 금연·금주 같은 뻔한 조언',
    focus: [
      '혈압약 복용 효과를 높이는 올바른 복용 시간과 생활 습관 조합',
      '집에서 혈압을 정확하게 측정하는 방법과 기록 관리 가이드',
      '칼륨·마그네슘이 풍부한 식품으로 혈압을 낮추는 식단 구성법',
      '스트레스·수면이 혈압에 미치는 영향과 효과적인 이완법',
    ],
  },
  joint: {
    angle: '회복형 — 관절 통증을 줄이고 유연성을 높이는 단계별 운동·생활 가이드',
    forbidden: '운동 꾸준히 하세요, 체중 관리, 연골에 좋은 콜라겐 같은 뻔한 조언',
    focus: [
      '무릎·고관절 통증을 줄이는 올바른 스트레칭과 근력 강화 운동',
      '관절 건강에 실제로 도움이 되는 영양소와 식품 — 최신 연구 기반',
      '일상에서 관절 부담을 줄이는 올바른 자세와 동작 가이드',
      '관절염 초기에 빠르게 회복한 사람들의 공통 관리 방법',
    ],
  },
  sleep: {
    angle: '개선형 — 숙면의 질을 높이는 과학적 방법과 수면 환경 최적화 가이드',
    forbidden: '일찍 자고 일찍 일어나세요, 7-8시간 주무세요 같은 뻔한 조언',
    focus: [
      '수면의 질을 높이는 취침 전 1시간 루틴 — 연구로 검증된 방법',
      '깊은 수면(렘·비렘)을 늘리는 침실 환경 최적화 방법',
      '낮잠의 올바른 활용법 — 피로 회복과 야간 수면을 동시에 지키는 법',
      '수면 장애 개선에 효과적인 비약물 요법과 생활 습관 교정',
    ],
  },
  brain: {
    angle: '예방형 — 뇌 건강을 유지하고 치매를 예방하는 과학적 생활 습관 가이드',
    forbidden: '두뇌 게임, 독서, 사회활동 같은 뻔한 조언',
    focus: [
      '뇌 혈류를 개선하고 인지 기능을 높이는 일상 속 실천 방법',
      '치매 예방에 효과적인 식품과 생활 습관 — 최신 뇌과학 연구 결과',
      '50대부터 시작하는 뇌 건강 관리 — 기억력 유지와 집중력 향상법',
      '사회적 연결·새로운 배움이 뇌 노화를 늦추는 구체적 메커니즘',
    ],
  },
  menopause: {
    angle: '적응형 — 갱년기 증상을 완화하고 건강하게 극복하는 실용 가이드',
    forbidden: '콩 많이 드세요, 긍정적으로 생각하세요, 운동하세요 같은 뻔한 조언',
    focus: [
      '안면홍조·불면·감정 기복을 줄이는 단계별 생활 습관 관리법',
      '갱년기 체중 관리에 효과적인 식단 조절과 운동 조합',
      '호르몬 요법의 최신 지견 — 개인 상황에 맞는 선택 기준',
      '갱년기 이후 뼈·심장·뇌 건강을 지키는 장기 관리 전략',
    ],
  },
  nutrition: {
    angle: '영양형 — 50~60대에게 최적화된 영양 섭취 방법과 건강한 식습관 가이드',
    forbidden: '비타민C, 오메가3 좋아요, 채소 과일 많이 드세요 같은 뻔한 조언',
    focus: [
      '나이 들수록 꼭 챙겨야 할 영양소와 효과적인 섭취 방법',
      '영양제를 올바르게 선택하고 복용하는 실용적인 기준',
      '식욕 저하·소화 기능 저하를 보완하는 시니어 맞춤 식단 구성법',
      '약과 영양제를 함께 복용할 때 알아야 할 올바른 복용 가이드',
    ],
  },
  // ── knowledge 카테고리 신규 8개 ────────────────────────────────────────────
  immunity: {
    angle: '강화형 — 면역력을 과학적으로 높이는 생활 습관과 영양 전략',
    forbidden: '비타민C 많이 드세요, 운동하세요, 충분히 주무세요 같은 뻔한 조언',
    focus: [
      '면역 세포 활성화에 실제로 효과적인 생활 습관과 식품 조합',
      '50대 이후 면역력 유지를 위한 맞춤 영양 전략과 실천법',
      '독감·폐렴 예방에 효과적인 백신과 생활 면역 관리법',
      '만성 피로를 개선하고 면역력을 회복하는 단계별 방법',
    ],
  },
  digestion: {
    angle: '회복형 — 장 건강을 개선하고 소화를 도와주는 과학적 생활 가이드',
    forbidden: '천천히 꼭꼭 씹으세요, 규칙적인 식사, 자극적 음식 피하세요 같은 뻔한 조언',
    focus: [
      '장내 유익균을 늘리는 식품과 식습관 — 최신 마이크로바이옴 연구',
      '소화 기능을 활성화하는 식사 방법과 생활 루틴',
      '변비·과민성 장증후군을 개선하는 비약물 접근법과 식단 조절',
      '장 건강과 면역·정신 건강의 연관성 — 장을 건강하게 유지하는 핵심 습관',
    ],
  },
  eye: {
    angle: '보호형 — 눈 건강을 지키고 시력 저하를 늦추는 과학적 관리 가이드',
    forbidden: '당근 드세요, 스마트폰 줄이세요, 눈 운동하세요 같은 뻔한 조언',
    focus: [
      '황반변성·녹내장 예방에 효과적인 영양소와 생활 습관',
      '디지털 기기 사용 시 눈 피로를 줄이는 올바른 환경 설정과 습관',
      '루테인·오메가3 등 눈 건강 영양제를 올바르게 선택하는 기준',
      '당뇨·고혈압이 있을 때 눈 건강을 지키는 맞춤 관리 방법',
    ],
  },
  skin: {
    angle: '관리형 — 50~60대 피부를 건강하게 유지하는 과학적 스킨케어 가이드',
    forbidden: '자외선차단제 바르세요, 수분 충분히 드세요 같은 뻔한 조언',
    focus: [
      '나이 든 피부에 효과적인 성분과 올바른 스킨케어 루틴',
      '콜라겐 생성을 촉진하는 식품과 생활 습관 — 최신 피부과학 연구',
      '자외선 차단과 보습을 동시에 해결하는 실용적인 관리 방법',
      '피부과 시술 전 알아야 할 50~60대 맞춤 시술 선택 기준',
    ],
  },
  oral: {
    angle: '관리형 — 구강 건강을 유지하고 잇몸 질환을 예방하는 실용 가이드',
    forbidden: '양치질 잘 하세요, 치실 사용하세요 같은 뻔한 조언',
    focus: [
      '잇몸 질환을 예방하는 올바른 양치·치실 사용법과 구강 관리 루틴',
      '임플란트·틀니 수명을 늘리는 올바른 관리 방법과 생활 습관',
      '구강 건강이 전신 건강에 미치는 영향과 예방 관리의 중요성',
      '구강건조증을 개선하는 실용적인 방법과 적합한 구강 케어 제품',
    ],
  },
  liver: {
    angle: '회복형 — 지방간을 개선하고 간 건강을 되찾는 단계별 생활 가이드',
    forbidden: '술 줄이세요, 기름진 음식 피하세요 같은 뻔한 조언',
    focus: [
      '비알코올성 지방간을 개선한 사람들의 공통 식단 변화와 운동 습관',
      '간 수치(ALT·AST·GGT)를 정상으로 되돌리는 생활 습관 교정 방법',
      '간 건강에 실제로 도움이 되는 식품과 영양소 — 임상 근거 기반',
      '지방간 단계별 회복 기간과 효과적인 체중 감량 속도 가이드',
    ],
  },
  lung: {
    angle: '보호형 — 폐 기능을 유지하고 호흡기 건강을 지키는 실용 가이드',
    forbidden: '금연하세요, 환기하세요 같은 뻔한 조언',
    focus: [
      '폐 기능을 강화하는 호흡 훈련과 유산소 운동 방법',
      '실내 공기질을 개선해 호흡기를 보호하는 환경 관리 가이드',
      '폐 건강에 좋은 식품과 영양소 — 항산화·항염증 효과 중심',
      'COPD·천식 환자도 실천 가능한 폐 기능 유지 생활 습관',
    ],
  },
  mental: {
    angle: '회복형 — 마음 건강을 지키고 노년 우울감을 극복하는 실용적 방법',
    forbidden: '긍정적으로 생각하세요, 사람들과 어울리세요 같은 뻔한 조언',
    focus: [
      '노년 우울감을 자연스럽게 개선하는 생활 습관과 인지행동 전략',
      '운동·수면·식단이 정신 건강에 미치는 긍정적 효과 — 최신 연구',
      '사회적 연결과 취미 활동이 뇌 건강과 감정에 미치는 과학적 영향',
      '전문 상담을 활용해 마음 건강을 체계적으로 관리하는 방법',
    ],
  },
};

// ─── 카테고리별 전문가 역할 ───────────────────────────────────────────────────
const SYSTEM_ROLES = {
  health:    '서울대 의대·서울아산병원 20년 경력 내과·가정의학과 전문의이자 5060 시니어 건강 전문 칼럼니스트. 고혈압·당뇨·관절·수면·갱년기·치매 예방 등 중장년 건강 문제를 최신 임상 근거 기반으로 설명. 독자는 주로 50~60대이므로 어려운 의학 용어는 반드시 쉽게 풀어쓰고, 당장 집에서 실천할 수 있는 구체적 방법 위주로 작성. 과잉 진단·과잉 치료 없이 신뢰할 수 있는 정보만 전달. ⚠️ 절대 금지: "운동 꾸준히 하세요", "균형 잡힌 식단", "금연·금주" 같이 누구나 아는 뻔한 조언은 절대 쓰지 않습니다. 독자가 이미 알고 있는 상식을 반복하는 것은 글의 가치를 0으로 만듭니다. 반드시 독자가 "나한테 딱 필요한 정보다!", "오늘 바로 실천해봐야겠다!" 라고 반응할 만큼 구체적이고 실천 가능한 정보, 최신 연구 기반의 새로운 사실, 단계별 실천 가이드를 중심으로 긍정적이고 신뢰감 있게 작성하세요.',
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

  // 글 구조 타입을 매번 다르게 (구글 스팸 탐지 회피)
  const STRUCTURE_TYPES = ['story', 'checklist', 'compare', 'guide', 'qna'];
  const structureType = STRUCTURE_TYPES[Math.floor(Math.random() * STRUCTURE_TYPES.length)];
  const structureGuide = {
    story:     '스토리형: 실제 50대 독자의 경험담으로 시작 → 문제 → 해결 과정 → 결론',
    checklist: '체크리스트형: 자가진단 항목 → 각 항목별 해설 → 개선 방법 → 종합 조언',
    compare:   '비교분석형: 일반적 통념 vs 실제 사실 대조표 → 올바른 방법 → 주의사항',
    guide:     '단계별 가이드형: 왜 중요한가 → 준비단계 → 실행단계 → 유지관리 → 주의사항',
    qna:       'Q&A형: 독자가 가장 많이 묻는 질문 5개 → 각각 심층 답변 → 종합 가이드',
  }[structureType];

  const systemPrompt = `당신은 ${role}
모든 텍스트는 순수 한국어로만 작성합니다. 외국어 문자 사용 금지.
영어는 의학 용어, 브랜드명 등 꼭 필요한 경우에만 사용합니다.
제목과 본문에 특정 연도(2023년, 2024년 등)를 절대 사용하지 않습니다. 시간이 지나도 유효한 Evergreen Content로 작성합니다.

[가장 중요한 원칙 — 구글 애드센스 승인 기준]
① AI가 쓴 티가 절대 나면 안 됩니다. 실제 건강 전문 에디터가 직접 조사하고 쓴 글처럼 작성하세요.
② 동일한 HTML 구조 패턴 반복 금지. 이번 글의 구조 유형: ${structureGuide}
③ 한국 공식 기관 데이터를 반드시 인용하세요:
   - 건강보험심사평가원, 질병관리청, 국민건강영양조사, 통계청, 대한의학회 자료
   - 인용 방식: "질병관리청 국민건강영양조사에 따르면 50대의 약 38%가..." 형식
④ 독자 공감형 도입: 첫 문단은 "50대 주부 김모씨는..." 같은 실생활 사례로 시작
⑤ 개인차 명시: "개인 건강 상태에 따라 다를 수 있으며, 증상이 지속되면 전문의와 상담하세요"

[5060 시니어 독자 특화]
- 문장은 짧고 명확하게. 한 문장에 한 가지 정보만.
- 어려운 의학 용어는 반드시 괄호로 쉬운 설명 병기 (예: 인슐린 저항성(혈당을 낮추는 기능이 떨어진 상태))
- "당장 오늘부터 할 수 있는 것" 포함
- 병원 가야 할 위험 신호 명확히 안내
- 자녀에게 공유하고 싶을 만큼 신뢰감 있는 톤

[E-E-A-T 충족 필수 요소]
- 경험(Experience): 실제 환자/독자 사례 에피소드
- 전문성(Expertise): 의학적 메커니즘과 원리 설명
- 권위(Authoritativeness): 한국 공식 기관 통계·연구 인용
- 신뢰(Trustworthiness): 주의사항·한계·예외 케이스 솔직 언급

[인간 필자처럼 쓰는 문체 원칙 — 절대 준수]
① "경험처럼 써라": 단순 정보 나열·검색 결과 재정리 금지. 실제로 겪은 것처럼 서술.
② "문제 해결 중심으로 써라": 독자가 이 글을 읽고 나서 무엇을 해결했는지, 무엇을 바로 실행할 수 있는지 명확히.
③ "다른 블로그 10개보다 깊게 써라": 다른 글과 겹치는 내용 50% 이하. 반드시 포함:
   - 다른 글에 없는 차별화 정보 3가지
   - 바로 적용 가능한 실전 팁 3가지
   - 흔히 틀리는 부분 3가지

④ 글을 쓰기 전 이 키워드를 검색하는 사람의 진짜 목적을 먼저 파악하고 그 의도에 맞게 작성.
⑤ 문장 스타일 규칙:
   - "~입니다", "~합니다" 반복 금지 — 어미를 다양하게
   - 짧은 문장과 긴 문장을 자연스럽게 혼합
   - 글 중간에 필자의 감정·판단을 자연스럽게 삽입 ("솔직히 이 방법이 제일 효과가 빨랐다")
   - 같은 표현 2번 이상 반복 금지
   - "또한", "따라서", "즉" 같은 기계적 연결어 최소화
   - 대량 생성된 글처럼 보이지 않도록 매 섹션 문장 구조를 다르게
${angleBlock}`;

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
제목도 이 각도를 반영해 "방법", "가이드", "효과", "습관", "비결", "전략" 등 긍정적이고 실용적인 표현을 포함하세요.` : ''}

아래 JSON 메타데이터만 생성하세요 (본문 제외).
⚠️ 제목에 특정 연도(2023, 2024 등 과거 연도) 절대 포함 금지. 시간이 지나도 유효한 제목으로 작성.
⚠️ 제목에 "충격", "반전", "위험", "망가", "금지", "절대" 같은 부정·공포 표현 사용 금지.
{
  "titles": ["방법형 제목 (예: '혈당 낮추는 식사 습관 5가지')", "결과형 제목 (예: '하루 10분으로 무릎 통증 줄이는 운동법')", "가이드형 제목 (예: '50대부터 시작하는 뇌 건강 완벽 가이드')"],
  "selectedTitle": "클릭률 높은 제목 1개 (30~45자, 핵심 키워드 포함, 연도 포함 금지, 긍정적·실용적·구체적)",
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
    max_tokens: 9000,
    messages: [
      { role: 'system', content: `${systemPrompt}\nHTML 형식의 블로그 본문만 작성합니다. JSON 없이 순수 HTML만 출력합니다.` },
      {
        role: 'user',
        content: `키워드: "${keyword}"
제목: "${meta.selectedTitle}"
섹션 구성: ${meta.sections.join(' / ')}
글 구조 유형: ${structureGuide}
${angleInfo ? `핵심 방향: ${angleInfo.angle} / 금지: ${angleInfo.forbidden}` : ''}

━━━ 이 글의 핵심 미션 ━━━
키워드 = 이 글의 핵심 주장/발견입니다.
이 주장이 왜 사실인지, 어떤 메커니즘으로 작동하는지를 증명하는 글을 쓰세요.
독자는 "어, 이건 진짜 몰랐다" 또는 "내가 알던 게 틀렸네"를 느껴야 합니다.

[필수 조건 — 독자를 붙잡는 글]
1. 도입부 (반드시): 58~62세 실제 독자의 구체적 사례로 시작
   - "직장 은퇴 후 혈압을 관리 중이던 60세 박모씨는 매일 약을 먹고 있었는데..."
   - 이 사례가 글의 핵심 발견과 직접 연결되어야 함

2. 핵심 발견 설명 (반드시): 키워드가 담고 있는 반전/발견을 구체적으로 증명
   - 몸에서 일어나는 생물학적 메커니즘 설명
   - 사람들이 왜 반대로 알고 있었는지 설명
   - 한국 공식 기관 데이터 최소 2회 인용 (질병관리청, 건강보험심사평가원 등)

3. 오해 바로잡기 섹션 (반드시): "많은 분들이 이렇게 알고 있지만 사실은..."
   - 흔한 오해 3가지 + 각각의 진실

4. 오늘 당장 실천 (반드시): 글 읽고 나서 바로 할 수 있는 것
   - 뻔한 "운동하세요" 금지
   - 구체적 방법: "내일 아침 밥 먹기 전에 OO을 OO개 드세요" 수준

5. 분량: 순수 텍스트 2,500자 이상
6. 결론부: "이 정보는 일반적인 건강 정보 목적이며, 증상이 지속되거나 심각한 경우 반드시 전문의와 상담하시기 바랍니다." 포함
7. 글 전체에서 반드시 달성:
   ① 다른 블로그에 없는 차별화 정보 3가지
   ② 오늘 바로 실행 가능한 실전 팁 3가지
   ③ 독자가 흔히 잘못 알고 있는 부분 3가지

[HTML 작성 지침]
- <article>로 시작해 </article>로 닫기
- 섹션 제목은 <h2> 사용
- 중요 수치나 핵심어는 <strong> 강조
- 목록은 주제에 맞게 <ul> 또는 <ol> 선택 (매번 같은 형식 금지)
- 표(비교형일 경우): <table> 활용
- 글 하단에 반드시 아래 저자 정보 블록 포함:
<div class="author-note" style="margin-top:2rem;padding:1rem 1.25rem;background:#f0f9f5;border-left:4px solid #1E9E7A;border-radius:8px;font-size:0.875rem;color:#4B7A6A;">
  <strong>시니어 건강백과 에디터팀</strong>이 작성했습니다. 건강보험심사평가원·질병관리청·대한의학회 공개 자료를 바탕으로 검토된 정보입니다. 개인 건강 상태에 따라 다를 수 있으므로 전문의와 상담을 권장합니다.
</div>
- 글 맨 마지막에 공유 유도 블록:
<div class="cta-box">
  <p class="cta-title">이 글이 도움이 되셨나요?</p>
  <div class="cta-buttons">
    <a href="/" class="cta-btn cta-btn-primary">더 많은 건강 정보 보기 →</a>
    <button class="cta-btn cta-btn-share" onclick="navigator.share ? navigator.share({title: document.title, url: location.href}) : window.open('https://story.kakao.com/share?url=' + encodeURIComponent(location.href))">카카오톡 공유</button>
  </div>
</div>`,
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
    const HEALTH_SLUGS = ['blood_sugar', 'blood_pressure', 'joint', 'sleep', 'brain', 'menopause', 'nutrition', 'knowledge'];
    const keywords = await prisma.keyword.findMany({
      where: {
        used: false,
        ...(targetCategory
          ? { category: { slug: targetCategory } }
          : { category: { slug: { in: HEALTH_SLUGS } } }
        ),
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
    // 7개 health 서브 카테고리 자동 생성
    const HEALTH_CATEGORY_DEFS = [
      { slug: 'blood_sugar',    name: '혈당·당뇨',   description: '혈당 관리, 당뇨병 예방·관리 정보' },
      { slug: 'blood_pressure', name: '혈압·심장',   description: '고혈압·심혈관 건강 관리 정보' },
      { slug: 'joint',          name: '관절·근육',   description: '관절·척추·근육 건강 관리 정보' },
      { slug: 'sleep',          name: '수면·피로',   description: '수면의 질 개선·피로 해소 정보' },
      { slug: 'brain',          name: '뇌건강·치매', description: '치매 예방·뇌 건강 관리 정보' },
      { slug: 'menopause',      name: '갱년기',      description: '갱년기 증상 관리·호르몬 건강 정보' },
      { slug: 'nutrition',      name: '영양·식이',   description: '영양제·식이요법·건강식품 정보' },
    ];
    for (const def of HEALTH_CATEGORY_DEFS) {
      await prisma.category.upsert({ where: { slug: def.slug }, update: {}, create: def });
    }
    const knownSlugs = ['health', 'blood_sugar', 'blood_pressure', 'joint', 'sleep', 'brain', 'menopause', 'nutrition', 'knowledge', 'tech', 'economy', 'lifestyle', 'travel'];

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

    // ── 로테이션 위치 결정: 발행 글 총 수 기준 (키워드 텍스트 추론 제거) ──────
    // 키워드 매칭 실패로 lastTopicId=null → 항상 같은 주제 발행되던 버그 해결
    const publishedCount = await prisma.post.count({ where: { status: 'PUBLISHED' } });
    const startIdx  = publishedCount % TOPIC_ROTATION.length;

    // 이번 실행에서 순서대로 발행할 주제 목록 결정
    const targetTopics = [];
    for (let i = 0; i < generateCount; i++) {
      targetTopics.push(TOPIC_ROTATION[(startIdx + i) % TOPIC_ROTATION.length]);
    }
    console.log(`\n총 발행 글 수: ${publishedCount}개 → 로테이션 시작 인덱스: ${startIdx}`);
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
        // 해당 주제 키워드가 없으면 — 이미 이번 실행에서 쓴 주제 제외하고 미사용 키워드 아무거나
        // ⚠️ 단, topic은 targetTopic으로 강제해서 로테이션 순서 유지
        const fallback = keywords.find((k) => !usedKeywordSet.has(k.keyword));
        if (!fallback) {
          console.log(`  ⚠️  [${HEALTH_TOPICS.find((h) => h.id === targetTopic)?.label}] 사용 가능한 키워드 없음. 건너뜀.`);
          continue;
        }
        kw = fallback;
        console.log(`  ℹ️  [${HEALTH_TOPICS.find((h) => h.id === targetTopic)?.label}] 키워드 pool 부족 → fallback 키워드 사용 (주제 각도는 유지)`);
      }

      // topic은 항상 targetTopic으로 강제 — 로테이션 순서 절대 보장
      const topic = targetTopic;
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

        // 토픽별 카테고리 결정 — knowledge 토픽은 knowledge, health 서브토픽은 각 독립 카테고리
        const knowledgeTopicIds = ['immunity', 'digestion', 'eye', 'skin', 'oral', 'liver', 'lung', 'mental'];
        const healthSubtopicSlugs = ['blood_sugar', 'blood_pressure', 'joint', 'sleep', 'brain', 'menopause', 'nutrition'];
        let postCategoryId;
        if (knowledgeTopicIds.includes(topic)) {
          postCategoryId = knowledgeCat.id;
        } else if (healthSubtopicSlugs.includes(topic)) {
          const topicCat = await prisma.category.findUnique({ where: { slug: topic } });
          postCategoryId = topicCat ? topicCat.id : kw.categoryId;
        } else {
          postCategoryId = kw.categoryId;
        }

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
        // keywordId 중복 오류 → 이미 해당 키워드로 DRAFT/글 존재. used=true 처리 후 스킵
        if (e.message && e.message.includes('keywordId')) {
          console.log(`  ⚠ 키워드 중복 (이미 생성된 글 있음) → used 처리 후 스킵: ${kw.keyword}\n`);
          try { await prisma.keyword.update({ where: { id: kw.id }, data: { used: true } }); } catch {}
        } else {
          fail++;
          console.error(`  ✗ 실패: ${e.message}\n`);
        }
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
