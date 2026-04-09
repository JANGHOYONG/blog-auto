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

async function uploadThumbnail({ videoId, thumbnailPath }) {
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  await youtube.thumbnails.set({
    videoId,
    media: {
      mimeType: 'image/png',
      body: fs.createReadStream(thumbnailPath),
    },
  });
}

/**
 * 영상 업로드 직후 댓글로 블로그 링크 게시
 * - 댓글은 채널 규모 무관하게 항상 클릭 가능한 링크로 표시됨
 * - 필요 스코프: https://www.googleapis.com/auth/youtube.force-ssl
 */
async function postComment({ videoId, text }) {
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const res = await youtube.commentThreads.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: { textOriginal: text },
        },
      },
    },
  });
  return res.data.id;
}

module.exports = { uploadToYouTube, uploadThumbnail, postComment };
