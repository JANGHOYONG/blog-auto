/**
 * 콘텐츠 생성기 v3 — 시니어 건강백과
 * - 모델: gpt-4o-mini (비용 최적화)
 * - 응답: JSON 구조 (12원칙 기반)
 * - 품질 게이트: checkQualityV3 → score < 90 이면 최대 2회 재생성
 * - 저장 상태: 항상 REVIEW_REQUIRED (사람 감수 필수)
 * - 주제: Topic 테이블(PENDING) → Keyword 테이블 → --topic 인자
 *
 * 실행: node scripts/content-generator-v3.js
 *       node scripts/content-generator-v3.js --topic="혈당 낮추는 식사 습관"
 *       node scripts/content-generator-v3.js --count=1 --dry-run
 */

require('dotenv').config();
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');
const { checkQualityV3 } = require('./quality-check-v3');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── CLI 인자 ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (n) => { const f = args.find((a) => a.startsWith(`--${n}=`)); return f ? f.split('=')[1] : null; };
const TOPIC_OVERRIDE = getArg('topic');
const IS_DRY_RUN    = args.includes('--dry-run');
const COUNT         = parseInt(getArg('count') || process.env.DAILY_DRAFT_COUNT || '1');

// ─── 쿠팡파트너스 ──────────────────────────────────────────────────────────────
// 글 본문에 직접 삽입하지 않음 — 페이지 컴포넌트(CoupangCategoryBanner)가 렌더링
// coupangProduct DB 필드는 null → 페이지에서 자동으로 3개 그리드 배너 표시

// ─── Pexels 이미지 ────────────────────────────────────────────────────────────
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
    if (!data.photos?.length) return null;
    const pool = data.photos.slice(0, 5);
    const photo = pool[Math.floor(Math.random() * pool.length)];
    return { url: photo.src.large, alt: photo.alt || query, credit: `Photo by ${photo.photographer} on Pexels`, creditUrl: photo.photographer_url };
  } catch { return null; }
}

// ─── Markdown → HTML 변환 ─────────────────────────────────────────────────────
function mdToHtml(md) {
  if (!md) return '';
  // 혹시 GPT가 IF-THEN 레이블을 출력했을 경우 제거
  const cleaned = md
    .replace(/\*\*IF-THEN[:\s]*/gi, '')
    .replace(/IF-THEN[:\s]*/gi, '');
  let html = cleaned
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\|(.+)\|$/gm, (row) => {
      const cells = row.split('|').slice(1, -1).map((c) => c.trim());
      return '<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>)/gs, (tableContent) => {
      if (!tableContent.includes('<tr>')) return tableContent;
      const rows = tableContent.split('\n').filter((r) => !r.match(/^<tr><td>[-|: ]+<\/td>/));
      if (!rows.length) return '';
      const [header, ...body] = rows;
      const thead = header.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
      return `<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.9rem">\n<thead><tr style="background:#E3F4ED">${thead.replace('<tr>', '').replace('</tr>', '')}</tr></thead>\n<tbody>${body.join('\n')}</tbody>\n</table>`;
    })
    .replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map((l) => l.replace(/^[ \t]*[-*+] /, '').trim()).filter(Boolean).map((l) => `<li>${l}</li>`).join('\n');
      return `<ul style="margin:0.75rem 0;padding-left:1.5rem;line-height:1.9">\n${items}\n</ul>`;
    })
    .replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, (block) => {
      const items = block.trim().split('\n').map((l) => l.replace(/^[ \t]*\d+\. /, '').trim()).filter(Boolean).map((l) => `<li>${l}</li>`).join('\n');
      return `<ol style="margin:0.75rem 0;padding-left:1.5rem;line-height:1.9">\n${items}\n</ol>`;
    })
    .replace(/\n{2,}/g, '\n\n');

  const lines = html.split('\n\n');
  html = lines.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    return `<p style="line-height:1.9;margin:0.75rem 0">${trimmed.replace(/\n/g, ' ')}</p>`;
  }).filter(Boolean).join('\n');
  return html;
}

// 이미지 HTML
function imgHtml(img) {
  return `<figure style="margin:2rem 0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(30,158,122,0.10)">
  <img src="${img.url}" alt="${img.alt}" style="width:100%;max-height:420px;object-fit:cover;display:block" loading="lazy" />
  <figcaption style="font-size:0.75rem;text-align:center;padding:0.5rem 1rem;background:#E3F4ED;color:#4B7A6A">
    <a href="${img.creditUrl}" target="_blank" rel="noopener noreferrer" style="color:#1E9E7A">${img.credit}</a>
  </figcaption>
</figure>`;
}

// JSON 응답을 HTML 본문으로 조립
// 쿠팡 배너는 페이지 컴포넌트(CoupangCategoryBanner)가 렌더링 — 여기선 삽입하지 않음
async function assembleHtml(article) {
  const parts = [];

  // 도입부 (hook + lead_answer)
  parts.push(`<section class="intro" style="margin-bottom:2rem">
  <p style="font-size:1.1rem;line-height:1.9;color:#2D4A3E">${article.hook}</p>
  <p style="margin-top:1rem;padding:1rem 1.25rem;background:#E8F5EF;border-left:4px solid #1E9E7A;border-radius:0 8px 8px 0;font-size:1rem;font-weight:600;color:#166B53;line-height:1.7">${article.lead_answer}</p>
</section>`);

  // 섹션별 본문
  for (let i = 0; i < article.sections.length; i++) {
    const sec = article.sections[i];
    let sectionHtml = `<section style="margin:2.5rem 0">\n<h2 style="font-size:1.3rem;font-weight:700;color:#1B3A2D;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:2px solid #C8E6C9">${sec.h2}</h2>\n${mdToHtml(sec.body)}\n</section>`;
    // 짝수 섹션 뒤에 이미지 삽입
    if (i % 2 === 1) {
      const query = sec.image_query || `senior health wellness ${i}`;
      const img = await fetchPexelsImage(query);
      if (img) sectionHtml += '\n' + imgHtml(img);
    }
    parts.push(sectionHtml);
  }

  // 위험 신호 — 주제별 맞춤 제목 + 문장체 본문
  if (article.stop_signals?.length) {
    const title = article.stop_signals_title || '이런 증상이 나타나면 병원에서 확인하세요';
    const paras = article.stop_signals.map((s) => `<p style="line-height:1.9;margin:0.75rem 0">${s}</p>`).join('\n');
    parts.push(`<section style="margin:2.5rem 0">
  <h2 style="font-size:1.3rem;font-weight:700;color:#1B3A2D;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:2px solid #C8E6C9">${title}</h2>
${paras}
</section>`);
  }

  // 현실적 기대치 — 주제별 맞춤 제목 + 문장체 본문
  if (article.realistic_expectations) {
    const title = article.realistic_expectations_title || '현실적으로 기대할 수 있는 변화';
    const re = article.realistic_expectations;
    parts.push(`<section style="margin:2.5rem 0">
  <h2 style="font-size:1.3rem;font-weight:700;color:#1B3A2D;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:2px solid #C8E6C9">${title}</h2>
  <p style="line-height:1.9;margin:0.75rem 0">${re.time} ${re.magnitude} 다만 ${re.what_not_to_expect}</p>
</section>`);
  }

  // 흔한 실수 — 주제별 맞춤 제목 + 문장체 본문
  if (article.common_mistakes?.length) {
    const title = article.common_mistakes_title || '많은 분들이 놓치는 부분';
    const paras = article.common_mistakes.map((m) => `<p style="line-height:1.9;margin:0.75rem 0">${m}</p>`).join('\n');
    parts.push(`<section style="margin:2.5rem 0">
  <h2 style="font-size:1.3rem;font-weight:700;color:#1B3A2D;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:2px solid #C8E6C9">${title}</h2>
${paras}
</section>`);
  }

  // FAQ — 문장체 본문 (h3 + p)
  if (article.faq?.length) {
    const items = article.faq.map((f) => `<h3 style="font-size:1rem;font-weight:700;color:#1B3A2D;margin:1.5rem 0 0.4rem">${f.q}</h3>
  <p style="line-height:1.9;margin:0">${f.a}</p>`).join('\n');
    parts.push(`<section style="margin:2.5rem 0">
  <h2 style="font-size:1.3rem;font-weight:700;color:#1B3A2D;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:2px solid #C8E6C9">자주 묻는 질문</h2>
${items}
</section>`);
  }

  // 오늘의 행동
  if (article.today_action) {
    parts.push(`<section class="today-action" style="margin:2.5rem 0;padding:1.5rem;background:linear-gradient(135deg,#E8F5EF,#D5F5E3);border-radius:16px;border:1px solid #A9DFBF;text-align:center">
  <p style="font-size:0.875rem;font-weight:600;color:#1E9E7A;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em">오늘 당장 시작</p>
  <p style="font-size:1.125rem;font-weight:700;color:#1B3A2D;margin:0;line-height:1.6">${article.today_action}</p>
</section>`);
  }

  // 참고 문헌
  if (article.sources?.length) {
    const items = article.sources.map((s) => {
      const link = s.url ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer" style="color:#1E9E7A">${s.publisher}</a>` : s.publisher;
      return `<li style="padding:0.25rem 0">${s.year} · ${link} — ${s.key_finding}</li>`;
    }).join('\n');
    parts.push(`<section class="sources" style="margin:2.5rem 0;padding:1rem 1.25rem;background:#F8F8F6;border-radius:8px;font-size:0.8rem;color:#4B7A6A">
  <p style="font-weight:700;margin-bottom:0.5rem;color:#1B3A2D">📚 참고 문헌</p>
  <ul style="margin:0;padding-left:1.25rem;line-height:1.8">\n${items}\n  </ul>
</section>`);
  }

  // 면책 박스
  parts.push(`<div class="disclaimer" style="margin-top:2.5rem;padding:1rem 1.25rem;background:#F0FDF4;border-radius:8px;font-size:0.78rem;color:#4B7A6A;line-height:1.7">
  <strong>⚠️ 건강 정보 안내</strong><br>
  본 글은 건강보험심사평가원·질병관리청·대한의학회 공개 자료를 바탕으로 검토된 일반 건강 정보입니다. 개인 건강 상태에 따라 다를 수 있으므로, 증상이 지속되거나 심각한 경우 전문의와 상담하시기 바랍니다.
</div>`);

  // CTA
  parts.push(`<div class="cta-box" style="margin-top:2rem;padding:1.5rem;background:#E8F5EF;border-radius:16px;text-align:center">
  <p class="cta-title" style="font-weight:700;color:#1B3A2D;margin-bottom:1rem">이 글이 도움이 되셨나요?</p>
  <div class="cta-buttons" style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
    <a href="/" class="cta-btn cta-btn-primary" style="background:#1E9E7A;color:#fff;padding:0.625rem 1.25rem;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.9rem">더 많은 건강 정보 보기 →</a>
    <button class="cta-btn cta-btn-share" onclick="navigator.share?navigator.share({title:document.title,url:location.href}):window.open('https://story.kakao.com/share?url='+encodeURIComponent(location.href))" style="background:#FAE100;color:#3C1E1E;padding:0.625rem 1.25rem;border-radius:10px;border:none;cursor:pointer;font-weight:700;font-size:0.9rem">카카오톡 공유</button>
  </div>
</div>`);

  return `<article>\n${parts.join('\n\n')}\n</article>`;
}

// ─── 슬러그 생성 (ASCII only — 한글 URL은 Vercel 라우팅 오류 유발)
function generateSlug(categorySlug) {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${categorySlug || 'health'}-${Date.now()}-${rand}`;
}

// ─── 주제 가져오기 ─────────────────────────────────────────────────────────────
function getSubTopicId(keyword) {
  const HEALTH_TOPICS = [
    { id: 'blood_sugar',    words: ['혈당', '당뇨', '인슐린', '혈당관리', '공복혈당'] },
    { id: 'blood_pressure', words: ['혈압', '심장', '심혈관', '고혈압', '콜레스테롤'] },
    { id: 'joint',          words: ['관절', '무릎', '연골', '허리', '척추', '근육', '골다공증'] },
    { id: 'sleep',          words: ['수면', '불면', '피로', '멜라토닌', '불면증'] },
    { id: 'brain',          words: ['치매', '뇌', '기억력', '인지', '알츠하이머'] },
    { id: 'menopause',      words: ['갱년기', '폐경', '호르몬', '에스트로겐'] },
    { id: 'nutrition',      words: ['영양', '영양제', '비타민', '식이', '단백질'] },
  ];
  for (const t of HEALTH_TOPICS) {
    if (t.words.some((w) => keyword.includes(w))) return t.id;
  }
  return null;
}

async function getNextTopic() {
  if (TOPIC_OVERRIDE) {
    return { title: TOPIC_OVERRIDE, keyword: TOPIC_OVERRIDE, categorySlug: null, topicId: null };
  }
  // 1) Topic 테이블
  const topic = await prisma.topic.findFirst({
    where: { status: 'PENDING' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
  if (topic) {
    return { title: topic.title, keyword: topic.keyword, topicId: topic.id, categorySlug: topic.categoryId };
  }
  // 2) Keyword 테이블 fallback
  const kw = await prisma.keyword.findFirst({
    where: { used: false },
    include: { category: true },
    orderBy: [{ priority: 'asc' }, { searchVolume: 'desc' }],
  });
  if (kw) {
    return { title: kw.keyword, keyword: kw.keyword, keywordId: kw.id, categorySlug: kw.category?.slug };
  }
  throw new Error('사용 가능한 주제가 없습니다. Topic 또는 Keyword 테이블을 확인하세요.');
}

// ─── 카테고리 조회 ─────────────────────────────────────────────────────────────
async function resolveCategoryId(slug) {
  const fallback = 'blood_sugar';
  const effectiveSlug = slug || fallback;
  let cat = await prisma.category.findUnique({ where: { slug: effectiveSlug } });
  if (!cat) cat = await prisma.category.findUnique({ where: { slug: fallback } });
  if (!cat) {
    cat = await prisma.category.upsert({
      where: { slug: fallback },
      update: {},
      create: { name: '혈당·당뇨', slug: fallback, description: '혈당 관리 정보' },
    });
  }
  return cat.id;
}

// ─── System Prompt (시니어 건강 전문) ─────────────────────────────────────────
const SYSTEM_PROMPT_V3 = `당신은 내과·가정의학과 전문의 자격 기반의 시니어 건강 전문 콘텐츠 에디터입니다.
독자는 50~60대 중장년으로, 혈당·혈압·관절·수면·치매 예방 등 실질적 건강 정보를 원합니다.

[절대 규칙 — 위반 시 글을 처음부터 다시 쓴다]

1. 첫 300자 안에 독자의 진짜 질문을 언급하고 핵심 답의 한 줄 요약을 제시한다.

2. 다음 표현은 절대 쓰지 않는다:
   "꾸준함이 중요", "꾸준히 실천", "본인에게 맞는", "균형 있게",
   "무리하지 않는 선에서", "개인차가 있으므로", "건강에 유의",
   "좋은 방법", "도움이 됩니다", "~하는 것이 좋습니다",
   "실천해 보세요", "성공의 열쇠", "본 글에서는", "본 포스팅에서는"

3. 모든 일반적 조언에 반드시 숫자를 붙인다:
   "충분히" 대신 정확한 g/L/분/회/% / "적당한" 대신 구체적 범위

4. 독자의 다음 질문을 선제적으로 답한다. 각 섹션에서
   "그럼 A 상황이면 어떻게?" 같은 분기를 최소 2개 제시한다.

5. 상황별 분기를 최소 2개 자연스러운 문장으로 본문에 녹인다.
   예: "혈압약을 복용 중이라면 복용 2시간 후에 측정하는 것이 정확합니다.
       반대로 약을 아직 복용하지 않는 분이라면 아침 공복 측정이 기준입니다."
   ※ "IF-THEN:", "IF:", "THEN:" 같은 영어 레이블은 절대 쓰지 않는다.
      조건은 "~이라면", "~인 경우", "~한 분은" 형태로 한국어로만 표현한다.

6. 현실적 기대치를 과장 없이 수치로 제시한다.
   "효과가 있다" 금지, "4주 후 혈당 5~8% 개선" 허용.

7. "이런 증상이 오면 병원에 가세요" 섹션을 구체 증상 5개 이상으로 명시한다.

8. 본문 중 "전문가와 상담", "의사와 상담" 같은 표현은 절대 쓰지 않는다.
   면책은 맨 마지막 박스에서만. (단, 위험 증상 5개 나열 후 자연스러운 흐름으로 "병원에서 확인" 언급은 허용)

9. FAQ는 본문에서 안 다룬 구체 상황만 넣는다 (본문 요약 금지).

10. 근거 인용은 한국 공식 기관 우선:
    질병관리청, 건강보험심사평가원, 대한의학회, 국민건강영양조사
    (발표기관 + 핵심 숫자)를 한 문장에 녹인다.

11. 단락 리듬을 의도적으로 변화시킨다. 짧은 한 줄 → 긴 설명 →
    리스트 → 짧은 정리. 모든 문단이 비슷한 길이면 실패.

12. 글 마지막은 "오늘부터 할 구체적 행동 한 가지"로 마무리한다.
    요약 반복 금지.

13. 분량: 본문 3,000~4,500자. 이 범위를 벗어나면 재작성.
    각 섹션 body는 최소 800자 이상. 짧게 쓰면 실패.

14. 톤: 신뢰할 수 있는 의학 전문가. 반말 금지.
    "~습니다" 기본, 가끔 "~어요"로 리듬 조절.
    어려운 의학 용어는 반드시 괄호로 쉬운 설명 병기.

이 규칙들은 협상 불가능합니다.`;

// ─── User Prompt 생성 ─────────────────────────────────────────────────────────
function buildUserPrompt(topic, categoryLabel) {
  return `주제: ${topic.title}
메인 키워드: ${topic.keyword}
카테고리: ${categoryLabel || '시니어 건강'}

이 주제로 50~60대 독자가 실제로 검색해서 클릭한 이유 — 즉 "이 글에서 반드시 답을 얻어야 하는 질문"을 3~5개 먼저 상상하고, 그 질문들을 모두 해결하는 본문을 작성하세요.

[작성 기준 — JSON 값으로 출력하지 말 것, 이 기준에 맞게 내용을 채울 것]
- sections: 4개 작성, 각 body는 800자 이상의 실제 내용 (지시문·메타 설명 절대 포함 금지)
  각 섹션에 최소 2개의 단락과 구체 사례 1개 이상 포함
- 각 body에 구체 수치(g·mg·mmHg·분·회·% 등) 최소 3개 포함
- 상황별 분기("~이라면", "~인 경우" 등 한국어 조건문)를 body에 자연스럽게 1개 이상 포함 (영어 레이블 IF-THEN 금지)
- 한국 공식 기관(질병관리청·건강보험심사평가원·대한의학회) 데이터 최소 1회 인용
- stop_signals_title: 이 글의 주제에 꼭 맞는 고유한 h2 제목 (매번 달라야 함. 예: "혈당 관리 중 이 신호가 오면 즉시 병원으로", "무릎에서 이 느낌이 오면 운동을 멈추세요")
- stop_signals: 구체 증상 5개 이상. 각 항목을 완전한 서술 문장으로 작성 (예: "안정 시 혈압이 180mmHg 이상으로 지속된다면 즉시 병원을 찾아야 합니다.")
- common_mistakes_title: 이 글의 주제에 꼭 맞는 고유한 h2 제목 (매번 달라야 함. 예: "수면제 없이 잠드려는 분들이 가장 많이 틀리는 것", "혈압약 먹으면서 놓치기 쉬운 생활 습관")
- common_mistakes: 각 실수를 단순 명사구가 아닌 설명 문장으로 작성 (예: "혈압약을 복용하면서 소금 섭취량을 전혀 확인하지 않는 경우가 많습니다. 약만 믿고 식단을 방치하면...")
- realistic_expectations_title: 이 글의 주제에 꼭 맞는 고유한 h2 제목 (매번 달라야 함. 예: "4주 후 실제로 달라지는 것들", "독서 습관이 뇌에 영향을 주기까지")
- realistic_expectations: time/magnitude/what_not_to_expect 각각 완전한 서술 문장으로 작성
- faq: 본문에서 다루지 않은 새 각도 질문 3개, 각 답변은 150자 이상의 자연스러운 서술 문장
- sources: 한국 공식 기관 또는 저명 저널 2개 이상

다음 JSON 형식으로만 응답하세요 (코드블록 없이):

{
  "reader_questions": ["독자가 기대하는 구체 질문 3~5개"],
  "hook": "첫 문단 100~150자 — 50~60대 독자 상황에 직접 말 걸기, 구체 수치나 반전 사실로 시작",
  "lead_answer": "제목이 약속한 답 한 줄 요약 (50자 이내)",
  "sections": [
    {
      "h2": "섹션 제목 — 독자가 실제로 하는 질문 형태",
      "body": "실제 본문 내용만 작성 (지시문 포함 금지)",
      "numbers_used": ["사용한 구체 수치 목록"],
      "if_then_branches": ["제공한 상황별 분기 설명"],
      "image_query": "Pexels 검색용 영어 키워드 2~3단어 (senior health 관련)"
    }
  ],
  "stop_signals_title": "이 글 주제에 딱 맞는 고유 제목 — 매 글마다 달라야 함",
  "stop_signals": ["완전한 서술 문장 — 증상과 권고 행동을 포함한 한 문장", "완전한 서술 문장 2", "완전한 서술 문장 3", "완전한 서술 문장 4", "완전한 서술 문장 5"],
  "realistic_expectations_title": "이 글 주제에 딱 맞는 고유 제목 — 매 글마다 달라야 함",
  "realistic_expectations": {
    "time": "언제부터 효과가 나타나는지 구체 기간을 포함한 서술 문장",
    "magnitude": "얼마나 변화하는지 수치를 포함한 서술 문장",
    "what_not_to_expect": "기대하면 안 되는 것을 설명하는 서술 문장"
  },
  "common_mistakes_title": "이 글 주제에 딱 맞는 고유 제목 — 매 글마다 달라야 함",
  "common_mistakes": ["실수를 설명하는 서술 문장 1 — 왜 문제인지까지 포함", "서술 문장 2", "서술 문장 3"],
  "today_action": "오늘 당장 할 한 가지 (50자 이내)",
  "faq": [
    {"q": "본문에 없는 새 각도 질문 1", "a": "150자 이상 자연스러운 서술 문장 답변"},
    {"q": "본문에 없는 새 각도 질문 2", "a": "150자 이상 자연스러운 서술 문장 답변"},
    {"q": "본문에 없는 새 각도 질문 3", "a": "150자 이상 자연스러운 서술 문장 답변"}
  ],
  "sources": [
    {"year": 2024, "publisher": "질병관리청 또는 저널명", "key_finding": "핵심 숫자 포함 한 줄 요약", "url": ""},
    {"year": 2023, "publisher": "두 번째 출처", "key_finding": "핵심 내용", "url": ""}
  ]
}`;
}

// ─── GPT-4o-mini 호출 ─────────────────────────────────────────────────────────
async function callGpt(systemPrompt, userPrompt, extra = '') {
  const userContent = extra ? `${userPrompt}\n\n${extra}` : userPrompt;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 10000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });
  return JSON.parse(res.choices[0].message.content.trim());
}

// ─── 메인 생성 함수 ────────────────────────────────────────────────────────────
async function generateArticle(topic, categoryLabel) {
  const userPrompt = buildUserPrompt(topic, categoryLabel);
  let article, qualityReport;
  let attempt = 0;

  while (attempt < 3) {
    attempt++;
    const extra = attempt > 1
      ? `⚠️ 이전 응답 품질 미달 (${qualityReport.score}점). 다음 항목을 반드시 보완:\n${qualityReport.failed.map((f) => `- ${f}`).join('\n')}\n섹션 body 분량을 각각 더 길게 작성하세요.`
      : '';

    console.log(`  GPT-4o-mini 호출 (시도 ${attempt}/3)...`);
    article = await callGpt(SYSTEM_PROMPT_V3, userPrompt, extra);

    qualityReport = checkQualityV3(article);
    const bodyLen = (article.sections || []).map((s) => s.body || '').join('').length;
    console.log(`  품질 점수: ${qualityReport.score}점 | 섹션 body: ${bodyLen.toLocaleString()}자`);

    if (qualityReport.failed.length) {
      qualityReport.failed.forEach((f) => console.log(`    ⚠️ ${f}`));
    }

    if (qualityReport.score >= 90) break;
    const nonBannedFails = qualityReport.failed.filter((f) => !f.includes('금지어'));
    if (attempt >= 2 && nonBannedFails.length === 0) {
      console.log('  금지어만 미달 — 2회 이상 시도했으므로 진행');
      break;
    }
    if (attempt < 3) {
      console.log('  재생성 요청...');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return { article, qualityReport };
}

// ─── 관련 글 연결 ─────────────────────────────────────────────────────────────
async function linkRelated(postId, categoryId, keywords) {
  const kwArr = Array.isArray(keywords) ? keywords : JSON.parse(keywords || '[]');
  const candidates = await prisma.post.findMany({
    where: { id: { not: postId }, categoryId, status: 'PUBLISHED' },
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

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 콘텐츠 생성기 v3 — 시니어 건강백과 (gpt-4o-mini) ===\n');

  // REVIEW_REQUIRED 큐가 이미 7건 이상이면 스킵
  const queueCount = await prisma.post.count({ where: { status: 'REVIEW_REQUIRED' } });
  if (queueCount >= 7) {
    console.log(`⏭ 감수 대기 큐 ${queueCount}건 — 충분히 쌓여 있어 생성 건너뜀`);
    await prisma.$disconnect();
    return;
  }

  let success = 0;
  for (let i = 0; i < COUNT; i++) {
    console.log(`\n[${i + 1}/${COUNT}] 주제 조회 중...`);

    let topicInfo;
    try {
      topicInfo = await getNextTopic();
    } catch (e) {
      console.error('  주제 없음:', e.message);
      break;
    }

    console.log(`  주제: "${topicInfo.title}"`);
    console.log(`  키워드: "${topicInfo.keyword}"`);

    if (IS_DRY_RUN) {
      console.log('  [dry-run] 저장 건너뜀');
      continue;
    }

    try {
      // 키워드에서 건강 주제 자동 감지 → 카테고리 슬러그 결정
      const subTopicId = getSubTopicId(topicInfo.keyword);
      const effectiveCategorySlug = topicInfo.categorySlug || subTopicId || null;
      const categoryId = await resolveCategoryId(effectiveCategorySlug);
      const categoryLabel = effectiveCategorySlug || '시니어 건강';

      const { article, qualityReport } = await generateArticle(topicInfo, categoryLabel);

      // 썸네일 이미지
      const thumbQuery = article.sections?.[0]?.image_query || `senior health ${topicInfo.keyword}`;
      const thumbImg = await fetchPexelsImage(thumbQuery);
      const thumbnail = thumbImg?.url || null;

      // HTML 조립 (쿠팡 배너 포함)
      const content = await assembleHtml(article);

      const textLen = content.replace(/<[^>]*>/g, '').length;
      const readTime = Math.max(1, Math.ceil(textLen / 500));

      const slug = generateSlug(effectiveCategorySlug);

      // keywords 배열 — sections에서 numbers_used 수집
      const keywords = [topicInfo.keyword, ...(article.reader_questions || []).slice(0, 3)];

      const post = await prisma.post.create({
        data: {
          title: topicInfo.title,
          slug,
          excerpt: article.lead_answer || topicInfo.title,
          content,
          keywords: JSON.stringify(keywords),
          metaTitle: topicInfo.title,
          metaDescription: article.lead_answer || topicInfo.title,
          readTime,
          thumbnail,
          status: 'REVIEW_REQUIRED',
          qualityScore: qualityReport.score,
          rejectReasons: qualityReport.failed,
          categoryId,
        },
      });

      // Topic 상태 업데이트
      if (topicInfo.topicId) {
        await prisma.topic.update({ where: { id: topicInfo.topicId }, data: { status: 'DRAFTED' } });
      }
      // Keyword used 처리
      if (topicInfo.keywordId) {
        await prisma.keyword.update({ where: { id: topicInfo.keywordId }, data: { used: true } });
      }

      await linkRelated(post.id, categoryId, JSON.stringify(keywords));

      success++;
      console.log(`  ✅ 저장 완료 → Post #${post.id} | 품질: ${qualityReport.score}점 | ${textLen.toLocaleString()}자 | REVIEW_REQUIRED`);

      if (i < COUNT - 1) await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.error(`  ✗ 실패: ${e.message}`);
    }
  }

  await prisma.automationLog.create({
    data: {
      type: 'CONTENT_GENERATE',
      status: success > 0 ? 'SUCCESS' : 'FAILED',
      message: `v3 초안 ${success}개 생성 (REVIEW_REQUIRED)`,
    },
  }).catch(() => {});

  console.log(`\n=== 완료 ===`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
