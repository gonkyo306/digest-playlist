// CR-028（NFR-5.3）：複数のダイアログ・オーバーレイが同時に開かないようにする、
// enqueueDialogの直列化ロジックのUnitテスト（DOM操作を伴わない範囲で）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueDialog } from '../js/views/dialog.js';

test('enqueueDialog: 1件目が解決するまで、2件目のfactoryは呼ばれない (CR-028)', async () => {
  const order = [];
  let resolveFirst;
  const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });

  const p1 = enqueueDialog(() => {
    order.push('first-start');
    return firstPromise.then(() => {
      order.push('first-end');
      return 'first-result';
    });
  });

  const p2 = enqueueDialog(() => {
    order.push('second-start');
    return Promise.resolve('second-result');
  });

  // 1件目がまだ解決していない間は、2件目のfactoryはまだ呼ばれていない
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ['first-start']);

  resolveFirst();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(r1, 'first-result');
  assert.equal(r2, 'second-result');
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start']);
});

test('enqueueDialog: 1件目が失敗しても、2件目は続けて実行される', async () => {
  const p1 = enqueueDialog(() => Promise.reject(new Error('boom'))).catch((e) => e.message);
  const p2 = enqueueDialog(() => Promise.resolve('ok'));

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 'boom');
  assert.equal(r2, 'ok');
});
