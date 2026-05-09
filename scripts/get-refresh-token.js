/**
 * YouTube OAuth2 Refresh Token 발급 스크립트 (localhost 방식)
 * Google은 2022년 OOB(urn:ietf:wg:oauth:2.0:oob) 방식을 폐기함
 *
 * 사전 준비:
 *   Google Cloud Console → OAuth 클라이언트 → Authorized redirect URIs에
 *   http://localhost:3000 추가 필요
 *
 * 실행: node scripts/get-refresh-token.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const REDIRECT_URI = 'http://localhost:3000';

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('\n====================================');
console.log('YouTube Refresh Token 발급 시작');
console.log('====================================\n');
console.log('아래 URL을 브라우저에 붙여넣고 Google 계정으로 로그인하세요:\n');
console.log(authUrl);
console.log('\n로그인 후 자동으로 토큰이 발급됩니다...\n');

// localhost:3000에서 콜백 대기
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const code = parsed.query.code;

  if (!code) {
    res.writeHead(400);
    res.end('승인 코드가 없습니다. 다시 시도해주세요.');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h2>✅ 인증 완료!</h2>
      <p>터미널에서 Refresh Token을 확인하세요.<br>이 창은 닫아도 됩니다.</p>
    </body></html>
  `);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Refresh Token 발급 성공!\n');
    console.log('아래 값을 GitHub Secrets > YOUTUBE_REFRESH_TOKEN 에 붙여넣으세요:');
    console.log('─────────────────────────────────────────────────────');
    console.log(tokens.refresh_token);
    console.log('─────────────────────────────────────────────────────\n');
  } catch (e) {
    console.error('\n❌ 토큰 발급 실패:', e.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(3000, () => {
  console.log('localhost:3000 대기 중 — 브라우저에서 위 URL을 열어주세요\n');
});
