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

    await prisma.automationLog.create({
      data: {
        type: 'KEYWORD_COLLECT',
        status: 'SUCCESS',
        message: `키워드 ${totalSaved}개 수집 완료 (GPT-4o-mini)`,
      },
    });

    console.log(`\n✅ 총 ${totalSaved}개 키워드 수집 완료`);
  } catch (e) {
    console.error('오류:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
