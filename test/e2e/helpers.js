// E2E（ブラウザ上での動作確認）テストの共通処理。
// リポジトリのルートを静的サーバーで配信し、iTunes APIはモックに差し替えて、実際のChromiumでアプリを操作する。
// 実行：npm run test:e2e（Chromiumは、環境変数CHROMIUM_PATH、または/opt/pw-browsers/chromium、
// それも無ければPlaywrightが管理するChromiumを使う）

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
};
// 1x1の透明PNG（ジャケット画像のモック）
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// 2秒の無音WAV（試聴音源のモック。実際に再生できるので、再生状態の変化を確認できる）
function silentWav(seconds = 2, rate = 8000) {
  const samples = seconds * rate;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}
const WAV = silentWav();

export const ALBUM_ID = 900;
export const ALBUM = {
  wrapperType: 'collection', collectionType: 'Album', collectionId: ALBUM_ID, collectionName: 'テストアルバム',
  artistName: 'ビートルズ', artworkUrl100: 'http://localhost/__art/album.jpg',
};

export const TITLES = [
  'ドライヴ・マイ・カー (2009 - Remaster)',
  'ノルウェーの森(ノーウェジアン・ウッド) とても長いタイトルがさらに続きます',
  '短い曲',
  'ユー・ウォント・シー・ミー (2009 - Remaster) もっともっと長いタイトル',
];

export function fakeTrack(i, title = TITLES[i % TITLES.length]) {
  return {
    wrapperType: 'track', kind: 'song', trackId: 100 + i, trackName: title, artistName: 'ビートルズ',
    collectionName: `アルバム${i + 1}`, trackNumber: i + 1,
    artworkUrl100: `http://localhost/__art/${i}.jpg`, previewUrl: `http://localhost/__aud/${i}.m4a`,
  };
}

export function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

export async function launchBrowser() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
  const executablePath = candidates.find((p) => fs.existsSync(p));
  const args = ['--autoplay-policy=no-user-gesture-required'];
  return chromium.launch(executablePath ? { executablePath, args } : { args });
}

/**
 * アプリを開く。iTunes APIはモックに差し替える（検索結果は全トラック、lookupはIDに一致するトラックを返す）。
 * @param {import('playwright').Browser} browser
 * @param {string} origin
 * @param {{playlists?: Array<object>, tracks?: Array<object>, viewport?: {width: number, height: number}}} [options]
 *   保存しておくプレイリストと、APIが返す曲、画面の大きさ
 */
export async function openApp(browser, origin, { playlists = [], tracks = [0, 1, 2, 3].map((i) => fakeTrack(i)), viewport = { width: 390, height: 780 } } = {}) {
  const context = await browser.newContext({
    viewport, colorScheme: 'dark', deviceScaleFactor: 2, serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__art/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 }));
  await page.route('**/__aud/**', (r) => r.fulfill({
    status: 200, contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*' }, body: WAV,
  }));
  await page.route('**/itunes.apple.com/**', (r) => {
    const u = new URL(r.request().url());
    let results = tracks;
    if (u.pathname.endsWith('/lookup')) {
      const ids = (u.searchParams.get('id') || '').split(',');
      results = u.searchParams.get('entity') === 'song' && ids.includes(String(ALBUM_ID))
        ? [ALBUM, ...tracks] // アルバムの収録曲
        : tracks.filter((t) => ids.includes(String(t.trackId)));
    } else if (u.searchParams.get('entity') === 'album') {
      results = [ALBUM];
    } else if (u.searchParams.get('entity') && u.searchParams.get('entity') !== 'song') {
      results = []; // アーティスト候補は無し
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resultCount: results.length, results }) });
  });
  await page.goto(`${origin}/index.html`);
  await page.waitForSelector('#playlist-pane');
  await seedPlaylists(page, playlists);
  await page.reload();
  await page.waitForSelector('#playlist-pane');
  return { page, context, errors };
}

/** IndexedDBに、プレイリストを直接保存する（アプリが作成済みのDBに書き込む） */
export async function seedPlaylists(page, playlists) {
  await page.evaluate((list) => new Promise((resolve, reject) => {
    const open = indexedDB.open('digest-playlist', 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      store.clear();
      list.forEach((p) => store.put(p));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  }), playlists);
}

/** IndexedDBのプレイリストを全件読む */
export async function readPlaylists(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('digest-playlist', 2);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction('playlists').objectStore('playlists').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  }));
}

export function playlist(id, name, trackIds, extra = {}) {
  return { id, name, trackIds, coverImage: null, createdAt: 1, updatedAt: 1, ...extra };
}

/** プレイリスト一覧から、名前を含む行を開く */
export async function openPlaylist(page, name) {
  await page.locator('.playlist-open', { hasText: name }).click();
  await page.waitForSelector('#play-start-btn');
  await page.waitForTimeout(300); // 描画・ジャケット読み込み・自動スクロールの判定を待つ
}
