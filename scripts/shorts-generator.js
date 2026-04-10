/**
 * YouTube Shorts 자동 생성 스크립트 v6
 * - 슬라이드당 narration만 사용, 그대로 자막으로 표시
 * - 6슬라이드 × 10초 = 60초 이내
 * - 한국어 TTS: Google ko-KR-Standard-C
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

// ─── 주제별 훅 공식 (쇼츠 특화 — 긍정·정보 전달형) ────────────────────────────
const TOPIC_HOOK_FORMULAS = {
  blood_sugar: {
    formula: '정보공유형',
    hookPatterns: [
      '혈당 걱정된다면, 이 식품부터 알아두세요',
      '혈당을 자연스럽게 낮춰주는 음식이 있어요',
      '당뇨 예방에 진짜 도움 되는 습관, 알려드릴게요',
    ],
    titleFormulas: ['혈당 낮추는 의외의 식품', '혈당 관리에 좋은 생활 습관', '당뇨 예방에 효과적인 방법'],
    imageQueries: ['Korean woman healthy food blood sugar', 'senior woman eating vegetables', 'healthy Korean food glucose'],
  },
  blood_pressure: {
    formula: '정보공유형',
    hookPatterns: [
      '혈압 관리, 이것만 알아도 달라져요',
      '고혈압에 좋은 식품, 제대로 알고 드세요',
      '혈압을 자연스럽게 낮추는 방법이 있어요',
    ],
    titleFormulas: ['혈압에 좋은 식품 TOP3', '혈압 낮추는 생활 습관', '고혈압 관리 핵심 포인트'],
    imageQueries: ['Korean woman healthy heart food', 'senior woman blood pressure healthy', 'healthy lifestyle hypertension'],
  },
  joint: {
    formula: '정보공유형',
    hookPatterns: [
      '무릎 건강, 이 영양소가 핵심이에요',
      '관절에 좋은 운동, 제대로 알고 하세요',
      '연골 지키는 방법, 의외로 간단해요',
    ],
    titleFormulas: ['무릎 건강에 좋은 영양소', '관절 튼튼하게 만드는 방법', '연골 지키는 핵심 습관'],
    imageQueries: ['Korean woman senior stretching exercise', 'Asian woman knee health care', 'senior woman healthy walking'],
  },
  sleep: {
    formula: '정보공유형',
    hookPatterns: [
      '숙면이 건강에 이렇게 중요한 줄 몰랐어요',
      '잠 잘 자는 방법, 생각보다 간단해요',
      '수면 질 높이는 습관, 알려드릴게요',
    ],
    titleFormulas: ['숙면에 좋은 저녁 습관', '수면 질 높이는 방법', '잘 자면 이렇게 달라져요'],
    imageQueries: ['Korean woman sleeping well healthy', 'senior woman good sleep routine', 'Asian woman relaxing bedtime'],
  },
  brain: {
    formula: '정보공유형',
    hookPatterns: [
      '뇌 건강 지키는 습관, 지금부터 시작하세요',
      '기억력 좋아지는 방법이 있어요',
      '치매 예방에 도움 되는 생활 습관이에요',
    ],
    titleFormulas: ['뇌 건강에 좋은 식품', '기억력 높이는 생활 습관', '치매 예방하는 핵심 방법'],
    imageQueries: ['Korean woman brain health food', 'senior woman memory healthy lifestyle', 'Asian woman cognitive health'],
  },
  menopause: {
    formula: '정보공유형',
    hookPatterns: [
      '갱년기 증상, 이렇게 하면 훨씬 편해져요',
      '갱년기에 좋은 식품, 알고 드세요',
      '호르몬 균형 잡는 방법, 알려드릴게요',
    ],
    titleFormulas: ['갱년기 증상 완화하는 방법', '갱년기에 좋은 식품', '호르몬 균형 잡는 습관'],
    imageQueries: ['Korean woman menopause healthy lifestyle', 'senior woman hormone health food', 'Asian woman midlife wellness'],
  },
  nutrition: {
    formula: '정보공유형',
    hookPatterns: [
      '올바른 영양제 복용법, 이것만 기억하세요',
      '시니어에게 꼭 필요한 영양소가 있어요',
      '영양제 효과 제대로 보는 방법이에요',
    ],
    titleFormulas: ['시니어에게 꼭 필요한 영양소', '영양제 제대로 먹는 방법', '건강기능식품 효과적으로 먹기'],
    imageQueries: ['Korean woman taking vitamins healthy', 'senior woman nutrition supplement', 'Asian woman healthy eating habits'],
  },
};

// 건강 7대 주제 키워드로 주제 감지
const HEALTH_WORDS = {
  blood_sugar:    ['혈당', '당뇨', '인슐린', '공복혈당'],
  blood_pressure: ['혈압', '심장', '고혈압', '콜레스테롤', '뇌졸중', '심혈관'],
  joint:          ['관절', '무릎', '연골', '허리', '척추', '근육', '골다공증'],
  sleep:          ['수면', '불면', '피로', '잠', '멜라토닌', '수면장애'],
  brain:          ['치매', '뇌', '기억력', '알츠하이머', '인지', '파킨슨'],
  menopause:      ['갱년기', '폐경', '호르몬', '안면홍조', '에스트로겐'],
  nutrition:      ['영양', '영양제', '비타민', '식이', '보충제', '건강기능식품'],
};

function detectTopicFromPost(post) {
  const text = `${post.title} ${post.excerpt || ''}`;
  for (const [topicId, words] of Object.entries(HEALTH_WORDS)) {
    if (words.some((w) => text.includes(w))) return topicId;
  }
  return null;
}

// ─── 1. GPT 스크립트 생성 (바이럴 v4 — 5슬라이드×3문장=15문장, ~50초) ─────────
async function generateShortsScript(post) {
  const topicId = detectTopicFromPost(post);
  const hookInfo = topicId ? TOPIC_HOOK_FORMULAS[topicId] : null;

  const hookExamples = hookInfo
    ? hookInfo.hookPatterns.map((p) => `"${p}"`).join('\n- ')
    : '"이거 알면 건강이 달라져요"\n- "이렇게 하면 훨씬 좋아집니다"';

  const imageHint = hookInfo ? hookInfo.imageQueries[0] : 'senior health warning';
  const hookTitleExamples = hookInfo
    ? hookInfo.titleFormulas.map((t) => `"${t}"`).join(', ')
    : '"3가지 신호", "몰랐던 진실", "전문의 경고"';

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.80,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 유튜브 쇼츠 바이럴 전문 작가입니다.
5060 시니어가 끝까지 보는 건강 쇼츠를 만듭니다.

핵심 원칙:
① 제목에서 약속한 정보를 영상 안에서 반드시 전달할 것
   - "블로그에서 확인하세요"로만 끝내는 것은 절대 금지 ❌
② 긍정적·도움이 되는 어투로 작성할 것 ✅
   - "이게 좋아요", "이렇게 하면 도움돼요", "알아두면 유익해요" 스타일
   - "위험합니다", "망가집니다", "폭등합니다" 등 공포·부정 표현 금지 ❌
③ 정확한 건강 정보만 사용 — 과장·극단적 주장 금지
   - 귀리처럼 실제로 건강에 좋은 식품을 나쁘다고 하는 오류 절대 금지 ❌
   - 블로그 요약 내용에 근거한 사실만 전달
④ 슬라이드당 정확히 3문장, 전체 15문장 (목표 영상 길이 50초 내외)
   - 문장은 \\n으로 구분, 각 문장 18~28자
   - 슬라이드마다 새로운 정보 추가 — 같은 내용 반복 금지
⑤ 끊어 말하기 스타일 (완벽한 문장보다 자연스러운 구어체)
⑥ 블로그 내용의 구체적 정보(식품명·성분·수치·효능) 반드시 포함
⑦ 이미지 규칙: "Korean woman" 또는 "Asian woman"으로 시작

슬라이드 5개 구조 (각 3문장, 총 15문장, ~50초):
[1번 HOOK  3문장] 관심 끄는 질문 + 왜 봐야 하는지 + 핵심 예고
[2번 BODY-A 3문장] 구체적 식품/방법 소개 + 이유 + 보충 설명
[3번 BODY-B 3문장] 효능 메커니즘 + 수치/연구 데이터 + 심화 설명
[4번 BODY-C 3문장] 올바른 섭취법/실천법 + 주의사항 + 구체적 팁
[5번 ENDING 3문장] 핵심 요약 + 오늘 바로 실천할 한 가지 + 따뜻한 마무리`,
      },
      {
        role: 'user',
        content: `제목: ${post.title}
요약: ${post.excerpt}

훅 참고 예시:
- ${hookExamples}

제목 참고 예시: ${hookTitleExamples}

⚠️ 중요 규칙:
1. 블로그 요약에 근거한 정확한 정보만 사용 (임의로 식품명·수치를 만들어내지 말 것)
2. 긍정적·도움이 되는 어투 유지 ("~에 좋아요", "~하면 도움돼요")
3. 공포·부정 표현 사용 금지 ("위험", "망가짐", "폭등" 등)
4. 시청자가 영상만 봐도 핵심 정보를 얻을 수 있어야 함

JSON 형식:
{
  "youtubeTitle": "유튜브 제목 (40자 이내, 숫자/반전 포함, #Shorts 포함)",
  "hookText": "썸네일 강조 문구 (10~15자)",
  "description": "영상 설명 1줄 (60~80자) + '전체 내용은 블로그에서 확인하세요 👇'",
  "tags": ["건강", "5060건강", "시니어건강", "관련태그"],
  "slides": [
    {
      "type": "hook",
      "narration": "훅 문장 1 (18~28자)\\n훅 문장 2 (18~28자)\\n훅 문장 3 (18~28자)",
      "keyword": "핵심 강조 단어 1~3개",
      "imageQuery": "Korean woman senior portrait ${imageHint}"
    },
    {
      "type": "body",
      "narration": "식품/방법 소개 문장 1\\n이유 설명 문장 2\\n보충 설명 문장 3",
      "keyword": "핵심 단어",
      "imageQuery": "Korean woman 주제관련 영어단어"
    },
    {
      "type": "body",
      "narration": "메커니즘 설명 문장 1\\n수치/연구 데이터 문장 2\\n심화 설명 문장 3",
      "keyword": "핵심 단어",
      "imageQuery": "Korean woman 주제관련 영어단어"
    },
    {
      "type": "body",
      "narration": "섭취법/실천법 문장 1\\n주의사항 문장 2\\n구체적 팁 문장 3",
      "keyword": "핵심 단어",
      "imageQuery": "Asian woman senior 주제관련 영어단어"
    },
    {
      "type": "ending",
      "narration": "핵심 요약 문장 1\\n오늘 바로 실천할 것 문장 2\\n따뜻한 마무리 문장 3",
      "keyword": "핵심 단어",
      "imageQuery": "Korean woman senior healthy smile"
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

// ─── 3. 오버레이 HTML - 바이럴 v2: 키워드 강조 + 썸네일 특화 ─────────────────
function makeOverlayHtml(narration, slideIdx, totalSlides, keyword = '', type = 'body') {
  // 레이아웃 (1080×1920):
  //  ① 상단 흰색 바  : y=0    ~ y=190   (브랜드)
  //  ② 이미지 창     : y=190  ~ y=1080  (투명 — 배경 이미지 표시)
  //  ③ 하단 자막 바  : y=1080 ~ y=1680  (흰색 — 텍스트)
  //  ④ 하단 여백     : y=1680 ~ y=1920  (YouTube UI 겹침 방지)

  const progress = Math.round((slideIdx / totalSlides) * 100);
  const isHook   = type === 'hook';
  const kwColor  = type === 'ending' ? '#7EFFC5' : '#FFD700';
  const progressColor = isHook
    ? 'linear-gradient(90deg, #FF6B35, #FFD700)'
    : 'linear-gradient(90deg, #1E9E7A, #4fc3f7)';

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

/* ① 상단 흰색 바 (y=0~190) */
.top-bar {
  position:absolute;
  top:0; left:0; right:0; height:190px;
  background:#ffffff;
  border-bottom:4px solid rgba(30,158,122,0.25);
  display:flex; align-items:center; justify-content:center;
}
.brand-inner {
  display:flex; align-items:center; gap:16px;
}
.brand-icon { font-size:48px; line-height:1; }
.brand-text  { font-size:46px; font-weight:900; color:#1E9E7A; letter-spacing:1px; }

/* ② 이미지 창 위 — 훅 배지 (hook 슬라이드) */
.hook-badge {
  position:absolute;
  top:220px; left:50%; transform:translateX(-50%);
  background:linear-gradient(135deg, #1E9E7A, #177A5E);
  color:#fff; white-space:nowrap;
  font-size:36px; font-weight:800;
  padding:14px 52px; border-radius:60px;
  box-shadow:0 4px 20px rgba(0,0,0,0.35);
}

/* ② 이미지 창 위 — 키워드 강조 (이미지 중앙) */
.keyword-area {
  position:absolute;
  top:490px; left:50%;
  transform:translateX(-50%);
  width:980px; text-align:center;
}
.keyword-text {
  font-size:92px; font-weight:900;
  color:${kwColor};
  line-height:1.20; word-break:keep-all;
  text-shadow:0 4px 12px rgba(0,0,0,0.95), 0 8px 40px rgba(0,0,0,0.85);
  letter-spacing:-2px;
}
.keyword-text.hook-kw {
  font-size:100px;
  text-shadow:0 4px 10px rgba(0,0,0,1),
    -3px 0 0 rgba(200,0,0,0.55), 3px 0 0 rgba(200,0,0,0.55);
}

/* ③ 하단 흰색 자막 바 (y=1080~1680) — 60대 고가독성 */
.caption-bar {
  position:absolute;
  top:1080px; left:0; right:0; height:600px;
  background:#ffffff;
  border-top:5px solid rgba(30,158,122,0.4);
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  padding:32px 56px; gap:18px;
}
.caption-text {
  font-size:56px; font-weight:900; color:#111111;
  line-height:1.55; word-break:keep-all;
  text-align:center; letter-spacing:-0.5px;
}
.caption-url {
  font-size:28px; font-weight:700; color:#1E9E7A;
}

/* ④ 진행 바 (y=1700) — YouTube UI 여백 안 */
.progress-track {
  position:absolute;
  top:1700px; left:0; right:0; height:14px;
  background:rgba(0,0,0,0.08);
}
.progress-fill {
  height:100%; width:${progress}%;
  background:${progressColor};
  border-radius:0 7px 7px 0;
}
</style>
</head>
<body>

<!-- ① 상단 흰색 바 -->
<div class="top-bar">
  <div class="brand-inner">
    <span class="brand-icon">🏥</span>
    <span class="brand-text">시니어 건강백과</span>
  </div>
</div>

<!-- ② 이미지 창 위 요소 -->
${isHook ? '<div class="hook-badge">✅ 지금 바로 알아보세요</div>' : ''}
${keyword ? `<div class="keyword-area"><div class="keyword-text${isHook ? ' hook-kw' : ''}">${keyword}</div></div>` : ''}

<!-- ③ 하단 흰색 자막 바 -->
<div class="caption-bar">
  <div class="caption-text">${narration.replace(/\n/g, '<br>')}</div>
  <div class="caption-url">smartinfoblog.co.kr</div>
</div>

<!-- ④ 진행 바 -->
<div class="progress-track">
  <div class="progress-fill"></div>
</div>

</body>
</html>`;
}

// ─── 4. TTS 생성 (Google Cloud TTS - ko-KR-Standard-C) ───────────────────────
async function generateAudio(narration, outPath) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY 환경변수가 없습니다.');

  // \n → ", " 변환: TTS가 끊어 읽도록 자연스러운 쉼 삽입
  const ttsText = narration.replace(/\n/g, ', ');

  const res = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      input: { text: ttsText },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Standard-C' },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.10,   // 0.90 → 1.10: 자연스럽게 빠른 속도
        pitch: -2.0,          // 약간 낮은 피치: 또박또박 느낌 감소
      },
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

// ─── 8. 썸네일 전용 HTML (제목·키워드가 크게 보이는 타이틀 카드) ──────────────
function makeThumbnailHtml(youtubeTitle, keyword) {
  const kwFontSize = keyword.length > 8 ? 84 : 100;
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
.top-bar {
  position:absolute; top:0; left:0; right:0; height:200px;
  background:#ffffff;
  border-bottom:5px solid rgba(30,158,122,0.3);
  display:flex; align-items:center; justify-content:center; gap:18px;
}
.brand-icon { font-size:56px; line-height:1; }
.brand-text  { font-size:50px; font-weight:900; color:#1E9E7A; letter-spacing:0.5px; }
.keyword-wrap {
  position:absolute; top:260px; left:60px; right:60px;
  display:flex; flex-direction:column; align-items:center; gap:28px;
}
.topic-badge {
  background:linear-gradient(135deg,#1E9E7A,#177A5E);
  color:#fff; font-size:38px; font-weight:800;
  padding:18px 56px; border-radius:60px; letter-spacing:0.5px;
  box-shadow:0 6px 24px rgba(0,0,0,0.35);
}
.keyword-text {
  font-size:${kwFontSize}px; font-weight:900;
  color:#FFD700; line-height:1.2;
  word-break:keep-all; text-align:center;
  text-shadow:
    0 4px 8px rgba(0,0,0,0.95), 0 8px 40px rgba(0,0,0,0.85),
    -3px -3px 0 rgba(0,0,0,0.7), 3px -3px 0 rgba(0,0,0,0.7),
    -3px  3px 0 rgba(0,0,0,0.7), 3px  3px 0 rgba(0,0,0,0.7);
  letter-spacing:-1px;
}
.title-bar {
  position:absolute; bottom:240px; left:0; right:0;
  background:#ffffff; padding:44px 64px 36px;
  border-top:6px solid #1E9E7A;
}
.title-text {
  font-size:58px; font-weight:900; color:#1B3A32;
  line-height:1.35; word-break:keep-all; text-align:center;
  letter-spacing:-0.5px;
}
.site-url {
  font-size:30px; font-weight:700; color:#1E9E7A;
  text-align:center; margin-top:18px; opacity:0.85;
}
.bottom-pad {
  position:absolute; bottom:0; left:0; right:0; height:240px;
  background:#ffffff;
  border-top:2px solid rgba(30,158,122,0.15);
}
</style>
</head>
<body>
<div class="top-bar">
  <span class="brand-icon">🏥</span>
  <span class="brand-text">시니어 건강백과</span>
</div>
<div class="keyword-wrap">
  <div class="topic-badge">🎯 오늘의 건강 정보</div>
  <div class="keyword-text">${keyword}</div>
</div>
<div class="title-bar">
  <div class="title-text">${youtubeTitle}</div>
  <div class="site-url">smartinfoblog.co.kr</div>
</div>
<div class="bottom-pad"></div>
</body>
</html>`;
}

// ─── 8-b. 배경 이미지 + 썸네일 오버레이 합성 → JPEG ────────────────────────────
function compositeThumbnail(bgPath, overlayPath, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(bgPath)
      .input(overlayPath)
      .complexFilter([
        `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[bg]`,
        `[bg][1:v]overlay=0:0[out]`,
      ])
      .map('[out]')
      .outputOptions(['-frames:v', '1', '-q:v', '2'])
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== 유튜브 쇼츠 v7 (바이럴 5슬라이드, 25~35초) ===\n');
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
    slides.forEach((s, i) => console.log(`    ${i + 1}. [${s.type}] 키워드:"${s.keyword}" | ${s.narration.replace(/\n/g, ' / ').slice(0, 30)}...`));
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
        console.log(`     ⚠️ 재시도: "Korean woman senior health"`);
        await fetchPexelsPhoto('Korean woman senior health', imagePath);
      }

      // b) TTS - narration 그대로 읽기
      const audioPath = path.join(tmpDir, `audio_${i}.mp3`);
      await generateAudio(slide.narration, audioPath);
      const duration = await getAudioDuration(audioPath);
      totalDuration += duration + 0.3;
      console.log(`     🔊 ${slide.narration.length}자 → ${duration.toFixed(1)}초`);

      // c) 오버레이 - 키워드 강조 + 나레이션 분리 표시
      const overlayPath = path.join(tmpDir, `overlay_${i}.png`);
      const html = makeOverlayHtml(slide.narration, i + 1, slides.length, slide.keyword || '', slide.type || 'body');
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: overlayPath, omitBackground: true });

      // d) 클립 합성
      const clipPath = path.join(tmpDir, `clip_${String(i).padStart(2, '0')}.mp4`);
      await createSlideClip(imagePath, overlayPath, audioPath, duration, clipPath);
      clipPaths.push(clipPath);
      console.log(`     ✅ 완료\n`);
    }

    // 썸네일 오버레이 PNG — 브라우저 닫기 전에 생성
    const thumbOverlayPath = path.join(tmpDir, 'thumb_overlay.png');
    try {
      const thumbHtml = makeThumbnailHtml(script.youtubeTitle, slides[0]?.keyword || script.keyword || '');
      await page.setContent(thumbHtml, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: thumbOverlayPath, omitBackground: true });
      console.log('  📸 썸네일 오버레이 생성 완료\n');
    } catch (e) {
      console.log(`  ⚠️ 썸네일 오버레이 생성 실패: ${e.message}\n`);
    }

    await browser.close();
    console.log(`총 ${slides.length}슬라이드 | 예상 길이: ~${totalDuration.toFixed(0)}초\n`);

    // 3. 최종 합성
    console.log('[3/3] 최종 영상 합성...');
    const finalPath = path.join(tmpDir, 'shorts_final.mp4');
    await concatClips(clipPaths, finalPath);
    const sizeMB = (fs.statSync(finalPath).size / 1024 / 1024).toFixed(1);
    console.log(`  완성: ${sizeMB}MB\n`);

    // 4. 업로드 또는 저장
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartinfoblog.co.kr';
    const postUrl = `${siteUrl}/${post.category.slug}/${post.slug}`;
    // 블로그 링크를 첫 줄에 배치 — 설명란을 펼치면 바로 클릭 가능
    const fullDesc =
      `📖 전체 내용 블로그에서 보기 👇\n` +
      `${postUrl}\n\n` +
      `${script.description}\n\n` +
      `이 영상이 도움이 됐다면 구독 & 좋아요 눌러주세요! 💚\n` +
      `매일 새로운 5060 건강 정보를 쇼츠로 전해드립니다.\n\n` +
      `─────────────────────\n` +
      `${(script.tags || []).map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #Shorts #건강정보 #시니어건강 #5060건강`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      const { uploadToYouTube, uploadThumbnail, postComment } = require('./youtube-uploader');
      const videoId = await uploadToYouTube({
        videoPath: finalPath,
        title: script.youtubeTitle,
        description: fullDesc,
        tags: [...(script.tags || []), '건강', '시니어', '건강정보', 'Shorts'],
        categoryId: '26',
      });

      // 타이틀 카드 썸네일 업로드 (배경 이미지 + 오버레이 합성)
      try {
        const thumbJpgPath = path.join(tmpDir, 'thumbnail.jpg');
        const firstImagePath = path.join(tmpDir, 'image_0.jpg');
        console.log('  썸네일 합성 중...');
        await compositeThumbnail(firstImagePath, thumbOverlayPath, thumbJpgPath);
        await uploadThumbnail({ videoId, thumbnailPath: thumbJpgPath });
        console.log('  썸네일 업로드 완료 ✅');
      } catch (thumbErr) {
        console.log(`  썸네일 업로드 실패 (건너뜀): ${thumbErr.message}`);
      }

      // 댓글로 블로그 링크 게시 — 채널 규모 무관하게 항상 클릭 가능
      try {
        await postComment({
          videoId,
          text: `📖 영상에서 다 못 담은 내용, 블로그에서 확인하세요 👇\n${postUrl}`,
        });
        console.log('  블로그 링크 댓글 게시 완료 ✅');
      } catch (commentErr) {
        // 댓글 스코프(youtube.force-ssl) 없으면 조용히 건너뜀
        console.log(`  댓글 게시 건너뜀: ${commentErr.message}`);
      }

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
