/**
 * YouTube Data API v3 업로드 모듈
 * 필요한 환경변수:
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 */

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

async function uploadToYouTube({ videoPath, title, description, tags, categoryId = '26' }) {
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const fileSize = fs.statSync(videoPath).size;
  console.log(`  파일 크기: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId,
        defaultLanguage: 'ko',
        defaultAudioLanguage: 'ko',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  }, {
    onUploadProgress: (evt) => {
      const progress = Math.round((evt.bytesRead / fileSize) * 100);
      process.stdout.write(`\r  업로드 진행: ${progress}%`);
    },
  });

  console.log('');
  return response.data.id;
}

module.exports = { uploadToYouTube };
