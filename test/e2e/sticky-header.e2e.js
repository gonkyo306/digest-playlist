// 画面上部の見出し行（アイコン・追加先プレイリスト）の固定表示のE2Eテスト
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, playlist } from './helpers.js';

let server; let origin; let browser;
before(async () => {
  ({ server, origin } = await startServer());
  browser = await launchBrowser();
});
after(async () => {
  await browser.close();
  server.close();
});

// 1画面に収まらないよう、画面の高さを低くして、スクロールが必要な状態にする
const VIEWPORT = { width: 390, height: 480 };
const MANY = Array.from({ length: 12 }, (_, i) => playlist(`p${i}`, `プレイリスト${i}`, [100 + (i % 4)], { updatedAt: 100 - i }));

/** 下までスクロールしたあとも、見出し行が画面の上端に見えていること */
async function assertPinned(page, selector) {
  const before = await page.locator(selector).boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => window.scrollY > 0);
  const after = await page.locator(selector).boundingBox();
  assert.ok(after.y >= -0.5 && after.y <= 0.5, `${selector} が画面の上端に固定される（y=${after.y}）`);
  assert.ok(Math.abs(after.height - before.height) < 0.5, '高さは変わらない');
}

test('プレイリスト一覧：下へスクロールしても、見出しと＋ボタンが画面上端に固定される', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: MANY, viewport: VIEWPORT });
  const top = await page.locator('.screen-header:visible h1').first().boundingBox();
  await assertPinned(page, '.screen-header:visible');
  const pinned = await page.locator('.screen-header:visible h1').first().boundingBox();
  assert.ok(Math.abs(pinned.y - top.y) < 0.5, 'スクロール前と同じ位置に見出しがある');
  const hit = await page.evaluate(() => {
    const r = document.querySelector('#create-playlist-btn').getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#create-playlist-btn') !== null;
  });
  assert.equal(hit, true, '＋ボタンが他の行に隠れず押せる');
  assert.deepEqual(errors, []);
  await context.close();
});

test('検索画面（検索結果・アルバム収録曲）：スクロールしても、追加先プレイリストが画面上端に固定される', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: [playlist('p1', '通勤用', [])], viewport: VIEWPORT });
  await page.click('.tab-btn[data-tab="search"]');
  await page.fill('#search-term', 'ビートルズ');
  await page.waitForSelector('.result-album-open');
  await page.waitForSelector('#dest-header-slot .dest-header');
  // 結果が少なくスクロールできない場合に備えて、高さを足す
  await page.evaluate(() => { const h = [...document.querySelectorAll('.screen-header')].find((e) => e.offsetParent); h.parentElement.style.minHeight = '2000px'; });
  await assertPinned(page, '.screen-header:visible');
  assert.equal(await page.locator('.screen-header:visible .dest-header').isVisible(), true, '追加先プレイリストが見えている');

  // アルバム収録曲の画面でも同様
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForSelector('.result-album-open');
  await page.locator('.result-album-open').first().click();
  await page.waitForSelector('#album-add-all-btn');
  await page.evaluate(() => { const h = [...document.querySelectorAll('.screen-header')].find((e) => e.offsetParent); h.parentElement.style.minHeight = '2000px'; });
  await assertPinned(page, '.screen-header:visible');
  assert.equal(await page.locator('.screen-header:visible .dest-header').isVisible(), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('プレイリスト詳細：スクロールしても、戻る・操作アイコンが画面上端に固定される', async () => {
  const { page, context, errors } = await openApp(browser, origin, {
    playlists: [playlist('p1', '通勤用', [100, 101, 102, 103, 100, 101, 102, 103, 100, 101, 102, 103])], viewport: VIEWPORT,
  });
  await page.locator('.playlist-open', { hasText: '通勤用' }).click();
  await page.waitForSelector('.detail-topbar:visible');
  await assertPinned(page, '.detail-topbar:visible');
  assert.deepEqual(errors, []);
  await context.close();
});
