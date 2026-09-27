import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addToCart,
  removeFromCart,
  removeManyFromCart,
  isInCart,
  partitionCartForMedley,
} from '../js/cart-model.js';

test('addToCart: 曲IDを追加できる (FR-1.12)', () => {
  const cart = addToCart([], 't1');
  assert.deepEqual(cart, ['t1']);
});

test('addToCart: すでに入っている曲IDは重複追加されない', () => {
  const cart = addToCart(['t1'], 't1');
  assert.deepEqual(cart, ['t1']);
});

test('addToCart: 元の配列は変更されない（イミュータブル）', () => {
  const original = ['t1'];
  addToCart(original, 't2');
  assert.deepEqual(original, ['t1']);
});

test('removeFromCart: 指定した曲IDを削除できる', () => {
  const cart = removeFromCart(['t1', 't2', 't3'], 't2');
  assert.deepEqual(cart, ['t1', 't3']);
});

test('removeManyFromCart: 一括追加後に、追加済みの曲IDをまとめて削除できる (FR-1.13)', () => {
  const cart = removeManyFromCart(['t1', 't2', 't3', 't4'], ['t2', 't4']);
  assert.deepEqual(cart, ['t1', 't3']);
});

test('isInCart: 曲IDがカートに入っているかを判定できる', () => {
  assert.equal(isInCart(['t1', 't2'], 't1'), true);
  assert.equal(isInCart(['t1', 't2'], 't3'), false);
});

test('partitionCartForMedley: メドレーに未追加の曲と追加済みの曲を分けられる (FR-1.13, FR-2.6)', () => {
  const medley = { trackIds: ['t2', 't4'] };
  const { toAdd, alreadyInMedley } = partitionCartForMedley(['t1', 't2', 't3', 't4'], medley);
  assert.deepEqual(toAdd, ['t1', 't3']);
  assert.deepEqual(alreadyInMedley, ['t2', 't4']);
});

test('partitionCartForMedley: 全曲未追加なら、すべてtoAddに入る', () => {
  const medley = { trackIds: [] };
  const { toAdd, alreadyInMedley } = partitionCartForMedley(['t1', 't2'], medley);
  assert.deepEqual(toAdd, ['t1', 't2']);
  assert.deepEqual(alreadyInMedley, []);
});
