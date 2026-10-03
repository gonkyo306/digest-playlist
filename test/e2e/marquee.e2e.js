// 自動スクロール（NFR-5.12）のE2Eテスト
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, launchBrowser, openApp, openPlaylist, playlist } from './helpers.js';

let server; let origin; let browser;
before(async () => {
  ({ server, origin } = await startServer());
  browser = await launchBrowser();
});
after(async () => {
  await browser.close();
  server.close();
});

const MARQUEES = '.track-item .marquee';

async function marqueeInfo(page) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
    const track = el.querySelector('.marquee-track');
    return {
      scrolling: el.classList.contains('scrolling'),
      viewWidth: el.clientWidth,
      textWidth: el.querySelector('.marquee-text').offsetWidth,
      texts: track.querySelectorAll('.marquee-text').length,
      animations: track.getAnimations().length,
      height: Math.round(el.getBoundingClientRect().height),
    };
  }), MARQUEES);
}

test('1行に収まらないタイトルだけがスクロールし、収まるタイトルは静止する。行の高さは変わらない', async () => {
  const { page, context, errors } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', [100, 101, 102, 103])] });
  await openPlaylist(page, 'テスト');
  const infos = await marqueeInfo(page);
  assert.equal(infos.length, 4);
  for (const m of infos) {
    assert.equal(m.scrolling, m.textWidth > m.viewWidth + 1, 'はみ出す場合だけスクロールする');
    assert.equal(m.texts, 1, '複製のテキストは作らない');
    assert.equal(m.animations, m.scrolling ? 1 : 0);
  }
  assert.ok(infos.some((m) => m.scrolling) && infos.some((m) => !m.scrolling), '長い行・短い行の両方がある');
  assert.equal(new Set(infos.map((m) => m.height)).size, 1, '行の高さが揃っている');
  assert.deepEqual(errors, []);
  await context.close();
});

test('動き：初期表示で1秒静止し、テキスト全体が左に流れ切って何も見えなくなったら初期表示へ戻り、毎周1秒静止する', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', [100, 101, 102, 103])] });
  await openPlaylist(page, 'テスト');
  const result = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.classList.contains('scrolling'));
    const track = el.querySelector('.marquee-track');
    const anim = track.getAnimations()[0];
    const x = () => new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    const timing = anim.effect.getComputedTiming();
    const frames = anim.effect.getKeyframes();
    const at = (ms) => { anim.pause(); anim.currentTime = ms; return x(); };
    const total = timing.duration;
    const out = {
      textWidth: el.querySelector('.marquee-text').offsetWidth,
      viewWidth: el.clientWidth,
      iterations: timing.iterations,
      duration: total,
      offsets: frames.map((f) => f.computedOffset),
      lastTransform: frames[frames.length - 1].transform,
      holdStart: at(500),
      afterHold: at(1500),
      nearEnd: at(total - 50),
      secondLapHold: at(total + 500),
      secondLapMoving: at(total + 1500),
    };
    anim.play();
    return out;
  }, MARQUEES);
  assert.equal(result.iterations, Infinity, '繰り返す');
  const scrollSeconds = Math.max(3, result.textWidth / 40);
  assert.ok(Math.abs(result.duration - (1 + scrollSeconds) * 1000) < 2, '1周＝静止1秒＋テキスト幅÷40px/秒（最短3秒）');
  assert.ok(Math.abs(result.offsets[1] - 1000 / result.duration) < 0.001, '静止区間は1秒');
  assert.equal(result.lastTransform, `translateX(-${result.textWidth}px)`, 'テキスト全体（幅ぶん）が左へ流れ切るまで流す');
  assert.equal(result.holdStart, 0, '開始から1秒は静止');
  assert.ok(result.afterHold < 0, '1秒後に流れ始める');
  assert.ok(result.nearEnd < -(result.textWidth - 5), '最後は何も見えなくなる位置（テキスト幅ぶん左）まで流れる');
  assert.equal(result.secondLapHold, 0, '2周目も、初期表示に戻って静止する');
  assert.ok(result.secondLapMoving < 0, '2周目も1秒後に流れ始める');
  await context.close();
});

test('タブを切り替えて戻しても、スクロールが重複しない', async () => {
  const { page, context } = await openApp(browser, origin, { playlists: [playlist('p1', 'テスト', [100, 101, 102, 103])] });
  await openPlaylist(page, 'テスト');
  const before = await marqueeInfo(page);
  for (let i = 0; i < 3; i++) {
    await page.click('.tab-btn[data-tab="search"]');
    await page.click('.tab-btn[data-tab="playlist"]');
  }
  await page.waitForTimeout(300);
  const after = await marqueeInfo(page);
  assert.deepEqual(after.map((m) => m.scrolling), before.map((m) => m.scrolling));
  for (const m of after) {
    assert.equal(m.texts, 1);
    assert.equal(m.animations, m.scrolling ? 1 : 0);
  }
  await context.close();
});
