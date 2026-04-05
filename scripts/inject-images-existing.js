/**
 * 기존 발행된 글에 Pexels 이미지 주입 (썸네일 + 본문 이미지)
 * 실행: node scripts/inject-images-existing.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Pexels 이미지 ────────────────────────────────────────────────────────────
async function fetchPexelsImage(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY 없음');
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=10`,
    { headers: { Authorization: key } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos || !data.photos.length) return null;
  const pool = data.photos.slice(0, 5);
  const photo = pool[Math.floor(Math.random() * pool.length)];
  return {
    url: photo.src.large,
    alt: photo.alt || query,
    credit: `Photo by ${photo.photographer} on Pexels`,
    creditUrl: photo.photographer_url,
  };
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

  // </section> 기준 2번째, 4번째, 6번째 뒤에 삽입 (3장)
  const sectionCount = (content.match(/<\/section>/g) || []).length;
  if (sectionCount >= 2) {
    let count = 0, imgIdx = 0;
    return content.replace(/<\/section>/g, (match) => {
      count++;
      if ((count === 2 || count === 4 || count === 6) && imgIdx < images.length) {
        return match + makeImgHtml(images[imgIdx++]);
      }
      return match;
    });
  }

  // </h2> 기준 2번째, 4번째, 6번째
  const h2Count = (content.match(/<\/h2>/g) || []).length;
  if (h2Count >= 2) {
    let count = 0, imgIdx = 0;
    return content.replace(/<\/h2>/g, (match) => {
      count++;
      if ((count === 2 || count === 4 || count === 6) && imgIdx < images.length) {
        return match + makeImgHtml(images[imgIdx++]);
      }
      return match;
    });
  }

  // 글 1/3, 2/3, 끝 부분 강제 삽입
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

// 제목에서 영어 검색어 추출 (간단 변환)
function titleToSearchQuery(title) {
  const map = {
    '무릎': 'knee joint health',
    '혈압': 'blood pressure health',
    '혈당': 'blood sugar diabetes',
    '당뇨': 'diabetes management food',
    '관절': 'joint pain relief',
    '수면': 'sleep health elderly',
    '치매': 'brain health dementia prevention',
    '갱년기': 'menopause health women',
    '영양': 'senior nutrition healthy food',
    '심장': 'heart health cardio',
    '콜레스테롤': 'cholesterol healthy food',
    '근육': 'muscle health elderly exercise',
    '허리': 'back pain relief',
    '피로': 'fatigue recovery health',
    '면역': 'immune system health',
    '음식': 'healthy food senior',
    '생활습관': 'healthy lifestyle senior',
    '운동': 'exercise senior health',
  };
  for (const [ko, en] of Object.entries(map)) {
    if (title.includes(ko)) return en;
  }
  return 'senior health wellness';
}

async function main() {
  console.log('=== 기존 글 이미지 주입 시작 ===\n');

  // 발행된 글 전체 조회 (썸네일 유무 무관)
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  });

  console.log(`대상 글: ${posts.length}개\n`);

  for (const post of posts) {
    console.log(`처리 중: "${post.title}"`);
    try {
      const query = titleToSearchQuery(post.title);
      console.log(`  검색어: "${query}"`);

      // 썸네일
      const thumbImg = await fetchPexelsImage(query);
      const thumbnail = thumbImg ? thumbImg.url : null;
      console.log(`  썸네일: ${thumbnail ? '✅' : '❌'}`);

      // 본문 이미지 3장 (각기 다른 쿼리로)
      const bodyImg1 = await fetchPexelsImage(query + ' medical');
      await new Promise((r) => setTimeout(r, 300));
      const bodyImg2 = await fetchPexelsImage('healthy senior lifestyle');
      await new Promise((r) => setTimeout(r, 300));
      const bodyImg3 = await fetchPexelsImage(query + ' food nutrition');
      await new Promise((r) => setTimeout(r, 300));

      const bodyImgs = [bodyImg1, bodyImg2, bodyImg3].filter(Boolean);
      let content = post.content;
      if (bodyImgs.length) {
        content = injectBodyImages(content, bodyImgs);
        console.log(`  본문 이미지: ${bodyImgs.length}장 주입`);
      }

      await prisma.post.update({
        where: { id: post.id },
        data: { thumbnail, content },
      });

      console.log(`  ✅ 완료\n`);
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.error(`  ❌ 실패: ${e.message}\n`);
    }
  }

  // 캐시 갱신
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
  const secret = process.env.REVALIDATE_SECRET || 'blog-revalidate';
  try {
    await fetch(`${siteUrl}/api/revalidate?secret=${secret}`, { method: 'POST' });
    console.log('🔄 캐시 갱신 완료');
  } catch (_) {}

  console.log('\n✅ 전체 완료');
  await prisma.$disconnect();
}

main().catch(console.error);
