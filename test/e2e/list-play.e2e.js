// プレイリスト一覧からのすぐ再生（FR-2.9 の再生ボタン、FR-2.20 の前回のプレイリストカード）のE2Eテスト
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, playlist, fakeTrack } from './helpers.js';

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

test('再生ボタンで、詳細画面を開かずに再生が始まる。再生中も「再生」の表示のままで、押すと最初から再生し直す', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: LISTS });
  assert.equal(await miniVisible(page), false, '最初はミニプレイヤーが無い');
  const labelBefore = await rowBtn(page, '通勤用').getAttribute('aria-label');
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止', null, { timeout: 5000 });
  assert.equal(await page.locator('#playlist-list').count(), 1, '一覧画面のまま（詳細画面を開かない）');
  assert.equal(await miniVisible(page), true, 'ミニプレイヤーが表示される');
  // 再生が始まっても、一覧の再生ボタンは「再生」のまま（一時停止の表示にはならない）
  assert.equal(await rowBtn(page, '通勤用').getAttribute('aria-label'), labelBefore);
  assert.equal(await page.locator('.row-play-btn.playing').count(), 0);
  assert.equal(await rowBtn(page, '通勤用').locator('svg path').first().getAttribute('d'), await rowBtn(page, '夜のドライブ').locator('svg path').first().getAttribute('d'), '全行が同じ再生アイコン');

  // 一時停止はミニプレイヤーで行う
  await page.click('.mini-playpause');
  await page.waitForFunction(() => document.querySelector('.mini-playpause').getAttribute('aria-label') === '再生');
  // 一覧の再生ボタンを押すと、一時停止のままではなく、最初から再生し直す
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.mini-playpause').getAttribute('aria-label') === '一時停止', null, { timeout: 5000 });
  assert.equal(await rowBtn(page, '通勤用').getAttribute('aria-label'), labelBefore);
  assert.deepEqual(errors, []);
  await context.close();
});

test('別のプレイリストの再生ボタンを押すと、そちらの再生に切り替わる', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止');
  await rowBtn(page, '夜のドライブ').click();
  await page.waitForFunction(() => localStorage.getItem('digest-playlist:last-played-playlist-id') === 'p3');
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止');
  assert.ok((await page.textContent('#mini-player')).includes(fakeTrack(3).trackName), '切り替え先のプレイリストの曲が再生される');
  assert.equal(await page.locator('.row-play-btn.playing').count(), 0);
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
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止');

  await page.reload(); // 次回起動
  await page.waitForSelector('.last-played');
  assert.match(await page.textContent('.last-played'), /前回のプレイリスト/);
  assert.match(await page.textContent('.last-played'), /通勤用/);
  assert.doesNotMatch(await page.textContent('.last-played'), /曲|シャッフルで再生/, '曲数・再生方法は表示しない');
  const card = await page.locator('.last-played').boundingBox();
  const first = await page.locator('.list-item').first().boundingBox();
  assert.ok(card.y < first.y, '一覧の先頭（行より上）にある');
  assert.equal(await miniVisible(page), false, '再読み込みで再生は止まっている');

  await page.locator('.last-play-btn').click();
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止');
  assert.equal(await page.locator('#playlist-list').count(), 1, '一覧画面のまま');
  assert.equal(await miniVisible(page), true);
  assert.match(await page.textContent('.last-play-btn'), /再生/);
  assert.doesNotMatch(await page.textContent('.last-play-btn'), /一時停止/, '再生中も「再生」の表示のまま');
  await context.close();
});

test('前回のプレイリストカード：本体をタップすると詳細画面が開き、名前で絞り込み中は出ない', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: LISTS });
  await rowBtn(page, '通勤用').click();
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止');
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
