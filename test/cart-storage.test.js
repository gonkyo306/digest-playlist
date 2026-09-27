import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCart, persistCart } from '../js/cart-storage.js';

// localStorageの実ブラウザ挙動を模した、テスト用の最小限の代替（NFR-3.4）。
function createFakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test('loadCart: 何も保存されていなければ空配列を返す', () => {
  const storage = createFakeStorage();
  assert.deepEqual(loadCart(storage), []);
});

test('persistCart → loadCart: 保存した内容がそのまま読み出せる (NFR-3.4)', () => {
  const storage = createFakeStorage();
  persistCart(['t1', 't2'], storage);
  assert.deepEqual(loadCart(storage), ['t1', 't2']);
});

test('persistCart → loadCart: 「開き直す」相当（別のstorage参照）でも、同じキーなら内容が残る', () => {
  const storage = createFakeStorage();
  persistCart(['t1'], storage);
  // 同じstorageオブジェクトを再度渡す = ブラウザを閉じて開き直しても同じlocalStorageを参照する状況を模す
  const reloaded = loadCart(storage);
  assert.deepEqual(reloaded, ['t1']);
});

test('loadCart: 壊れたJSONが保存されていても、空配列を返して例外を投げない', () => {
  const storage = createFakeStorage();
  storage.setItem('digest-playlist:cart', '{not valid json');
  assert.deepEqual(loadCart(storage), []);
});

test('loadCart: 配列以外が保存されていた場合も、空配列を返す', () => {
  const storage = createFakeStorage();
  storage.setItem('digest-playlist:cart', JSON.stringify({ not: 'an array' }));
  assert.deepEqual(loadCart(storage), []);
});
