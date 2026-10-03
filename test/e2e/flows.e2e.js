// 作成・検索・追加の基本操作（FR-1.1, FR-1.12, FR-2.1, FR-2.17）のE2Eテスト
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, playlist, readPlaylists } from './helpers.js';

let server; let origin; let browser;
before(async () => {
  ({ server, origin } = await startServer());
  browser = await launchBrowser();
});
after(async () => {
  await browser.close();
  server.close();
});

test('プレイリスト作成シート：名前は中央揃えで、保存すると一覧に追加される（空の間は保存できない）', async () => {
  const { page, context, errors } = await openApp(browser, origin);
  await page.click('#create-playlist-btn');
  await page.waitForSelector('#create-name-input');
  assert.equal(await page.$eval('#create-name-input', (e) => getComputedStyle(e).textAlign), 'center');
  assert.equal(await page.$eval('#create-save-btn', (e) => e.disabled), true, '名前が空の間は保存できない');
  await page.fill('#create-name-input', '新しいプレイリスト');
  assert.equal(await page.$eval('#create-save-btn', (e) => e.disabled), false);
  await page.click('#create-save-btn');
  await page.waitForSelector('.playlist-open');
  assert.match(await page.textContent('.playlist-open'), /新しいプレイリスト/);
  assert.equal((await readPlaylists(page))[0].name, '新しいプレイリスト');
  assert.deepEqual(errors, []);
  await context.close();
});

test('検索して＋ボタンをタップすると、追加先プレイリストに1曲追加される', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: [playlist('p1', '追加先', [])] });
  await page.click('.tab-btn[data-tab="search"]');
  await page.fill('#search-term', 'ビートルズ');
  await page.waitForSelector('#search-results li');
  await page.locator('#search-results .toggle-add-btn').first().click();
  await page.waitForFunction(async () => {
    const open = indexedDB.open('digest-playlist', 2);
    return new Promise((res) => { open.onsuccess = () => {
      const r = open.result.transaction('playlists').objectStore('playlists').getAll();
      r.onsuccess = () => res(r.result[0].trackIds.length === 1);
    }; });
  });
  assert.equal((await readPlaylists(page))[0].trackIds.length, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('プレイリスト名で一覧を絞り込める（入力するたびに動的に絞り込み、空にすると全件に戻る）', async () => {
  const { page, context } = await openApp(browser, origin, {
    playlists: [playlist('p1', 'ロック', [], { updatedAt: 2 }), playlist('p2', 'ジャズ', [], { updatedAt: 1 })],
  });
  assert.equal(await page.locator('.playlist-open').count(), 2);
  await page.fill('#playlist-search-term', 'ジャ');
  await page.waitForFunction(() => document.querySelectorAll('.playlist-open').length === 1);
  assert.match(await page.textContent('.playlist-open'), /ジャズ/);
  await page.fill('#playlist-search-term', '');
  await page.waitForFunction(() => document.querySelectorAll('.playlist-open').length === 2);
  await context.close();
});
