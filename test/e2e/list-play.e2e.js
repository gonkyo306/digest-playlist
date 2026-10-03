// プレイリスト一覧からのすぐ再生（FR-2.9 の再生ボタン、FR-2.20 の前回のプレイリストカード）のE2Eテスト
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

const LISTS = [
  playlist('p1', '通勤用', [100, 101, 102], { updatedAt: 3 }),
  playlist('p2', '空のプレイリスト', [], { updatedAt: 2 }),
  playlist('p3', '夜のドライブ', [103], { updatedAt: 1 }),
];
const rowBtn = (page, name) => page.locator('.list-item', { hasText: name }).locator('.row-play-btn');
const miniVisible = (page) => page.$eval('#mini-player', (e) => getComputedStyle(e).display !== 'none' && e.textContent.trim() !== '');

test('各行の右端に再生ボタンがあり、曲が0件のプレイリストでは押せない', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: LISTS });
  assert.equal(await page.locator('.row-play-btn').count(), 3);
  assert.equal(await rowBtn(page, '通勤用').isDisabled(), false);
  assert.equal(await rowBtn(page, '空のプレイリスト').isDisabled(), true);
  const row = await page.locator('.list-item', { hasText: '通勤用' }).boundingBox();
  const btn = await rowBtn(page, '通勤用').boundingBox();
  assert.ok(btn.x + btn.width > row.x + row.width - 20, '行の右端にある');
  assert.ok(btn.width >= 44 && btn.height >= 44, 'タップ領域は44px以上');
  assert.deepEqual(errors, []);
  await context.close();
});

test('再生ボタンで、詳細画面を開かずに再生が始まり、ミニプレイヤーが出る。もう一度押すと一時停止・再開する', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: LISTS });
  assert.equal(await miniVisible(page), false, '最初はミニプレイヤーが無い');
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.row-play-btn.playing'), null, { timeout: 5000 });
  assert.equal(await page.locator('#playlist-list').count(), 1, '一覧画面のまま（詳細画面を開かない）');
  assert.equal(await miniVisible(page), true, 'ミニプレイヤーが表示される');
  assert.equal(await page.locator('.row-play-btn.playing').count(), 1, '再生中の行だけが再生中の表示');
  assert.match(await rowBtn(page, '通勤用').getAttribute('aria-label'), /一時停止/);

  await rowBtn(page, '通勤用').click(); // 一時停止
  await page.waitForFunction(() => !document.querySelector('.row-play-btn.playing'));
  assert.match(await rowBtn(page, '通勤用').getAttribute('aria-label'), /シャッフルで再生/);
  await rowBtn(page, '通勤用').click(); // 再開
  await page.waitForFunction(() => document.querySelector('.row-play-btn.playing'));
  assert.deepEqual(errors, []);
  await context.close();
});

test('別のプレイリストの再生ボタンを押すと、そちらの再生に切り替わる', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.row-play-btn.playing'));
  await rowBtn(page, '夜のドライブ').click();
  await page.waitForFunction(() => document.querySelector('.list-item[data-id="p3"] .row-play-btn.playing'));
  assert.equal(await page.locator('.row-play-btn.playing').count(), 1);
  assert.equal(await rowBtn(page, '通勤用').getAttribute('aria-label').then((l) => /シャッフルで再生/.test(l)), true);
  await context.close();
});

test('行の本体をタップすると、これまでどおり詳細画面が開く（再生は始まらない）', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  await page.locator('.playlist-open', { hasText: '通勤用' }).click();
  await page.waitForSelector('#play-start-btn');
  assert.equal(await miniVisible(page), false);
  await context.close();
});

test('前回のプレイリストカード：再生したことがなければ出ず、再生したあとの次回起動時に先頭へ出て、再生できる', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  assert.equal(await page.locator('.last-played').count(), 0, '再生履歴が無ければ出ない');
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.row-play-btn.playing'));

  await page.reload(); // 次回起動
  await page.waitForSelector('.last-played');
  assert.match(await page.textContent('.last-played'), /前回のプレイリスト/);
  assert.match(await page.textContent('.last-played'), /通勤用/);
  assert.match(await page.textContent('.last-played'), /3曲・シャッフルで再生/);
  const card = await page.locator('.last-played').boundingBox();
  const first = await page.locator('.list-item').first().boundingBox();
  assert.ok(card.y < first.y, '一覧の先頭（行より上）にある');
  assert.equal(await miniVisible(page), false, '再読み込みで再生は止まっている');

  await page.locator('.last-play-btn').click();
  await page.waitForFunction(() => document.querySelector('.last-play-btn.playing'));
  assert.equal(await page.locator('#playlist-list').count(), 1, '一覧画面のまま');
  assert.equal(await miniVisible(page), true);
  assert.equal(await page.locator('.list-item[data-id="p1"] .row-play-btn.playing').count(), 1, '行の再生ボタンにも反映される');
  await context.close();
});

test('前回のプレイリストカード：本体をタップすると詳細画面が開き、名前で絞り込み中は出ない', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.row-play-btn.playing'));
  await page.reload();
  await page.waitForSelector('.last-played');
  await page.fill('#playlist-search-term', '夜');
  assert.equal(await page.locator('.last-played').count(), 0, '絞り込み中は出ない');
  await page.fill('#playlist-search-term', '');
  await page.waitForSelector('.last-played');
  await page.locator('.last-played-open').click();
  await page.waitForSelector('#play-start-btn');
  assert.match(await page.textContent('.hero-name'), /通勤用/);
  await context.close();
});

test('前回のプレイリストが削除された・曲が0件になった場合は、カードを出さない', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  await page.evaluate(() => localStorage.setItem('digest-playlist:last-played-playlist-id', 'p2')); // 曲が0件
  await page.reload();
  await page.waitForSelector('.list-item');
  assert.equal(await page.locator('.last-played').count(), 0);
  await page.evaluate(() => localStorage.setItem('digest-playlist:last-played-playlist-id', 'gone')); // 存在しない
  await page.reload();
  await page.waitForSelector('.list-item');
  assert.equal(await page.locator('.last-played').count(), 0);
  await context.close();
});
