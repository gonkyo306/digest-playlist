// アルバムの全曲追加（FR-1.24）のE2Eテスト
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

/** 検索タブで検索し、アルバムの収録曲一覧まで開く */
async function openAlbum(page) {
  await page.click('.tab-btn[data-tab="search"]');
  await page.fill('#search-term', 'ビートルズ');
  await page.waitForSelector('.result-album-open');
  await page.locator('.result-album-open').first().click();
  await page.waitForSelector('#album-add-all-btn');
  await page.waitForSelector('#album-track-results li');
}

test('全曲追加ボタンは、シャッフル・再生ボタンの右に並ぶ', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: [playlist('p1', '通勤用', [])] });
  await openAlbum(page);
  const [shuffle, play, add] = await Promise.all(['#album-shuffle-btn', '#album-play-btn', '#album-add-all-btn']
    .map((s) => page.locator(s).boundingBox()));
  assert.ok(shuffle.x < play.x && play.x < add.x, '左から シャッフル・再生・全曲追加');
  assert.ok(add.width >= 44 && add.height >= 44);
  assert.deepEqual(errors, []);
  await context.close();
});

test('タップすると、追加先に全曲が追加され、通知に曲数と［取り消し］が出て、各行は「追加済」になる', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', '通勤用', [])] });
  await openAlbum(page);
  await page.click('#album-add-all-btn');
  await page.waitForSelector('#add-all-snackbar');
  assert.match(await page.textContent('#add-all-snackbar'), /4曲を「通勤用」に追加しました/);
  assert.equal((await readPlaylists(page))[0].trackIds.length, 4);
  assert.equal(await page.locator('#album-track-results .added-badge').count(), 4, '全行が「追加済」');
  assert.equal(await page.locator('#album-add-all-btn').isDisabled(), true, '全曲追加済みなので押せない');
  await context.close();
});

test('既に追加済みの曲は飛ばされ、残りだけが追加される', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', '通勤用', [100, 101])] });
  await openAlbum(page);
  assert.match(await page.getAttribute('#album-add-all-btn', 'aria-label'), /残り2曲/);
  await page.click('#album-add-all-btn');
  await page.waitForSelector('#add-all-snackbar');
  assert.match(await page.textContent('#add-all-snackbar'), /2曲を「通勤用」に追加しました/);
  assert.deepEqual((await readPlaylists(page))[0].trackIds, [100, 101, 102, 103], '重複せず、順番に追加');
  await context.close();
});

test('［取り消し］で、その操作で追加した曲だけが外れる（元から入っていた曲は残る）', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', '通勤用', [100])] });
  await openAlbum(page);
  await page.click('#album-add-all-btn');
  await page.waitForSelector('#add-all-snackbar');
  await page.click('.snackbar-action');
  await page.waitForFunction(() => !document.querySelector('#add-all-snackbar'));
  // 保存の完了を待つ（通知は、取り消しの処理を始めた時点で消える）
  for (let i = 0; i < 40 && (await readPlaylists(page))[0].trackIds.length !== 1; i++) await page.waitForTimeout(50);
  assert.deepEqual((await readPlaylists(page))[0].trackIds, [100], '追加した3曲だけが外れる');
  assert.equal(await page.locator('#album-add-all-btn').isDisabled(), false, 'もう一度追加できる');
  await context.close();
});

test('通知は一定時間で消える', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', '通勤用', [])] });
  await openAlbum(page);
  await page.click('#album-add-all-btn');
  await page.waitForSelector('#add-all-snackbar');
  await page.waitForFunction(() => !document.querySelector('#add-all-snackbar'), null, { timeout: 8000 });
  await context.close();
});

test('プレイリストが1件も無いときは、その場で作成するダイアログを出し、作成すると全曲が追加される', async () => {
  const { page, context } = await openApp(browser, origin);
  await openAlbum(page);
  await page.click('#album-add-all-btn');
  await page.waitForSelector('.dialog-overlay');
  assert.match(await page.textContent('.dialog-message'), /このアルバムの全曲がそのまま追加されます/);
  await page.fill('.create-name-input', '新しいプレイリスト');
  await page.click('.dialog-confirm');
  await page.waitForSelector('#add-all-snackbar');
  const lists = await readPlaylists(page);
  assert.equal(lists.length, 1);
  assert.equal(lists[0].name, '新しいプレイリスト');
  assert.equal(lists[0].trackIds.length, 4);
  await context.close();
});

test('ダイアログをキャンセルすると、何も作成・追加されない', async () => {
  const { page, context } = await openApp(browser, origin);
  await openAlbum(page);
  await page.click('#album-add-all-btn');
  await page.waitForSelector('.dialog-overlay');
  await page.click('.dialog-cancel');
  await page.waitForFunction(() => !document.querySelector('.dialog-overlay'));
  assert.equal((await readPlaylists(page)).length, 0);
  assert.equal(await page.locator('#album-add-all-btn').isDisabled(), false);
  await context.close();
});
