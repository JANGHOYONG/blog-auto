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

// 건강 7대 주제 (health 카테고리)
const HEALTH_SUBTOPICS = [
  { id: 'blood_sugar',    label: '혈당·당뇨',   guide: '혈당, 당뇨병, 인슐린 저항성, 공복혈당, 혈당 관리, 당뇨 식단, 혈당 낮추는 방법 등' },
  { id: 'blood_pressure', label: '혈압·심장',   guide: '고혈압, 심장건강, 콜레스테롤, 심혈관, 동맥경화, 부정맥, 심근경색 예방 등' },
  { id: 'joint',          label: '관절·근육',   guide: '무릎관절, 연골, 허리통증, 척추, 근육감소, 골다공증, 어깨통증, 류마티스 등' },
  { id: 'sleep',          label: '수면·피로',   guide: '불면증, 수면장애, 만성피로, 멜라토닌, 수면의 질, 졸음, 피로 해소법 등' },
  { id: 'brain',          label: '뇌건강·치매', guide: '치매 예방, 알츠하이머, 기억력 저하, 뇌 건강, 파킨슨, 뇌졸중 예방, 인지 기능 등' },
  { id: 'menopause',      label: '갱년기',      guide: '갱년기 증상, 폐경, 호르몬 변화, 안면홍조, 골밀도, 남성갱년기, 에스트로겐 등' },
  { id: 'nutrition',      label: '영양·식이',   guide: '영양제, 비타민, 단백질 섭취, 식단 관리, 건강식품, 오메가3, 보충제, 노년 영양 등' },
];

// 건강지식 8개 주제 (knowledge 카테고리)
const KNOWLEDGE_SUBTOPICS = [
  { id: 'immunity',  label: '면역력·감염',       guide: '면역력 강화, 감기·독감 예방, 자가면역질환, 바이러스 감염, 항체, 백신, 코로나 후유증 등' },
  { id: 'digestion', label: '소화·장건강',       guide: '위염, 역류성식도염, 장내세균, 프로바이오틱스, 변비, 과민성대장증후군, 위산, 헬리코박터 등' },
  { id: 'eye',       label: '눈건강·시력',       guide: '노안, 황반변성, 백내장, 안구건조증, 녹내장, 망막 질환, 루테인, 눈 피로 등' },
  { id: 'skin',      label: '피부·노화',         guide: '피부 노화, 주름, 검버섯, 피부탄력, 콜라겐, 자외선 차단, 피부과 시술, 피부 건강 등' },
  { id: 'oral',      label: '구강·치아',         guide: '잇몸 질환, 치주염, 임플란트, 틀니, 구강 건강, 구취, 치석, 구강건조증 등' },
  { id: 'liver',     label: '간·해독',           guide: '지방간, 간수치, 간 건강, 간염, 간경화, 알코올성 간질환, 간 기능 검사 등' },
  { id: 'lung',      label: '폐·호흡기',         guide: '폐 건강, COPD, 기관지염, 폐암 예방, 천식, 폐 기능 검사, 호흡기 질환 등' },
  { id: 'mental',    label: '정신건강·스트레스', guide: '노년 우울증, 불안장애, 스트레스 관리, 정신건강, 공황장애, 수면과 정신건강, 치매와 우울증 등' },
];

async function collectKeywordsForSubtopic(categoryName, subtopic, count) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.85,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '당신은 한국 네이버·구글 검색 SEO 전문가입니다. 경쟁이 낮은 틈새 롱테일 키워드만 발굴합니다. 반드시 JSON 형식으로만 응답하세요.',
      },
      {
        role: 'user',
        content: `5060 시니어 건강 블로그의 [${subtopic.label}] 주제로 검색의도가 명확한 발견형 키워드 ${count}개를 생성해주세요.

주제 범위: ${subtopic.guide}

━━━ 핵심 철학: 키워드 = 하나의 구체적 발견/주장 ━━━
키워드 자체가 "이걸 왜 몰랐지?" 라는 반응을 유발해야 합니다.
키워드를 보는 순간 독자가 클릭하지 않고는 못 배길 만큼 구체적이어야 합니다.

✅ 반드시 이 4가지 패턴을 골고루 섞어 생성:

[패턴 1 — 반전형] 사람들이 믿는 것과 반대되는 사실
예시:
- "무릎 연골 닳아도 통증 없는 사람이 먹지 않는 음식"
- "혈압약 매일 먹는데 혈압이 안 잡히는 진짜 이유"
- "당뇨약 복용 중인데 혈당 더 오르는 사람의 공통점"
- "잠을 9시간 자도 피곤한 60대가 놓친 것"

[패턴 2 — 메커니즘형] 몸 안에서 일어나는 구체적 원리
예시:
- "밥보다 채소 먼저 먹으면 혈당이 낮아지는 생물학적 이유"
- "50대 이후 근육이 급격히 빠지는 진짜 원인과 속도"
- "갱년기 여성이 잠을 못 자는 것이 에스트로겐 때문만이 아닌 이유"
- "치매가 오기 10년 전부터 나타나는 뇌의 변화"

[패턴 3 — 비교/차이형] 같은 상황에서 결과가 다른 이유
예시:
- "콜레스테롤 수치 같아도 심근경색 확률이 다른 사람들의 차이"
- "같은 식단인데 혈당이 급등하는 사람과 안정적인 사람의 차이"
- "골다공증 진단 받아도 골절이 없는 사람과 있는 사람의 차이"

[패턴 4 — 구체적 수치/시간형] 검색자가 바로 확인하고 싶은 구체적 정보
예시:
- "공복혈당 100~125 당뇨전단계 정상으로 되돌린 사람들이 한 것"
- "수축기 혈압 150 이상에서 130대로 낮춘 기간과 방법"
- "하루 30분 걷기로 혈당이 실제로 얼마나 낮아지나"

❌ 절대 금지:
- 2어절 이하의 단순 키워드 ("혈당 관리", "고혈압 예방")
- 뻔한 정보형 ("균형 잡힌 식단", "꾸준한 운동")
- 너무 광범위한 질문 ("당뇨란 무엇인가", "혈압이 높으면")
- 현재 연도/날짜 포함 키워드

JSON 형식:
{
  "keywords": [
    { "keyword": "밥보다 채소 먼저 먹으면 혈당이 낮아지는 생물학적 이유", "pattern": "메커니즘형", "priority": 1, "estimatedVolume": 1500 }
  ]
}`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

async function collectKeywords(categoryName, count) {
  // 건강지식 카테고리: 8개 주제별 균등 수집
  if (categoryName === '건강지식' || categoryName.toLowerCase() === 'knowledge') {
    const perTopic = Math.ceil(count / KNOWLEDGE_SUBTOPICS.length);
    const allKeywords = [];
    for (const subtopic of KNOWLEDGE_SUBTOPICS) {
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
조건: 월 검색량 500~5,000, 최소 3어절 이상, 정보성·증상·비교 형식
JSON: { "keywords": [{ "keyword": "키워드", "priority": 1, "estimatedVolume": 2000 }] }`,
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
