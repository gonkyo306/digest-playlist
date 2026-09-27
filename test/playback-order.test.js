import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialOrder, reshuffleAvoidingRepeat, shuffle } from '../js/playback-order.js';

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

test('reshuffleAvoidingRepeat: 曲が2曲以上のとき、直前の曲が先頭に来ない (FR-4.4)', () => {
  for (let i = 0; i < 50; i++) {
    const order = reshuffleAvoidingRepeat(4, 2);
    assert.notEqual(order[0], 2);
    assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3]);
  }
});

test('reshuffleAvoidingRepeat: 1曲のみの場合はそのまま返す（直前の曲を除外する対象がない）', () => {
  const order = reshuffleAvoidingRepeat(1, 0);
  assert.deepEqual(order, [0]);
});
