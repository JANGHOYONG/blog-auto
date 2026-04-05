/**
 * 키워드 수집 스크립트 (GPT-4o-mini)
 * 실행: node scripts/keyword-collector.js
 * 옵션: --category=tech --count=20
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
const targetCategory = getArg('category');
const targetCount = parseInt(getArg('count') || '20');

function parseJson(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                text.match(/(\{[\s\S]*\})/);
  if (!match) throw new Error('JSON 파싱 실패');
  return JSON.parse(match[1]);
}

// ─── 계절성 키워드 (현재 월 기준 자동 선택) ───────────────────────────────────
const SEASONAL_KEYWORDS = {
  spring: { // 3~5월
    label: '봄',
    keywords: [
      '춘곤증 극복 방법', '봄나물 효능 TOP10', '봄 황사 폐 건강 지키기',
      '봄철 환절기 면역력 높이는 법', '봄 알레르기 비염 대처법',
      '봄에 먹으면 좋은 제철 음식', '봄 피로 회복 음식',
      '꽃가루 알레르기 50대 대처법', '봄 나들이 시니어 건강 주의사항',
    ],
  },
  summer: { // 6~8월
    label: '여름',
    keywords: [
      '여름 열사병 예방법', '여름 냉방병 원인 증상', '무더위 고혈압 관리',
      '여름 수분 보충 방법', '여름철 장염 예방', '시니어 여름 더위 대처법',
      '여름 면역력 음식', '에어컨 관절통 해결법', '열대야 수면 방법',
    ],
  },
  autumn: { // 9~11월
    label: '가을',
    keywords: [
      '가을 환절기 감기 예방', '추석 음식 혈당 관리', '가을 우울증 극복법',
      '가을 운동 시작하는 법', '늦가을 면역력 관리', '10월 건강검진 항목',
      '가을 제철 음식 효능', '기온차 관절통 대처법', '가을 피부 건강 관리',
    ],
  },
  winter: { // 12~2월
    label: '겨울',
    keywords: [
      '겨울 뇌졸중 예방법', '한파 고혈압 위험', '겨울 관절 통증 원인',
      '겨울철 실내 운동 방법', '연말 과음 간 건강 회복', '설날 음식 혈당 관리',
      '겨울 비타민D 부족 증상', '한겨울 낙상 예방 시니어', '면역력 높이는 겨울 음식',
    ],
  },
};

function getCurrentSeason() {
  const month = new Date().getMonth() + 1; // 1~12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 건강 7대 주제 (네비게이션과 동일 순서)
const HEALTH_SUBTOPICS = [
  { id: 'blood_sugar',    label: '혈당·당뇨',   guide: '혈당, 당뇨병, 인슐린 저항성, 공복혈당, 혈당 관리, 당뇨 식단, 혈당 낮추는 방법 등' },
  { id: 'blood_pressure', label: '혈압·심장',   guide: '고혈압, 심장건강, 콜레스테롤, 심혈관, 동맥경화, 부정맥, 심근경색 예방 등' },
  { id: 'joint',          label: '관절·근육',   guide: '무릎관절, 연골, 허리통증, 척추, 근육감소, 골다공증, 어깨통증, 류마티스 등' },
  { id: 'sleep',          label: '수면·피로',   guide: '불면증, 수면장애, 만성피로, 멜라토닌, 수면의 질, 졸음, 피로 해소법 등' },
  { id: 'brain',          label: '뇌건강·치매', guide: '치매 예방, 알츠하이머, 기억력 저하, 뇌 건강, 파킨슨, 뇌졸중 예방, 인지 기능 등' },
  { id: 'menopause',      label: '갱년기',      guide: '갱년기 증상, 폐경, 호르몬 변화, 안면홍조, 골밀도, 남성갱년기, 에스트로겐 등' },
  { id: 'nutrition',      label: '영양·식이',   guide: '영양제, 비타민, 단백질 섭취, 식단 관리, 건강식품, 오메가3, 보충제, 노년 영양 등' },
];

async function collectKeywordsForSubtopic(categoryName, subtopic, count) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.8,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '당신은 한국 검색 SEO 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
      },
      {
        role: 'user',
        content: `5060 시니어 건강 블로그의 [${subtopic.label}] 주제로 한국어 롱테일 키워드 ${count}개를 추천해주세요.

주제 범위: ${subtopic.guide}

조건:
- 월 검색량 1,000~50,000 수준 (경쟁 낮고 클릭 높은 것)
- 정보성 검색 의도 (방법, 원인, 효능, 비교, 추천, 증상 등)
- 50~60대가 실제 네이버·구글에서 검색하는 자연스러운 표현
- 다양한 각도로 (식품, 생활습관, 운동, 증상, 치료법, 예방법 등)
- 예시: "${subtopic.label === '혈당·당뇨' ? '50대 공복혈당 낮추는 식단, 당뇨 초기 증상 자가진단, 혈당 낮추는 음식 TOP10' : subtopic.label === '관절·근육' ? '무릎 연골 재생 방법, 50대 근감소증 예방 운동, 관절염에 좋은 음식' : '관련 롱테일 키워드 예시'}"

JSON 형식:
{
  "keywords": [
    { "keyword": "롱테일 키워드", "priority": 1, "estimatedVolume": 5000 }
  ]
}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

async function collectKeywords(categoryName, count) {
  // 비건강 카테고리는 기존 방식 사용
  if (!categoryName.includes('건강') && categoryName.toLowerCase() !== 'health') {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '당신은 한국 검색 SEO 전문가입니다. 반드시 JSON 형식으로만 응답하세요.' },
        {
          role: 'user',
          content: `"${categoryName}" 카테고리의 한국어 롱테일 키워드 ${count}개를 추천해주세요.
조건: 월 검색량 1,000~50,000, 정보성 검색 의도, 자연스러운 표현
JSON: { "keywords": [{ "keyword": "키워드", "priority": 1, "estimatedVolume": 5000 }] }`,
        },
      ],
    });
    return JSON.parse(response.choices[0].message.content);
  }

  // 건강 카테고리: 7개 주제별 균등 수집
  const perTopic = Math.ceil(count / HEALTH_SUBTOPICS.length);
  const allKeywords = [];

  for (const subtopic of HEALTH_SUBTOPICS) {
    console.log(`    [${subtopic.label}] 키워드 ${perTopic}개 수집...`);
    try {
      const { keywords } = await collectKeywordsForSubtopic(categoryName, subtopic, perTopic);
      allKeywords.push(...keywords);
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`    [${subtopic.label}] 실패: ${e.message}`);
    }
  }

  return { keywords: allKeywords };
}

// ─── 계절성 키워드 DB 저장 ──────────────────────────────────────────────────────
async function saveSeasonalKeywords(healthCategoryId) {
  const season = getCurrentSeason();
  const seasonal = SEASONAL_KEYWORDS[season];
  console.log(`\n🌸 계절성 키워드 주입 [${seasonal.label}] — ${seasonal.keywords.length}개`);

  let saved = 0;
  for (const keyword of seasonal.keywords) {
    try {
      await prisma.keyword.upsert({
        where: { keyword },
        update: { priority: 1 }, // 계절성은 최우선 순위
        create: {
          keyword,
          categoryId: healthCategoryId,
          priority: 1,
          searchVolume: 5000,
          competition: 0.2,
          used: false,
        },
      });
      saved++;
    } catch (e) {
      // 중복 등 무시
    }
  }
  console.log(`  ✅ ${saved}개 저장 완료`);
}

async function main() {
  console.log('=== 키워드 수집 시작 (GPT-4o-mini) ===');

  try {
    const categories = await prisma.category.findMany();
    const targets = targetCategory
      ? categories.filter((c) => c.slug === targetCategory)
      : categories;

    let totalSaved = 0;

    for (const cat of targets) {
      console.log(`\n[${cat.name}] 키워드 ${targetCount}개 수집 중...`);

      try {
        const { keywords } = await collectKeywords(cat.name, targetCount);
        let saved = 0;

        for (const kw of keywords) {
          try {
            await prisma.keyword.upsert({
              where: { keyword: kw.keyword },
              update: { priority: kw.priority },
              create: {
                keyword: kw.keyword,
                categoryId: cat.id,
                priority: kw.priority || 3,
                searchVolume: kw.estimatedVolume || null,
                competition: Math.random() * 0.4,
                used: false,
              },
            });
            saved++;
          } catch (_) {}
        }

        totalSaved += saved;
        console.log(`  ✓ ${saved}개 저장`);
      } catch (e) {
        console.error(`  ✗ ${cat.name} 실패: ${e.message}`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    // 계절성 키워드 주입 (health 카테고리에만)
    const healthCat = categories.find((c) => c.slug === 'health');
    if (healthCat) {
      await saveSeasonalKeywords(healthCat.id);
    }

    await prisma.automationLog.create({
      data: {
        type: 'KEYWORD_COLLECT',
        status: 'SUCCESS',
        message: `키워드 ${totalSaved}개 수집 완료 (GPT-4o-mini, 계절성 포함)`,
      },
    });

    console.log(`\n✅ 총 ${totalSaved}개 키워드 수집 완료 (계절성 포함)`);
  } catch (e) {
    console.error('오류:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
