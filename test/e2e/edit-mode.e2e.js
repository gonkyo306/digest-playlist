// プレイリスト詳細の編集モード（FR-2.14、FR-2.19）のE2Eテスト
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openPlaylist, playlist, readPlaylists } from './helpers.js';

let server; let origin; let browser;
before(async () => {
  ({ server, origin } = await startServer());
  browser = await launchBrowser();
});
after(async () => {
  await browser.close();
  server.close();
});

const LONG_NAME = 'とても長いプレイリスト名がここに入っていますよ長い長い';
const rect = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const b = e.getBoundingClientRect();
  return { x: b.x, y: Math.round(b.y * 100) / 100, w: b.width, h: Math.round(b.height * 100) / 100 };
}, sel);

for (const [label, name, trackIds] of [
  ['短い名前・曲0件', '短い', []],
  ['短い名前・曲1件', '短い', [101]],
  ['2行になる長い名前・曲0件', LONG_NAME, []],
  ['2行になる長い名前・曲3件', LONG_NAME, [100, 101, 102]],
]) {
  test(`編集に入っても、名前の文字の位置も、名前より下の位置も変わらない（${label}）`, async () => {
    const { page, context, errors } = await openApp(browser, origin, { playlists: [playlist('p1', name, trackIds)] });
    await openPlaylist(page, name);
    const nameBox = await rect(page, '.hero-name');
    const clip = { x: 0, y: nameBox.y, width: 390, height: nameBox.h };
    const normalShot = await page.screenshot({ clip });
    const normal = { actions: await rect(page, '.hero-actions'), list: await rect(page, '.list') };

    await page.click('#edit-btn');
    await page.waitForSelector('#edit-name-input');
    await page.waitForTimeout(300);
    const editShot = await page.screenshot({ clip });
    const edit = { actions: await rect(page, '.hero-actions'), list: await rect(page, '.list') };

    assert.deepEqual(edit.actions, normal.actions, 'シャッフル・再生ボタンの位置');
    assert.equal(edit.list.y, normal.list.y, '曲一覧の開始位置');
    assert.ok(normalShot.equals(editShot), '名前の文字の表示（ピクセル）が通常時と完全に一致する');
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test('編集モード：名前をその場で編集でき、Enterは改行せず確定し、保存すると反映される', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', '元の名前', [100])] });
  await openPlaylist(page, '元の名前');
  await page.click('#edit-btn');
  await page.click('#edit-name-input');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('新しい名前');
  await page.keyboard.press('Enter');
  const html = await page.$eval('#edit-name-input', (e) => e.innerHTML);
  assert.equal(html, '新しい名前', '改行（<br>等）が入らない');
  assert.equal(await page.$eval('#edit-name-input', (e) => e.getAttribute('contenteditable')), 'plaintext-only');
  assert.equal(await page.$eval('#edit-name-input', (e) => getComputedStyle(e).textAlign), 'center');
  await page.click('#save-edit-btn');
  await page.waitForSelector('#edit-btn');
  assert.equal(await page.textContent('.hero-name'), '新しい名前');
  assert.equal((await readPlaylists(page))[0].name, '新しい名前');
  await context.close();
});

test('編集モード：曲の削除ボタンで行がフェードアウトして消え、保存するまで確定しない', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', [100, 101, 102])] });
  await openPlaylist(page, 'テスト');
  await page.click('#edit-btn');
  await page.waitForSelector('.track-remove-btn');
  assert.equal(await page.locator('.track-item').count(), 3);

  await page.locator('.track-remove-btn').nth(1).click();
  await page.waitForSelector('.track-item.removing', { timeout: 100 });
  await page.waitForTimeout(120);
  const opacity = await page.$eval('.track-item.removing', (e) => parseFloat(getComputedStyle(e).opacity));
  assert.ok(opacity < 1, `フェードアウト中は不透明度が下がっている（${opacity}）`);
  await page.waitForFunction(() => document.querySelectorAll('.track-item').length === 2);
  assert.equal(await page.locator('.track-item.removing').count(), 0, '消えたあとは再描画されている');

  assert.equal((await readPlaylists(page))[0].trackIds.length, 3, '保存するまで確定しない');
  await page.click('#save-edit-btn');
  await page.waitForSelector('#edit-btn');
  assert.equal((await readPlaylists(page))[0].trackIds.length, 2, '保存すると削除が確定する');
  await context.close();
});

test('編集モード：フェードアウト中にキャンセルしても、曲は失われず、次の編集にも持ち越されない', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', [100, 101, 102])] });
  await openPlaylist(page, 'テスト');
  await page.click('#edit-btn');
  await page.waitForSelector('.track-remove-btn');
  await page.locator('.track-remove-btn').nth(0).click();
  await page.click('#cancel-edit-btn');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.track-item').count(), 3, 'キャンセルで編集前に戻る');
  await page.click('#edit-btn');
  await page.waitForSelector('.track-remove-btn');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.track-item').count(), 3, '古い削除が次の編集に紛れ込まない');
  assert.equal((await readPlaylists(page))[0].trackIds.length, 3);
  await context.close();
});

for (const [label, trackIds] of [['画像も曲もない（仮画像）', []], ['曲がある（先頭曲のジャケット）', [100]]]) {
  test(`編集モード：ジャケットの中央にカメラアイコンが重なり、画像の位置は変わらない（${label}）`, async () => {
    const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', trackIds)] });
    await openPlaylist(page, 'テスト');
    const artBefore = await rect(page, '.hero-artwork');
    await page.click('#edit-btn');
    await page.waitForSelector('.hero-camera-badge');
    const art = await rect(page, '.hero-artwork');
    const badge = await rect(page, '.hero-camera-badge');
    assert.deepEqual(art, artBefore, '画像の位置・大きさが変わらない');
    assert.ok(Math.abs((badge.x + badge.w / 2) - (art.x + art.w / 2)) < 1, '横方向の中央');
    assert.ok(Math.abs((badge.y + badge.h / 2) - (art.y + art.h / 2)) < 1, '縦方向の中央');
    if (trackIds.length === 0) {
      const svg = await rect(page, '.hero-artwork-placeholder svg');
      assert.ok(Math.abs((svg.x + svg.w / 2) - (art.x + art.w / 2)) < 1 && Math.abs((svg.y + svg.h / 2) - (art.y + art.h / 2)) < 1,
        '仮画像のアイコンは枠の中央にあり、上や下に寄らない');
    }
    await context.close();
  });
}

test('通常時：編集アイコンと削除アイコンは間隔なしで隣接して並ぶ', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', [100])] });
  await openPlaylist(page, 'テスト');
  const edit = await rect(page, '#edit-btn');
  const del = await rect(page, '#delete-btn');
  assert.ok(Math.abs((edit.x + edit.w) - del.x) < 1, '間隔なし');
  assert.ok(edit.w >= 44 && del.w >= 44, 'タップ領域は44px以上');
  await context.close();
});
