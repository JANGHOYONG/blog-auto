/**
 * YouTube Shorts 자동 생성 스크립트 v5
 * - 슬라이드당 narration만 사용, 그대로 자막으로 표시
 * - 5슬라이드 × 10초 = 50초 이내
 * - 한국어 TTS: nova 음성
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const args = process.argv.slice(2);
const getArg = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : null;
};

const W = 1080;
const H = 1920;
const FONT = `'Noto Sans CJK KR','Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif`;

// ─── 1. GPT 스크립트 생성 ─────────────────────────────────────────────────────
async function generateShortsScript(post) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 유튜브 쇼츠 전문 작가입니다.
5060 시니어가 끝까지 보는 건강 쇼츠를 만듭니다.

규칙:
- slides: 정확히 5개
- 각 narration: 실제로 읽을 한국어 문장, 60~75자 (한 문장 또는 두 문장)
- imageQuery: Pexels에서 검색할 영어 단어 2~3개
- 자연스러운 한국어 구어체, 전문 의사가 설명하는 말투
- 첫 슬라이드는 반드시 충격적 사실이나 반전 질문으로 시작

슬라이드 구조:
1번: 훅 - 손가락 멈추게 하는 충격 사실
2번: 심화 - 왜 시니어에게 더 위험한지
3번: 해결법 1 - 가장 효과적인 방법
4번: 해결법 2 또는 반전 정보
5번: 마무리 - 핵심 요약 + 구독 유도`,
      },
      {
        role: 'user',
        content: `제목: ${post.title}
요약: ${post.excerpt}

위 건강 정보를 바탕으로 50초 쇼츠를 만들어주세요.

JSON:
{
  "youtubeTitle": "유튜브 제목 (40자 이내, 클릭 유발, #Shorts 포함)",
  "description": "시청자가 얻을 핵심 정보 1줄 (60~80자). 끝에 '전체 내용은 블로그에서 확인하세요 👇' 추가",
  "tags": ["건강", "5060건강", "시니어건강", "관련태그"],
  "slides": [
    { "narration": "첫 슬라이드 실제 대사 (60~75자)", "imageQuery": "worried senior health" },
    { "narration": "두 번째 슬라이드 대사 (60~75자)", "imageQuery": "elderly risk medical" },
    { "narration": "세 번째 슬라이드 대사 (60~75자)", "imageQuery": "healthy food treatment" },
    { "narration": "네 번째 슬라이드 대사 (60~75자)", "imageQuery": "health tip lifestyle" },
    { "narration": "다섯 번째 슬라이드 대사 (55~65자, 마무리)", "imageQuery": "happy senior healthy" }
  ]
}`,
      },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

// ─── 2. Pexels 이미지 다운로드 ────────────────────────────────────────────────
async function fetchPexelsPhoto(query, outPath) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY 없음');

  const searches = [
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&size=large&per_page=10`,
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`,
  ];

  for (const url of searches) {
    const res = await axios.get(url, { headers: { Authorization: key } });
    const photos = res.data.photos || [];
    if (!photos.length) continue;

    const photo = photos[Math.floor(Math.random() * Math.min(5, photos.length))];
    const imageUrl = photo.src.large2x || photo.src.large || photo.src.original;

    const writer = fs.createWriteStream(outPath);
    const response = await axios({ url: imageUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    return;
  }
  throw new Error(`이미지 없음: "${query}"`);
}

// ─── 3. 오버레이 HTML - narration을 그대로 자막으로 표시 ──────────────────────
function makeOverlayHtml(narration, slideIdx, totalSlides) {
  const progress = Math.round((slideIdx / totalSlides) * 100);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:${W}px; height:${H}px;
  background:transparent; overflow:hidden;
  font-family:${FONT};
}

/* 상단 브랜드 배지 */
.brand {
  position:absolute; top:50px; left:0; right:0;
  display:flex; justify-content:center;
}
.brand-inner {
  background:rgba(0,120,80,0.88);
  border-radius:60px; padding:18px 48px;
  display:flex; align-items:center; gap:16px;
}
.brand-icon { font-size:44px; line-height:1; }
.brand-text { font-size:40px; font-weight:800; color:#fff; letter-spacing:2px; }

/* 슬라이드 번호 */
.slide-num {
  position:absolute; top:160px; right:50px;
  background:rgba(0,0,0,0.50);
  border-radius:40px; padding:10px 28px;
  font-size:30px; font-weight:700;
  color:rgba(255,255,255,0.85);
}

/* 하단 자막 영역 */
.subtitle-area {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.90) 0%,
    rgba(0,0,0,0.78) 40%,
    rgba(0,0,0,0.30) 75%,
    transparent 100%
  );
  padding:50px 55px 115px;
  min-height:380px;
  display:flex; align-items:flex-end;
}

.subtitle-text {
  font-size:52px;
  font-weight:800;
  color:#ffffff;
  line-height:1.55;
  word-break:keep-all;
  text-shadow:
    0 2px 4px rgba(0,0,0,1),
    0 4px 16px rgba(0,0,0,0.9),
    0 0 40px rgba(0,0,0,0.7);
  letter-spacing:-0.5px;
}

/* 진행 바 */
.progress-track {
  position:absolute; bottom:0; left:0; right:0; height:10px;
  background:rgba(255,255,255,0.15);
}
.progress-fill {
  height:100%; width:${progress}%;
  background:linear-gradient(90deg, #1abc9c, #4fc3f7);
  border-radius:0 5px 5px 0;
}

/* 채널 URL */
.channel-url {
  position:absolute; bottom:18px; left:0; right:0;
  text-align:center;
  font-size:30px; font-weight:600;
  color:rgba(255,255,255,0.50);
}
</style>
</head>
<body>

<div class="brand">
  <div class="brand-inner">
    <span class="brand-icon">📚</span>
    <span class="brand-text">시니어 건강백과</span>
  </div>
</div>

<div class="slide-num">${slideIdx} / ${totalSlides}</div>

<div class="subtitle-area">
  <div class="subtitle-text">${narration.replace(/\n/g, '<br>')}</div>
</div>

<div class="progress-track">
  <div class="progress-fill"></div>
</div>
<div class="channel-url">smartinfoblog.co.kr</div>

</body>
</html>`;
}

// ─── 4. TTS 생성 (Google Cloud TTS - ko-KR-Standard-C) ───────────────────────
async function generateAudio(narration, outPath) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY 환경변수가 없습니다.');

  const res = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      input: { text: narration },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Standard-C' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.90 },
    }
  );
  const buf = Buffer.from(res.data.audioContent, 'base64');
  fs.writeFileSync(outPath, buf);
}

// ─── 5. 오디오 길이 측정 ─────────────────────────────────────────────────────
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, meta) => {
      if (err) reject(err);
      else resolve(parseFloat(meta.format.duration));
    });
  });
}

// ─── 6. 슬라이드 클립 합성 ────────────────────────────────────────────────────
function createSlideClip(imagePath, overlayPath, audioPath, duration, outPath) {
  return new Promise((resolve, reject) => {
    const d = (duration + 0.3).toFixed(2);
    ffmpeg()
      .input(imagePath).inputOptions(['-loop', '1', '-framerate', '25'])
      .input(audioPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
        `crop=${W}:${H},setsar=1[bg]`,
        `[bg][2:v]overlay=0:0:eof_action=repeat,` +
        `fade=t=in:st=0:d=0.2,` +
        `fade=t=out:st=${(parseFloat(d) - 0.3).toFixed(2)}:d=0.3[out]`,
      ])
      .outputOptions([
        '-map', '[out]',
        '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-t', d,
        '-movflags', '+faststart',
        '-af', `afade=t=in:st=0:d=0.15,afade=t=out:st=${(duration - 0.2).toFixed(2)}:d=0.2`,
      ])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ─── 7. 클립 이어붙이기 ──────────────────────────────────────────────────────
function concatClips(clipPaths, outPath) {
  return new Promise((resolve, reject) => {
    const listFile = outPath.replace('.mp4', '_list.txt');
    fs.writeFileSync(listFile, clipPaths.map((p) => `file '${p}'`).join('\n'));
    ffmpeg()
      .input(listFile).inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .output(outPath)
      .on('progress', (p) => process.stdout.write(`\r  합성 중: ${Math.round(p.percent || 0)}%`))
      .on('end', () => { console.log(''); fs.unlinkSync(listFile); resolve(); })
      .on('error', reject)
      .run();
  });
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 유튜브 쇼츠 v5 (narration 자막, 50초 이내) ===\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-'));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  try {
    const postId = getArg('post-id');
    const post = postId
      ? await prisma.post.findUnique({ where: { id: parseInt(postId) }, include: { category: true } })
      : await prisma.post.findFirst({
          where: { status: 'PUBLISHED', category: { slug: 'health' }, shortsGenerated: false },
          orderBy: { publishedAt: 'desc' },
          include: { category: true },
        });

    if (!post) { console.log('쇼츠를 만들 글이 없습니다.'); return; }
    console.log(`대상 글: "${post.title}"\n`);

    // 1. GPT 스크립트
    console.log('[1/3] 쇼츠 스크립트 생성...');
    const script = await generateShortsScript(post);
    const slides = (script.slides || []).slice(0, 5);
    console.log(`  제목: ${script.youtubeTitle}`);
    console.log(`  슬라이드: ${slides.length}개`);
    slides.forEach((s, i) => console.log(`    ${i + 1}. [${s.narration.length}자] ${s.narration.slice(0, 30)}...`));
    console.log('');

    // 2. 슬라이드별 처리
    console.log('[2/3] 클립 생성...\n');
    const clipPaths = [];
    let totalDuration = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      console.log(`  ── 슬라이드 ${i + 1}/${slides.length} ──`);

      // a) 이미지
      const imagePath = path.join(tmpDir, `image_${i}.jpg`);
      try {
        console.log(`     🖼️  "${slide.imageQuery}"`);
        await fetchPexelsPhoto(slide.imageQuery, imagePath);
      } catch {
        console.log(`     ⚠️ 재시도: "senior health"`);
        await fetchPexelsPhoto('senior health', imagePath);
      }

      // b) TTS - narration 그대로 읽기
      const audioPath = path.join(tmpDir, `audio_${i}.mp3`);
      await generateAudio(slide.narration, audioPath);
      const duration = await getAudioDuration(audioPath);
      totalDuration += duration + 0.3;
      console.log(`     🔊 ${slide.narration.length}자 → ${duration.toFixed(1)}초`);

      // c) 오버레이 - narration을 자막으로 표시
      const overlayPath = path.join(tmpDir, `overlay_${i}.png`);
      const html = makeOverlayHtml(slide.narration, i + 1, slides.length);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: overlayPath, omitBackground: true });

      // d) 클립 합성
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(2, '0')}.mp4`);
      await createSlideClip(imagePath, overlayPath, audioPath, duration, clipPath);
      clipPaths.push(clipPath);
      console.log(`     ✅ 완료\n`);
    }

    await browser.close();
    console.log(`총 ${slides.length}슬라이드 | 예상 길이: ${totalDuration.toFixed(0)}초\n`);

    // 3. 최종 합성
    console.log('[3/3] 최종 영상 합성...');
    const finalPath = path.join(tmpDir, 'shorts_final.mp4');
    await concatClips(clipPaths, finalPath);
    const sizeMB = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
    console.log(`  완성: ${sizeMB}MB\n`);

    // 4. 업로드 또는 저장
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    const fullDesc =
      `${script.description}\n\n` +
      `📖 전체 내용 + 실천 가이드 보기 👉 ${postUrl}\n\n` +
      `이 영상이 도움이 됐다면 구독 & 좋아요 눌러주세요! 💚\n` +
      `매일 새로운 5060 건강 정보를 쇼츠로 전해드립니다.\n\n` +
      `─────────────────────\n` +
      `${(script.tags || []).map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #Shorts #건강정보 #시니어건강 #5060건강`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      const { uploadToYouTube } = require('./youtube-uploader');
      const videoId = await uploadToYouTube({
        videoPath: finalPath,
        title: script.youtubeTitle,
        description: fullDesc,
        tags: [...(script.tags || []), '건강', '시니어', '건강정보', 'Shorts'],
        categoryId: '26',
      });
      await prisma.post.update({
        where: { id: post.id },
        data: { shortsGenerated: true, shortsVideoId: videoId },
      });
      console.log(`✅ 업로드 완료! https://youtube.com/shorts/${videoId}`);
    } else {
      const outDir = path.join(process.cwd(), 'shorts-output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      const savePath = path.join(outDir, `${post.slug}.mp4`);
      fs.copyFileSync(finalPath, savePath);
      await prisma.post.update({ where: { id: post.id }, data: { shortsGenerated: true } });
      console.log(`✅ 저장: ${savePath}`);
    }

  } catch (e) {
    console.error('\n오류:', e.message);
    if (process.env.DEBUG) console.error(e.stack);
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

main();
