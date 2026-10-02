// 最小限のキャッシュのみ。オフライン再生自体は対象外（1-3）。
// 重要：SHELL_FILESの中身を変更する（ファイルの追加に限らず、既存ファイルの更新時も）たびに、
// 必ずCACHE_NAMEの末尾の番号を増やすこと。番号を変えないと、sw.js自体のバイト列が変わらないため
// ブラウザが新しいService Workerの存在に気づかず、インストール済みの端末にはいつまでも古い
// キャッシュ（index.html・css/style.css・js/*等）が配信され続けてしまう（フェーズ40で発覚。
// フェーズ22（v11）以降、CACHE_NAMEが一度も更新されていなかった）
const CACHE_NAME = 'digest-playlist-shell-v13';
const SHELL_FILES = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/models.js',
  './js/storage.js',
  './js/track-api.js',
  './js/search-api.js',
  './js/staged-search-api.js',
  './js/artwork-url.js',
  './js/image-resize.js',
  './js/preview-player.js',
  './js/failure-tracker.js',
  './js/playback-order.js',
  './js/playback-history.js',
  './js/playlist-player.js',
  './js/playlist-sort.js',
  './js/playlist-artwork.js',
  './js/blob-url-cache.js',
  './js/back-stack.js',
  './js/marquee.js',
  './js/album-playback.js',
  './js/views/playlist-list-view.js',
  './js/views/playlist-detail-view.js',
  './js/views/playlist-create-view.js',
  './js/views/search-view.js',
  './js/views/track-row.js',
  './js/views/tab-bar-view.js',
  './js/views/mini-player-view.js',
  './js/views/playlist-picker-dialog.js',
  './js/views/icons.js',
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
