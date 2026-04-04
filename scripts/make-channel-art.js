/**
 * YouTube 채널 프로필 이미지 생성 - 시니어 건강백과
 */
require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');

const SIZE = 800;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${SIZE}px; height:${SIZE}px; overflow:hidden; }
.wrap {
  width:${SIZE}px; height:${SIZE}px;
  background: linear-gradient(135deg, #0d5c45 0%, #1a9e7a 60%, #4fc3a1 100%);
  display:flex; flex-direction:column;
  justify-content:center; align-items:center;
  font-family:'Noto Sans CJK KR','Apple SD Gothic Neo','맑은 고딕',sans-serif;
  border-radius:${SIZE / 2}px;
  position:relative;
  overflow:hidden;
}
/* 배경 장식 원 */
.wrap::before {
  content:'';
  position:absolute;
  width:600px; height:600px;
  border-radius:50%;
  background:rgba(255,255,255,0.06);
  top:-120px; right:-120px;
}
.wrap::after {
  content:'';
  position:absolute;
  width:400px; height:400px;
  border-radius:50%;
  background:rgba(255,255,255,0.05);
  bottom:-100px; left:-80px;
}
.icon { font-size:180px; line-height:1; margin-bottom:16px; position:relative; z-index:1; }
.main {
  font-size:90px; font-weight:900; color:#fff;
  letter-spacing:-1px; line-height:1.15; text-align:center;
  text-shadow: 0 4px 24px rgba(0,0,0,0.3);
  position:relative; z-index:1;
}
.sub {
  font-size:44px; font-weight:700;
  color:rgba(255,255,255,0.80);
  margin-top:16px; letter-spacing:4px;
  position:relative; z-index:1;
}
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">📚</div>
  <div class="main">시니어<br>건강백과</div>
  <div class="sub">Senior Health</div>
</div>
</body>
</html>`;

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 500));

  const outPath = path.join(process.cwd(), 'channel-profile.png');
  await page.screenshot({ path: outPath, type: 'png' });
  await browser.close();

  console.log(`✅ 프로필 이미지 생성 완료: ${outPath}`);
}

main().catch(console.error);
