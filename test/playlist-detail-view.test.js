// CR-022：曲一覧の「現在再生中」の行を強調表示する対象を判定する、純粋関数のUnitテスト。

import test from 'node:test';
import assert from 'node:assert/strict';
import { isNowPlayingRow } from '../js/views/playlist-detail-view.js';

test('isNowPlayingRow: 再生中の曲IDと一致する行はtrue (CR-022)', () => {
  assert.equal(isNowPlayingRow({ id: 123 }, 123), true);
});

test('isNowPlayingRow: 一致しない行はfalse', () => {
  assert.equal(isNowPlayingRow({ id: 123 }, 456), false);
});

test('isNowPlayingRow: 型が違っても文字列化して一致すればtrue（IDの型揺れ対策）', () => {
  assert.equal(isNowPlayingRow({ id: 123 }, '123'), true);
  assert.equal(isNowPlayingRow({ id: '123' }, 123), true);
});

test('isNowPlayingRow: 再生中の曲がない（null）場合は常にfalse', () => {
  assert.equal(isNowPlayingRow({ id: 123 }, null), false);
});

test('isNowPlayingRow: trackがnull/undefinedならfalse', () => {
  assert.equal(isNowPlayingRow(null, 123), false);
});
