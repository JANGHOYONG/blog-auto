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
        content: `당신은 5060 시니어를 위한 건강 유튜브 쇼츠 전문 PD입니다.
시청자가 끝까지 보게 만드는 60초 쇼츠를 설계합니다.

핵심 원칙:
- 슬라이드 하나 = 딱 한 가지 정보 (짧고 강렬하게)
- 첫 슬라이드에서 시청자의 "나 이거 꼭 알아야 해!" 반응 유도
- 충격적 통계, 반전 정보, 공감 질문 활용
- 50~60대 눈높이: 어려운 의학 용어 절대 금지, 일상 언어로
- 각 포인트는 생활에서 바로 쓸 수 있는 실천 정보`,
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
    { "type": "hook",  "emoji": "적절한 이모지", "text": "50~60대 시청자가 멈추게 만드는 강한 훅\\n(충격 통계 or 반전 질문, 최대 15자×2줄)" },
    { "type": "point", "emoji": "적절한 이모지", "text": "핵심 포인트 1\\n(바로 실천 가능, 최대 14자×2줄)" },
    { "type": "point", "emoji": "적절한 이모지", "text": "핵심 포인트 2\\n(구체적 수치나 방법, 최대 14자×2줄)" },
    { "type": "point", "emoji": "적절한 이모지", "text": "핵심 포인트 3\\n(최대 14자×2줄)" },
    { "type": "point", "emoji": "적절한 이모지", "text": "핵심 포인트 4\\n(최대 14자×2줄)" },
    { "type": "point", "emoji": "적절한 이모지", "text": "핵심 포인트 5\\n(최대 14자×2줄)" },
    { "type": "cta",   "emoji": "👇", "text": "자세한 내용은\\n블로그에서 확인!" }
  ],
  "narration": "60초 내레이션. 친근하고 따뜻한 할머니 선생님 말투. 각 슬라이드 내용을 자연스럽게 연결. 어려운 용어 없이 쉽게."
}`,
      },
    ],
  });

  return JSON.parse(res.choices[0].message.content);
}

// ─── 2. 슬라이드 HTML 생성 ────────────────────────────────────────────────────
function makeSlideHtml(slide, idx, total) {
  const progress = Math.round((idx / total) * 100);
  const textHtml = slide.text.replace(/\n/g, '<br>');
  const pointNum = idx; // 포인트 번호

  const FONT = `'Noto Sans CJK KR','Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif`;

  // ── HOOK 슬라이드 ──
  if (slide.type === 'hook') {
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${SLIDE_W}px; height:${SLIDE_H}px; overflow:hidden;
  background:#0a0a0a; font-family:${FONT}; color:#fff; }
.bg { position:absolute; inset:0;
  background: radial-gradient(ellipse at 50% 30%, #1a3a5c 0%, #0a0a0a 70%); }
.top-bar { position:absolute; top:0; left:0; right:0; height:10px;
  background:linear-gradient(90deg,#00c9ff,#92fe9d); }
.brand { position:absolute; top:60px; left:0; right:0; text-align:center;
  font-size:46px; font-weight:700; color:#00c9ff; letter-spacing:2px; }
.badge { position:absolute; top:150px; left:0; right:0; text-align:center; }
.badge span { background:#00c9ff; color:#000; font-size:40px; font-weight:900;
  padding:10px 40px; border-radius:50px; letter-spacing:4px; }
.center { position:absolute; inset:0; display:flex; flex-direction:column;
  justify-content:center; align-items:center; padding:60px; }
.emoji { font-size:260px; line-height:1; margin-bottom:50px; }
.text { font-size:108px; font-weight:900; text-align:center; line-height:1.35;
  word-break:keep-all; letter-spacing:-2px;
  text-shadow: 0 0 40px rgba(0,201,255,0.4); }
.text em { color:#92fe9d; font-style:normal; }
.bottom { position:absolute; bottom:80px; left:0; right:0; text-align:center;
  font-size:48px; color:rgba(255,255,255,0.5); }
.progress { position:absolute; bottom:0; left:0; height:12px; width:${progress}%;
  background:linear-gradient(90deg,#00c9ff,#92fe9d); }
</style></head><body>
<div class="bg"></div>
<div class="top-bar"></div>
<div class="brand">🏥 5060 건강주치의</div>
<div class="badge"><span>오늘의 건강 정보</span></div>
<div class="center">
  <div class="emoji">${slide.emoji}</div>
  <div class="text">${textHtml}</div>
</div>
<div class="bottom">끝까지 보면 건강이 달라집니다 👇</div>
<div class="progress"></div>
</body></html>`;
  }

  // ── POINT 슬라이드 ──
  if (slide.type === 'point') {
    const colors = [
      { bg: '#0d1b2a', accent: '#4fc3f7', num: '#4fc3f7' },
      { bg: '#0d2018', accent: '#69f0ae', num: '#69f0ae' },
      { bg: '#1a0d2e', accent: '#ea80fc', num: '#ea80fc' },
      { bg: '#1a1a0d', accent: '#ffeb3b', num: '#ffeb3b' },
      { bg: '#1a0d0d', accent: '#ff8a65', num: '#ff8a65' },
    ];
    const c = colors[(pointNum - 1) % colors.length];

    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${SLIDE_W}px; height:${SLIDE_H}px; overflow:hidden;
  background:${c.bg}; font-family:${FONT}; color:#fff; }
.side-line { position:absolute; left:0; top:0; bottom:0; width:16px;
  background:${c.accent}; }
.brand { position:absolute; top:65px; left:50px; right:50px;
  font-size:44px; font-weight:700; color:${c.accent}; }
.num-badge { position:absolute; top:55px; right:60px;
  width:110px; height:110px; border-radius:50%;
  background:${c.accent}; display:flex; align-items:center; justify-content:center; }
.num-badge span { font-size:70px; font-weight:900; color:#000; line-height:1; }
.divider { position:absolute; top:200px; left:50px; right:50px;
  height:3px; background:rgba(255,255,255,0.1); }
.center { position:absolute; inset:0; display:flex; flex-direction:column;
  justify-content:center; align-items:center; padding:80px 70px; }
.emoji { font-size:220px; line-height:1; margin-bottom:55px;
  filter: drop-shadow(0 8px 24px rgba(0,0,0,0.5)); }
.text { font-size:100px; font-weight:900; text-align:center; line-height:1.4;
  word-break:keep-all; letter-spacing:-2px; }
.text em { color:${c.accent}; font-style:normal; background:rgba(255,255,255,0.08);
  padding:0 8px; border-radius:8px; }
.progress-wrap { position:absolute; bottom:0; left:0; right:0; height:16px;
  background:rgba(255,255,255,0.08); }
.progress { height:100%; width:${progress}%; background:${c.accent};
  border-radius:0 8px 8px 0; }
.counter { position:absolute; bottom:28px; right:55px;
  font-size:40px; color:rgba(255,255,255,0.35); font-weight:700; }
</style></head><body>
<div class="side-line"></div>
<div class="brand">🏥 5060 건강주치의</div>
<div class="num-badge"><span>${pointNum}</span></div>
<div class="divider"></div>
<div class="center">
  <div class="emoji">${slide.emoji}</div>
  <div class="text">${textHtml}</div>
</div>
<div class="counter">${idx}/${total}</div>
<div class="progress-wrap"><div class="progress"></div></div>
</body></html>`;
  }

  // ── CTA 슬라이드 ──
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${SLIDE_W}px; height:${SLIDE_H}px; overflow:hidden;
  background:#003d2b; font-family:${FONT}; color:#fff; }
.bg { position:absolute; inset:0;
  background: radial-gradient(ellipse at 50% 50%, #00695c 0%, #003d2b 70%); }
.top-bar { position:absolute; top:0; left:0; right:0; height:10px;
  background:linear-gradient(90deg,#00c9ff,#92fe9d); }
.brand { position:absolute; top:65px; left:0; right:0; text-align:center;
  font-size:48px; font-weight:700; color:#92fe9d; letter-spacing:2px; }
.center { position:absolute; inset:0; display:flex; flex-direction:column;
  justify-content:center; align-items:center; padding:60px; gap:50px; }
.emoji { font-size:220px; line-height:1; }
.text { font-size:102px; font-weight:900; text-align:center; line-height:1.4;
  word-break:keep-all; }
.actions { display:flex; flex-direction:column; gap:30px; width:100%; }
.btn { display:flex; align-items:center; justify-content:center; gap:24px;
  padding:36px 50px; border-radius:28px; font-size:66px; font-weight:900; }
.btn-sub { background:#92fe9d; color:#003d2b; }
.btn-like { background:rgba(255,255,255,0.12); color:#fff;
  border:4px solid rgba(255,255,255,0.3); }
.url { position:absolute; bottom:70px; left:0; right:0; text-align:center;
  font-size:44px; color:rgba(255,255,255,0.6); }
.url span { color:#92fe9d; }
</style></head><body>
<div class="bg"></div>
<div class="top-bar"></div>
<div class="brand">🏥 5060 건강주치의</div>
<div class="center">
  <div class="emoji">${slide.emoji}</div>
  <div class="text">${textHtml}</div>
  <div class="actions">
    <div class="btn btn-sub">🔔 구독하기</div>
    <div class="btn btn-like">👍 좋아요 & 저장</div>
  </div>
</div>
<div class="url">📖 <span>smartinfoblog.co.kr</span></div>
</body></html>`;
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
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 500)); // 폰트 렌더링 대기
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
