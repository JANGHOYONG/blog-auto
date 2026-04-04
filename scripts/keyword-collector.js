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

async function collectKeywords(categoryName, count) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '당신은 한국 검색 SEO 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
      },
      {
        role: 'user',
        content: `"${categoryName}" 카테고리${categoryName.includes('건강') || categoryName.toLowerCase() === 'health' ? ' (주요 독자: 50~60대 중장년층)' : ''}의 한국어 롱테일 키워드 ${count}개를 추천해주세요.

조건:
- 월 검색량 1,000~50,000 수준 (경쟁 낮고 클릭 높은 것)
- 정보성 검색 의도 (방법, 원인, 효능, 비교, 추천 등)
- 실제 한국인이 네이버·구글에서 자주 검색하는 자연스러운 표현
${categoryName.includes('건강') || categoryName.toLowerCase() === 'health' ? `- 5060 중장년 건강 주제 중심으로: 혈당·혈압·콜레스테롤·관절·수면·갱년기·치매예방·영양제·심혈관·소화·근감소·눈건강·구강건강·피부노화·면역력 등
- 예시: "50대 혈압 낮추는 생활습관", "무릎 연골 재생에 좋은 음식", "갱년기 수면장애 해결법", "치매 예방에 좋은 음식 10가지"` : `- 예시: "혈당 낮추는 음식 10가지", "무릎 통증 원인과 치료법"`}

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
