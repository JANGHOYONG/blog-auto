/**
 * 기존 게시물의 이미지를 교체하는 스크립트
 * 한국어 키워드로 검색해서 엉뚱한 이미지가 들어간 게시물 수정
 * 실행: node scripts/fix-images.js
 * 옵션: --ids=10,13,14,16  (특정 게시물 ID만 처리)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : null;
};
const idsArg = getArg('ids');
const targetIds = idsArg ? idsArg.split(',').map(Number) : null;

async function fetchUnsplashImage(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.error('UNSPLASH_ACCESS_KEY 환경변수가 없습니다.');
    return null;
  }
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${key}`
    );
    if (!res.ok) {
      console.error(`Unsplash API 오류: ${res.status} for "${query}"`);
      return null;
    }
    const data = await res.json();
    return {
      url: data.urls.regular,
      alt: data.alt_description || query,
      credit: `Photo by ${data.user.name} on Unsplash`,
      creditUrl: `${data.user.links.html}?utm_source=smartinfoblog&utm_medium=referral`,
    };
  } catch (e) {
    console.error(`Unsplash 요청 실패: ${e.message}`);
    return null;
  }
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

function removeExistingFigures(content) {
  // 기존에 삽입된 <figure> 태그 모두 제거
  return content.replace(/<figure[\s\S]*?<\/figure>/gi, '');
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

  // 2순위: </h2> 기준 2번째, 4번째 뒤에 삽입
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

  // 3순위: 글 중간 삽입
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

// 제목에서 Unsplash 영어 검색어 추출 (OpenAI 없이 간단한 매핑)
function guessEnglishQuery(title, categorySlug) {
  const categoryDefaults = {
    health: 'healthy lifestyle wellness',
    tech: 'technology digital innovation',
    economy: 'finance investment money',
    lifestyle: 'lifestyle home living',
    travel: 'travel destination adventure',
  };

  const titleLower = title.toLowerCase();

  // 키워드 기반 매핑
  const mappings = [
    { ko: ['혈당', '당뇨', '혈당 관리'], en: 'blood sugar healthy food diabetes' },
    { ko: ['유튜브', '유튜버', '수익 창출', '유튜브 수익'], en: 'youtube creator video content' },
    { ko: ['면역', '면역력'], en: 'immune system healthy food nutrition' },
    { ko: ['비타민', 'vitamin'], en: 'vitamins supplements nutrition health' },
    { ko: ['다이어트', '체중'], en: 'diet weight loss healthy eating' },
    { ko: ['운동', '헬스'], en: 'exercise fitness workout gym' },
    { ko: ['수면', '불면', '잠'], en: 'sleep rest bedroom relaxation' },
    { ko: ['피부', '스킨케어'], en: 'skincare beauty routine face' },
    { ko: ['주식', '투자'], en: 'stock market investment finance' },
    { ko: ['부동산', '아파트'], en: 'real estate property investment' },
    { ko: ['절세', '세금', '세테크'], en: 'tax savings financial planning' },
    { ko: ['재테크', '재무'], en: 'personal finance money management' },
    { ko: ['ai', 'AI', '인공지능'], en: 'artificial intelligence technology AI' },
    { ko: ['스마트폰', '휴대폰', '폰'], en: 'smartphone mobile technology' },
    { ko: ['노트북', '컴퓨터', '맥북'], en: 'laptop computer workspace tech' },
    { ko: ['여행', '해외여행'], en: 'travel destination vacation' },
    { ko: ['카페', '커피'], en: 'coffee cafe interior' },
    { ko: ['요리', '음식', '식단', '먹거리'], en: 'food cooking healthy meal' },
    { ko: ['청소', '정리', '수납'], en: 'home organization cleaning interior' },
    { ko: ['독서', '책', '공부'], en: 'reading books study learning' },
  ];

  for (const { ko, en } of mappings) {
    if (ko.some((k) => title.includes(k))) return en;
  }

  return categoryDefaults[categorySlug] || 'lifestyle blog content';
}

async function main() {
  console.log('=== 이미지 교체 시작 ===\n');

  try {
    const where = targetIds
      ? { id: { in: targetIds } }
      : { status: { in: ['PUBLISHED', 'DRAFT'] } };

    const posts = await prisma.post.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!posts.length) {
      console.log('처리할 게시물이 없습니다.');
      return;
    }

    console.log(`처리 대상: ${posts.length}개\n`);

    for (const post of posts) {
      console.log(`[ID:${post.id}] "${post.title}"`);

      const englishQuery = guessEnglishQuery(post.title, post.category?.slug || 'lifestyle');
      console.log(`  검색어: "${englishQuery}"`);

      // 썸네일 교체
      const thumbImg = await fetchUnsplashImage(englishQuery);
      await new Promise((r) => setTimeout(r, 400));

      // 본문 이미지 교체: 기존 figure 제거 후 새 이미지 삽입
      const cleanContent = removeExistingFigures(post.content);

      // 본문용 다른 검색어 (썸네일과 다른 각도)
      const bodyQuery1 = englishQuery + ' detail';
      const bodyQuery2 = englishQuery + ' background';
      const bodyImg1 = await fetchUnsplashImage(bodyQuery1);
      await new Promise((r) => setTimeout(r, 400));
      const bodyImg2 = await fetchUnsplashImage(bodyQuery2);
      await new Promise((r) => setTimeout(r, 400));

      const bodyImages = [bodyImg1, bodyImg2].filter(Boolean);
      const newContent = bodyImages.length
        ? injectBodyImages(cleanContent, bodyImages)
        : cleanContent;

      await prisma.post.update({
        where: { id: post.id },
        data: {
          thumbnail: thumbImg ? thumbImg.url : post.thumbnail,
          content: newContent,
        },
      });

      console.log(`  ✅ 썸네일: ${thumbImg ? '교체 완료' : '실패(기존 유지)'} | 본문 이미지: ${bodyImages.length}개\n`);
    }

    console.log('✅ 이미지 교체 완료');
  } catch (e) {
    console.error('오류:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
