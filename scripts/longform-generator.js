/**
 * YouTube 장편 영상 자동 생성 스크립트 v2
 * - 문장 단위 자막 (55px, 3줄 이내) — 가독성 대폭 개선
 * - 썸네일 자동 생성 및 YouTube 업로드
 * - 포맷: 1080×1920 세로형, 7~10분
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

const VW = 1080;
const VH = 1920;
const FONT = `'Noto Sans CJK KR','Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif`;

// HTML 태그 제거 (블로그 본문 → 순수 텍스트)
function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

// 내레이션 → 문장 단위 배열 (자막 한 화면 = 1문장)
function splitNarrationToSentences(narration) {
  // 1차: 문장 부호 기준 분리
  const raw = narration
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result = [];
  for (const s of raw) {
    if (s.length < 20 && result.length > 0) {
      // 너무 짧으면 이전 문장에 합치기
      result[result.length - 1] += ' ' + s;
    } else if (s.length > 60) {
      // 너무 길면 쉼표 기준으로 2차 분리
      const sub = s.split(/,\s*/).map((x) => x.trim()).filter(Boolean);
      let cur = '';
      for (const part of sub) {
        const candidate = cur ? cur + ', ' + part : part;
        if (candidate.length > 55 && cur) {
          result.push(cur);
          cur = part;
        } else {
          cur = candidate;
        }
      }
      if (cur) result.push(cur);
    } else {
      result.push(s);
    }
  }
  return result.length ? result : [narration.slice(0, 100)];
}

// 썸네일 타이틀 자연스러운 줄바꿈
function splitThumbnailTitle(text) {
  if (text.length <= 9) return text;
  const mid = Math.ceil(text.length / 2);
  const breakPoint = text.lastIndexOf(' ', mid);
  if (breakPoint > 0) return text.slice(0, breakPoint) + '\n' + text.slice(breakPoint).trim();
  return text.slice(0, mid) + '\n' + text.slice(mid);
}

// ─── 1. GPT 장편 스크립트 생성 ─────────────────────────────────────────────────
async function generateLongformScript(post) {
  const fullContent = stripHtml(post.content || '');

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 시청자 체류시간을 극대화하는 건강 정보 영상 전문 작가입니다.
5060 시니어를 대상으로, 처음부터 끝까지 이탈 없이 보게 만드는 영상을 만듭니다.

[대본 구조 원칙 - 반드시 지킬 것]
1. 훅(Hook): 첫 챕터에서 충격적인 사실이나 반전 질문으로 시작. "이 증상이 있다면 바로 확인하세요" 형태.
2. 문제 심화: 왜 50·60대에 특히 위험한지, 구체적 수치로 공포심과 공감 유발.
3. 핵심 정보 (본론): 블로그 내용의 구체적 정보를 단계별·번호별로 명확히 전달.
4. 반전/의외성: "사실 이것이 더 중요합니다" 식의 예상 밖 정보로 집중력 유지.
5. 실천법: 오늘 당장 할 수 있는 구체적 행동 3가지.
6. 마무리: 핵심 요약 + 따뜻한 응원 + 다음 영상 기대감 유도.

[문체 원칙]
- 전문 의료진이 직접 설명하는 신뢰감 있는 말투
- 블로그의 구체적 수치·통계·사례를 그대로 활용
- 구어체, 자연스러운 문장 (문어체·나열식 금지)
- 각 챕터: 1분 30초~2분 (400~550자)
- imageQuery: 챕터 내용에 맞는 영어 검색어 2-3개

[자막 최적화 - 반드시 준수]
- 내레이션의 각 문장을 반드시 마침표(.), 느낌표(!), 물음표(?)로 끝낼 것
- 한 문장 길이: 25~50자 이내 (화면 자막 기준)
- 긴 설명은 여러 짧은 문장으로 분리하여 작성`,
      },
      {
        role: 'user',
        content: `다음 블로그 글로 시청자가 끝까지 보는 7~10분 건강 영상 스크립트를 만들어주세요.

[제목]
${post.title}

[요약]
${post.excerpt}

[본문 전체]
${fullContent}

JSON 응답 (반드시 아래 구조 유지):
{
  "youtubeTitle": "유튜브 제목 (55자 이내. '이것만 알면', '지금 당장', '절대 모르는' 등 강한 어휘 활용. 숫자 포함)",
  "thumbnailText": "썸네일 메인 문구 (18자 이내, 숫자 포함 권장. 예: '혈당 폭등 3가지 신호', '관절 망가지는 이유')",
  "thumbnailSub": "썸네일 부제목 (20자 이내. 예: '당신도 해당될 수 있습니다', '지금 바로 확인하세요')",
  "description": "영상 설명 250~300자. 첫 줄: 시청자가 얻을 핵심 혜택. 둘째줄~: 핵심 내용 3가지 요약. 마지막 줄: '자세한 내용과 실천 가이드는 블로그에서 확인하세요 👇'",
  "tags": ["건강", "5060건강", "시니어건강", "건강정보", "관련태그"],
  "chapters": [
    {
      "title": "이것 모르면 큰일 납니다",
      "imageQuery": "worried senior patient doctor consultation",
      "narration": "안녕하세요, 시니어 건강백과입니다. [충격적 사실로 시작]. 혹시 여러분도 [공감 가는 상황]이신가요? 오늘 이 영상을 끝까지 보시면, [시청자가 얻을 명확한 혜택]을 알게 되실 겁니다. (200~230자. 반드시 충격적 훅으로 시작. 각 문장 25~50자)"
    },
    {
      "title": "왜 50·60대에 더 위험한가",
      "imageQuery": "senior health risk medical chart",
      "narration": "(430~550자. 본문의 통계·수치 활용. 각 문장 25~50자로 명확히 끊어서 작성)"
    },
    {
      "title": "정확한 증상과 자가진단법",
      "imageQuery": "health symptom check body pain",
      "narration": "(430~550자. 본문 증상 정보 활용. 각 문장 25~50자)"
    },
    {
      "title": "전문의가 추천하는 해결법",
      "imageQuery": "doctor recommendation healthy food treatment",
      "narration": "(430~550자. 번호 매겨 1, 2, 3으로 명확히. 각 문장 25~50자)"
    },
    {
      "title": "대부분이 모르는 함정",
      "imageQuery": "common mistake health warning alert",
      "narration": "(430~550자. '사실 많은 분들이 잘못 알고 계신 것이 있습니다'로 시작. 각 문장 25~50자)"
    },
    {
      "title": "오늘부터 바로 시작하세요",
      "imageQuery": "healthy lifestyle action plan morning routine",
      "narration": "(430~550자. 오늘 당장 실천 가능한 3가지 구체적 행동. 각 문장 25~50자)"
    },
    {
      "title": "핵심 정리",
      "imageQuery": "happy healthy senior couple outdoor",
      "narration": "(200~230자. '오늘 배운 것을 정리해드리겠습니다'로 시작. 핵심 3가지 요약. 따뜻한 응원. 각 문장 25~50자)"
    }
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
  if (!key) throw new Error('PEXELS_API_KEY 환경변수가 없습니다.');

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

// ─── 3. 문장 오버레이 HTML (55px 큰 글씨, 3줄 이내) ──────────────────────────
function makeSentenceOverlay(sentence, chapterTitle, chapterIdx, totalChapters, progressPct) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:${VW}px; height:${VH}px;
  background:transparent; overflow:hidden;
  font-family:${FONT};
}

/* 상단 브랜드 */
.top-bar {
  position:absolute; top:0; left:0; right:0;
  height:130px;
  background:linear-gradient(to bottom, rgba(0,0,0,0.72), transparent);
  display:flex; align-items:center; justify-content:space-between;
  padding:30px 50px 0;
}
.channel-badge {
  background:rgba(0,140,90,0.92);
  border-radius:10px; padding:12px 30px;
  font-size:34px; font-weight:800; color:#fff;
  letter-spacing:2px;
  box-shadow:0 3px 12px rgba(0,0,0,0.35);
}
.chapter-num {
  font-size:30px; font-weight:600;
  color:rgba(100,220,160,0.95);
}

/* 하단 자막 영역 */
.bottom-area {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.92) 0%,
    rgba(0,0,0,0.75) 40%,
    rgba(0,0,0,0.25) 72%,
    transparent 100%
  );
  padding:36px 55px 100px;
  min-height:320px;
  display:flex; flex-direction:column; justify-content:flex-end; gap:18px;
}

.chapter-title {
  font-size:40px; font-weight:900;
  color:#64ffb4;
  line-height:1.3; word-break:keep-all;
  text-shadow:0 2px 12px rgba(0,0,0,0.9);
}

/* 핵심: 큰 글씨 + 3줄 제한 */
.subtitle {
  font-size:55px; font-weight:700;
  color:#ffffff; line-height:1.50;
  word-break:keep-all; letter-spacing:-0.5px;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:3;
  overflow:hidden;
  text-shadow:
    0 2px 8px rgba(0,0,0,1),
    0 4px 20px rgba(0,0,0,0.95),
    0 0 40px rgba(0,0,0,0.85);
}

/* 진행 바 */
.progress-wrap {
  position:absolute; bottom:0; left:0; right:0; height:10px;
  background:rgba(255,255,255,0.14);
}
.progress-fill {
  height:100%; width:${progressPct}%;
  background:linear-gradient(90deg, #00c9a7, #4fc3f7);
  border-radius:0 5px 5px 0;
}

.blog-url {
  position:absolute; bottom:16px; right:40px;
  font-size:26px; color:rgba(255,255,255,0.42); font-weight:600;
}
</style>
</head>
<body>

<div class="top-bar">
  <div class="channel-badge">🏥 시니어 건강백과</div>
  <div class="chapter-num">${chapterIdx} / ${totalChapters}</div>
</div>

<div class="bottom-area">
  <div class="chapter-title">▶ ${chapterTitle}</div>
  <div class="subtitle">${sentence.replace(/\n/g, ' ')}</div>
</div>

<div class="progress-wrap">
  <div class="progress-fill"></div>
</div>
<div class="blog-url">smartinfoblog.co.kr</div>

</body>
</html>`;
}

// ─── 4. 썸네일 HTML (1280×720) ───────────────────────────────────────────────
function makeThumbnailHtml(thumbnailText, thumbnailSub, bgImagePath) {
  const formattedTitle = splitThumbnailTitle(thumbnailText);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:1280px; height:720px; overflow:hidden;
  font-family:${FONT}; background:#0a2a1f;
}
.bg-img {
  position:absolute; inset:0;
  width:100%; height:100%;
  object-fit:cover; object-position:center;
}
.overlay {
  position:absolute; inset:0;
  background:
    linear-gradient(105deg, rgba(0,0,0,0.83) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.18) 100%),
    linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 42%);
}
.content {
  position:relative; z-index:10;
  display:flex; flex-direction:column;
  height:100%; padding:42px 60px 50px;
}
.channel-badge {
  display:inline-flex; align-items:center; gap:10px;
  background:linear-gradient(135deg,#0d5c45,#1a9e7a);
  border:2px solid rgba(255,255,255,0.22);
  border-radius:12px; padding:14px 32px;
  font-size:30px; font-weight:800; color:#fff;
  letter-spacing:1px; width:fit-content;
  box-shadow:0 4px 20px rgba(0,0,0,0.4);
}
.main-block {
  flex:1; display:flex; flex-direction:column;
  justify-content:center; padding-bottom:20px;
}
.main-title {
  font-size:96px; font-weight:900;
  color:#FFE500; line-height:1.12;
  letter-spacing:-2px; word-break:keep-all;
  white-space:pre-line;
  text-shadow:
    0 4px 24px rgba(0,0,0,0.95),
    0 0 60px rgba(0,0,0,0.8),
    3px 3px 0 rgba(0,0,0,0.6);
  max-width:720px;
}
.sub-title {
  margin-top:22px;
  font-size:38px; font-weight:600;
  color:rgba(255,255,255,0.92);
  text-shadow:0 2px 12px rgba(0,0,0,0.9);
  word-break:keep-all; max-width:680px;
}
.cta-badge {
  display:inline-flex; align-items:center; gap:12px;
  background:linear-gradient(135deg,#e63946,#ff8c42);
  border-radius:50px; padding:18px 44px;
  font-size:34px; font-weight:900; color:#fff;
  letter-spacing:1px; width:fit-content;
  box-shadow:0 6px 24px rgba(230,57,70,0.5);
}
</style>
</head>
<body>
<img class="bg-img" src="file://${bgImagePath}" alt="">
<div class="overlay"></div>
<div class="content">
  <div class="channel-badge">🏥 시니어 건강백과</div>
  <div class="main-block">
    <div class="main-title">${formattedTitle}</div>
    <div class="sub-title">${thumbnailSub}</div>
  </div>
  <div class="cta-badge">▶ 지금 확인하세요</div>
</div>
</body>
</html>`;
}

// ─── 5. 썸네일 생성 (Puppeteer) ──────────────────────────────────────────────
async function generateThumbnail(page, thumbnailText, thumbnailSub, bgImagePath, outPath) {
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const html = makeThumbnailHtml(thumbnailText, thumbnailSub, bgImagePath);
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: outPath, type: 'png' });
  // 원래 뷰포트 복원
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
}

// ─── 6. TTS 생성 (Google Cloud TTS ko-KR-Standard-C) ────────────────────────
async function generateAudio(text, outPath) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY 환경변수가 없습니다.');

  const MAX_BYTES = 4500;
  const encoder = new TextEncoder();

  function splitText(input) {
    if (encoder.encode(input).length <= MAX_BYTES) return [input];
    const sentences = input.split(/(?<=[.!?。])\s+/);
    const result = [];
    let cur = '';
    for (const s of sentences) {
      const candidate = cur ? cur + ' ' + s : s;
      if (encoder.encode(candidate).length > MAX_BYTES) {
        if (cur) result.push(cur.trim());
        cur = s;
      } else {
        cur = candidate;
      }
    }
    if (cur.trim()) result.push(cur.trim());
    return result.length ? result : [input.slice(0, 1000)];
  }

  const chunks = splitText(text);

  async function synthesizeChunk(chunk) {
    const res = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        input: { text: chunk },
        voice: { languageCode: 'ko-KR', name: 'ko-KR-Standard-C' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.90 },
      }
    );
    return Buffer.from(res.data.audioContent, 'base64');
  }

  if (chunks.length === 1) {
    fs.writeFileSync(outPath, await synthesizeChunk(chunks[0]));
    return;
  }

  const chunkPaths = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = outPath.replace('.mp3', `_chunk${i}.mp3`);
    fs.writeFileSync(chunkPath, await synthesizeChunk(chunks[i]));
    chunkPaths.push(chunkPath);
    await new Promise((r) => setTimeout(r, 150));
  }

  await new Promise((resolve, reject) => {
    const concatFile = outPath.replace('.mp3', '_chunks.txt');
    fs.writeFileSync(concatFile, chunkPaths.map((p) => `file '${p}'`).join('\n'));
    ffmpeg()
      .input(concatFile).inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', '128k'])
      .output(outPath)
      .on('end', () => { fs.unlinkSync(concatFile); chunkPaths.forEach((p) => fs.unlinkSync(p)); resolve(); })
      .on('error', reject)
      .run();
  });
}

// ─── 7. 오디오 길이 측정 ─────────────────────────────────────────────────────
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, meta) => {
      if (err) reject(err);
      else resolve(parseFloat(meta.format.duration));
    });
  });
}

// ─── 8. 문장 클립 합성 (fade 없음 — 자연스러운 문장 전환) ────────────────────
function createSentenceClip(imagePath, overlayPath, audioPath, duration, outPath) {
  return new Promise((resolve, reject) => {
    const d = (duration + 0.1).toFixed(2);
    ffmpeg()
      .input(imagePath).inputOptions(['-loop', '1', '-framerate', '25'])
      .input(audioPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]scale=${VW}:${VH}:force_original_aspect_ratio=increase,` +
        `crop=${VW}:${VH},setsar=1[bg]`,
        `[bg][2:v]overlay=0:0:eof_action=repeat[out]`,
      ])
      .outputOptions([
        '-map', '[out]',
        '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-t', d,
        '-movflags', '+faststart',
      ])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ─── 9. 클립 이어붙이기 ──────────────────────────────────────────────────────
function concatClips(clipPaths, outPath, silent = false) {
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
      .on('progress', (p) => { if (!silent) process.stdout.write(`\r  합성: ${Math.round(p.percent || 0)}%`); })
      .on('end', () => { if (!silent) console.log(''); fs.unlinkSync(listFile); resolve(); })
      .on('error', reject)
      .run();
  });
}

// ─── 챕터 타임스탬프 ─────────────────────────────────────────────────────────
function buildChapterTimestamps(chapters, durations) {
  let elapsed = 0;
  return chapters.map((ch, i) => {
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    const ts = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    elapsed += durations[i];
    return `${ts} ${ch.title}`;
  }).join('\n');
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== YouTube 장편 영상 v2 (문장 단위 자막 + 썸네일) ===\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'longform-'));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });

  try {
    const postId = getArg('post-id');
    const post = postId
      ? await prisma.post.findUnique({ where: { id: parseInt(postId) }, include: { category: true } })
      : await prisma.post.findFirst({
          where: { status: 'PUBLISHED', category: { slug: 'health' }, longformGenerated: false },
          orderBy: { publishedAt: 'desc' },
          include: { category: true },
        });

    if (!post) { console.log('장편을 만들 글이 없습니다.'); return; }
    console.log(`대상 글: "${post.title}"\n`);

    // 1. 스크립트 생성
    console.log('[1/3] 장편 스크립트 생성...');
    const script = await generateLongformScript(post);
    console.log(`  제목: ${script.youtubeTitle}`);
    console.log(`  썸네일: "${script.thumbnailText}" / "${script.thumbnailSub}"`);
    console.log(`  챕터: ${script.chapters.length}개\n`);

    // 2. 챕터별 클립 생성
    console.log('[2/3] 챕터별 클립 생성...\n');
    const clipPaths = [];
    const durations = [];
    let thumbnailPath = null;

    for (let i = 0; i < script.chapters.length; i++) {
      const ch = script.chapters[i];
      console.log(`  ── 챕터 ${i + 1}/${script.chapters.length}: "${ch.title}" ──`);

      // a) Pexels 이미지
      const imagePath = path.join(tmpDir, `image_${i}.jpg`);
      try {
        console.log(`     🖼️  "${ch.imageQuery}"`);
        await fetchPexelsPhoto(ch.imageQuery, imagePath);
      } catch {
        console.log(`     ⚠️ 재시도: "nature calm wellness"`);
        await fetchPexelsPhoto('nature calm wellness', imagePath);
      }

      // b) 첫 챕터 이미지로 썸네일 생성
      if (i === 0 && script.thumbnailText) {
        thumbnailPath = path.join(tmpDir, 'thumbnail.png');
        process.stdout.write('     🖼️  썸네일 생성 중...');
        await generateThumbnail(
          page,
          script.thumbnailText,
          script.thumbnailSub || '',
          imagePath,
          thumbnailPath
        );
        console.log(' ✅');
      }

      // c) 내레이션 → 문장 분리
      const sentences = splitNarrationToSentences(ch.narration);
      console.log(`     📝 ${sentences.length}문장으로 분리`);

      const sentenceClipPaths = [];
      let chapterDuration = 0;
      const progressPct = Math.round((i / script.chapters.length) * 100);

      for (let j = 0; j < sentences.length; j++) {
        const sentence = sentences[j];

        // TTS
        const audioPath = path.join(tmpDir, `audio_${i}_${j}.mp3`);
        await generateAudio(sentence, audioPath);
        const sentDuration = await getAudioDuration(audioPath);
        chapterDuration += sentDuration + 0.1;
        console.log(`     🔊 [${j + 1}/${sentences.length}] ${sentence.length}자 → ${sentDuration.toFixed(1)}초`);

        // 오버레이
        const overlayPath = path.join(tmpDir, `overlay_${i}_${j}.png`);
        const html = makeSentenceOverlay(sentence, ch.title, i + 1, script.chapters.length, progressPct);
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise((r) => setTimeout(r, 150));
        await page.screenshot({ path: overlayPath, omitBackground: true });

        // 문장 클립
        const sentClipPath = path.join(tmpDir, `sentclip_${i}_${String(j).padStart(2, '0')}.mp4`);
        await createSentenceClip(imagePath, overlayPath, audioPath, sentDuration, sentClipPath);
        sentenceClipPaths.push(sentClipPath);
      }

      // 문장 클립들 → 챕터 클립
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(2, '0')}.mp4`);
      if (sentenceClipPaths.length === 1) {
        fs.copyFileSync(sentenceClipPaths[0], clipPath);
      } else {
        process.stdout.write(`     🎬 챕터 ${i + 1} 합성 중...`);
        await concatClips(sentenceClipPaths, clipPath, true);
        console.log(' ✅');
      }
      clipPaths.push(clipPath);
      durations.push(chapterDuration);

      const totalSec = durations.reduce((a, b) => a + b, 0);
      console.log(`     ✅ 완료 | 누적: ${Math.floor(totalSec / 60)}분 ${Math.floor(totalSec % 60)}초\n`);
    }

    await browser.close();

    const totalMin = Math.floor(durations.reduce((a, b) => a + b, 0) / 60);
    console.log(`총 ${script.chapters.length}챕터 | 총 길이: 약 ${totalMin}분\n`);

    // 3. 최종 합성
    console.log('[3/3] 최종 영상 합성...');
    const finalVideoPath = path.join(tmpDir, 'longform_final.mp4');
    await concatClips(clipPaths, finalVideoPath);
    const sizeMB = (fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(1);
    console.log(`  완성: ${sizeMB}MB\n`);

    // 설명 + 챕터 타임스탬프
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    const timestamps = buildChapterTimestamps(script.chapters, durations);
    // 블로그 링크를 첫 줄에 배치 — 설명란을 펼치면 바로 클릭 가능
    const fullDesc =
      `📖 블로그에서 전체 내용 + 실천 가이드 보기 👇\n` +
      `${postUrl}\n\n` +
      `${script.description}\n\n` +
      `이 영상이 도움이 됐다면 구독 & 좋아요 꼭 눌러주세요! 💚\n` +
      `매일 5060 건강 정보를 영상으로 전달해드립니다.\n\n` +
      `─────────────────────\n` +
      `⏱️ 챕터\n${timestamps}\n` +
      `─────────────────────\n\n` +
      `💬 궁금한 점은 댓글로 남겨주세요!\n\n` +
      `${script.tags.map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #5060건강 #건강정보 #시니어건강 #건강채널`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      const { uploadToYouTube, uploadThumbnail, postComment } = require('./youtube-uploader');
      console.log('YouTube 업로드 중...');
      const videoId = await uploadToYouTube({
        videoPath: finalVideoPath,
        title: script.youtubeTitle,
        description: fullDesc,
        tags: [...script.tags, '건강', '5060', '시니어건강', '건강정보'],
        categoryId: '26',
      });

      // 썸네일 업로드
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        try {
          process.stdout.write('썸네일 업로드 중...');
          await uploadThumbnail({ videoId, thumbnailPath });
          console.log(' ✅ 완료');
        } catch (thumbErr) {
          console.warn('\n⚠️ 썸네일 업로드 실패 (영상은 정상 업로드됨):', thumbErr.message);
        }
      }

      // 댓글로 블로그 링크 게시 — 채널 규모 무관하게 항상 클릭 가능
      try {
        await postComment({
          videoId,
          text: `📖 영상에서 다 못 담은 내용, 블로그에서 확인하세요 👇\n${postUrl}`,
        });
        console.log('  블로그 링크 댓글 게시 완료 ✅');
      } catch (commentErr) {
        console.log(`  댓글 게시 건너뜀: ${commentErr.message}`);
      }

      await prisma.post.update({
        where: { id: post.id },
        data: { longformGenerated: true, longformVideoId: videoId },
      }).catch(() => {});
      console.log(`\n✅ 업로드 완료! https://youtube.com/watch?v=${videoId}`);

    } else {
      const outDir = path.join(process.cwd(), 'longform-output');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      const finalPath = path.join(outDir, `${post.slug}.mp4`);
      fs.copyFileSync(finalVideoPath, finalPath);
      console.log(`\n✅ 영상 저장: ${finalPath}`);

      // 썸네일 로컬 저장
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        const thumbPath = path.join(outDir, `${post.slug}_thumbnail.png`);
        fs.copyFileSync(thumbnailPath, thumbPath);
        console.log(`✅ 썸네일 저장: ${thumbPath}`);
      }
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
