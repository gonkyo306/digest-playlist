import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackHistory } from '../js/playback-history.js';

test('push: 再生するたびに履歴が積まれる', () => {
  const h = new PlaybackHistory();
  h.push(0);
  h.push(2);
  h.push(1);
  assert.equal(h.current(), 1);
});

test('canGoBack/goBack: 履歴の先頭では前へ戻れない (FR-4.10)', () => {
  const h = new PlaybackHistory();
  h.push(0);
  assert.equal(h.canGoBack(), false);
  assert.equal(h.goBack(), null, '戻れない場合はnullを返し、状態を変えない');
  assert.equal(h.current(), 0);
});

test('goBack: 2件以上あれば前の曲に戻れる', () => {
  const h = new PlaybackHistory();
  h.push(0);
  h.push(2);
  assert.equal(h.canGoBack(), true);
  const back = h.goBack();
  assert.equal(back, 0);
  assert.equal(h.current(), 0);
});

test('push: 前へ戻った後に新しい曲を再生すると、それより先の履歴は破棄される', () => {
  const h = new PlaybackHistory();
  h.push(0);
  h.push(2);
  h.push(1);
  h.goBack(); // -> 2
  h.goBack(); // -> 0
  h.push(3); // 新しい曲。2, 1は破棄される
  assert.equal(h.current(), 3);
  assert.equal(h.canGoBack(), true);
  assert.equal(h.goBack(), 0);
});

test('reset: 履歴を空にする', () => {
  const h = new PlaybackHistory();
  h.push(0);
  h.push(1);
  h.reset();
  assert.equal(h.current(), null);
  assert.equal(h.canGoBack(), false);
});
