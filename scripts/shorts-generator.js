/**
 * YouTube Shorts 자동 생성 스크립트
 * 흐름: 블로그 글 → GPT 스크립트 → 슬라이드 이미지 → TTS 음성 → 영상 합성 → YouTube 업로드
 *
 * 실행: node scripts/shorts-generator.js
 * 옵션: --post-id=17  (특정 글 지정)
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const OpenAI = require('openai');
const { PrismaClient } = require('@prisma/client');
const ffmpeg = require('fluent-ffmpeg');
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

const SLIDE_W = 1080;
const SLIDE_H = 1920;
const SLIDE_DURATION = 6; // 슬라이드당 초

// ─── 1. GPT로 쇼츠 스크립트 생성 ─────────────────────────────────────────────
async function generateShortsScript(post) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 5060 시니어를 위한 건강 정보 유튜브 쇼츠 스크립트 전문가입니다.
60초 분량의 쇼츠를 만듭니다.
- 문장은 짧고 임팩트 있게 (슬라이드 하나 = 1~2문장)
- 50~60대가 읽기 쉬운 쉬운 말
- 첫 3초에 시청자를 붙잡는 강한 훅
- 끝까지 보고 싶게 만드는 구성`,
      },
      {
        role: 'user',
        content: `다음 블로그 글을 60초 유튜브 쇼츠로 만들어주세요.

제목: ${post.title}
요약: ${post.excerpt}

JSON으로 응답:
{
  "youtubeTitle": "유튜브 영상 제목 (50자 이내, 클릭 유도, #Shorts 포함)",
  "description": "영상 설명 (150자 내외, 핵심 내용 요약)",
  "tags": ["건강", "5060건강", "시니어건강", "관련태그1", "관련태그2"],
  "slides": [
    { "type": "hook",  "emoji": "❓", "text": "충격적인 질문이나 사실\\n(2줄 이내, 강한 훅)" },
    { "type": "point", "emoji": "✅", "text": "핵심 포인트 1\\n(짧고 임팩트 있게)" },
    { "type": "point", "emoji": "💡", "text": "핵심 포인트 2" },
    { "type": "point", "emoji": "🥗", "text": "핵심 포인트 3" },
    { "type": "point", "emoji": "⚠️", "text": "핵심 포인트 4" },
    { "type": "point", "emoji": "💊", "text": "핵심 포인트 5" },
    { "type": "cta",   "emoji": "👇", "text": "더 자세한 정보는\\n블로그 링크 확인!" }
  ],
  "narration": "60초 분량 내레이션 전체 텍스트. 자연스럽고 친근한 말투. 어려운 용어 없이."
}`,
      },
    ],
  });

  return JSON.parse(res.choices[0].message.content);
}

// ─── 2. 슬라이드 HTML 생성 ────────────────────────────────────────────────────
function makeSlideHtml(slide, idx, total) {
  const themes = {
    hook:  { grad: 'linear-gradient(160deg,#0d2137 0%,#1a4f8c 100%)', accent: '#64b5f6', label: '오늘의 건강 정보' },
    point: { grad: 'linear-gradient(160deg,#1b3a1f 0%,#2e7d32 100%)', accent: '#81c784', label: null },
    cta:   { grad: 'linear-gradient(160deg,#4a148c 0%,#7b1fa2 100%)', accent: '#ce93d8', label: null },
  };
  const t = themes[slide.type] || themes.point;
  const progress = Math.round((idx / total) * 100);
  const textHtml = slide.text.replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${SLIDE_W}px; height:${SLIDE_H}px; overflow:hidden;
  background:${t.grad}; font-family:'Noto Sans KR',sans-serif; color:#fff; }
.wrap { width:100%; height:100%; display:flex; flex-direction:column;
  justify-content:center; align-items:center; padding:100px 70px; position:relative; }
.brand { position:absolute; top:70px; left:0; right:0; text-align:center;
  font-size:40px; font-weight:700; color:${t.accent}; letter-spacing:3px; }
.label { font-size:42px; font-weight:700; color:${t.accent}; letter-spacing:5px;
  margin-bottom:40px; }
.emoji { font-size:180px; line-height:1; margin-bottom:60px; }
.text { font-size:76px; font-weight:900; text-align:center; line-height:1.45;
  word-break:keep-all; text-shadow:0 4px 24px rgba(0,0,0,0.4); }
.sub { margin-top:50px; font-size:54px; font-weight:700;
  color:${t.accent}; text-align:center; }
.progress { position:absolute; bottom:0; left:0; height:14px;
  width:${progress}%; background:${t.accent}; border-radius:0 7px 7px 0; }
.counter { position:absolute; bottom:28px; right:55px;
  font-size:38px; color:rgba(255,255,255,0.45); font-weight:700; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">🏥 스마트인포블로그</div>
  ${t.label ? `<div class="label">${t.label}</div>` : ''}
  <div class="emoji">${slide.emoji}</div>
  <div class="text">${textHtml}</div>
  ${slide.type === 'cta' ? '<div class="sub">구독 & 좋아요 👍</div>' : ''}
  <div class="counter">${idx}/${total}</div>
  <div class="progress"></div>
</div>
</body>
</html>`;
}

// ─── 3. Puppeteer로 슬라이드 스크린샷 ────────────────────────────────────────
async function captureSlides(slides, outDir) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 1 });

  const paths = [];
  for (let i = 0; i < slides.length; i++) {
    const html = makeSlideHtml(slides[i], i + 1, slides.length);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const p = path.join(outDir, `slide_${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: p });
    paths.push(p);
    console.log(`  슬라이드 ${i + 1}/${slides.length} 완료`);
  }

  await browser.close();
  return paths;
}

// ─── 4. OpenAI TTS 음성 생성 ─────────────────────────────────────────────────
async function generateAudio(narration, outPath) {
  const res = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',       // 자연스러운 여성 목소리 (한국어 지원)
    input: narration,
    speed: 0.93,         // 5060 세대를 위해 약간 느리게
  });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  console.log(`  음성 생성 완료 (${(buf.length / 1024).toFixed(0)}KB)`);
}

// ─── 5. FFmpeg으로 영상 합성 ──────────────────────────────────────────────────
function buildVideo(imgPaths, audioPath, outPath) {
  return new Promise((resolve, reject) => {
    // ffmpeg concat 파일 생성
    const concatFile = outPath.replace('.mp4', '_concat.txt');
    const lines = imgPaths.map((p) => `file '${p}'\nduration ${SLIDE_DURATION}`).join('\n');
    fs.writeFileSync(concatFile, lines + `\nfile '${imgPaths[imgPaths.length - 1]}'`);

    ffmpeg()
      .input(concatFile).inputOptions(['-f', 'concat', '-safe', '0'])
      .input(audioPath)
      .outputOptions([
        '-c:v libx264', '-preset fast', '-crf 23',
        '-c:a aac', '-b:a 128k',
        '-pix_fmt yuv420p',
        '-shortest',
        '-movflags +faststart',
        '-vf', `scale=${SLIDE_W}:${SLIDE_H}:force_original_aspect_ratio=decrease,` +
               `pad=${SLIDE_W}:${SLIDE_H}:(ow-iw)/2:(oh-ih)/2:black`,
      ])
      .output(outPath)
      .on('progress', (p) => process.stdout.write(`\r  영상 합성: ${Math.round(p.percent || 0)}%`))
      .on('end', () => {
        console.log('');
        fs.unlinkSync(concatFile);
        resolve();
      })
      .on('error', (err) => reject(err))
      .run();
  });
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 유튜브 쇼츠 자동 생성 시작 ===\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-'));

  try {
    // 대상 글 조회
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

    // 1. 스크립트 생성
    console.log('[1/4] 쇼츠 스크립트 생성...');
    const script = await generateShortsScript(post);
    console.log(`  영상 제목: ${script.youtubeTitle}`);
    console.log(`  슬라이드: ${script.slides.length}개`);

    // 2. 슬라이드 이미지 생성
    console.log('\n[2/4] 슬라이드 이미지 생성...');
    const imgPaths = await captureSlides(script.slides, tmpDir);

    // 3. 음성(TTS) 생성
    console.log('\n[3/4] TTS 음성 생성...');
    const audioPath = path.join(tmpDir, 'narration.mp3');
    await generateAudio(script.narration, audioPath);

    // 4. 영상 합성
    console.log('\n[4/4] 영상 합성 (FFmpeg)...');
    const videoPath = path.join(tmpDir, 'shorts.mp4');
    await buildVideo(imgPaths, audioPath, videoPath);

    const sizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
    console.log(`  영상 크기: ${sizeMB}MB`);

    // 5. YouTube 업로드 또는 파일 저장
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    const fullDesc = `${script.description}\n\n📖 자세한 내용: ${postUrl}\n\n` +
      `${script.tags.map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #Shorts #건강정보 #5060건강`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      console.log('\n[5/5] YouTube 업로드...');
      const { uploadToYouTube } = require('./youtube-uploader');
      const videoId = await uploadToYouTube({
        videoPath,
        title: script.youtubeTitle,
        description: fullDesc,
        tags: [...script.tags, '건강', '5060', '시니어', '건강정보', 'Shorts'],
        categoryId: '26',
      });

      await prisma.post.update({
        where: { id: post.id },
        data: { shortsGenerated: true, shortsVideoId: videoId },
      });

      console.log(`\n✅ 완료! https://youtube.com/shorts/${videoId}`);
    } else {
      // YouTube 설정 전 → 파일로 저장
      const outDir = path.join(process.cwd(), 'shorts-output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      const finalPath = path.join(outDir, `${post.slug}.mp4`);
      fs.copyFileSync(videoPath, finalPath);

      await prisma.post.update({
        where: { id: post.id },
        data: { shortsGenerated: true },
      });

      console.log(`\n✅ 영상 저장: ${finalPath}`);
      console.log('  → YouTube 업로드 설정 완료 후 자동 업로드됩니다.');
    }

  } catch (e) {
    console.error('\n오류:', e.message);
    if (process.env.DEBUG) console.error(e.stack);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

main();
