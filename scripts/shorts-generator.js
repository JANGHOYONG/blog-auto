/**
 * YouTube Shorts 자동 생성 스크립트 v3
 * 방식: Pexels 스톡 영상 + 텍스트 오버레이 + TTS 내레이션
 * 흐름: 블로그 글 → GPT 스크립트 → [슬라이드별: 스톡영상 + 오버레이 + TTS] → FFmpeg 합성 → YouTube 업로드
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
const https = require('https');

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const args = process.argv.slice(2);
const getArg = (name) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : null;
};

const SLIDE_W = 1080;
const SLIDE_H = 1920;
const FONT = `'Noto Sans CJK KR','Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif`;

// ─── 1. GPT 스크립트 생성 ─────────────────────────────────────────────────────
async function generateShortsScript(post) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 5060 시니어를 위한 건강 유튜브 쇼츠 전문 PD입니다.
시청자가 끝까지 보게 만드는 60초 쇼츠를 설계합니다.

핵심 원칙:
- 슬라이드 하나 = 딱 한 가지 정보 (짧고 강렬하게)
- 첫 슬라이드에서 "나 이거 꼭 알아야 해!" 반응 유도
- 50~60대 눈높이: 어려운 의학 용어 절대 금지, 일상 언어
- 각 포인트는 생활에서 바로 쓸 수 있는 실천 정보
- narration은 화면 텍스트와 완벽히 일치 (같은 내용을 자연스럽게 말하는 것)
- videoQuery는 해당 슬라이드 내용에 딱 맞는 영어 검색어 (Pexels 스톡 영상용)`,
      },
      {
        role: 'user',
        content: `다음 블로그 글을 60초 유튜브 쇼츠로 만들어주세요.

제목: ${post.title}
요약: ${post.excerpt}

⚠️ 제목 규칙: 영상에서 실제 다루는 개수와 제목 숫자를 반드시 일치시키세요.
⚠️ videoQuery 규칙: Pexels에서 세로 영상으로 잘 나오는 구체적 영어 단어 2-3개

JSON으로 응답:
{
  "youtubeTitle": "유튜브 제목 (50자 이내, 클릭 유도, #Shorts 포함)",
  "description": "영상 설명 (150자 내외)",
  "tags": ["건강", "5060건강", "시니어건강", "태그1", "태그2"],
  "slides": [
    {
      "type": "hook",
      "emoji": "❓",
      "label": "오늘의 건강 정보",
      "text": "멈추게 만드는 강한 훅\\n(충격 통계 or 반전 질문, 15자×2줄)",
      "narration": "5~7초 분량. 따뜻하고 친근한 말투. 화면 텍스트를 자연스럽게 읽어주는 내용.",
      "videoQuery": "senior health doctor consultation"
    },
    {
      "type": "point",
      "emoji": "✅",
      "label": "첫 번째",
      "text": "핵심 포인트 1\\n(실천 가능, 14자×2줄)",
      "narration": "5~7초 분량. 구체적이고 쉽게.",
      "videoQuery": "healthy food vegetables cooking"
    },
    {
      "type": "point",
      "emoji": "💡",
      "label": "두 번째",
      "text": "핵심 포인트 2\\n(14자×2줄)",
      "narration": "5~7초 분량.",
      "videoQuery": "exercise walking elderly"
    },
    {
      "type": "point",
      "emoji": "🥗",
      "label": "세 번째",
      "text": "핵심 포인트 3\\n(14자×2줄)",
      "narration": "5~7초 분량.",
      "videoQuery": "medical health lifestyle"
    },
    {
      "type": "point",
      "emoji": "⚠️",
      "label": "네 번째",
      "text": "핵심 포인트 4\\n(14자×2줄)",
      "narration": "5~7초 분량.",
      "videoQuery": "healthy sleep rest"
    },
    {
      "type": "point",
      "emoji": "💊",
      "label": "다섯 번째",
      "text": "핵심 포인트 5\\n(14자×2줄)",
      "narration": "5~7초 분량.",
      "videoQuery": "vitamin supplement nutrition"
    },
    {
      "type": "cta",
      "emoji": "👇",
      "label": "더 알아보기",
      "text": "자세한 내용은\\n블로그에서 확인!",
      "narration": "더 자세한 내용은 스마트인포블로그에서 확인해 보세요. 구독과 좋아요도 부탁드립니다!",
      "videoQuery": "happy healthy senior lifestyle"
    }
  ]
}`,
      },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

// ─── 2. Pexels 스톡 영상 다운로드 ────────────────────────────────────────────
async function fetchPexelsVideo(query, outPath) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY 환경변수가 없습니다.');

  // 세로(portrait) 영상 우선 검색
  const searches = [
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=10`,
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&size=medium&per_page=10`,
  ];

  let videoUrl = null;

  for (const url of searches) {
    const res = await axios.get(url, { headers: { Authorization: key } });
    const videos = res.data.videos || [];

    for (const video of videos) {
      // HD 파일 우선, 없으면 SD
      const files = video.video_files || [];
      const portrait = files.find((f) => f.height > f.width && f.quality === 'hd')
        || files.find((f) => f.height > f.width)
        || files.find((f) => f.quality === 'hd')
        || files[0];

      if (portrait && portrait.link) {
        videoUrl = portrait.link;
        break;
      }
    }
    if (videoUrl) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!videoUrl) throw new Error(`Pexels 영상 없음: "${query}"`);

  // 영상 다운로드 (스트리밍)
  const writer = fs.createWriteStream(outPath);
  const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ─── 3. 텍스트 오버레이 PNG 생성 (투명 배경) ─────────────────────────────────
function makeOverlayHtml(slide, idx, total) {
  const progress = Math.round((idx / total) * 100);
  const textHtml = slide.text.replace(/\n/g, '<br>');

  const accentColors = {
    hook:  '#4fc3f7',
    point: '#69f0ae',
    cta:   '#ffb74d',
  };
  const accent = accentColors[slide.type] || '#69f0ae';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:${SLIDE_W}px; height:${SLIDE_H}px;
  background:transparent; overflow:hidden;
  font-family:${FONT};
}

/* 상단 브랜드 배지 */
.brand {
  position:absolute; top:55px; left:45px;
  background:rgba(0,0,0,0.72);
  border-radius:50px;
  padding:18px 36px;
  display:flex; align-items:center; gap:12px;
}
.brand-icon { font-size:40px; line-height:1; }
.brand-text { font-size:38px; font-weight:700; color:#fff; letter-spacing:1px; }

/* 슬라이드 타입 뱃지 (hook/point) */
.type-badge {
  position:absolute; top:55px; right:45px;
  background:${accent};
  color:#000; font-size:34px; font-weight:900;
  padding:16px 32px; border-radius:50px;
  letter-spacing:2px;
}

/* 하단 그라데이션 텍스트 영역 */
.bottom-area {
  position:absolute;
  bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.95) 0%,
    rgba(0,0,0,0.88) 30%,
    rgba(0,0,0,0.6) 60%,
    transparent 100%
  );
  padding:0 55px 110px;
  min-height:700px;
  display:flex; flex-direction:column;
  justify-content:flex-end;
}

.slide-label {
  font-size:40px; font-weight:700;
  color:${accent}; letter-spacing:3px;
  margin-bottom:18px;
  display:flex; align-items:center; gap:14px;
}
.slide-label .emoji { font-size:46px; }

.main-text {
  font-size:${slide.type === 'hook' ? '96px' : '90px'};
  font-weight:900; color:#fff;
  line-height:1.35; word-break:keep-all;
  text-shadow: 0 3px 20px rgba(0,0,0,0.9),
               0 0 40px rgba(0,0,0,0.5);
  letter-spacing:-1px;
}

/* CTA 버튼 영역 */
.cta-buttons {
  display:flex; flex-direction:column; gap:22px;
  margin-top:35px;
}
.btn {
  display:flex; align-items:center; justify-content:center; gap:18px;
  padding:28px 40px; border-radius:20px;
  font-size:52px; font-weight:900;
}
.btn-sub { background:${accent}; color:#000; }
.btn-like { background:rgba(255,255,255,0.15);
  color:#fff; border:3px solid rgba(255,255,255,0.4); }

/* 하단 진행 바 */
.progress-track {
  position:absolute; bottom:0; left:0; right:0; height:10px;
  background:rgba(255,255,255,0.15);
}
.progress-fill {
  height:100%; width:${progress}%;
  background:linear-gradient(90deg, ${accent}, #fff);
  border-radius:0 5px 5px 0;
}

/* 블로그 URL */
.blog-url {
  position:absolute; bottom:22px; left:0; right:0;
  text-align:center; font-size:36px;
  color:rgba(255,255,255,0.55); font-weight:600;
}
.blog-url span { color:${accent}; }
</style>
</head>
<body>

<div class="brand">
  <span class="brand-icon">🏥</span>
  <span class="brand-text">5060 건강주치의</span>
</div>

${slide.type !== 'cta' ? `<div class="type-badge">${slide.label || ''}</div>` : ''}

<div class="bottom-area">
  <div class="slide-label">
    <span class="emoji">${slide.emoji}</span>
    <span>${slide.label || ''}</span>
  </div>
  <div class="main-text">${textHtml}</div>
  ${slide.type === 'cta' ? `
  <div class="cta-buttons">
    <div class="btn btn-sub">🔔 구독하기</div>
    <div class="btn btn-like">👍 좋아요 & 저장</div>
  </div>` : ''}
</div>

<div class="progress-track">
  <div class="progress-fill"></div>
</div>
<div class="blog-url">📖 <span>smartinfoblog.co.kr</span></div>

</body>
</html>`;
}

// ─── 4. 슬라이드별 TTS 생성 ──────────────────────────────────────────────────
async function generateSlideAudio(narration, outPath) {
  const res = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'nova',
    input: narration,
    speed: 0.90,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return buf.length;
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

// ─── 6. 슬라이드 클립 합성 (스톡영상 + 오버레이 + 오디오) ─────────────────────
function createSlideClip(videoPath, overlayPath, audioPath, duration, outPath) {
  return new Promise((resolve, reject) => {
    const d = (duration + 0.3).toFixed(2);
    ffmpeg()
      // 입력: 스톡영상 (루프), 오디오, 오버레이 PNG
      .input(videoPath).inputOptions(['-stream_loop', '-1'])
      .input(audioPath)
      .input(overlayPath)
      .complexFilter([
        // 스톡영상: 세로(1080x1920)로 스케일 + 크롭
        `[0:v]scale=${SLIDE_W}:${SLIDE_H}:force_original_aspect_ratio=increase,` +
        `crop=${SLIDE_W}:${SLIDE_H},setsar=1[bg]`,
        // 오버레이 합성 + 페이드인/아웃 (complexFilter 안에서 처리)
        `[bg][2:v]overlay=0:0,` +
        `fade=t=in:st=0:d=0.25,` +
        `fade=t=out:st=${(parseFloat(d)-0.35).toFixed(2)}:d=0.35[out]`,
      ])
      .outputOptions([
        '-map', '[out]',
        '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-t', d,
        '-movflags', '+faststart',
        '-af', `afade=t=in:st=0:d=0.2,afade=t=out:st=${(duration-0.25).toFixed(2)}:d=0.25`,
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
      .on('progress', (p) => process.stdout.write(`\r  최종 합성: ${Math.round(p.percent || 0)}%`))
      .on('end', () => { console.log(''); fs.unlinkSync(listFile); resolve(); })
      .on('error', reject)
      .run();
  });
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 유튜브 쇼츠 자동 생성 v3 (스톡영상 + 오버레이) ===\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-'));

  // Puppeteer 브라우저 (오버레이 생성용)
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: SLIDE_W, height: SLIDE_H, deviceScaleFactor: 1 });

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
    console.log('[1/3] 쇼츠 스크립트 생성...');
    const script = await generateShortsScript(post);
    console.log(`  제목: ${script.youtubeTitle}`);
    console.log(`  슬라이드: ${script.slides.length}개\n`);

    // 2. 슬라이드별 처리 (스톡영상 + 오버레이 + TTS → 클립)
    console.log('[2/3] 슬라이드별 클립 생성...\n');
    const clipPaths = [];
    let totalDuration = 0;

    for (let i = 0; i < script.slides.length; i++) {
      const slide = script.slides[i];
      console.log(`  ── 슬라이드 ${i + 1}/${script.slides.length} [${slide.type}] ──`);

      // a) Pexels 스톡 영상 다운로드
      const videoPath = path.join(tmpDir, `video_${i}.mp4`);
      try {
        console.log(`     🎬 스톡영상: "${slide.videoQuery}"`);
        await fetchPexelsVideo(slide.videoQuery, videoPath);
        console.log(`     ✅ 다운로드 완료`);
      } catch (e) {
        // 실패시 fallback 검색어
        console.log(`     ⚠️ 재시도: "health wellness lifestyle"`);
        await fetchPexelsVideo('health wellness lifestyle', videoPath);
      }

      // b) TTS 음성 생성
      const audioPath = path.join(tmpDir, `audio_${i}.mp3`);
      const narration = slide.narration || slide.text.replace(/\n/g, ' ');
      const audioSize = await generateSlideAudio(narration, audioPath);
      const duration = await getAudioDuration(audioPath);
      totalDuration += duration + 0.3;
      console.log(`     🔊 TTS: ${(audioSize/1024).toFixed(0)}KB, ${duration.toFixed(1)}초`);

      // c) 텍스트 오버레이 PNG 생성 (투명 배경)
      const overlayPath = path.join(tmpDir, `overlay_${i}.png`);
      const html = makeOverlayHtml(slide, i + 1, script.slides.length);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: overlayPath, omitBackground: true });
      console.log(`     🖼️  오버레이 생성 완료`);

      // d) 클립 합성
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(2, '0')}.mp4`);
      await createSlideClip(videoPath, overlayPath, audioPath, duration, clipPath);
      clipPaths.push(clipPath);
      console.log(`     ✅ 클립 완료 (${duration.toFixed(1)}초)\n`);
    }

    await browser.close();
    console.log(`총 ${script.slides.length}개 클립 완료 | 예상 총 길이: ${totalDuration.toFixed(0)}초\n`);

    // 3. 최종 영상 합성
    console.log('[3/3] 최종 영상 합성...');
    const videoPath = path.join(tmpDir, 'shorts_final.mp4');
    await concatClips(clipPaths, videoPath);
    const sizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
    console.log(`  완성 영상: ${sizeMB}MB\n`);

    // 4. YouTube 업로드 or 파일 저장
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    const fullDesc =
      `${script.description}\n\n📖 자세한 내용: ${postUrl}\n\n` +
      `${script.tags.map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #Shorts #건강정보 #5060건강`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
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
      console.log(`✅ YouTube 업로드 완료! https://youtube.com/shorts/${videoId}`);
    } else {
      const outDir = path.join(process.cwd(), 'shorts-output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      const finalPath = path.join(outDir, `${post.slug}.mp4`);
      fs.copyFileSync(videoPath, finalPath);
      await prisma.post.update({ where: { id: post.id }, data: { shortsGenerated: true } });
      console.log(`✅ 영상 저장: ${finalPath}`);
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
