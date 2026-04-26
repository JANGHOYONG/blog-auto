/**
 * 품질 검증기 v3 — 12원칙 중 자동 검증 가능한 항목 체크
 * export: checkQualityV3(article) → { score, failed }
 *
 * article: content-generator-v3가 반환하는 JSON 객체
 * {
 *   hook, lead_answer,
 *   sections: [{ h2, body, numbers_used, if_then_branches }],
 *   stop_signals, faq, sources, ...
 * }
 *
 * score < 90 → content-generator-v3가 재생성 요청
 *
 * ━━ 검증 항목 (원칙 번호 → 감점) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 원칙 1  첫 300자에 lead_answer(앞 30자) 포함 여부          -15점
 * 원칙 2  금지어 블랙리스트 14개 단어 (단어당 -10점, 최대 -40)
 * 원칙 3  수치(g|kg|L|ml|분|회|%|cm|kcal) 최소 10개         -15점
 * 원칙 5  분기(if_then_branches 합계) 최소 2개               -10점
 * 원칙 7  extra_sections 2개 이상 (주제별 자유 심층 섹션)     -10점
 * 원칙 8  FAQ 최소 2개                                       -10점
 * 원칙 9  본문 중간 "전문가와 상담" 금지 (90% 이전 위치)      -15점
 * 원칙 11 sources 최소 1건                                   -10점
 * 원칙 13 본문 2,500~3,500자                                 -15점
 */

'use strict';

// 금지어 블랙리스트
const BANNED_PHRASES = [
  '꾸준함이 중요',
  '꾸준히 실천',
  '본인에게 맞는',
  '균형 있게',
  '무리하지 않는',
  '개인차가 있으므로',
  '건강에 유의',
  '좋은 방법',
  '도움이 됩니다',
  '하는 것이 좋습니다',
  '실천해 보세요',
  '성공의 열쇠',
  '본 글에서는',
  '본 포스팅에서는',
];

// 수치 패턴 — g, kg, L, ml, 분, 회, %, cm, kcal + 숫자 조합
const NUMBER_PATTERN = /\d+(?:\.\d+)?(?:~\d+(?:\.\d+)?)?\s*(?:g|kg|L|ml|분|초|회|%|cm|kcal|칼로리|킬로칼로리|킬로그램|리터|밀리리터)/g;

/**
 * @param {object} article - content-generator-v3 JSON 응답
 * @returns {{ score: number, failed: string[] }}
 */
function checkQualityV3(article) {
  const failed = [];
  let score = 100;

  // 본문 전체 텍스트 추출
  const sections = article.sections || [];
  const fullBody = sections.map((s) => s.body || '').join('\n');
  const hook = article.hook || '';
  const leadAnswer = article.lead_answer || '';

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 1 — 첫 300자에 lead_answer 핵심 포함 (hook + lead_answer 합산)
  // ─────────────────────────────────────────────────────────────────────────
  const intro300 = (hook + ' ' + leadAnswer).slice(0, 300);
  const leadSlice = leadAnswer.slice(0, 25).trim();
  if (leadSlice && !intro300.includes(leadSlice)) {
    // fullBody 첫 300자도 체크 (섹션 첫 부분)
    const bodyStart = fullBody.slice(0, 300);
    if (!bodyStart.includes(leadSlice)) {
      score -= 15;
      failed.push('원칙1: 첫 300자에 핵심 답 선제공 누락');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 2 — 금지어 블랙리스트
  // ─────────────────────────────────────────────────────────────────────────
  const searchText = fullBody + ' ' + hook + ' ' + leadAnswer;
  let bannedCount = 0;
  for (const phrase of BANNED_PHRASES) {
    if (searchText.includes(phrase)) {
      bannedCount++;
      failed.push(`원칙2: 금지어 "${phrase}"`);
    }
  }
  if (bannedCount > 0) {
    score -= Math.min(bannedCount * 10, 40);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 3 — 수치 최소 10개
  // ─────────────────────────────────────────────────────────────────────────
  const numberMatches = searchText.match(NUMBER_PATTERN) || [];
  if (numberMatches.length < 10) {
    score -= 15;
    failed.push(`원칙3: 수치 부족 (${numberMatches.length}개 / 최소 10개)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 5 — IF-THEN 분기 최소 2개
  // ─────────────────────────────────────────────────────────────────────────
  const allBranches = sections.flatMap((s) => s.if_then_branches || []);
  // 본문 내 분기 패턴도 추가 체크 (아침형이면, 직장인이면, ~라면 등)
  const branchPatterns = (fullBody.match(/(?:이면|라면|경우에는|상황이라면|타입이면)/g) || []).length;
  const totalBranches = allBranches.length + Math.floor(branchPatterns / 2);
  if (totalBranches < 2) {
    score -= 10;
    failed.push(`원칙5: IF-THEN 분기 부족 (${totalBranches}개 / 최소 2개)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 7 — extra_sections 2개 이상 (주제별 자유 심층 섹션)
  // ─────────────────────────────────────────────────────────────────────────
  const extraSections = article.extra_sections || [];
  if (extraSections.length < 2) {
    score -= 10;
    failed.push(`원칙7: 심층 섹션 부족 (${extraSections.length}개 / 최소 2개)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 8 — FAQ 최소 2개 (본문에서 안 다룬 새 질문)
  // ─────────────────────────────────────────────────────────────────────────
  const faq = article.faq || [];
  if (faq.length < 2) {
    score -= 10;
    failed.push(`원칙8: FAQ 부족 (${faq.length}개 / 최소 2개)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 9 — "전문가와 상담" 본문 중간 금지 (전체 길이의 90% 이전)
  // ─────────────────────────────────────────────────────────────────────────
  const FORBIDDEN_MID = ['전문가와 상담', '의사와 상담', '의사에게 상담'];
  for (const phrase of FORBIDDEN_MID) {
    const pos = fullBody.indexOf(phrase);
    if (pos !== -1 && pos < fullBody.length * 0.9) {
      score -= 15;
      failed.push(`원칙9: 책임 회피 구절 본문 중간 발견 ("${phrase}")`);
      break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 11 — 참고 문헌 최소 1건
  // ─────────────────────────────────────────────────────────────────────────
  const sources = article.sources || [];
  if (sources.length < 1) {
    score -= 10;
    failed.push('원칙11: 참고 문헌 없음 (최소 1건)');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 원칙 13 — 분량 체크 (sections body 마크다운 기준)
  // 참고: 조립된 HTML(stop_signals·faq·expectations 박스 포함) 기준으로는
  //       약 1.5~2배 더 길어지므로, 마크다운 기준 1,200자를 최소로 설정
  // ─────────────────────────────────────────────────────────────────────────
  // sections.body는 마크다운 기준 — 조립 HTML로는 약 2배 길어지므로 임계값 1,200자
  const bodyCharCount = fullBody.replace(/\s+/g, ' ').trim().length;
  if (bodyCharCount < 1200) {
    score -= 15;
    failed.push(`원칙13: 본문 분량 미달 (${bodyCharCount}자 / 최소 1,200자)`);
  }

  return {
    score: Math.max(0, score),
    failed,
    // 참고용 메타 정보
    meta: {
      bodyLength: bodyCharCount,
      numberCount: numberMatches.length,
      branchCount: totalBranches,
      extraSectionCount: extraSections.length,
      faqCount: faq.length,
      sourceCount: sources.length,
    },
  };
}

module.exports = { checkQualityV3 };
