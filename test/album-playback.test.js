import test from 'node:test';
import assert from 'node:assert/strict';
import { orderAlbumTracks } from '../js/album-playback.js';

test('orderAlbumTracks: シャッフルなしはアルバムの収録順のまま (FR-1.11)', () => {
  const tracks = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const ordered = orderAlbumTracks(tracks, false);
  assert.deepEqual(ordered.map((t) => t.id), [1, 2, 3]);
});

test('orderAlbumTracks: シャッフルなしでも、元の配列とは別の配列を返す', () => {
  const tracks = [{ id: 1 }, { id: 2 }];
  const ordered = orderAlbumTracks(tracks, false);
  assert.notEqual(ordered, tracks);
});

test('orderAlbumTracks: シャッフルありは、乱数関数の結果に従って決定的に並び替わる (FR-1.11)', () => {
  const tracks = [{ id: 1 }, { id: 2 }, { id: 3 }];
  // 常に0を返す乱数関数を渡すと、Fisher–Yatesの各ステップで先頭要素と交換され続けるため、
  // 決定的な並びになる（手計算で検証済み：[1,2,3] → [3,2,1] → [2,3,1]）
  const ordered = orderAlbumTracks(tracks, true, () => 0);
  assert.deepEqual(ordered.map((t) => t.id), [2, 3, 1]);
});

test('orderAlbumTracks: 乱数関数が常に1未満の最大値に近い値を返す場合、交換が起きず収録順のままになる', () => {
  const tracks = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const ordered = orderAlbumTracks(tracks, true, () => 0.999999999);
  assert.deepEqual(ordered.map((t) => t.id), [1, 2, 3]);
});

test('orderAlbumTracks: シャッフルありでも、同じ曲の集合が保たれる（曲が増減しない）', () => {
  const tracks = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  const ordered = orderAlbumTracks(tracks, true, () => 0.5);
  const ids = ordered.map((t) => t.id).sort();
  assert.deepEqual(ids, [1, 2, 3, 4, 5]);
});
