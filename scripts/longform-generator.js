/**
 * YouTube 장편 영상 자동 생성 스크립트
 * 방식: 블로그 본문 전체 참고 + Pexels 이미지 + 자막 오버레이 + TTS 내레이션
 * 포맷: 1080×1920 세로형, 7~10분
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
    .slice(0, 4000); // GPT 컨텍스트 제한
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
1. 훅(Hook): 첫 챕터에서 충격적인 사실이나 반전 질문으로 시작. 시청자가 "이거 꼭 봐야 해!"를 느끼게.
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
- imageQuery: 챕터 내용에 맞는 영어 검색어 2-3개 (밝고 선명한 이미지)`,
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

JSON 응답 (반드시 아래 7챕터 구조 유지):
{
  "youtubeTitle": "유튜브 제목 (55자 이내. '이것만 알면', '지금 당장', '절대 모르는' 등 강한 어휘 활용)",
  "description": "영상 설명 300자. 첫 줄: 시청자가 얻을 것. 둘째줄~: 핵심 내용 요약.",
  "tags": ["건강", "5060건강", "시니어건강", "건강정보", "관련태그"],
  "chapters": [
    {
      "title": "이것 모르면 큰일 납니다",
      "imageQuery": "worried senior patient doctor consultation",
      "narration": "안녕하세요, 시니어 건강백과입니다. [충격적인 통계나 반전 사실로 시작]. 혹시 여러분도 [공감 가는 상황]이신가요? 오늘 이 영상을 끝까지 보시면, [시청자가 얻을 명확한 혜택]을 알게 되실 겁니다. (200~230자. 반드시 충격적 훅으로 시작해 시청 이유 제시)"
    },
    {
      "title": "왜 50·60대에 더 위험한가",
      "imageQuery": "senior health risk medical chart",
      "narration": "(430~550자. 본문의 통계·수치 활용. 50~60대에 특히 위험한 이유를 의학적으로 설명. '실제로 ~% 환자가', '연구에 따르면' 등 신뢰도 높은 표현 사용)"
    },
    {
      "title": "정확한 증상과 자가진단법",
      "imageQuery": "health symptom check body pain",
      "narration": "(430~550자. 본문 증상 정보 활용. 시청자가 자신의 상태와 비교할 수 있게. '이런 증상이 있다면 주의하세요' 형식)"
    },
    {
      "title": "전문의가 추천하는 해결법",
      "imageQuery": "doctor recommendation healthy food treatment",
      "narration": "(430~550자. 본문 실천법 활용. 번호 매겨 1, 2, 3으로 명확히. 각 방법에 구체적 수치·시간·양 포함)"
    },
    {
      "title": "대부분이 모르는 함정",
      "imageQuery": "common mistake health warning alert",
      "narration": "(430~550자. 반전 정보. '사실 많은 분들이 잘못 알고 계신 것이 있습니다' 로 시작. 흔한 오해나 잘못된 상식 바로잡기. 집중력 재환기)"
    },
    {
      "title": "오늘부터 바로 시작하세요",
      "imageQuery": "healthy lifestyle action plan morning routine",
      "narration": "(430~550자. 오늘 당장 실천 가능한 3가지 구체적 행동. '내일이 아니라 오늘부터'라는 긴박감. 각 행동에 '언제, 얼마나, 어떻게' 포함)"
    },
    {
      "title": "핵심 정리",
      "imageQuery": "happy healthy senior couple outdoor",
      "narration": "(200~230자. '오늘 배운 것을 정리해드리겠습니다'로 시작. 핵심 3가지 요약. 따뜻한 응원. '다음 영상에서는 [관련 주제]에 대해 알려드릴게요' 예고)"
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

// ─── 3. 챕터 오버레이 HTML (세로형 1080×1920) ────────────────────────────────
function makeChapterOverlay(chapter, chapterIdx, totalChapters) {
  const progressPct = Math.round((chapterIdx / totalChapters) * 100);
  // 내레이션 첫 문장 자막으로 표시 (40자 이내)
  const subtitle = (chapter.narration || '').replace(/\n/g, ' ').slice(0, 45);

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
  background:linear-gradient(to bottom, rgba(0,0,0,0.70), transparent);
  display:flex; align-items:center; justify-content:space-between;
  padding:30px 50px 0;
}
.channel-badge {
  background:rgba(0,140,90,0.88);
  border-radius:10px; padding:12px 30px;
  font-size:34px; font-weight:800; color:#fff;
  letter-spacing:2px;
}
.chapter-num {
  font-size:30px; font-weight:600;
  color:rgba(100,220,160,0.95);
}

/* 하단 영역 - 투명도 낮춰서 이미지 보이게 */
.bottom-area {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.85) 0%,
    rgba(0,0,0,0.65) 35%,
    rgba(0,0,0,0.20) 70%,
    transparent 100%
  );
  padding:40px 55px 95px;
  min-height:360px;
  display:flex; flex-direction:column; justify-content:flex-end; gap:16px;
}

.chapter-title {
  font-size:46px; font-weight:900;
  color:#64ffb4;
  letter-spacing:0px; line-height:1.3;
  word-break:keep-all;
  text-shadow: 0 2px 12px rgba(0,0,0,0.9);
}

.subtitle {
  font-size:34px; font-weight:600;
  color:rgba(255,255,255,0.92); line-height:1.55;
  word-break:keep-all;
  text-shadow: 0 2px 8px rgba(0,0,0,0.95);
}

/* 진행 바 */
.progress-wrap {
  position:absolute; bottom:0; left:0; right:0; height:8px;
  background:rgba(255,255,255,0.12);
}
.progress-fill {
  height:100%; width:${progressPct}%;
  background:linear-gradient(90deg, #00c9a7, #4fc3f7);
}

.blog-url {
  position:absolute; bottom:14px; right:40px;
  font-size:24px; color:rgba(255,255,255,0.40); font-weight:600;
}
</style>
</head>
<body>

<div class="top-bar">
  <div class="channel-badge">🏥 시니어 건강백과</div>
  <div class="chapter-num">${chapterIdx} / ${totalChapters}</div>
</div>

<div class="bottom-area">
  <div class="chapter-title">▶ ${chapter.title}</div>
  <div class="subtitle">${subtitle}</div>
</div>

<div class="progress-wrap">
  <div class="progress-fill"></div>
</div>
<div class="blog-url">smartinfoblog.co.kr</div>

</body>
</html>`;
}

// ─── 4. TTS 생성 (4096자 제한 처리) ─────────────────────────────────────────
async function generateAudio(text, outPath) {
  const MAX = 3800;

  if (text.length <= MAX) {
    const res = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',   // 낮고 신뢰감 있는 전문가 목소리
      input: text,
      speed: 0.90,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return;
  }

  // 분할: 문장 단위
  const sentences = text.split(/(?<=[.!?。])\s+/);
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    if ((current + s).length > MAX) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  const chunkPaths = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = outPath.replace('.mp3', `_chunk${i}.mp3`);
    const res = await openai.audio.speech.create({
      model: 'tts-1-hd', voice: 'nova', input: chunks[i], speed: 0.88,
    });
    fs.writeFileSync(chunkPath, Buffer.from(await res.arrayBuffer()));
    chunkPaths.push(chunkPath);
    await new Promise((r) => setTimeout(r, 200));
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

// ─── 5. 오디오 길이 측정 ─────────────────────────────────────────────────────
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, meta) => {
      if (err) reject(err);
      else resolve(parseFloat(meta.format.duration));
    });
  });
}

// ─── 6. 챕터 클립 합성 (이미지 + 오버레이 + 오디오) ──────────────────────────
function createChapterClip(imagePath, overlayPath, audioPath, duration, outPath) {
  return new Promise((resolve, reject) => {
    const d = (duration + 0.5).toFixed(2);
    ffmpeg()
      // 이미지를 루프해서 영상으로
      .input(imagePath).inputOptions(['-loop', '1', '-framerate', '25'])
      .input(audioPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]scale=${VW}:${VH}:force_original_aspect_ratio=increase,` +
        `crop=${VW}:${VH},setsar=1[bg]`,
        `[bg][2:v]overlay=0:0:eof_action=repeat,` +
        `fade=t=in:st=0:d=0.5,` +
        `fade=t=out:st=${(parseFloat(d) - 0.6).toFixed(2)}:d=0.6[out]`,
      ])
      .outputOptions([
        '-map', '[out]',
        '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-t', d,
        '-movflags', '+faststart',
        '-af', `afade=t=in:st=0:d=0.3,afade=t=out:st=${(duration - 0.4).toFixed(2)}:d=0.4`,
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
  console.log('=== YouTube 장편 영상 자동 생성 (이미지 기반, 세로형 1080×1920) ===\n');
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
          where: {
            status: 'PUBLISHED',
            category: { slug: 'health' },
            longformGenerated: false,
          },
          orderBy: { publishedAt: 'desc' },
          include: { category: true },
        });

    if (!post) { console.log('장편을 만들 글이 없습니다.'); return; }
    console.log(`대상 글: "${post.title}"\n`);
    console.log(`  본문 길이: ${(post.content || '').length}자 → 스크립트 생성에 활용\n`);

    // 1. 스크립트 생성
    console.log('[1/3] 장편 스크립트 생성 (블로그 본문 전체 반영)...');
    const script = await generateLongformScript(post);
    console.log(`  제목: ${script.youtubeTitle}`);
    console.log(`  챕터: ${script.chapters.length}개\n`);

    // 2. 챕터별 클립 생성
    console.log('[2/3] 챕터별 클립 생성...\n');
    const clipPaths = [];
    const durations = [];

    for (let i = 0; i < script.chapters.length; i++) {
      const ch = script.chapters[i];
      console.log(`  ── 챕터 ${i + 1}/${script.chapters.length}: "${ch.title}" ──`);

      // a) Pexels 이미지
      const imagePath = path.join(tmpDir, `image_${i}.jpg`);
      try {
        console.log(`     🖼️  이미지: "${ch.imageQuery}"`);
        await fetchPexelsPhoto(ch.imageQuery, imagePath);
        console.log(`     ✅ 다운로드 완료`);
      } catch {
        console.log(`     ⚠️ 재시도: "nature calm wellness"`);
        await fetchPexelsPhoto('nature calm wellness', imagePath);
      }

      // b) TTS
      const audioPath = path.join(tmpDir, `audio_${i}.mp3`);
      await generateAudio(ch.narration, audioPath);
      const duration = await getAudioDuration(audioPath);
      durations.push(duration);
      console.log(`     🎙️  내레이션: ${ch.narration.length}자 → ${duration.toFixed(1)}초`);

      // c) 오버레이
      const overlayPath = path.join(tmpDir, `overlay_${i}.png`);
      const html = makeChapterOverlay(ch, i + 1, script.chapters.length);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: overlayPath, omitBackground: true });

      // d) 클립 합성
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(2, '0')}.mp4`);
      await createChapterClip(imagePath, overlayPath, audioPath, duration, clipPath);
      clipPaths.push(clipPath);

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

    // YouTube 업로드
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    const timestamps = buildChapterTimestamps(script.chapters, durations);
    const fullDesc =
      `${script.description}\n\n` +
      `📖 블로그 전문 보기: ${postUrl}\n\n` +
      `─────────────────────\n` +
      `⏱️ 챕터\n${timestamps}\n` +
      `─────────────────────\n\n` +
      `${script.tags.map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #5060건강 #건강정보 #시니어건강`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      const { uploadToYouTube } = require('./youtube-uploader');
      console.log('YouTube 업로드 중...');
      const videoId = await uploadToYouTube({
        videoPath: finalVideoPath,
        title: script.youtubeTitle,
        description: fullDesc,
        tags: [...script.tags, '건강', '5060', '시니어건강', '건강정보'],
        categoryId: '26',
      });
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
      console.log(`\n✅ 저장 완료: ${finalPath}`);
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
