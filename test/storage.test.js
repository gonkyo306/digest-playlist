import { fakeIndexedDB } from './helpers/mini-indexeddb.js';

// storage.js は実行時のグローバル `indexedDB` を参照するので、
// import前にテスト用の代替をグローバルへ差し込む。
globalThis.indexedDB = fakeIndexedDB;

import test from 'node:test';
import assert from 'node:assert/strict';
import { savePlaylist, getPlaylist, getAllPlaylists, deletePlaylist } from '../js/storage.js';
import { createPlaylist, addTrackToPlaylist } from '../js/models.js';

// Node上にテスト用の簡易IndexedDB代替を用意し、storage.jsの保存/読込/削除を検証する（FR-3.1）。
// （npm の fake-indexeddb はこの環境のネットワーク制限でインストールできなかったため、
//   test/helpers/mini-indexeddb.js に最小限の代替を実装している）

test('savePlaylist → getPlaylist: 保存した内容がそのまま読み出せる', async () => {
  let m = createPlaylist('保存テスト');
  m = addTrackToPlaylist(m, 't1').playlist;
  m = addTrackToPlaylist(m, 't2').playlist;
  await savePlaylist(m);
  const loaded = await getPlaylist(m.id);
  assert.equal(loaded.name, '保存テスト');
  assert.deepEqual(loaded.trackIds, ['t1', 't2']);
});

test('savePlaylist: 曲名やジャケット等、識別情報以外を保存しようとすると拒否される (FR-3.2)', async () => {
  const invalid = { id: 'x', name: 'x', trackIds: [{ title: '曲名も保存してしまっている' }] };
  await assert.rejects(() => savePlaylist(invalid));
});

test('getAllPlaylists: 保存した複数のプレイリストを全件取得できる', async () => {
  const a = createPlaylist('プレイリストA');
  const b = createPlaylist('プレイリストB');
  await savePlaylist(a);
  await savePlaylist(b);
  const all = await getAllPlaylists();
  const ids = all.map((x) => x.id);
  assert.ok(ids.includes(a.id));
  assert.ok(ids.includes(b.id));
});

test('deletePlaylist: 削除したプレイリストは取得できなくなる (FR-2.3)', async () => {
  const m = createPlaylist('削除対象');
  await savePlaylist(m);
  assert.ok(await getPlaylist(m.id));
  await deletePlaylist(m.id);
  const after = await getPlaylist(m.id);
  assert.equal(after, undefined);
});

test('savePlaylist → getPlaylist: 画像（Blob）付きプレイリストも保存・読込できる (CR-043)', async () => {
  const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
  const m = createPlaylist('画像付き', blob);
  await savePlaylist(m);
  const loaded = await getPlaylist(m.id);
  assert.ok(loaded.coverImage instanceof Blob, 'coverImageはBlobのまま読み出せる');
  assert.equal(loaded.coverImage.type, 'image/jpeg');
  assert.equal(loaded.coverImage.size, blob.size);
});

test('savePlaylist: 曲の順序を保ったまま保存・読込できる', async () => {
  let m = createPlaylist('順序テスト');
  for (const id of ['c', 'a', 'b']) {
    m = addTrackToPlaylist(m, id).playlist;
  }
  await savePlaylist(m);
  const loaded = await getPlaylist(m.id);
  assert.deepEqual(loaded.trackIds, ['c', 'a', 'b']);
});

test('旧バージョン（ストア名: medleys）に保存済みのデータは、呼称変更後も消えずに引き継がれる (CR-009)', async () => {
  // CR-009（「メドレー」→「プレイリスト」統一）で、IndexedDBのストア名も medleys → playlists に
  // 変更したため、実機で既に保存されていたデータが消えないことを確認する。
  fakeIndexedDB._reset();
  // v1（呼称変更前）の状態を模して、ストア名 medleys にデータを直接仕込んでおく
  const legacyOpenReq = fakeIndexedDB.open('digest-playlist', 1);
  await new Promise((resolve) => {
    legacyOpenReq.onupgradeneeded = () => {
      legacyOpenReq.result.createObjectStore('medleys', { keyPath: 'id' });
    };
    legacyOpenReq.onsuccess = () => resolve();
  });
  const legacyDb = legacyOpenReq.result;
  const legacyTx = legacyDb.transaction('medleys');
  legacyTx.objectStore('medleys').put({ id: 'legacy-1', name: '旧データ', trackIds: ['t1', 't2'] });
  await new Promise((resolve) => { legacyTx.oncomplete = resolve; });

  // storage.js（DB_VERSION=2、ストア名 playlists）経由でアクセスすると、移行されて読み出せるはず
  const migrated = await getPlaylist('legacy-1');
  assert.ok(migrated, '旧ストアのデータが新ストアへ移行されているはず');
  assert.equal(migrated.name, '旧データ');
  assert.deepEqual(migrated.trackIds, ['t1', 't2']);

  const all = await getAllPlaylists();
  assert.ok(all.some((p) => p.id === 'legacy-1'));
});
