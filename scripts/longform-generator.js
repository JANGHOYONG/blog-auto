/**
 * YouTube 장편 영상 자동 생성 스크립트
 * 방식: 내레이션 + Pexels 배경 영상 + 자막 오버레이
 * 포맷: 1080×1920 세로형, 8~12분
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

const VW = 1080;  // 세로형 (Shorts와 동일 포맷)
const VH = 1920;
const FONT = `'Noto Sans CJK KR','Apple SD Gothic Neo','맑은 고딕','Malgun Gothic',sans-serif`;

// ─── 1. GPT 장편 스크립트 생성 ─────────────────────────────────────────────
async function generateLongformScript(post) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.75,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 5060 시니어를 위한 건강 영상 콘텐츠 작가입니다.
10분짜리 세로형 건강 정보 영상 스크립트를 만듭니다.

핵심 원칙:
- 따뜻하고 친근한 말투 (마치 동네 의사 선생님이 직접 이야기하는 느낌)
- 자연스러운 구어체 (문어체 금지)
- 각 챕터는 1분 30초~2분 분량 내레이션 (약 400~500자)
- 숫자, 통계, 구체적 사례를 자연스럽게 녹여서 설명
- 시청자가 "맞아, 나도 그런 적 있어!" 공감하게 만들기`,
      },
      {
        role: 'user',
        content: `다음 블로그 글을 10분짜리 건강 영상 스크립트로 만들어주세요.

제목: ${post.title}
내용: ${post.excerpt}

JSON 응답:
{
  "youtubeTitle": "유튜브 제목 (60자 이내, 클릭 유도)",
  "description": "영상 설명 (300자, 핵심 내용 요약, 시청자가 얻을 것 명시)",
  "tags": ["건강", "5060건강", "시니어건강", "건강정보", "관련태그"],
  "chapters": [
    {
      "title": "시작하며",
      "videoQuery": "senior relaxing morning routine",
      "narration": "안녕하세요, 5060 건강주치의입니다. 오늘은... (180~220자. 오늘 다룰 내용 소개 + 왜 중요한지 + 청취자 공감 유도. 자연스러운 구어체로)"
    },
    {
      "title": "이것이 무엇인가요?",
      "videoQuery": "doctor patient explanation medical",
      "narration": "그렇다면 먼저... (400~500자. 기본 개념 설명. 어려운 용어는 반드시 쉽게 풀어서. 실생활 비유 사용)"
    },
    {
      "title": "왜 생기는 걸까요?",
      "videoQuery": "health lifestyle food nutrition",
      "narration": "원인을 알면 예방이 가능합니다... (400~500자. 원인 설명. 구체적 통계나 연구 인용. 독자 생활과 연결)"
    },
    {
      "title": "이런 증상이 나타납니다",
      "videoQuery": "elderly woman tired resting",
      "narration": "가장 흔한 증상은... (400~500자. 증상을 일상 언어로 설명. 청취자가 자신의 증상과 비교할 수 있게)"
    },
    {
      "title": "집에서 바로 실천하는 방법",
      "videoQuery": "healthy cooking vegetable kitchen",
      "narration": "오늘부터 바로 할 수 있는 것들입니다... (400~500자. 구체적 실천법 3~5가지. 언제, 어떻게, 얼마나 구체적으로)"
    },
    {
      "title": "주의해야 할 것들",
      "videoQuery": "medical warning caution health",
      "narration": "중요한 주의사항도 말씀드리겠습니다... (400~500자. 잘못된 상식 바로잡기. 언제 병원을 가야 하는지 명확히)"
    },
    {
      "title": "마무리하며",
      "videoQuery": "happy healthy senior couple walking",
      "narration": "오늘 이야기를 정리해 드리겠습니다... (200~250자. 핵심 내용 요약 3줄. 따뜻한 응원. 구독 유도)"
    }
  ]
}`,
      },
    ],
  });
  return JSON.parse(res.choices[0].message.content);
}

// ─── 2. Pexels 세로형 영상 다운로드 ──────────────────────────────────────────
async function fetchPexelsVideo(query, outPath) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY 환경변수가 없습니다.');

  const searches = [
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=10`,
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10`,
  ];

  for (const url of searches) {
    const res = await axios.get(url, { headers: { Authorization: key } });
    const videos = res.data.videos || [];

    for (const video of videos) {
      const files = video.video_files || [];
      // 세로형 우선, 없으면 가로형도 허용 (crop으로 처리)
      const best = files.find((f) => f.quality === 'hd' && f.height >= 1280)
        || files.find((f) => f.quality === 'hd' && f.width >= 1280)
        || files.find((f) => f.quality === 'hd')
        || files[0];

      if (best?.link) {
        const writer = fs.createWriteStream(outPath);
        const response = await axios({ url: best.link, method: 'GET', responseType: 'stream' });
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error(`영상 없음: "${query}"`);
}

// ─── 3. 챕터 오버레이 HTML (세로형 1080×1920) ────────────────────────────────
function makeChapterOverlay(chapter, chapterIdx, totalChapters) {
  const progressPct = Math.round((chapterIdx / totalChapters) * 100);

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

/* 상단 브랜드 배지 */
.top-bar {
  position:absolute; top:0; left:0; right:0;
  height:140px;
  background:linear-gradient(to bottom, rgba(0,0,0,0.80), transparent);
  display:flex; align-items:center; justify-content:center;
  padding-top:30px;
}
.channel-badge {
  background:rgba(0,150,100,0.92);
  border-radius:12px; padding:14px 36px;
  font-size:36px; font-weight:800; color:#fff;
  letter-spacing:2px;
}

/* 챕터 번호 표시 */
.chapter-num {
  position:absolute; top:160px; left:0; right:0;
  text-align:center;
  font-size:30px; font-weight:600;
  color:rgba(100,220,160,0.9);
  letter-spacing:2px;
}

/* 하단 텍스트 영역 */
.bottom-area {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.92) 0%,
    rgba(0,0,0,0.80) 50%,
    transparent 100%
  );
  padding:60px 60px 100px;
  min-height:420px;
  display:flex; flex-direction:column; justify-content:flex-end; gap:20px;
}

.chapter-title {
  font-size:44px; font-weight:800;
  color:rgba(100,220,160,1);
  letter-spacing:1px; line-height:1.3;
  word-break:keep-all;
}

.chapter-desc {
  font-size:36px; font-weight:600;
  color:rgba(255,255,255,0.9); line-height:1.5;
  word-break:keep-all;
  text-shadow: 0 2px 10px rgba(0,0,0,0.95);
}

/* 진행 바 */
.progress-wrap {
  position:absolute; bottom:0; left:0; right:0; height:10px;
  background:rgba(255,255,255,0.15);
}
.progress-fill {
  height:100%; width:${progressPct}%;
  background:linear-gradient(90deg, #00c9a7, #4fc3f7);
}

/* 블로그 URL */
.blog-url {
  position:absolute; bottom:18px; right:40px;
  font-size:26px; color:rgba(255,255,255,0.45); font-weight:600;
}
</style>
</head>
<body>

<div class="top-bar">
  <div class="channel-badge">🏥 5060 건강주치의</div>
</div>
<div class="chapter-num">${chapterIdx} / ${totalChapters} 챕터</div>

<div class="bottom-area">
  <div class="chapter-title">▶ ${chapter.title}</div>
  <div class="chapter-desc">지금 시청 중</div>
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
  // 4000자 이하면 한 번에, 넘으면 분할 처리
  const MAX = 3800;

  if (text.length <= MAX) {
    const res = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'nova',
      input: text,
      speed: 0.88,  // 장편은 더 천천히, 편안하게
    });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return buf.length;
  }

  // 분할: 문장 단위로 나누기
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

  // 청크 오디오 이어붙이기
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

  return fs.statSync(outPath).size;
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

// ─── 6. 챕터 클립 합성 ───────────────────────────────────────────────────────
function createChapterClip(videoPath, overlayPath, audioPath, duration, outPath) {
  return new Promise((resolve, reject) => {
    const d = (duration + 0.5).toFixed(2);
    ffmpeg()
      .input(videoPath).inputOptions(['-stream_loop', '-1'])
      .input(audioPath)
      .input(overlayPath)
      .complexFilter([
        // 세로형 1080×1920 크롭 (가로 영상도 자동 처리)
        `[0:v]scale=${VW}:${VH}:force_original_aspect_ratio=increase,` +
        `crop=${VW}:${VH},setsar=1[bg]`,
        // 오버레이 + 페이드인/아웃 (complexFilter 안에서 처리)
        `[bg][2:v]overlay=0:0,` +
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

// ─── 챕터 타임스탬프 생성 (YouTube 설명용) ───────────────────────────────────
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
  console.log('=== YouTube 장편 영상 자동 생성 (세로형 1080×1920) ===\n');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'longform-'));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });

  try {
    // 대상 글 조회
    const postId = getArg('post-id');
    const post = postId
      ? await prisma.post.findUnique({ where: { id: parseInt(postId) }, include: { category: true } })
      : await prisma.post.findFirst({
          where: {
            status: 'PUBLISHED',
            category: { slug: 'health' },
            shortsGenerated: true,     // 쇼츠 완료된 글 우선
            longformGenerated: false,
          },
          orderBy: { publishedAt: 'desc' },
          include: { category: true },
        });

    if (!post) {
      // fallback: longformGenerated 필드 없는 경우 그냥 최신 글
      console.log('처리할 글을 찾는 중...');
    }
    if (!post) { console.log('장편을 만들 글이 없습니다.'); return; }
    console.log(`대상 글: "${post.title}"\n`);

    // 1. 스크립트 생성
    console.log('[1/3] 장편 스크립트 생성...');
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

      // a) Pexels 배경 영상
      const videoPath = path.join(tmpDir, `video_${i}.mp4`);
      try {
        console.log(`     🎬 배경영상: "${ch.videoQuery}"`);
        await fetchPexelsVideo(ch.videoQuery, videoPath);
        console.log(`     ✅ 다운로드 완료`);
      } catch {
        console.log(`     ⚠️ 재시도: "nature calm relaxing"`);
        await fetchPexelsVideo('nature calm relaxing', videoPath);
      }

      // b) TTS 생성
      const audioPath = path.join(tmpDir, `audio_${i}.mp3`);
      const audioSize = await generateAudio(ch.narration, audioPath);
      const duration = await getAudioDuration(audioPath);
      durations.push(duration);
      console.log(`     🎙️  내레이션: ${ch.narration.length}자 → ${duration.toFixed(1)}초`);

      // c) 오버레이 생성
      const overlayPath = path.join(tmpDir, `overlay_${i}.png`);
      const html = makeChapterOverlay(ch, i + 1, script.chapters.length);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: overlayPath, omitBackground: true });

      // d) 클립 합성
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(2, '0')}.mp4`);
      await createChapterClip(videoPath, overlayPath, audioPath, duration, clipPath);
      clipPaths.push(clipPath);

      const totalSec = durations.reduce((a, b) => a + b, 0);
      console.log(`     ✅ 클립 완료 | 누적: ${Math.floor(totalSec / 60)}분 ${Math.floor(totalSec % 60)}초\n`);
    }

    await browser.close();

    const totalMin = Math.floor(durations.reduce((a, b) => a + b, 0) / 60);
    console.log(`총 ${script.chapters.length}챕터 | 총 길이: 약 ${totalMin}분\n`);

    // 3. 최종 합성
    console.log('[3/3] 최종 영상 합성...');
    const finalVideoPath = path.join(tmpDir, 'longform_final.mp4');
    await concatClips(clipPaths, finalVideoPath);
    const sizeMB = (fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(1);
    console.log(`  완성 영상: ${sizeMB}MB\n`);

    // YouTube 업로드
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    const timestamps = buildChapterTimestamps(script.chapters, durations);
    const fullDesc =
      `${script.description}\n\n` +
      `─────────────────────\n` +
      `⏱️ 챕터\n${timestamps}\n` +
      `─────────────────────\n\n` +
      `📖 자세한 내용: ${postUrl}\n\n` +
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
      }).catch(() => {});  // 필드 없으면 무시

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
