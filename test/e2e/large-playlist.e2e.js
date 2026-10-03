// 曲数の多いプレイリスト（FR-2.7：曲数に上限がない）のE2Eテスト
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

const COUNT = 700;
const TRACKS = Array.from({ length: COUNT }, (_, i) => fakeTrack(i, `曲${i}`));
const BIG = playlist('big', '大きなプレイリスト', TRACKS.map((t) => t.trackId));

test('700曲のプレイリストでも、詳細画面で全曲が表示され、エラーにならない', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: [BIG], tracks: TRACKS });
  await page.locator('.playlist-open', { hasText: '大きなプレイリスト' }).click();
  await page.waitForSelector('.track-item');
  assert.equal(await page.locator('.track-item').count(), COUNT);
  assert.equal(await page.locator('.error-banner').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('700曲のプレイリストを、一覧の再生ボタンから再生できる', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: [BIG], tracks: TRACKS });
  await page.locator('.row-play-btn').click();
  await page.waitForFunction(() => document.querySelector('.mini-playpause')?.getAttribute('aria-label') === '一時停止', null, { timeout: 10000 });
  assert.equal(await page.locator('#playlist-list-error:visible').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});
