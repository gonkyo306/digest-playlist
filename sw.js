// 最小限のキャッシュのみ。オフライン再生自体は対象外（1-3）。
const CACHE_NAME = 'digest-playlist-shell-v4';
const SHELL_FILES = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/models.js',
  './js/storage.js',
  './js/track-api.js',
  './js/search-api.js',
  './js/preview-player.js',
  './js/failure-tracker.js',
  './js/playback-order.js',
  './js/playback-history.js',
  './js/medley-player.js',
  './js/views/medley-list-view.js',
  './js/views/medley-detail-view.js',
  './js/views/search-view.js',
  './js/views/dialog.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// アプリの見た目（シェル）だけをキャッシュから返す。曲データ・試聴音源は常にネットワークから取得する。
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // 外部API・音源はキャッシュしない
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
