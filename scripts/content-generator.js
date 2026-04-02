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

function injectBodyImages(content, images) {
  if (!images.length) return content;
  // </section> 태그를 기준으로 2번째, 4번째 섹션 뒤에 이미지 삽입
  let count = 0;
  let imgIdx = 0;
  return content.replace(/<\/section>/g, (match) => {
    count++;
    if ((count === 2 || count === 4) && imgIdx < images.length) {
      const img = images[imgIdx++];
      return `</section>
<figure style="margin:2rem 0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(200,150,122,0.12)">
  <img src="${img.url}" alt="${img.alt}" style="width:100%;max-height:400px;object-fit:cover;display:block" loading="lazy" />
  <figcaption style="font-size:0.75rem;text-align:center;padding:0.5rem 1rem;background:#F0E8DF;color:#8B7355">
    <a href="${img.creditUrl}" target="_blank" rel="noopener noreferrer" style="color:#C8967A">${img.credit}</a>
  </figcaption>
</figure>`;
    }
    return match;
  });
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
  health:    '10년 경력 건강 전문 칼럼니스트. 의학적 사실 기반, 실용적이고 신뢰감 있게 작성.',
  tech:      'IT 전문 기자 겸 테크 블로거. 최신 트렌드와 실사용 팁 중심으로 작성.',
  economy:   '개인 재테크 전문 칼럼니스트. 쉬운 언어로 실제 돈이 되는 정보 제공.',
  lifestyle: '생활 정보 전문 에디터. 바로 써먹을 수 있는 실용적 팁 위주로 작성.',
  travel:    '여행 전문 에디터. 생생하고 구체적인 여행 정보와 감성을 담아 작성.',
};

// ─── 글 생성 ─────────────────────────────────────────────────────────────────
async function generatePost(keyword, categorySlug) {
  const role = SYSTEM_ROLES[categorySlug] || '전문 블로그 작가.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 12000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 ${role}

[절대 규칙]
- 모든 텍스트는 순수 한국어로만 작성합니다.
- 중국어, 일본어, 베트남어, 러시아어 등 외국어 문자 사용 금지.
- 영어는 IT 용어, 브랜드명 등 꼭 필요한 경우에만 사용합니다.
- AI가 쓴 티가 나지 않도록 자연스럽게 작성합니다.
- JSON 형식으로만 응답합니다.`,
      },
      {
        role: 'user',
        content: `키워드: "${keyword}"

이 키워드로 SEO 최적화 한국어 블로그 글을 작성하세요.

[필수 조건]
1. 전체 본문 5,000자 이상 (매우 중요! 각 섹션 최소 700자 이상)
2. 구체적 수치, 실사례, 개인 경험담 풍부하게 포함
3. 문단은 반드시 2~4문장 단위로 나누고 각 문단 사이에 충분한 간격
4. 독자 공감 서론 → 핵심 정보 → 실전 팁 → 주의사항 → 결론 구조
5. 자연스러운 구어체와 문어체 혼용
6. 소제목은 독자의 궁금증을 해결하는 형태로 작성

JSON 형식으로 응답:
{
  "titles": ["질문형 제목", "숫자 포함 제목", "해결책형 제목"],
  "selectedTitle": "클릭률 가장 높을 제목 1개",
  "metaTitle": "검색결과 타이틀 (55자 이내, 키워드 포함)",
  "metaDescription": "검색결과 설명 (140~155자, 키워드 + 클릭 유도 포함)",
  "excerpt": "글 요약 (100~130자)",
  "keywords": ["핵심키워드", "관련키워드2", "관련키워드3", "롱테일1", "롱테일2"],
  "content": "HTML 본문"
}

content HTML 구조 (각 section은 700자 이상):
<article>
  <section class='intro'>
    <p>서론 첫 문단 (공감+키워드, 150자 내외)</p>
    <p>서론 둘째 문단 (글에서 다룰 내용 예고, 100자)</p>
  </section>

  <section>
    <h2>소제목1 — 핵심 개념/원인 (독자 궁금증 해결형)</h2>
    <p>첫 번째 문단 (3~4문장)</p>
    <p>두 번째 문단 (3~4문장, 구체적 수치 포함)</p>
    <p>세 번째 문단 (3~4문장, 실사례)</p>
  </section>

  <section>
    <h2>소제목2 — 방법/해결책</h2>
    <p>설명 문단1</p>
    <p>설명 문단2</p>
    <ul><li>구체적 항목1 (상세 설명 포함)</li><li>구체적 항목2</li><li>구체적 항목3</li><li>항목4</li></ul>
    <p>보충 설명 문단</p>
  </section>

  <section>
    <h2>소제목3 — 실전 팁/노하우</h2>
    <p>문단1</p>
    <p>문단2</p>
    <p>문단3 (경험담 포함)</p>
  </section>

  <section>
    <h2>소제목4 — 주의사항/자주 묻는 질문</h2>
    <p>문단1</p>
    <p>문단2</p>
    <ul><li>주의사항1</li><li>주의사항2</li><li>주의사항3</li></ul>
  </section>

  <section>
    <h2>소제목5 — 심화 정보/추가 팁</h2>
    <p>문단1</p>
    <p>문단2</p>
    <p>문단3</p>
  </section>

  <section class='conclusion'>
    <h2>마무리</h2>
    <p>핵심 내용 요약 문단 (3~4문장)</p>
    <p>독자 행동 촉구 문단 (2~3문장)</p>
  </section>
</article>`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  const textLen = parsed.content.replace(/<[^>]*>/g, '').length;
  return { ...parsed, readTime: Math.max(1, Math.ceil(textLen / 500)) };
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

    for (const kw of keywords) {
      if (success >= generateCount) break;
      console.log(`[${success + 1}/${generateCount}] "${kw.keyword}" 생성 중...`);

      try {
        const gen = await generatePost(kw.keyword, kw.category.slug);

        // Unsplash 썸네일 + 본문 이미지
        let thumbnail = null;
        let content = gen.content;

        if (hasUnsplash) {
          const thumbImg = await fetchUnsplashImage(kw.keyword);
          if (thumbImg) thumbnail = thumbImg.url;

          const bodyImgs = await fetchBodyImages(gen.keywords.slice(0, 3), 2);
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
