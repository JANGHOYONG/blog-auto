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

// ─── 주제별 훅 공식 (쇼츠 특화) ──────────────────────────────────────────────
const TOPIC_HOOK_FORMULAS = {
  blood_sugar: {
    formula: '반전형',
    hookPatterns: [
      '"건강에 좋다"고 먹던 그 음식, 혈당 폭등시키고 있었습니다',
      '공복혈당 정상인데 당뇨라고요? 병원도 모르는 진짜 위험 신호',
      '혈당 낮추는 약보다 효과 있다는 이것, 알고 계세요?',
    ],
    titleFormulas: ['혈당 올리는 의외의 식품', '당뇨 전단계 숨겨진 신호', '혈당 잡는 반전 방법'],
    imageQueries: ['blood sugar food surprising', 'diabetes warning sign', 'glucose health test'],
  },
  blood_pressure: {
    formula: '경고형',
    hookPatterns: [
      '혈압약과 함께 먹으면 위험한 것들, 지금 드시고 있지 않나요?',
      '아침 혈압이 높은 이유, 뇌졸중과 직접 연결됩니다',
      '혈압 재는 방법 잘못되면 수치가 20 달라집니다. 지금 확인하세요',
    ],
    titleFormulas: ['혈압약과 절대 같이 먹으면 안 되는 것', '아침 고혈압의 충격적 진실', '혈압 오해와 진실'],
    imageQueries: ['blood pressure danger warning', 'hypertension morning risk', 'blood pressure monitor wrong'],
  },
  joint: {
    formula: '반전형',
    hookPatterns: [
      '무릎에 좋다고 걷기 운동? 오히려 연골 망가지는 경우 있습니다',
      '콜라겐 영양제 드시고 계신가요? 최신 연구 결과가 충격적입니다',
      '무릎 통증, 진짜 원인이 무릎이 아닐 수 있습니다',
    ],
    titleFormulas: ['걷기가 무릎 망친다?', '콜라겐 영양제의 불편한 진실', '무릎 통증 진짜 원인'],
    imageQueries: ['knee pain wrong exercise', 'joint collagen supplement false', 'knee pain hip cause'],
  },
  sleep: {
    formula: '증상체크형',
    hookPatterns: [
      '자다가 이 증상 있으면 치매 위험 3배입니다. 지금 체크해보세요',
      '수면제가 치매를 앞당긴다는 연구 결과가 나왔습니다',
      '몇 시에 일어나느냐가 심장마비 위험을 결정한다고요?',
    ],
    titleFormulas: ['수면 중 치매 경고 신호', '수면제의 충격적 부작용', '기상 시간과 심장마비'],
    imageQueries: ['sleep apnea brain danger', 'sleeping pill dementia risk', 'wake up time heart health'],
  },
  brain: {
    formula: '의사가 안 알려주는형',
    hookPatterns: [
      '치매는 10년 전부터 시작됩니다. 지금 이 증상, 노화가 아닙니다',
      '매일 드시는 약이 뇌를 망가뜨리고 있을 수 있습니다',
      '이 닦기와 치매가 연결된다고요? 전문의들도 놀란 연구입니다',
    ],
    titleFormulas: ['치매 10년 전 신호', '뇌 망치는 의외의 약', '구강 건강과 치매의 연결고리'],
    imageQueries: ['dementia early warning sign', 'medication brain damage side effect', 'oral health brain connection'],
  },
  menopause: {
    formula: '숫자/반전형',
    hookPatterns: [
      '갱년기 여성 10명 중 7명이 안면홍조 원인을 잘못 알고 있습니다',
      '호르몬 치료가 암을 유발한다? 최신 연구가 완전히 뒤집었습니다',
      '60대 남성 2명 중 1명이 갱년기를 겪지만 모르고 있습니다',
    ],
    titleFormulas: ['안면홍조 진짜 원인', '호르몬 치료 오해와 진실', '남성 갱년기 몰랐던 사실'],
    imageQueries: ['menopause hot flash truth', 'hormone therapy safe research', 'male menopause senior'],
  },
  nutrition: {
    formula: '금지/경고형',
    hookPatterns: [
      '함께 먹으면 독이 되는 영양제 조합, 지금 드시고 있을 수 있습니다',
      '건강기능식품이 처방약 효과를 완전히 없앤다고요? 실제 사례입니다',
      '비타민D 많이 먹으면 좋다고요? 독성 축적되면 이렇게 됩니다',
    ],
    titleFormulas: ['같이 먹으면 독이 되는 영양제', '건강기능식품의 위험한 함정', '비타민 과다복용 부작용'],
    imageQueries: ['supplement combination dangerous', 'health supplement drug interaction', 'vitamin overdose toxicity'],
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

// ─── 1. GPT 스크립트 생성 (바이럴 v2 — HOOK/BODY×3/ENDING) ──────────────────
async function generateShortsScript(post) {
  const topicId = detectTopicFromPost(post);
  const hookInfo = topicId ? TOPIC_HOOK_FORMULAS[topicId] : null;

  const hookExamples = hookInfo
    ? hookInfo.hookPatterns.map((p) => `"${p}"`).join('\n- ')
    : '"이거 매일 하면 몸 망가집니다"\n- "대부분 이거 잘못 알고 있음"';

  const imageHint = hookInfo ? hookInfo.imageQueries[0] : 'senior health warning';
  const hookTitleExamples = hookInfo
    ? hookInfo.titleFormulas.map((t) => `"${t}"`).join(', ')
    : '"3가지 신호", "몰랐던 진실", "전문의 경고"';

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.85,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `당신은 유튜브 쇼츠 바이럴 전문 작가입니다.
5060 시니어가 끝까지 보는 건강 쇼츠를 만듭니다.
목표: AI 티 없이 '사람이 만든 것처럼' 보이게 만들기.

핵심 원칙:
- 완벽한 문장 금지 ❌
- 끊어 말하기 ✅ (narration 내 \\n으로 끊기)
- 짧고 강하게 ✅
- 뻔한 조언 금지 ❌ (운동하세요, 식단 관리 등)
- 반전·충격·공감 ✅

대본 스타일 예시:
❌ 나쁜 예: "이 음식은 건강에 매우 좋습니다."
⭕ 좋은 예: "이거요\\n생각보다 진짜 중요합니다"
⭕ 좋은 예: "대부분 모릅니다\\n이게 진짜 원인이에요"

슬라이드 5개 구조 (총 25~35초):
[1번 HOOK  0~3초 ] 스크롤 멈추게 만드는 한 마디. 무조건 짧고 강하게.
[2번 BODY-A 4~8초 ] 핵심 정보 1개. 끊어서 말하기.
[3번 BODY-B 9~13초] 핵심 정보 2개 or 반전. 끊어서 말하기.
[4번 BODY-C 14~18초] 핵심 정보 3개 or 충격 데이터. 끊어서 말하기.
[5번 ENDING 19~25초] 애매하게 끝내서 궁금증 남기기 + 블로그 유도.`,
      },
      {
        role: 'user',
        content: `제목: ${post.title}
요약: ${post.excerpt}

훅 참고 예시 (이런 톤으로):
- ${hookExamples}

제목 참고 예시: ${hookTitleExamples}

아래 JSON 형식으로 작성하세요:
{
  "youtubeTitle": "유튜브 제목 (40자 이내, 숫자/반전 포함, #Shorts 포함)",
  "hookText": "썸네일 강조 문구 (10~15자, 예: '지금 바로 확인', '이게 진짜 원인')",
  "description": "영상 설명 1줄 (60~80자) + '전체 내용은 블로그에서 확인하세요 👇'",
  "tags": ["건강", "5060건강", "시니어건강", "관련태그"],
  "slides": [
    {
      "type": "hook",
      "narration": "끊어쓰기\\n포함된 훅 나레이션 (25~35자)",
      "keyword": "화면에 크게 표시할 핵심 단어 1~3개",
      "imageQuery": "portrait senior face ${imageHint}"
    },
    {
      "type": "body",
      "narration": "끊어쓰기\\n포함된 BODY-A (30~45자)",
      "keyword": "화면 강조 단어",
      "imageQuery": "영어 검색어 2~3단어"
    },
    {
      "type": "body",
      "narration": "끊어쓰기\\n포함된 BODY-B (30~45자)",
      "keyword": "화면 강조 단어",
      "imageQuery": "영어 검색어 2~3단어"
    },
    {
      "type": "body",
      "narration": "끊어쓰기\\n포함된 BODY-C (30~45자)",
      "keyword": "화면 강조 단어",
      "imageQuery": "영어 검색어 2~3단어"
    },
    {
      "type": "ending",
      "narration": "궁금증 남기는 마무리\\n블로그에서 확인하세요 (35~50자)",
      "keyword": "화면 강조 단어",
      "imageQuery": "happy senior healthy smile"
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
  const progress = Math.round((slideIdx / totalSlides) * 100);
  const isThumbnail = type === 'hook';

  // 썸네일 슬라이드(1번) — 강렬한 훅 디자인
  if (isThumbnail) {
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
  background:rgba(0,100,70,0.95);
  border-radius:60px; padding:18px 52px;
  display:flex; align-items:center; gap:16px;
  box-shadow:0 4px 24px rgba(0,0,0,0.45);
  border:3px solid rgba(255,255,255,0.2);
}
.brand-icon { font-size:44px; line-height:1; }
.brand-text { font-size:40px; font-weight:800; color:#fff; letter-spacing:2px; }

/* 중앙 강조 훅 박스 (썸네일 핵심) */
.hook-area {
  position:absolute;
  top:48%; left:50%;
  transform:translate(-50%, -50%);
  width:960px;
  text-align:center;
}
.hook-badge {
  display:inline-block;
  background:linear-gradient(135deg, #FF3B30, #FF6B35);
  color:#fff;
  font-size:38px; font-weight:900;
  padding:16px 48px; border-radius:60px;
  margin-bottom:32px;
  box-shadow:0 6px 24px rgba(255,59,48,0.60);
  letter-spacing:1px;
}
/* keyword — 빨강+노랑 강조 텍스트 (썸네일 메인) */
.hook-keyword {
  font-size:96px;
  font-weight:900;
  color:#FFD700;
  line-height:1.20;
  word-break:keep-all;
  text-shadow:
    0 4px 10px rgba(0,0,0,1),
    0 8px 40px rgba(0,0,0,0.95),
    -3px 0 0 rgba(200,0,0,0.7),
     3px 0 0 rgba(200,0,0,0.7);
  letter-spacing:-2px;
  margin-bottom:16px;
}
.hook-main {
  font-size:58px;
  font-weight:800;
  color:#ffffff;
  line-height:1.35;
  word-break:keep-all;
  text-shadow:
    0 3px 8px rgba(0,0,0,1),
    0 6px 30px rgba(0,0,0,0.95);
  letter-spacing:-1px;
}

/* 하단 자막 영역 */
.subtitle-area {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.96) 0%,
    rgba(0,0,0,0.88) 50%,
    rgba(0,0,0,0.35) 80%,
    transparent 100%
  );
  padding:50px 55px 240px;
  min-height:420px;
  display:flex; align-items:flex-end;
}
.subtitle-text {
  font-size:54px; font-weight:800; color:#ffffff;
  line-height:1.50; word-break:keep-all;
  text-shadow:0 2px 6px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.95);
  letter-spacing:-0.5px;
}

/* 진행 바 */
.progress-track {
  position:absolute; bottom:0; left:0; right:0; height:14px;
  background:rgba(255,255,255,0.15);
}
.progress-fill {
  height:100%; width:${progress}%;
  background:linear-gradient(90deg, #FF6B35, #FFD700);
  border-radius:0 7px 7px 0;
}

/* 채널 URL */
.channel-url {
  position:absolute; bottom:22px; left:0; right:0;
  text-align:center; font-size:30px; font-weight:600;
  color:rgba(255,255,255,0.60);
}
</style>
</head>
<body>

<div class="brand">
  <div class="brand-inner">
    <span class="brand-icon">🏥</span>
    <span class="brand-text">시니어 건강백과</span>
  </div>
</div>

<div class="hook-area">
  <div class="hook-badge">⚠️ 지금 바로 확인하세요</div>
  ${keyword ? `<div class="hook-keyword">${keyword}</div>` : ''}
  <div class="hook-main">${narration.replace(/\n/g, '<br>')}</div>
</div>

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

  // 일반 슬라이드 (2~6번)
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
  background:rgba(0,100,70,0.92);
  border-radius:60px; padding:16px 44px;
  display:flex; align-items:center; gap:14px;
  box-shadow:0 4px 20px rgba(0,0,0,0.35);
}
.brand-icon { font-size:38px; line-height:1; }
.brand-text { font-size:36px; font-weight:800; color:#fff; letter-spacing:2px; }

/* 중앙 키워드 강조 영역 */
.keyword-area {
  position:absolute;
  top:44%; left:50%;
  transform:translate(-50%, -50%);
  width:960px;
  text-align:center;
}
.keyword-text {
  font-size:88px;
  font-weight:900;
  color:#FFD700;
  line-height:1.25;
  word-break:keep-all;
  text-shadow:
    0 4px 12px rgba(0,0,0,1),
    0 8px 40px rgba(0,0,0,0.95),
    0 0 80px rgba(0,0,0,0.8);
  letter-spacing:-2px;
}
.keyword-text.ending {
  color:#7EFFC5;
}

/* 하단 나레이션 영역 */
.subtitle-area {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(
    to top,
    rgba(0,0,0,0.96) 0%,
    rgba(0,0,0,0.88) 45%,
    rgba(0,0,0,0.40) 78%,
    transparent 100%
  );
  padding:50px 55px 220px;
  min-height:440px;
  display:flex; align-items:flex-end;
}
.subtitle-text {
  font-size:50px; font-weight:700; color:#ffffff;
  line-height:1.55; word-break:keep-all;
  text-shadow:0 2px 6px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.95);
  letter-spacing:-0.5px;
}

/* 진행 바 */
.progress-track {
  position:absolute; bottom:0; left:0; right:0; height:12px;
  background:rgba(255,255,255,0.18);
}
.progress-fill {
  height:100%; width:${progress}%;
  background:linear-gradient(90deg, #1abc9c, #4fc3f7);
  border-radius:0 6px 6px 0;
}

/* 채널 URL */
.channel-url {
  position:absolute; bottom:20px; left:0; right:0;
  text-align:center; font-size:30px; font-weight:600;
  color:rgba(255,255,255,0.55);
}
</style>
</head>
<body>

<div class="brand">
  <div class="brand-inner">
    <span class="brand-icon">🏥</span>
    <span class="brand-text">시니어 건강백과</span>
  </div>
</div>

${keyword ? `
<div class="keyword-area">
  <div class="keyword-text${type === 'ending' ? ' ending' : ''}">${keyword}</div>
</div>` : ''}

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

// ─── 8. 첫 슬라이드 프레임 추출 (썸네일용) ────────────────────────────────────
function extractFirstFrame(videoPath, outPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vframes', '1', '-ss', '0.3'])
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
        console.log(`     ⚠️ 재시도: "senior health"`);
        await fetchPexelsPhoto('senior health', imagePath);
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
    const fullDesc =
      `${script.description}\n\n` +
      `📖 블로그에서 전체 내용 확인하기 👇\n` +
      `${postUrl}\n\n` +
      `이 영상이 도움이 됐다면 구독 & 좋아요 눌러주세요! 💚\n` +
      `매일 새로운 5060 건강 정보를 쇼츠로 전해드립니다.\n\n` +
      `─────────────────────\n` +
      `${(script.tags || []).map((t) => '#' + t.replace(/\s/g, '')).join(' ')} #Shorts #건강정보 #시니어건강 #5060건강`;

    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      const { uploadToYouTube, uploadThumbnail } = require('./youtube-uploader');
      const videoId = await uploadToYouTube({
        videoPath: finalPath,
        title: script.youtubeTitle,
        description: fullDesc,
        tags: [...(script.tags || []), '건강', '시니어', '건강정보', 'Shorts'],
        categoryId: '26',
      });

      // 첫 슬라이드 프레임을 썸네일로 설정
      try {
        const thumbPath = path.join(tmpDir, 'thumbnail.jpg');
        console.log('  썸네일 추출 중...');
        await extractFirstFrame(clipPaths[0], thumbPath);
        await uploadThumbnail({ videoId, thumbnailPath: thumbPath });
        console.log('  썸네일 업로드 완료 ✅');
      } catch (thumbErr) {
        console.log(`  썸네일 업로드 실패 (건너뜀): ${thumbErr.message}`);
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
