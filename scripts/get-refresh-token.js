/**
 * YouTube OAuth2 Refresh Token 발급 스크립트
 * 실행: node scripts/get-refresh-token.js --code=여기에_승인코드_붙여넣기
 */

require('dotenv').config();
const { google } = require('googleapis');

const args = process.argv.slice(2);
const code = args.find((a) => a.startsWith('--code='))?.split('=').slice(1).join('=');

if (!code) {
  console.error('사용법: node scripts/get-refresh-token.js --code=승인코드');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

async function main() {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Refresh Token 발급 성공!\n');
    console.log('아래 값을 GitHub Secrets에 추가하세요:');
    console.log('─────────────────────────────────────');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('─────────────────────────────────────\n');
  } catch (e) {
    console.error('오류:', e.message);
    console.error('승인 코드가 만료됐을 수 있어요. 다시 URL 접속해서 새 코드를 받아주세요.');
  }
}

main();
