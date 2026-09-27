import { fakeIndexedDB } from './helpers/mini-indexeddb.js';

// storage.js は実行時のグローバル `indexedDB` を参照するので、
// import前にテスト用の代替をグローバルへ差し込む。
globalThis.indexedDB = fakeIndexedDB;

import test from 'node:test';
import assert from 'node:assert/strict';
import { saveMedley, getMedley, getAllMedleys, deleteMedley } from '../js/storage.js';
import { createMedley, addTrackToMedley } from '../js/models.js';

// Node上にテスト用の簡易IndexedDB代替を用意し、storage.jsの保存/読込/削除を検証する（FR-3.1）。
// （npm の fake-indexeddb はこの環境のネットワーク制限でインストールできなかったため、
//   test/helpers/mini-indexeddb.js に最小限の代替を実装している）

test('saveMedley → getMedley: 保存した内容がそのまま読み出せる', async () => {
  let m = createMedley('保存テスト');
  m = addTrackToMedley(m, 't1').medley;
  m = addTrackToMedley(m, 't2').medley;
  await saveMedley(m);
  const loaded = await getMedley(m.id);
  assert.equal(loaded.name, '保存テスト');
  assert.deepEqual(loaded.trackIds, ['t1', 't2']);
});

test('saveMedley: 曲名やジャケット等、識別情報以外を保存しようとすると拒否される (FR-3.2)', async () => {
  const invalid = { id: 'x', name: 'x', trackIds: [{ title: '曲名も保存してしまっている' }] };
  await assert.rejects(() => saveMedley(invalid));
});

test('getAllMedleys: 保存した複数のメドレーを全件取得できる', async () => {
  const a = createMedley('メドレーA');
  const b = createMedley('メドレーB');
  await saveMedley(a);
  await saveMedley(b);
  const all = await getAllMedleys();
  const ids = all.map((x) => x.id);
  assert.ok(ids.includes(a.id));
  assert.ok(ids.includes(b.id));
});

test('deleteMedley: 削除したメドレーは取得できなくなる (FR-2.3)', async () => {
  const m = createMedley('削除対象');
  await saveMedley(m);
  assert.ok(await getMedley(m.id));
  await deleteMedley(m.id);
  const after = await getMedley(m.id);
  assert.equal(after, undefined);
});

test('saveMedley: 曲の順序を保ったまま保存・読込できる', async () => {
  let m = createMedley('順序テスト');
  for (const id of ['c', 'a', 'b']) {
    m = addTrackToMedley(m, id).medley;
  }
  await saveMedley(m);
  const loaded = await getMedley(m.id);
  assert.deepEqual(loaded.trackIds, ['c', 'a', 'b']);
});
