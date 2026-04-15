/**
 * .env → GitHub Actions Secrets 동기화 스크립트
 *
 * 사용법:
 *   GITHUB_TOKEN=ghp_xxxxxx node scripts/sync-github-secrets.js
 *
 * GitHub PAT 발급: https://github.com/settings/tokens
 *   → Generate new token (classic)
 *   → 권한: repo (전체 체크)
 */

require('dotenv').config();
const https = require('https');
const crypto = require('crypto');

const REPO  = 'JANGHOYONG/blog-auto';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('❌ GITHUB_TOKEN 환경변수가 필요합니다.');
  console.error('   사용법: GITHUB_TOKEN=ghp_xxxx node scripts/sync-github-secrets.js');
  process.exit(1);
}

// 동기화할 시크릿 목록 (키: GitHub Secret 이름, 값: .env 변수 이름)
const SECRET_MAP = {
  DATABASE_URL:              'DATABASE_URL',
  OPENAI_API_KEY:            'OPENAI_API_KEY',
  GOOGLE_TTS_API_KEY:        'GOOGLE_TTS_API_KEY',
  PEXELS_API_KEY:            'PEXELS_API_KEY',
  YOUTUBE_CLIENT_ID:         'YOUTUBE_CLIENT_ID',
  YOUTUBE_CLIENT_SECRET:     'YOUTUBE_CLIENT_SECRET',
  YOUTUBE_REFRESH_TOKEN:     'YOUTUBE_REFRESH_TOKEN',
  NEXT_PUBLIC_SITE_URL:      'NEXT_PUBLIC_SITE_URL',
  REVALIDATE_SECRET:         'REVALIDATE_SECRET',
};

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'secret-sync-script',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: body ? JSON.parse(body) : {} }); }
        catch { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// libsodium 없이 Node.js 내장 crypto로 GitHub secret 암호화
function encryptSecret(publicKeyBase64, secretValue) {
  // GitHub uses libsodium sealed boxes — requires nacl
  // 대신 node-forge 없이 구현하기 어려우므로 sodium-native 사용
  try {
    const sodium = require('libsodium-wrappers-sumo');
    // sodium이 없으면 아래 catch로 이동
    const keyBytes = Buffer.from(publicKeyBase64, 'base64');
    const secretBytes = Buffer.from(secretValue, 'utf8');
    const encrypted = sodium.crypto_box_seal(secretBytes, keyBytes);
    return Buffer.from(encrypted).toString('base64');
  } catch {
    // fallback: tweetsodium 사용
    const sodium = require('tweetsodium');
    const keyBytes = Buffer.from(publicKeyBase64, 'base64');
    const secretBytes = Buffer.from(secretValue, 'utf8');
    const encrypted = sodium.seal(secretBytes, keyBytes);
    return Buffer.from(encrypted).toString('base64');
  }
}

async function main() {
  console.log(`\n🔐 GitHub Secrets 동기화 시작 (${REPO})\n`);

  // 1. 공개 키 가져오기
  const { status: pkStatus, data: pkData } = await apiRequest('GET', `/repos/${REPO}/actions/secrets/public-key`);
  if (pkStatus !== 200) {
    console.error(`❌ 공개 키 조회 실패 (${pkStatus}): 토큰 권한을 확인하세요`);
    process.exit(1);
  }
  const { key_id, key } = pkData;
  console.log(`✅ 공개 키 조회 성공 (key_id: ${key_id})\n`);

  // 2. 각 시크릿 업로드
  let success = 0;
  let fail = 0;
  for (const [secretName, envKey] of Object.entries(SECRET_MAP)) {
    const value = process.env[envKey];
    if (!value) {
      console.log(`⚠️  ${secretName}: .env에 값 없음, 건너뜀`);
      continue;
    }
    try {
      const encryptedValue = encryptSecret(key, value);
      const { status } = await apiRequest('PUT', `/repos/${REPO}/actions/secrets/${secretName}`, {
        encrypted_value: encryptedValue,
        key_id,
      });
      if (status === 201 || status === 204) {
        console.log(`✅ ${secretName} 업로드 완료`);
        success++;
      } else {
        console.log(`❌ ${secretName} 실패 (HTTP ${status})`);
        fail++;
      }
    } catch (e) {
      console.log(`❌ ${secretName} 오류: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n완료: 성공 ${success}개, 실패 ${fail}개`);
}

main().catch(console.error);
