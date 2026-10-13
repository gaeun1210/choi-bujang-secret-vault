// BYTE BACK 자료실 서비스 워커 (11단계)
// 화면 틀이 아닌 "오프라인 안내"와 아이콘·manifest만 저장합니다.
// /api/ 요청과 그 응답(메모·세션·기기 상태)은 절대 저장하거나 대신 응답하지 않습니다.
const CACHE = 'byteback-shell-v1';
const OFFLINE_FILES = ['/offline.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    // 화면은 항상 서버에서 새로 받고, 연결이 끊겼을 때만 오프라인 안내를 보여 줍니다.
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
    return;
  }
  if (OFFLINE_FILES.includes(url.pathname)) {
    event.respondWith(fetch(event.request).catch(() => caches.match(url.pathname)));
  }
});
