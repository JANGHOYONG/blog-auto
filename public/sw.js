// 시니어 건강백과 Service Worker
// 목적: PWA 설치 프롬프트 활성화 + 오프라인 홈페이지 대응

const CACHE_NAME = 'senior-health-v1';
const OFFLINE_URL = '/';

// 설치: 오프라인 페이지 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// 활성화: 오래된 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: 네트워크 우선, 실패 시 캐시 사용
self.addEventListener('fetch', (event) => {
  // 같은 출처 GET 요청만 처리
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공한 응답은 캐시에 저장
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // 오프라인: 캐시에서 반환
        caches.match(event.request).then((cached) => cached || caches.match(OFFLINE_URL))
      )
  );
});
