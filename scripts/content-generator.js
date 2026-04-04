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

// ─── Unsplash 이미지 ──────────────────────────────────────────────────────────
async function fetchUnsplashImage(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${key}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      url: data.urls.regular,
      alt: data.alt_description || query,
      credit: `Photo by ${data.user.name} on Unsplash`,
      creditUrl: `${data.user.links.html}?utm_source=smartinfoblog&utm_medium=referral`,
    };
  } catch {
    return null;
  }
}

async function fetchBodyImages(keywords, count = 2) {
  const results = [];
  const queries = keywords.slice(0, count);
  for (const q of queries) {
    const img = await fetchUnsplashImage(q);
    if (img) results.push(img);
    await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}

function makeImgHtml(img) {
  return `
<figure style="margin:2rem 0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(200,150,122,0.12)">
  <img src="${img.url}" alt="${img.alt}" style="width:100%;max-height:420px;object-fit:cover;display:block" loading="lazy" />
  <figcaption style="font-size:0.75rem;text-align:center;padding:0.5rem 1rem;background:#F0E8DF;color:#8B7355">
    <a href="${img.creditUrl}" target="_blank" rel="noopener noreferrer" style="color:#C8967A">${img.credit}</a>
  </figcaption>
</figure>`;
}

function injectBodyImages(content, images) {
  if (!images.length) return content;

  // 1순위: </section> 기준 2번째, 4번째 뒤에 삽입
  const sectionCount = (content.match(/<\/section>/g) || []).length;
  if (sectionCount >= 2) {
    let count = 0;
    let imgIdx = 0;
    return content.replace(/<\/section>/g, (match) => {
      count++;
      if ((count === 2 || count === 4) && imgIdx < images.length) {
        return match + makeImgHtml(images[imgIdx++]);
      }
      return match;
    });
  }

  // 2순위: </section> 없으면 </h2> 기준 2번째, 4번째 뒤에 삽입
  const h2Count = (content.match(/<\/h2>/g) || []).length;
  if (h2Count >= 2) {
    let count = 0;
    let imgIdx = 0;
    return content.replace(/<\/h2>/g, (match) => {
      count++;
      if ((count === 2 || count === 4) && imgIdx < images.length) {
        return match + makeImgHtml(images[imgIdx++]);
      }
      return match;
    });
  }

  // 3순위: 글 중간과 끝에 강제 삽입
  const half = Math.floor(content.length / 2);
  const insertPos = content.indexOf('</p>', half);
  if (insertPos !== -1 && images.length >= 1) {
    const after = insertPos + 4;
    let result = content.slice(0, after) + makeImgHtml(images[0]) + content.slice(after);
    if (images.length >= 2) {
      const threeQ = Math.floor(result.length * 0.75);
      const insertPos2 = result.indexOf('</p>', threeQ);
      if (insertPos2 !== -1) {
        result = result.slice(0, insertPos2 + 4) + makeImgHtml(images[1]) + result.slice(insertPos2 + 4);
      }
    }
    return result;
  }

  return content;
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
  health:    '서울대 의대 출신 15년 경력 내과 전문의이자 건강 칼럼니스트. 최신 의학 연구 결과와 임상 경험을 바탕으로 정확하고 신뢰감 있게 작성. 독자가 병원 상담 없이도 깊이 이해할 수 있도록 상세히 설명.',
  tech:      '실리콘밸리 출신 시니어 엔지니어 겸 IT 전문 저널리스트. 20년 현장 경험으로 쌓은 기술 트렌드 분석 능력과 일반인도 이해할 수 있는 설명력 보유. 실제 사용해본 경험 기반으로 장단점 솔직하게 작성.',
  economy:   '10년 경력 공인 재무설계사(CFP) 겸 경제 칼럼니스트. 주식, 부동산, 절세 전략까지 실제 돈이 되는 정보를 구체적 수치와 함께 제공. 독자가 바로 실행할 수 있는 단계별 방법 위주로 작성.',
  lifestyle: '라이프스타일 전문 에디터. 수천 건의 제품 리뷰와 생활 실험을 거친 실용 정보 전문가. 독자 삶의 질을 실제로 높일 수 있는 검증된 팁과 노하우 중심으로 작성.',
  travel:    '20개국 이상 현지 취재 경험을 가진 여행 전문 작가. 가이드북에 없는 현지 정보, 절약 꿀팁, 감성적인 여행 스토리를 생생하게 전달. 독자가 글을 읽으며 현지에 있는 듯한 느낌을 받도록 구체적으로 작성.',
};

// ─── 글 생성 (2단계: 메타데이터 → 본문 분리) ──────────────────────────────────
async function generatePost(keyword, categorySlug) {
  const role = SYSTEM_ROLES[categorySlug] || '전문 블로그 작가.';
  const systemPrompt = `당신은 ${role}
모든 텍스트는 순수 한국어로만 작성합니다. 외국어 문자(중국어·일본어·베트남어·러시아어 등) 사용 금지.
영어는 IT 용어, 브랜드명 등 꼭 필요한 경우에만 사용합니다.
AI가 쓴 티가 나지 않도록 실제 전문가가 직접 쓴 것처럼 자연스럽게 작성합니다.
제목과 본문에 특정 연도(2023년, 2024년 등 과거 연도)를 절대 사용하지 않습니다. 시간이 지나도 유효한 정보(Evergreen Content)로 작성합니다.

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
  const hasUnsplash = !!process.env.UNSPLASH_ACCESS_KEY;
  console.log(`=== 콘텐츠 생성 시작 (GPT-4o-mini${hasUnsplash ? ' + Unsplash' : ''}) ===`);
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

    // 이미 발행된 글 제목/키워드 목록 (중복 방지용)
    const publishedTitles = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { keywords: true },
    });
    const usedKeywordSet = new Set(
      publishedTitles.flatMap((p) => JSON.parse(p.keywords || '[]'))
    );

    for (const kw of keywords) {
      if (success >= generateCount) break;

      // 이미 발행된 글과 키워드가 80% 이상 겹치면 건너뜀
      if (usedKeywordSet.has(kw.keyword)) {
        console.log(`  ⏭ 중복 키워드 건너뜀: "${kw.keyword}"`);
        await prisma.keyword.update({ where: { id: kw.id }, data: { used: true } });
        continue;
      }

      console.log(`[${success + 1}/${generateCount}] "${kw.keyword}" 생성 중...`);

      try {
        const gen = await generatePost(kw.keyword, kw.category.slug);

        // Unsplash 썸네일 + 본문 이미지
        let thumbnail = null;
        let content = gen.content;

        if (hasUnsplash) {
          // GPT가 생성한 영어 검색어 사용 (한국어 키워드는 Unsplash에서 엉뚱한 결과 반환)
          const thumbQuery = gen.unsplashQuery || kw.keyword;
          const thumbImg = await fetchUnsplashImage(thumbQuery);
          if (thumbImg) thumbnail = thumbImg.url;

          const bodyQueries = gen.unsplashBodyQueries && gen.unsplashBodyQueries.length
            ? gen.unsplashBodyQueries
            : gen.keywords.slice(0, 2);
          const bodyImgs = await fetchBodyImages(bodyQueries, 2);
          if (bodyImgs.length) content = injectBodyImages(content, bodyImgs);
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
        console.log(`    읽기 ${gen.readTime}분 | 이미지: ${thumbnail ? '✅' : '없음'}\n`);

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
