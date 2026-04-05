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

// 주제별 CTA 문구 (블로그에 표시되는 문구)
const TOPIC_CTA_TEXT = {
  blood_sugar:    '혈당 관리에 도움되는 추천 제품',
  blood_pressure: '혈압·혈관 건강에 도움되는 추천 제품',
  joint:          '관절·연골 건강에 도움되는 추천 제품',
  sleep:          '수면의 질 개선에 도움되는 추천 제품',
  brain:          '뇌 건강·기억력에 도움되는 추천 제품',
  menopause:      '갱년기 건강에 도움되는 추천 제품',
  nutrition:      '영양 보충에 도움되는 추천 제품',
};

// 구글 시트에서 해당 주제 상품 목록 읽기 (CSV 파싱)
async function fetchCoupangProducts(topicId) {
  const sheetName = TOPIC_TO_SHEET[topicId];
  if (!sheetName) return [];
  try {
    const url = `https://docs.google.com/spreadsheets/d/${COUPANG_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.trim().split('\n').slice(1); // 헤더 제거
    return lines
      .map((line) => {
        // CSV 파싱: "상품명","URL","메모"
        const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        const name = (cols[0] || '').replace(/^"|"$/g, '').trim();
        const url  = (cols[1] || '').replace(/^"|"$/g, '').trim();
        return name && url ? { name, url } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 쿠팡 추천 박스 HTML 생성 (쿠팡 파트너스 활동 기준 준수)
function makeCoupangHtml(product, topicId) {
  const ctaText = TOPIC_CTA_TEXT[topicId] || '관련 추천 제품';
  return `
<div class="coupang-affiliate-box">
  <p class="coupang-label">🛒 ${ctaText}</p>
  <a href="${product.url}" target="_blank" rel="noopener sponsored" class="coupang-link">
    ${product.name} 쿠팡에서 보기 →
  </a>
  <p class="coupang-disclosure">⚠️ 파트너스 활동 안내: 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다. 추천 제품의 가격·재고는 쿠팡 사이트에서 확인하세요.</p>
</div>`;

// 본문 중간(FAQ 섹션 앞)에 쿠팡 박스 삽입
function insertCoupangBox(content, product, topicId) {
  if (!product) return content;
  const box = makeCoupangHtml(product, topicId);
  // FAQ 섹션 바로 앞에 삽입
  if (content.includes('<section class="conclusion">')) {
    return content.replace('<section class="conclusion">', box + '\n<section class="conclusion">');
  }
  // 없으면 </article> 바로 앞에
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

// ─── 건강 7대 주제 (네비게이션 순서 고정 로테이션) ──────────────────────────
// 순서: 혈당·당뇨 → 혈압·심장 → 관절·근육 → 수면·피로 → 뇌건강·치매 → 갱년기 → 영양·식이
const HEALTH_TOPICS = [
  { id: 'blood_sugar',    label: '혈당·당뇨',   words: ['혈당', '당뇨', '인슐린', '혈糖', '혈액당', '공복혈당'] },
  { id: 'blood_pressure', label: '혈압·심장',   words: ['혈압', '심장', '심혈관', '고혈압', '심근', '부정맥', '콜레스테롤', '동맥경화', '심부전'] },
  { id: 'joint',          label: '관절·근육',   words: ['관절', '무릎', '연골', '허리', '척추', '근육', '근감소', '골다공증', '어깨', '힘줄', '류마티스'] },
  { id: 'sleep',          label: '수면·피로',   words: ['수면', '불면', '피로', '수면장애', '잠', '멜라토닌', '불면증', '만성피로', '졸음'] },
  { id: 'brain',          label: '뇌건강·치매', words: ['치매', '뇌', '기억력', '인지', '파킨슨', '뇌졸중', '알츠하이머', '뇌건강', '인지저하'] },
  { id: 'menopause',      label: '갱년기',      words: ['갱년기', '폐경', '호르몬', '안면홍조', '골밀도', '에스트로겐', '남성갱년기'] },
  { id: 'nutrition',      label: '영양·식이',   words: ['영양', '영양제', '비타민', '식이', '음식', '식단', '건강식', '단백질', '오메가', '식품', '보충제'] },
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

// ─── 카테고리별 전문가 역할 ───────────────────────────────────────────────────
const SYSTEM_ROLES = {
  health:    '서울대 의대·서울아산병원 20년 경력 내과·가정의학과 전문의이자 5060 시니어 건강 전문 칼럼니스트. 고혈압·당뇨·관절·수면·갱년기·치매 예방 등 중장년 건강 문제를 최신 임상 근거 기반으로 설명. 독자는 주로 50~60대이므로 어려운 의학 용어는 반드시 쉽게 풀어쓰고, 당장 집에서 실천할 수 있는 구체적 방법 위주로 작성. 과잉 진단·과잉 치료 없이 신뢰할 수 있는 정보만 전달.',
  tech:      '실리콘밸리 출신 시니어 엔지니어 겸 IT 전문 저널리스트. 20년 현장 경험으로 쌓은 기술 트렌드 분석 능력과 일반인도 이해할 수 있는 설명력 보유. 실제 사용해본 경험 기반으로 장단점 솔직하게 작성.',
  economy:   '10년 경력 공인 재무설계사(CFP) 겸 경제 칼럼니스트. 주식, 부동산, 절세 전략까지 실제 돈이 되는 정보를 구체적 수치와 함께 제공. 독자가 바로 실행할 수 있는 단계별 방법 위주로 작성.',
  lifestyle: '라이프스타일 전문 에디터. 수천 건의 제품 리뷰와 생활 실험을 거친 실용 정보 전문가. 독자 삶의 질을 실제로 높일 수 있는 검증된 팁과 노하우 중심으로 작성.',
  travel:    '20개국 이상 현지 취재 경험을 가진 여행 전문 작가. 가이드북에 없는 현지 정보, 절약 꿀팁, 감성적인 여행 스토리를 생생하게 전달. 독자가 글을 읽으며 현지에 있는 듯한 느낌을 받도록 구체적으로 작성.',
};

// ─── 글 생성 (2단계: 메타데이터 → 본문 분리) ──────────────────────────────────
async function generatePost(keyword, categorySlug) {
  const role = SYSTEM_ROLES[categorySlug] || '전문 블로그 작가.';
  const isHealth = categorySlug === 'health';
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
` : ''}
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

아래 JSON 메타데이터만 생성하세요 (본문 제외).
⚠️ 제목에 특정 연도(2023, 2024 등 과거 연도) 절대 포함 금지. 시간이 지나도 유효한 제목으로 작성.
{
  "titles": ["질문형 제목", "숫자 포함 제목", "해결책형 제목"],
  "selectedTitle": "클릭률 높은 제목 1개 (30~45자, 핵심 키워드 포함, 연도 포함 금지)",
  "metaTitle": "검색결과 타이틀 (55자 이내, 키워드 포함)",
  "metaDescription": "검색결과 설명 (140~155자, 키워드 + 궁금증 유발 + 클릭 유도)",
  "excerpt": "글 요약 (120~150자, 핵심 가치 전달)",
  "keywords": ["핵심키워드", "관련키워드2", "관련키워드3", "롱테일1", "롱테일2"],
  "sections": ["섹션1 소제목", "섹션2 소제목", "섹션3 소제목", "섹션4 소제목", "섹션5 소제목", "섹션6 소제목"],
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
    max_tokens: 16000,
    messages: [
      { role: 'system', content: `${systemPrompt}\nHTML 형식의 블로그 본문만 작성합니다. JSON 없이 HTML만 출력합니다.` },
      {
        role: 'user',
        content: `키워드: "${keyword}"
제목: "${meta.selectedTitle}"
섹션 구성: ${meta.sections.join(' / ')}

위 구성으로 독자가 오래 머물고 즐겨찾기에 저장하고 싶은 완성도 높은 블로그 본문 HTML을 작성하세요.

[필수 조건]
1. 순수 텍스트 기준 6,000자 이상 (HTML 태그 제외) — 반드시 완결된 글로 끝내야 합니다
2. 각 섹션 최소 600~900자 이상의 내용
3. 구체적 수치(연구 결과, 통계, %, 기간), 실사례 반드시 포함
4. 문단은 3~4문장 단위로 나누어 읽기 편하게 구성
5. 전문가만 아는 심화 정보, 독자가 공감할 경험담 포함

HTML 구조 (반드시 이 순서로, </article>로 반드시 닫을 것):
<article>

<section class="intro">
  <div class="definition-box">
    <h3>💡 ${keyword}란?</h3>
    <p>[40~60자로 명확하게 정의. 구글 Featured Snippet에 최적화된 한 문장 정의]</p>
  </div>
  <div class="summary-box">
    <ul>
      <li>핵심 내용 1</li>
      <li>핵심 내용 2</li>
      <li>핵심 내용 3</li>
      <li>독자가 얻어갈 실용적 혜택</li>
    </ul>
  </div>
  <p>서론 첫 문단 (독자 공감, 3~4문장)</p>
  <p>서론 둘째 문단 (글 기대감 형성, 3문장)</p>
</section>

<section>
  <h2>${meta.sections[0] || '핵심 개념과 원인'}</h2>
  <p>배경 설명 (4~5문장, 전문적 근거 포함)</p>
  <p>핵심 메커니즘 (4~5문장, 수치/통계 포함)</p>
  <p>실생활 연관성 (3~4문장)</p>
  <div class="info-box"><p>이 섹션 핵심 요약 2~3줄</p></div>
</section>

<section>
  <h2>${meta.sections[1] || '단계별 실천 가이드'}</h2>
  <p>도입 설명 (3~4문장)</p>
  <p>상세 방법 (4~5문장, 구체적 수치 포함)</p>
  <ol>
    <li><strong>단계 1:</strong> 상세 설명 (2~3문장)</li>
    <li><strong>단계 2:</strong> 상세 설명 (2~3문장)</li>
    <li><strong>단계 3:</strong> 상세 설명 (2~3문장)</li>
    <li><strong>단계 4:</strong> 상세 설명 (2~3문장)</li>
    <li><strong>단계 5:</strong> 상세 설명 (2~3문장)</li>
  </ol>
  <p>보충 설명 및 주의점 (3~4문장)</p>
</section>

<section>
  <h2>${meta.sections[2] || '전문가가 밝히는 오해와 진실'}</h2>
  <p>일반인이 잘못 알고 있는 상식 (4~5문장)</p>
  <p>올바른 정보와 근거 (4~5문장, 연구/데이터 인용)</p>
  <div class="expert-quote">
    <p>전문가적 견해 또는 연구 인용 (3~4문장)</p>
    <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem">— 관련 기관 또는 연구 출처</p>
  </div>
  <p>실생활 적용 방법 (3~4문장)</p>
</section>

<section>
  <h2>${meta.sections[3] || '상황별 맞춤 활용법'}</h2>
  <p>상황 설정 (3~4문장)</p>
  <p>상황 A 대처법 (3~4문장, 구체적)</p>
  <p>상황 B 대처법 (3~4문장, 구체적)</p>
  <div class="tip-box">
    <p>바로 써먹을 수 있는 핵심 팁</p>
    <ul>
      <li>팁 1: 구체적 방법</li>
      <li>팁 2: 구체적 방법</li>
      <li>팁 3: 구체적 방법</li>
    </ul>
  </div>
</section>

<section>
  <h2>${meta.sections[4] || '비교 분석과 선택 기준'}</h2>
  <p>비교 필요성 (3~4문장)</p>
  <table>
    <thead><tr><th>구분</th><th>항목1</th><th>항목2</th><th>항목3</th></tr></thead>
    <tbody>
      <tr><td>특징</td><td>내용</td><td>내용</td><td>내용</td></tr>
      <tr><td>장점</td><td>내용</td><td>내용</td><td>내용</td></tr>
      <tr><td>단점</td><td>내용</td><td>내용</td><td>내용</td></tr>
      <tr><td>추천 대상</td><td>내용</td><td>내용</td><td>내용</td></tr>
    </tbody>
  </table>
  <p>표 결론 및 선택 가이드 (3~4문장)</p>
</section>

<section>
  <h2>${meta.sections[5] || '주의사항과 흔한 실수'}</h2>
  <p>흔히 저지르는 실수 (4~5문장)</p>
  <div class="warning-box">
    <ul>
      <li>절대 하면 안 되는 것 1 — 이유 포함</li>
      <li>절대 하면 안 되는 것 2 — 이유 포함</li>
      <li>절대 하면 안 되는 것 3 — 이유 포함</li>
    </ul>
  </div>
  <p>올바른 대안 제시 (3~4문장)</p>
</section>

<section>
  <h2>자주 묻는 질문 (FAQ)</h2>
  <div class="faq-item"><p class="faq-q">Q. 자주 묻는 질문 1?</p><p>A. 구체적 답변 (3~4문장)</p></div>
  <div class="faq-item"><p class="faq-q">Q. 자주 묻는 질문 2?</p><p>A. 구체적 답변 (3~4문장)</p></div>
  <div class="faq-item"><p class="faq-q">Q. 자주 묻는 질문 3?</p><p>A. 구체적 답변 (3~4문장)</p></div>
  <div class="faq-item"><p class="faq-q">Q. 자주 묻는 질문 4?</p><p>A. 구체적 답변 (3~4문장)</p></div>
</section>

<section class="conclusion">
  <h2>마무리: 오늘부터 바로 실천하세요</h2>
  <p>핵심 내용 요약 (3~4문장)</p>
  <p>독자 격려 및 행동 촉구 (3~4문장)</p>
  <div class="info-box"><p>이 글에서 배운 내용을 한 줄로 정리하면: <strong>[핵심 한 줄 요약]</strong></p></div>
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
      take: generateCount * 2,
    });

    if (!keywords.length) {
      console.log('사용 가능한 키워드 없음. npm run collect:keywords 먼저 실행하세요.');
      return;
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
      const topicLabel = HEALTH_TOPICS.find((h) => h.id === targetTopic)?.label || targetTopic;
      console.log(`[${success + 1}/${generateCount}] [${topicLabel}] "${kw.keyword}" 생성 중...`);

      try {
        const gen = await generatePost(kw.keyword, kw.category.slug);

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

        // 쿠팡파트너스 상품 삽입 (health 카테고리 + 주제 매칭 시)
        if (kw.category.slug === 'health' && TOPIC_TO_SHEET[targetTopic]) {
          try {
            const coupangProducts = await fetchCoupangProducts(targetTopic);
            if (coupangProducts.length) {
              // 랜덤으로 상품 1개 선택
              const product = coupangProducts[Math.floor(Math.random() * coupangProducts.length)];
              content = insertCoupangBox(content, product, targetTopic);
              console.log(`    쿠팡 상품: "${product.name}"`);
            }
          } catch (e) {
            console.log(`    쿠팡 상품 로딩 실패 (건너뜀): ${e.message}`);
          }
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
            status: 'DRAFT',
            categoryId: kw.categoryId,
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
