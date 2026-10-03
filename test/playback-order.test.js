import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialOrder, buildOrderStartingAt, shuffle,
  buildSequentialOrder, buildSequentialOrderStartingAt,
} from '../js/playback-order.js';

test('shuffle: 元の配列を変更せず、要素の集合は変わらない', () => {
  const original = [0, 1, 2, 3, 4];
  const result = shuffle(original);
  assert.deepEqual(original, [0, 1, 2, 3, 4], '元の配列は変更されない');
  assert.deepEqual([...result].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('buildInitialOrder: 曲数ぶんのインデックスが重複なく並ぶ (FR-4.2, FR-4.3)', () => {
  const order = buildInitialOrder(5);
  assert.equal(order.length, 5);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('buildInitialOrder: 複数回生成すると、少なくとも一部は順序が変わる', () => {
  // 乱数依存のため厳密な保証はできないが、20曲であれば十分な回数試せば
  // 全く同じ順序が毎回続くことはまず無い、という前提で緩く検証する。
  const orders = Array.from({ length: 10 }, () => buildInitialOrder(20).join(','));
  const uniqueOrders = new Set(orders);
  assert.ok(uniqueOrders.size > 1, '10回中1種類しか出ないのは明らかにおかしい');
});

test('buildOrderStartingAt: 指定した曲が先頭になり、残りは重複なく並ぶ', () => {
  for (let i = 0; i < 20; i++) {
    const order = buildOrderStartingAt(5, 2);
    assert.equal(order[0], 2, '先頭は指定したインデックス');
    assert.equal(order.length, 5);
    assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4], '重複・欠落なく全曲含む');
  }
});

test('buildOrderStartingAt: 1曲のみの場合はその曲だけの配列になる', () => {
  const order = buildOrderStartingAt(1, 0);
  assert.deepEqual(order, [0]);
});

test('buildSequentialOrder: インデックスの順番どおりに並ぶ（シャッフルしない）', () => {
  assert.deepEqual(buildSequentialOrder(5), [0, 1, 2, 3, 4]);
});

test('buildSequentialOrder: 0曲の場合は空配列', () => {
  assert.deepEqual(buildSequentialOrder(0), []);
});

test('buildSequentialOrderStartingAt: 指定した曲を先頭に、表示順のまま一巡する', () => {
  assert.deepEqual(buildSequentialOrderStartingAt(5, 2), [2, 3, 4, 0, 1]);
});

test('buildSequentialOrderStartingAt: 先頭（インデックス0）を指定すると変化しない', () => {
  assert.deepEqual(buildSequentialOrderStartingAt(4, 0), [0, 1, 2, 3]);
});

test('buildSequentialOrderStartingAt: 1曲のみの場合はその曲だけの配列になる', () => {
  assert.deepEqual(buildSequentialOrderStartingAt(1, 0), [0]);
});
